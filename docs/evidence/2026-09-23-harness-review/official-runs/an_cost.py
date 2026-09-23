import json, datetime, collections, statistics as stt, math, sys
import numpy as np
from scipy.optimize import nnls, least_squares
BASE='/private/tmp/claude-501/-Users-e0-7-projects/a492ba62-8f9a-4850-a1ad-d5f49589dfb2/scratchpad/agent-data'
rows={r['run_id']:r for r in json.load(open(f'{BASE}/runs-dataset.json'))}
logs=json.load(open(f'{BASE}/logs-parsed.json'))
P=lambda s: datetime.datetime.strptime(s,'%Y-%m-%d %H:%M:%S')
GAP=10
calls=[]  # (run_id, model, t_complete, elapsed, status)
win={}
for rid,lg in logs.items():
    r=rows.get(rid)
    if not r or r['status'] not in ('FAILED','PASSED'): continue
    if lg.get('meter_base') and lg.get('meter_capture') and r['cost_cny_meter'] is not None:
        win[rid]=(P(lg['meter_base']),P(lg['meter_capture']),float(r['cost_cny_meter']))
    if not lg.get('agent_start'): continue
    cur=P(lg['agent_start'])
    for t in lg.get('traces') or []:
        e=t.get('elapsed')
        if e is None: continue
        done=cur+datetime.timedelta(seconds=e)
        calls.append((rid,t.get('model'),done,e,t.get('status')))
        cur=done+datetime.timedelta(seconds=GAP)
print('runs with windows',len(win),'calls',len(calls), collections.Counter((c[1],c[4]) for c in calls))
# only oneshot-harness runs have traces; other harness runs in window are unmodelled -> mark windows that overlap a non-oneshot run
nonmodel=[rid for rid,r in rows.items() if r['harness']!='oneshot' and r['status'] in('FAILED','PASSED')]
def overlaps(a,b): return a[0]<b[1] and b[0]<a[1]
flag={}
for rid,w in win.items():
    bad=False
    for o in nonmodel:
        if o in win and o!=rid and overlaps(w,win[o]): bad=True
    flag[rid]=bad
completed=[c for c in calls if c[4]=='completed']
models=sorted(set(c[1] for c in completed))
print('models',models)
# design: for each window, features per model: count, sum elapsed
ids=[rid for rid in win if not flag[rid] and rows[rid]['harness']=='oneshot' and logs[rid].get('traces')]
X=[];y=[]
for rid in ids:
    b0,b1,d=win[rid]
    f=[]
    for m in models:
        cs=[c for c in completed if c[1]==m and b0<=c[2]<=b1]
        f+= [len(cs), sum(c[3] for c in cs)]
    X.append(f); y.append(d)
X=np.array(X,float); y=np.array(y,float)
print('n windows used',len(ids))
coef,res=nnls(X,y)
names=[f'{m}:{k}' for m in models for k in ('per_call','per_s')]
print('NNLS', {n:round(c,6) for n,c in zip(names,coef)})
# robust (soft_l1) fit starting from nnls
def fun(c): return X@c - y
r=least_squares(fun, np.maximum(coef,1e-6), bounds=(0,np.inf), loss='soft_l1', f_scale=0.5)
print('robust', {n:round(c,6) for n,c in zip(names,r.x)})
resid=y-X@r.x
print('resid median',round(float(np.median(resid)),3),'p10',round(float(np.percentile(resid,10)),3),'p90',round(float(np.percentile(resid,90)),3))
json.dump({'names':names,'nnls':coef.tolist(),'robust':r.x.tolist(),'n':len(ids)}, open(f'{BASE}/cost-fit.json','w'))
