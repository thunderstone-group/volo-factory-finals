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
  no global proxy setting was changed. SOCKS `127.0.0.1:60513`, restored exec session `66098` (older tunnel stopped during turn interruption).
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

- Serial batch exec session `66733` runs `runs/goal-20260920/holdout_batch.py`.
- Inspect `runs/goal-20260920/holdout/state.json` and each active step's `progress.json`.
  Four pairs are complete: 12306-1 60/135 vs 60/135; Ctrip-1 49/125 vs 49/125;
  12306-2 **24/135 vs 84/135 (+60, -0)**; Ctrip-2 29/125 vs 29/125.
  Current step is `12306-3/draft/replay`; query live files before acting.
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
  Its identical HTTP/2 retry also ended before code after 275.793 seconds (curl exit 0,
  unknown usage). Both failures are retained as `draft-attempt1-transport-failure` and
  `draft-attempt2-transport-failure`. An HTTP/1.1 recovery call is now live; request bytes
  match the failed calls, and the response identifies deepseek-v4-flash. No scored pair
  was replaced. HTTP/1.1 recovery completed (45,769 input / 92,703 output tokens).
- 12306-2 baseline repair initially ended after partial code (202.627 seconds, 11,733
  content characters, no finish/usage). Retained under `baseline-attempt1-transport-failure`.
  One retry completed. Baseline rejected it for source-detected name changes to From
  Station / To Station; candidate reused the EXACT same request and response and kept it.
  The raw proposal and candidate delivery hashes match; scored 84/135 against baseline's
  retained original 24/135, 60 new passes and no lost passes. Both station-filter tests
  are among the gains. No new model generation accounts for this difference.
- The original 24/135 draft had a startup ReferenceError, so the legacy `_fatal` label
  does not imply literally zero functioning cases. Describe the rule as startup-error
  recovery and report observed regressions; do not claim a universal zero-score guarantee.
- Required legacy suite: 226 tests, 214 passed / 12 skipped, zero failures, 80.185 seconds.
  Offline/package checks: 40 passed. These are engineering checks, not business-score improvement.
- Review ZIP: `runs/goal-20260920/candidate-v1.zip`, SHA-256
  `3991d48c14b19fd2bf1f277dfc4d1ea7d5b69aa665fa52006cbbe3aabb2c3043`; 12 files,
  packaged main.py matches the frozen candidate. It was NOT uploaded or promoted.
- Raw versus retained proposal hashes match on both completed pairs; their one source
  replay therefore covers both outcomes. See each pair's `proposal-verification.json`.
- The resumed batch inherits `ARC_EXPERIMENT_HTTP_VERSION=1.1` and `PYTHONHASHSEED=0`.
  `experiment_call.py` records the requested/response model and curl HTTP metadata.
- Ctrip-2 baseline repair initially ended incomplete (431.386 s, no code/finish/usage,
  HTTP 200/1.1). It is preserved under `baseline-attempt1-transport-failure`; one retry
  completed. Both policies rejected the same reply for `+ 添加返程` source-name detection.
  Supplemental replay of that discarded proposal gives 30/125 vs retained 29/125,
  +1/-0. This is a remaining false-rejection limitation; the frozen candidate was NOT changed.
- `audit.py` additionally verifies every scored draft against its real generation response
  plus the frozen scaffold, and checks identical model parameters/initial repair contexts.
  Partial aggregate means are computed equally per task even with uneven completed counts.
- Derive final usage from step receipts/traces and the gateway bill, including failures
  and reuse provenance; the state counter covers completed calls in scored pairs only.

## Next

Finish/diagnose the running batch, compile per-pair gains/regressions and exact costs,
then retain or reject the frozen candidate. Prepare reviewable changes/evidence, do not
promote a candidate based on the fixed-draft result alone. Shut down the temporary SSH
SOCKS process after all model work ends. Update the goal status only when its completion
criteria are met. Earlier completed replays do not need repeating.
