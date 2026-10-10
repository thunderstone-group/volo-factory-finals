#!/bin/sh
# Let the e11a loops finish their in-flight runs, then upload conv2 (ab5434ff) and loop both tasks with the watchdog.
D=$(cd "$(dirname "$0")" && pwd); export ARCBENCH_ENV_FILE=$HOME/.config/arcbench/volo.env
touch $D/STOP-github $D/STOP-sheet
until grep -q "loop end" $D/reruns-bc54c521495f-github.log && grep -q "loop end" $D/reruns-bc54c521495f-sheet.log; do sleep 20; done
echo "$(date '+%m-%d %H:%M') e11a loops ended"
pkill -f "cost_watchdog.sh bc54c521495f"
rm -f $D/STOP-github $D/STOP-sheet
arcbench --json upload $D/conv4-d012da0.zip --competition hackathon-evolution --official-evaluation \
  --name volo-finals-conv4-ab5434ff-r1 --model deepseek-v4-flash-vision-exp > $D/conv4-upload.json 2>&1
cat $D/conv4-upload.json >> $D/uploads.jsonl
SUB=$(python3 -c "import json;d=json.load(open('$D/conv4-upload.json'));assert d['uploaded_sha256'].startswith('ab5434ff') and d['archive_verified'];print(d['submission']['id'])") || { echo "upload failed"; cat $D/conv4-upload.json; exit 1; }
echo "$SUB" > $D/conv4-sub.txt; echo "$(date '+%m-%d %H:%M') uploaded $SUB"
cd $D && nohup ./rerun_loop.sh $SUB github 40 > /dev/null 2>&1 &
cd $D && nohup ./rerun_loop.sh $SUB sheet 40 > /dev/null 2>&1 &
cd $D && nohup ./cost_watchdog.sh $SUB > /dev/null 2>&1 &
sleep 60; tail -2 $D/reruns-$SUB-github.log $D/reruns-$SUB-sheet.log
