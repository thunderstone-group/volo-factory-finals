"""Replay frozen public-requirement diagnostics; no model calls or official tests."""
import collections
import concurrent.futures
import json
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, '~/projects/volo-factory')
from oneshot import testgen

app = HERE / 'v7-sheet-filter-control/application'
requirements = (HERE / 'v7-official-sheet-input.yaml').read_text()

def run(judge):
    out = app.parent / (judge + '-check')
    out.mkdir(exist_ok=False)
    suite = out / 'suite'
    shutil.copytree(HERE / 'native-selected-old-sheet' / (judge + '-check') / 'suite', suite)
    report = testgen.run_suite(app, suite, requirements)
    (out / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    summary = {'counts': dict(collections.Counter(s['status'] for s in report.get('scenarios', []))),
               'seconds': report.get('seconds'), 'unavailable': report.get('unavailable'), 'model_calls': 0}
    (out / 'summary.json').write_text(json.dumps(summary, indent=2))
    print(judge, json.dumps(summary), flush=True)

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    for f in [pool.submit(run, name) for name in ['g99', 'cov99n-arm']]:
        f.result()
