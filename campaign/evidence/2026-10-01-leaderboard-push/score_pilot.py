"""Replay fixed requirement-written suites against frozen applications; no model or official scoring calls."""
import collections
import concurrent.futures
import json
import shutil
import sys
from pathlib import Path

ROOT = Path('~/projects/volo-factory-worktrees/behavior-coverage-20261001')
sys.path.insert(0, str(ROOT))
from oneshot import testgen

HERE = Path(__file__).resolve().parent
SOURCE = Path('~/projects/arcbench-campaign/evidence/2026-09-24-hackathon-v2')
APPS = Path('~/projects/arcbench-campaign/acceptance-hidden/oracle-2026-09-27/apps')
CASES = [('sheet', 'cov99n-arm', ['t03-REQ-3.spec.cjs', 't05-REQ-5.spec.cjs'], 'sheet-81-cbe0e2b43105'),
         ('github', 'gh99', ['t02-REQ-2.spec.cjs', 't06-REQ-6.spec.cjs'], 'github-24-65c9a5df6145')]


def run(case, mode):
    task, arm, files, app = case
    out = HERE / f'{mode}-score-{task}'
    out.mkdir(exist_ok=False)
    suite = out / 'suite'
    origin = (SOURCE / 'experiments-2026-09-28/tcost' / arm / 'suite' if mode == 'baseline'
              else HERE / (mode + '-' + task) / 'suite')
    shutil.copytree(origin, suite)
    manifest = json.loads((suite / 'suite.json').read_text())
    manifest['files'] = [r for r in manifest['files'] if r['file'] in files]
    manifest['scenarios'] = sum(len(r['scenarios']) for r in manifest['files'])
    for path in suite.glob('*.cjs'):
        if path.name not in files:
            path.unlink()
    (suite / 'suite.json').write_text(json.dumps(manifest))
    text = (SOURCE / 'requirements' / ('hackathon--' + task) / 'requirements.yaml').read_text()
    report = testgen.run_suite(APPS / app / 'template', suite, text)
    (out / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    entries = report.get('scenarios', [])
    summary = {'task': task, 'app': app, 'mode': mode, 'seconds': report.get('seconds'),
               'counts': dict(collections.Counter(r['status'] for r in entries)),
               'added_counts': dict(collections.Counter(r['status'] for r in entries if '#audit-' in r['id'])),
               'added_findings': [r for r in entries if '#audit-' in r['id']]}
    (out / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    print(json.dumps({k: v for k, v in summary.items() if k != 'added_findings'}), flush=True)


if __name__ == '__main__':
    mode = sys.argv[1]
    assert mode in ('baseline', 'audit', 'audit-v2')
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        for job in [pool.submit(run, case, mode) for case in CASES]:
            job.result()
