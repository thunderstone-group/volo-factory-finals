#!/bin/zsh
# usage: run_suite.sh TESTDIR BASEURL OUTJSON — run flash-written specs against a live app (1 worker, 15 s tests)
SP=/private/tmp/claude-501/-Users-e0-7-projects/cb5d46b2-3d9d-4aaa-84d7-d1724ef3bfcc/scratchpad
TESTDIR=$1; BASE=$2; OUT=$3
cat > $SP/pwt/gen.config.cjs <<CFG
module.exports = {
  testDir: '$TESTDIR', testMatch: /.*\\.spec\\.cjs$/, workers: 1, fullyParallel: false, retries: 0,
  timeout: 15000, expect: { timeout: 5000 },
  reporter: [['json', { outputFile: '$OUT' }]],
  use: { baseURL: '$BASE', permissions: ['clipboard-read', 'clipboard-write'], actionTimeout: 5000, navigationTimeout: 8000, trace: 'off', video: 'off', screenshot: 'off' },
};
CFG
cd $SP/pwt && NODE_PATH=$SP/pwt/node_modules npx playwright test --config gen.config.cjs > ${OUT%.json}.log 2>&1
echo "exit=$?"
