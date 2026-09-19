# Current handoff — 2026-09-19 (view-state isolation; read the last section of progress.md next)

## Working line

`volo-factory` remains the only main project. The live main checkout was clean at `248eb656d55a2888c3abd9afa00780471e848885`
(PR #38 already merged), not the parked `minimal-feedback-v1` / thin line. Those historical Bookstack/Keep runs
already have final receipts; do not repeat them from an old conversation memory.

This continuation uses `fix/view-state-isolation-20260919` in
`../volo-factory-worktrees/view-state-isolation-20260919/`, based on that main commit. Direct work through
wanctl and WebCodex; no delegated coding agent or model dispatch. Do not merge or promote this experiment
on deterministic tests alone. ADR 0001 and ADR 0002 remain in force.

## Completed locally

- Added `ARC.view`, a page-local deep copy of optional `window.VIEW_SEED`, separate from the shared
  `ARC.state` serialized by `ARC.save`. Migrated the scaffold's search example; it preserves and escapes
  the input on rerender and no longer uploads the query when a record is created/saved. The scaffold
  definition gate detects a removed `ARC.view` assignment without requiring one whitespace style.
- The original search-then-create regression failed before the change with `search leaked into shared
  /api/state`. All 9 new tests now pass. The selected one-shot/Evolution/smoke suite passes 91 tests with
  zero failures/errors/skips; the previously sandbox-denied `LocalHTTPTests` was not rerun or counted.
  The frozen legacy suite completed 226 tests: 214 passed, 12 skipped, zero failures/errors (200.357 s).
  Skipped integration coverage is not validated.
- A separate two-page jsdom replay passed the actual delegated search/change, create click, form submit,
  save and synchronous navigation path. Fetch responses remain synthetic; this is not a real-browser
  or official-task replay. Source syntax checks passed. Two experimental builds are byte-identical.
- Package: `runs/2026-09-19-view-state/candidate-a.zip` (12 files, 126748 bytes), SHA-256
  `1868b77e2c53a33656461ae8a6b304367f8c167687b7002420fb02fb55bb2819`.
  The sibling verification JSON and DOM replay retain local evidence; versioned evidence is
  [evidence/2026-09-19-view-state.json](evidence/2026-09-19-view-state.json).

## Candidate and evidence boundaries

The official candidate remains **r27**, unchanged in the main worktree's `runs/2026-09-18-goal/`:
Web submission `f1f64dec4e4c`, Lite `97082c9ded7c`. No new upload, model call, official run, score or
leaderboard claim was made here. The page-local primitive does not automatically migrate arbitrary
generated apps, enforce dataflow through aliases, or implement account-scoped persisted preferences.

Correction to the 01:35 attribution: the retained r26b Keep source confirms that `toggle-sidebar`
stores `sidebarCollapsed` in `ARC.state` and uploads it. However, source inspection found no frontend
GET `/api/state`, localStorage or sessionStorage read-back path. The claimed seven cross-worker failures
are therefore **not established by this continuation**, and this fix does not claim to recover them.

The live balance snapshot at `2026-09-19T07:03:08Z` was **CNY 238.450707**, with no pending billing events;
the old approximate CNY 40 balance is obsolete. The latest 20 returned runs were terminal, but that is
not an exhaustive active-run preflight. Use `~/.local/bin/arcbench --env-file
~/.config/arcbench/volo.env`; never source or print the credential file.

## Next

Review this branch, then use runtime attribution and a fixed-package paired comparison before replacing
r27. Any paid continuation needs a fresh full active-run/balance preflight and an explicit sampling plan;
no round 28 was started here. Other unchanged levers: requirement-driven header navigation roles (do not
nest interactive controls to satisfy both roles), the large-task planning stage, and seed-link heading
walk validation. Keep official inputs and retained bundles immutable.

The previous handoff is archived verbatim at `archive/handoffs/2026-09-19-0210.md`; the index is
`archive/README.md`. Historical board values, download/CLI status and deadlines must be rechecked before use.
