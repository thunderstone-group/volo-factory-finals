"""One serial, fixed 4x3 paired campaign. Independent scoring is downstream only."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import time
import zipfile
from decimal import Decimal

from oneshot import main as baseline
from oneshot.minimal_feedback import run as repair, identity
from scripts.arc_read import read_json
from scripts.evaluate_minimal import evaluate

TASKS={'smoke-evolution--counter':2,'smoke-evolution--dice':2,'ticket-booking--ticket-booking':10,'arc-bench-lite--keep':32}
MODEL='deepseek-v4-flash'
REPO=Path('~/projects/volo-factory')
WORK=Path(__file__).resolve().parents[1]
IMAGE='sha256:57acabb2b05fc9abd27e596264dab52647b3fafe1bf966bd25c817e9646afca2'
PYTHON=REPO/'.venv/bin/python'
PACKAGE_SHA='8e59406c7960f4301d51c7f20978e0cf58bdd5bc22a6aedfce0174a5c183d007'
CODE=['oneshot/main.py','oneshot/dialect.md','oneshot/minimal_feedback.py','oneshot/minimal_runtime.py','oneshot/runtime_probe.cjs','scripts/evaluate_minimal.py','scripts/run_minimal_paired.py']


def save(path,obj):path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
def hashes(root):return {str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in root.rglob('*') if p.is_file()}
def event(**data):print(json.dumps(data,ensure_ascii=False),flush=True)


def main(root):
    os.umask(0o077)
    root=Path(root).resolve()
    envfile=Path.home()/'.config/arcbench/volo.env'; config={}
    for line in envfile.read_text().splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            name,value=line.removeprefix('export ').split('=',1);values=shlex.split(value)
            if len(values)==1:config[name.strip()]=values[0]
    key=config['ARC_BENCH_API_KEY']
    secrets=[v for k,v in config.items() if any(s in k.upper() for s in ('KEY','TOKEN','COOKIE','SECRET','PASSWORD'))]
    cli=['arcbench','--env-file',str(envfile),'--json','--log-file',str(root/'cli-requests.jsonl')]
    def api(*args):return read_json(cli,list(args),root/'cli-preflight.jsonl',secrets=secrets)
    def settled():
        for _ in range(6):
            d=api('balance')
            if d.get('pending_billing_events')==0:return d
            time.sleep(2)
        raise RuntimeError('Billing not settled; stop without overlapping another request')
    def idle():
        rows=api('runs','--limit','200')
        if not isinstance(rows,list):raise RuntimeError('Unknown run-list contract')
        if any(r['status'] not in ('PASSED','FAILED','CANCELLED') and r.get('run_id') not in ('c5608657cdd0','a6d5b8635598') for r in rows):
            raise RuntimeError('Active or unfamiliar pending official run; no gateway request')
    def source_gate():
        if {n:hashlib.sha256((WORK/n).read_bytes()).hexdigest() for n in CODE}!=manifest['code_sha256']:
            raise RuntimeError('Candidate changed during the paired campaign')
    package=root/'baseline.zip'
    if not package.exists():shutil.copy2(REPO/'oneshot/dist/oneshot.zip',package)
    assert hashlib.sha256(package.read_bytes()).hexdigest()==PACKAGE_SHA
    extracted=root/'baseline-package'
    if not extracted.exists():
        with zipfile.ZipFile(package) as z:z.extractall(extracted)
    manifest_path=root/'campaign.json'
    if manifest_path.exists():manifest=json.loads(manifest_path.read_text())
    else:
        manifest={'model':MODEL,'image_id':IMAGE,'baseline_package_sha256':PACKAGE_SHA,'samples_per_task':3,'tasks':TASKS,
                  'generation_request_cap':3,'repair_request_cap':2,'generation_deadline_seconds':1500,
                  'code_sha256':{n:hashlib.sha256((WORK/n).read_bytes()).hexdigest() for n in CODE},
                  'inputs_sha256':hashes(root/'inputs'),'tests_sha256':hashes(root/'evaluation-specs'),
                  'templates_sha256':hashes(root/'templates'),'evaluation_feedback_to_model':False}
        save(manifest_path,manifest)
    rows=[]
    with (REPO/'runs/.oneshot-local-generation.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        idle(); before=settled()
        if not (root/'balance-before.json').exists():save(root/'balance-before.json',before)
        else:before=json.loads((root/'balance-before.json').read_text())
        for task,expected in TASKS.items():
            for trial in range(1,4):
                folder=root/'samples'/(task+'--'+str(trial));folder.mkdir(parents=True,exist_ok=True)
                if (folder/'result.json').exists():
                    rows.append(json.loads((folder/'result.json').read_text()));continue
                if (folder/'invocation.json').exists():raise RuntimeError('Interrupted sample has evidence; inspect before resuming')
                source_gate();idle();initial_balance=settled()
                a0=folder/'A0'
                if task.startswith('smoke-evolution--'):shutil.copytree(root/'templates'/task.split('--')[-1],a0)
                args=[str(PYTHON),'-B',str(extracted/'main.py'),str(root/'inputs'/task),'--output-dir',str(a0),'--type','web']
                env={'PATH':os.environ['PATH'],'HOME':str(Path.home()),'OPENAI_API_KEY':key,'OPENAI_BASE_URL':baseline.DEFAULT_BASE,'MODEL':MODEL,'PYTHONDONTWRITEBYTECODE':'1','PYTHONUNBUFFERED':'1'}
                save(folder/'invocation.json',{'task':task,'trial':trial,'command':args,'model':MODEL,'balance_before':initial_balance})
                event(event='generation_started',task=task,trial=trial)
                started=time.monotonic();timed_out=False
                with (folder/'generation.stdout.log').open('w') as out,(folder/'generation.stderr.log').open('w') as err:
                    process=subprocess.Popen(args,env=env,cwd=folder,stdout=out,stderr=err)
                    while process.poll() is None:
                        try:process.wait(timeout=30)
                        except subprocess.TimeoutExpired:
                            elapsed=time.monotonic()-started
                            event(event='generation_progress',task=task,trial=trial,elapsed_seconds=round(elapsed))
                            if elapsed>1500:process.kill();process.wait();timed_out=True;break
                generation={'exit_code':process.returncode,'seconds':round(time.monotonic()-started,3),'timeout':timed_out}
                for line in (folder/'generation.stderr.log').read_text().splitlines():
                    if line.startswith('[oneshot] usage '):generation['usage']=json.loads(line[len('[oneshot] usage '):])
                    if line.startswith('[oneshot] failed:'):generation['error']=line[:3000]
                save(folder/'generation.json',generation)
                after_generation=settled();save(folder/'balance-after-generation.json',after_generation)
                row={'task':task,'trial':trial,'expected_tests':expected,'generation':generation,'official_score':False}
                if timed_out:raise RuntimeError('Generation deadline reached; unknown model outcome, stopping campaign')
                if process.returncode!=0:
                    row.update(status='generation_failed',before_passed=0,after_passed=0,repair_calls=0)
                else:
                    a0_files=hashes(a0);save(folder/'A0-sha256.json',a0_files)
                    source_gate();idle();event(event='runtime_feedback_started',task=task,trial=trial)
                    repaired=folder/'B'
                    feedback=repair(a0,repaired,runtime_image=IMAGE,max_rounds=2,
                                    model_config={'key':key,'model':MODEL,'base':baseline.DEFAULT_BASE})
                    save(folder/'repair.json',feedback)
                    assert hashes(a0)==a0_files
                    row.update(repair_calls=feedback['model_api_calls'],repair_stop=feedback['stop_reason'],
                               runtime_before=feedback['baseline_feedback']['status'],
                               runtime_after=(feedback['rounds'][-1]['feedback']['status'] if feedback['rounds'] and feedback['rounds'][-1].get('accepted') else feedback['baseline_feedback']['status']))
                    # Both outcomes are frozen BEFORE reading any independent score.
                    event(event='behavior_evaluation_started',task=task,trial=trial,repair_calls=row['repair_calls'])
                    a=evaluate(a0,root/'evaluation-specs'/task,folder/'evaluation-A',IMAGE,expected)
                    if hashes(repaired)==a0_files:
                        b=dict(a);b['reused_identical_artifact_evaluation']=True
                        (folder/'evaluation-B').mkdir();save(folder/'evaluation-B/result.json',b)
                    else:b=evaluate(repaired,root/'evaluation-specs'/task,folder/'evaluation-B',IMAGE,expected)
                    passed=lambda r:{(c['file'],c['title']) for c in r.get('cases',[]) if c['status']=='passed'}
                    row.update(status='evaluated',before_passed=a['passed'],after_passed=b['passed'],
                               evaluation_before=a['status'],evaluation_after=b['status'],
                               gained=sorted(passed(b)-passed(a)),regressed=sorted(passed(a)-passed(b)),
                               identical_artifact=hashes(repaired)==a0_files,
                               cleanup_verified=a.get('cleanup_verified') and b.get('cleanup_verified') and feedback['baseline_feedback'].get('cleanup_verified'))
                    assert hashes(a0)==a0_files
                after=settled();save(folder/'balance-after.json',after)
                row['observed_cost_cny']=str(Decimal(initial_balance['available_balance'])-Decimal(after['available_balance']))
                row['elapsed_seconds']=round(time.monotonic()-started,3)
                save(folder/'result.json',row);rows.append(row);save(root/'results.json',rows)
                event(event='sample_completed',**{k:row.get(k) for k in ('task','trial','status','before_passed','after_passed','repair_calls','repair_stop','observed_cost_cny')})
        source_gate();assert hashes(root/'inputs')==manifest['inputs_sha256'];assert hashes(root/'evaluation-specs')==manifest['tests_sha256']
        after=settled();save(root/'balance-after.json',after)
        summary={'samples':len(rows),'model':MODEL,'rows':rows,'observed_cost_cny':str(Decimal(before['available_balance'])-Decimal(after['available_balance'])),
                 'generation_calls':sum(r['generation'].get('usage',{}).get('calls',0) for r in rows),
                 'repair_calls':sum(r['repair_calls'] for r in rows),'official_runs':0,'source_and_tests_unchanged':True}
        save(root/'summary.json',summary);event(event='campaign_completed',samples=len(rows),cost_cny=summary['observed_cost_cny'],repair_calls=summary['repair_calls'])

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('evidence_root',type=Path);args=p.parse_args();main(args.evidence_root)
