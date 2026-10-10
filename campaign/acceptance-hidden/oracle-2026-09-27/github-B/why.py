"""Print, for each non-passing test in a Playwright JSON report, the step it stopped at (locator + assertion)."""
import json, re, sys
ANSI = re.compile(r'\x1b\[[0-9;]*m')
rep = json.load(open(sys.argv[1]))
def walk(s):
    for spec in s.get('specs', []):
        for t in spec.get('tests', []):
            r = (t.get('results') or [{}])[-1]
            if r.get('status') == 'passed':
                continue
            msgs = [ANSI.sub('', (e.get('message') or '')) for e in (r.get('errors') or [])]
            text = '\n'.join(msgs)
            pick = []
            for pat in [r'Locator:\s*(.*)', r'waiting for (.*)', r'(strict mode violation[^\n]*)', r'Expected[^\n]*:\s*(.*)', r'Received[^\n]*:\s*(.*)']:
                m = re.search(pat, text)
                if m:
                    pick.append(m.group(1).strip()[:140])
            m = re.search(r'\n\s*>\s*\d+\s*\|\s*(.*)', text)
            line = m.group(1).strip()[:120] if m else ''
            title = re.sub(r' - Scenario (\d+)', r' S\1', spec['title'].split(':')[0] + ':' + spec['title'].split(' - ')[-1])
            print(f"{spec['title'][:60]:60s} | {line} | {' ; '.join(dict.fromkeys(pick))}")
    for c in s.get('suites', []):
        walk(c)
for s in rep.get('suites', []):
    walk(s)
