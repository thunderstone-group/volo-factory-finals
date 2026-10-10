#!/bin/bash
# Merge the part suites into oracle/<task>/tests and run them on every calibration app of that task, N at a time.
# usage: run_all.sh TASK [PARALLEL] [TAG]
set -u
ORACLE=$(cd "$(dirname "$0")" && pwd)
TASK=$1; PAR=${2:-4}; TAG=${3:-full}
rm -rf "$ORACLE/$TASK/tests"; mkdir -p "$ORACLE/$TASK/tests"
for part in "$ORACLE/$TASK"-*/tests; do cp "$part"/*.spec.cjs "$ORACLE/$TASK/tests/" 2>/dev/null; cp -R "$part"/lib "$ORACLE/$TASK/tests/" 2>/dev/null; done
mkdir -p "$ORACLE/results/$TAG"
i=0
for app in "$ORACLE"/apps/$TASK-*; do
  name=$(basename "$app")
  port=$((3500 + i % PAR))
  "$ORACLE/run.sh" "$TASK" "$app" "$ORACLE/results/$TAG/$name.json" "$port" > "$ORACLE/results/$TAG/$name.log" 2>&1 &
  i=$((i + 1))
  if (( i % PAR == 0 )); then wait; fi
done
wait
