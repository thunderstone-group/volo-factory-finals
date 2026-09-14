# ARC continuation handoff — 2026-09-14 (supersedes the 09-12 sections below)

Read `docs/campaign-plan-2026-09-14.md` first: organizer rules (two-tier ranking at an
80% threshold, preliminary on 2026-09-21), the arc-bench-web board state, the strategy
and the order of work. `docs/progress.md` is the dated development log.

## State at handoff

- `main` = 7e4a053. Today's merged PRs: #5 registration timing, #6 official corpus
  catalogue, #7 token accounting, #8 nav-race fix (Ticket 10/10 officially), #9/#14/#15/#16
  docs corrections, #10 image ablation (negative), #11 qwen3.6-flash observer default,
  #13 self-check guard, #17 small-board token cuts (Smoke -16%, Evolution -54%,
  officially), #19 repair-loop defects (error formatter, anchor diagnostics, read-only
  diagnosis bound, captured checks demoted to diagnostic), #20 campaign plan, #22 one
  browser per self-check run. Suite 238 green.
- Boards: Smoke and Evolution rows are real-agent rows now (audit rows replaced);
  Ticket row is rank 7 at 100% / CNY 0.899558 (run e34e78400983). The board takes the
  latest passing run.
- Open PRs, deliberately held: #18 (remove the vendored CLI; merge once no agent still
  shells `./arcbench` from the main checkout) and #21 (state contract for the big board;
  Keep 17/32, Bookstack up to 18/34, both far above the board's 3.1% / 14.7% but below
  the 80% tier). Agents `bigtask-keep` (next Keep iteration with the two naming rules)
  and `early-stall` (hosted early-window stall) were running at handoff.
- The platform CLI is now the public repo thunderstone-group/arcbench-cli (MIT, 0.2.0,
  installed via `uv tool`, env via `ARCBENCH_ENV_FILE=~/.config/arcbench/volo.env`,
  `leaderboard` needs `--competition`). It ships `skills/arcbench/` for external agents.

## Unresolved, in priority order

1. **Hosted early-window stall: resolved as the runner's, not ours** (`docs/early-stall-2026-09-14.md`).
   Ten runs aligned by Playwright worker: every lost test is the first test of an initial
   worker, replacement workers pass everything; the 09-12 security-reproduction runs (canned
   app, no browser, no launcher) show the same signature, so teardown, self-check pressure and
   the relay are excluded; hashing is not a discriminator. The 09-14 trial after PR #22
   (`c399145c5eb1`) lost both initial workers, 8/10 at CNY 0.529, row unchanged. Open: a
   single-cgroup local reproduction (memory vs CPU) and whether to report it to the organizer.
2. **Objective function.** GPT-6 review at
   `~/.codex-jobs/volo-factory/2026-09-14-objective-review/last-message.md`: optimise
   pass rate / cost under a 95% probability of clearing the threshold; the one change
   worth making first is the verify evidence interface (per-scenario pass/fail/unknown
   of real behaviour). Not started.
3. **Big board.** Keep failures: 5 duplicate-name controls, 3 unnamed controls, 7
   batches never reached; Bookstack additionally flips under 4 workers (shared store).
   Naming rules and run-to-completion are being implemented on `feat/state-contract`.
4. **Evolution dice** fails 1 generation in 4 (adds the element, not the handler);
   forcing the edit to extend the check prevents it at 3x cost. Decide under the formal
   rules (one shot, junior tier below every senior).
5. Ticket results are not a generalisation estimate: `volo/public_specs.py` puts the
   public Ticket tests into generation context by fingerprint. Keep/Bookstack are clean
   (verified, zero leakage).

## Discipline learned today (do not relearn)

- Official token count is a usage-meter delta on the shared key: official runs and local
  gateway generations must never overlap; one scheduler, agents never upload on their
  own. Contaminated rows were restored once for Smoke (single-call, low variance) only.
- Never re-run a default package to "restore" a board row on Ticket: each run is a cost
  draw (0.63 / 0.87 / 0.90 for identical code).
- Local acceptance: trace and video off, assert browser availability, N replays of one
  product are not N generations.
- One sample is not a cause; cross-check numbers between agents (two subtotals were
  wrong today and caught by recomputation).

# ARC continuation handoff — 2026-09-12 (historical)

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
