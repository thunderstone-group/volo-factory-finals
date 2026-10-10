import json, re, sys
ANSI = re.compile(r'\x1b\[[0-9;]*m')
rep = json.load(open(sys.argv[1]))
def walk(s):
    for sp in s.get('specs', []):
        for t in sp.get('tests', []):
            for r in t.get('results', []):
                if r.get('status') != 'passed':
                    print('=' * 100); print(sp['title'], r.get('status'))
                    for e in r.get('errors', []):
                        print(ANSI.sub('', e.get('message', ''))[:2500])
                        loc = e.get('location')
                        if loc: print('   at line', loc.get('line'))
    for c in s.get('suites', []): walk(c)
for s in rep.get('suites', []): walk(s)
