# Current handoff — 2026-09-22: Lite first, initial calibration and home-button fix

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
