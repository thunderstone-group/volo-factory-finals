# A self-check that cannot pass must not consume the repair budget (2026-09-14)

Two runs on 2026-09-14 spent their entire model budget repairing a check instead of a
product. The [nav-race writeup](nav-race-2026-09-14.md) recorded the mechanism as unfixed and
worked around one instance in the prompt; the [image ablation](image-ablation-2026-09-14.md)
lost its second and last official trial the same day. This change bounds the loop in the
harness. Raw per-round numbers are in `docs/evidence/2026-09-14-selfcheck-deadend.json`.

## 1. Autopsy: the nav-race first local generation

`Workspace.capture_failed_prepared_check` freezes a byte-exact copy of `checks/requirements.cjs`
and `checks/browser.cjs` when a self-check fails with a locator strict-mode violation, so that a
later rewrite cannot scope the observed ambiguity away. The frozen copy is then a required check
whose bytes `verify` refuses to let the run change.

The bundle frozen at call 2 also contained `assert(locator).toBeVisible()`, where `assert` is
`node:assert/strict` and returns `undefined`. While the product was ambiguous the captured cases
failed on the ambiguity. Once the model repaired the ambiguity, the same frozen cases ran further
and hit the `TypeError`, which is in bytes no product change can reach.

| Call | Tokens | Cumulative | Tool | Result |
| ---: | ---: | ---: | --- | --- |
| 1 | 8,528 | 8,528 | reference observation | text returned |
| 2 | 40,784 | 49,312 | `build_app` | failed; **check bundle frozen** |
| 3 | 35,097 | 84,409 | `patch_and_verify` | frozen check: `Cannot read properties of undefined (reading 'toBeVisible')` |
| 4 | 35,979 | 120,388 | `patch_and_verify` | identical error |
| 5 | 34,412 | 154,800 | `patch_and_verify` | identical error |
| 6 | 28,720 | 183,520 | `read_files` | diagnosis |
| 7 | 34,482 | 218,002 | `write_files` | rewrote `checks/requirements.cjs` correctly |
| 8 | 34,054 | 252,056 | `finish` | identical error, from the frozen copy |
| 9 | 35,566 | 287,622 | `list_files` | "the verification output appears stale" |
| 10 | 34,578 | 322,200 | `read_file_chunk` | confirmed its rewrite is on disk |
| 11 | 35,769 | 357,969 | `finish` | identical error |
| 12 | 33,986 | 391,955 | `read_files` | diagnosis |
| 13 | 37,363 | 429,318 | `read_file_chunk` | refused: `.factory` is protected |
| 14 | 35,389 | 464,707 | `run` | `grep -rn toBeVisible checks/` |

Budget exhausted, no application delivered. The product source changed on every repair round; the
failure text did not. From call 7 the model had already written a correct check and could not make
the harness use it.

## 2. Autopsy: official run `8abb7f040604`

This one is a different failure, and the earlier writeups were wrong to call it the same dead end.
No check was ever frozen: the retained trace contains no `self_check_failure_preserved` event, and
replaying the defect detector over every check output in the run finds nothing. Its logout
self-check was genuinely failing, with `POST /api/logout` still pending when the assertion read
the page.

| Call | Tokens | Cumulative | Tool | Result |
| ---: | ---: | ---: | --- | --- |
| 1 | 9,698 | 9,698 | reference observation | text returned |
| 2 | 45,379 | 55,077 | `build_app` | 7 of 7 self-checks failed on one registration wait |
| 3 | 26,245 | 81,322 | `patch_and_verify` | edit rejected: old text not unique |
| 4 | 27,170 | 108,492 | `patch_and_verify` | rejected with the message `'path'` |
| 5 | 27,554 | 136,046 | `patch_and_verify` | edit rejected: old text not unique |
| 6 | 29,833 | 165,879 | `run` | `grep` |
| 7 | 30,469 | 196,348 | `patch_and_verify` | rejected with the message `'path'` |
| 8 | 30,904 | 227,252 | `patch_and_verify` | 6 of 7 pass; sign-out fails `false == true` |
| 9 | 40,086 | 267,338 | `read_file_chunk` | 30 characters read |
| 10 | 27,099 | 294,437 | `read_files` | read its own checks |
| 11 | 40,226 | 334,663 | `read_files` | refused: `.volo` is protected |
| 12 | 37,591 | 372,254 | `write_files` | wrote an API simulation |
| 13 | 32,205 | 404,459 | `run` | the API logout is correct |
| 14 | 35,371 | 439,830 | `run` | `sed` on its own check |
| 15 | 38,031 | 477,861 | `edit` | applied a plausible fix to `doSignout` |

Budget exhausted one call after the fix, before any verification of it. The waste splits into
111,438 tokens on calls 3, 4, 5 and 7, whose edits never applied, and 204,820 on calls 6, 9, 10,
11, 13 and 14, which read and never verified. Counting call 12's diagnostic write and the
unverified fix at call 15, 250,609 tokens passed after the last verification without producing
another one. Two of the four failed edits were lost to a harness defect: a missing key in an edit
object raised a bare `KeyError` that reached the model as the string `'path'`.

## 3. The fix

Three rules, no configuration knobs.

**A defective check is never frozen.** `check_defect_findings` reads the real check log, in both
TAP and captured-reporter form, and reports harness/API misuse: assertion-library misuse such as
`assert(locator).toBeVisible()`, `is not a function`, `is not defined`, `Cannot find module`, and
syntax errors. A JavaScript error thrown by the product is reported by the prepared wrapper as
`Browser JavaScript errors`, and the serialized page state is attached to every failure, so both
are excluded and product text can never be read as a check defect. When findings exist, `verify`
returns `defective_check` with the exact error and the instruction to fix or delete the check, and
`capture_failed_prepared_check` refuses to freeze that bundle.

**A captured check is released when repair against it cannot converge.** `release_captured_check`
drops a frozen check from `required_checks` in two cases: at its first failure if that failure is
a check defect, or at the second consecutive failure with an identical normalized signature over
changed product source. Ports, identifiers and durations are normalized out of the signature; the
failure text is not. The release is recorded in the result, in the trace as
`captured_self_check_released`, and as a reported limitation. It never marks a requirement
verified, and a released capture is not re-frozen for the same requirement batch.

**A generation without a browser is not scorable.** `verify` results and `.factory/checkpoint.json`
now carry `browser_available`, and `harness_lab/local_gate.py` refuses before starting a container
when the recorded value is not `true`.

Real repair is untouched. A captured check that keeps failing while the product does not change is
not released, and an ordinary product failure behaves exactly as before.

Two calls of run `8abb7f040604` were also spent on a `KeyError` reported as `'path'`; that message
now names the missing keys. The remaining waste in that run, seven read-only diagnosis calls, is
not addressed here and is left as an open question below.

## 4. Calibration on retained real logs

The detector was replayed over the check logs of five retained generations before any model call.

| Generation | Check logs | Logs reporting a check defect |
| --- | ---: | ---: |
| nav-race first generation, the dead end | 14 | 6 |
| nav-race delivered generation | 10 | 0 |
| image ablation variant A regenerated | 6 | 0 |
| image ablation variant B | 6 | 0 |
| official run `8abb7f040604` check steps | 4 | 0 |

The six positives are exactly the frozen-check runs of the dead end, `command-0002.log` included,
which is the log that was frozen. With this change that bundle is never frozen. The five later
positives share one failure signature, so the convergence guard would have released it at call 4
even if the defect rule had missed it.

## 5. Unit tests

`tests/test_selfcheck_deadend.py` adds 14 tests: the detector against synthetic TAP and reporter
fragments in the observed shapes, the exclusion of product JavaScript errors and page text, the
signature's tolerance of ports and durations, and the malformed-edit message. Four tests drive real
Node checks and a real server: a defective bundle is handed back and never frozen; a frozen check
that becomes defective after one product repair is released at its first failure and the run then
converges; two identical failures over changed source release the capture; and a capture survives
three repeats when the product does not change. Four cover the browser guard and the gate's refusal.

`python -m unittest discover -s tests -v` reports **190 tests, 0 failures, 11 skipped**, against 176
on `main`. The 11 skips are the same machine-local browser and Docker-image cases that skip on main.

## 6. Local generation and gate

One Ticket Booking application was generated locally through the organizer gateway with
`deepseek-v4-flash`, from the same retained requirement package the nav-race dead end used.

The guard fired on a real model. A check bundle was frozen at call 2; calls 3 and 4 produced the
identical failure over changed product source, so the capture was released at call 4 with reason
`no_progress`. The run then continued and delivered at call 15 with both requirements self-checked.

| Call | Cumulative tokens | Event |
| ---: | ---: | --- |
| 2 | 48,140 | `build_app` failed, check bundle frozen |
| 3 | 73,881 | frozen check failed |
| 4 | 102,062 | identical failure, **capture released (`no_progress`)** |
| 5–13 | 393,607 | repair and diagnosis of the application's own checks |
| 14 | 431,353 | 9 of 10 self-checks pass |
| 15 | 459,856 | `patch_and_verify` passed; application delivered |

Then `python -m harness_lab.local_gate` replayed the unchanged public tests in the calibrated host
configuration: the application in a 1 CPU / 256 MB container behind the volo launcher, Playwright
and Google Chrome on macOS, workers 4, `fullyParallel` false, 10 s test and expect timeouts,
retries 0, trace and video off.

| Gate step | Result |
| --- | --- |
| Recorded `browser_available` | true, from `.factory/verification.json` |
| Forbidden self-navigation patterns | 0 |
| Replays with 10 of 10 | 20 of 20 |
| Suite wall, median | 5.72 s |

## 7. Official trial

One trial was used and it passed.

| Property | Value |
| --- | --- |
| Run | [`e34e78400983`](https://arc-bench.com/runs/e34e78400983) |
| Submission | `cc2ade061bc7`, `volo-ticket-selfcheck-fix-2026-09-14-f720337` |
| Agent source | `f720337`, package SHA-256 `de08a3e40992223d5205ffc5ce2fe0bede6cc23d8133a4d3e4becb2eca0e9f5b` |
| Tests | 10 passed, 0 failed |
| Features | 2 of 2 |
| Official token count | 143,279 |
| Cost | CNY 0.899558 |
| Runtime | 372 s |

Read back through the run source API, the run made five model calls: one reference observation
and four build/repair calls, the last of which passed. Its captured usage totals 143,279 tokens,
which equals the meter delta exactly. The runner log brackets the window with a baseline at
05:15:58 UTC and `Meter usage captured: tokens=143279, cost=0.899558 CNY` at 05:22:36 UTC. No run
on the account was queued or running inside it, and the last local gateway call of this task
finished before 05:12 UTC; the 20 gate replays make no model calls.

The observation call was verified rather than assumed: `kimi-k3`, 7,349 prompt tokens and 1,149
completion tokens, with text transcribing real page elements including the 12306 logo, the eight
primary nav items and the search panel tabs. A model that never receives the images answers at
about 209 prompt tokens, so this one read them.

**This trial is not the confirmation of the qwen observer default.** It ran agent source `f720337`,
branched from `b13ee49`, which predates PR #11 and #12. Its observer is `kimi-k3`. The instruction
to merge `main` before packaging arrived after the trial had already been uploaded and started,
so the qwen default still needs its own confirmation run.

**This run did not exercise the new guard.** No self-check failed with a locator strict-mode
violation, so nothing was frozen and nothing was released. It shows that the change does not break
a healthy run and that the released path is not on the default path. The guard firing on a real
model is shown by the local generation in section 6 and by the unit tests, not here.

## 8. Open questions

- **Diagnosis stalls are not bounded.** Both the fixed local generation and run `8abb7f040604`
  spent long stretches on read-only calls that produce no verification: calls 6 to 13 locally,
  calls 9 to 15 officially. That is the largest remaining block of avoidable spend and this change
  does not touch it. A bound on consecutive non-verifying calls is the obvious next experiment; it
  was not added here because no retained run shows what the model would do under one.
- **The local generation converged at 459,856 tokens.** It delivered, and it would have delivered
  under the 450,000 budget only because the guard is checked before each call. One generation is
  not a measurement of the change's effect on cost.
- **Releasing a capture gives up real evidence.** In the `no_progress` case the observed ambiguity
  may still be present in the product. The release is recorded and never marks a requirement
  verified, but a run that ends with a released capture has weaker local evidence than one that
  does not.
- **`8abb7f040604` was misdiagnosed in two earlier documents.** They record it as the same frozen
  dead end. It was not; nothing was frozen. Those documents are left as written and corrected here.
