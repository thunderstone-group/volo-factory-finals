"""Pass/fail matrix (tests x apps) and one-line failure reasons from results/<tag>/<app>/report.json."""
import json, os, re, sys
base = sys.argv[1]
ANSI = re.compile(r'\x1b\[[0-9;]*m')
apps = sorted([d for d in os.listdir(base) if os.path.isdir(os.path.join(base, d)) and os.path.exists(os.path.join(base, d, 'report.json'))],
              key=lambda s: (int(s.split('-')[1]), s))
rows, order = {}, []
for app in apps:
    rep = json.load(open(os.path.join(base, app, 'report.json')))
    def walk(s):
        for spec in s.get('specs', []):
            r = spec['tests'][0]['results'][-1] if spec['tests'][0]['results'] else {}
            key = spec['title'].split(':')[0]
            if key not in rows: rows[key] = {}; order.append(key)
            ok = r.get('status') == 'passed'
            reason = ''
            if not ok:
                errs = r.get('errors', [])
                msg = ANSI.sub('', errs[1]['message'] if len(errs) > 1 else (errs[0]['message'] if errs else ''))
                loc = re.search(r"Locator:\s*(.*)", msg) or re.search(r"waiting for (.*)", msg)
                exp = re.search(r"Expected: (.*)", msg); rec = re.search(r"Received: (.*)", msg)
                reason = (loc.group(1)[:90] if loc else msg.split('\n')[0][:90]) + (f" | expected {exp.group(1)[:30]}" if exp else '') + (f" | got {rec.group(1)[:30]}" if rec else '')
            rows[key][app] = (ok, reason)
        for c in s.get('suites', []): walk(c)
    for s in rep['suites']: walk(s)
hdr = [a.split('-')[1] + '-' + a.split('-')[2][:4] for a in apps]
print('| test | ' + ' | '.join(hdr) + ' |')
print('|---|' + '---|' * len(apps))
for t in order:
    print(f'| {t} | ' + ' | '.join(('✓' if rows[t][a][0] else '✗') if a in rows[t] else '?' for a in apps) + ' |')
print('| **pass** | ' + ' | '.join(f"**{sum(1 for t in order if rows[t].get(a, (False,))[0])}**" for a in apps) + ' |')
if len(sys.argv) > 2:
    print()
    for t in order:
        for a in apps:
            if a in rows[t] and not rows[t][a][0]:
                print(f'{t} | {a} | {rows[t][a][1]}')
