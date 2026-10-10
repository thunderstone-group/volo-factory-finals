"""One seed-only repair from an autonomously discovered public startup-contract violation."""
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path('~/projects/volo-factory-worktrees/source-owners-20261002')
sys.path.insert(0, str(ROOT))
from oneshot import main as adapter, source_contracts as contracts
from scripts.repair_replay import gateway_key

HERE = Path(__file__).resolve().parent
BEFORE = HERE / 'official-github-r2/application'
OUT = HERE / 'startup-seed-repair-r2'
OUT.mkdir(exist_ok=False)
APP = OUT / 'application'
shutil.copytree(BEFORE, APP, ignore=shutil.ignore_patterns('node_modules', 'dist', '__pycache__'))
requirements = (APP / 'requirements/requirements.yaml').read_text()
audit = json.loads((HERE / 'startup-state-audit-r2/source-contracts.json').read_text())
probes = [p for p in audit['probes'] if p['id'] == 'REQ-6-5#contract-2']
assert len(probes) == 1
before = contracts.execute(APP, probes, requirements)
assert before['results'][0]['status'] == 'fail'
(OUT / 'before.json').write_text(json.dumps(before, ensure_ascii=False, indent=2))
seed_path = 'frontend/public/seed.js'
source = contracts.context_sources(APP)

def seed_data(app):
    script = "const fs=require('fs'),vm=require('vm');const box={};box.window=box;vm.runInNewContext(fs.readFileSync(process.argv[1],'utf8'),box,{timeout:1000});process.stdout.write(JSON.stringify(box.SEED));"
    result = subprocess.run(['node', '-e', script, str(app / seed_path)], capture_output=True,
                            text=True, env=adapter._child_env(), timeout=10, check=True)
    return json.loads(result.stdout)

initial = seed_data(APP)
system = '''Repair the explicitly required initial state of this application using its public requirements,
actual source, and executed startup-coverage counterexample. Do not infer hidden tests or fixture names.
Only edit the actual seed initializer file named below. Preserve all existing records, IDs, values, relationships,
and effective roles. Add separate compatible records for missing required cases instead of changing an existing
success/closed/negative fixture into another case. New references must resolve to actual records, branches and
commits; satisfy the stated actor and resource prerequisites, not merely a blocker string. Preserve the existing
public demo credential for any new demo account. Do not create aliases guessed from an evaluator.
Do not change business code, requirements, tests, routes, or add runtime detection/reset mechanisms.
Return minimal unambiguous EDIT blocks, or one complete FILE block, for the seed initializer only.
EDIT format:
=== EDIT: <seed initializer path> ===
<<<<<<< SEARCH
exact unique current text
=======
replacement
>>>>>>> REPLACE
=== END ==='''
messages = [{'role': 'system', 'content': system}, {'role': 'user', 'content':
    'Seed initializer: ' + seed_path + '\nPublic requirements:\n' + requirements +
    '\nActual application source:\n' + '\n\n'.join('=== ' + name + ' ===\n' + text for name, text in source.items()) +
    '\nExecuted startup claim:\n' + json.dumps({'probe': probes[0], 'result': before['results'][0]}, ensure_ascii=False)}]
key = gateway_key('~/.config/arcbench/volo.env')
budget = adapter.CallBudget(draft_limit=1, repair_limit=0, fail_limit=1)
budget.progress_path = OUT / 'progress.json'
started = time.monotonic()
summary = {}
try:
    reply, _, finish = adapter.stream_completion(messages, 'deepseek-v4-flash-vision-exp', adapter.DEFAULT_BASE,
                                                  key, budget, tries=1, fallback='')
    (OUT / 'response.txt').write_text(reply)
    changes, missing, skipped = adapter.parse_repair(reply, APP)
    if missing or not changes or any(f['path'] != seed_path for f in changes):
        raise ValueError('The reply did not contain a complete seed-only change')
    adapter._write_repair(APP, changes, None)
    updated = seed_data(APP)
    for name, value in initial.items():
        if isinstance(value, list):
            assert isinstance(updated.get(name), list) and updated[name][:len(value)] == value, 'Existing records changed: ' + name
            ids = [x['id'] for x in updated[name] if isinstance(x, dict) and 'id' in x]
            assert len(ids) == len(set(ids)), 'Duplicate record ID in ' + name
        else:
            assert updated.get(name) == value, 'Existing startup state changed: ' + name
    after = contracts.execute(APP, probes, requirements)
    (OUT / 'after.json').write_text(json.dumps(after, ensure_ascii=False, indent=2))
    controls = json.loads((HERE / 'startup-state-control-r2-probes.json').read_text())
    heldout = contracts.execute(APP, controls, requirements)
    (OUT / 'operator-controls-after.json').write_text(json.dumps(heldout, ensure_ascii=False, indent=2))
    summary.update(finish=finish, skipped_hunks=skipped, existing_records_preserved=True,
                   added={name: len(updated[name]) - len(value) for name, value in initial.items() if isinstance(value, list)},
                   results=after['results'], operator_controls=heldout['results'])
except Exception as exc:
    summary['error'] = type(exc).__name__ + ': ' + str(exc)[:900]
finally:
    (OUT / 'trace.json').write_text(json.dumps(budget.attempts, ensure_ascii=False, indent=1).replace(key, '[REDACTED]'))
    summary.update(seconds=round(time.monotonic() - started, 1), usage=budget.summary(),
                   scope='Seed-only controlled repair. Operator controls and independent browser judges were not supplied to the model.')
    (OUT / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    (OUT / 'finished.json').write_text(json.dumps({'exit': 1 if summary.get('error') else 0,
        'error': summary.get('error'), 'seconds': summary['seconds']}, indent=2))
    print(json.dumps(summary, ensure_ascii=False), flush=True)
