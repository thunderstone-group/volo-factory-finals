#!/bin/sh
# Waits for the patch-draft validation (platform 6 tasks + 4 local proxy runs) and writes patch-summary.txt.
D=~/projects/arcbench-campaign/evidence/2026-10-06-finals; L=~/projects/arcbench-campaign/finals-local
H=$(cat $D/patch-branch.hash); OUT=$L/patch-summary.txt
export ARCBENCH_ENV_FILE=$HOME/.config/arcbench/volo.env
cd $D && arcbench --json wait $(cat patch-ids.txt) --interval 60 --timeout 21600 > patch-wait.jsonl 2>&1
arcbench --json status $(cat patch-ids.txt) > patch-final.jsonl 2>&1
{ echo "== platform (package $(cat $D/patch-on.hash), patch drafts default on)"
python3 -c "
import json
for l in open('$D/patch-final.jsonl'):
  try: r=json.loads(l)
  except: continue
  print(r['requirement_id'].split('--')[1], r['run_id'], r['status'], r['passed'], r['failed'], r['duration_seconds'], [t.get('name','')[:60] for t in r.get('failed_tests') or []])
"; } > $OUT
for s in s1 s2; do for t in github sheet; do R=$L/runs/$t-patch-$H-$s; until test -f $R/record.json; do sleep 60; done
python3 -c "
import json
r=json.load(open('$R/record.json')); print('== local $t $s exit', r.get('exit'), 'seconds', r.get('seconds'))
p=json.load(open('$R/proxy.json')); print(' proxy', p['passed'], '/', p['total'], [x['name'][:60] for x in p['tests'] if x['status']!='pass'])
g=json.load(open('$R/regression.json')); print(' regression', {k:v['counts'] for k,v in g['summaries'].items()})
" >> $OUT 2>&1; grep -o '"estimated_cost_cny": [0-9.]*' $R/agent-output.log | tail -1 >> $OUT; done; done
echo "DONE" >> $OUT
