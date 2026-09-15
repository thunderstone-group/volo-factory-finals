# ARC-Bench scenario checks

Independent, diagnostic TypeScript compiler and Playwright runner for Keep and
Bookstack. **Not calibrated yet:** this session cannot resolve the model gateway
or bind a localhost port. See `../docs/checks-calibration-2026-09-15.md`.

## Interfaces

- `src/steps.ts`: strict Zod schemas and exported `Step`, `Check`, `Result` types.
- `src/compile.ts`: only requirements YAML and state-contract JSON as product
  evidence. Includes the full tree (ancestors/dependencies) for each parent group.
  Schema + scene coverage validation, one schema retry, fixed scene denominator.
- `src/ladder.ts`: verbatim Keep functions, with Bookstack differences documented.
- `src/execute.ts`: interpreted steps; no arbitrary model-generated JS or CSS.
- `src/run.ts`: one generated spec per requirement, four workers, ten seconds per
  test, no trace/video/reloads, isolated browser contexts, **one seed restore per
  suite**. Runs a copied historical app with a fresh `APP_DATA_DIR`.
- `src/calibrate.ts`: freezes the check hash, joins official results one-to-one,
  reports the six confusion-matrix cells, unknowns, false passes and recall.
  Missing, duplicated, skipped or ambiguous official records are errors.

`checks.json` is an array of Check. `results.json` is an array of Result (not a
summary, TAP text or predicted official score). Scene IDs are `REQ-x#1`, `REQ-x#2`,
etc. A failed schema retry emits an explicit `unsupported` check. A transport
failure stops compilation and does **not** emit fake semantic unknown checks.

The seven scenario categories are `read-list`, `create`, `delete`, `edit`,
`state-toggle`, `search-filter-sort`, `navigation`. Dates, ranges and ordering
assertions are outside this version. Unobservable clauses must be `unknown`.

Targets accept literal or regex names, exact matching, explicit text/role/field
selection, and recursively named scopes. `expectAbsent` means DOM count zero;
`expectState(hidden)` means not visible. Screenshot comparisons are observations
of byte changes, not proof that a particular color was applied. Diagnostic
candidate labels are bounded DOM descriptions, not a full accessibility-tree
serialization. The copied field helper's actual fill rung is observed without
changing its fallback control flow.

Unknown in any branch conservatively makes the whole scenario unknown before
execution. A test timeout overrides any stale partial result; step progress is
written before each action. An application/runner startup failure has no scenario
verdict and never reuses an earlier `results.json`.

## Install and local verification

```sh
cd ~/projects/volo-factory-worktrees/ts-kernel/checks
export PATH=~/.nvm/versions/node/v22.22.0/bin:$PATH
npm ci
npm run typecheck
npm test
```

The CLI uses `node --import tsx` to avoid the tsx CLI's extra IPC listener. The
runner still needs normal localhost listening and browser launch permissions.
Use a Chromium installation compatible with the pinned Playwright 1.61.1.

## Compile (CNY 8 total ceiling)

```sh
export OPENAI_BASE_URL=https://api.arc-bench.com/v1
export OPENAI_API_KEY="$(awk -F= '/^ARC_BENCH_API_KEY=/{print $2}' ~/.config/arcbench/volo.env)"
export CHECKS_CORPUS=~/projects/arcbench-campaign/upstream/arc-bench/arc-bench/webapp
export CHECKS_RUNS=~/projects/volo-factory/runs
npm run compile -- --requirements "$CHECKS_CORPUS/keep/requirements/requirements.yaml" --contract "$CHECKS_RUNS/2026-09-15-keep-full-7/app/.factory/state-contract.json" --out out/keep --ledger out/usage.json
npm run compile -- --requirements "$CHECKS_CORPUS/bookstack/requirements/requirements.yaml" --contract "$CHECKS_RUNS/2026-09-15-bookstack-2/app/.factory/state-contract.json" --out out/bookstack --ledger out/usage.json
unset OPENAI_API_KEY
```

Both invocations MUST use the same retained ledger. Do not delete it to restart a
budget. Compiler model is `deepseek-v4-flash`; no Qwen comparison was run. Rates
are the repository's confirmed gateway rates: CNY 3 / 0.1 / 9 per million
uncached input / cached input / output tokens. Before every call the ledger
reserves an upper bound using request UTF-8 bytes and maximum output tokens.
Requests, responses, model IDs, timing, usage and validation errors are retained;
credentials are never serialized. A DNS/connect failure releases its reservation;
uncertain transport or missing usage retains it and stops. Recompiling is a new
paid operation; no automatic whole-app retry is performed.

## Calibrate frozen checks

The Keep checks must be identical for both historical apps. Do not modify them
using official test details or failure labels. These commands run entire suites,
not individual cases, and restore seeds once before each suite.

```sh
npm run calibrate -- --app-dir "$CHECKS_RUNS/2026-09-14-keep-full-5/app" --checks out/keep/checks.json --official "$CHECKS_RUNS/2026-09-14-keep-full-5/keep-hosted.json" --out out/keep-5
npm run calibrate -- --app-dir "$CHECKS_RUNS/2026-09-15-keep-full-7/app" --checks out/keep/checks.json --official "$CHECKS_RUNS/2026-09-15-keep-full-7/keep-hosted.json" --out out/keep-7
npm run calibrate -- --app-dir "$CHECKS_RUNS/2026-09-15-bookstack-2/app" --checks out/bookstack/checks.json --official-tests "$CHECKS_CORPUS/bookstack/tests" --out out/bookstack-2
```

Bookstack's official suite uses the upstream installation of Playwright for both
its config and CLI, avoiding two physical `@playwright/test` copies. That option
assumes the supplied corpus layout. It runs in a separate fresh app process so
local checks cannot contaminate the official suite. It is equivalent in timeout,
workers and artifact settings to `harness_lab/state_rehearsal.py --profile hosted`;
no upload or competition submission occurs.

Outputs per sample: `results.json`, `calibration.json`, `calibration.md`, frozen
check hash, seed snapshot/hash, runtime environment, and per-scene step records.
Generated app copies, specs, backend data, browser artifacts and raw Playwright
reports are ignored by Git. The compiler requests/responses, input catalogues,
usage, final structured verdicts and calibration summaries are retained.

Calibration requires zero official-fail/local-pass cases and at least 85% recall
on official passes. Unknown does not count as a local pass. Matching fail labels
alone is insufficient evidence of matching causes: inspect `failedStep`, resolver
and official failure evidence before assigning the compiler any repair authority.
