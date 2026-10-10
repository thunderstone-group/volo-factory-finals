#!/bin/bash
# Run one arm's written suite on the ten Sheet apps with known hidden scores, 3 at a time.
# usage: run10.sh ARM
T=/private/tmp/claude-501/-Users-e0-7-projects/2696d4ed-15e3-4314-9da8-3fc9c14aaf3a/scratchpad/tcost
export ARM=$1 T
export PY=~/projects/volo-factory/.venv/bin/python
export REQ=~/projects/arcbench-campaign/evidence/2026-09-24-hackathon-v2/requirements/hackathon--sheet/requirements.yaml
one() {
  id=$1; dir=$2
  rm -rf $T/$ARM/s-$id; cp -R $T/$ARM/suite $T/$ARM/s-$id
  (cd $T/$ARM && $PY oneshot/testgen.py run --requirements $REQ --app $dir --suite $T/$ARM/s-$id --out $T/$ARM/r-$id.json) > $T/$ARM/r-$id.log 2>&1
  echo "done $ARM $id"
}
export -f one
while read id h dir; do echo "$id $dir"; done < $T/apps.txt | xargs -P 3 -n 2 bash -c 'one "$0" "$1"'
