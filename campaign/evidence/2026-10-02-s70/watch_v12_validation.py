"""After fresh generation, run immutable public-requirement diagnostics. Never uploads."""
import collections
import concurrent.futures
import json
import shutil
import sys
import time
from pathlib import Path

HERE=Path(__file__).resolve().parent
frozen=HERE/'v12-frozen-verifier'
frozen.mkdir(exist_ok=False)
shutil.copytree('~/projects/arcbench-campaign/evidence/2026-10-02-s70/generate-requirement-transactions-v12-github/agent',frozen/'oneshot',
                ignore=shutil.ignore_patterns('__pycache__','dist'))
sys.path.insert(0,str(frozen))
from oneshot import testgen

def check(task,judge,source):
    app=HERE/('generate-requirement-transactions-v12-'+task)/'application'
    out=app.parent/(judge+'-independent');out.mkdir(exist_ok=False)
    shutil.copytree(source,out/'suite')
    requirements=(HERE/('v7-official-'+task+'-input.yaml')).read_text()
    report=testgen.run_suite(app,out/'suite',requirements)
    (out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    summary={'task':task,'judge':judge,'counts':dict(collections.Counter(s['status'] for s in report.get('scenarios',[]))),
             'seconds':report.get('seconds'),'unavailable':report.get('unavailable'),'model_calls':0}
    (out/'summary.json').write_text(json.dumps(summary,indent=2));print(json.dumps(summary),flush=True)

pending={'github','sheet'};submitted=[];deadline=time.monotonic()+12*3600
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    while pending and time.monotonic()<deadline:
        for task in list(pending):
            root=HERE/('generate-requirement-transactions-v12-'+task)
            if not (root/'finished.json').exists():continue
            result=json.loads((root/'finished.json').read_text());pending.remove(task)
            print('generation terminal',json.dumps(result),flush=True)
            if not (root/'application/frontend/public/app.js').is_file():continue
            suites=[('v6-fixed',HERE/'v6-frozen-suite-github')] if task=='github' else [
                (name,HERE/'native-selected-old-sheet'/(name+'-check')/'suite') for name in ['g99','cov99n-arm']]
            for name,suite in suites:submitted.append(pool.submit(check,task,name,suite))
        if pending:time.sleep(30)
    for future in submitted:future.result()
if pending:raise RuntimeError('Observation deadline; retain generation processes and inspect their original metadata')
print('Independent diagnostics complete. Review artifacts before replacing any formal submission.',flush=True)
