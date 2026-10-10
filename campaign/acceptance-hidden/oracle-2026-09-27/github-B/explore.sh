#!/bin/bash
# Start one app copy on PORT and run a Playwright script (node, CommonJS) against it.
# usage: explore.sh APP_DIR PORT SCRIPT.cjs   (script gets BASE env var)
set -u
ORACLE=$(cd "$(dirname "$0")/.." && pwd)
APP=$1; PORT=$2; SCRIPT=$3
[ -d "$APP/template" ] && APP="$APP/template"
PW=${TMPDIR%/}/oneshot-playwright-test-1.57.0/node_modules
WORK=$(mktemp -d "${TMPDIR%/}/gb-explore-XXXXXX")
mkdir -p "$WORK/app"
cp -R "$APP/frontend" "$APP/backend" "$WORK/app/"
rm -rf "$WORK/app/frontend/dist"; cp -R "$WORK/app/frontend/public" "$WORK/app/frontend/dist"
lsof -ti tcp:$PORT -sTCP:LISTEN 2>/dev/null | xargs kill -9 2>/dev/null
( cd "$WORK/app/backend" && PORT=$PORT exec node server.js > "$WORK/backend.log" 2>&1 ) &
BPID=$!
for i in $(seq 1 100); do curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && break; sleep 0.1; done
BASE="http://127.0.0.1:$PORT" NODE_PATH="$PW" node "$SCRIPT"
kill $BPID 2>/dev/null; lsof -ti tcp:$PORT -sTCP:LISTEN 2>/dev/null | xargs kill -9 2>/dev/null
rm -rf "$WORK"
