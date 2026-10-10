#!/bin/bash
# Run a hidden-style oracle suite against one delivered app, the way the official runner does:
# one backend for the whole run (never reset), workers 1, test and expect timeout 10 s, document order.
# usage: run.sh TASK APP_DIR OUT_JSON [PORT] [GREP]
#   TASK     sheet | github  (suite = oracle/TASK/tests/*.spec.cjs, run in file-name order)
#   APP_DIR  a bundle dir that contains template/frontend and template/backend (or the template dir itself)
set -u
ORACLE=/private/tmp/claude-501/-Users-e0-7-projects/6ff2d48d-638b-4409-938c-065153a02d4b/scratchpad/oracle
TASK=$1; APP=$2; OUT=$3; PORT=${4:-3401}; GREP=${5:-}
[ -d "$APP/template" ] && APP="$APP/template"
PW=${TMPDIR%/}/oneshot-playwright-test-1.57.0/node_modules
WORK=$(mktemp -d "${TMPDIR%/}/oracle-XXXXXX")
mkdir -p "$WORK/app"
cp -R "$APP/frontend" "$APP/backend" "$WORK/app/"
rm -rf "$WORK/app/frontend/dist"; cp -R "$WORK/app/frontend/public" "$WORK/app/frontend/dist"
lsof -ti tcp:$PORT -sTCP:LISTEN 2>/dev/null | xargs kill -9 2>/dev/null
( cd "$WORK/app/backend" && PORT=$PORT exec node server.js > "$WORK/backend.log" 2>&1 ) &
BPID=$!
for i in $(seq 1 100); do curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && break; sleep 0.1; done
cat > "$WORK/playwright.config.cjs" <<CFG
module.exports = {
  testDir: '$ORACLE/$TASK/tests', testMatch: /.*\.spec\.cjs\$/,
  timeout: 10000, expect: { timeout: 10000 }, fullyParallel: false, workers: 1, retries: 0,
  outputDir: '$WORK/results',
  reporter: [['json', { outputFile: '$WORK/report.json' }]],
  use: { baseURL: 'http://127.0.0.1:$PORT', trace: 'off', screenshot: 'off', video: 'off' },
};
CFG
ARGS=(test --config "$WORK/playwright.config.cjs")
[ -n "$GREP" ] && ARGS+=(--grep "$GREP")
( cd "$WORK" && NODE_PATH="$PW" node "$PW/@playwright/test/cli.js" "${ARGS[@]}" > "$WORK/stdout.txt" 2>&1 )
kill $BPID 2>/dev/null; lsof -ti tcp:$PORT -sTCP:LISTEN 2>/dev/null | xargs kill -9 2>/dev/null
python3 "$ORACLE/summarize.py" "$WORK/report.json" > "$OUT" || { echo "no report; see $WORK/stdout.txt"; tail -20 "$WORK/stdout.txt"; exit 1; }
python3 - "$OUT" <<PY
import json,sys,collections
d=json.load(open(sys.argv[1])); c=collections.Counter(t['status'] for t in d['tests'])
print(sys.argv[1].split('/')[-1], dict(c))
PY
cp "$WORK/report.json" "${OUT%.json}.report.json"; cp "$WORK/backend.log" "${OUT%.json}.backend.log"; rm -rf "$WORK"
