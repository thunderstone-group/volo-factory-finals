"""Replay a captured rejected recovery, then permit one real requirements-only correction call."""
import argparse
import json
import shutil
import sys
import time
from pathlib import Path

ROOT = Path('~/projects/volo-factory-worktrees/s70-20261002')
sys.path.insert(0, str(ROOT))
from oneshot import main as adapter, testgen
from scripts.repair_replay import gateway_key

parser = argparse.ArgumentParser()
parser.add_argument('--model', required=True)
parser.add_argument('--label', required=True)
args = parser.parse_args()
HERE = Path(__file__).resolve().parent
SRC = HERE / 'recover-github-flash'
OUT = HERE / args.label
OUT.mkdir(exist_ok=False)
shutil.copytree(SRC / 'suite', OUT / 'suite')
manifest = json.loads((OUT / 'suite/suite.json').read_text())
for r in manifest['files']:
    r.pop('recovery', None)
(OUT / 'suite/suite.json').write_text(json.dumps(manifest))
old = json.loads((SRC / 'trace.json').read_text())[-1]
req = Path('~/projects/arcbench-campaign/evidence/2026-09-24-hackathon-v2/requirements/hackathon--github/requirements.yaml').read_text()
key = gateway_key('~/.config/arcbench/volo.env')
budget = adapter.CallBudget(draft_limit=1, repair_limit=0, fail_limit=1)
budget.progress_path = OUT / 'progress.json'
calls = 0

def complete(messages):
    global calls
    calls += 1
    if calls == 1:
        return old['content'], old['usage'], old['finish_reason']
    if calls != 2:
        raise RuntimeError('Only one paid correction is authorized by this experiment.')
    return adapter.stream_completion(messages, args.model, adapter.DEFAULT_BASE, key, budget, tries=1, fallback='')

started = time.monotonic()
try:
    result = testgen.recover_skipped(req, OUT / 'suite', complete)
    summary = {'recovered': result['recovered_scenarios'],
               'records': [{'file': r['file'], 'recovered_ids': [c['id'] for c in r.get('recovery', {}).get('claims', [])],
                            'error': r.get('recovery', {}).get('error')} for r in result['files']]}
except Exception as exc:
    summary = {'error': type(exc).__name__ + ': ' + str(exc)[:400]}
finally:
    (OUT / 'trace.json').write_text(json.dumps(budget.attempts, ensure_ascii=False, indent=1).replace(key, '[REDACTED]'))
    summary.update(model=args.model, reused_reply=str(SRC / 'trace.json'), new_model_calls=len(budget.attempts),
                   seconds=round(time.monotonic() - started, 1), estimated_cost_cny=budget.spent())
    (OUT / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    print(json.dumps(summary, ensure_ascii=False), flush=True)
