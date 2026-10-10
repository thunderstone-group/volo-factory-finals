#!/bin/sh
# Cancel a finals rerun that has been RUNNING too long (queue time does not count): duration tracks cost, and a
# costly higher-scoring run could be selected per task by passes and lower S. Limits: GitHub 4500 s, Sheet 3600 s.
SUB=$1; D=$(cd "$(dirname "$0")" && pwd); export ARCBENCH_ENV_FILE=$HOME/.config/arcbench/volo.env
SEEN=$D/cost_watchdog.seen; touch $SEEN
while [ "$(date '+%m%d%H%M')" -lt 10082000 ]; do
  for TASK in github sheet; do
    LIMIT=4500; [ $TASK = sheet ] && LIMIT=3600
    RID=$(grep " start " $D/reruns-$SUB-$TASK.log 2>/dev/null | tail -1 | awk '{print $4}')
    [ -z "$RID" ] && continue
    ST=$(arcbench --json status $RID 2>/dev/null | python3 -c "import json,sys; x=json.loads(sys.stdin.read()); x=x[0] if isinstance(x,list) else x; print(x.get('status'))" 2>/dev/null)
    [ "$ST" = RUNNING ] || continue
    grep -q "^$RID " $SEEN || echo "$RID $(date +%s)" >> $SEEN
    AGE=$(( $(date +%s) - $(grep "^$RID " $SEEN | awk '{print $2}') ))
    if [ $AGE -gt $LIMIT ] && ! grep -q "cancel $RID" $D/cost_watchdog.log 2>/dev/null; then
      arcbench --json cancel $RID > /dev/null 2>&1
      echo "$(date '+%m-%d %H:%M') cancel $RID $TASK after ${AGE}s running" >> $D/cost_watchdog.log
    fi
  done
  sleep 120
done
