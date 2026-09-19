# Current handoff — 2026-09-19 08:07 UTC (official Lite complete; read the last section of progress.md next)

## Working line

The owner requested checking pass rates and pushing the branch. Code commit
`be89f837f8e0d5e5b0b395a71c255f70a523742c` was pushed and read back from
`origin/fix/view-state-isolation-20260919`. This worktree is
`../volo-factory-worktrees/view-state-isolation-20260919/`. Main remains
`248eb656d55a2888c3abd9afa00780471e848885`; no merge or new Web submission was made.

The experiment remains frozen at `runs/2026-09-19-view-state/candidate-a.zip`, 12 files,
126748 bytes, SHA-256 `1868b77e2c53a33656461ae8a6b304367f8c167687b7002420fb02fb55bb2819`.
It was uploaded once to Lite as `bb1916e26b45` (`volo-view-state-be89f83`, Flash), with
matching uploaded/downloaded archive hashes. The saved Lite submission is now this
experiment; that does not promote it over the main r27 source candidate.

## Official result — both planned runs are finished; do not relaunch

One independent generation per task, serial, on the same package and configured
`deepseek-v4-flash`. No local gateway/model calls or extra best-of retries were made.

- Bookstack `8418091af0b5`: **22/34 (64.7%)**, 94,104 tokens, CNY **0.709980**.
- Keep `252a73d92695`: **15/32 (46.9%)**, 159,480 tokens, CNY **1.052284**.
- Pooled cases: **37/66 = 56.0606%**. Task-equal mean: **55.7904%**. Total CNY **1.762264**.
  Both platform statuses are FAILED because some tests failed; generation and testing completed.

Latest retained r27 controls were Bookstack 22/34 and Keep 14/32, pooled 36/66. This sample
adds one passed case overall, not established causal/generalizable improvement. Bookstack
loses four old failures but gains four others; Keep loses four and gains three. This is a
historical descriptive comparison, not a fresh paired experiment. Do not merge/promote it.

Final receipts and all failed-case names are in
[evidence/2026-09-19-view-state-official-lite.json](evidence/2026-09-19-view-state-official-lite.json).
Raw CLI outputs, diagnostic files and private billing receipts remain in ignored
`runs/2026-09-19-view-state-eval/`. The final balance at 08:07:53 UTC was CNY 236.688443, with no pending billing events.
The serial driver stopped after a read-only platform GET returned HTTP 500 while Keep
was still active; continuation only polled the existing run. This was not a terminal
run failure or a reason to relaunch. There were exactly two new official run IDs.

## Deterministic checks and diagnostic finding

Fresh selected regressions: **91/91 passed**, zero failures/errors/skips, 89.194 seconds.
The first fresh-shell attempt lacked Node on PATH (59 passed, 32 skipped); the successful
rerun added the existing Node 22 bin path, without permission changes. The previously
sandbox-denied LocalHTTPTests remained excluded. No new legacy-suite result is claimed.

The retained Bookstack app uses `ARC.view.globalQuery` and `ARC.view.fromShelf`. It also
contains a concrete dispatch defect: shelf Edit/Delete buttons navigate to suffixed
routes, but `shelvesScreen` ignores that suffix and returns the details page. An isolated
Node VM replay with synthetic one-shelf state confirms both route outputs equal the
details output even though edit/delete renderers exist. This is not a browser replay,
not an evaluator modification, and not proof of how many official cases a fix recovers.
Next useful experiment: requirement-driven navigation/action outcome validation, rather
than treating a nonthrowing click or changed URL as sufficient. Keep the current scored
package and generated bundle immutable; use a new branch/candidate for further changes.

## Board and continuation boundaries

Post-run platform snapshots still show **Web 72.3%, rank 6** and **Lite 69.5%, rank 9**
for VOLO AI. Those are leaderboard records, separate from this branch's 37/66 sample.
They must not be attributed to the view-state change or mixed with pooled case fractions.

Initial full preflight returned 544 of a requested 1000 runs, none executing. Two old
unstarted pending runs in other competitions were left untouched; a second full check
ran before Keep. The final account-wide check returned 546 of 1000 requested runs;
only those same two unrelated historical runs remained PENDING, with neither new run
active. A future paid continuation needs a new live preflight and bounded plan.
Previous handoffs are preserved verbatim at `archive/handoffs/2026-09-19-0717.md` and
`archive/handoffs/2026-09-19-0751.md`. Final documentation belongs on this same branch,
not main; verify live Git state before continuing.
