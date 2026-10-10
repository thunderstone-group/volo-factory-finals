"""Observe the existing GitHub repeat, then run one more Sheet on the same saved submission."""
import json
import subprocess
import time
from pathlib import Path
HERE=Path(__file__).resolve().parent
BASE=['arcbench','--env-file','~/.config/arcbench/volo.env']
SUB='12e3bab723fd'

def read(args):
    r=subprocess.run(BASE+args+['--json'],capture_output=True,text=True)
    data=json.loads(r.stdout)
    if isinstance(data,dict) and 'error' in data and 'status' not in data:raise ValueError('API read failed')
    return data

def wait(run,label):
    deadline=time.monotonic()+8*3600;previous=None
    while time.monotonic()<deadline:
        try:d=read(['status',run])
        except (ValueError,OSError):time.sleep(30);continue
        (HERE/(label+'-latest.json')).write_text(json.dumps(d,indent=2))
        key=(d['status'],next((s['key'] for s in d['steps'] if s['status']=='running'),None))
        if key!=previous:print(label,run,key,flush=True);previous=key
        if d['status'] in {'FAILED','PASSED','CANCELLED','CANCELED','ERROR'}:
            (HERE/(label+'-result.json')).write_text(json.dumps(d,indent=2));return d
        time.sleep(30)
    raise RuntimeError('Observation timeout; preserve the same run ID')

wait('3bf0eb62b562','v7-github-repeat')
submissions=[s for s in read(['submissions']) if s.get('competition_id')=='hackathon']
if max(submissions,key=lambda s:s.get('created_at',''))['id']!=SUB:raise RuntimeError('Submission changed')
funds=read(['registration','hackathon'])
if float(funds.get('remaining_budget_cny',0))<15:raise RuntimeError('Insufficient remaining budget')
receipt=HERE/'v7-sheet-repeat2-start.jsonl'
with receipt.open('x') as f:
    r=subprocess.run(BASE+['run',SUB,'--task','hackathon--sheet','--queue-timeout','1800','--json'],stdout=f)
if r.returncode:raise RuntimeError('Uncertain start; inspect receipt, do not repeat the write')
run=json.loads(receipt.read_text())[0]['run_id']
wait(run,'v7-sheet-repeat2')
d=read(['leaderboard','--competition','hackathon','--limit','20'])
(HERE/'board-after-v7-final-originals.json').write_text(json.dumps(d,ensure_ascii=False,indent=2))
print('Original repeats finished; inspect authoritative board.',flush=True)
