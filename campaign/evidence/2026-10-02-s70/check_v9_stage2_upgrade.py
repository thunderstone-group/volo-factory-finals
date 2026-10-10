"""Wait for the real stage upgrade, then check old functionality and new scope separately."""
import concurrent.futures
import hashlib
import json
import re
import shutil
import sys
import time
from pathlib import Path
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE/'v8-frozen-verifier'))
from oneshot import testgen

root=HERE/'v9-stage2-upgrade';deadline=time.monotonic()+6*3600
while not (root/'finished.json').exists():
    if time.monotonic()>deadline:raise RuntimeError('Observation timeout; retain the generation process')
    time.sleep(20)
result=json.loads((root/'finished.json').read_text())
if result['exit']:raise RuntimeError('Upgrade did not finish cleanly; inspect its existing trace')

before=HERE/'v7-stage2-template/requirements';after=root/'application/requirements'
hashes=lambda p:{str(f.relative_to(p)):hashlib.sha256(f.read_bytes()).hexdigest() for f in p.rglob('*') if f.is_file()}
assert hashes(before)==hashes(after),'Preserved task inputs changed'
(root/'preserved-inputs.json').write_text(json.dumps({'files':len(hashes(before)),'identical':True},indent=2))

def run(label,app,pattern):
    out=root/label;out.mkdir(exist_ok=False);suite=out/'suite'
    shutil.copytree(HERE/'v6-frozen-suite-github',suite)
    manifest=json.loads((suite/'suite.json').read_text())
    ids={testgen._test_id(t)[0] for f in manifest['files'] for t in f.get('tests',[]) if re.match(pattern,testgen._test_id(t)[0])}
    report=testgen.run_suite(app,suite,(HERE/'v7-official-github-input.yaml').read_text(),only=ids)
    (out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    statuses={s['id']:s['status'] for s in report.get('scenarios',[]) if not s['id'].startswith('helper:')}
    summary={'label':label,'passed':sum(v=='pass' for v in statuses.values()),'total':len(statuses),'statuses':statuses,'model_calls':0}
    (out/'summary.json').write_text(json.dumps(summary,indent=2));print(label,summary['passed'],summary['total'],flush=True)
    return summary
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    baseline=pool.submit(run,'stage1-before',HERE/'v7-official-stage1-25/application',r'^REQ-[12](?:-|#|$)')
    upgraded=pool.submit(run,'stage1-after',root/'application',r'^REQ-[12](?:-|#|$)')
    a,b=baseline.result(),upgraded.result()
lost=[i for i,s in a['statuses'].items() if s=='pass' and b['statuses'].get(i)!='pass']
(root/'stage1-preservation.json').write_text(json.dumps({'before':a['passed'],'after':b['passed'],'lost':lost},indent=2))
print('previous stage lost',lost,flush=True)
run('stage2-independent',root/'application',r'^REQ-[34](?:-|#|$)')
