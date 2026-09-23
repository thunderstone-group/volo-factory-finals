# Current handoff — 2026-09-22: Lite Goal active; Qwen comparison after gateway quota rejection

Native Goal is ACTIVE, explicitly started by the owner. Objective: the same candidate generates
Keep 32/32 and BookStack 34/34 from current requirements, followed by another independent full-pass
generation for each. No token budget was requested. Necessary ARC model calls within existing balance
remain authorized; insufficient funds require owner input, purchases/recharges are outside scope.

Current execution: `runs/lite-goal-20260922/state.json`, `plan.json`, and
`qwen-comparison-plan.json`. The frozen baseline is 01fa275 / package
3a558ab1bb99ed78944b782eb5c08f8785022c400ee3cc0821ab0ab781ba7a0a.

DeepSeek fresh generated baseline: Keep 23/32 (one call, CNY 0.913038), BookStack 5/34
(first call CNY 0.996038; automatic repair rejected by gateway quota). Separate manual diagnostic
copies pass Keep 32/32 and BookStack 34/34. They are root-cause evidence, never fresh-generation success.
BookStack's routing receiver correction alone gets 29/34; remaining losses were dashboard access and
initial favorite state. Details: evidence/2026-09-22-lite-goal-baselines.json and the run-root notes.

Two requests to DeepSeek returned HTTP 429 insufficient_quota, including an exact-hash recovery;
the metered balance is CNY 219.077801. Account funds remain; investigate this as gateway/model quota.
The existing fallback qwen3.7-plus is listed available and a real baseline Keep request is receiving data.
A separate fixed-Qwen comparison has started; both baseline and candidate use Qwen. Do not mix the
DeepSeek score with Qwen to claim a prompt improvement. No primary-model policy or main package
has been silently changed. `keep-qwen-a.log` and
`generations/baseline/keep-qwen-a/call-01/remote-progress.json` are current.

Use the preserved live request and transport receipt; never reissue merely because a local wait ended.
Generation driver snapshots v1/v2/v3 are retained. v3 records HTTP rejection status and accepts an
explicit fixed model. `replay.py` runs immutable suites in the previously measured image digest,
1 CPU / 2GB / one worker / 10 seconds. It is local ARM64, not the complete official x86_64 lifecycle.
After Keep Qwen baseline completes, replay it, then generate and replay BookStack with Qwen.

Prepared requirements-first-v1 changes only dialect.md (728 words vs 2864). Its ZIP hash is
c92409dd8a89d764214138a9c338483a7b1cc612b089a72690b9f84e168fc608. It has never been generated or
promoted. Both arms see current requirements only; evaluators and hand-fixed diagnostic apps stay out
of generation. If the existing Qwen baseline already completes both suites, independently repeat it;
otherwise evaluate the compact candidate under Qwen and require protected passes and full suites.
Goal requires a single candidate/model configuration full-passing both apps and independent repeats.

The owner explicitly redirected work from the six-task Web leaderboard to Lite, citing FAQ 7:
use the distributed public requirements and tests to understand alignment. Read
[the report](reports/2026-09-22-lite-first.md) and [evidence](evidence/2026-09-22-lite-first.json).
Previous main handoff is preserved in `archive/handoffs/2026-09-22-before-lite-first.md`.

Scope is Keep 32 tests and BookStack 34 tests. Do not launch six-task Web batches in this phase.
Completion requires full suites on both apps followed by independent fresh generation validation.
It is not complete. Historical app replays and hand-applied diagnostic edits do not prove generation quality.

Verified upstream simulator main is cfbbc287ee1bbffcf1e936545e4803145693a8d8. Current official Lite
packs fetched on September 22 match its public-exercise tests exactly after newline normalization.
All 66 ATOMIC requirement IDs match one spec each. Old September 18 packs are stale: Keep helper
and five BookStack files changed. Use current YAML and the fresh pack, not old inferred UI contracts.

Frozen r27 apps were replayed in the existing ARM64 container with Node 20.19.3, Playwright 1.57.0,
1 CPU, 2GB, one worker and 10-second budgets. Keep 15/32; BookStack 19/34. Removing the extra
"logo" suffix from BookStack's home-button accessible name gives 20/34, +REQ-1.2 and no losses.
Four other tests progress beyond that button but still fail their downstream dashboard/navigation
assertions. Full diagnostics are in evidence; this is local replay, not official scoring or a fresh draft.
The same default-name fix is in oneshot scaffold, its README and dialect card.

Next: complete Keep's Note editor journeys and BookStack's named forms/tag controls and missing
business outcomes. Current YAML overrides old dialect assumptions. Diagnose from complete cases;
preserve passing cases and verify full suites before retaining a change. Fresh independent
requirements-only generations are still required; no Lite-wide success or hidden-test generalization claim.
Prior user authorization for necessary ARC calls using existing balance still applies; no new call was
made here. Do not revive historical balance thresholds as a new approval requirement.

Artifacts are under runs/lite-20260922 in this worktree: fetched testsets, immutable input receipts,
three full browser reports, runtime details, model-call-free audit scripts and test logs. The package
is oneshot/dist/oneshot.zip, SHA-256 3a558ab1bb99ed78944b782eb5c08f8785022c400ee3cc0821ab0ab781ba7a0a.
83 one-shot tests passed; legacy suite 214 passed and 12 skipped (226 total). No model calls,
official uploads or official runs. Main and other experiment worktrees remain unchanged.
