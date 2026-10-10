"""Markdown pieces for calibration.md: per-app totals, per-test matrix, per-app failure reasons."""
import json, re, glob, os
W = os.path.dirname(os.path.abspath(__file__))
ANSI = re.compile(r'\x1b\[[0-9;]*m')
V1_PASS = set("REQ-3-2-1 S4|REQ-3-2-2 S1|REQ-3-2-2 S2|REQ-3-2-2 S3|REQ-3-2-2 S5|REQ-3-2-2 S7|REQ-4-1-1 S1|REQ-4-1-1 S3|REQ-4-1-1 S4|REQ-4-1-1 S5|REQ-4-1-2 S2|REQ-4-2-1 S1|REQ-4-2-1 S3|REQ-4-2-2 S2|REQ-4-2-2 S3|REQ-4-2-2 S4|REQ-4-2-2 S5".split('|'))

def reasons(report):
    out = {}
    def walk(s):
        for sp in s.get('specs', []):
            for t in sp.get('tests', []):
                for r in t.get('results', []):
                    if r.get('status') != 'passed':
                        msgs = [ANSI.sub('', e.get('message', '')) for e in r.get('errors', [])]
                        m = msgs[1] if len(msgs) > 1 else (msgs[0] if msgs else '')
                        lines = [l.strip() for l in m.split('\n') if l.strip()]
                        keep = [l for l in lines if l.startswith(('Expected', 'Received', '- waiting for')) or 'intercepts' in l or (l.startswith('Error') and 'Test timeout' not in l)][:4]
                        out[sp['title'].split(':')[0]] = ' / '.join(k.replace('|', '\\|') for k in keep)[:260]
        for c in s.get('suites', []): walk(c)
    for s in report.get('suites', []): walk(s)
    return out

apps = []
for f in glob.glob(f'{W}/final/*.json'):
    if f.endswith('.report.json') or os.path.basename(f).startswith('runsh-'): continue
    name = os.path.basename(f)[:-5]
    d = json.load(open(f)); rep = json.load(open(f[:-5] + '.report.json'))
    hidden = int(name.split('-')[1]) if name.startswith('sheet-') else -1
    apps.append((hidden, name, d['tests'], reasons(rep)))
apps.sort()
print('| 应用 | 隐藏总分(100) | 本部分通过(52) |\n|---|---|---|')
for hidden, name, tests, _ in apps:
    p = sum(t['status'] == 'pass' for t in tests)
    extra = ''
    if hidden < 0:
        agree = sum((t['title'].split(':')[0] in V1_PASS) == (t['status'] == 'pass') for t in tests)
        extra = f'（v1 带逐条标签：隐藏本部分过 17，逐条一致 {agree}/52）'
    print(f"| {name} | {hidden if hidden >= 0 else '42（v1 题）'} | {p}{extra} |")
print()
cols = [a for a in apps]
SHORT = {'3ba6769a64c2': '78a', 'ed1ef8fb5d78': '78b', '2c8e9b1f5e5f': '79a', '4c98ff3ad8b3': '79b', '538e10fe0724': '80a', 'f49ba294f647': '80b'}
lab = lambda a: 'v1' if a[0] < 0 else SHORT.get(a[1].split('-')[-1], str(a[0]))
print('| 场景 | ' + ' | '.join(lab(a) for a in cols) + ' |')
print('|---|' + '---|' * len(cols))
for i, t in enumerate(cols[0][2]):
    key = t['title'].split(':')[0]
    row = []
    for a in cols:
        ok = a[2][i]['status'] == 'pass'
        row.append('.' if ok else 'X')
    print(f'| {key} | ' + ' | '.join(row) + ' |')
print()
for hidden, name, tests, rs in apps:
    if not rs: continue
    print(f'### {name}')
    for k, v in rs.items(): print(f'- {k}: {v}')
    print()
