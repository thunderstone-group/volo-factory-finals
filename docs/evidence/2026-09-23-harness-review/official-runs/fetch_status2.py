import json, subprocess, datetime, os, sys, time
from concurrent.futures import ThreadPoolExecutor
BASE='/private/tmp/claude-501/-Users-e0-7-projects/a492ba62-8f9a-4850-a1ad-d5f49589dfb2/scratchpad/agent-data'
ENV=os.path.expanduser('~/.config/arcbench/volo.env')
runs=json.load(open(f'{BASE}/runs-raw.json'))
cut=datetime.datetime(2026,9,16,16,0)
ids=[r['run_id'] for r in runs if r['finished_at'] and datetime.datetime.fromisoformat(r['finished_at'])>=cut]
os.makedirs(f'{BASE}/status/one', exist_ok=True)
def parse_lines(txt):
    recs=[]; dec=json.JSONDecoder(); i=0; txt=txt.strip()
    while i < len(txt):
        while i < len(txt) and txt[i] in ' \n\r\t': i+=1
        if i>=len(txt): break
        try:
            obj, j = dec.raw_decode(txt, i)
        except Exception:
            break
        recs.append(obj); i=j
    return recs
def fetch(rid):
    path=f'{BASE}/status/one/{rid}.json'
    if os.path.exists(path): return rid, 'cached'
    last=''
    for attempt in range(3):
        t0=time.time()
        try:
            p=subprocess.run(['arcbench','--env-file',ENV,'--json','status','--full',rid],capture_output=True,text=True,timeout=180)
            recs=[r for r in parse_lines(p.stdout) if isinstance(r,dict) and r.get('id')==rid]
            if recs:
                json.dump(recs[0], open(path,'w'))
                return rid, f'ok a{attempt} {time.time()-t0:.0f}s'
            last=(p.stdout[:200]+p.stderr[:200]).replace('\n',' ')
        except Exception as e:
            last=str(e)
        time.sleep(2)
    return rid, 'FAIL '+last
with ThreadPoolExecutor(6) as ex:
    for rid, st in ex.map(fetch, ids):
        print(rid, st, flush=True)
