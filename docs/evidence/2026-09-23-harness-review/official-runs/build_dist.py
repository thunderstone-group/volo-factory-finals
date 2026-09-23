import json, collections, statistics as stt, csv
BASE='/private/tmp/claude-501/-Users-e0-7-projects/a492ba62-8f9a-4850-a1ad-d5f49589dfb2/scratchpad/agent-data'
rows=json.load(open(f'{BASE}/runs-classified.json'))
est={e['run_id']:e for e in json.load(open(f'{BASE}/own-cost-est.json'))}
# merge own-cost into final dataset csv
fin=[]
for r in rows:
    e=est.get(r['run_id'],{})
    r2=dict(r); r2['own_cost_est_cny']=e.get('own_cost_est_cny'); r2['own_cost_source']=e.get('own_cost_source')
    fin.append(r2)
cols=['run_id','submission_id','submission_name','round','package','harness','competition','task','model','status','passed','failed','reported_total','task_total','pass_rate_task_pct','delivered','outcome_class',
      'cost_cny_meter','own_cost_est_cny','own_cost_source','tokens_meter','agent_duration_s','queue_s','wall_s','created_at_utc','started_at_utc','finished_at_utc','finished_at_bj',
      'failure_reason','oneshot_failed','agent_exit','workers','calls_traced','calls_completed','calls_failed','stream_errors','stream_cut_ge1190s','finish_reasons','models_used','fallback_model',
      'elapsed_completed_s','elapsed_all_calls_s','kw','template_timeout','pi_usage','log_fetched','meter_base_utc','meter_capture_utc','agent_start_utc','agent_end_utc']
with open(f'{BASE}/runs-dataset.csv','w',newline='') as f:
    w=csv.DictWriter(f, fieldnames=cols, extrasaction='ignore'); w.writeheader(); w.writerows(fin)
json.dump(fin, open(f'{BASE}/runs-dataset-final.json','w'), indent=0, default=str)
# distribution table
g=collections.defaultdict(list)
for r in fin:
    g[(r['competition'],r['task'],r['model'],r['harness'],r['package'] or r['submission_name'])].append(r)
out=[]
for k,L in g.items():
    ps=[x['passed'] for x in L]; N=L[0]['task_total'] or (L[0]['reported_total'] or 1)
    cs=[x['own_cost_est_cny'] for x in L if x['own_cost_est_cny'] is not None]
    ds=[x['agent_duration_s'] for x in L if x['agent_duration_s'] is not None]
    out.append({'competition':k[0],'task':k[1],'model':k[2],'harness':k[3],'package':k[4],'n':len(L),
        'passed_list':'/'.join(str(p) for p in ps),'mean_passed':round(stt.mean(ps),2),'min':min(ps),'max':max(ps),'sd':round(stt.stdev(ps),2) if len(ps)>1 else '',
        'task_total':N,'mean_pct':round(100*stt.mean(ps)/N,1) if N else '',
        'undelivered':sum(1 for x in L if not x['delivered']),
        'own_cost_mean':round(stt.mean(cs),3) if cs else '','own_cost_min':round(min(cs),3) if cs else '','own_cost_max':round(max(cs),3) if cs else '',
        'meter_cost_mean':round(stt.mean([x['cost_cny_meter'] for x in L if x['cost_cny_meter'] is not None]),3) if any(x['cost_cny_meter'] is not None for x in L) else '',
        'agent_s_median':stt.median(ds) if ds else '','run_ids':' '.join(x['run_id'] for x in L)})
out.sort(key=lambda x:(x['competition'],x['task'],x['model'],x['package']))
with open(f'{BASE}/dist-task-model-package.csv','w',newline='') as f:
    w=csv.DictWriter(f, fieldnames=list(out[0].keys())); w.writeheader(); w.writerows(out)
print(len(fin), len(out))
