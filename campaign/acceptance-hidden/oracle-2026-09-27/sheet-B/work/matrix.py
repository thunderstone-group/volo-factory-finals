"""Per-test pass matrix across calibration apps + short failure reason per (app, test)."""
import json, re, glob, os, sys
W = os.path.dirname(os.path.abspath(__file__))
ANSI = re.compile(r'\x1b\[[0-9;]*m')
apps = []
for f in sorted(glob.glob(f'{W}/final/*.json')):
    if f.endswith('.report.json') or os.path.basename(f).startswith('runsh-'): continue
    name = os.path.basename(f)[:-5]
    try: d = json.load(open(f))
    except Exception: continue
    rep = json.load(open(f[:-5] + '.report.json'))
    reasons = {}
    def walk(s):
        for sp in s.get('specs', []):
            for t in sp.get('tests', []):
                for r in t.get('results', []):
                    if r.get('status') != 'passed':
                        msgs = [ANSI.sub('', e.get('message', '')) for e in r.get('errors', [])]
                        m = next((x for x in msgs if 'Test timeout' not in x.split('\n')[0] or len(msgs) == 1), msgs[0] if msgs else '')
                        if len(msgs) > 1: m = msgs[1]
                        lines = [l.strip() for l in m.split('\n') if l.strip()]
                        keep = [l for l in lines if l.startswith(('Error', 'Locator', 'Expected', 'Received', '- waiting for')) or 'intercepts' in l][:5]
                        reasons[sp['title'].split(':')[0]] = ' | '.join(keep)[:400]
        for c in s.get('suites', []): walk(c)
    for s in rep.get('suites', []): walk(s)
    hidden = name.split('-')[1] if name.startswith('sheet-') else '17*'
    apps.append((name, hidden, d['tests'], reasons))
apps.sort(key=lambda a: (a[0].startswith('v1'), int(a[1]) if a[1].isdigit() else 0))
titles = [t['title'] for t in apps[0][2]]
print('app | hidden total | sheet-B pass')
for name, hidden, tests, _ in apps:
    print(f"{name} | {hidden} | {sum(t['status']=='pass' for t in tests)}/52")
print()
hdr = 'test'.ljust(14) + ' '.join(a[1].rjust(3) for a in apps)
print(hdr)
for i, title in enumerate(titles):
    key = title.split(':')[0]
    row = key.ljust(14) + ' '.join(('  .' if a[2][i]['status'] == 'pass' else '  X').rjust(3) for a in apps)
    print(row)
if len(sys.argv) > 1:
    for name, hidden, tests, reasons in apps:
        print('\n##', name)
        for k, v in reasons.items(): print(' ', k, '::', v)
