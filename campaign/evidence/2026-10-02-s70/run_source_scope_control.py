"""No model calls: compare controller decisions at the captured completed source-repair state."""
import hashlib
import json
import shutil
import sys
from pathlib import Path

repo=Path(sys.argv[1]);label=sys.argv[2]
sys.path.insert(0,str(repo))
from oneshot import main as adapter
HERE=Path(__file__).resolve().parent
root=HERE/'source-scope-control';out=root/label;out.mkdir(exist_ok=False)
app=out/'application'
shutil.copytree(HERE/'generate-repair-evidence-v8-sheet/application',app,
                ignore=shutil.ignore_patterns('dist','node_modules','__pycache__'))
shutil.copytree(root/'suite',out/'suite')
req=(HERE/'v7-official-sheet-input.yaml').read_text()
targets=set(json.loads((root/'provenance.json').read_text())['targets'])
def hashes():
    return {str(f.relative_to(app)):hashlib.sha256(f.read_bytes()).hexdigest()
            for f in app.rglob('*') if f.is_file() and not any(x.startswith('.') or x in {'dist','node_modules'}
                for x in f.relative_to(app).parts)}
before=hashes();requested=[]
def no_model(messages,model,base,key,budget,**kwargs):
    requested.append(messages[-1]['content'])
    # Synthetic completed-call marker bounds the old controller after recording its decision.
    record=budget.start(messages,model);record.update(status='completed',usage={})
    raise RuntimeError('Diagnostic boundary: the controller requested an unrelated repair; no model call was sent')
adapter.stream_completion=no_model
budget=adapter.CallBudget(repair_limit=1);budget.phase='repair'
adapter.repair_delivery(app,[],[{'role':'user','content':'Captured completed source repair'}],
    'diagnostic','unused','unused',budget,requirements=req,scaffold=True,tests=out/'suite',
    **({'repair_targets':targets} if label=='focused' else {}))
result={'variant':label,'model_api_calls':0,'controller_requests':len(requested),
        'application_unchanged':before==hashes(),'stopped':budget.smoke.get('stopped'),
        'counts':budget.smoke.get('scenarios_after',{}).get('counts'),
        'remaining':budget.smoke.get('scenarios_after',{}).get('failing')}
(out/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
(out/'controller-request.txt').write_text('\n\n'.join(requested))
print(json.dumps({k:v for k,v in result.items() if k!='remaining'}),flush=True)
