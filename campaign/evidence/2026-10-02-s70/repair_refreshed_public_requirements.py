"""One bounded repair using current public requirements and organizer feedback."""
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path('~/projects/volo-factory-worktrees/source-owners-20261002')
sys.path.insert(0, str(ROOT))
from oneshot import main as adapter
from scripts.repair_replay import gateway_key, source_files, as_blocks

HERE = Path(__file__).resolve().parent
OUT = HERE / 'refreshed-public-repair-github'
OUT.mkdir(exist_ok=False)
APP = OUT / 'application'
shutil.copytree(HERE / 'official-github-r2/application', APP,
                ignore=shutil.ignore_patterns('node_modules', 'dist', 'requirements'))
req = (HERE / 'requirements-after-stage-announcement/hackathon--github/requirements.yaml').read_text()
feedback = json.loads((HERE / 'selftest-r2-github/result.json').read_text())['submission']['result']
failures = [{'title': t['title'], 'error': t['error']} for t in feedback['tests'] if not t['ok']]
files = source_files(APP, {})
system = '''Update the supplied existing application to the CURRENT PUBLIC REQUIREMENTS below. The previous
application was built against an older requirement revision. The organizer's returned Stage 1 error messages
are diagnostic observations, not a replacement for the public specification. This repair still serves the
COMPLETE application, including all modules outside that stage.

Prioritize missing required startup accounts, object relationships and effective roles across the complete
public requirements. Distinguish pre-provisioned GIVEN state from values users create later in WHEN steps;
do not pre-create records explicitly absent or meant to be created interactively. Reuse the application's
actual state schema and permission functions. Preserve existing records and their behavior while adding the
new required starting state. Do not guess hidden identities, endpoints or tests.

Also correct UI behavior directly contradicted by public requirements and feedback: required visible values
should have one clear presentation rather than redundant copies in explanatory hints, and authentication
transitions must leave the specified visible navigation available. Preserve exact publicly named controls and
unrelated behavior. Do not add test detection, fixture reset endpoints, fake success messages or test-specific
branches. Do not change shared ARC helpers or backend mechanics.

Return minimal exact EDIT blocks for frontend/public/seed.js or frontend/public/app.js:
=== EDIT: path ===
<<<<<<< SEARCH
unique exact old text
=======
replacement
>>>>>>> REPLACE
=== END ===
A complete === FILE: path === ... === END === block is allowed for a small seed initializer.
'''
messages = [{'role': 'system', 'content': system}, {'role': 'user', 'content':
    'Current COMPLETE public requirements:\n' + req + '\nExisting actual source:\n' + as_blocks(files) +
    '\nOrganizer feedback for a subset of this specification:\n' + json.dumps(failures, ensure_ascii=False)}]
key = gateway_key('~/.config/arcbench/volo.env')
budget = adapter.CallBudget(draft_limit=1, repair_limit=0, fail_limit=1)
budget.progress_path = OUT / 'progress.json'
started = time.monotonic()
record = {}
try:
    reply, _, finish = adapter.stream_completion(messages, 'deepseek-v4-flash-vision-exp',
        adapter.DEFAULT_BASE, key, budget, tries=1, fallback='')
    (OUT / 'response.txt').write_text(reply)
    changes, missing, skipped = adapter.parse_repair(reply, APP)
    if missing or skipped or not changes or any(f['path'] not in {
            'frontend/public/seed.js', 'frontend/public/app.js'} for f in changes):
        raise ValueError('Incomplete or out-of-scope repair')
    adapter._write_repair(APP, changes, None)
    for f in changes:
        subprocess.run(['node', '--check', str(APP / f['path'])], check=True, capture_output=True, text=True)
    record.update(finish_reason=finish, changed=[f['path'] for f in changes], syntax_checks='passed')
except Exception as exc:
    record['error'] = type(exc).__name__ + ': ' + str(exc)[:600]
finally:
    record.update(seconds=round(time.monotonic() - started, 1), usage=budget.summary(),
        scope='Controlled app repair from new complete public requirements and organizer feedback; '
              'not an official agent submission or proof of generalization.')
    (OUT / 'trace.json').write_text(json.dumps(budget.attempts, ensure_ascii=False, indent=1).replace(key, '[REDACTED]'))
    (OUT / 'summary.json').write_text(json.dumps(record, ensure_ascii=False, indent=2))
    (OUT / 'finished.json').write_text(json.dumps({'exit': 1 if record.get('error') else 0, 'seconds': record['seconds']}))
    print(json.dumps(record, ensure_ascii=False), flush=True)
