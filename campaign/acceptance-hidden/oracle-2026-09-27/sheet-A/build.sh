#!/bin/bash
# Rebuild tests/*.spec.cjs = src/prelude.cjs + src/<name>.body.cjs (each spec file stays self-contained).
set -e
cd "$(dirname "$0")"
rm -f tests/*.spec.cjs
for body in src/*.body.cjs; do
  name=$(basename "$body" .body.cjs)
  { echo "// Generated from src/prelude.cjs + src/$name.body.cjs by build.sh"; cat src/prelude.cjs; echo; cat "$body"; } > "tests/$name.spec.cjs"
  node --check "tests/$name.spec.cjs"
done
ls tests
