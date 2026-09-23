import json, collections, statistics as stt, math
from scipy import stats
BASE='/private/tmp/claude-501/-Users-e0-7-projects/a492ba62-8f9a-4850-a1ad-d5f49589dfb2/scratchpad/agent-data'
rows=json.load(open(f'{BASE}/runs-dataset.json'))
R14_27=['r13','r15','r16','r17','r18','r19','r20','r21','r22','r23','r24','r25','r26','r27']
TASKS=['keep','bookstack','stackoverflow','prestashop','12306','ctrip']
web=[r for r in rows if r['competition']=='arc-bench-web' and r['status'] in('FAILED','PASSED') and r['harness']=='oneshot' and r['package'] in R14_27]
tab=collections.defaultdict(list)
for r in web: tab[(r['package'],r['task'])].append(r)
for t in TASKS:
    groups=[[x['passed'] for x in tab[(p,t)]] for p in R14_27]
    F,pv=stats.f_oneway(*groups)
    # excluding r18 and r23 (known rejected rounds)
    g2=[[x['passed'] for x in tab[(p,t)]] for p in R14_27 if p not in ('r18','r23')]
    F2,pv2=stats.f_oneway(*g2)
    print(f'{t:14s} ANOVA across 14 pkgs F={F:.2f} p={pv:.3f} | excl r18,r23 F={F2:.2f} p={pv2:.3f}')
# six-task average per sample
def samples(p):
    ks=[sorted(tab[(p,t)], key=lambda x: x['created_at_utc'] or '') for t in TASKS]
    n=min(len(k) for k in ks)
    return [stt.mean(100*ks[j][i]['passed']/ks[j][i]['task_total'] for j in range(6)) for i in range(n)]
g=[samples(p) for p in R14_27]
F,pv=stats.f_oneway(*g); print('six-task avg ANOVA F=%.2f p=%.3f'%(F,pv))
g2=[samples(p) for p in R14_27 if p not in ('r18','r23')]
F,pv=stats.f_oneway(*g2); print('six-task avg excl r18,r23 F=%.2f p=%.3f'%(F,pv))
# pooled combined 'medium+large' per sample (same package, same sample index)
print('\ncombined medium+large per-sample pass rate (pp), pooled r14-r27:')
for m in ('keep','bookstack'):
    for l in ('12306','ctrip'):
        vals=[];within_ss=0;df=0
        for p in R14_27:
            km=sorted(tab[(p,m)], key=lambda x: x['created_at_utc'] or ''); kl=sorted(tab[(p,l)], key=lambda x: x['created_at_utc'] or '')
            n=min(len(km),len(kl)); pv=[]
            for i in range(n):
                v=100*(km[i]['passed']+kl[i]['passed'])/(km[i]['task_total']+kl[i]['task_total']); pv.append(v); vals.append(v)
            if len(pv)>=2:
                mm=stt.mean(pv); within_ss+=sum((a-mm)**2 for a in pv); df+=len(pv)-1
        print(f'  {m}+{l}: n={len(vals)} mean={stt.mean(vals):.1f} sd={stt.stdev(vals):.1f} min={min(vals):.1f} max={max(vals):.1f} within-pkg SD={math.sqrt(within_ss/df):.1f}')
