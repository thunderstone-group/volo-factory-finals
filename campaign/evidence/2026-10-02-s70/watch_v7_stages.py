"""Finish the existing Sheet repeat, then run the authorized staged route serially.

Uses only arcbench-cli. Never recreates an existing run after a read/observation failure.
"""
import json
import subprocess
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ENV = '~/.config/arcbench/volo.env'
SUBMISSION = '12e3bab723fd'
BASE = ['arcbench','--env-file',ENV]

def read(*args):
    for attempt in range(4):
        result = subprocess.run(BASE+list(args)+['--json'],capture_output=True,text=True)
        try:
            data = json.loads(result.stdout)
            if isinstance(data,dict) and 'error' in data and 'status' not in data: raise ValueError('API read failed')
            return data
        except ValueError:
            with (HERE/'v7-stages-read-errors.jsonl').open('a') as log:
                log.write(json.dumps({'at':time.time(),'command':args[0],'attempt':attempt+1,
                                      'exit':result.returncode,'detail':(result.stderr or result.stdout)[-600:]})+'\n')
            if attempt == 3: raise RuntimeError('CLI read failed; retain the current run ID')
            time.sleep(15)

def wait(run_id,label):
    deadline = time.monotonic()+8*3600
    previous = None
    while time.monotonic()<deadline:
        try:
            state=read('status',run_id)
        except RuntimeError:
            print(label,run_id,'read unavailable; retain the same run',flush=True)
            time.sleep(40)
            continue
        (HERE/(label+'-latest.json')).write_text(json.dumps(state,indent=2))
        key=(state.get('status'),next((x['key'] for x in state.get('steps',[]) if x['status']=='running'),None))
        if key != previous: print(label,run_id,key,flush=True);previous=key
        if state.get('status') in {'PASSED','FAILED','ERROR','CANCELLED','CANCELED'}:
            (HERE/(label+'-result.json')).write_text(json.dumps(state,indent=2))
            return state
        time.sleep(40)
    raise RuntimeError('Observation deadline; keep inspecting the same run '+run_id)

wait('defb678bf0a1','v7-sheet-repeat')
for stage in (1,2,3):
    label='v7-official-stage-'+str(stage)
    receipt=HERE/(label+'-start.jsonl')
    if receipt.exists(): raise RuntimeError('Receipt already exists; resume its run manually, never duplicate')
    submissions=[x for x in read('submissions') if x.get('competition_id')=='hackathon']
    latest=max(submissions,key=lambda x:x.get('created_at',''))
    if latest.get('id')!=SUBMISSION: raise RuntimeError('Latest submission changed; do not run a superseded package')
    funds=read('registration','hackathon')
    if float(funds.get('remaining_budget_cny',0))<15: raise RuntimeError('Insufficient budget for another bounded run')
    with receipt.open('x') as output:
        started=subprocess.run(BASE+['run',SUBMISSION,'--task','hackathon--github-stage-'+str(stage),
                                      '--queue-timeout','1800','--json'],stdout=output)
    if started.returncode: raise RuntimeError('Start outcome uncertain; inspect receipt, do not retry the write')
    records=json.loads(receipt.read_text())
    run_id=records[0]['run_id']
    result=wait(run_id,label)
    if not result.get('passed'): raise RuntimeError('Stage produced no positive score; inspect its application before continuing')
board=read('leaderboard','--competition','hackathon','--limit','30')
(HERE/'v7-board-after-stages.json').write_text(json.dumps(board,ensure_ascii=False,indent=2))
print('Staged route complete; inspect full leaderboard and source run IDs.',flush=True)
