#!/usr/bin/env python3
"""Run the frozen finals proxy in the organizer's installed runner image."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time
from scripts.freeze import TEST_TASKS, digest, files, test_task, verify

ROOT=Path(__file__).resolve().parent
IMAGE='gyataro/arcbench-runner:local-base'
ANSI=re.compile(r'\x1b\[[0-9;]*m')
def within(path):
    p=Path(path).resolve()
    if not p.is_relative_to(ROOT):raise ValueError('Output must be inside '+str(ROOT))
    return p
def tree_hash(path):
    h=hashlib.sha256()
    for p in sorted(path.rglob('*')):
        if not p.is_file() or any(x in p.parts for x in ['node_modules','.git','dist','__pycache__']):continue
        h.update(str(p.relative_to(path)).encode());h.update(b'\0');h.update(p.read_bytes());h.update(b'\0')
    return h.hexdigest()
def flatten(report):
    entries=[]
    def walk(s):
        for spec in s.get('specs',[]):
            for test in spec.get('tests',[]):
                results=test.get('results',[]);last=results[-1] if results else {}
                errors=[e.get('message','') for x in results for e in x.get('errors',[])]
                entries.append({'name':spec['title'],'file':spec.get('file'), 'status':'pass' if last.get('status')=='passed' and len(results)==1 else 'fail', 'playwright_status':last.get('status','notRun'), 'duration_ms':sum(x.get('duration',0) for x in results),'error':ANSI.sub('', '\n'.join(errors))[:2500] or None})
        for child in s.get('suites',[]):walk(child)
    for s in report.get('suites',[]):walk(s)
    return entries
def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('app_dir',type=Path);p.add_argument('task',choices=list(TEST_TASKS));p.add_argument('--out',type=Path)
    p.add_argument('--list',action='store_true',help='enumerate with npx playwright test --list, without building')
    p.add_argument('--grep',help='diagnostic subset only; excluded from full-suite acceptance')
    p.add_argument('--keep-work',action='store_true')
    a=p.parse_args();started=time.monotonic();manifest_hash=verify(a.task)
    canonical=test_task(a.task)
    test_hashes={name:sha for name,sha in files(canonical).items() if name.startswith('tests/')}
    app=a.app_dir.resolve()
    if not (app/'frontend/package.json').is_file() or not (app/'backend/package.json').is_file():p.error('app_dir must contain frontend/ and backend/')
    work_root=ROOT/'.work';work_root.mkdir(exist_ok=True)
    work=Path(tempfile.mkdtemp(prefix=f'proxy-{a.task}-',dir=work_root))
    container_name='finals-'+work.name.replace('_','-')
    out=within(a.out or ROOT/'results'/f'{a.task}-latest.json');out.parent.mkdir(parents=True,exist_ok=True)
    report={'task':a.task,'app_dir':str(app),'app_sha256':tree_hash(app),'frozen_manifest_sha256':manifest_hash,'image':IMAGE,'settings':{'workers':1,'fullyParallel':False,'timeout_ms':10000,'expect_timeout_ms':10000,'retries':0,'trace':'off','baseURL':'http://127.0.0.1:3000','server_instances':1,'context_per_test':'fresh','reset_between_tests':False},'subset':a.grep,'tests':[]}
    report.update(requirements_file=f'{a.task}/requirements/requirements.yaml',requirements_sha256=digest(ROOT/a.task/'requirements/requirements.yaml'),test_task=canonical,test_source_manifest_sha256=verify(canonical),test_files_sha256=test_hashes,test_suite_sha256=hashlib.sha256(json.dumps(test_hashes,sort_keys=True,separators=(',',':')).encode()).hexdigest())
    try:
        report['image_id']=subprocess.check_output(['docker','image','inspect',IMAGE,'--format','{{.Id}}'],text=True).strip()
        shutil.copytree(app,work/'application',ignore=shutil.ignore_patterns('node_modules','.git','dist','__pycache__'))
        cwork='/proxy/'+str(work.relative_to(ROOT))
        command=['docker','run','--rm','--name',container_name,'--platform','linux/amd64','--shm-size=1g','--mount',f'type=bind,source={ROOT},target=/proxy','--workdir','/proxy','--env','NODE_PATH=/opt/arcbench/node_modules','--env',f'PWTEST_CACHE_DIR={cwork}/pw-cache','--env',f'npm_config_cache={cwork}/npm-cache','--entrypoint','python3',IMAGE,'/proxy/scripts/container_proxy.py','--work',cwork,'--task',canonical]
        if a.list:command.append('--list')
        if a.grep:command+=['--grep',a.grep]
        with (work/'container.log').open('w') as log:
            done=subprocess.run(command,stdout=log,stderr=subprocess.STDOUT,timeout=900)
        if verify(a.task)!=manifest_hash:
            raise RuntimeError('Freeze manifest changed during execution; discard this mixed-version run')
        if a.list:
            listing=(work/'list.txt').read_text() if (work/'list.txt').exists() else (work/'container.log').read_text()
            print(listing,end='');(ROOT/'results'/f'{a.task}-test-list.txt').write_text(listing)
            return done.returncode
        raw_path=work/'playwright-report.json'
        if raw_path.exists():
            raw=json.loads(raw_path.read_text());report['tests']=flatten(raw)
            shutil.copyfile(raw_path,out.with_suffix('.playwright.json'))
            report['suite_duration_seconds']=round(raw.get('stats',{}).get('duration',0)/1000,3)
        if not report['tests'] or (not a.grep and len(report['tests'])!=30):
            report['infrastructure_error']=(work/'container.log').read_text()[-5000:]
        report['container_exit_code']=done.returncode
    except Exception as e:report['infrastructure_error']=str(e)
    finally:
        # A timed-out Docker client does not reliably stop its container.
        # Remove only this invocation's uniquely named container before scratch cleanup.
        subprocess.run(['docker','rm','-f',container_name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=False)
        if not a.list:
            report['passed']=sum(t['status']=='pass' for t in report['tests']);report['failed']=sum(t['status']=='fail' for t in report['tests']);report['total']=len(report['tests'])
            report['wall_seconds']=round(time.monotonic()-started,3)
            out.write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
            if (work/'container.log').exists():shutil.copyfile(work/'container.log',out.with_suffix('.log'))
            print(json.dumps(report,ensure_ascii=False))
        if not a.keep_work:shutil.rmtree(work)
    return 2 if report.get('infrastructure_error') else (1 if report['failed'] else 0)
if __name__=='__main__':raise SystemExit(main())
