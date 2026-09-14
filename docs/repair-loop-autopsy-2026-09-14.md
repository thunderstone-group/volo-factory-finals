# Where the repair budget actually goes (2026-09-14)

Five official Ticket Booking runs on 2026-09-14, same task and same generation model, cost
CNY 0.629725, 0.779834, 1.072651 (failed), 0.870779 and 0.899558. The proximate explanation is the
number of repair rounds. This document labels every model call of every retained run by what the
call was actually doing, so that the rounds can be attributed instead of counted, and fixes the
three mechanical defects the labelling exposes. Every row is in
[`evidence/2026-09-14-repair-loop-autopsy.json`](evidence/2026-09-14-repair-loop-autopsy.json).

## 1. Method

One row per model call, built from the retained `.factory/events.jsonl` traces: each
`model_request`/`model_response` pair and the `tool_start`/`tool_result` events it produced.
Sixteen runs, 124 calls: the five official Ticket runs of 2026-09-14, six local generations from
the nav-race, image-ablation and selfcheck-fix tasks, and five archived E052 to E057 traces.

Costs use the gateway price table solved in [token accounting](token-accounting-2026-09-14.md),
in CNY per million tokens: `deepseek-v4-flash` 3.0 cache-miss input / 0.1 cache-hit input / 9.0
output, `deepseek-v4-pro` 9.0 / 0.3 / 27.0, `kimi-k3` 20.0 / 2.0 / 100.0, `qwen3.6-flash` 1.2 / -
/ 7.2 with every prompt token billed at the miss rate because its cache-hit tier has never been
observed. The check on that arithmetic is that the five official runs reconstruct their official
charge from these rows alone, to six decimals and with no residual.

No call is labelled `budget`. Budget exhaustion terminates a run *between* calls, so it is a run
outcome rather than a call category; the three runs that ended that way are named in the evidence
file under `terminal_outcomes`.

## 2. The table

| Category | Calls | Tokens | CNY | Runs | Attribution |
| --- | ---: | ---: | ---: | ---: | --- |
| `product_assertion` | 31 | 1,061,948 | 5.1329 | 11 | product |
| `observation` | 13 | 113,089 | 3.0534 | 13 | not a failure |
| `delivered` | 12 | 422,496 | 1.8785 | 12 | not a failure |
| `wrote_no_verification` | 22 | 660,447 | 1.5079 | 7 | not a failure |
| `no_op_diagnosis` | 25 | 766,402 | 1.2325 | 5 | **harness defect** |
| `check_defect` | 6 | 216,095 | 0.8788 | 1 | **harness defect** |
| `harness_error` | 7 | 207,850 | 0.4283 | 5 | **harness defect** |
| `harness_guard` | 1 | 43,701 | 0.2584 | 1 | product |
| `edit_not_applied` | 5 | 139,795 | 0.2037 | 2 | **harness defect** |
| `ran_check_only` | 1 | 32,205 | 0.0793 | 1 | not a failure |
| `no_tool_call` | 1 | 0 | 0.0000 | 1 | not a failure |

**43 of 124 calls and CNY 2.7433 of CNY 14.6536 are harness defects**: 34.7% of the calls and
18.7% of the cost. `product_assertion` is the largest single block and is not waste; it is the
repair loop doing its job.

The defect spend is not spread evenly. It is concentrated in four runs.

| Run | Calls | CNY | Harness-defect calls | Harness-defect CNY |
| --- | ---: | ---: | ---: | ---: |
| official `8abb7f040604` | 15 | 1.0727 | 9 | 0.4786 |
| local nav-race app1, the dead end | 14 | 1.5366 | 12 | 1.2035 |
| archive E056 | 17 | 1.2444 | 14 | 0.5692 |
| local selfcheck-fix app1 | 15 | 1.3442 | 5 | 0.2270 |
| the other twelve runs, combined | 63 | 9.4557 | 3 | 0.2650 |

A run either converges in three to six calls with no harness defect at all, or it falls into one
of these traps and spends its budget. The four official runs that passed have **zero** calls in
any defect category. The one that failed has nine.

## 3. Three mechanical defects, three root causes

**Errors from tools reached the model as bare exception strings.** Calls 4 and 7 of run
`8abb7f040604` were rejected with the message `'path'`: `str(KeyError('path'))` is `"'path'"`, and
the agent loop wrote `{"error": str(exc)}` for every exception a tool could raise. Every tool
failure now goes through one formatter, `tool_failure` in `volo/workspace.py`, which names the
tool, says what was wrong in words and says what to do next. A missing key names the key, an
argument mismatch quotes it, a missing file is reported by its path inside the application rather
than by the host path, and invalid JSON arguments keep their existing advice. `write_files` and
`deliver` validate their entries by position the way `patch_and_verify` already did, so a
malformed file entry can no longer raise a bare `KeyError` at all.

**Edits did not apply because the rejection said nothing useful.** Run `8abb7f040604` spent
111,438 tokens on four non-applying edits. Two were the `'path'` case above. The other two,
calls 3 and 5, were rejected with `Exact old text must occur exactly once: backend/api.cjs` — no
occurrence count, no line numbers, no indication of which of the three edits failed and no sight
of the current text. The anchor was `    documentType: String(b.documentType || '').trim(),`,
which appeared twice in that file. At call 7 the model guessed a different anchor, dropping
`.trim()`, and was rejected again. `edit_anchor_failure` now reports, for an ambiguous anchor, the
occurrence count and the line numbers where it occurs; and for an absent anchor, how many
characters of the old text matched before divergence, what the file holds at that point, what the
edit expected instead, and a window of the real current text marked with `<<<HERE>>>`. It names
the failing edit by its position in the call. Whitespace-only and CRLF differences are called out
by name. Nothing is written when any edit in a batch is rejected, as before.

**Read-only diagnosis was unbounded.** This is the largest of the three: 25 calls and CNY 1.2325.
E056 made thirteen consecutive read-only calls, calls 3 to 16, and never wrote anything; run
`8abb7f040604` stalled at calls 9 to 11 and again at 13 to 14; the selfcheck-fix local generation
stalled at calls 6 to 10.

## 4. The bound on diagnosis stalls

Two fixed values, no configuration knobs. A call *acts* when it writes a file or runs a check; a
`run` of `node --test` acts, a `run` of `grep` does not.

- **After two consecutive calls that neither write nor run a check**, the next tool result carries
  the complete current text of every file the model has read during this batch, subject to the
  existing 48,000-character bound, plus one instruction: make the edit now and verify it. If the
  model has read nothing, the bounded source snapshot is sent instead. The trace records
  `diagnosis_stall_sources`.
- **After three**, the run switches to the existing bounded full-source repair path: the complete
  snapshot is inlined into a fresh context under the small-edit system prompt and `patch_and_verify`
  becomes the only offered tool, so the next call cannot be another read. The trace records
  `diagnosis_stall_repair`. If the snapshot does not fit the context, the run instead receives one
  instruction to stop reading, and the counter resets either way.

Any call that writes or runs a check resets the counter to zero.

## 5. Check authority: the review's claim held

The external review argued that a frozen self-check still sat before independent acceptance with
fail-fast, so a defective check could block a correct product. Traced through `Workspace.verify`,
that was correct. Captured checks were the first entries of `required_checks`; their `argv` ran at
the head of the check loop, and any nonzero exit returned `result(False, ...)` immediately.
Independent acceptance ran only after every check in that loop had passed, so it was unreachable
from a failing capture. A released capture was handled, but release needs either a detected check
defect or two consecutive identical failures, and neither covers a capture that is simply wrong in
a way the defect detector does not recognise.

The fix separates evidence from authority rather than deleting the capture.

- A captured self-check is executed first, as before, by `captured_self_check_diagnosis`. Its
  result is reported in `captured_self_check` on every verification result, with
  `authority: diagnostic_only`, the failing output and an instruction to repair the ambiguous
  interface rather than scope it away. It is recorded in the trace as
  `captured_self_check_diagnosis`.
- Its failure no longer decides anything. The requirement assertions decide when no acceptance
  contract is configured, and **independent acceptance decides whenever one is**.
- Externally supplied required checks keep their authority. Only the run's own frozen bytes lose
  it.
- Nothing about independent acceptance is weakened: a capture never marks a requirement verified,
  never populates `verified_requirements`, and a run that ends with a failing capture keeps
  `verification_scope: local_checks_only` unless acceptance says otherwise.

The release rules from [the self-check dead end](selfcheck-deadend-2026-09-14.md) still apply and
still drop a capture that cannot converge, so a doomed capture is not re-run every round.

## 6. Tests

`tests/test_repair_loop.py` adds 19 tests. The payloads are the literal arguments of run
`8abb7f040604`: the ambiguous `documentType` anchor of calls 3 and 5, the guessed anchor of call 7
and the edit objects missing `path` of calls 4 and 7. The `'path'` case is reproduced directly —
the test asserts that `str(KeyError('path'))` is `"'path'"` and that no formatted failure equals
it. Six tool exception types are checked for a named tool, an actionable sentence and the absence
of host paths. The stall bound is driven through the real agent loop against a synthetic gateway:
two stalls attach the complete source, a third switches the offered tool menu to `patch_and_verify`
alone, and a call that writes resets the counter. Check authority is exercised against real Node
checks and a real server, including one test where a scoped-away assertion passes, the capture
still reports the ambiguity, and a configured acceptance contract decides the run.

`tests/test_captured_self_checks.py` keeps its real-browser control and now asserts the new
contract: after the model scopes its own assertion away the run proceeds, the capture still
reports `failed`, and `verified_requirements` stays empty.

`python -m unittest discover -s tests -v` reports **209 tests, 0 failures, 11 skipped**, against
190 on `main`. The 11 skips are the same machine-local browser and Docker cases that skip on main.

## 7. Local measurement: five generations before, five after

Ten Ticket Booking applications were generated locally through the organizer gateway with
`deepseek-v4-flash` from the same retained requirement package, five on `main` and five on this
branch, and each was replayed in the hosted configuration by `harness_lab.local_gate` at three
repetitions. No official run was started and no official run was queued or running at any point.
Per-call rows are in
[`evidence/2026-09-14-repair-loop-measurement.json`](evidence/2026-09-14-repair-loop-measurement.json).

| Generation | Calls | Tokens | CNY | Defect calls | Defect CNY | Outcome | Gate |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| before 1 | 3 | 83,884 | 0.4702 | 0 | 0.0000 | completed | 3 of 3 at 10/10 |
| before 2 | 16 | 479,906 | 0.9910 | 9 | 0.3888 | failed, token budget | 3 of 3 at 10/10 |
| before 3 | 6 | 203,836 | 0.9520 | 1 | 0.1425 | completed | 3 of 3 at 10/10 |
| before 4 | 12 | 394,424 | 1.1971 | 5 | 0.2658 | completed | 3 of 3 at 10/10 |
| before 5 | 5 | 142,895 | 0.6477 | 0 | 0.0000 | completed | 3 of 3 at 10/10 |
| after 1 | 4 | 113,901 | 0.5582 | 0 | 0.0000 | completed | 3 of 3 at 10/10 |
| after 2 | 3 | 83,683 | 0.4598 | 0 | 0.0000 | completed | 3 of 3 at 10/10 |
| after 3 | 12 | 379,596 | 1.6179 | 3 | 0.1353 | **failed, gateway transport error** | 0 of 3 |
| after 4 | 3 | 77,670 | 0.4177 | 0 | 0.0000 | completed | 3 of 3 at 10/10 |
| after 5 | 4 | 107,686 | 0.4339 | 1 | 0.0875 | completed | 3 of 3 at 10/10 |

| Quantity | before, n=5 | after, n=5 |
| --- | ---: | ---: |
| Calls, mean | 8.4 | 5.2 |
| CNY, mean | 0.8516 | 0.6975 |
| Harness-defect calls, total | 15 | 4 |
| Harness-defect CNY, total | 0.7971 | 0.2228 |
| Runs that completed | 4 of 5 | 4 of 5 |

By category, across the five runs of each side:

| Category | before calls | before CNY | after calls | after CNY |
| --- | ---: | ---: | ---: | ---: |
| `no_op_diagnosis` | 11 | 0.3602 | 1 | 0.0245 |
| `edit_not_applied` | 3 | 0.3517 | 1 | 0.0875 |
| `harness_error` | 1 | 0.0853 | 2 | 0.1108 |
| `product_assertion` | 16 | 2.6636 | 12 | 2.7920 |

**The criterion is met on the harness categories.** Read-only diagnosis falls from 11 calls to 1,
and non-applying edits from 3 to 1. Product assertions, which are the repair loop working, are
unchanged in character.

**Both new mechanisms fired on a real model.** In `after 3` the trace records
`diagnosis_stall_sources` after two read-only calls, carrying 11,705 characters of
`backend/server.cjs` and `frontend/public/index.html`, and `diagnosis_stall_repair` after the
third; the next three calls were product edits rather than more reads. In `after 5` the new
anchor message reached the model verbatim — "edit 1 of this call did not apply: its old text is
not present in frontend/public/index.html. The first 2 of 94 characters match, then the file has
..." — and the very next call delivered the application. Under `main`, the comparable rejections
in `before 2` and `before 3` said only `Exact old text must occur exactly once` and were followed
by further churn.

**Report honestly what did not move.** The spread did not narrow: the single most expensive run in
the whole measurement is `after 3` at CNY 1.6179. That run ended on
`model_transport_uncertain`, a gateway transport failure with no retry, not on budget and not on
anything this change touches; its application was incomplete when the gate replayed it, which is
why it scored 0 of 3. It is a fair row in the table and an unfair sample of the branch. With it
excluded the four remaining runs average 3.5 calls and CNY 0.4674, but four runs chosen after the
fact are not a measurement.

**The check-authority change was not exercised here.** One `main` generation, `before 5`, froze a
capture and still completed in five calls with a clean gate; no run on either side hit a capture
that blocked a correct product. That path is covered by the unit tests in section 6 and by the
traced reading of `Workspace.verify` in section 5, not by these ten generations.

## 8. Corrections to earlier documents

- [nav-race](nav-race-2026-09-14.md) opened by presenting the self-navigation race as the
  explanation of E057's timeout. It is not proven. E057 stalled at registration spec line 67,
  `passwordStrength.evaluate(...)`, before the registration was submitted, and the reproduced race
  occurs in a different interaction. The defensible claim is that the change removed a measured
  failure class and that the run carrying it scored 10/10.
- [vision model availability](vision-model-availability-2026-09-14.md) called the observer switch
  an input-price change with no effect on the repair loop. What is measured is that the
  observation call costs CNY 0.23 to 0.25 less. The end-to-end effect is unmeasured: the
  observation text grew from about 1,300 tokens to 4,236, so the model, the content and the length
  all changed at once.
- `volo/references.py` carried a comment attributing four extra repair rounds to removing the
  reference image. That is one sample and a correlation, not a cause; the comment now says so, and
  the reason to prefer `qwen3.6-flash` is stated as price alone.
- [arc-bench corpus](arc-bench-corpus-2026-09-14.md) section 5.3 recommended forbidding navigation
  keywords in every accessible name. That would contradict requirement text that names such
  controls verbatim. It now asks for the narrower property that actually prevents the observed
  race: on the interaction path, exactly one visible element may match the name the suite is
  looking for at the moment of the click, and a view transition must unmount the old view. The
  corpus counts in that document were checked against
  [its evidence file](evidence/2026-09-14-arc-bench-corpus.json) and already read 460 spec files,
  478 `test()` cases and 426 seed-dependent specs; no correction was needed.

## 9. What this does not establish

- The categories are assigned by a classifier over retained traces, not by a human reading 124
  calls. Its rules are in the evidence file under `method.categories`, and the price
  reconstruction is the only independent check on the parse.
- `product_assertion` is one bucket. It does not separate a genuine product bug from an
  asynchronous wait that the check got wrong, which is the distinction the external review asked
  for and the one that would tell us whether the remaining CNY 5.13 is reducible.
- Sixteen runs across four agent revisions are not a controlled sample. The concentration of
  defect spend in four runs is a description of these traces, not a rate.
- **Removing the capture's authority gives something up.** A run can now complete with a real,
  unresolved interface ambiguity that a frozen check correctly identified, because the model
  scoped its live assertion away and nothing blocks it. The ambiguity is reported in
  `captured_self_check` and in the trace, and it never marks a requirement verified, but the
  official evaluator, not the harness, is what will find it. The alternative was worse: a frozen
  bundle that is itself wrong could stop a correct product from being delivered at all, which is
  what the nav-race dead end actually did.
