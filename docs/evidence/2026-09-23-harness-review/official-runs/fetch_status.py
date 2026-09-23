import json, subprocess, datetime, os, sys, time
BASE='/private/tmp/claude-501/-Users-e0-7-projects/a492ba62-8f9a-4850-a1ad-d5f49589dfb2/scratchpad/agent-data'
ENV=os.path.expanduser('~/.config/arcbench/volo.env')
runs=json.load(open(f'{BASE}/runs-raw.json'))
cut=datetime.datetime(2026,9,16,16,0)  # 09-17 00:00 Beijing in UTC
ids=[r['run_id'] for r in runs if r['finished_at'] and datetime.datetime.fromisoformat(r['finished_at'])>=cut]
print('n ids', len(ids))
out={}
def parse_lines(txt):
    recs=[]
    dec=json.JSONDecoder(); i=0; txt=txt.strip()
    while i < len(txt):
        while i < len(txt) and txt[i] in ' \n\r\t': i+=1
        if i>=len(txt): break
        obj, j = dec.raw_decode(txt, i); recs.append(obj); i=j
    return recs
batch=20
for k in range(0,len(ids),batch):
    chunk=ids[k:k+batch]
    for attempt in range(3):
        p=subprocess.run(['arcbench','--env-file',ENV,'--json','status','--full',*chunk],capture_output=True,text=True,timeout=300)
        try:
            recs=parse_lines(p.stdout)
        except Exception as e:
            recs=[]
        got={r.get('id'):r for r in recs if isinstance(r,dict) and r.get('id')}
        if len(got)==len(chunk):
            break
        print('retry', k, attempt, len(got), p.stderr[:200], file=sys.stderr)
        time.sleep(3)
    out.update(got)
    print(k, len(got), flush=True)
json.dump(out, open(f'{BASE}/status/status-full.json','w'))
missing=[i for i in ids if i not in out]
print('missing', len(missing), missing[:20])
