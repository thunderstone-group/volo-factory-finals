"""Flatten a Playwright JSON report into {tests: [{title, file, status, seconds, error}]} in execution order."""
import json, re, sys
ANSI = re.compile(r'\x1b\[[0-9;]*m')
rep = json.load(open(sys.argv[1]))
out = []
def walk(suite, file=None):
    file = suite.get('file') or file
    for spec in suite.get('specs', []):
        for t in spec.get('tests', []):
            r = (t.get('results') or [{}])[-1]
            err = ANSI.sub('', ((r.get('error') or {}).get('message') or ''))
            status = r.get('status') or t.get('status') or 'skipped'
            out.append({'title': spec['title'], 'file': file, 'line': spec.get('line'), 'status': 'pass' if status == 'passed' else status,
                        'seconds': round((r.get('duration') or 0) / 1000, 2), 'error': err[:600], 'start': r.get('startTime')})
    for s in suite.get('suites', []):
        walk(s, file)
for s in rep.get('suites', []):
    walk(s)
out.sort(key=lambda x: x.get('start') or '')
json.dump({'tests': out, 'stats': rep.get('stats', {})}, sys.stdout, ensure_ascii=False, indent=1)
