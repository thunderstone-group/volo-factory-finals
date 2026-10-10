#!/bin/bash
# One local draft-only run (no written tests, no repairs) of pkg-flash.zip, then the hidden-intent evaluator on it.
# usage: draft.sh TASK N PORT
set -u
SP=/private/tmp/claude-501/-Users-e0-7-projects/2696d4ed-15e3-4314-9da8-3fc9c14aaf3a/scratchpad/cheap
TASK=$1; N=$2; PORT=$3
REQDIR=~/projects/arcbench-campaign/evidence/2026-09-24-hackathon-v2/requirements/hackathon--$TASK
PY=~/projects/volo-factory/.venv/bin/python
ORACLE=~/projects/arcbench-campaign/acceptance-hidden/oracle-2026-09-27
D=$SP/runs/$TASK-$N
rm -rf $D; mkdir -p $D/agent $D/out
(cd $D/agent && unzip -q $SP/pkg-flash.zip)
KEY=$(grep '^ARC_BENCH_API_KEY=' ~/.config/arcbench/volo.env | head -1 | cut -d= -f2- | tr -d '"'"'"'')
start=$(date +%s)
(cd $D && OPENAI_API_KEY="$KEY" MODEL=deepseek-v4-flash ONESHOT_TESTGEN=0 ONESHOT_REPAIR_CALLS=0 $PY agent/main.py $REQDIR --output-dir $D/out > $D/stdout.txt 2> $D/log.txt)
echo "exit=$? seconds=$(( $(date +%s) - start ))" > $D/done.txt
SUITE=$TASK; [ "$TASK" = github ] && SUITE=github-polluted
$ORACLE/run.sh $SUITE $D/out $D/oracle.json $PORT > $D/oracle.log 2>&1
[ "$TASK" = github ] && $ORACLE/run.sh github $D/out $D/oracle-clean.json $PORT > $D/oracle-clean.log 2>&1
echo judged >> $D/done.txt
