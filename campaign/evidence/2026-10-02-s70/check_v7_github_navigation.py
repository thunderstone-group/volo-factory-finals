"""Compare two own apps with the same frozen requirement-written suite."""
import collections
import concurrent.futures
import json
import shutil
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, '~/projects/volo-factory')
from oneshot import testgen

def run(name):
    out = HERE / name / 'fixed-check'
    out.mkdir(exist_ok=False)
    shutil.copytree(HERE / 'v6-frozen-suite-github', out / 'suite')
    report = testgen.run_suite(HERE / name / 'application', out / 'suite',
                              (HERE/'v7-official-github-input.yaml').read_text())
    (out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    summary={'counts':dict(collections.Counter(s['status'] for s in report.get('scenarios',[]))),
             'seconds':report.get('seconds'),'unavailable':report.get('unavailable'),'model_calls':0}
    (out/'summary.json').write_text(json.dumps(summary,indent=2));print(name,json.dumps(summary),flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    for future in [pool.submit(run,name) for name in ['v7-official-github-76','v7-github-navigation-control']]:
        future.result()
