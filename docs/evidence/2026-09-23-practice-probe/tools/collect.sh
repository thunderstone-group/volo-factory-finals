#!/bin/bash
# Read-only collection for one finished run: status, full log, billed requests, balance, workspace bundle.
# Platform read endpoints sometimes answer 500: two quick retries, then one more after a minute.
set -u
RID=$1
SP=/private/tmp/claude-501/-Users-e0-7-projects/a492ba62-8f9a-4850-a1ad-d5f49589dfb2/scratchpad/agent-practice
E=$HOME/.config/arcbench/volo.env
D=$SP/runs/$RID
mkdir -p $D

retry() {  # retry <name> <command...>; stdout of the command goes to $D/<name>
  local name=$1; shift
  for attempt in 1 2 3 4; do
    "$@" > $D/$name 2> $D/$name.err
    local rc=$?
    # `status` exits 1 for a run that is not PASSED; a parsable record is still a good read.
    if [ $rc -eq 0 ] || { [ "$name" = status.json ] && python3 -c "import json,sys; json.load(open(sys.argv[1]))" $D/$name 2>/dev/null; }; then
      echo "$name ok (attempt $attempt, rc=$rc)"; return 0; fi
    echo "$name failed (attempt $attempt): $(tail -c 300 $D/$name.err)"
    if [ $attempt -eq 3 ]; then sleep 60; else sleep 3; fi
  done
  return 1
}

retry status.json arcbench --env-file $E --json status $RID
retry logs-cli.json arcbench --env-file $E --json logs $RID --offset 0 --tail 100000 --out $D
retry requests.json arcbench --env-file $E --json requests --limit 40
retry balance.txt arcbench --env-file $E balance
retry download.txt arcbench --env-file $E download $RID --output $D/bundle.zip
ls -la $D
