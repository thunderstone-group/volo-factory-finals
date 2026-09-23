import json, collections, statistics as stt, os
BASE='/private/tmp/claude-501/-Users-e0-7-projects/a492ba62-8f9a-4850-a1ad-d5f49589dfb2/scratchpad/agent-data'
rows=json.load(open(f'{BASE}/runs-dataset.json'))
R14_27=['r13','r15','r16','r17','r18','r19','r20','r21','r22','r23','r24','r25','r26','r27']
TASKS=['keep','bookstack','stackoverflow','prestashop','12306','ctrip']
def tests(rid):
    d=json.load(open(f'{BASE}/status/one/{rid}.json'))
    return {t['name'].split(':')[0].strip()+'|'+t['name']: bool(t.get('passed')) for t in d.get('tests') or []}
web=[r for r in rows if r['competition']=='arc-bench-web' and r['status'] in('FAILED','PASSED') and r['harness']=='oneshot' and r['package'] in R14_27]
tab=collections.defaultdict(list)
for r in web: tab[(r['package'],r['task'])].append(r)
print('task | within-pkg flips per pair (mean, as % of tests) | adjacent-pkg flips (first samples) | net diff within-pkg')
for t in TASKS:
    within=[];adj=[];net=[]
    prev=None
    for p in R14_27:
        lst=sorted(tab[(p,t)], key=lambda x: x['created_at_utc'] or '')
        ts=[tests(x['run_id']) for x in lst]
        ts=[x for x in ts if x]  # delivered only
        if len(ts)>=2:
            a,b=ts[0],ts[1]; keys=set(a)&set(b)
            within.append(sum(1 for k in keys if a[k]!=b[k])); net.append(abs(sum(a[k] for k in keys)-sum(b[k] for k in keys)))
        if ts:
            if prev is not None:
                keys=set(prev)&set(ts[0]); adj.append(sum(1 for k in keys if prev[k]!=ts[0][k]))
            prev=ts[0]
    N={'keep':32,'bookstack':34,'stackoverflow':66,'prestashop':86,'12306':135,'ctrip':125}[t]
    print(f'{t:13s} within flips mean {stt.mean(within):.1f} ({100*stt.mean(within)/N:.0f}%) median {stt.median(within)} | adjacent flips mean {stt.mean(adj):.1f} ({100*stt.mean(adj)/N:.0f}%) | within net |diff| mean {stt.mean(net):.1f}')
