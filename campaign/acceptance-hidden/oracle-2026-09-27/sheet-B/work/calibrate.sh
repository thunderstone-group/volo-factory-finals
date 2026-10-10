#!/bin/bash
# Run the sheet-B suite once on every calibration app (sequential, port 3421) plus the labelled v1 app.
cd /private/tmp/claude-501/-Users-e0-7-projects/6ff2d48d-638b-4409-938c-065153a02d4b/scratchpad/oracle
for a in $(ls -d apps/sheet-* | sort -t- -k2 -n); do
  n=$(basename $a)
  /private/tmp/claude-501/-Users-e0-7-projects/6ff2d48d-638b-4409-938c-065153a02d4b/scratchpad/oracle/sheet-B/work/drun.sh sheet-B /private/tmp/claude-501/-Users-e0-7-projects/6ff2d48d-638b-4409-938c-065153a02d4b/scratchpad/oracle/$a /private/tmp/claude-501/-Users-e0-7-projects/6ff2d48d-638b-4409-938c-065153a02d4b/scratchpad/oracle/sheet-B/work/final/$n.json 3421 > /private/tmp/claude-501/-Users-e0-7-projects/6ff2d48d-638b-4409-938c-065153a02d4b/scratchpad/oracle/sheet-B/work/final/$n.log 2>&1
  tail -1 /private/tmp/claude-501/-Users-e0-7-projects/6ff2d48d-638b-4409-938c-065153a02d4b/scratchpad/oracle/sheet-B/work/final/$n.log
done
/private/tmp/claude-501/-Users-e0-7-projects/6ff2d48d-638b-4409-938c-065153a02d4b/scratchpad/oracle/sheet-B/work/drun.sh sheet-B /private/tmp/claude-501/-Users-e0-7-projects/6ff2d48d-638b-4409-938c-065153a02d4b/scratchpad/oracle/sheet-B/work/v1 /private/tmp/claude-501/-Users-e0-7-projects/6ff2d48d-638b-4409-938c-065153a02d4b/scratchpad/oracle/sheet-B/work/final/v1-1d84ee5aa3d4.json 3421 > /private/tmp/claude-501/-Users-e0-7-projects/6ff2d48d-638b-4409-938c-065153a02d4b/scratchpad/oracle/sheet-B/work/final/v1-1d84ee5aa3d4.log 2>&1
tail -1 /private/tmp/claude-501/-Users-e0-7-projects/6ff2d48d-638b-4409-938c-065153a02d4b/scratchpad/oracle/sheet-B/work/final/v1-1d84ee5aa3d4.log
echo ALLDONE
# cross-check: the untouched official runner on one app
/private/tmp/claude-501/-Users-e0-7-projects/6ff2d48d-638b-4409-938c-065153a02d4b/scratchpad/oracle/run.sh sheet-B /private/tmp/claude-501/-Users-e0-7-projects/6ff2d48d-638b-4409-938c-065153a02d4b/scratchpad/oracle/apps/sheet-81-f6861552bce1 /private/tmp/claude-501/-Users-e0-7-projects/6ff2d48d-638b-4409-938c-065153a02d4b/scratchpad/oracle/sheet-B/work/final/runsh-sheet-81.json 3421 > /private/tmp/claude-501/-Users-e0-7-projects/6ff2d48d-638b-4409-938c-065153a02d4b/scratchpad/oracle/sheet-B/work/final/runsh-sheet-81.log 2>&1
tail -1 /private/tmp/claude-501/-Users-e0-7-projects/6ff2d48d-638b-4409-938c-065153a02d4b/scratchpad/oracle/sheet-B/work/final/runsh-sheet-81.log
echo CROSSDONE
