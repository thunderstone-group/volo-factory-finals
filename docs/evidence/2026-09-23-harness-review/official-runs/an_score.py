import json, collections, statistics as stt, math
import sys
sys.path.insert(0,'/private/tmp/claude-501/-Users-e0-7-projects/a492ba62-8f9a-4850-a1ad-d5f49589dfb2/scratchpad/agent-data')
from score import S
BASE='/private/tmp/claude-501/-Users-e0-7-projects/a492ba62-8f9a-4850-a1ad-d5f49589dfb2/scratchpad/agent-data'
rows=json.load(open(f'{BASE}/runs-dataset-final.json'))
est={e['run_id']:e for e in json.load(open(f'{BASE}/own-cost-est.json'))}
R14_27=['r13','r15','r16','r17','r18','r19','r20','r21','r22','r23','r24','r25','r26','r27']
web=[r for r in rows if r['competition']=='arc-bench-web' and r['harness']=='oneshot' and r['package'] in R14_27]
tab=collections.defaultdict(list)
for r in web: tab[(r['package'],r['task'])].append(r)
def cost(r):
    e=est.get(r['run_id']); return e['own_cost_est_cny'] if e else None
print('=== flash per-task own cost estimate, r14-r27 (CNY) ===')
for t in ['keep','bookstack','stackoverflow','prestashop','12306','ctrip']:
    cs=[cost(x) for p in R14_27 for x in tab[(p,t)] if cost(x) is not None]
    print(f'{t:14s} n={len(cs)} mean={stt.mean(cs):.2f} median={stt.median(cs):.2f} min={min(cs):.2f} max={max(cs):.2f} sd={stt.stdev(cs):.2f}')
print('\n=== (a) medium + large combos, per sample in same package run ===')
summary={}
for m in ('keep','bookstack'):
    for l in ('12306','ctrip'):
        Ss=[];ps=[];cs=[]
        for p in R14_27:
            km=sorted(tab[(p,m)], key=lambda x: x['created_at_utc'] or ''); kl=sorted(tab[(p,l)], key=lambda x: x['created_at_utc'] or '')
            for i in range(min(len(km),len(kl))):
                pp=100*(km[i]['passed']+kl[i]['passed'])/(km[i]['task_total']+kl[i]['task_total'])
                cc=(cost(km[i]) or 0)+(cost(kl[i]) or 0)
                s=S(pp,cc) if cc>0 else None
                if s is None: continue
                Ss.append(s); ps.append(pp); cs.append(cc)
        lnS=[math.log(s) for s in Ss if s>0]; lnp=[math.log(p) for p,s in zip(ps,Ss) if s>0]; lnc=[math.log(c) for c,s in zip(cs,Ss) if s>0]
        vp=stt.pvariance(lnp); vc=stt.pvariance(lnc)
        n=len(lnp); mp=stt.mean(lnp); mc=stt.mean(lnc); cov=sum((a-mp)*(b-mc) for a,b in zip(lnp,lnc))/n
        tot=1.21*vp+0.01*vc-0.22*cov
        summary[f'{m}+{l}']=dict(n=len(Ss),S_mean=stt.mean(Ss),S_sd=stt.stdev(Ss),S_min=min(Ss),S_max=max(Ss),p_mean=stt.mean(ps),c_mean=stt.mean(cs),c_min=min(cs),c_max=max(cs),share_p=1.21*vp/tot,share_c=0.01*vc/tot)
        print(f'{m}+{l}: n={len(Ss)} p mean {stt.mean(ps):.1f} (sd {stt.stdev(ps):.1f}) | c mean {stt.mean(cs):.2f} [{min(cs):.2f},{max(cs):.2f}] | S mean {stt.mean(Ss):.1f} sd {stt.stdev(Ss):.1f} min {min(Ss):.1f} max {max(Ss):.1f} | var(lnS) share: p {1.21*vp/tot:.3f} c {0.01*vc/tot:.4f} cov {-0.22*cov/tot:.4f}')
json.dump(summary, open(f'{BASE}/score-combos.json','w'), indent=1)
