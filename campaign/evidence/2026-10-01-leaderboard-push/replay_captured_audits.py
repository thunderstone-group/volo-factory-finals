"""Recover checks from captured real audit replies; no new model calls or changes to generated apps."""
import collections
import concurrent.futures
import json
import shutil
import sys
from pathlib import Path

sys.path.insert(0, '~/projects/volo-factory-worktrees/behavior-coverage-20261001')
from oneshot import scenarios, testgen

HERE = Path(__file__).resolve().parent
OUT = HERE / 'recovered-sheet-audit'
OUT.mkdir(exist_ok=False)
REQ = Path('~/projects/arcbench-campaign/evidence/2026-09-24-hackathon-v2/requirements/hackathon--sheet/requirements.yaml').read_text()
groups = {g['file']: g for g in testgen.plan(REQ)}
requirements = {r['id']: r for r in scenarios.load_requirements(REQ)}
suite = OUT / 'suite'
suite.mkdir()
records, recovered, validation = [], [], []
for line in (HERE / 'vision-sheet-1/stderr.log').read_text().splitlines():
    if not line.startswith('[oneshot] trace '):
        continue
    trace = json.loads(line[len('[oneshot] trace '):])
    if trace['call'] not in ['tests-11', 'tests-12']:
        continue
    match = testgen.FILE_BLOCK.search(trace['messages'][-2]['content'])
    name, original = match.group(1).strip(), match.group(2)
    addition, claims, rejected = testgen._audit_additions(
        trace['content'], groups[name], requirements, original, shutil.which('node'), suite / name)
    (suite / name).write_text(original + '\n' + addition + '\n')
    titles = [m.group(2) for m in testgen.TITLE.finditer(addition)]
    records.append({'file': name, 'tests': titles})
    recovered += [c['id'] for c in claims]
    validation.append({'file': name, 'accepted': claims, 'rejected': rejected})
(suite / 'suite.json').write_text(json.dumps({'files': records, 'scenarios': 0,
                                             'tests': len(recovered), 'audit_checks': len(recovered)}, indent=2))
(OUT / 'validation.json').write_text(json.dumps(validation, ensure_ascii=False, indent=2))
print(json.dumps({'recovered_checks': len(recovered), 'ids': recovered}), flush=True)

apps = {'vision-sheet-1': HERE / 'vision-sheet-1/application',
        'baseline-sheet-81': Path('~/projects/arcbench-campaign/acceptance-hidden/oracle-2026-09-27/apps/sheet-81-cbe0e2b43105/template')}

def run(name, app):
    target = OUT / name
    target.mkdir()
    shutil.copytree(suite, target / 'suite')
    report = testgen.run_suite(app, target / 'suite', REQ, only=recovered)
    (target / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    summary = {'app': name, 'selected_checks': len(recovered),
               'counts': dict(collections.Counter(x['status'] for x in report.get('scenarios', []))),
               'seconds': report.get('seconds')}
    (target / 'summary.json').write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary), flush=True)

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    for future in [pool.submit(run, name, app) for name, app in apps.items()]:
        future.result()
