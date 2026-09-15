# ARC continuation handoff — 2026-09-15 noon (supersedes the sections below)

Read `docs/prime-transfer-2026-09-15.md` (the plan: three parallel tracks, decided with the team
lead), `docs/campaign-plan-2026-09-14.md` (rules and order), `docs/arc-template-map-2026-09-15.md`
(the organizers' ARC reference agent, mapped), `docs/organizer-report-2026-09-15-metering.md` (sent
as a gist), and the dated entries in `docs/progress.md`. Branch `feat/state-contract` in this
worktree holds everything; nothing is merged to `main`.

## State at handoff

- **Gateway key exhausted.** meter balance CNY −1.35 since about 10:48; every model call answers
  HTTP 402 `insufficient_balance`. The team lead is asking the organizer for a top-up. Nothing that
  calls the gateway can run until then. Check with `arcbench balance` (CLI 0.3.0 logs into the
  meter with the key; no cookie needed).
- **Aggregated board**: VOLO AI is rank 1 on `arc-bench-web` at 19.6% because the current Keep
  package (submission `672b777e6cbe`) now has a completed run on all six tasks (bookstack 9/34,
  stackoverflow 11/66, prestashop 13/86, 12306 0/135, ctrip 0/125, Keep 19/32). All five were cut
  short by the 402. The ARC reference template (submission `68d7d015431f`) failed on Keep and
  Bookstack with 0 tests run, also 402: no baseline data yet. Every one of the seven runs is stamped
  with the account-wide meter delta (≈30 M tokens / CNY 37 each); real spend of that hour was
  CNY 37.7. Reported to the organizer (gist in the report file).
- **Harness on this branch, head 8e8d93b**, suite 420 tests green (46 skips without a browser;
  browser-backed files pass with a real Chromium), all independently re-run from clean archives:
  gate loop (round-robin re-entry ≤ 3 per batch, salvage of regression-clean work, delivery on any
  end), budget in CNY (`FACTORY_COST_BUDGET_CNY`, LARGE 12.0; token/call ceilings secondary; meter
  calibrated to run 5 within 0.5%), the empty-product-source bug fixed (52 of run 5's 142 requests
  carried `{}`), gateway refusal (402/401/403 or three silent entries) ends the run and delivers,
  one hover-action policy (bare verb, out of the tree until hover), RC only for verbs the
  requirements declare, inertness only for dialogs, harness-owned `/factory/overlay.js` overlay
  lifecycle (emitted into `frontend/dist`, never into `frontend/public`) plus a same-page
  `overlayLeak` check that fires on run 5's REQ-4.2 race, and the requirement text handed to the
  interface check so unquoted verbs (`More options`) count as declared.
- **Local Keep run 7** on 4131da4 died at batch 2 on the 402 (CNY 1.30, 9 real calls; partial app
  in the session scratchpad, not worth scoring). The branch has had no full generation since run 5
  (25/32 on b3d2331). That is the first thing to do once the key is topped up: run 7 again with the
  script pattern in `runs/2026-09-14-keep-full-5` / the scratchpad `keep-full-7/run.sh` (default
  budget, no `--token-budget`), score hosted + repo + two hosted replays, worst replay counts.
  Bar: ≥ 26/32 and ≤ CNY 12, else attribute first.

## Decisions today (team lead)

1. Official runs and local generation may overlap on the shared key; cost columns of overlapping
   runs are meaningless, pass rates are not. Balance is the hard ceiling: check it before a batch.
2. Baselines: ARC template as its own submission (rerun Keep only first, then decide on the other
   tasks by its cost); our package on every task so the aggregated row exists (done).
3. Track 3 (single-tool harness): an additional mode for ablation, Node kernel, six-function SDK,
   continue only if calls halve at equal pass rate. Heavy discussion wanted; not on the 09-21
   critical path.
4. Phase 2 stays as planned (official-ladder locator primitives + per-scenario evidence): the
   hidden suite is authored by separate evaluator infrastructure, not by the ARC compiler's
   TestGenerator, so the public corpus helpers remain the closest sample.

## Next, in order

1. Top-up confirmed → Keep run 7 (above) → attribute → Bookstack holdout once Keep ≥ 26.
2. ARC template official run on Keep alone (cost and pass rate of the organizers' own pipeline).
3. Phase 2, then the three rules the ARC map surfaced (seeded records through the real startup
   path, auth transitions asserted globally and surviving refresh, domain state verified through
   persistence).
4. Merge this branch to `main` through PR #21 only after a full local Keep generation on it.

## Discipline

Check `arcbench balance` before any batch of runs; one sample is not a cause; trace/video off
locally; never upload from an agent; hand the organizer measured numbers, not inferences.

# ARC continuation handoff — 2026-09-15 early morning (supersedes the sections below)

Plan and rules: `docs/campaign-plan-2026-09-14.md`. Log: `docs/progress.md` (dated, append-only).
This session ran step 3 of the plan, the big board, on branch `feat/state-contract` in the
worktree `../volo-factory-worktrees/bigtask-keep`. Nothing is pushed or merged; PR #21 still
points at the old head. `main` is unchanged at 863e5e4.

## Where Keep stands

| Run | Head | Batches | Calls | Hosted | Repo | Note |
|---|---|---:|---:|---:|---:|---|
| 1 | b8e92a0 | 11/15 (4 M token budget) | 148 | 19/32 | 21/32 | naming rules obeyed, `.first()` still picks the first card |
| 2 | ccf0600 | stopped at 4 | 72 | — | — | one batch thrashed 36 calls; no per-batch cap |
| 3 | fc496c4 | died at 2 | 32 | — | — | restore removed a protected path |
| 4 | 69a7f59 | stopped at 4 | 42 | — | — | self-checks did not hover before locating hidden actions |
| 5 | b3d2331 | 15/15 | 142 | **25/32** | **25/32** | ≈ CNY 8.4; two batches capped and rolled back |

Run 5's seven failures: three from the two rolled-back batches, four attributed in
`docs/keep-attribution-run5-2026-09-15.md` (chooser inertness not honoured by Playwright's
resolver, hover-only control carrying the row title, a verb that resolves outside the composer,
an async hide with a sync restore). Run 1's attribution is `docs/keep-attribution-2026-09-14.md`:
the official helpers hover the row title and click the first control matching a bare verb, so
row actions must be out of the accessibility tree until hover; that single rule moved Keep from
19 to 25.

## What landed tonight (all on feat/state-contract, all with synthetic tests)

f1e879a mixed harness-owned reads · 9fddc0b twelve rejected tool-call shapes · ccf0600 four
interface rules + one-click state walk + store snapshot/restore endpoint · fc496c4 per-batch call
cap + restore verified tree + snapshot no longer aborts on `.volo` · 155f14a invalid-JSON escape
repair · 69a7f59 restore skips protected paths · b3d2331 hover-first self-check rule, cap 20 ·
11e21cc snapshot after `completed` is updated · 17b566a/dd8acdb transport retries (TLS EOF,
IncompleteRead). Evidence for every run under `runs/2026-09-14-keep-full-*/` and
`runs/2026-09-15-bookstack-*/` (git-ignored).

## Official Keep runs, 2026-09-15 (team lead asked to hold the board at 01:13)

| Run | Package | Result | Cost | Why |
|---|---|---|---:|---|
| 3313c37b801c | e277e2c | FAILED, 0/32 | 5.09 | our 45-min wall clock, then fresh verification with no time left, exit 1 |
| 1c2af08cf3cc | ebb5ab8 | FAILED, 0/32 | 12.57 | snapshot delivered, then summary read a cleared last_verification |
| 762faa0bd756 | 875fbaa | **19/32, 59.4%, rank 4** | 9.68 | wall clock, snapshot delivered, exit 0 |

Upload branch `upload/keep-2026-09-15` (worktree `../upload-keep`) = dd8acdb + budget +
delivery fixes; RA–RG (7db22d7) are on feat/state-contract only. Hosted machine: ~2 calls a
minute, no container timeout. Keep board top: 100%, 62.5%, 59.4%, 59.4% (us), 56.2%.

## In flight at handoff

- `keep-rules` (Opus) implementing RA–RE from the run-5 attribution: inertness without the
  aria-modal exemption plus a nameless-textbox clause, title never a hover-only control, verbs
  resolve inside their container, page recovers after each click, and one 12-call retry of a
  capped batch. Check `git log` on the branch for its commits.
- Bookstack holdout run 2 (`runs/2026-09-15-bookstack-2/` when archived) on dd8acdb, the
  rule set before RA–RE; run it again after RA–RE for the holdout before/after.

## Next

1. Keep ≥ 26/32 in three consecutive local generations, then Bookstack ≥ 28/34 without tuning on
   it, then the first official Keep run (plan step 3). Do not upload before that.
2. Unknown: the hosted runner's limit on generation time; Keep takes 60–85 minutes locally.
   Ask the organizer or find out from the first official run.
3. Cost line: run 5 ≈ CNY 8.4; the two capped batches cost ≈ 40 calls for nothing. RE is the
   lever; the objective-function work (GPT-6 review) is still not started.

## Discipline (unchanged)

One scheduler for the shared key; no upload from an agent; trace/video off locally; never
re-run a default package for a board row; one sample is not a cause.

# ARC continuation handoff — 2026-09-12

## Latest continuation

The [model comparison and research](model-comparison-2026-09-12.md) now extends this
handoff. With the same dev35 package and identical first-request messages/tools, Qwen
passes Evolution 4/4 at CNY 0.016624, rank 2, improving the previous team best by 6.7%.
Its Smoke counter fails because the generated HTML omits `data-testid="count"` while
self-checks use `#count`. The fourth planned task was not started after this failure.
Three new runs cost CNY 0.068767; the failed Smoke run has an unresolved official-versus-
captured usage discrepancy. No run is active; Ticket remains deferred.

The user highlighted that a higher-price model may use fewer steps/tokens and cost less
per completed task. Primary research and the cost-per-success metric are now recorded.
The current one-call small-task comparisons do not test that multi-step mechanism.
Preserve the Flash Smoke best and the new Qwen Evolution best while testing future
changes; no production model-routing change or premium-model batch was made.

The [three-board optimization review](competition-optimization-2026-09-12.md) is the
newest continuation record. The user temporarily deferred Ticket after obtaining the
available official failure details and requested unchanged dev35 + Flash on Smoke and
Evolution. Read that comparison before choosing another experiment. The long-term target
remains 100% and rank 1 on all three boards, followed by a measurable lead and transfer
to the supplied corpus. The older first-place-only Ticket milestone below is narrower.

Fresh E057 evidence locates the official failure at registration spec line 67,
`passwordStrength.evaluate(element => element.outerHTML)`, before registration is
submitted. A fixed E057 replay passes 10/10 with Playwright 1.57.0 and matching configured
workers/timeouts, but a different browser/host environment. The failure cause is unresolved;
do not describe it as a proven backend timeout or continue Ticket work while it is deferred.

The completed current-main comparison passes all six official tests across four tasks.
Smoke improves to CNY 0.015135, rank 3; Evolution's new Flash row costs CNY 0.022518,
rank 4, while the older Qwen row retains team rank 2 at CNY 0.017810. The four runs cost
CNY 0.037653 in total. See the linked comparison for run IDs, source identity and Fable's
two-round review. Ticket was not resubmitted. Raw evidence is retained under
`runs/20260912-objective-review/` and `runs/20260912-dev35-small-boards/` in the canonical
checkout. No follow-up batch or automation is running.

Read this checkout's `AGENTS.md`, then this file, `docs/competition-gap-2026-09-12.md`
and the latest entries in `docs/experiments.md`. This is a continuation of the same
work, not a request to restart the harness or repeat completed experiments.

## Checkouts and saved state

- Canonical checkout: `~/projects/volo-factory`, branch `main`. The user
  requested local and remote main contain the latest agent and extra branches/worktrees
  be retired. This handoff is included in that PR; inspect Git for its merge commit.
- Agent implementation: `70e9236` (dev35); first-place evidence: `b71a7e5`.
  Preserve this ancestry. The former `feat/lean-acceptance-harness` branch/worktree is
  retired after merging; start new work from current main in a fresh worktree.
- Code and documentation are in Git. Raw run records, generated apps and verified
  packages remain **local**, Git-ignored, at
  `runs/worktree-archive-20260912/lean-acceptance/` in the canonical checkout.
  Its `archive-manifest.json` records every retained file's size and hash. Historical
  `runs/...` paths below refer to the `runs/` subdirectory inside that archive.

## Last verified competition result

At 18:08 Taipei on September 12, Ticket Booking showed **VOLO AI rank 1**, **90%**,
**CNY 0.668715**, **212 seconds**. This is a dated snapshot; refresh the board next time.
Smoke was rank 3 and Smoke Evolution rank 2, both 100%.

- Official run: https://arc-bench.com/runs/a129e387e562
- Submission: `6c4b229f5a93`; agent source: `70e9236` (dev35).
- Archive SHA-256: `081a5e66334114a86648a8f12017214a983b1a95b690476658a421ef48529f8c`.
- Evidence directory in the canonical checkout:
  `runs/worktree-archive-20260912/lean-acceptance/runs/e057-dev35-repair-flash/`.
  `agent.zip`, `receipt.json`, `board-after.json`, `full-status.json`, `events-final.jsonl`,
  `index.html`, `api.cjs` and `checks.cjs` are saved. The ZIP hash was rechecked during archival.
- Official tests: 9 passed; successful registration timed out at 10 seconds. Both login
  success cases passed. The runner's FAILED label reflects the remaining case; it does
  not contradict first place under the 80% efficiency eligibility rule.
- The run passed 11 generated self-checks on its first application. The new bounded
  repair branch did **not** execute, so this result does not validate its real-model
  convergence or isolate the cause of the score gain from generation variance.
- Official token count: 555,255; two captured response usages total 50,957. Their
  accounting difference remains unresolved. Preserve both; do not substitute one for
  the other or infer an invoice from the captured count.

## What was changed and learned

- Dev34 supplies three unchanged public specs/helpers to the model, pinned by their
  source hashes and the exact requirements fingerprint. These are inputs, not proof
  of acceptance. No arbitrary runner test mount is discovered or read.
- E056 reached this input path but exhausted the 450,000-token guard after repeated
  source reads and only one repair. It failed during generation, before official tests.
- Dev35 reuses `patch_and_verify` after a larger prepared application fails: supply the
  complete current source up to 48 KB only when the full checkpoint fits the context.
  It retains three bounded attempts and the existing open repair path for larger inputs.
- Main-consolidation validation: a fresh full run passed **163 tests, zero failures
  or skips**, in **101.759 seconds**, with installed Chrome/Playwright and the existing
  Docker image. The earlier 159-plus-4 development validation remains historical.
  See `docs/evidence/2026-09-12-dev35-consolidation.json` for source/package identity.
- Full failed-self-test freezing (dev32) was rejected: bad timing assertions distorted
  product behavior. A dedicated reference-heading guard was also discarded. Do not
  revive either by assuming more verification architecture is automatically better.
- VOLO's existing launcher already supports ports 3000 and 3301. Fixed E054 replays
  through that launcher and with four workers still give 9/10, only the missing heading.
  They did not reproduce E054's two additional official login failures.

## Consultation, boundaries and next work

Fable 5.1 was consulted twice earlier and once with the latest evidence. The fresh
packet/answer are `runs/fable-latest-packet.md` and `runs/fable-latest-review.json`.
The user explicitly prohibited the obsolete `fable-playbook` skill; do not use it.
The inspected Octos sources and adopted/rejected advice are documented in
`docs/competition-gap-2026-09-12.md`.

The immediate Ticket-first-place objective was achieved. For continuation, refresh all
three boards and current run state first. Remaining work includes the registration
timeout, Smoke/Evolution costs, real-model exercise of the bounded repair path and the
token-accounting discrepancy. Pick a concrete next failure or comparison rather than
reopening the entire architecture. Local green is not an official result.

The user authorized continued competition work and bounded paid official trials in this
session. Keep actual costs and limitations visible, inspect uncertain mutations before
retrying, and never upload while another run from the same submission chain is active.
Do not modify evaluator tests, spoof metering, access hidden tests, upload manually
repaired answer apps, or use computer automation on WeChat. The two old unstarted
PENDING entries were left untouched; do not treat them as current runs or cancel them
without checking.

CLI reference: `docs/platform-cli.md`. The existing Python environment is
`~/projects/volo-factory/.venv/bin/python`.
The last task's local processes and actual official runs finished. No continuation run
or scheduled automation was started as part of this handoff.
