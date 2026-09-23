import json, collections, statistics as stt
BASE='/private/tmp/claude-501/-Users-e0-7-projects/a492ba62-8f9a-4850-a1ad-d5f49589dfb2/scratchpad/agent-data'
rows=json.load(open(f'{BASE}/runs-dataset-final.json'))
PK=['r13','r15','r16','r16g-ablation','r17','r18','r19','r20','r21','r22','r23','r24','r25','r26','r27','r28b']
TASKS=['keep','bookstack','stackoverflow','prestashop','12306','ctrip']
web=[r for r in rows if r['competition']=='arc-bench-web' and r['harness']=='oneshot' and r['package'] in PK]
tab=collections.defaultdict(list)
for r in web: tab[(r['package'],r['task'])].append(r)
sub={}
for r in web: sub.setdefault(r['package'],set()).add(r['submission_id'])
print('| 包 | 提交 id | Keep /32 | BookStack /34 | SO /66 | PS /86 | 12306 /135 | Ctrip /125 |')
print('|---|---|---|---|---|---|---|---|')
for p in PK:
    cells=[]
    for t in TASKS:
        lst=sorted(tab[(p,t)], key=lambda x: x['created_at_utc'] or '')
        cells.append(' / '.join((str(x['passed']) if x['delivered'] else '0*') for x in lst))
    label={'r13':'r13+r14（同包）'}.get(p,p)
    print(f"| {label} | {' '.join(sorted(sub[p]))} | "+' | '.join(cells)+' |')
lite=[r for r in rows if r['competition']=='arc-bench-lite' and r['harness']=='oneshot' and r['package'].startswith('r')]
lt=collections.defaultdict(list)
for r in lite: lt[(r['package'],r['task'])].append(r)
print()
print('| 包 | 提交 id | Lite Keep /32 | Lite BookStack /34 |')
print('|---|---|---|---|')
for p in ['r17','r18','r19','r21','r22','r23','r24','r25','r26','r27','r28b']:
    s=sorted(set(x['submission_id'] for t in ('keep','bookstack') for x in lt[(p,t)]))
    c=[' / '.join((str(x['passed']) if x['delivered'] else '0*') for x in sorted(lt[(p,t)], key=lambda x: x['created_at_utc'] or '')) for t in ('keep','bookstack')]
    print(f"| {p} | {' '.join(s)} | {c[0]} | {c[1]} |")
