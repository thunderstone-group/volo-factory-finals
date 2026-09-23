import json, statistics as stt, collections, math
BASE='/private/tmp/claude-501/-Users-e0-7-projects/a492ba62-8f9a-4850-a1ad-d5f49589dfb2/scratchpad/agent-data'
rows=json.load(open(f'{BASE}/runs-dataset.json'))
ORDER=['r13','r15','r16','r16g-ablation','r17','r18','r19','r20','r21','r22','r23','r24','r25','r26','r27','r28b']
TASKS=['keep','bookstack','stackoverflow','prestashop','12306','ctrip']
def sd(x): return stt.stdev(x) if len(x)>1 else float('nan')
web=[r for r in rows if r['competition']=='arc-bench-web' and r['status'] in('FAILED','PASSED') and r['harness']=='oneshot' and r['package'] in ORDER]
# by package x task
tab=collections.defaultdict(list)
for r in web: tab[(r['package'],r['task'])].append(r)
print('pkg', *TASKS, sep='\t')
for p in ORDER:
    cells=[]
    for t in TASKS:
        xs=[x['passed'] for x in tab.get((p,t),[])]
        cells.append('/'.join(str(v) for v in xs))
    print(p, *cells, sep='\t')
# r14-r27 packages (r13 pkg == r14) pooled per task
R14_27=['r13','r15','r16','r17','r18','r19','r20','r21','r22','r23','r24','r25','r26','r27']
print('\npooled r14-r27 packages (incl r13 twin), per task: n mean min max sd (tests), mean pct, sd pct, zero-deliveries')
for t in TASKS:
    xs=[x for p in R14_27 for x in tab.get((p,t),[])]
    v=[x['passed'] for x in xs]; N=xs[0]['task_total']
    z=sum(1 for x in xs if not x['delivered'])
    print(t, len(v), round(stt.mean(v),1), min(v), max(v), round(sd(v),1), round(100*stt.mean(v)/N,1), round(100*sd(v)/N,1), z)
# within-package SD (pooled) vs between-package
print('\nwithin-package pooled SD and between adjacent package mean diffs (tests)')
for t in TASKS:
    ss=0; df=0; ranges=[]
    means=[]
    for p in R14_27:
        v=[x['passed'] for x in tab.get((p,t),[])]
        if len(v)>=2:
            m=stt.mean(v); ss+=sum((a-m)**2 for a in v); df+=len(v)-1; ranges.append(max(v)-min(v))
        if v: means.append((p,stt.mean(v)))
    pooled=math.sqrt(ss/df) if df else float('nan')
    adj=[abs(means[i+1][1]-means[i][1]) for i in range(len(means)-1)]
    N=TASKS and tab[(R14_27[1],t)][0]['task_total']
    print(t, 'pooledSD', round(pooled,2), 'pp', round(100*pooled/N,1), 'median range', stt.median(ranges), 'max range', max(ranges), '| adj mean diff median', round(stt.median(adj),1), 'max', round(max(adj),1), 'n pkgs', len(means))

print('\n=== robust: excluding catastrophic samples (passed < 1/3 of task pooled median) ===')
for t in TASKS:
    allv=[x['passed'] for p in R14_27 for x in tab.get((p,t),[])]
    med=stt.median(allv); thr=med/3
    ss=0; df=0; cat=0; n=0
    for p in R14_27:
        v=[x['passed'] for x in tab.get((p,t),[])]
        n+=len(v)
        cat+=sum(1 for a in v if a<thr)
        v2=[a for a in v if a>=thr]
        if len(v2)>=2:
            m=stt.mean(v2); ss+=sum((a-m)**2 for a in v2); df+=len(v2)-1
    pooled=math.sqrt(ss/df)
    N=tab[(R14_27[1],t)][0]['task_total']
    print(t, 'median', med, 'catastrophic', cat, 'of', n, f'({100*cat/n:.0f}%)', 'pooledSD_ex', round(pooled,2), 'tests =', round(100*pooled/N,1),'pp', ' single-sample 95% MDD ~', round(1.96*math.sqrt(2)*pooled,1),'tests', round(100*1.96*math.sqrt(2)*pooled/N,1),'pp', ' pair-vs-pair MDD ~', round(1.96*pooled,1), 'tests')

# six-task average per sample (task-equal mean) using a/b order by created time
print('\n=== six-task task-equal average per sample ===')
samples=collections.defaultdict(lambda: collections.defaultdict(list))
for r in web:
    samples[r['package']][r['task']].append(r)
avgs={}
for p in R14_27:
    per=[]
    # sort each task's runs by created time; sample index = order
    ks=[]
    for t in TASKS:
        lst=sorted(samples[p][t], key=lambda x: x['created_at_utc'] or '')
        ks.append(lst)
    nsamp=min(len(l) for l in ks)
    vals=[]
    for i in range(nsamp):
        vals.append(stt.mean(100*ks[j][i]['passed']/ks[j][i]['task_total'] for j in range(6)))
    avgs[p]=vals
    print(p, [round(v,1) for v in vals])
ss=0;df=0
for p,v in avgs.items():
    if len(v)>=2:
        m=stt.mean(v); ss+=sum((a-m)**2 for a in v); df+=len(v)-1
print('pooled within-package SD of six-task avg', round(math.sqrt(ss/df),2),'pp; package means:', [round(stt.mean(v),1) for v in avgs.values()])
pm=[stt.mean(v) for v in avgs.values()]
print('SD of package means', round(stt.stdev(pm),2), 'range', round(min(pm),1), round(max(pm),1))
