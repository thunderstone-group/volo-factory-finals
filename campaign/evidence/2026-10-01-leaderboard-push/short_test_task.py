"""A bounded, useful test-writing request with compact public requirement context and complete error diagnostics."""
import json
import sys
import time
from pathlib import Path

ROOT = Path('~/projects/volo-factory-worktrees/behavior-coverage-20261001')
sys.path.insert(0, str(ROOT))
from oneshot import main as adapter, testgen, scenarios
from scripts.repair_replay import gateway_key

HERE = Path(__file__).resolve().parent
model = sys.argv[1] if len(sys.argv) > 1 else 'deepseek-v4-flash-vision-exp'
out = HERE / ('short-test-' + model if len(sys.argv) > 1 else 'short-test-task')
out.mkdir(exist_ok=False)
if len(sys.argv) > 1:
    adapter.MAX_TOKENS = 16384
    record = next(r for r in json.loads((HERE/'models.json').read_text()) if r['id'] == model)
    price = record['pricing']
    adapter.PRICES[model] = (float(price['input']), float(price.get('cache_hit') or price['input']), float(price['output']))
req_path = Path('~/projects/arcbench-campaign/evidence/2026-09-24-hackathon-v2/requirements/hackathon--sheet/requirements.yaml')
text = req_path.read_text()
reqs = {r['id']: r for r in scenarios.load_requirements(text)}
selected = ['REQ-1-1-1', 'REQ-1-3-1', 'REQ-3-1-1', 'REQ-3-1-3', 'REQ-5-1-1']
context = [{k: reqs[rid][k] for k in ['id','name','description']} for rid in selected]
messages = [{'role':'system','content':'Write a single self-contained Playwright regression test from public requirements. Use exact stated accessible roles, labels and UI paths; no API or internal application access. Output code only.'},
            {'role':'user','content':'Write one test for REQ-5-1-1 that establishes the described stable-order property in both sort directions using tied keys and distinguishable records. Create the data through the supplied UI flows, assert rows remain intact and unselected data is unchanged. The test runs in Chromium with @playwright/test, baseURL already set and a 15 second timeout. Do not assume undocumented controls. Relevant public requirement descriptions:\n'+json.dumps(context,ensure_ascii=False)}]
budget = adapter.CallBudget(draft_limit=1,repair_limit=0,fail_limit=1)
budget.progress_path = out/'progress.json'
key = gateway_key('~/.config/arcbench/volo.env')
started = time.monotonic()
try:
    content, usage, finish = adapter.stream_completion(messages,model,adapter.DEFAULT_BASE,key,budget,tries=1,fallback='')
    (out/'response.txt').write_text(content)
    summary = {'status':'completed','finish':finish,'usage':usage,'response_chars':len(content)}
except Exception as exc:
    summary = {'status':'failed','error':str(exc)}
finally:
    summary.update(model=model,max_tokens=adapter.MAX_TOKENS,seconds=round(time.monotonic()-started,1),prompt_chars=sum(len(m['content']) for m in messages),estimated_cost_cny=budget.spent())
    (out/'trace.json').write_text(json.dumps(budget.attempts,ensure_ascii=False,indent=1).replace(key,'[REDACTED]'))
    (out/'summary.json').write_text(json.dumps(summary,indent=2))
    print(json.dumps(summary),flush=True)
