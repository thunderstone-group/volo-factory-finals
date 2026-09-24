#!/bin/zsh
# usage: run_suite.sh TESTDIR BASEURL OUT.json [grep] — Playwright 1.57, 1 worker, 15 s tests, 5 s actions
SP=/private/tmp/claude-501/-Users-e0-7-projects/7f16c387-dfb4-4435-a927-a282ac849158/scratchpad
TESTDIR=$1; BASE=$2; OUT=$3; GREP=$4
CFG=$(mktemp $SP/pwt/cfg-XXXX).cjs
cat > $CFG <<CFG
module.exports = {
  testDir: '$TESTDIR', testMatch: /.*\\.spec\\.cjs$/, workers: 1, fullyParallel: false, retries: 0,
  timeout: 15000, expect: { timeout: 5000 }, outputDir: '$SP/pwt/test-results-' + process.pid,
  reporter: [['json', { outputFile: '$OUT' }]],
  use: { baseURL: '$BASE', permissions: ['clipboard-read', 'clipboard-write'], actionTimeout: 5000, navigationTimeout: 8000, trace: 'off', video: 'off', screenshot: 'off' },
};
CFG
cd $SP/pwt && NODE_PATH=$SP/pwt/node_modules node $SP/pwt/node_modules/@playwright/test/cli.js test --config $CFG ${GREP:+--grep "$GREP"} > ${OUT%.json}.log 2>&1
echo "exit=$?"
