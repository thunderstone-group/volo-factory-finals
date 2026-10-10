#!/bin/sh
D=$(cd "$(dirname "$0")" && pwd); export ARCBENCH_ENV_FILE=$HOME/.config/arcbench/volo.env; OLD=195e2749e7dd
touch $D/STOP-github $D/STOP-sheet
R=$(tail -1 $D/reruns-$OLD-sheet.log | awk '/start/{print $4}'); [ -n "$R" ] && arcbench --json cancel $R > /dev/null 2>&1
until grep -q "loop end" $D/reruns-$OLD-sheet.log; do sleep 10; done
rm -f $D/STOP-sheet
arcbench --json upload $D/conv5-64bcfe0.zip --competition hackathon-evolution --official-evaluation \
  --name volo-finals-conv5-48f12452-r1 --model deepseek-v4-flash-vision-exp > $D/conv5-upload.json 2>&1
cat $D/conv5-upload.json >> $D/uploads.jsonl
SUB=$(python3 -c "import json;d=json.load(open('$D/conv5-upload.json'));assert d['uploaded_sha256'].startswith('48f12452') and d['archive_verified'];print(d['submission']['id'])") || { echo "upload failed"; cat $D/conv5-upload.json; exit 1; }
echo "$SUB" > $D/conv5-sub.txt; echo "$(date '+%m-%d %H:%M') uploaded $SUB"
cd $D && nohup ./rerun_loop.sh $SUB sheet 40 > /dev/null 2>&1 &
until grep -q "loop end" $D/reruns-$OLD-github.log; do sleep 10; done
pkill -f "cost_watchdog.sh $OLD"; rm -f $D/STOP-github
cd $D && nohup ./rerun_loop.sh $SUB github 40 > /dev/null 2>&1 &
cd $D && nohup ./cost_watchdog.sh $SUB > /dev/null 2>&1 &
echo "$(date '+%m-%d %H:%M') github loop started for $SUB"
