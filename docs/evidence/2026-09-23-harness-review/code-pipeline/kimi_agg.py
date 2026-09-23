import json, glob, os
R = os.path.expanduser('~/projects/volo-factory-worktrees/lite-first-20260922/runs/lite-goal-20260922')
rows = []
for rec in sorted(glob.glob(R + '/generations/*/*/receipt.json')):
    d = os.path.dirname(rec)
    t = json.load(open(d + '/trace.json')); r = json.load(open(rec))
    atts = t.get('attempts', [])
    if not atts or 'highspeed' not in atts[0]['model']:
        continue
    model_s = sum(a.get('elapsed_seconds') or 0 for a in atts)
    cost = 0; out = 0; reason = 0; inp = 0
    for a in atts:
        ue = (a.get('usage_events') or [{}])[-1]
        pt = ue.get('prompt_tokens') or 0; ct = ue.get('completion_tokens') or 0
        cached = (ue.get('prompt_tokens_details') or {}).get('cached_tokens') or ue.get('cached_tokens') or 0
        rt = (ue.get('completion_tokens_details') or {}).get('reasoning_tokens') or 0
        cost += (pt - cached) * 13e-6 + cached * 2.6e-6 + ct * 54e-6
        out += ct; reason += rt; inp += pt
    draft = atts[0]
    dct = (draft.get('usage') or {}).get('completion_tokens')
    rows.append((os.path.relpath(d, R + '/generations'), r['seconds'], model_s, cost, out, reason, inp, dct, draft.get('elapsed_seconds')))
print(f"{'run':45} {'wall':>7} {'model%':>6} {'draft_s':>7} {'draft_ct':>8} {'out':>7} {'reason%':>7} {'cost':>6} {'out$%':>6}")
for name, wall, ms, cost, out, rea, inp, dct, ds in rows:
    outc = out * 54e-6
    print(f"{name:45} {wall:7.1f} {100*ms/wall:6.1f} {ds or 0:7.1f} {dct or 0:8} {out:7} {100*rea/max(out,1):7.1f} {cost:6.3f} {100*outc/max(cost,1e-9):6.1f}")
