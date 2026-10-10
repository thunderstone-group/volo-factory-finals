"""Replay actual invalid-matcher feedback through the normal requirements-only suite repair."""
import collections, hashlib, json, shutil, sys, time
from pathlib import Path
ROOT=Path('~/projects/volo-factory-worktrees/source-owners-20261002')
sys.path.insert(0,str(ROOT))
from oneshot import main as adapter,testgen
from scripts.repair_replay import gateway_key
HERE=Path(__file__).resolve().parent
OUT=HERE/'matcher-recovery-inline-pilot'
OUT.mkdir(exist_ok=False)
shutil.copytree(HERE/'controls-v3-recovered-own-suite',OUT/'suite',ignore=shutil.ignore_patterns('source-contracts.json'))
req=(HERE.parent/'2026-09-24-hackathon-v2/requirements/hackathon--github/requirements.yaml').read_text()
app=HERE/'diagnostic-recovery-repair-github/application'
suite=OUT/'suite'
key=gateway_key('~/.config/arcbench/volo.env')
budget=adapter.CallBudget(draft_limit=1,repair_limit=0,fail_limit=1)
budget.progress_path=OUT/'progress.json'
start=time.monotonic()
def complete(messages):
    return adapter.stream_completion(messages,'deepseek-v4-flash-vision-exp',adapter.DEFAULT_BASE,key,budget,tries=1,fallback='')
summary={}
try:
    before=testgen.run_suite(app,suite,req)
    (OUT/'before.json').write_text(json.dumps(before,ensure_ascii=False,indent=2))
    changed=testgen.fix_suite(req,suite,before,complete,workers=1)
    after=testgen.run_suite(app,suite,req) if changed else before
    (OUT/'after.json').write_text(json.dumps(after,ensure_ascii=False,indent=2))
    summary.update(changed=changed,before=dict(collections.Counter(x['status'] for x in before['scenarios'])),
                   after=dict(collections.Counter(x['status'] for x in after['scenarios'])))
except Exception as exc:
    summary['error']=type(exc).__name__+': '+str(exc)[:600]
finally:
    (OUT/'trace.json').write_text(json.dumps(budget.attempts,ensure_ascii=False,indent=1).replace(key,'[REDACTED]'))
    summary.update(seconds=round(time.monotonic()-start,1),estimated_cost_cny=budget.spent(),
                   scope='Same frozen app, public requirements and actual invalid-API feedback only; no independent judges in prompt.')
    (OUT/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
    print(json.dumps(summary,ensure_ascii=False),flush=True)
