"""Cross-app pass/fail matrix for one calibration tag: python3 matrix.py TAG"""
import json, re, sys, os
C = os.path.dirname(os.path.abspath(__file__)); tag = sys.argv[1]
apps = ['github-25-4310823c83f3', 'github-24-433d9936fb07', 'github-24-99a2bc046345', 'github-22-6dd494f9556b',
        'github-7-95ec6880ee7f', 'github-13-5450c3c63fe0', 'github-11-7e3f4dba7736']
# tests that never sign in as alice-dev (visitor or bob-reviewer only)
no_alice = {'REQ-5-1-1 S1', 'REQ-5-1-1 S2', 'REQ-5-1-2 S1', 'REQ-5-1-2 S2', 'REQ-5-1-2 S3', 'REQ-5-4 S2', 'REQ-6-1 S2',
            'REQ-6-2-1 S1', 'REQ-6-2-1 S2', 'REQ-6-2-1 S3', 'REQ-6-3-1 S1', 'REQ-6-3-1 S2', 'REQ-6-3-1 S3',
            'REQ-6-3-2 S1', 'REQ-6-3-3 S1', 'REQ-6-3-4 S1', 'REQ-6-6 S2'}
res = {}
for a in apps:
    p = f'{C}/results/{a}-{tag}.json'
    if os.path.exists(p):
        res[a] = {}
        for t in json.load(open(p))['tests']:
            m = re.match(r'(REQ-[\d-]+): .* - Scenario (\d+)', t['title'])
            res[a][f'{m.group(1)} S{m.group(2)}'] = t['status'] == 'pass'
keys = list(next(iter(res.values())).keys())
short = [a.split('-')[1] + '-' + a.split('-')[2][:4] for a in res]
print('%-14s %s' % ('', ' '.join('%8s' % s for s in short)))
for k in keys:
    print('%-14s %s %s' % (k, ' '.join('%8s' % ('pass' if res[a][k] else '.') for a in res), '' if k in no_alice else '[alice]'))
print('%-14s %s' % ('TOTAL', ' '.join('%8d' % sum(res[a].values()) for a in res)))
print('%-14s %s' % ('no-alice', ' '.join('%8d' % sum(v for k, v in res[a].items() if k in no_alice) for a in res)))
