#!/bin/sh
# Let the e11a loops finish their in-flight runs, then upload conv2 (486e0237) and loop both tasks with the watchdog.
D=$(cd "$(dirname "$0")" && pwd); export ARCBENCH_ENV_FILE=$HOME/.config/arcbench/volo.env
touch $D/STOP-github $D/STOP-sheet
until grep -q "loop end" $D/reruns-e11af971a630-github.log && grep -q "loop end" $D/reruns-e11af971a630-sheet.log; do sleep 20; done
echo "$(date '+%m-%d %H:%M') e11a loops ended"
pkill -f "cost_watchdog.sh e11af971a630"
rm -f $D/STOP-github $D/STOP-sheet
arcbench --json upload $D/conv2-c44ff75.zip --competition hackathon-evolution --official-evaluation \
  --name volo-finals-conv2-486e0237-r1 --model deepseek-v4-flash-vision-exp > $D/conv2-upload.json 2>&1
cat $D/conv2-upload.json >> $D/uploads.jsonl
SUB=$(python3 -c "import json;d=json.load(open('$D/conv2-upload.json'));assert d['uploaded_sha256'].startswith('486e0237') and d['archive_verified'];print(d['submission']['id'])") || { echo "upload failed"; cat $D/conv2-upload.json; exit 1; }
echo "$SUB" > $D/conv2-sub.txt; echo "$(date '+%m-%d %H:%M') uploaded $SUB"
cd $D && nohup ./rerun_loop.sh $SUB github 40 > /dev/null 2>&1 &
cd $D && nohup ./rerun_loop.sh $SUB sheet 40 > /dev/null 2>&1 &
cd $D && nohup ./cost_watchdog.sh $SUB > /dev/null 2>&1 &
sleep 60; tail -2 $D/reruns-$SUB-github.log $D/reruns-$SUB-sheet.log
