#!/bin/bash
# Assemble self-contained spec files: tests/NN-REQ-x.spec.cjs = src/header.cjs + src/body/NN-REQ-x.cjs
set -e
C=$(cd "$(dirname "$0")" && pwd)
rm -f "$C"/tests/*.spec.cjs
for b in "$C"/src/body/*.cjs; do
  n=$(basename "$b" .cjs)
  cat "$C/src/header.cjs" "$b" > "$C/tests/$n.spec.cjs"
  node --check "$C/tests/$n.spec.cjs"
done
ls "$C/tests"
