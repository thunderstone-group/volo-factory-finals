import json, subprocess, datetime, os, sys, time
from concurrent.futures import ThreadPoolExecutor
BASE='/private/tmp/claude-501/-Users-e0-7-projects/a492ba62-8f9a-4850-a1ad-d5f49589dfb2/scratchpad/agent-data'
ENV=os.path.expanduser('~/.config/arcbench/volo.env')
runs=json.load(open(f'{BASE}/runs-raw.json'))
cut=datetime.datetime(2026,9,16,16,0)
sel=[r for r in runs if r['finished_at'] and datetime.datetime.fromisoformat(r['finished_at'])>=cut and r['status'] in ('FAILED','PASSED')]
# priority: non-flash models first, then zero-delivery runs, then rest
def prio(r):
    p=0
    if r['model_name']!='deepseek-v4-flash': p-=10
    if (r['passed'] or 0)+(r['failed'] or 0)==0: p-=5
    return p
sel.sort(key=prio)
os.makedirs(f'{BASE}/logs', exist_ok=True)
def fetch(r):
    rid=r['run_id']
    path=f'{BASE}/logs/{rid}-logs.json'
    if os.path.exists(path) and os.path.getsize(path)>1000: return rid, 'cached'
    last=''
    for attempt in range(3):
        t0=time.time()
        try:
            p=subprocess.run(['arcbench','--env-file',ENV,'--json','logs',rid,'--tail','1','--out',f'{BASE}/logs'],capture_output=True,text=True,timeout=240)
            if os.path.exists(path) and os.path.getsize(path)>1000:
                return rid, f'ok a{attempt} {time.time()-t0:.0f}s'
            last=(p.stdout[:300]).replace('\n',' ')
        except Exception as e:
            last=str(e)[:200]
        time.sleep(3)
    return rid, 'FAIL '+last
with ThreadPoolExecutor(4) as ex:
    futs=[ex.submit(fetch, r) for r in sel]
    for f in futs:
        rid, st = f.result()
        print(rid, st, flush=True)
print('DONE', flush=True)
