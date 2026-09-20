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

- Serial batch exec session `99865` runs `runs/goal-20260920/holdout_batch.py`.
- Inspect `runs/goal-20260920/holdout/state.json` and each active step's `progress.json`.
  First step was `12306-1/generate`; query the files for current progress.
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
- The batch's preliminary `completed_model_calls` counter is unused; derive final usage
  from step receipts/traces and the gateway bill, including failures and reuse provenance.

## Next

Finish/diagnose the running batch, compile per-pair gains/regressions and exact costs,
then retain or reject the frozen candidate. Prepare reviewable changes/evidence, do not
promote a candidate based on the fixed-draft result alone. Shut down the temporary SSH
SOCKS process after all model work ends. Update the goal status only when its completion
criteria are met. Earlier completed replays do not need repeating.
