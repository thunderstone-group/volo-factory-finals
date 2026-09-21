"""Docker application tools; protected verification and checkpoints stay on the host."""
import hashlib
import json
from pathlib import Path
import shlex
import shutil
import subprocess
import sys
import time
import uuid

from business_replay import fingerprint
from business_model_step import feedback
from experiment_recovery import atomic_json


def copy_source(source,target):
    source=Path(source)
    for p in source.rglob('*'):
        if p.is_symlink():raise ValueError('application symlinks are not allowed')
    shutil.copytree(source,target,ignore=shutil.ignore_patterns('node_modules','dist','__pycache__'))


class AppEnvironment:
    def __init__(self,root,plan,lock):
        self.root=Path(root);self.plan=plan;self.lock=lock
        self.repo=Path(__file__).resolve().parents[2]
        self.work=self.root/'work';self.app=self.work/'application';self.notes=self.work/'notes'
        self.notes.mkdir(parents=True,exist_ok=True)
        if not self.app.exists():copy_source(plan['baseline_application'],self.app)
        self.state_path=self.root/'environment.json'
        self.state=json.loads(self.state_path.read_text()) if self.state_path.exists() else {'accepted_application':plan['baseline_application'],'accepted_probe':plan['baseline_probe'],'checks':[],'actions':[]}
        self.container='arc-mini-'+uuid.uuid4().hex[:10];self.built_sha=None;self.running=False

    def start(self):
        cmd=['docker','--context','desktop-linux','run','-d','--rm','--init','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--cpus','1','--memory','2g','--network','none','--tmpfs','/tmp:rw,size=536870912','--name',self.container,'--mount',f'type=bind,source={self.app},target=/workspace/application','--mount',f'type=bind,source={self.notes},target=/workspace/notes','--mount',f'type=bind,source={Path(self.plan["requirements"])},target=/workspace/requirements.yaml,readonly','--mount',f'type=bind,source={self.repo/"scripts/mini_swe/runtime.cjs"},target=/tools/runtime.cjs,readonly','--mount',f'type=bind,source={self.repo/"scripts/mini_swe/browser_client.cjs"},target=/tools/browser_client.cjs,readonly','--workdir','/workspace/application','arc-business-feedback:20260921','sleep','infinity']
        subprocess.run(cmd,check=True,capture_output=True)
        self.running=True
        atomic_json(self.root/'container.json',{'name':self.container,'command':cmd})

    def close(self):
        if self.running:subprocess.run(['docker','--context','desktop-linux','rm','-f',self.container],capture_output=True)
        self.running=False

    def docker(self,argv,*,stdin=None,timeout=120):
        cmd=['docker','--context','desktop-linux','exec']
        if stdin is not None:cmd+=['-i']
        cmd += [self.container,*argv]
        try:
            p=subprocess.run(cmd,input=stdin,text=True,capture_output=True,timeout=timeout,pass_fds=(self.lock.fd,))
            output=p.stdout+p.stderr
            if len(output)>18000:output=output[:9000]+'\n[output truncated; use narrower reads]\n'+output[-9000:]
            return {'returncode':p.returncode,'output':output}
        except subprocess.TimeoutExpired:return {'returncode':124,'output':'Command timed out; inspect process/app state before retrying.'}

    def build(self):
        # Only this tool manages the live server; source files remain distinct from
        # mutable backend data produced by browser exploration.
        self.docker(['bash','-lc',"if [ -f /tmp/arc-runtime.pid ]; then kill -- -$(cat /tmp/arc-runtime.pid) 2>/dev/null || true; fi; rm -rf /tmp/arc-live /tmp/arc-live-ready; setsid node /tools/runtime.cjs > /tmp/arc-runtime.log 2>&1 < /dev/null & echo $! > /tmp/arc-runtime.pid"],timeout=10)
        result=self.docker(['bash','-lc',"for i in $(seq 1 120); do if [ -f /tmp/arc-live-ready ]; then cat /tmp/arc-runtime.log; exit 0; fi; if ! kill -0 $(cat /tmp/arc-runtime.pid) 2>/dev/null; then cat /tmp/arc-runtime.log; exit 1; fi; sleep 0.25; done; cat /tmp/arc-runtime.log; exit 1"],timeout=40)
        if result['returncode']==0:self.built_sha=fingerprint(self.app);result['output']='Build and live browser ready. '+result['output']
        return result

    def goal(self,report):
        target=[c for c in report['cases'] if c['name'].startswith('ORDER-GOAL ')]
        if len(target)!=self.plan['goal_count'] or not target:raise ValueError('scoped goal check count mismatch')
        return {'passed':sum(c['passed'] for c in target),'total':len(target),'remaining':[c['name'] for c in target if not c['passed']],'full_requirement_verification':False}

    def verify(self):
        source_sha=fingerprint(self.app)
        if hashlib.sha256(Path(self.plan['probe_file']).read_bytes()).hexdigest()!=self.plan['probe_file_sha256']:
            raise ValueError('protected probe changed')
        current=json.loads(Path(self.state['accepted_probe']).read_text())
        if source_sha==current['source_sha256']:
            targets=[c for c in current['cases'] if c['name'].startswith('ORDER-GOAL ')]
            return {'goal':self.goal(current),'outcome':{'accepted':False,'gained':[],'lost':[]},'diagnostics':feedback({**current,'cases':targets}),'source_sha256':source_sha,'already_verified':True}
        for item in self.state['checks']:
            if item['source_sha256']==source_sha:return item['feedback']
        if len(self.state['checks'])>=self.plan['max_verifications']:raise RuntimeError('verification limit reached')
        before=json.loads(Path(self.state['accepted_probe']).read_text());out=self.root/f'verify-{len(self.state["checks"])+1:02d}'
        cmd=[sys.executable,str(self.repo/'scripts/business_replay.py'),'--mode','probe','--shared-server','--probe-count',str(self.plan['probe_count']),'--probe-source',self.plan['probe_file'],'--application',str(self.app),'--out',str(out)]
        with out.with_suffix('.log').open('w') as log:r=subprocess.run(cmd,cwd=self.repo,stdout=log,stderr=subprocess.STDOUT,pass_fds=(self.lock.fd,))
        if r.returncode:raise RuntimeError('verification infrastructure failed: '+str(out))
        report=json.loads((out/'result.json').read_text())
        if report.get('application_failure'):
            outcome={'accepted':False,'gained':[],'lost':[],'application_failure':report['application_failure']};note=outcome
        else:
            if before['checks_sha256']!=report['checks_sha256'] or before['runtime']!=report['runtime']:raise ValueError('fixed verification changed')
            old={c['name']:c['passed'] for c in before['cases']};new={c['name']:c['passed'] for c in report['cases']}
            if old.keys()!=new.keys():raise ValueError('case set changed')
            gained=[k for k in old if new[k] and not old[k]];lost=[k for k in old if old[k] and not new[k]]
            accepted=not lost and any(k.startswith('ORDER-GOAL ') for k in gained)
            outcome={'accepted':accepted,'gained':gained,'lost':lost}
            targets=[c for c in report['cases'] if c['name'].startswith('ORDER-GOAL ')]
            prioritized={**report,'cases':targets+[c for c in report['cases'] if c not in targets and c['name'] in lost]}
            note={'goal':self.goal(report),'outcome':outcome,'diagnostics':feedback(prioritized),'protected_passes':[k for k in old if old[k]],'source_sha256':source_sha}
        if outcome['accepted']:
            checkpoint=self.root/'checkpoints'/out.name;checkpoint.parent.mkdir(exist_ok=True);copy_source(self.app,checkpoint)
            self.state.update(accepted_application=str(checkpoint),accepted_probe=str(out/'result.json'))
        elif outcome.get('lost') or report.get('application_failure'):
            shutil.rmtree(self.app);copy_source(self.state['accepted_application'],self.app)
            # Bind mounts retain an old inode after replacing their source directory.
            if self.running:self.close();self.start()
            self.built_sha=None
            note['rollback']='Candidate lost protected behavior or failed to build; restored last accepted source.'
        self.state['checks'].append({'source_sha256':source_sha,'result':str(out/'result.json'),'outcome':outcome,'feedback':note})
        atomic_json(self.state_path,self.state)
        return note

    def execute(self,action,cwd=''):
        if action.get('parse_error'):return {'returncode':2,'output':action['parse_error']}
        command=action['command'].strip();identifier=action.get('tool_call_id') or hashlib.sha256(command.encode()).hexdigest()
        for old in self.state['actions']:
            if old['id']==identifier:
                if old['status']!='completed':raise RuntimeError('tool action has uncertain completion; inspect before replay')
                return old['result']
        record={'id':identifier,'command':command,'status':'reserved','started_at':time.time()};self.state['actions'].append(record);atomic_json(self.state_path,self.state)
        try:
            if command in ('arc verify','arc submit','echo COMPLETE_TASK_AND_SUBMIT_FINAL_OUTPUT'):
                note=self.verify();result={'returncode':0,'output':json.dumps(note,ensure_ascii=False)}
                if command!='arc verify':
                    accepted=json.loads(Path(self.state['accepted_probe']).read_text());goal=self.goal(accepted)
                    if goal['passed']==goal['total']:
                        from minisweagent.exceptions import Submitted
                        result={'returncode':0,'output':'Scoped goal passed protected verification.'}
                        record.update(status='completed',result=result)
                        atomic_json(self.state_path,self.state)
                        raise Submitted({'role':'exit','content':'Scoped goal verified','extra':{'exit_status':'ScopedGoalPassed','submission':self.state['accepted_application']}})
                    result['output']+='\nGoal remains incomplete; inspect failures and continue within the remaining budget.'
            elif command=='arc build':result=self.build()
            elif command=='arc status':
                result={'returncode':0,'output':json.dumps({'goal':self.goal(json.loads(Path(self.state['accepted_probe']).read_text())),'accepted_application':self.state['accepted_application'],'verifications_used':len(self.state['checks'])},ensure_ascii=False)}
            elif command.startswith('arc browser '):
                args=shlex.split(command)
                if len(args)!=3:result={'returncode':2,'output':'Use arc browser /workspace/notes/script.js, with an async Playwright script using page, browser, context, expect, log.'}
                else:
                    built={'returncode':0,'output':''}
                    if self.built_sha!=fingerprint(self.app):built=self.build()
                    if built['returncode']:
                        result=built
                    else:
                        script=self.docker(['cat','--',args[2]])
                        result=script if script['returncode'] else self.docker(['node','/tools/browser_client.cjs'],stdin=json.dumps({'code':script['output']}),timeout=90)
            else:result=self.docker(['timeout','120','bash','-lc',command],timeout=140)
            record.update(status='completed',result=result,finished_at=time.time());atomic_json(self.state_path,self.state)
            return result
        except BaseException:
            atomic_json(self.state_path,self.state);raise

    def get_template_vars(self,**kwargs):return {'system':'Linux','machine':'arm64','release':'pinned-container','version':'Node 20.19.3 / Playwright 1.57.0',**kwargs}
    def serialize(self):return {'arc_environment':{'container':self.container,'state_path':str(self.state_path),'accepted_application':self.state['accepted_application']}}
