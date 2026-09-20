# Current handoff — 2026-09-20: goal active, independent draft comparison running

Continue this same task. The user said to create and pursue the goal autonomously.
The goal is active; do not mark it complete before the predefined new-draft comparisons
finish or reject the tested candidate. User authorizes necessary ARC model spending from
existing balance; request funding only if insufficient. No official runs/uploads under this goal.

## Verified checkpoint

- Read [checkpoint evidence](evidence/2026-09-20-goal-fixed-draft-checkpoint.json).
- Previous immutable evidence is retained in `runs/fixed-draft/` and commit `f87a728`.
- Local/direct model calls were truncated. A temporary SSH SOCKS route through the existing
  user-owned `hk-zyl` host returned two complete Flash repairs. TLS credentials stay local;
  no global proxy setting was changed. SOCKS `127.0.0.1:60513`, exec session `31290`.
- 12306 explicit-diagnostic repair: 91/135 vs the same draft's 73 (19 gains, 1 regression).
- Automatic relative-date diagnostic candidate: 91/135 vs 73 (18 gains, 0 regressions),
  and 17 gains / 0 regressions against the historical automatic repair's 74.
- Ctrip historical repair is accepted by the narrow fatal-recovery exception and its source
  matches the previously replayed 42/125 repair exactly. No new Ctrip score is claimed.
- `test_smoke`: 30 passed in 93.972 seconds. Candidate source SHA-256
  `84f95fec6453b29e392be2b0553d217b71aac7e11f6c2cb3c85e428b3f966ed6`.
- First successful repair bill: CNY 0.554243, 75,643 input / 60,125 output tokens.
  Final goal cost is not settled yet; more calls are running.

## Running work — do not duplicate it

- Serial batch exec session `63713` runs `runs/goal-20260920/holdout_batch.py`.
- Inspect `runs/goal-20260920/holdout/state.json` and each active step's `progress.json`.
  Two pairs are complete: 12306-1 is 60/135 for both arms; Ctrip-1 is 49/125
  for both arms (raw draft 24). Both have +0/-0 candidate gain versus baseline.
  Current step is `12306-2/generate`, identical-request transport retry; inspect live files.
- Exactly three new draft attempts per task, alternating 12306/Ctrip, fixed baseline and
  candidate, same raw draft for both repairs. Identical feedback reuses the same actual
  model response, so differences in acceptance cannot be mistaken for model variance.
- Sources are frozen under `runs/goal-20260920/baseline/oneshot/` and `candidate-v1/oneshot/`.
  Do not change the candidate or acceptance criterion after inspecting held-out outcomes.
- Retain only positive task-equal pass gain with no lost baseline-passing case. The batch
  stops early on a regression; do not resample to replace it. Review any infrastructure
  interruption before resuming. Completed model calls/outputs must not be repeated.
- Each replay uses the saved published Web suite, UTC, four workers and ten-second limits;
  source-identical applications reuse the same score. No hosted CPU quota is reproduced.
- `12306-1` generation attempt 1 ended with incomplete SSE after 178.75 seconds. The
  identical-request retry completed (45,769 input / 108,884 output tokens). The failure
  remains under `draft-attempt1-transport-failure`, with unknown usage.
- A real experimental control issue was found BEFORE judging the first pair: Python hash
  randomization changed the unchanged label diagnostic example from Date to Name. The
  two original calls/replays are retained as `*-uncontrolled-hash`. Repair subprocesses
  now use `PYTHONHASHSEED=0`; the generator prompt was verified unchanged under this setting.
  The canonical prompt exactly matches the first baseline call, so both controlled arms
  reuse that same real response and identical source/score. No better-scoring response
  was selected, and candidate source/hash/retention criterion did not change.
- `experiment_call.py` now stops the comparison on an incomplete provider request even
  when the production repair function catches the exception. A completed but invalid
  repair response is a real model/contract outcome and retains its original delivery.
- `12306-2` generation attempt 1 also ended before code/completion markers (357.803 s,
  curl exit 0, usage unknown). Preserved under `draft-attempt1-transport-failure`.
  One retry is running; its request bytes were verified identical. No scored pair was replaced.
- Required legacy suite: 226 tests, 214 passed / 12 skipped, zero failures, 80.185 seconds.
  Offline/package checks: 40 passed. These are engineering checks, not business-score improvement.
- Review ZIP: `runs/goal-20260920/candidate-v1.zip`, SHA-256
  `3991d48c14b19fd2bf1f277dfc4d1ea7d5b69aa665fa52006cbbe3aabb2c3043`; 12 files,
  packaged main.py matches the frozen candidate. It was NOT uploaded or promoted.
- Raw versus retained proposal hashes match on both completed pairs; their one source
  replay therefore covers both outcomes. See each pair's `proposal-verification.json`.
- Derive final usage from step receipts/traces and the gateway bill, including failures
  and reuse provenance; the state counter covers completed calls in scored pairs only.

## Next

Finish/diagnose the running batch, compile per-pair gains/regressions and exact costs,
then retain or reject the frozen candidate. Prepare reviewable changes/evidence, do not
promote a candidate based on the fixed-draft result alone. Shut down the temporary SSH
SOCKS process after all model work ends. Update the goal status only when its completion
criteria are met. Earlier completed replays do not need repeating.
