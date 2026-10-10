"""Execute only recovered scenarios on frozen apps, with no model calls."""
import collections
import concurrent.futures
import json
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PREVIOUS = HERE.parent / '2026-10-01-leaderboard-push'
sys.path.insert(0, str(PREVIOUS / 'frozen-judge-harness'))
from oneshot import testgen

source = HERE / (sys.argv[1] if len(sys.argv) > 1 else 'recover-github-flash') / 'suite'
manifest = json.loads((source / 'suite.json').read_text())
ids = [c['id'] for record in manifest['files'] for c in record.get('recovery', {}).get('claims', [])]
if not ids:
    raise SystemExit('No validated recovered scenarios to run.')
REQ = Path('~/projects/arcbench-campaign/evidence/2026-09-24-hackathon-v2/requirements/hackathon--github/requirements.yaml').read_text()
apps = {'official-github-27': PREVIOUS / 'official-github-r1/application',
        'local-vision-github': PREVIOUS / 'vision-github-1/application',
        'baseline-github-24': Path('~/projects/arcbench-campaign/acceptance-hidden/oracle-2026-09-27/apps/github-24-65c9a5df6145/template')}

def one(name, app):
    out = source.parent / ('check-' + name)
    out.mkdir(exist_ok=False)
    shutil.copytree(source, out / 'suite')
    report = testgen.run_suite(app, out / 'suite', REQ, only=ids)
    (out / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    summary = {'app': name, 'selected': ids,
               'counts': dict(collections.Counter(x['status'] for x in report.get('scenarios', []))),
               'seconds': report.get('seconds')}
    (out / 'summary.json').write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary), flush=True)

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    for future in [pool.submit(one, name, app) for name, app in apps.items()]:
        future.result()
