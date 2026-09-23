import json, datetime, collections, statistics as stt, math, csv
import numpy as np
from scipy.optimize import nnls, least_squares
BASE='/private/tmp/claude-501/-Users-e0-7-projects/a492ba62-8f9a-4850-a1ad-d5f49589dfb2/scratchpad/agent-data'
rows={r['run_id']:r for r in json.load(open(f'{BASE}/runs-classified.json'))}
logs=json.load(open(f'{BASE}/logs-parsed.json'))
P=lambda s: datetime.datetime.strptime(s,'%Y-%m-%d %H:%M:%S')
GAP=10
calls=[]; win={}
for rid,lg in logs.items():
    r=rows.get(rid)
    if not r: continue
    if lg.get('meter_base') and lg.get('meter_capture') and r['cost_cny_meter'] is not None:
        win[rid]=(P(lg['meter_base']),P(lg['meter_capture']),float(r['cost_cny_meter']))
    if not lg.get('agent_start'): continue
    cur=P(lg['agent_start'])
    trs=lg.get('traces') or []
    if trs and all(t.get('elapsed') is None for t in trs) and lg.get('agent_end'):
        # redacted/old trace format: approximate completed work as one block ending at agent_end
        u=lg.get('usage') or {}
        ncomp=u.get('completed_calls')
        if ncomp is None: ncomp=(u.get('calls') or len(trs))-(u.get('failed_calls') or 0)
        dur=(P(lg['agent_end'])-cur).total_seconds()*0.95
        if ncomp and dur>0:
            calls.append({'rid':rid,'model':trs[0].get('model'),'t':P(lg['agent_end']),'e':dur,'status':'completed','call':'approx','n':ncomp})
        continue
    known=sum((t.get('elapsed') or 0) for t in trs)
    unk=[t for t in trs if t.get('elapsed') is None]
    for t in trs:
        e=t.get('elapsed')
        if e is None: continue
        done=cur+datetime.timedelta(seconds=e)
        calls.append({'rid':rid,'model':t.get('model'),'t':done,'e':e,'status':t.get('status'),'call':t.get('call'),'n':1})
        cur=done+datetime.timedelta(seconds=GAP)
    if unk and lg.get('agent_end'):
        rest=(P(lg['agent_end'])-P(lg['agent_start'])).total_seconds()-known-GAP*len(trs)
        u=lg.get('usage') or {}
        if rest>30 and (u.get('failed_calls') or 0) < len(trs):
            calls.append({'rid':rid,'model':unk[0].get('model'),'t':P(lg['agent_end']),'e':rest,'status':'completed','call':'approx-rest','n':len(unk)})
def ov(a,b): return a[0]<b[1] and b[0]<a[1]
# windows of runs without trace timing (non-oneshot harness or old trace format) are 'unmodelled traffic'
untraced=set(rid for rid in win if not any(c['rid']==rid for c in calls) and rows[rid]['harness']!='oneshot')
old_format=set()
completed=[c for c in calls if c['status']=='completed']
models=['deepseek-v4-flash','qwen3.7-plus']
def feats(w):
    b0,b1=w[0],w[1]; f=[]
    for m in models:
        cs=[c for c in completed if c['model']==m and b0<=c['t']<=b1]
        f+=[sum(c.get('n',1) for c in cs), sum(c['e'] for c in cs)]
    other=[c for c in completed if c['model'] not in models and b0<=c['t']<=b1]
    return f, len(other)
# runs without logs: their windows are unknown; approximate by status timestamps (started..finished) for overlap tests
import os
nolog=[]
for rid,r in rows.items():
    if rid in logs: continue
    if r['started_at_utc'] and r['finished_at_utc']:
        nolog.append((datetime.datetime.fromisoformat(r['started_at_utc']).replace(microsecond=0), datetime.datetime.fromisoformat(r['finished_at_utc']).replace(microsecond=0)))
solo={rid: (not any(ov(w,win[o]) for o in win if o!=rid)) and (not any(ov(w,nw) for nw in nolog)) for rid,w in win.items()}
use=[]
for rid,w in win.items():
    if any(ov(w,win[o]) for o in untraced|old_format if o!=rid): continue
    if any(ov(w,nw) for nw in nolog): continue
    f,no=feats(w)
    if no: continue
    if sum(f)==0: continue
    use.append((rid,f,w[2]))
QWEN_CALL=0.05; QWEN_S=69*8e-6
X=np.array([u[1][:2] for u in use],float); y=np.array([u[2]-(QWEN_CALL*u[1][2]+QWEN_S*u[1][3]) for u in use],float)
coef,_=nnls(X,y)
rob=least_squares(lambda c: X@c-y, np.maximum(coef,1e-4), bounds=(0,np.inf), loss='soft_l1', f_scale=0.5).x
names=['flash:per_call','flash:per_s']
print('windows used',len(use),'of',len(win))
print('NNLS  ',{n:round(float(c),6) for n,c in zip(names,coef)})
print('robust',{n:round(float(c),6) for n,c in zip(names,rob)})
res=y-X@rob
print('resid CNY: median %.3f p10 %.3f p90 %.3f; R2(nnls)=%.3f'%(np.median(res),np.percentile(res,10),np.percentile(res,90), 1-np.sum((y-X@coef)**2)/np.sum((y-y.mean())**2)))
# physical prior check: flash 152 tok/s * 9e-6 = 0.00137 CNY/s
fit={'flash_per_call':float(rob[0]),'flash_per_s':float(rob[1]),'qwen_per_call':QWEN_CALL,'qwen_per_s':QWEN_S}
# bootstrap CI for flash params
rng=np.random.default_rng(0); bs=[]
for _ in range(300):
    idx=rng.integers(0,len(y),len(y))
    c=least_squares(lambda c: X[idx]@c-y[idx], rob, bounds=(0,np.inf), loss='soft_l1', f_scale=0.5).x
    bs.append(c)
bs=np.array(bs)
print('bootstrap 90% CI flash per_call', np.percentile(bs[:,0],[5,95]).round(4), 'per_s', np.percentile(bs[:,1],[5,95]).round(6))
# validation on solo windows: delta vs modelled own cost
print('\nsolo-window validation (delta vs own modelled):')
for rid,w in win.items():
    if not solo[rid]: continue
    own=[c for c in completed if c['rid']==rid]
    if not own: continue
    est=sum((fit['flash_per_call']*c.get('n',1)+fit['flash_per_s']*c['e']) if c['model']=='deepseek-v4-flash' else (fit['qwen_per_call']*c.get('n',1)+fit['qwen_per_s']*c['e']) if c['model']=='qwen3.7-plus' else float('nan') for c in own)
    print('  ',rid, rows[rid]['task'], rows[rid]['model'][:12], 'delta',w[2],'est',round(est,3), 'calls',len(own))
# per-run own estimate
est_rows=[]
for rid,r in rows.items():
    own=[c for c in completed if c['rid']==rid]
    modelled=None
    if own and all(c['model'] in models for c in own):
        modelled=sum((fit['flash_per_call']*c.get('n',1)+fit['flash_per_s']*c['e']) if c['model']=='deepseek-v4-flash' else (fit['qwen_per_call']*c.get('n',1)+fit['qwen_per_s']*c['e']) for c in own)
    elif r['harness']=='oneshot' and logs.get(rid,{}).get('traces') and not own:
        modelled=0.0
    if r['harness']=='s8h-adaptive' and isinstance(logs.get(rid,{}).get('pi_usage'),dict):
        u=logs[rid]['pi_usage']; val=0.503*(u['input']*3e-6+u['output']*9e-6+u['cacheRead']*0.1e-6); src='pi_selfreport_x0.503'
    elif rid in win and solo.get(rid) and modelled is not None and win[rid][2] > 2*modelled+0.05:
        val=modelled; src='modelled_calls(meter_solo_contaminated_by_other_traffic)'
    elif rid in win and solo.get(rid):
        src='meter_solo'; val=win[rid][2]
    elif own and all(c['model'] in models for c in own):
        val=sum((fit['flash_per_call']*c.get('n',1)+fit['flash_per_s']*c['e']) if c['model']=='deepseek-v4-flash' else (fit['qwen_per_call']*c.get('n',1)+fit['qwen_per_s']*c['e']) for c in own)
        src='modelled_calls'
    elif r['harness'] in ('s8h-adaptive','pi-agent') and isinstance(logs.get(rid,{}).get('pi_usage'),dict):
        u=logs[rid]['pi_usage']; val=0.503*(u['input']*3e-6+u['output']*9e-6+u['cacheRead']*0.1e-6); src='pi_selfreport_x0.503'
    elif r['model'].startswith('glm'):
        val=float(r['cost_cny_meter'] or 0); src='meter_approx_glm'
    elif r['harness']=='oneshot' and logs.get(rid,{}).get('traces') and not own:
        val=0.0; src='no_completed_call'
    else:
        val=None; src='unavailable'
    est_rows.append({'run_id':rid,'own_cost_est_cny':None if val is None else round(val,4),'own_cost_source':src,'completed_calls':len(own),'completed_call_seconds':round(sum(c['e'] for c in own),1)})
json.dump({'fit':fit,'bootstrap_ci':{'flash_per_call':np.percentile(bs[:,0],[5,95]).tolist(),'flash_per_s':np.percentile(bs[:,1],[5,95]).tolist()},'n_windows':len(use)}, open(f'{BASE}/cost-fit.json','w'), indent=1)
json.dump(est_rows, open(f'{BASE}/own-cost-est.json','w'), indent=0)
print('sources', collections.Counter(e['own_cost_source'] for e in est_rows))
