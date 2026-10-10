"""Controlled navigation repair from public initial-screen contracts; one model call."""
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
OUT = HERE / 'home-entry-repair-github'
OUT.mkdir(exist_ok=False)
APP = OUT / 'application'
shutil.copytree(HERE / 'official-github-refreshed/application', APP,
                ignore=shutil.ignore_patterns('node_modules', 'dist', 'requirements'))
req = (HERE / 'requirements-after-stage-announcement/hackathon--github/requirements.yaml').read_text()
source = as_blocks(source_files(APP, {}))
system = '''Repair only the application's initial-screen navigation so it faithfully implements the public
requirements. A scenario's first WHEN action must be available from its stated GIVEN screen and session.
Several scenarios explicitly start at the application home page in a fresh unauthenticated session and open
a named public repository capability or a visible saved work-item entry. Requiring unstated predecessor
navigation changes that contract. A runtime observation confirms those attempts begin at pathname /,
empty hash, no session and no prior link clicks. The existing app has real records and detail views, but
its home only exposes repository and organization links.

Create a coherent, useful, permission-aware workspace overview with actual navigation to the capabilities
and records required to be visible from that start context. Use the application's real runtime collections,
permission predicates and canonical record URLs. Keep unique capability navigation, meaningful repository
context and the current real title/status of each listed item. Do not copy literal task record names into
rendering code, fabricate records or mirror static expected messages. Existing and future records should
follow the same behavior. Preserve existing repository/organization discovery and authentication entries.

Do not change seed data, authorization rules, login/logout behavior, business mutation handlers or internal
record schemas. Do not auto-login anyone, grant permissions, add test detection, or detect task/scenario IDs.
Leave all existing detail views and their genuine actions intact. Add only the necessary overview/list views
and navigation, reusing the actual helpers. Avoid unrelated UI or business rewrites.

Return minimal exact EDIT blocks for frontend/public/app.js only:
=== EDIT: frontend/public/app.js ===
<<<<<<< SEARCH
unique exact old text
=======
replacement
>>>>>>> REPLACE
=== END ===
'''
messages = [{'role': 'system', 'content': system}, {'role': 'user', 'content':
    'Complete current public requirements:\n' + req + '\nActual application source:\n' + source}]
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
    if missing or not changes or any(f['path'] != 'frontend/public/app.js' for f in changes):
        raise ValueError('Incomplete or out-of-scope repair')
    adapter._write_repair(APP, changes, None)
    subprocess.run(['node', '--check', str(APP / 'frontend/public/app.js')], check=True,
                   capture_output=True, text=True)
    record.update(finish_reason=finish, changed=[f['path'] for f in changes], skipped_hunks=skipped,
                  syntax_checks='passed')
except Exception as exc:
    record['error'] = type(exc).__name__ + ': ' + str(exc)[:600]
finally:
    record.update(seconds=round(time.monotonic() - started, 1), usage=budget.summary(),
        scope='Controlled initial-screen navigation repair from public requirements. '
              'Must verify unchanged permissions/business behavior and organizer feedback before adoption.')
    (OUT / 'trace.json').write_text(json.dumps(budget.attempts, ensure_ascii=False, indent=1).replace(key, '[REDACTED]'))
    (OUT / 'summary.json').write_text(json.dumps(record, ensure_ascii=False, indent=2))
    (OUT / 'finished.json').write_text(json.dumps({'exit': 1 if record.get('error') else 0, 'seconds': record['seconds']}))
    print(json.dumps(record, ensure_ascii=False), flush=True)
