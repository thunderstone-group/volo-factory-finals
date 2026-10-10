"""Run the already-versioned, public-contract-corrected judges on the fresh candidate when it finishes."""
import collections
import concurrent.futures
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parent/'2026-10-01-leaderboard-push/frozen-judge-harness'))
from oneshot import testgen

run=HERE/'dependency-build-checked-github'
while not (run/'finished.json').exists():
    time.sleep(20)
finished=json.loads((run/'finished.json').read_text())
if finished.get('error'):
    raise SystemExit('Controlled repair failed; no scores fabricated.')
with (run/'judge.log').open('w') as log:
    verdict=subprocess.run(['~/projects/volo-factory/.venv/bin/python',str(HERE/'judge_contract_repair.py'),
                            '--task','github','--name',run.name],stdout=log,stderr=subprocess.STDOUT)
if verdict.returncode:
    raise SystemExit('Original independent judge process failed; inspect judge.log.')
req=(HERE.parent/'2026-09-24-hackathon-v2/requirements/hackathon--github/requirements.yaml').read_text()

def one(judge):
    out=HERE/'click-contract-calibration'/('dependency-build-checked-github-'+judge)
    out.mkdir(exist_ok=False)
    shutil.copytree(HERE/'click-contract-calibration'/judge,out/'suite')
    report=testgen.run_suite(run/'application',out/'suite',req)
    (out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    summary={'application':'dependency-build-checked-github','judge':judge,
             'counts':dict(collections.Counter(s['status'] for s in report['scenarios'])),
             'seconds':report.get('seconds')}
    (out/'summary.json').write_text(json.dumps(summary,indent=2))
    print(json.dumps(summary),flush=True)
    return summary

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    results=list(pool.map(one,['gh99','gh8']))
(run/'calibrated-validation.json').write_text(json.dumps(results,indent=2))
