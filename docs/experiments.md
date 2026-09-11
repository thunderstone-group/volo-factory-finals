# Experiments

## E001 — First fresh Agent run

- Date: 2026-09-11.
- Source: `bb2620c` on `feat/agent-v1`.
- Submission: `volo-factory-v0.1.0-bb2620c`.
- Archive SHA-256: `b178b7f2bb4b6eda4c0e396eb083f350073e91d15129519f5fd2d66d82099833`.
- Model: `deepseek-v4-flash`, organizer gateway `https://api.arc-bench.com/v1`.
- First task: Smoke Counter.
- Run: https://arc-bench.com/runs/39f46bfbb151
- Status: **official failure, 0/1 tests**. Generated application built and passed its
  own real Playwright checks, but the official test never reached application assertions.
- Official error: `browserType.launch: Executable doesn't exist at /ms-playwright/chromium-1200/chrome-linux64/chrome`.
- 11 model requests. API responses total 94,213 tokens, including 56,832 cached prompt
  tokens. Gateway records 151,045 tokens and CNY 0.192947; displayed duration 124 seconds.
- The gateway's token figure equals response totals plus cached prompt tokens in this run.
  This is an observed accounting difference, not a verified general scoring specification.
- Root cause: generated tool commands installed Playwright 1.63.0 and downloaded Chromium
  revision 1243 into the shared `/ms-playwright` cache. Only revision 1243 remained afterwards;
  official evaluation still required revision 1200. Playwright's documented stale-browser
  garbage collection explains the loss of the prior revision.
- Evidence: the downloaded run artifact is retained locally under ignored
  `runs/e001-counter/`. Its trace contains actual provider responses and tool commands.
- Fix: deterministic discovery of preinstalled browser tooling, an explicit module path for
  generated checks, `PLAYWRIGHT_SKIP_BROWSER_GC=1`, and an isolated browser cache when no
  compatible preinstalled module is available. Do not change official evaluator settings.
- Efficiency change: provide runtime facts in the first prompt, avoid duplicate input reads,
  discourage environment probing and reuse a successful check only when source is unchanged.

Reference: [Playwright browser versioning and stale browser removal](https://playwright.dev/docs/browsers).

Run tasks serially when using one metered team key, because the platform captures
usage baselines around runs. Concurrent use could complicate per-run attribution.
This is a conservative experiment-control choice; the exact gateway aggregation
semantics have not been independently verified.

The fresh agent receives the requirement document and generates its implementation.
No previous smoke code or prewritten task solution is packaged into this submission.

## E002 — Compatible browser runtime and fewer discovery calls

- Source: `ac8c4ab`, submission `volo-factory-v0.2.0-ac8c4ab`.
- Archive SHA-256: `3712dc79d21e1b401612803d138cdfc563611ff8a7fb75fd45dc2e790f5660e6`.
- Counter: https://arc-bench.com/runs/a1d0daf8b5bd — **1/1 official tests**, 41 seconds.
- Dice: https://arc-bench.com/runs/bfe886440565 — **1/1 official tests**, 28 seconds.
- Both actual traces confirm discovery of `/opt/arcbench/node_modules/playwright/index.js`
  and the existing Chromium revision 1200. Self-checks used real browser interactions.
- Counter used three model requests; dice used two. The first responses spent 4,134 and
  2,965 tokens respectively on reasoning despite the small requirement scope.
- Combined leaderboard cost: CNY 0.161127; reported gateway tokens: 0.047M; average runtime: 34 seconds.
- Rank at observation: **2**. Another team improved its cost to CNY 0.044692 while these
  runs were in progress. The earlier leaderboard snapshot was not treated as a fixed target.
- Next experiment: disable DeepSeek thinking only for small batches, retain it for larger
  requirements, and expose only one completion/verification action to eliminate redundancy.
- Raw generated artifacts remain local under ignored `runs/e002-counter/` and `runs/e002-dice/`.

## E003 — Small-batch thinking disabled

- Source: `4cca774`; effective submission `volo-factory-v0.3.0-4cca774-r2`.
- Archive SHA-256: `533d4510869f327962b9d69e8d8a60d8d2ed967330d31eb775d47a325628f487`.
- The first saved record could not start: browser Network diagnostics captured HTTP 409,
  `The submitted agent archive is no longer available`. No model run was created by those
  failed starts. Saving identical bytes under a unique filename succeeded; the underlying
  platform storage failure has not been independently diagnosed.
- Counter: https://arc-bench.com/runs/ad10919cab86 — **1/1**, 49 seconds, 21,800 gateway tokens.
- Dice: https://arc-bench.com/runs/d3b6850824fb — **1/1**, 61 seconds, 47,752 gateway tokens.
- Combined cost displayed by the platform: CNY 0.0986, down from CNY 0.1611. Still behind
  the observed leading cost of CNY 0.044692. The elapsed time increased.
- Actual Counter response usage confirms zero reasoning tokens. However it spent five
  calls on listing files, splitting file writes, an unnecessary edit, and completion.
  It also chose a frontend dependency/build stack for a tiny interaction.
- Next experiment: a single forced bundle-delivery tool for a small empty project,
  followed by automatic real verification. If that fails, use the normal repair tool loop.
  Prefer built-in runtime libraries for small feature sets. This changes orchestration,
  not the task solution; all application code still comes from the model and requirements.
