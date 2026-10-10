#!/bin/bash
# Debug variant of ../run.sh for github-B only: same official settings, but keeps the work dir
# (report.json, error-context snapshots) and prints its path. usage: debug-run.sh APP_DIR PORT [GREP]
set -u
ORACLE=$(cd "$(dirname "$0")/.." && pwd)
APP=$1; PORT=${2:-3441}; GREP=${3:-}
[ -d "$APP/template" ] && APP="$APP/template"
PW=${TMPDIR%/}/oneshot-playwright-test-1.57.0/node_modules
WORK=$(mktemp -d "$ORACLE/github-B/runs/dbg-XXXXXX")
mkdir -p "$WORK/app"
cp -R "$APP/frontend" "$APP/backend" "$WORK/app/"
rm -rf "$WORK/app/frontend/dist"; cp -R "$WORK/app/frontend/public" "$WORK/app/frontend/dist"
lsof -ti tcp:$PORT -sTCP:LISTEN 2>/dev/null | xargs kill -9 2>/dev/null
( cd "$WORK/app/backend" && PORT=$PORT exec node server.js > "$WORK/backend.log" 2>&1 ) &
BPID=$!
for i in $(seq 1 100); do curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && break; sleep 0.1; done
cat > "$WORK/playwright.config.cjs" <<CFG
module.exports = {
  testDir: '$ORACLE/github-B/tests', testMatch: /.*\.spec\.cjs\$/,
  timeout: 10000, expect: { timeout: 10000 }, fullyParallel: false, workers: 1, retries: 0,
  outputDir: '$WORK/results',
  reporter: [['json', { outputFile: '$WORK/report.json' }], ['list']],
  use: { baseURL: 'http://127.0.0.1:$PORT', trace: 'off', screenshot: 'only-on-failure', video: 'off' },
};
CFG
ARGS=(test --config "$WORK/playwright.config.cjs")
[ -n "$GREP" ] && ARGS+=(--grep "$GREP")
( cd "$WORK" && NODE_PATH="$PW" node "$PW/@playwright/test/cli.js" "${ARGS[@]}" > "$WORK/stdout.txt" 2>&1 )
kill $BPID 2>/dev/null; lsof -ti tcp:$PORT -sTCP:LISTEN 2>/dev/null | xargs kill -9 2>/dev/null
rm -rf "$WORK/app"
echo "$WORK"
