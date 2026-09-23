import json, glob, os, sys
R = os.path.expanduser('~/projects/volo-factory-worktrees/lite-first-20260922/runs/lite-goal-20260922')
rows = []
for rec in sorted(glob.glob(R + '/generations/*/*/receipt.json')):
    d = os.path.dirname(rec)
    try:
        receipt = json.load(open(rec))
    except Exception as e:
        continue
    tr = os.path.join(d, 'trace.json')
    if not os.path.exists(tr):
        continue
    t = json.load(open(tr))
    calls = []
    for a in t.get('attempts', []):
        ue = a.get('usage_events') or []
        last = ue[-1] if ue else {}
        rt = (last.get('completion_tokens_details') or {}).get('reasoning_tokens')
        obs = a.get('stream_observation') or {}
        calls.append(dict(call=a['call'], status=a['status'], model=a['model'], finish=a.get('finish_reason'),
                          el=a.get('elapsed_seconds'), pt=a['usage'].get('prompt_tokens'), ct=a['usage'].get('completion_tokens'),
                          rt=rt, cc=len(a.get('content') or ''), rc=obs.get('reasoning_chars'), err=a.get('error_type'),
                          http=a.get('http_status'), msgs=len(a.get('messages', []))))
    model_s = sum(c['el'] or 0 for c in calls)
    total = receipt.get('seconds')
    sm = t.get('smoke') or {}
    rep = sm.get('repair')
    rows.append((os.path.relpath(d, R + '/generations'), total, model_s, calls, receipt.get('success'), (receipt.get('error') or {}).get('message','')[:160], rep if not isinstance(rep, dict) else {k: rep[k] for k in rep if k in ('accepted','reason','files')}))
for name, total, model_s, calls, ok, err, rep in rows:
    print(f"== {name}: total={total}s model={model_s:.1f}s other={(total or 0)-model_s:.1f}s success={ok} {err}")
    for c in calls:
        print(f"   call{c['call']} {c['status']:9} {c['model'][:26]:26} finish={c['finish']} el={c['el']} pt={c['pt']} ct={c['ct']} reason_tok={c['rt']} content_chars={c['cc']} reasoning_chars={c['rc']} err={c['err']} http={c['http']} msgs={c['msgs']}")
    print('   repair:', json.dumps(rep)[:400] if rep is not None else None)
