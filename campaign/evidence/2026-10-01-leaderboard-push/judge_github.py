"""Score GitHub apps with fixed public-requirement judges; no model calls."""
import collections
import concurrent.futures
import json
import shutil
import sys
from pathlib import Path

sys.path.insert(0, '~/projects/arcbench-campaign/evidence/2026-10-01-leaderboard-push/frozen-judge-harness')
from oneshot import testgen

HERE = Path(__file__).resolve().parent
SRC = Path('~/projects/arcbench-campaign/evidence/2026-09-24-hackathon-v2')
REQ = (SRC / 'requirements/hackathon--github/requirements.yaml').read_text()
NAME = sys.argv[1] if len(sys.argv) > 1 else 'baseline-github-24'
APP = (Path('~/projects/arcbench-campaign/acceptance-hidden/oracle-2026-09-27/apps/github-24-65c9a5df6145/template')
       if NAME == 'baseline-github-24' else HERE / NAME / 'application')

def one(judge):
    if not APP.is_dir():
        raise FileNotFoundError(APP)
    out = HERE / 'judges' / (NAME + '-' + judge)
    out.mkdir(parents=True, exist_ok=False)
    suite = out / 'suite'
    shutil.copytree(SRC / 'experiments-2026-09-28/tcost' / judge / 'suite', suite)
    report = testgen.run_suite(APP, suite, REQ)
    (out / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    result = {'app': NAME, 'judge': judge,
              'counts': dict(collections.Counter(x['status'] for x in report.get('scenarios', []))),
              'seconds': report.get('seconds'), 'coverage': report.get('coverage')}
    (out / 'summary.json').write_text(json.dumps(result, indent=2))
    print(json.dumps(result), flush=True)

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    for future in [pool.submit(one, judge) for judge in ['gh99', 'gh8']]:
        future.result()
