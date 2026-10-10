import concurrent.futures,json,time,re
from pathlib import Path
B=Path(__file__).resolve().parent
entries=json.loads((B/'v12-active-streams.json').read_text())
def capture(item):
    path=Path(item['response'])
    try: handle=path.open('rb')
    except FileNotFoundError:return {'task':item['task'],'capture':'response already closed'}
    end=time.monotonic()+1200
    with handle:
        while path.exists() and time.monotonic()<end:time.sleep(1)
        raw=handle.read().decode('utf-8','replace')
    result={k:v for k,v in item.items() if k!='response'}
    result.update(bytes=len(raw.encode()),done=False,events=0,finish_reasons=[],usage=[],errors=[])
    for line in raw.splitlines():
        if not line.startswith('data:'):continue
        data=line[5:].strip()
        if data=='[DONE]':result['done']=True;continue
        try:o=json.loads(data)
        except ValueError:continue
        result['events']+=1
        if o.get('usage'):result['usage'].append(o['usage'])
        for c in o.get('choices',[]):
            if c.get('finish_reason'):result['finish_reasons'].append(c['finish_reason'])
        if o.get('error'):
            msg=str(o['error'])[:1000]
            msg=re.sub(r'(?i)(bearer\s+|sk-)[A-Za-z0-9_-]+','[REDACTED]',msg)
            result['errors'].append(msg)
    result['usage']=result['usage'][-2:]
    (B/('v12-'+item['task']+'-stream-diagnostic.json')).write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result),flush=True)
    return result
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(capture,entries))
