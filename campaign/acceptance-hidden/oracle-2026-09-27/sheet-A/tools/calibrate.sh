#!/bin/bash
# Run the sheet-A suite on every sheet-* app, one after another on port 3411 (same settings as oracle/run.sh),
# keep the raw Playwright report, the run.sh-style summary JSON and the readable error list per app.
SA=$(cd "$(dirname "$0")/.." && pwd)
TAG=${1:-cal}
mkdir -p "$SA/results/$TAG"
for app in "$SA"/../apps/sheet-*; do
  name=$(basename "$app")
  "$SA/tools/debug-run.sh" "$app" "$SA/results/$TAG/$name" 3411 > "$SA/results/$TAG/$name.txt" 2>&1
  python3 "$SA/../summarize.py" "$SA/results/$TAG/$name/report.json" > "$SA/results/$TAG/$name.json" 2>/dev/null
  echo "$name $(grep -m1 '^passed' "$SA/results/$TAG/$name.txt")"
done
