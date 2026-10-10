#!/bin/sh
# Hand the GitHub run slot from v6 (218428c590f0) to v5 (108621e1ed8d) once v6's current GitHub run finishes.
# v5 already holds Sheet 30/30, so a better v5 GitHub run raises the best combo on its own; Sheet keeps sampling v6.
D=$(cd "$(dirname "$0")" && pwd); export ARCBENCH_ENV_FILE=$HOME/.config/arcbench/volo.env
OLD=218428c590f0; NEW=108621e1ed8d; RID=7907df631963
arcbench --json wait $RID --interval 60 --timeout 7200 > /dev/null 2>&1
arcbench --json status $RID 2>&1 | python3 -c "
import json,sys
x=json.loads(sys.stdin.read()); x=x[0] if isinstance(x,list) else x
print(x.get('run_id'), x.get('status'), 'passed', x.get('passed'), 'failed', x.get('failed'), 'sec', x.get('duration_seconds'))
" | sed "s/^/$(date '+%m-%d %H:%M') done /" >> $D/reruns-$OLD-github.log
echo "$(date '+%m-%d %H:%M') loop end (github slot handed to $NEW)" >> $D/reruns-$OLD-github.log
[ -f $D/STOP-github ] && exit 0
cd $D && nohup ./rerun_loop.sh $NEW github 40 > /dev/null 2>&1 &
cd $D && nohup ./cost_watchdog.sh $NEW > /dev/null 2>&1 &
echo "$(date '+%m-%d %H:%M') github loop started for $NEW"
