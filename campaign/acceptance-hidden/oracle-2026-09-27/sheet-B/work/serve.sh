#!/bin/bash
# usage: serve.sh APP_DIR PORT  -> copies app to a temp dir and starts backend in background, prints pid
set -u
APP=$1; PORT=$2
[ -d "$APP/template" ] && APP="$APP/template"
WORK=$(mktemp -d "${TMPDIR%/}/sheetB-explore-XXXXXX")
mkdir -p "$WORK/app"
cp -R "$APP/frontend" "$APP/backend" "$WORK/app/"
rm -rf "$WORK/app/frontend/dist"; cp -R "$WORK/app/frontend/public" "$WORK/app/frontend/dist"
lsof -ti tcp:$PORT -sTCP:LISTEN 2>/dev/null | xargs kill -9 2>/dev/null
( cd "$WORK/app/backend" && PORT=$PORT exec node server.js > "$WORK/backend.log" 2>&1 ) &
for i in $(seq 1 100); do curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && break; sleep 0.1; done
echo "$WORK"
