#!/bin/sh
# Wait for the 75e loops to end (STOP files set), then upload placed-5c24eb4 as the finals submission and loop both tasks.
D=$(cd "$(dirname "$0")" && pwd); export ARCBENCH_ENV_FILE=$HOME/.config/arcbench/volo.env
until grep -q "loop end" $D/reruns-75e1e32ba125-github.log && grep -q "loop end" $D/reruns-75e1e32ba125-sheet.log; do sleep 30; done
echo "$(date '+%m-%d %H:%M') 75e loops ended"
rm -f $D/STOP-github $D/STOP-sheet
arcbench --json upload $D/placed-5c24eb4.zip --competition hackathon-evolution --official-evaluation \
  --name volo-finals-placed-7896620e-r1 --model deepseek-v4-flash-vision-exp > $D/placed-upload.json 2>&1
cat $D/placed-upload.json >> $D/uploads.jsonl
SUB=$(python3 -c "import json;d=json.load(open('$D/placed-upload.json'));assert d['uploaded_sha256'].startswith('7896620e') and d['archive_verified'];print(d['submission']['id'])") || { echo "upload failed"; cat $D/placed-upload.json; exit 1; }
echo "$SUB" > $D/placed-sub.txt
echo "$(date '+%m-%d %H:%M') uploaded $SUB"
cd $D && nohup ./rerun_loop.sh $SUB github 40 > /dev/null 2>&1 &
cd $D && nohup ./rerun_loop.sh $SUB sheet 40 > /dev/null 2>&1 &
sleep 90; tail -2 $D/reruns-$SUB-github.log $D/reruns-$SUB-sheet.log
