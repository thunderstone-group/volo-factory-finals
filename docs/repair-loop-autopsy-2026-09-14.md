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

## 7. Corrections to earlier documents

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

## 8. What this does not establish

- The categories are assigned by a classifier over retained traces, not by a human reading 124
  calls. Its rules are in the evidence file under `method.categories`, and the price
  reconstruction is the only independent check on the parse.
- `product_assertion` is one bucket. It does not separate a genuine product bug from an
  asynchronous wait that the check got wrong, which is the distinction the external review asked
  for and the one that would tell us whether the remaining CNY 5.13 is reducible.
- Sixteen runs across four agent revisions are not a controlled sample. The concentration of
  defect spend in four runs is a description of these traces, not a rate.
