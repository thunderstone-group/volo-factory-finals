# Ablating the reference-image observation (2026-09-14)

[Token accounting](token-accounting-2026-09-14.md) measured the reference-image observation
at 1.6% of a Ticket Booking run's tokens and 48% of its charge, because `kimi-k3` is priced
20/2/100 CNY per million against `deepseek-v4-flash`'s 3/0.1/9, and it named the ablation as
the largest untested lever. This is that ablation. It was run and it did not pay.

**Neither cheaper variant beat the retained run, so the default is unchanged.** Both are now
one environment variable away. Raw numbers are in
[`evidence/2026-09-14-image-ablation.json`](evidence/2026-09-14-image-ablation.json).

## 1. Official results

| Variant | Observation model | Run | Tests | Tokens | CNY | Efficiency |
|---|---|---|---|---:|---:|---:|
| Retained default | `kimi-k3` | [`01b06fb30564`](https://arc-bench.com/runs/01b06fb30564) | 10 of 10 | 72,854 | 0.629725 | 158.80 |
| A, observation off | none | [`d855ead6df43`](https://arc-bench.com/runs/d855ead6df43) | 10 of 10 | 173,870 | 0.779834 | 128.23 |
| B, cheap observation | `qwen3.6-flash` | [`8abb7f040604`](https://arc-bench.com/runs/8abb7f040604) | did not reach the suite | 477,861 | 1.072651 | 0 |

All three reconstruct their official charge exactly from captured per-request usage with the
price table in the accounting document, to six decimals and to the token. None of the three
carries meter contamination.

## 2. Why removing the observation cost more

The lever assumed the generation call would be unchanged. It is not. Removing the screenshots
removed CNY 0.284 of `kimi-k3` and added four repair rounds of `deepseek-v4-flash`.

| Variant | Observation calls | Generation calls | Observation CNY | Generation CNY |
|---|---:|---:|---:|---:|
| Retained default | 1 | 2 | 0.284180 | 0.345545 |
| A, observation off | 0 | 6 | 0 | 0.779833 |
| B, `qwen3.6-flash` | 1 | 14 | 0.037054 | 1.035597 |

The observation is 45.1% of the retained run's charge and the thing it buys is a first draft
close enough to need one repair instead of five. On this task the repair loop is the cost
driver and the observation is a discount on it, not an addition to it.

The run-to-run spread swamps the lever either way. The same agent, model and task produced
72,854 and 173,870 tokens on two passing runs. The 8,671-token observation cannot be resolved
against that spread with one sample per variant, and three samples are all this measurement has.

## 3. `deepseek-v4-flash` cannot be the cheap observer

Variant B was specified as routing the observation to `deepseek-v4-flash`. The gateway accepts
an image payload for that model and the model does not see it. Measured directly, one request
each, with the same 1,746×1,021 registration screenshot the run actually sends, asking for the
visible section heading and first three field labels:

| Model | Prompt tokens | Response |
|---|---:|---|
| `kimi-k3`, three images, for scale | 7,349 | the retained run's observation |
| `deepseek-v4-flash` | 209 | "Image data is truncated; unable to transcribe." |
| `qwen3.6-flash` | 1,801 | 账户信息, 用户名, 登录密码, 确认密码 — correct |
| `minimax-m3` | 2,538 | correct |

209 prompt tokens is the text prompt alone; the 146 KB of pixels never reached the model. A
silent image drop is worse than a refusal, because the observation would still return confident
text. `qwen3.6-flash` reads the same screenshots correctly, tokenizes them about four times
more cheaply than `kimi-k3`, and is priced 1.2/7.2 against 20/100, so it became variant B.
`qwen3.6-plus` also accepts images; it and `qwen3.6-flash` rejected an 8×8 probe for being
under 10 pixels, which is itself evidence that they decode the payload.

## 4. Local gate

One application generated locally per variant through the organizer gateway with
`deepseek-v4-flash`, from the retained requirement package, then replayed against the unchanged
public tests in the calibrated `host` configuration: the application in a 1 CPU / 256 MB
container behind the volo launcher, Playwright 1.57.0 and Google Chrome on macOS, workers 4,
`fullyParallel` false, 10 s test and expect timeouts, retries 0, trace and video off.

| Gate step | A, observation off | B, `qwen3.6-flash` |
|---|---|---|
| Forbidden self-navigation in product source | 0 | 0 |
| Replays with 10 of 10 | 20 of 20 | 20 of 20 |
| Suite wall, median | 5.33 s | 5.47 s |
| Generation calls | 4 | 4, of which 1 observation |
| Captured tokens | 151,311 | 136,777 |
| Reconstructed CNY | 0.755362 | 0.760665 |

Both gates passed and neither predicted its official run. The local charge is already above
the retained run's official 0.629725 in both cases, which was the first signal that the lever
was not there.

**A discarded first attempt.** Variant A was generated once in an environment where Playwright
discovery failed, `browser_environment` reporting `not_found_within_metadata_budget`. The agent
then wrote HTTP-only self-checks, the prepared browser checks never ran, and the application
shipped two `/register` links. Every one of the ten public tests failed on the resulting strict
mode violation, 0 of 20 replays. That is a measurement of the local environment, not of the
variant: the hosted runner always has a browser. It was discarded and the variant regenerated
with `FACTORY_PLAYWRIGHT_MODULE` and `PLAYWRIGHT_BROWSERS_PATH` set. Any future local gate must
assert `browser_environment.available` before trusting its result.

## 5. Why variant B's official run failed

It never reached the test suite. Fifteen model calls exhausted the 450,000-token budget
repairing the run's own logout self-check, with a `POST /api/logout` still pending when the
assertion read the page. The observation cost CNY 0.037054 of the run's 1.072651 and returned
usable text; the other CNY 1.035597 is fourteen `deepseek-v4-flash` repair calls.

This is the dead end the [nav-race writeup](nav-race-2026-09-14.md) already records as unfixed:
a self-check the run cannot repair consumes the whole budget. It cost that task one local
generation and it cost this one its second and last official trial. It is not evidence about
`qwen3.6-flash`, and it is not evidence that `qwen3.6-flash` is safe either.

## 6. The switch

`FACTORY_VISION_MODEL` selects the observation model. Unset uses `DEFAULT_VISION_MODEL`, still
`kimi-k3`. An empty value, or `off`, `none`, `no`, `false`, `0` or `disabled`, removes the call
entirely; the agent is then told that the binary references have not been inspected, so it
cannot claim to have matched them. Any other value names a gateway model and is not validated,
so a wrong name fails at the first request instead of silently degrading.

`Agent.observe_references` now holds the branch that was inline in `run_batch`, so the
disabled path is testable without a gateway. Ten unit tests cover the selection, the off
tokens, the process environment, the disabled agent path and the enabled one.
`python -m unittest discover -s tests -v` reports **176 tests, 0 failures, 11 skipped**,
against 169 on main. The 11 skips are the same machine-local browser and Docker-image cases.

## 7. Board consequence, and what it costs to undo

The Ticket Booking board reflects the team's most recent passing run, not its best. Before this
work VOLO AI was rank 2 at CNY 0.629725 and efficiency 158.80. It is now rank 4 at 0.779834 and
128.23, because variant A's passing run replaced the retained one. Rank 1 remains a team at 80%
pass rate, 0% feature implementation and CNY 0.000024, which the 80% eligibility threshold
admits. Restoring rank 2 needs one more official run on the unchanged default; both trials
allotted to this task are spent.

## 8. What this does not establish

- One official sample per variant. The retained run's own 72,854 against variant A's 173,870
  is the size of the noise, and the observation is 8,671 tokens inside it.
- The claim that the observation buys fewer repair rounds is a mechanism consistent with three
  runs, not a measured effect. Two calls, six calls and fourteen calls is a trend of three.
- `qwen3.6-flash` has a 20 of 20 local gate and no passing official run. Its one trial failed
  for an unrelated reason. Defaulting to it on that evidence would trade a measured CNY 0.25
  saving against an unmeasured risk of scoring zero, which the 80% eligibility threshold makes
  total. That is why the default did not move.
- The image-support probe is one request per model on one screenshot. It is enough to rule
  `deepseek-v4-flash` out and enough to put `qwen3.6-flash` and `minimax-m3` in, and it is not
  a ranking of how well either reads a UI.
