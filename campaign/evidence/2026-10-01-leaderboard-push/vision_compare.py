"""One productive test-generation call on the exact prompt of a completed Flash pilot call."""
import json
import sys
import time
from pathlib import Path

ROOT = Path('~/projects/volo-factory-worktrees/behavior-coverage-20261001')
sys.path.insert(0, str(ROOT))
from oneshot import main as adapter, testgen, scenarios
from scripts.repair_replay import gateway_key

HERE = Path(__file__).resolve().parent
OUT = HERE / 'vision-compare'
OUT.mkdir(exist_ok=False)
old = json.loads((HERE / 'audit-github/trace-1.json').read_text())[-1]
model = 'deepseek-v4-flash-vision-exp'
adapter.PRICES[model] = (1.0, 0.02, 4.0)  # live official catalogue saved in models.json
key = gateway_key('~/.config/arcbench/volo.env')
budget = adapter.CallBudget(draft_limit=1, repair_limit=0, fail_limit=1)
budget.progress_path = OUT / 'progress.json'
started = time.monotonic()
try:
    content, usage, finish = adapter.stream_completion(old['messages'], model, adapter.DEFAULT_BASE, key,
                                                       budget, tries=1, fallback='')
    (OUT / 'response.txt').write_text(content)
    result = {'status': 'completed', 'finish': finish, 'usage': usage}
    req_path = Path('~/projects/arcbench-campaign/evidence/2026-09-24-hackathon-v2/requirements/hackathon--github/requirements.yaml')
    text = req_path.read_text()
    group = next(g for g in testgen.plan(text) if g['file'] == 't06-REQ-6.spec.cjs')
    reqs = {r['id']: r for r in scenarios.load_requirements(text)}
    original = (HERE / 'baseline-score-github/suite' / group['file']).read_text()
    addition, claims, rejected = testgen._audit_additions(content, group, reqs, original, testgen._node(), OUT / 'check.cjs')
    (OUT / 'additions.cjs').write_text(addition)
    result.update(checks=len(claims), claims=claims, rejected=rejected)
except Exception as exc:
    result = {'status': 'failed', 'error': f'{type(exc).__name__}: {str(exc)[:500]}'}
finally:
    result.update(model=model, seconds=round(time.monotonic()-started,1), estimated_cost_cny=budget.spent(),
                  baseline_model=old['model'], baseline_seconds=old['elapsed_seconds'])
    (OUT / 'trace.json').write_text(json.dumps(budget.attempts,ensure_ascii=False,indent=1).replace(key,'[REDACTED]'))
    (OUT / 'summary.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print(json.dumps(result,ensure_ascii=False),flush=True)
