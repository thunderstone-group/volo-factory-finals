import json, statistics as stt, collections, math
BASE='/private/tmp/claude-501/-Users-e0-7-projects/a492ba62-8f9a-4850-a1ad-d5f49589dfb2/scratchpad/agent-data'
rows=json.load(open(f'{BASE}/runs-dataset.json'))
lite=[r for r in rows if r['competition']=='arc-bench-lite' and r['status'] in('FAILED','PASSED')]
tab=collections.defaultdict(list)
for r in lite: tab[(r['package'] or r['submission_name'], r['model'], r['task'])].append(r)
keys=sorted(set((k[0],k[1]) for k in tab), key=lambda k: min(x['created_at_utc'] for t in ('keep','bookstack') for x in tab.get((k[0],k[1],t),[]) ) )
print('package/model\tkeep\tbookstack')
for p,m in keys:
    print(p, m[:22], '/'.join(str(x['passed']) for x in tab.get((p,m,'keep'),[])), '/'.join(str(x['passed']) for x in tab.get((p,m,'bookstack'),[])), sep='\t')
for t,N in (('keep',32),('bookstack',34)):
    ss=0;df=0;allv=[]
    for (p,m,tt),lst in tab.items():
        if tt!=t or not p.startswith('r'): continue
        v=[x['passed'] for x in lst]; allv+=v
        if len(v)>=2:
            mm=stt.mean(v); ss+=sum((a-mm)**2 for a in v); df+=len(v)-1
    print(t,'official flash r17-r28b n',len(allv),'mean',round(stt.mean(allv),1),'min',min(allv),'max',max(allv),'sd',round(stt.stdev(allv),1),'within-pkg pooled SD',round(math.sqrt(ss/df),2))
