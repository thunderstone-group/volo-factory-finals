import json, re, os, sys, glob, datetime
BASE='/private/tmp/claude-501/-Users-e0-7-projects/a492ba62-8f9a-4850-a1ad-d5f49589dfb2/scratchpad/agent-data'
TS=re.compile(r'^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})(?: UTC)?\] \[([^\]]+)\] ?(.*)$')
def ts(s):
    return datetime.datetime.strptime(s,'%Y-%m-%d %H:%M:%S')
def tail_fields(line):
    """extract status/finish_reason/error_type/elapsed/model/call from an [oneshot] trace json line without full parse"""
    out={}
    m=re.search(r'\{"call": (\d+), "model": "([^"]+)"', line)
    if m: out['call']=int(m.group(1)); out['model']=m.group(2)
    tail=line[-3000:]
    for k in ('status','finish_reason','error_type'):
        mm=re.findall(r'"%s": (null|"[^"]*")'%k, tail)
        if mm: out[k]=None if mm[-1]=='null' else mm[-1].strip('"')
    mm=re.findall(r'"elapsed_seconds": ([0-9.]+)', tail)
    if mm: out['elapsed']=float(mm[-1])
    mm=re.search(r'"stream_observation": (\{[^}]*\})', tail)
    if mm:
        try: out['stream']=json.loads(mm.group(1))
        except Exception: pass
    mm=re.findall(r'"error": ("[^"]{0,300}")', tail)
    if mm: out['error']=mm[-1].strip('"')
    if out.get('status') is None:
        if out.get('error_type'): out['status']='failed'; out['status_inferred']=True
        elif out.get('finish_reason') in ('stop','length','content_filter'): out['status']='completed'; out['status_inferred']=True
    return out
KEYS=['StreamError','content_filter','insufficient_quota','429','Connection reset','Empty reply','timed out','Timeout','timeout',
      'no file blocks','unterminated','without an open block','duplicate file block','Traceback','exit code: 1','1200']
def parse(path):
    d=json.load(open(path))
    c=d.get('console') or d.get('stdout') or ''
    rec={'meter_base':None,'meter_capture':None,'meter_cost_logged':None,'agent_start':None,'agent_end':None,'agent_exit':None,
         'workers':None,'traces':[],'retry_lines':0,'oneshot_failed':[],'usage':None,'wrote':None,'smoke_repair':None,
         'harness':None,'pi_usage':None,'kw':{},'agent_err_lines':[], 'template_timeout':False, 'container_status':None}
    for l in c.split('\n'):
        m=TS.match(l)
        if not m: continue
        t, src, msg = m.group(1), m.group(2), m.group(3)
        if src=='backend':
            if msg.startswith('Meter baseline captured'): rec['meter_base']=t
            elif msg.startswith('Meter usage captured'):
                rec['meter_capture']=t
                mm=re.search(r'cost=([0-9.]+)', msg)
                if mm: rec['meter_cost_logged']=float(mm.group(1))
            elif msg.startswith('Container exited with result'):
                rec['container_status']=msg[len('Container exited with result='):][:60]
            continue
        if msg.startswith('Executing generation-agent'): rec['agent_start']=t; continue
        mm=re.match(r'generation-agent exit code: (-?\d+)', msg)
        if mm: rec['agent_end']=t; rec['agent_exit']=int(mm.group(1)); continue
        mm=re.search(r'playwright test --workers=(\d+)', msg)
        if mm: rec['workers']=int(mm.group(1))
        mm=re.search(r'Test environment ready with (\d+) workers', msg)
        if mm and rec['workers'] is None: rec['workers']=int(mm.group(1))
        if 'did not become ready' in msg: rec['template_timeout']=True
        if not msg.startswith('generation-agent'): continue
        body=msg.split('|',1)[1].strip() if '|' in msg else msg
        if body.startswith('[pi-harness]') or body.startswith('[pi-agent]'): rec['harness']='pi'
        if body.startswith('[oneshot]'): rec['harness']=rec['harness'] or 'oneshot'
        if body.startswith('[pi-agent] usage:'):
            try: rec['pi_usage']=json.loads(body.split('usage:',1)[1].replace('***','null'))
            except Exception: rec['pi_usage']=body[:300]
        if body.startswith('[oneshot] trace'):
            tf=tail_fields(body); tf['t']=t; rec['traces'].append(tf); continue
        if re.match(r'\[oneshot\] call \d+ failed', body): rec['retry_lines']+=1
        if body.startswith('[oneshot] failed:'): rec['oneshot_failed'].append(body[len('[oneshot] failed:'):].strip()[:200])
        if body.startswith('[oneshot] usage'):
            try: rec['usage']=json.loads(body[len('[oneshot] usage'):].strip().replace('***','null'))
            except Exception: rec['usage']={'raw':body[:300]}
        mm=re.match(r'\[oneshot\] wrote (\d+) files in ([0-9.]+)s', body)
        if mm: rec['wrote']=(int(mm.group(1)), float(mm.group(2)))
        if body.startswith('[oneshot] smoke'):
            mm=re.search(r'"repair": (null|\{[^}]*\})', body)
            if mm: rec['smoke_repair']=mm.group(1)[:200]
        for k in KEYS:
            if k in body and not body.startswith('[oneshot] trace'):
                rec['kw'][k]=rec['kw'].get(k,0)+1
        if ('rror' in body or 'fail' in body or 'Traceback' in body) and len(rec['agent_err_lines'])<12 and not body.startswith('[oneshot] smoke') and not body.startswith('[oneshot] semantic'):
            rec['agent_err_lines'].append((t, body[:240]))
    return rec
if __name__=='__main__':
    out={}
    for p in sorted(glob.glob(f'{BASE}/logs/*-logs.json')):
        rid=os.path.basename(p).split('-logs.json')[0]
        try:
            out[rid]=parse(p)
        except Exception as e:
            out[rid]={'parse_error':str(e)}
    json.dump(out, open(f'{BASE}/logs-parsed.json','w'), indent=0, default=str)
    print(len(out))
