"""One real fixture-verification call using actual binding feedback; no application edits."""
import json
import sys
import time
from pathlib import Path

HERE=Path(__file__).resolve().parent
ROOT=Path('~/projects/volo-factory-worktrees/source-owners-20261002')
sys.path.insert(0,str(ROOT))
from oneshot import main as adapter, source_contracts as contracts, scenarios
from scripts.repair_replay import gateway_key

out=HERE/'owner-proposals-verified'
out.mkdir(exist_ok=False)
app=HERE/'generate-contracts-v2-github/application'
raw=(HERE.parent/'2026-09-24-hackathon-v2/requirements/hackathon--github/requirements.yaml').read_text()
probes=json.loads((HERE/'generate-contracts-v2-github/source-proposals-first-captured.json').read_text())
results=contracts.execute(app,probes,raw)['results']
ids={p['requirement'] for p in probes}
public='\n\n'.join(r['id']+' '+r.get('name','')+'\n'+r.get('description','')
                   for r in scenarios.load_requirements(raw) if r['id'] in ids)
sources=contracts.context_sources(app)
system=contracts.SYSTEM+'''\nObject-literal methods can be selected by their full declaration path, such as
Rules.actions.adjust. Their actual owner and helper methods are reconstructed from source. A standalone alias call
uses that actual owner as its default receiver. Binding errors list actual declared paths; use them rather than
guessing another entrypoint or weakening an assertion. Supply external plumbing, including escaping, only where
the actual function needs it. Do not replace or mock business decisions. Return corrected probes, not app changes.'''
messages=[{'role':'system','content':system},{'role':'user','content':'Public requirements:\n'+public+
 '\n\nActual application source:\n'+'\n\n'.join('=== '+f+' ===\n'+s for f,s in sources.items())+
 '\n\nOriginal proposed counterexamples:\n'+json.dumps(probes,ensure_ascii=False)+
 '\n\nActual execution results:\n'+json.dumps(results,ensure_ascii=False)+'\n\n'+contracts.VERIFY}]
key=gateway_key('~/.config/arcbench/volo.env')
budget=adapter.CallBudget(draft_limit=1,repair_limit=0,fail_limit=1)
budget.progress_path=out/'progress.json'
start=time.monotonic();summary={}
try:
 reply,usage,finish=adapter.stream_completion(messages,'deepseek-v4-flash-vision-exp',adapter.DEFAULT_BASE,key,budget,tries=1,fallback='')
 (out/'response.txt').write_text(reply)
 checked=contracts.definitions(reply,raw)
 executed=contracts.execute(app,checked,raw)
 (out/'execution.json').write_text(json.dumps(executed,ensure_ascii=False,indent=2))
 summary.update(finish=finish,usage=usage,results=executed['results'])
except Exception as exc:
 summary['error']=type(exc).__name__+': '+str(exc)[:1200]
finally:
 (out/'trace.json').write_text(json.dumps(budget.attempts,ensure_ascii=False,indent=1).replace(key,'[REDACTED]'))
 summary.update(seconds=round(time.monotonic()-start,1),estimated_cost_cny=budget.spent())
 (out/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
 print(json.dumps(summary,ensure_ascii=False),flush=True)
