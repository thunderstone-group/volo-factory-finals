# Fixed-draft repair experiment — 2026-09-20

The replay establishes two concrete bottlenecks: an effective Ctrip repair was rejected,
and the 12306 feedback missed a date-validation fault that blocks the search journey.
The fresh Flash experiment with explicit diagnostic evidence remains incomplete because
five gateway requests failed in transport. Manual reference patches below are a separate
diagnostic experiment, not a substitute for those missing model results.

## Paired local results

Every row starts from the same immutable draft within that application. Each replay uses
fresh application/data directories, UTC, four Chromium workers, ten-second test/assertion
timeouts and no retries. The hosted CPU quota is not reproduced.

| Application | Intervention | Before | After | Newly passing | Newly failing |
|---|---|---:|---:|---:|---:|
| 12306 | Original Flash repair, recovered from its trace | 73/135 | 74/135 | 1 | 0 |
| Ctrip | Original Flash repair, recovered despite rejection | 0/125 | 42/125 | 42 | 0 |
| 12306 | Manual reference: derive seed dates from the runtime date | 73/135 | 87/135 | 16 | 2 |
| Bookstack | Manual reference: dispatch shelf edit/delete suffixes | 16/34 | 18/34 | 2 | 0 |

These are local replay results, not new official scores. The generated candidate and the
official submissions were not changed.

## What the comparisons establish

**Ctrip: the acceptance decision discarded real value.** Run `9a2cdc6656f3` detected
`this.flights is not a function`, obtained a completed Flash repair, rejected it because
the quoted `+ 添加返程` control name changed, and shipped the blank draft. Replaying the
actual recorded repair produces 42 passes. Feeding that identical historical response
through the old `f842e08` acceptance code reproduces rejection; the `9497cff` rule accepts
it. These acceptance replays make no new model calls. This directly supports the existing
r28 exception for a repair that removes a whole-application failure.

**12306: the original repair barely improves the same draft.** Run `01ea1a853d95` already
passes 73 tests before its repair. The accepted repair adds only “Add a frequent passenger
successfully.” The previously reported 27 gains against r27a compare different generations
and cannot be attributed to this repair.

The requirement permits departure dates from the current day through the next two weeks.
The draft instead seeds `TODAY = '2026-05-31'` and `NEXT = '2026-06-01'`; its submit handler
rejects today's valid date, leaving the browser on the home form. The current path probe
does not prepare this form and fails to diagnose the cause. A small manual seed-date patch
unblocks 16 tests but breaks two order tests. Net improvement alone would conceal those
regressions; this patch is diagnostic evidence and is not suitable for promotion unchanged.

**Bookstack: the routing defect is real, but measurement must identify the suite.**
The original run `8418091af0b5` reported no smoke problems and made no repair call. The r28
outcome probe detects the edit route changing the hash without changing the screen. Two
manual dispatch branches restore the existing edit/delete renderers and recover the two
cancel scenarios under the saved current Lite suite, with no new failures.

An initial exploratory replay used the upstream Web suite and produced 24/34 twice. The
current platform Lite pack differs in 21 files and produces 16/34, while the historical
official Lite run reported 22/34. The historical result is therefore not calibrated by
either local baseline. Only the paired 16-to-18 comparison uses the same saved Lite suite;
it must not be presented as an official improvement or as a reproduction of 22/34. The
fresh platform Web packs for 12306/Ctrip are byte-identical to the local suites used above.

## Recovery and reproducibility

[The evidence receipt](../evidence/2026-09-20-fixed-draft-repair.json) records source hashes,
suite hashes, test-level gains/regressions, actual acceptance outcomes, patch diffs and
billing observations. Private raw logs, immutable source snapshots, browser reports and
the experiment drivers remain in `runs/fixed-draft/` on this worktree.

`scripts/reconstruct_oneshot_trace.py` extracts the scaffold and each completed response,
checks that the repair was conditioned on that draft, and verifies all eight delivered
application source files against the immutable downloaded ZIP. All three applications
match byte for byte. It rejects incomplete traces without writing a snapshot. Replays
operate on disposable copies so launcher installation cannot alter the frozen sources.

The CLI's display diagnostics regex had damaged embedded source/JSON fields containing
words such as `password`, `session` and `tokens`. Logs were recovered through the existing
`arcbench-cli` library and its known-secret redaction, preserving valid source syntax and
removing real credentials. No replacement platform client was introduced.

## Missing model result and expense

The intended fresh comparison retained the original Flash model, draft/context,
temperature 0 and 131,072 output-token cap, adding verified diagnostic evidence. Four
12306 requests and one Bookstack request failed before returning application code:
truncated SSE events, a non-streaming connection close, and an HTTP/2 empty response.
Complete output, finish markers and usage were absent. These failures measure transport,
not the model's ability to repair the application. No substitute model was used.

At 09:22:55 UTC the metering balance was still CNY 83.889382, with zero pending billing
events and no billed requests since the first attempt. Failed-request token usage remains
unknown. There were no new official runs and no active runs at the final platform check.

The next useful implementation target is a check that executes the filled search form
and reports its rejected valid input, together with explicit preservation of passing
business cases. Keep the proven whole-application recovery acceptance fix. Complete the
saved Flash diagnostic comparison when the gateway can return a complete response; the
present experiment does not establish its repair ceiling or generalization.
