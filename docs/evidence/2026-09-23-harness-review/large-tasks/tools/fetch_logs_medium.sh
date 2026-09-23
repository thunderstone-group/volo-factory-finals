#!/bin/bash
# Read-only: fetch full run logs for the listed run ids (arcbench logs only).
SP=/private/tmp/claude-501/-Users-e0-7-projects/a492ba62-8f9a-4850-a1ad-d5f49589dfb2/scratchpad/agent-large
while read tag rid task passed dur; do
  d=$SP/logs/$rid
  if [ -s "$d/$rid-logs.json" ]; then continue; fi
  mkdir -p $d
  for attempt in 1 2 3; do
    arcbench --env-file ~/.config/arcbench/volo.env --json logs $rid --offset 0 --tail 100000 --out $d > $d/cli.json 2> $d/cli.err && [ -s "$d/$rid-logs.json" ] && break
    sleep 3
  done
  rm -f $d/cli.json
  echo "$tag $rid $task $passed $(ls -la $d/$rid-logs.json 2>/dev/null | awk '{print $5}')"
done < $SP/fetch-list-medium8.txt
echo DONE
