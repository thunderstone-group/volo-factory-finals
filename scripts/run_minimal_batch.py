"""Explicit frozen-package batch; collect all samples before serial behavior scoring."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import threading
import time
import zipfile
from oneshot import main as baseline
from oneshot.minimal_runtime import DockerRuntime
from scripts.arc_read import read_json
from scripts.evaluate_minimal import evaluate
from scripts.run_minimal_paired import REPO, WORK, IMAGE, PYTHON, save, hashes, event as _event

EVENT_LOCK=threading.Lock()

def event(**data):
    with EVENT_LOCK:
        _event(**data)

CODE=['scripts/run_minimal_batch.py','scripts/arc_read.py','scripts/evaluate_minimal.py','scripts/run_minimal_paired.py',
      'oneshot/main.py','oneshot/minimal_feedback.py','oneshot/minimal_runtime.py','oneshot/runtime_probe.cjs']
DEADLINE=1500

def prompt_hash(messages):
    return hashlib.sha256(json.dumps(messages,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()

def extract_candidate(package,expected,destination):
    if hashlib.sha256(Path(package).read_bytes()).hexdigest()!=expected:raise ValueError('Candidate ZIP hash mismatch')
    with zipfile.ZipFile(package) as z:
        names=z.namelist()
        if len(set(names))!=len(names) or set(names) not in ({'main.py','dialect.md','requirements.txt'},{'main.py','core.py','dialect.md','requirements.txt'},
                {'main.py','v1.py','core.py','dialect.md','requirements.txt','interaction.js','navigation.js'}):
            raise ValueError('Unexpected package inventory')
        blobs={n:z.read(n) for n in names}
    destination=Path(destination); expected_files={n:hashlib.sha256(b).hexdigest() for n,b in blobs.items()}
    if destination.exists():
        if hashes(destination)!=expected_files:raise ValueError('Extracted candidate changed')
    else:
        destination.mkdir(parents=True)
        for n,b in blobs.items():(destination/n).write_bytes(b)
    return expected_files

def read_trace(path):
    traces=[];usage={};failure=None;pending={}
    for line in path.read_text().splitlines():
        if line.startswith('[minimal] request '):
            t=json.loads(line[len('[minimal] request '):]);pending[t['call']]=t
        elif line.startswith('[minimal] transport '):
            t=json.loads(line[len('[minimal] transport '):])
            pending.setdefault(t['call'],{'call':t['call']})['transport']=t
        elif line.startswith('[oneshot] trace '):
            t=json.loads(line[len('[oneshot] trace '):]);actual=prompt_hash(t['messages'])
            if t.get('messages_sha256',actual)!=actual:raise ValueError('Actual prompt hash mismatch')
            traces.append({k:t.get(k) for k in ('call','model','status','usage','elapsed_seconds')}|
                          {'messages_sha256':actual}|{k:t[k] for k in
                          ('error_type','http_status','finish_reason','transport') if k in t})
            pending.pop(t['call'],None)
        elif line.startswith('[oneshot] usage '):usage=json.loads(line[len('[oneshot] usage '):])
        elif line.startswith('[oneshot] failed:'):failure=line[:3000]
    for t in pending.values():
        traces.append(t|{'status':'interrupted','usage':{},'trace_complete':False,
                         'prompt_hash_verified':False})
    traces.sort(key=lambda t:t['call'])
    if pending and not usage:
        ledger=baseline.CallBudget();ledger.attempts=traces
        usage=ledger.summary()|{'trace_complete':False}
    return traces,usage,failure

def main(args):
    os.umask(0o077);root=args.evidence_root.resolve();root.mkdir(parents=True,exist_ok=True)
    if not 1<=args.trials<=3 or not 1<=len(args.model)<=2 or len(set(args.model))!=len(args.model):raise ValueError('Bounded batch requires 1-3 trials, 1-2 distinct models')
    package=root/'candidate.zip'
    if hashlib.sha256(args.candidate.read_bytes()).hexdigest()!=args.expected_sha256:raise ValueError('Candidate ZIP hash mismatch')
    if package.exists() and package.read_bytes()!=args.candidate.read_bytes():raise ValueError('Cannot replace campaign package')
    if not package.exists():shutil.copy2(args.candidate,package)
    extracted=root/'candidate-package';package_files=extract_candidate(package,args.expected_sha256,extracted)
    tasks={p.name:json.loads((p/'detail.json').read_text())['total_tests'] for p in sorted((root/'inputs').iterdir()) if p.is_dir()}
    if not 1<=len(tasks)<=2:raise ValueError('Batch limited to 1-2 task folders')
    schedule=[]
    for trial in range(1,args.trials+1):
        for task in (list(tasks) if trial%2 else list(reversed(tasks))):
            for model in (args.model if trial%2 else list(reversed(args.model))):schedule.append({'task':task,'trial':trial,'model':model,'expected_tests':tasks[task]})
    code_hash=lambda:{n:hashlib.sha256((WORK/n).read_bytes()).hexdigest() for n in CODE}
    manifest={'mode':'batch_first_no_sample_repairs','schedule':schedule,'candidate_sha256':args.expected_sha256,'package_files_sha256':package_files,
              'image':IMAGE,'request_cap_per_sample':3,'sample_deadline_seconds':DEADLINE,'max_generation_concurrency':2,'evaluation_concurrency':1,
              'repair_calls':0,'feedback_to_generator':False,'code_sha256':code_hash(),'inputs_sha256':hashes(root/'inputs'),'tests_sha256':hashes(root/'evaluation-specs'),
              'interaction_checks':args.interaction_checks,'interaction_specs_sha256':hashes(root/'interaction-specs') if args.interaction_checks else {}}
    if (root/'campaign.json').exists():
        if json.loads((root/'campaign.json').read_text())!=manifest:raise ValueError('Frozen campaign identity changed')
    else:
        save(root/'campaign.json',manifest)
        for n in CODE:
            p=root/'code-snapshot'/n;p.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(WORK/n,p)
    def gate():
        assert hashes(extracted)==package_files and code_hash()==manifest['code_sha256'],'Candidate/runner changed'
        assert hashes(root/'inputs')==manifest['inputs_sha256'] and hashes(root/'evaluation-specs')==manifest['tests_sha256'],'Inputs/tests changed'
        if args.interaction_checks:assert hashes(root/'interaction-specs')==manifest['interaction_specs_sha256'],'Interaction checks changed'
    config={};envfile=Path.home()/'.config/arcbench/volo.env'
    for line in envfile.read_text().splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            name,value=line.removeprefix('export ').split('=',1);values=shlex.split(value)
            if len(values)==1:config[name.strip()]=values[0]
    key=config['ARC_BENCH_API_KEY'];secrets=[v for k,v in config.items() if any(s in k.upper() for s in ('KEY','TOKEN','COOKIE','SECRET','PASSWORD'))]
    cli=['arcbench','--env-file',str(envfile),'--json','--log-file',str(root/'cli-requests.jsonl')]
    def api(*command):return read_json(cli,list(command),root/'cli-preflight.jsonl',secrets=secrets)
    def settled():
        for _ in range(6):
            b=api('balance')
            if b.get('pending_billing_events')==0:return b
            time.sleep(2)
        raise RuntimeError('Billing freshness not confirmed')
    def idle():
        runs=api('runs','--limit','200')
        if not isinstance(runs,list) or any(r['status'] not in ('PASSED','FAILED','CANCELLED') and r.get('run_id') not in ('c5608657cdd0','a6d5b8635598') for r in runs):raise RuntimeError('Active/unfamiliar official run')
    def folder(r):return root/'samples'/f"{r['task']}--{r['model']}--{r['trial']}"
    def generate(spec):
        path=folder(spec);path.mkdir(parents=True,exist_ok=True)
        if (path/'generation.json').exists():return json.loads((path/'generation.json').read_text())
        if (path/'invocation.json').exists():raise RuntimeError('Interrupted sample requires inspection, never replacement')
        gate();argv=[str(PYTHON),'-B',str(extracted/'main.py'),str(root/'inputs'/spec['task']),'--output-dir',str(path/'A0'),'--type','web']
        env={'PATH':os.environ['PATH'],'HOME':str(Path.home()),'OPENAI_API_KEY':key,'OPENAI_BASE_URL':baseline.DEFAULT_BASE,'MODEL':spec['model'],'PYTHONDONTWRITEBYTECODE':'1','PYTHONUNBUFFERED':'1'}
        started=time.monotonic();save(path/'invocation.json',spec|{'argv':argv,'candidate_sha256':args.expected_sha256,'started_at':time.time()});event(event='generation_started',**spec);timed_out=False
        with (path/'generation.stdout.log').open('w') as out,(path/'generation.stderr.log').open('w') as err:
            p=subprocess.Popen(argv,cwd=path,env=env,stdout=out,stderr=err)
            try:p.wait(timeout=DEADLINE)
            except subprocess.TimeoutExpired:p.kill();p.wait();timed_out=True
            except BaseException:
                p.terminate()
                try:p.wait(timeout=3)
                except subprocess.TimeoutExpired:p.kill();p.wait()
                raise
        traces,usage,failure=read_trace(path/'generation.stderr.log')
        row=spec|{'candidate_sha256':args.expected_sha256,'exit_code':p.returncode,'timeout':timed_out,'generation_seconds':round(time.monotonic()-started,3),
                  'delivered':p.returncode==0 and (path/'A0').is_dir(),'requests':traces,'usage':usage,'error':failure,'repair_calls':0}
        if (path/'A0').is_dir():save(path/'A0-sha256.json',hashes(path/'A0'))
        save(path/'generation.json',row);event(event='generation_finished',**{k:row[k] for k in ('task','model','trial','delivered','generation_seconds')});return row
    with (REPO/'runs/.oneshot-local-generation.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB);idle();models=api('models')
        if not set(args.model)<={m['id'] for m in models if m.get('available')}:raise RuntimeError('Selected model unavailable; no substitution')
        save(root/'models.json',models)
        if not (root/'balance-before.json').exists():save(root/'balance-before.json',settled());save(root/'requests-before.json',api('requests','--limit','100'))
        rows=[]
        with ThreadPoolExecutor(max_workers=2) as pool:
            for offset in range(0,len(schedule),2):
                idle();gate();pair=list(pool.map(generate,schedule[offset:offset+2]));rows.extend(pair);save(root/'generations.json',rows)
                settled();save(root/'requests-after.json',api('requests','--limit','100'))
                if any(r['timeout'] for r in pair):raise RuntimeError('Deadline exceeded; retain sample and stop new calls')
        event(event='all_generation_completed',samples=len(rows))
        generation_balance_path=root/'generation-balance-after.json'
        if not generation_balance_path.exists():save(generation_balance_path,settled())
        generation_balance=json.loads(generation_balance_path.read_text())
        before_ids={r['request_id'] for r in json.loads((root/'requests-before.json').read_text())};billed=[r for r in api('requests','--limit','100') if r['request_id'] not in before_ids]
        save(root/'billing-requests.json',billed);used=set()
        for row in rows:
            matched=[]
            for t in row['requests']:
                usage=t.get('usage') or {};matches=[r for r in billed if r['request_id'] not in used and r['model']==t['model'] and r['metrics'].get('input_tokens')==usage.get('prompt_tokens') and r['metrics'].get('output_tokens')==usage.get('completion_tokens')]
                if len(matches)==1:matched.append(matches[0]);used.add(matches[0]['request_id'])
            row['billing']=matched;row['observed_cost_cny']=str(sum((Decimal(r['metrics']['amount']) for r in matched),Decimal(0))) if matched and len(matched)==len(row['requests']) else None
            save(folder(row)/'generation.json',row)
        save(root/'generations.json',rows);results=[]
        if args.interaction_checks:
            # Observe all generated entry paths before any original-suite scoring.
            for row in rows:
                gate();path=folder(row);destination=path/'interaction-checks'
                if not row['delivered'] or (destination/'result.json').exists():continue
                event(event='interaction_check_started',task=row['task'],trial=row['trial'])
                observed=evaluate(path/'A0',root/'interaction-specs'/row['task'],destination,IMAGE,2)
                event(event='interaction_check_finished',task=row['task'],trial=row['trial'],status=observed['status'],passed=observed['passed'],expected=2)
        for row in rows:
            gate();path=folder(row);result=dict(row)
            if (path/'result.json').exists():results.append(json.loads((path/'result.json').read_text()));continue
            if row['delivered']:
                observed=DockerRuntime(IMAGE).check(path/'A0');save(path/'runtime.json',observed)
                event(event='scoring_started',task=row['task'],model=row['model'],trial=row['trial'],runtime_status=observed['status'])
                scored=evaluate(path/'A0',root/'evaluation-specs'/row['task'],path/'evaluation',IMAGE,row['expected_tests'])
                result.update(runtime_status=observed['status'],score_status=scored['status'],passed=scored['passed'],failed=scored['failed'],cases=scored.get('cases',[]),evaluation_seconds=scored.get('elapsed_seconds'),cleanup_verified=observed['cleanup_verified'] and scored.get('cleanup_verified',False))
                assert hashes(path/'A0')==json.loads((path/'A0-sha256.json').read_text())
            else:result.update(runtime_status='not_run',score_status='generation_failed',passed=0,failed=0,cases=[],cleanup_verified=True)
            if args.interaction_checks:
                checked=path/'interaction-checks/result.json'
                details=json.loads(checked.read_text()) if checked.exists() else {}
                result.update(interaction_status=details.get('status','not_run'),interaction_passed=details.get('passed',0))
                result['cleanup_verified']=result['cleanup_verified'] and details.get('cleanup_verified',not row['delivered'])
            save(path/'result.json',result);results.append(result);save(root/'results.json',results);event(event='sample_scored',**{k:result[k] for k in ('task','model','trial','passed','expected_tests','score_status')})
        gate();after=settled();save(root/'balance-after.json',after);before=json.loads((root/'balance-before.json').read_text())
        summary={'mode':manifest['mode'],'candidate_sha256':args.expected_sha256,'samples':len(results),'delivered':sum(r['delivered'] for r in results),'repair_calls':0,'official_runs':0,
                 'generation_calls':sum(r.get('usage',{}).get('calls',0) for r in results),'observed_balance_delta_cny':str(Decimal(before['available_balance'])-Decimal(after['available_balance'])),
                 'billed_request_total_cny':str(sum((Decimal(r['metrics']['amount']) for r in billed),Decimal(0))),
                 'net_balance_change_after_generation_cny':str(Decimal(after['available_balance'])-Decimal(generation_balance['available_balance'])),
                 'billed_matched_cost_cny':str(sum((Decimal(r['metrics']['amount']) for r in billed if r['request_id'] in used),Decimal(0))),
                 'all_requests_attributed':len(used)==sum(len(r['requests']) for r in rows),'source_and_inputs_unchanged':True,'rows':results}
        save(root/'summary.json',summary);event(event='batch_completed',samples=len(results),billed_request_total_cny=summary['billed_request_total_cny'],observed_balance_delta_cny=summary['observed_balance_delta_cny'])

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('evidence_root',type=Path);p.add_argument('--candidate',required=True,type=Path);p.add_argument('--expected-sha256',required=True);p.add_argument('--model',required=True,action='append');p.add_argument('--trials',type=int,default=3);p.add_argument('--interaction-checks',action='store_true');main(p.parse_args())
