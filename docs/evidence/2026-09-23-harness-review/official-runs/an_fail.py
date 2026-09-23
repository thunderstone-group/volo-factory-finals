import json, collections, statistics as stt
BASE='/private/tmp/claude-501/-Users-e0-7-projects/a492ba62-8f9a-4850-a1ad-d5f49589dfb2/scratchpad/agent-data'
rows=json.load(open(f'{BASE}/runs-dataset.json'))
logs=json.load(open(f'{BASE}/logs-parsed.json'))
# task medians for catastrophic threshold (delivered runs, oneshot, flash web/lite)
med={}
for comp_task in set((r['competition'],r['task']) for r in rows):
    v=[r['passed'] for r in rows if (r['competition'],r['task'])==comp_task and r['delivered'] and r['status'] in('FAILED','PASSED')]
    if v: med[comp_task]=stt.median(v)
def classify(r):
    lg=logs.get(r['run_id'],{})
    msgs=' '.join(lg.get('oneshot_failed') or [])
    fin=(r['finish_reasons'] or '')
    kw=json.loads(r['kw'] or '{}')
    fr=r['failure_reason'] or ''
    if r['delivered']:
        m=med.get((r['competition'],r['task']))
        if m and r['passed'] < m/3: return 'delivered_whole_app_fail'
        return 'delivered'
    # not delivered
    if 'content_filter' in msgs or 'content_filter' in fin: return 'nd_content_filter'
    if 'StreamError' in msgs: return 'nd_stream_error_exhausted'
    if 'no file blocks' in msgs or 'stream produced no content' in msgs: return 'nd_empty_draft'
    if 'call limit' in msgs: return 'nd_call_budget'
    if any(k in msgs for k in ('unterminated','duplicate file block','without an open block','outside file blocks')): return 'nd_protocol_parse'
    if 'template' in fr or lg.get('template_timeout') or 'template must contain' in msgs or 'output directory' in msgs: return 'nd_template_or_output_contract'
    if 'did not produce any executed Playwright' in fr: return 'nd_no_tests_executed'
    if lg.get('agent_exit') not in (None,0): return 'nd_agent_exit_other'
    if not lg: return 'nd_unknown_no_log'
    return 'nd_other'
out=[]
for r in rows:
    if r['status'] not in ('FAILED','PASSED'): continue
    c=classify(r); r2=dict(r); r2['outcome_class']=c; out.append(r2)
json.dump(out, open(f'{BASE}/runs-classified.json','w'), indent=0, default=str)
# per model run-level outcome table (oneshot harness only, since 09-17)
print('RUN-LEVEL outcomes by primary model (all harnesses):')
g=collections.defaultdict(collections.Counter)
for r in out: g[(r['model'])][r['outcome_class']]+=1
for m,c in sorted(g.items()):
    n=sum(c.values()); print(' ',m,n,dict(c))
# call-level transport stats by the model actually called (from traces)
print('\nCALL-LEVEL by model actually called (oneshot traces):')
cs=collections.defaultdict(collections.Counter)
for r in out:
    lg=logs.get(r['run_id'],{})
    for t in lg.get('traces') or []:
        m=t.get('model') or '?'
        cs[m]['calls']+=1
        st=t.get('status'); et=t.get('error_type'); fr=t.get('finish_reason'); e=t.get('elapsed') or 0
        if st=='completed': cs[m]['completed']+=1
        if st=='failed': cs[m]['failed']+=1
        if et: cs[m]['err:'+et]+=1
        if st=='failed' and e>=1190: cs[m]['failed_ge1190s']+=1
        if fr: cs[m]['finish:'+fr]+=1
        if st is None: cs[m]['status_unlogged']+=1
for m,c in sorted(cs.items()):
    print(' ',m,dict(c))
