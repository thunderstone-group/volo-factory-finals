import json, os, csv, glob
R='~/projects/volo-factory-worktrees/lite-first-20260922/runs/lite-goal-20260922'
BASE='/private/tmp/claude-501/-Users-e0-7-projects/a492ba62-8f9a-4850-a1ad-d5f49589dfb2/scratchpad/agent-data'
acc=json.load(open(f'{R}/accounting.json'))
cost={}
for x in acc['settled_requests']:
    g=x['generation']; cost.setdefault(g,[]).append(float(x['amount_cny']))
rows=[]
for rec in sorted(glob.glob(f'{R}/generations/*/*/receipt.json')):
    cand=rec.split('/')[-3]; sample=rec.split('/')[-2]
    d=json.load(open(rec))
    u=d.get('usage') or {}
    app='keep' if sample.startswith('keep') else 'bookstack'
    rp=f'{R}/replays/{cand}/{sample}/result.json'
    passed=total=None
    if os.path.exists(rp):
        r=json.load(open(rp)); passed=r.get('passed'); total=r.get('total')
    g=f'{cand}/{sample}'
    c=cost.get(g)
    model=d.get('model') or ('deepseek-v4-flash' if cand=='baseline' and 'qwen' not in sample else None)
    rows.append({'kind':'local_independent_generation','candidate':cand,'sample':sample,'app':app,'model':model,
                 'passed':passed,'total':total,'seconds':d.get('seconds'),'success':d.get('success'),
                 'error':(d.get('error') or {}).get('message') if isinstance(d.get('error'),dict) else d.get('error'),
                 'calls':u.get('calls'),'completed_calls':u.get('completed_calls'),'failed_calls':u.get('failed_calls'),
                 'prompt_tokens_known':u.get('known_prompt_tokens'),'completion_tokens_known':u.get('known_completion_tokens'),
                 'cost_cny_settled':round(sum(c),6) if c else None,'cost_calls_settled':len(c) if c else 0,
                 'unknown_usage_calls':json.dumps(u.get('unknown_usage_calls')),
                 'source':rec.replace('~/projects/volo-factory-worktrees/','')})
json.dump(rows, open(f'{BASE}/lite-local-0922.json','w'), indent=1)
with open(f'{BASE}/lite-local-0922.csv','w',newline='') as f:
    w=csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
for r in rows:
    print(r['candidate'], r['sample'], r['model'], r['passed'], r['total'], r['seconds'], r['calls'], r['failed_calls'], r['cost_cny_settled'], r['cost_calls_settled'], (r['error'] or '')[:50])
print('unsettled', json.dumps(acc['unsettled_generations'])[:800])
print('rejected', json.dumps(acc['rejected_requests'])[:1500])
