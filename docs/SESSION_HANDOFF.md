# Current handoff — 2026-09-20 11:15 (path table, path walk, repair acceptance; local generation running)

Worktree `feat/arc-optimization-loop` on top of main `248eb65`. The goal round's rejection stands; this
session landed the two carriers the ledger asked for, from measurement rather than guesswork, and started
local generations of both target tasks. Nothing has been uploaded and no platform run has been made with
the new package.

## Current state

- **12306's 31-test family is one unreachable menu.** 18 × `button /^Personal$/` (REQ-4.3.x) + 13 ×
  `button /^Information management$/` (REQ-4.4.x): after login the top "My 12306" opened a popover
  (`menu "My 12306"` with Order center / User information / Account security / My passengers), so the
  requirement's personal-center home never rendered. Measured on the platform run `cb1e1d2f9aa0` (62/135).
- **The replay must run `TZ=UTC`.** The same r27a bundle replays 48/135 on this machine's clock and
  **62/135 under UTC** — the platform's own number. `helpers.ts` takes its search date from
  `toISOString().slice(0,10)` (UTC) while the app validated against local midnight.
- **Ctrip's 0/125 (`9a2cdc6656f3`) was a repair that was thrown away.** All 125 tests `timedOut`; the local
  gate reproduces `Uncaught [TypeError: this.flights is not a function]` (blank page) in 3.4 s; the platform
  log shows the smoke check caught it and the repair was rejected by the pinned-name veto
  (`repair renamed quoted control(s): + 添加返程`), shipping the blank draft.
- Carriers landed in `oneshot/`: the requirement path table in the prompt, the path walk in the DOM probe
  (suite ladder order, per-row account, sign-in retry), the fixed-date gate for requirements that declare
  "the current date … fixed at", and the acceptance rule that keeps a repair which removes a whole-app
  failure even when a quoted control name moved. `tests_oneshot` 98 green.
- Gate behaviour on the immutable r27a bundle: exactly three path problems, all true (REQ-4.3.1 / 4.3.5 at
  "Personal", REQ-4.4.1 at "Information management"), none for the nine other executable rows, 12.8 s.
- Candidate package `r28-candidate.zip`, sha256
  `cfaf1ea767108722f353bbdf4dbf6ef1e694b2c81250294c1c8df553fb746b73`.
- Balance CNY 191.278679, pending 0, no runs in flight.

## In flight

Local generations of both target tasks (`runs/2026-09-20-goal/r28-local-gen.sh`, status in
`r28-local-status.txt`, logs `gen-12306/gen.log`, `gen-ctrip/gen.log`), then their replays under `TZ=UTC`.
The platform pair follows only if the local gate on the generated apps is clean.

## Next

1. Read both local generations: the delivery smoke summary (`[oneshot] smoke …` in the logs) and a
   `TZ=UTC` replay via `harness_lab/state_rehearsal.py` (the tool lives in the `bigtask-keep` worktree).
2. If the gate is clean, upload `r28-candidate.zip` and run one paired evaluation — Web (six tasks) and
   Lite (Keep, Bookstack) — two samples each, then feed it to `scripts/arc_optimization_loop.py` against the
   r27 baseline in `docs/evidence/2026-09-19-optimization-baseline.json`.
3. Judge the target tasks first (12306 ≥ +3 points, Ctrip above its 26/125 r27 band); the controller keeps
   the change only with no non-target regression.
