"""One requirement-only fixture recovery call, followed by exact-source validation; no application in the prompt."""
import json
import argparse
import sys
import time
from pathlib import Path

ROOT = Path('~/projects/volo-factory-worktrees/s70-20261002')
sys.path.insert(0, str(ROOT))
from oneshot import main as adapter, testgen
from scripts.repair_replay import gateway_key

HERE = Path(__file__).resolve().parent
PREVIOUS = HERE.parent / '2026-10-01-leaderboard-push'
parser = argparse.ArgumentParser()
parser.add_argument('--model', default='deepseek-v4-flash-vision-exp')
parser.add_argument('--label', default='recover-github')
args = parser.parse_args()
OUT = HERE / args.label
OUT.mkdir(exist_ok=False)
suite = OUT / 'suite'
suite.mkdir()
trace = next(json.loads(line[len('[oneshot] trace '):]) for line in
             (PREVIOUS / 'vision-github-1/stderr.log').read_text().splitlines()
             if line.startswith('[oneshot] trace ') and json.loads(line[len('[oneshot] trace '):])['call'] == 'tests-12')
block = testgen.FILE_BLOCK.search(trace['messages'][-2]['content'])
name, original = block.group(1).strip(), block.group(2)
(suite / name).write_text(original)
titles = [m.group(2) for m in testgen.TITLE.finditer(original)]
(suite / 'suite.json').write_text(json.dumps({'files': [{'file': name, 'tests': titles}],
                                             'scenarios': len(titles), 'tests': len(titles)}, indent=2))
requirements = Path('~/projects/arcbench-campaign/evidence/2026-09-24-hackathon-v2/requirements/hackathon--github/requirements.yaml').read_text()
key = gateway_key('~/.config/arcbench/volo.env')
budget = adapter.CallBudget(draft_limit=1, repair_limit=0, fail_limit=1)
budget.progress_path = OUT / 'progress.json'

def complete(messages):
    return adapter.stream_completion(messages, args.model, adapter.DEFAULT_BASE,
                                     key, budget, tries=1, fallback='')

started = time.monotonic()
try:
    manifest = testgen.recover_skipped(requirements, suite, complete, workers=1)
    summary = {'recovered': manifest['recovered_scenarios'], 'records': manifest['files']}
except Exception as exc:
    summary = {'error': type(exc).__name__ + ': ' + str(exc)[:400]}
finally:
    (OUT / 'trace.json').write_text(json.dumps(budget.attempts, ensure_ascii=False, indent=1).replace(key, '[REDACTED]'))
    summary.update(model=args.model, seconds=round(time.monotonic() - started, 1), estimated_cost_cny=budget.spent())
    (OUT / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    print(json.dumps(summary, ensure_ascii=False), flush=True)
