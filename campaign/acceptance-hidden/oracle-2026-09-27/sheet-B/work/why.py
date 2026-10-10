import json, re, sys
ANSI = re.compile(r'\x1b\[[0-9;]*m')
rep = json.load(open(sys.argv[1]))
def walk(s):
    for sp in s.get('specs', []):
        for t in sp.get('tests', []):
            for r in t.get('results', []):
                if r.get('status') != 'passed':
                    msgs = [ANSI.sub('', e.get('message', '')) for e in r.get('errors', [])]
                    m = msgs[1] if len(msgs) > 1 else (msgs[0] if msgs else '')
                    lines = [l.strip() for l in m.split('\n') if l.strip()]
                    keep = [l for l in lines if l.startswith(('Error', 'Expected', 'Received', '- waiting for')) or 'intercepts' in l][:4]
                    stack = [l for l in lines if '.spec.cjs:' in l]
                    loc = stack[-1].split('.spec.cjs:')[-1].rstrip(')') if stack else ''
                    print(sp['title'].split(':')[0].ljust(12), '@' + loc.ljust(8), ' | '.join(keep)[:330])
    for c in s.get('suites', []): walk(c)
for s in rep.get('suites', []): walk(s)
