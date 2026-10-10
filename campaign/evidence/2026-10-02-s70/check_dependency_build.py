"""Complete the staged prototype's missing full-requirement checking and repair phase.

Uses a fresh requirements-only written suite and normal source review. Independent judges
remain outside model prompts. Foundation, extension, and this phase are all charged.
"""
import hashlib
import json
import os
import shutil
import sys
import time
from pathlib import Path

ROOT = Path('~/projects/volo-factory-worktrees/source-owners-20261002')
sys.path.insert(0, str(ROOT))
from oneshot import main as adapter
from scripts.repair_replay import gateway_key, source_files, as_blocks, SKIP

HERE = Path(__file__).resolve().parent
BEFORE = HERE / 'dependency-build-pilot-github'
OUT = HERE / 'dependency-build-checked-github'
OUT.mkdir(exist_ok=False)
REQS = HERE.parent / '2026-09-24-hackathon-v2/requirements/hackathon--github'
requirements = (REQS / 'requirements.yaml').read_text()
assert hashlib.sha256((REQS / 'requirements.yaml').read_bytes()).hexdigest() == 'bdc17d23265a6b1948aec150e69d0b2accfa37db4c569305c97be7ff7f3b0b8f'
prior = json.loads((BEFORE / 'finished.json').read_text())
assert prior['exit'] == 0 and prior['completed_phases'] == 2
stage = OUT / '.work' / 'app'
for part in ['frontend', 'backend']:
    shutil.copytree(BEFORE / 'application' / part, stage / part, ignore=shutil.ignore_patterns(*SKIP))
key = gateway_key('~/.config/arcbench/volo.env')
os.environ['OPENAI_API_KEY'] = key
os.environ['FALLBACK_MODEL'] = ''
model = 'deepseek-v4-flash-vision-exp'
budget = adapter.CallBudget(repair_limit=8, repair_cny=2.5, fail_limit=3)
budget.phase = 'repair'
budget.progress_path = OUT / 'progress.json'
scaffold = adapter.read_template(adapter.SCAFFOLD_DIR)
files = source_files(stage, scaffold)
messages = adapter.draft_messages(requirements, scaffold)
started = time.monotonic()
job = None
error = None
(OUT / 'process.json').write_text(json.dumps({'pid': os.getpid(), 'phase': 'full_requirement_checks'}))
try:
    budget.progress('writing_full_requirement_tests', force=True)
    job = adapter.start_suite(requirements, OUT / 'suite', model, adapter.DEFAULT_BASE, key)
    tests = adapter.finish_suite(job, budget)
    if tests is None:
        raise ValueError('Full requirements suite was unavailable; do not treat all-unparsed fallback as validation')
    adapter.repair_delivery(stage, files, messages + [{'role': 'assistant', 'content': as_blocks(files)}],
                            model, adapter.DEFAULT_BASE, key, budget, None, requirements, scaffold=True, tests=tests)
    adapter.source_review(stage, files, messages, model, adapter.DEFAULT_BASE, key, budget,
                          None, requirements, True, tests)
except Exception as exc:
    error = type(exc).__name__ + ': ' + str(exc)[:800]
finally:
    shutil.copytree(stage, OUT / 'application', ignore=shutil.ignore_patterns(*SKIP))
    record = {'error': error, 'seconds': round(time.monotonic() - started, 1), 'usage': budget.summary(),
              'smoke': budget.smoke, 'prior_phases': prior,
              'total_estimated_cost_cny': round(prior['estimated_cost_cny'] + budget.spent(), 6),
              'boundary': 'Fresh full-suite repair of the staged app. Includes both prior generation phases; no partial score is a complete task result.'}
    (OUT / 'repair.json').write_text(json.dumps(record, ensure_ascii=False, indent=2).replace(key, '[REDACTED]'))
    with (OUT / 'trace.jsonl').open('w') as trace:
        for call in budget.attempts + budget.side_calls:
            trace.write(json.dumps(call, ensure_ascii=False).replace(key, '[REDACTED]') + '\n')
    (OUT / 'finished.json').write_text(json.dumps({'exit': 1 if error else 0, 'seconds': record['seconds'],
        'estimated_cost_cny': record['total_estimated_cost_cny'], 'error': error}, indent=2))
    shutil.rmtree(OUT / '.work')
    print(json.dumps({'error': error, 'usage': record['usage'], 'total_estimated_cost_cny': record['total_estimated_cost_cny'],
                      'final': (budget.smoke or {}).get('scenarios_after', {}).get('counts')}, ensure_ascii=False), flush=True)
