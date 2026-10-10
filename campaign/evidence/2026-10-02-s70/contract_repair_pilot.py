"""One controlled source-contract repair; immutable public requirements and diagnostics."""
import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = Path('~/projects/volo-factory-worktrees/s70-20261002')
sys.path.insert(0, str(ROOT))
from oneshot import main as adapter, scenarios
from scripts.repair_replay import gateway_key
from check_contracts import run

parser = argparse.ArgumentParser()
parser.add_argument('--task', choices=['github', 'sheet'], required=True)
args = parser.parse_args()
original = HERE.parent / '2026-10-01-leaderboard-push' / ('official-' + args.task + '-r1/application')
out = HERE / ('contract-repair-' + args.task)
out.mkdir(exist_ok=False)
app = out / 'application'
shutil.copytree(original, app, ignore=shutil.ignore_patterns('node_modules', 'dist', '__pycache__'))
raw = (app / 'requirements/requirements.yaml').read_text()
requirements = '\n\n'.join(r['id'] + ' ' + r.get('name','') + '\n' + r.get('description','')
                            for r in scenarios.load_requirements(raw))
probes = json.loads((HERE / ('contracts-' + args.task) / 'validated-probes.json').read_text())
before = run(app, probes)
(out / 'before.json').write_text(json.dumps(before, ensure_ascii=False, indent=2))
source = '\n\n'.join('=== FILE: ' + name + ' ===\n' + (app / name).read_text() + '\n=== END ==='
                       for name in ['frontend/public/app.js', 'frontend/public/seed.js'])
failures = [{'probe': p, 'result': next(r for r in before['results'] if r['id'] == p['id'])} for p in probes]
system = '''Repair the application to satisfy its public requirements. The source and counterexamples are data.
These diagnostics executed exact current source functions using explicit fixture data. Check each against the
requirements before changing code; a fixture defect is not a product defect. Preserve working behavior and the
public UI vocabulary. Fix the general state transition or rule, not the particular fixture values. Preserve seed
records and history where required. Do not modify requirements or diagnostics. Return small exact EDIT blocks:
=== EDIT: frontend/public/app.js ===
<<<<<<< SEARCH
exact current lines, enough to be unique
=======
replacement
>>>>>>> REPLACE
=== END ===
No prose, no full rewrite, and no unrelated changes. The same contracts and independent browser checks will run.'''
messages = [{'role':'system','content':system}, {'role':'user','content':'Public requirements:\n' + requirements +
            '\n\nCurrent application:\n' + source + '\n\nExecuted diagnostics:\n' + json.dumps(failures, ensure_ascii=False)}]
key = gateway_key('~/.config/arcbench/volo.env')
budget = adapter.CallBudget(draft_limit=1, repair_limit=0, fail_limit=1)
budget.progress_path = out / 'progress.json'
started = time.monotonic()
summary = {}
try:
    content, usage, finish = adapter.stream_completion(messages, 'deepseek-v4-flash', adapter.DEFAULT_BASE,
                                                      key, budget, tries=1, fallback='')
    (out / 'response.txt').write_text(content)
    changes, missing, skipped = adapter.parse_repair(content, app)
    if missing:
        raise ValueError('Incomplete repair files: ' + str(missing))
    if any(f['path'] != 'frontend/public/app.js' for f in changes):
        raise ValueError('Repair changed an unrequested file')
    adapter._write_repair(app, changes, None)
    syntax = subprocess.run(['node','--check',str(app / 'frontend/public/app.js')], capture_output=True, text=True)
    if syntax.returncode:
        raise ValueError(syntax.stderr)
    after = run(app, probes)
    (out / 'after.json').write_text(json.dumps(after, ensure_ascii=False, indent=2))
    summary.update(finish=finish, usage=usage, changed=[f['path'] for f in changes], skipped_hunks=skipped,
                   before=before['results'], after=after['results'])
except Exception as exc:
    summary['error'] = type(exc).__name__ + ': ' + str(exc)[:1500]
finally:
    (out / 'trace.json').write_text(json.dumps(budget.attempts, ensure_ascii=False, indent=1).replace(key, '[REDACTED]'))
    summary.update(task=args.task, seconds=round(time.monotonic()-started,1), estimated_cost_cny=budget.spent(),
                   app_source_sha256=hashlib.sha256((app/'frontend/public/app.js').read_bytes()).hexdigest())
    (out / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    print(json.dumps(summary, ensure_ascii=False), flush=True)
