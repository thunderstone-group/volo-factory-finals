#!/bin/bash
# Same settings as oracle/run.sh (one never-reset backend, 1 worker, 10 s timeouts, file order), but keeps the
# Playwright JSON report and prints every error (including the pending step) for each non-passing test.
# usage: debug-run.sh APP_DIR OUT_DIR [PORT] [GREP]
set -u
SA=$(cd "$(dirname "$0")/.." && pwd)
APP=$1; OUT=$2; PORT=${3:-3411}; GREP=${4:-}; TESTDIR=${5:-$SA/tests}
[ -d "$APP/template" ] && APP="$APP/template"
PW=${TMPDIR%/}/oneshot-playwright-test-1.57.0/node_modules
mkdir -p "$OUT"; OUT=$(cd "$OUT" && pwd)
WORK=$(mktemp -d "${TMPDIR%/}/oracle-sheetA-XXXXXX")
mkdir -p "$WORK/app"
cp -R "$APP/frontend" "$APP/backend" "$WORK/app/"
rm -rf "$WORK/app/frontend/dist"; cp -R "$WORK/app/frontend/public" "$WORK/app/frontend/dist"
lsof -ti tcp:$PORT -sTCP:LISTEN 2>/dev/null | xargs kill -9 2>/dev/null
( cd "$WORK/app/backend" && PORT=$PORT exec node server.js > "$OUT/backend.log" 2>&1 ) &
BPID=$!
for i in $(seq 1 100); do curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && break; sleep 0.1; done
SHOTMODE=off; [ -n "${SHOT:-}" ] && SHOTMODE=only-on-failure
cat > "$WORK/playwright.config.cjs" <<CFG
module.exports = {
  testDir: '$TESTDIR', testMatch: /.*\.spec\.cjs\$/,
  timeout: 10000, expect: { timeout: 10000 }, fullyParallel: false, workers: 1, retries: 0,
  outputDir: '$OUT/artifacts',
  reporter: [['json', { outputFile: '$OUT/report.json' }]],
  use: { baseURL: 'http://127.0.0.1:$PORT', trace: 'off', screenshot: '$SHOTMODE', video: 'off' },
};
CFG
ARGS=(test --config "$WORK/playwright.config.cjs")
[ -n "$GREP" ] && ARGS+=(--grep "$GREP")
( cd "$WORK" && NODE_PATH="$PW" node "$PW/@playwright/test/cli.js" "${ARGS[@]}" > "$OUT/stdout.txt" 2>&1 )
kill $BPID 2>/dev/null; lsof -ti tcp:$PORT -sTCP:LISTEN 2>/dev/null | xargs kill -9 2>/dev/null
rm -rf "$WORK"
python3 - "$OUT/report.json" <<'PY'
import json, re, sys
ANSI = re.compile(r'\x1b\[[0-9;]*m')
rep = json.load(open(sys.argv[1]))
res = []
def walk(s):
    for spec in s.get('specs', []):
        for t in spec['tests']:
            r = t['results'][-1] if t['results'] else {}
            res.append((r.get('startTime', ''), spec['title'], r.get('status'), r.get('errors', [])))
    for c in s.get('suites', []): walk(c)
for s in rep['suites']: walk(s)
res.sort()
passed = sum(1 for x in res if x[2] == 'passed')
print(f'passed {passed}/{len(res)}')
for _, title, status, errors in res:
    if status == 'passed': continue
    print(f'--- {status}: {title}')
    for e in errors:
        msg = ANSI.sub('', e.get('message', ''))
        lines = [l for l in msg.split('\n') if l.strip()][:14]
        print('    ' + '\n    '.join(lines))
PY
