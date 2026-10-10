"""Fixed independent requirement-written judges; no generation calls and no changes to candidate source."""
import concurrent.futures
import collections
import json
import shutil
import sys
from pathlib import Path
sys.path.insert(0,'~/projects/arcbench-campaign/evidence/2026-10-01-leaderboard-push/frozen-judge-harness')
from oneshot import testgen

HERE=Path(__file__).resolve().parent
SRC=Path('~/projects/arcbench-campaign/evidence/2026-09-24-hackathon-v2')
REQ=(SRC/'requirements/hackathon--sheet/requirements.yaml').read_text()
APPS={'kimi-sheet-1':HERE/'kimi-sheet-1/application',
      'baseline-sheet-81':Path('~/projects/arcbench-campaign/acceptance-hidden/oracle-2026-09-27/apps/sheet-81-cbe0e2b43105/template')}
if len(sys.argv)>1:
    name=sys.argv[1]
    APPS={name:HERE/name/'application'}

def one(name,app,judge):
    out=HERE/'judges'/(name+'-'+judge)
    out.mkdir(parents=True,exist_ok=False)
    suite=out/'suite'
    shutil.copytree(SRC/'experiments-2026-09-28/tcost'/judge/'suite',suite)
    report=testgen.run_suite(app,suite,REQ)
    (out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    counts=dict(collections.Counter(x['status'] for x in report.get('scenarios',[])))
    result={'app':name,'judge':judge,'counts':counts,'seconds':report.get('seconds'),'coverage':report.get('coverage')}
    (out/'summary.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(result),flush=True)

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    for future in [pool.submit(one,name,app,judge) for name,app in APPS.items() for judge in ['g99','cov99n-arm']]:
        future.result()
