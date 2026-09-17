"""Independent local behavior scoring. Never imported by repair or generation.

The evaluator has its own filesystem/container; it joins only the network namespace
of a network-none application. Tests cannot be read by the application container.
"""
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import shutil
import tempfile
import time
import uuid

from oneshot import main as baseline
from oneshot.minimal_feedback import _process, identity
from oneshot.minimal_runtime import DockerRuntime, CLEAN, APP_UID, CHECK_UID, source_files


def parse_cases(report):
    cases=[]
    def walk(suite):
        for spec in suite.get('specs',[]):
            for test in spec.get('tests',[]):
                result=(test.get('results') or [{}])[-1]
                cases.append({'title':spec['title'],'file':spec.get('file'),'status':result.get('status','not_run'),
                              'error':(result.get('error') or {}).get('message','')[:4000]})
        for child in suite.get('suites',[]):walk(child)
    for suite in report.get('suites',[]):walk(suite)
    return cases


def evaluate(app, tests, output, image, expected):
    output=Path(output);output.mkdir(parents=True)
    tests=Path(tests).resolve(); blobs=baseline.read_template(app)
    hashes=lambda root:{str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in root.rglob('*') if p.is_file()}
    before=hashes(tests)
    runtime=DockerRuntime(image,seconds=300)
    result={'candidate_sha256':identity(blobs),'expected_tests':expected,'official_score':False,
            'feedback_to_model':False,'model_calls':0,'cases':[],'passed':0,'failed':0,'status':'unknown'}
    pre=runtime.preflight();result['environment']=pre
    if pre['status']!='pass':
        result.update(status='environment_error',error=pre)
        (output/'result.json').write_text(json.dumps(result,indent=2)+'\n');return result
    app_name='volo-minimal-'+uuid.uuid4().hex;eval_name='volo-eval-'+uuid.uuid4().hex
    evaluation_deadline = expected * 12 + 30
    pool=concurrent.futures.ThreadPoolExecutor(max_workers=1);server=None;started=time.monotonic()
    def command(args,seconds=15):return runtime.command(args,timeout=seconds)
    def app_exec(args,cwd='/work',uid=APP_UID,seconds=30):
        return command(['exec','--user',uid,'--workdir',cwd,app_name,*CLEAN,*args],seconds)
    def probe(mode):
        r=app_exec(['node','/verifier.cjs',mode],uid=CHECK_UID,seconds=3)
        try:return r,json.loads(r['output'])
        except ValueError:return r,{}
    with tempfile.TemporaryDirectory(prefix='minimal-eval-') as temp:
        root=Path(temp);source=root/'source';source.mkdir();source.chmod(0o755)
        for n,b in source_files(blobs).items():
            p=source/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b);p.chmod(0o644)
        for p in source.rglob('*'):
            if p.is_dir():p.chmod(0o755)
        config=root/'config.cjs'
        config.write_text('module.exports='+json.dumps({'testDir':'/evaluator','workers':1,'fullyParallel':False,
            'timeout':10000,'expect':{'timeout':10000},'retries':0,'reporter':'json','outputDir':'/tmp/test-results',
            'use':{'baseURL':'http://127.0.0.1:3301','headless':True,'trace':'off','video':'off','screenshot':'off'}})+';\n')
        config.chmod(0o644)
        try:
            for args in (runtime.create_args(app_name,source),['start',app_name]):
                r=command(args)
                if r['exit_code']!=0 or r.get('reason'):raise RuntimeError('Application isolation failed: '+str(r))
            r=app_exec(['node','/verifier.cjs','copy'])
            if r['exit_code']!=0:raise RuntimeError('Source copy failed')
            build=app_exec(['npm','run','build'],cwd='/work/frontend')
            (output/'build.json').write_text(json.dumps(build,indent=2)+'\n')
            if build['exit_code']!=0 or build.get('reason'):
                result.update(status='build_failed');return result
            import shlex
            start=shlex.split(json.loads(blobs['backend/package.json'])['scripts']['start'])
            server=pool.submit(app_exec,start,'/work/backend',APP_UID,evaluation_deadline+60)
            ready=time.monotonic()+12
            while time.monotonic()<ready:
                if server.done():result.update(status='start_failed');return result
                r,data=probe('health')
                if r['exit_code']==0 and data.get('http_status')==200 and data.get('json')=={'code':200,'message':'Backend Ready'}:break
                time.sleep(.1)
            else:result.update(status='health_failed');return result
            args=['run','--pull=never','--name',eval_name,'--label','volo.minimal.evaluator='+eval_name,
                  '--network=container:'+app_name,'--read-only','--cap-drop=ALL','--security-opt=no-new-privileges',
                  '--memory=2g','--memory-swap=2g','--cpus=1','--pids-limit=256','--user',CHECK_UID,
                  '--init','--no-healthcheck','--log-driver=none','--shm-size=128m',
                  '--tmpfs','/tmp:rw,nosuid,nodev,size=268435456,mode=1777',
                  '--mount',f'type=bind,src={tests},dst=/evaluator,readonly',
                  '--mount',f'type=bind,src={config},dst=/eval-config.cjs,readonly',
                  '--workdir','/tmp','--entrypoint',CLEAN[0],runtime.image,*CLEAN[1:],
                  'NODE_PATH=/opt/arc/node_modules','PLAYWRIGHT_BROWSERS_PATH=/ms-playwright','E2E_BASE_URL=http://127.0.0.1:3301',
                  'node','/opt/arc/node_modules/@playwright/test/cli.js','test','--config=/eval-config.cjs']
            r=_process(runtime.prefix+args,Path.cwd(),evaluation_deadline,env=runtime.env,max_log=2*1024*1024)
            (output/'playwright.stdout.json').write_text(r['output'])
            result.update(exit_code=r['exit_code'],process_reason=r.get('reason'),playwright='1.61.1',node='v22.17.0',workers=1,test_timeout_ms=10000)
            if r.get('reason'):return result
            report=json.loads(r['output']);result['cases']=parse_cases(report)
            result['passed']=sum(c['status']=='passed' for c in result['cases'])
            result['failed']=sum(c['status'] in ('failed','timedOut','interrupted') for c in result['cases'])
            result['runner_errors']=report.get('errors',[])
            result['status']='scored' if len(result['cases'])==expected and not result['runner_errors'] else 'incomplete'
            return result
        except (OSError,ValueError,RuntimeError) as exc:
            result.update(status='environment_error',error=str(exc)[:4000]);return result
        finally:
            # Only names bearing our unpredictable per-run ownership labels are removed.
            cleanup=[]
            for name,key in [(eval_name,'volo.minimal.evaluator'),(app_name,'volo.minimal.instance')]:
                inspected=command(['inspect',name,'--format','{{json .Config.Labels}}'])
                try:own=json.loads(inspected['output']).get(key)==name
                except (ValueError,AttributeError):own=False
                if own:command(['rm','-f',name])
                remains=command(['ps','-aq','--filter','name=^/'+name+'$'])
                cleanup.append(remains['exit_code']==0 and not remains.get('reason') and not remains['output'].strip())
            pool.shutdown(wait=True)
            if server:(output/'server.json').write_text(json.dumps(server.result(),indent=2)+'\n')
            result['cleanup_verified']=all(cleanup)
            result['tests_unchanged']=hashes(tests)==before
            result['original_unchanged']=baseline.read_template(app)==blobs
            if not all((result['cleanup_verified'],result['tests_unchanged'],result['original_unchanged'])):result['status']='invalid'
            result['elapsed_seconds']=round(time.monotonic()-started,3)
            (output/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
