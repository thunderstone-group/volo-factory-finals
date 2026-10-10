"""Generate one public-requirement test group with stronger fixture isolation; no app source in prompt."""
import json
import sys
import time
from pathlib import Path
from unittest.mock import patch

ROOT=Path('~/projects/volo-factory-worktrees/source-owners-20261002')
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT))
from oneshot import main as adapter, testgen
from scripts.repair_replay import gateway_key

req=(HERE.parent/'2026-09-24-hackathon-v2/requirements/hackathon--github/requirements.yaml').read_text()
group=next(g for g in testgen.plan(req) if g['top']=='REQ-6')
out=HERE/'fixture-isolation-pilot'
out.mkdir(exist_ok=False)
key=gateway_key('~/.config/arcbench/volo.env')
budget=adapter.CallBudget(draft_limit=1,repair_limit=0,fail_limit=1)
budget.progress_path=out/'progress.json'
start=time.monotonic()
def complete(messages):
    return adapter.stream_completion(messages,'deepseek-v4-flash-vision-exp',adapter.DEFAULT_BASE,key,budget,tries=1,fallback='')
try:
    # Operator scheduling only: the standard writer still receives the complete unchanged public requirements.
    with patch.object(testgen,'plan',return_value=[group]):
        manifest=testgen.write_suite(req,out/'suite',complete,workers=1,audit=False)
    summary={'manifest':manifest}
except Exception as exc:
    summary={'error':type(exc).__name__+': '+str(exc)[:500]}
finally:
    (out/'trace.json').write_text(json.dumps(budget.attempts,ensure_ascii=False,indent=1).replace(key,'[REDACTED]'))
    summary.update(seconds=round(time.monotonic()-start,1),estimated_cost_cny=budget.spent(),
                   scope='one public requirement group; no app or independent judge in the model prompt')
    (out/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
    print(json.dumps(summary,ensure_ascii=False),flush=True)
