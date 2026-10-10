"""One line per failing test: first locator/assertion the test was stuck on. python3 why.py REPORT.json"""
import json, re, sys
ANSI = re.compile(r'\x1b\[[0-9;]*m')
rep = json.load(open(sys.argv[1]))
def walk(s):
    for sp in s.get('specs', []):
        for t in sp.get('tests', []):
            r = (t.get('results') or [{}])[-1]
            if r.get('status') == 'passed': continue
            msg = ' '.join(ANSI.sub('', e.get('message', '')) for e in r.get('errors', []))
            m = re.search(r'strict mode violation[^\n]*', msg) or re.search(r'waiting for ([^\n]*)', msg) or re.search(r'Locator: ([^\n]*)', msg)
            extra = ''
            e2 = re.search(r'(Expected[^\n]*\n\s*Received[^\n]*)', msg)
            if e2: extra = ' | ' + e2.group(1).replace('\n', ' ')
            k = re.match(r'(REQ-[\d-]+): .* - Scenario (\d+)', sp['title'])
            print('%-14s %s%s' % (f'{k.group(1)} S{k.group(2)}', (m.group(0) if m else msg[:150])[:170], extra[:80]))
    for x in s.get('suites', []): walk(x)
for s in rep.get('suites', []): walk(s)
