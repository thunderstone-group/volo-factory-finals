"""Print every error (incl. timeout call logs) per test from a kept Playwright JSON report."""
import json, re, sys
ANSI = re.compile(r'\x1b\[[0-9;]*m')
rep = json.load(open(sys.argv[1]))
filt = sys.argv[2] if len(sys.argv) > 2 else ''
def walk(s):
    for sp in s.get('specs', []):
        for t in sp.get('tests', []):
            r = (t.get('results') or [{}])[-1]
            if r.get('status') == 'passed' or filt not in sp['title']: continue
            print('=====', sp['title'], r.get('status'), round((r.get('duration') or 0)/1000, 2))
            for e in r.get('errors', []):
                m = ANSI.sub('', e.get('message', ''))
                print('  ', m[:900].replace('\n', '\n   '))
    for x in s.get('suites', []): walk(x)
for s in rep.get('suites', []): walk(s)
