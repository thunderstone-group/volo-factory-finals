import json, os, csv, glob, datetime, re, collections
BASE='/private/tmp/claude-501/-Users-e0-7-projects/a492ba62-8f9a-4850-a1ad-d5f49589dfb2/scratchpad/agent-data'
runs=json.load(open(f'{BASE}/runs-raw.json'))
logs=json.load(open(f'{BASE}/logs-parsed.json')) if os.path.exists(f'{BASE}/logs-parsed.json') else {}
ROUND={
 '97f8570c7279':'r00-callbudget','fe10afe427d2':'r01','11cd16489a3e':'r02','e3d00d4f3f4d':'r03','327a6085d81f':'r04',
 '9653af1b4ce2':'r05','f12d9a141dbb':'r06','d5b306cf33fc':'r07','5e94aaae8244':'r08','2935063ad7fe':'r09',
 '875c9522b2b5':'r10','6f422db9ee51':'r11(=r10 pkg)','a21ee9cafa56':'r12','e453f46c469c':'r13','e222408f516b':'r14(=r13 pkg)',
 '83fba30a434a':'r15','003f21fc67a7':'r16','85832f7d5293':'r16g-ablation','efdc725f67bf':'r17','87b8bf978a70':'r18',
 '3d5bb7a3cc1b':'r19','2108891b5706':'r20','0c0d0d2ce528':'r21','1a00f25debb4':'r22','fc8f01be8053':'r23','5189caeffa1b':'r24',
 '362bc22182ff':'r25','6d58dedfc0b5':'r26','f1f64dec4e4c':'r27','98cbfb0f4da4':'r28b','218a586c0c9a':'action-outcome',
 'd4fb5e687fa3':'r17','4f410b2e5ae7':'r18','0aa67e9eaa9b':'r19','4bb582f49fb8':'r21','af849656146c':'r22','f5cae5a99ffc':'r23',
 '465e2b38f27d':'r24','1a37de39c710':'r25','dc788a8eb93d':'r26','97082c9ded7c':'r27','a2aac0fad435':'r28b',
 'bb1916e26b45':'view-state','9331665b18ae':'lite-semantic-v5','64ca71667aa8':'lite-nested-seed-v24',
}
# package id: r13 and r14 same package; r10 and r11 same package
PKG={'r14(=r13 pkg)':'r13','r11(=r10 pkg)':'r10'}
TOTAL={'arc-bench-web--keep':32,'arc-bench-web--bookstack':34,'arc-bench-web--stackoverflow':66,'arc-bench-web--prestashop':86,
       'arc-bench-web--12306':135,'arc-bench-web--ctrip':125,'arc-bench-lite--keep':32,'arc-bench-lite--bookstack':34}
def harness(name):
    n=name.lower()
    if n.startswith('volo-oneshot') or n.startswith('volo-lite') or n.startswith('volo-action') or n.startswith('volo-view-state'): return 'oneshot'
    if n.startswith('s8h'): return 's8h-adaptive'
    if n.startswith('s2-'): return 'pi-agent'
    if n.startswith('volo-minimal'): return 'minimal-v2'
    if n.startswith('volo-thin'): return 'thin-source'
    return 'other'
def bj(s):
    if not s: return ''
    t=datetime.datetime.fromisoformat(s)+datetime.timedelta(hours=8)
    return t.strftime('%Y-%m-%d %H:%M:%S')
cut=datetime.datetime(2026,9,16,16,0)
rows=[]
for r in runs:
    if not r['finished_at'] or datetime.datetime.fromisoformat(r['finished_at'])<cut: continue
    st=json.load(open(f"{BASE}/status/one/{r['run_id']}.json")) if os.path.exists(f"{BASE}/status/one/{r['run_id']}.json") else {}
    lg=logs.get(r['run_id'],{})
    comp,task=r['requirement_id'].split('--',1) if '--' in r['requirement_id'] else (r['requirement_id'],'')
    total_task=TOTAL.get(r['requirement_id'])
    passed=r['passed'] or 0; failed=r['failed'] or 0
    delivered=(passed+failed)>0
    rnd=ROUND.get(r['submission_id'],'')
    tr=lg.get('traces') or []
    calls_completed=sum(1 for t in tr if t.get('status')=='completed')
    calls_failed=sum(1 for t in tr if t.get('status')=='failed')
    stream_err=sum(1 for t in tr if t.get('error_type')=='StreamError')
    cut1200=sum(1 for t in tr if t.get('status')=='failed' and (t.get('elapsed') or 0)>=1190)
    finish=[t.get('finish_reason') for t in tr]
    models_used=sorted(set(t.get('model') for t in tr if t.get('model')))
    elapsed_completed=sum((t.get('elapsed') or 0) for t in tr if t.get('status')=='completed')
    elapsed_all=sum((t.get('elapsed') or 0) for t in tr)
    usage=lg.get('usage') or {}
    created=st.get('created_at'); started=st.get('started_at')
    queue_s=None
    if created and started:
        queue_s=(datetime.datetime.fromisoformat(started)-datetime.datetime.fromisoformat(created)).total_seconds()
    wall_s=None
    if started and r['finished_at']:
        wall_s=(datetime.datetime.fromisoformat(r['finished_at'])-datetime.datetime.fromisoformat(started)).total_seconds()
    rows.append({
        'run_id':r['run_id'],'submission_id':r['submission_id'],'submission_name':r['display_name'],'round':rnd,
        'package':PKG.get(rnd,rnd),'harness':harness(r['display_name']),
        'competition':comp,'task':task,'model':r['model_name'],'status':r['status'],
        'passed':passed,'failed':failed,'reported_total':passed+failed,'task_total':total_task,
        'pass_rate_task_pct': round(100*passed/total_task,2) if total_task else (r['pass_rate']),
        'delivered':delivered,
        'cost_cny_meter':r['cost']['amount'],'tokens_meter':r['tokens'],'agent_duration_s':r['duration_seconds'],
        'queue_s':queue_s,'wall_s':wall_s,
        'created_at_utc':created,'started_at_utc':started,'finished_at_utc':r['finished_at'],'finished_at_bj':bj(r['finished_at']),
        'failure_reason':r['failure_reason'],
        'log_fetched': bool(lg),
        'agent_exit':lg.get('agent_exit'),'workers':lg.get('workers'),
        'meter_base_utc':lg.get('meter_base'),'meter_capture_utc':lg.get('meter_capture'),
        'agent_start_utc':lg.get('agent_start'),'agent_end_utc':lg.get('agent_end'),
        'calls_traced':len(tr),'calls_completed':calls_completed,'calls_failed':calls_failed,
        'stream_errors':stream_err,'stream_cut_ge1190s':cut1200,
        'finish_reasons':'|'.join(str(x) for x in finish),'models_used':'|'.join(models_used),
        'fallback_model':usage.get('fallback_model'),
        'elapsed_completed_s':round(elapsed_completed,1),'elapsed_all_calls_s':round(elapsed_all,1),
        'oneshot_failed':' || '.join(lg.get('oneshot_failed') or []),
        'kw':json.dumps(lg.get('kw') or {}),
        'template_timeout':lg.get('template_timeout'),
        'pi_usage':json.dumps(lg.get('pi_usage')) if lg.get('pi_usage') else '',
    })
json.dump(rows, open(f'{BASE}/runs-dataset.json','w'), indent=0, default=str)
with open(f'{BASE}/runs-dataset.csv','w',newline='') as f:
    w=csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
print(len(rows), sum(1 for r in rows if r['log_fetched']))
