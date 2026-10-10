"""Bounded practice-key experiment; generated additions use public requirements and existing self-tests only."""
import concurrent.futures
import json
import shutil
import sys
import time
from pathlib import Path

ROOT = Path('~/projects/volo-factory-worktrees/behavior-coverage-20261001')
sys.path.insert(0, str(ROOT))
from oneshot import main as adapter, testgen
from scripts.repair_replay import gateway_key

HERE = Path(__file__).resolve().parent
SOURCE = Path('~/projects/arcbench-campaign/evidence/2026-09-24-hackathon-v2')


def run(task, arm, files):
    out = HERE / ('audit-' + task)
    out.mkdir(exist_ok=False)
    suite = out / 'suite'
    shutil.copytree(SOURCE / 'experiments-2026-09-28/tcost' / arm / 'suite', suite)
    manifest = json.loads((suite / 'suite.json').read_text())
    manifest['files'] = [r for r in manifest['files'] if r['file'] in files]
    manifest['scenarios'] = sum(len(r['scenarios']) for r in manifest['files'])
    for path in suite.glob('*.cjs'):
        if path.name not in files:
            path.unlink()
    (suite / 'suite.json').write_text(json.dumps(manifest))
    requirements = (SOURCE / 'requirements' / ('hackathon--' + task) / 'requirements.yaml').read_text()
    key = gateway_key('~/.config/arcbench/volo.env')
    budgets = []

    def complete(messages):
        budget = adapter.CallBudget(draft_limit=1, repair_limit=0, fail_limit=2)
        budgets.append(budget)
        return adapter.stream_completion(messages, adapter.DEFAULT_MODEL, adapter.DEFAULT_BASE, key, budget,
                                         tries=1, fallback='')

    started = time.monotonic()
    result = testgen.audit_suite(requirements, suite, complete, workers=1)
    for index, budget in enumerate(budgets):
        with (out / f'trace-{index}.json').open('w') as handle:
            handle.write(json.dumps(budget.attempts, ensure_ascii=False, indent=1).replace(key, '[REDACTED]'))
    summary = {'task': task, 'seconds': round(time.monotonic() - started, 1),
               'estimated_cost_cny': sum(b.spent() for b in budgets),
               'audit_checks': result.get('audit_checks'),
               'files': [{'file': r['file'], 'audit': r.get('audit')} for r in result['files']]}
    (out / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    print(json.dumps(summary, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        jobs = [pool.submit(run, 'sheet', 'cov99n-arm', ['t03-REQ-3.spec.cjs', 't05-REQ-5.spec.cjs']),
                pool.submit(run, 'github', 'gh99', ['t02-REQ-2.spec.cjs', 't06-REQ-6.spec.cjs'])]
        for job in jobs:
            job.result()
