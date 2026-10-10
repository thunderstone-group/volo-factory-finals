"""Calibrate a written Sheet suite on the eight apps with known hidden scores: per-app counts, own-code errors,
Spearman rank correlation of pass count with the hidden score. usage: calib.py PREFIX (files PREFIX-<app>.json)"""
import json, sys, collections
hid = {'95ec': 24, '5450': 29, 'e53e': 30, '3f31': 64, 'b956': 73, '4310': 75, }
def rank(xs):
    s = sorted(range(len(xs)), key=lambda i: xs[i]); r = [0] * len(xs); i = 0
    while i < len(s):
        j = i
        while j + 1 < len(s) and xs[s[j + 1]] == xs[s[i]]: j += 1
        for k in range(i, j + 1): r[s[k]] = (i + j) / 2
        i = j + 1
    return r
def spearman(a, b):
    ra, rb = rank(a), rank(b); n = len(a); ma, mb = sum(ra) / n, sum(rb) / n
    num = sum((x - ma) * (y - mb) for x, y in zip(ra, rb))
    den = (sum((x - ma) ** 2 for x in ra) * sum((y - mb) ** 2 for y in rb)) ** .5
    return num / den if den else float('nan')
P, H, E = [], [], []
for app, h in hid.items():
    try: sc = json.load(open(f'{sys.argv[1]}-{app}.json'))['scenarios']
    except Exception as e: print(app, 'missing', e); continue
    c = collections.Counter()
    for s in sc:
        if s['id'].startswith('helper:'): continue
        o = s.get('observation', '')
        c[s['status'] if s['status'] != 'error' else ('own' if o.startswith(("The test's own", "The test used", "The test file")) else 'blocked' if o.startswith('Blocked') else 'err')] += 1
    print(app, h, dict(c)); P.append(c['pass']); H.append(h); E.append(sum(v for k, v in c.items() if k not in ('pass', 'fail')))
print('spearman', round(spearman(P, H), 3), 'mean errors', round(sum(E) / max(1, len(E)), 1))
