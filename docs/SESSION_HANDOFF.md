# Latest: authorized runner-rules investigation (2026-09-12)

The user narrowed the request to obtaining actual evaluation rules and explicitly
confirmed the lab authorization. See [the result](runner-rules-2026-09-12.md).
A separate opt-in diagnostic ZIP captured the generated Playwright configuration
from Smoke run `199816b1dd39`: PASSED, one real model call, 224 tokens, CNY 0.001013.
The normal practice4 package is byte-identical; main remains unchanged. Latest saved
Smoke upload is diagnostic submission `6b9ede02a261`. No Ticket generation or retry
was performed. Do not infer Ticket's browser options or a timeout root cause from
this one Smoke observation. Raw evidence is retained at canonical `runs/rules-20260912/`.

# ARC continuation handoff — 2026-09-12

## Latest continuation

The [practice top-two checkpoint](practice-qualification-2026-09-12.md) is the newest
record. `perf/arc-practice` now holds Smoke rank 1 / 100% / CNY 0.002114 and Evolution
rank 2 / 100% / CNY 0.003011. A read-only refresh puts the unchanged Ticket result at
rank 2 / 90%. Main remains `1717ef4`; do not merge the practice branch automatically.
The top-two ranking target is met in this snapshot, but offline admission is unconfirmed.
Read the checkpoint for exact successful packages, experiments and remaining limits.

The user's latest direction is a **separate practice specialization branch**, prioritizing
rank 1 or 2 for the stated offline-qualification goal. Work continues on `perf/arc-practice`;
main is intentionally left at the prior general baseline. The qualification criterion
is user-reported; confirmation of which leaderboard/notice it refers to is pending.

The [dev38 small-task optimization](small-task-optimization-2026-09-12.md) is now the
current implementation and continuation record. Qwen3.6 Flash passes both small boards
at 100%, one model call per task: Smoke CNY 0.004612 and Evolution CNY 0.008007. Both
are rank 3 in the latest captured snapshot; all-three-first-place remains unachieved.
The exact package is `e5dfc8a33ec30d1c9e327458725584d7df3878907bc8cfae866d0957e72e705d`.

Fixed public acceptance now covers only four fingerprint-matched inputs. Model-authored
self-checks are omitted on that path; public assertions still execute and failures block
completion. The final cohort passes 6/6 official tests. A complete repeat passes 175
regression tests after an earlier un-reproduced legacy budget-control error. Read the
linked evidence before stating what was verified. No run or scheduled batch is active.

The user noticed a new Evolution leader at CNY 0.000048. Its displayed 2,083,333 pass/CNY
is a percentage-based ratio, not millions of completed tasks. Implementation/usage
details are unavailable; do not infer cheating from the score. Ticket remains deferred.

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
