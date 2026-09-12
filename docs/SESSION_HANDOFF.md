# ARC continuation handoff — 2026-09-12

Read this checkout's `AGENTS.md`, then this file, `docs/competition-gap-2026-09-12.md`
and the latest entries in `docs/experiments.md`. This is a continuation of the same
work, not a request to restart the harness or repeat completed experiments.

## Checkouts and saved state

- Main: `~/projects/volo-factory`, branch `main`, last inspected at `0a03d5e`.
- Current development: `~/projects/volo-factory-worktrees/lean-acceptance`,
  branch `feat/lean-acceptance-harness`. Implementation `70e9236`; first-place evidence
  commit `b71a7e5`. Both were pushed. This handoff is a subsequent documentation commit.
- The development branch has **not** been merged into main. Inspect current Git state
  before editing; preserve this worktree's ignored run evidence.
- Code and documentation are in Git. Raw run records, generated apps and the verified
  agent ZIP are retained **locally** under `runs/`, which is Git-ignored.

## Last verified competition result

At 18:08 Taipei on September 12, Ticket Booking showed **VOLO AI rank 1**, **90%**,
**CNY 0.668715**, **212 seconds**. This is a dated snapshot; refresh the board next time.
Smoke was rank 3 and Smoke Evolution rank 2, both 100%.

- Official run: https://arc-bench.com/runs/a129e387e562
- Submission: `6c4b229f5a93`; agent source: `70e9236` (dev35).
- Archive SHA-256: `081a5e66334114a86648a8f12017214a983b1a95b690476658a421ef48529f8c`.
- Evidence directory: `runs/e057-dev35-repair-flash/` in the development checkout.
  `agent.zip`, `receipt.json`, `board-after.json`, `full-status.json`, `events-final.jsonl`,
  `index.html`, `api.cjs` and `checks.cjs` are saved. The ZIP hash was rechecked for handoff.
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
- Dev35 validation: 159 other regression cases passed unchanged; four budget controls
  were adjusted to exercise the larger open repair path and all four passed separately.
  A real HTTP control verifies the bounded repair path. Do not describe this as one
  fresh, entirely green full-suite invocation. Details are in `docs/experiments.md`.
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
`~/projects/volo-factory/.venv/bin/python`; the development checkout has no venv.
The last task's local processes and actual official runs finished. No continuation run
or scheduled automation was started as part of this handoff.
