#!/bin/bash
# Run the suite on every calibration app sequentially (port 3451), keeping reports. usage: calibrate.sh TAG
C=$(cd "$(dirname "$0")" && pwd); TAG=${1:-v}
for a in github-25-4310823c83f3 github-24-433d9936fb07 github-24-99a2bc046345 github-22-6dd494f9556b github-7-95ec6880ee7f github-13-5450c3c63fe0 github-11-7e3f4dba7736; do
  "$C/run-debug.sh" github-C "$C/../apps/$a" "$C/results/$a-$TAG.json" 3451 2>&1 | tail -1
done
echo CALIBRATION-DONE
