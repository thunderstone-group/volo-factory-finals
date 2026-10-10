"""Calibrate the merged oracle: totals vs hidden per app (Spearman, MAE), per-test agreement with the two labelled GitHub
apps, and per-test pass rates across apps. usage: calib.py TASK TAG"""
import json, sys, glob, os, re, collections
TASK, TAG = sys.argv[1], sys.argv[2]
SP = os.path.dirname(os.path.abspath(__file__))
def rank(xs):
    s = sorted(range(len(xs)), key=lambda i: xs[i]); r = [0]*len(xs); i = 0
    while i < len(s):
        j = i
        while j+1 < len(s) and xs[s[j+1]] == xs[s[i]]: j += 1
        for k in range(i, j+1): r[s[k]] = (i+j)/2
        i = j+1
    return r
def spearman(a, b):
    ra, rb = rank(a), rank(b); n = len(a); ma, mb = sum(ra)/n, sum(rb)/n
    num = sum((x-ma)*(y-mb) for x, y in zip(ra, rb)); den = (sum((x-ma)**2 for x in ra)*sum((y-mb)**2 for y in rb))**.5
    return num/den if den else float('nan')
def key_of(title):
    m = re.match(r'^(REQ-[\d-]+?)(?::| S)(?:.*Scenario (\d+)|(\d+))', title)
    if not m: return None
    return f"{m.group(1)} S{m.group(2) or m.group(3)}"
rows = []; per = collections.defaultdict(list)
for f in sorted(g for g in glob.glob(f"{SP}/results/{TAG}/{TASK}-*.json") if not g.endswith("per-test.json")):
    name = os.path.basename(f)[:-5]; hidden = int(name.split('-')[1])
    d = json.load(open(f)); tests = d['tests']
    c = collections.Counter(t['status'] for t in tests)
    rows.append((name, hidden, c.get('pass', 0), len(tests), dict(c)))
    for t in tests: per[key_of(t['title']) or t['title']].append((name, t['status'] == 'pass'))
rows.sort(key=lambda r: r[1])
for r in rows: print(f"{r[0]:32s} hidden {r[1]:3d}  oracle {r[2]:3d}/{r[3]}  {r[4]}")
H = [r[1] for r in rows if r[1] > 1]; O = [r[2] for r in rows if r[1] > 1]
if len(H) > 2:
    print("spearman", round(spearman(O, H), 3), "MAE", round(sum(abs(o-h) for o, h in zip(O, H))/len(H), 1), "mean diff (oracle-hidden)", round(sum(o-h for o, h in zip(O, H))/len(H), 1))
if TASK == 'github':
    for app, lab in (('github-11-7e3f4dba7736', 'github-labels-sub4-app11.json'), ('github-13-5450c3c63fe0', 'github-labels-sub5-app13.json')):
        f = f"{SP}/results/{TAG}/{app}.json"
        if not os.path.exists(f): continue
        labels = {x['key']: x['hidden'] == 'pass' for x in json.load(open(f"{SP}/{lab}"))}
        got = {key_of(t['title']): t['status'] == 'pass' for t in json.load(open(f))['tests']}
        conf = collections.Counter((labels.get(k), got.get(k)) for k in labels)
        agree = sum(v for (h, o), v in conf.items() if h == o)
        print(app, "agreement", agree, "/", len(labels), "hidden-pass&oracle-pass", conf[(True, True)], "hidden-pass&oracle-fail", conf[(True, False)], "hidden-fail&oracle-pass", conf[(False, True)])
json.dump({k: v for k, v in per.items()}, open(f"{SP}/results/{TAG}/{TASK}-per-test.json", "w"), indent=0)
