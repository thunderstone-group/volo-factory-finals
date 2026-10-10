#!/bin/sh
# Rerun one finals task on one submission until STOP-<task> exists or max runs; one official run per task at a time.
SUB=$1; TASK=$2; MAX=$3; D=$(cd "$(dirname "$0")" && pwd); LOG=$D/reruns-$SUB-$TASK.log
export ARCBENCH_ENV_FILE=$HOME/.config/arcbench/volo.env
n=0
while [ $n -lt $MAX ] && [ ! -f $D/STOP-$TASK ]; do
  RID=$(arcbench --json run $SUB --task hackathon-evolution--$TASK 2>&1 | python3 -c "
import json,sys
for l in sys.stdin:
  try: r=json.loads(l)
  except: continue
  for x in (r if isinstance(r,list) else [r]):
    if isinstance(x,dict) and x.get('run_id'): print(x['run_id']); break
")
  if [ -z "$RID" ]; then echo "$(date '+%m-%d %H:%M') start failed" >> $LOG; sleep 120; n=$((n+1)); continue; fi
  echo "$(date '+%m-%d %H:%M') start $RID" >> $LOG
  arcbench --json wait $RID --interval 60 --timeout 14400 > /dev/null 2>&1
  arcbench --json status $RID 2>&1 | python3 -c "
import json,sys
for l in sys.stdin:
  try: x=json.loads(l)
  except: continue
  x = x[0] if isinstance(x,list) else x
  print(x.get('run_id'), x.get('status'), 'passed', x.get('passed'), 'failed', x.get('failed'), 'sec', x.get('duration_seconds'))
" | sed "s/^/$(date '+%m-%d %H:%M') done /" >> $LOG
  n=$((n+1))
done
echo "$(date '+%m-%d %H:%M') loop end n=$n" >> $LOG
