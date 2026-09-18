# Which gateway models can read a screenshot, and what they cost (2026-09-14)

Two questions arrived after the [image ablation](../archive/legacy-harness/image-ablation-2026-09-14.md): whether
`deepseek-v4.1-flash` can carry the reference-image observation, and whether the price table's
`qwen3.6-flash` row is real. Both are answered by measurement here. Raw numbers are in
[`evidence/2026-09-14-vision-model-availability.json`](../evidence/2026-09-14-vision-model-availability.json).

## 1. `deepseek-v4.1-flash` is not served by this gateway

Four independent checks, all negative.

| Check | Result |
|---|---|
| `GET /v1/models` | 11 ids, none a 4.1 |
| One-token probe, four spellings | HTTP 400 `provider_not_selected` for each |
| Same probe, a deliberately fake name | the identical HTTP 400 `provider_not_selected` |
| Same probe, `deepseek-v4-flash` | HTTP 200, served as `deepseek-v4-flash` |
| 143 runs on the shared account | `model_name` is always one of the 11 |
| 31 leaderboard rows across five competitions | only `deepseek-v4-flash` and `qwen3.6-flash` |

The exposed ids are `deepseek-v4-flash`, `deepseek-v4-pro`, `glm-5.2`, `glm-5.3`, `kimi-k3`,
`minimax-m3`, `qwen3.6-flash`, `qwen3.6-plus`, `qwen3.7-max`, `qwen3.7-plus`, `qwen3.8-max`.

The control matters: `provider_not_selected` is this gateway's unknown-model response, not a
missing header on our side. A name we invented returns it too, and a known-good name does not.

## 2. Only some models actually see an image

The gateway accepting an image payload is not evidence that the model receives it. Measured with
the run's own 1,746×1,021 registration screenshot, asking for the visible section heading and the
first three field labels.

| Model | Prompt tokens | Sees the image | Response |
|---|---:|---|---|
| `kimi-k3`, three images, for scale | 7,349 | yes | the retained run's observation |
| `deepseek-v4-flash` | 209 | **no** | "Image data is truncated; unable to transcribe." |
| `qwen3.6-flash` | 1,801 | yes | 账户信息, 用户名, 登录密码, 确认密码 — correct |
| `minimax-m3` | 2,538 | yes | correct |

209 prompt tokens is the text prompt alone; 146 KB of pixels never reached the model. That is the
dangerous failure mode, because the call still returns confident text. Any future observer change
must transcribe a known screenshot before it ships, not merely return HTTP 200.

## 3. The `qwen3.6-flash` price row is confirmed against official charges

The [token accounting](2026-09-14-token-accounting.md) solved `qwen3.6-flash` at 1.2 CNY per
million cache-miss input and 7.2 output, with the cache-hit rate unobserved. Reconstructing three
official runs from captured per-request usage, with `deepseek-v4-flash` at 3/0.1/9 and `kimi-k3`
at 20/2/100:

| Run | Models | Captured tokens | Official tokens | Reconstructed CNY | Official CNY |
|---|---|---:|---:|---:|---:|
| [`01b06fb30564`](https://arc-bench.com/runs/01b06fb30564) | `kimi-k3` + `deepseek-v4-flash` | 72,854 | 72,854 | 0.629725 | 0.629725 |
| [`d855ead6df43`](https://arc-bench.com/runs/d855ead6df43) | `deepseek-v4-flash` | 173,870 | 173,870 | 0.779833 | 0.779834 |
| [`8abb7f040604`](https://arc-bench.com/runs/8abb7f040604) | `qwen3.6-flash` + `deepseek-v4-flash` | 477,861 | 477,861 | 1.072651 | 1.072651 |

Zero token gap in all three, so no meter contamination, and the charge reconstructs to six
decimals. The third run pins `qwen3.6-flash`: its observation call was 5,462 prompt tokens with
no cache hit and 4,236 completion tokens, CNY 0.037054, and the total only lands on the official
figure at 1.2 and 7.2.

**`qwen3.6-flash` is not the same price as `deepseek-v4-flash`; it is cheaper**, 1.2/7.2 against
3/9. Its cache-hit rate remains unobserved, because a single observation call per run has never
had a cache hit. Reading the three references costs CNY 0.037054 on `qwen3.6-flash` against
0.284180 on `kimi-k3`, a measured saving of CNY 0.247126 per Ticket Booking run.

## 4. A single official trial cannot measure the observation

Four official Ticket Booking runs now reconstruct their charge exactly from captured usage, so
their split between the observation and the generation is a measurement, not an estimate.

| Run | Observer | Observation CNY | Generation calls | Generation CNY | Total CNY | Tests |
|---|---|---:|---:|---:|---:|---|
| [`01b06fb30564`](https://arc-bench.com/runs/01b06fb30564) | `kimi-k3` | 0.284180 | 2 | 0.345545 | 0.629725 | 10 of 10 |
| [`d855ead6df43`](https://arc-bench.com/runs/d855ead6df43) | none | 0 | 6 | 0.779833 | 0.779834 | 10 of 10 |
| [`b6b89caa3f8c`](https://arc-bench.com/runs/b6b89caa3f8c) | `kimi-k3` | 0.266640 | 3 | 0.604138 | 0.870779 | 10 of 10 |
| [`8abb7f040604`](https://arc-bench.com/runs/8abb7f040604) | `qwen3.6-flash` | 0.037054 | 14 | 1.035597 | 1.072651 | did not reach the suite |

The first and third rows are **the same agent, the same default, the same model and the same
task**, and they differ by CNY 0.241054. The entire `kimi-k3` observation is CNY 0.266640 to
0.284180. The run-to-run spread of identical code is the size of the thing we were trying to
measure, so no single trial can resolve it, in either direction. The earlier reading that
removing the observation "cost more" is equally unsafe: `d855ead6df43` at 0.779834 sits between
two runs of the unchanged default.

Generation cost across the four runs is 0.345545, 0.604138, 0.779833 and 1.035597, a threefold
spread driven by how many repair rounds the run needs. That, not the observer, is the cost.

This is why the default moves on price arithmetic instead of on a trial, and the size of the
claim has to match the evidence. What is measured is that the observation call itself costs
**CNY 0.23 to 0.25 less** per run: on the two `kimi-k3` runs, switching to `qwen3.6-flash` would
have saved CNY 0.247126 and 0.229586. **The end-to-end effect is unmeasured.** The observation
text grew from about 1,300 tokens to 4,236, so the model, the content and the length of the
observation all changed at once; it is not an input-price change with everything downstream held
fixed. The extra roughly 3,000 prompt tokens on the generation call are about CNY 0.009 at the
cache-miss rate, but nothing here bounds the effect of a different observation on how many repair
rounds the generation then needs, which is where the threefold cost spread lives.

## 5. Confirmation condition

No official trial was spent on this change, by agreement with the team lead, because section 4
shows a single trial cannot resolve it and a passing run at a high cost would replace the board
entry. The flip must still be confirmed by an official trial. Until one exists, this default
rests on a 20 of 20 local gate and price arithmetic on confirmed rates, and on nothing else.

**Correction, 2026-09-14.** This section originally required that trial to come *after* the
frozen-self-check fix on `fix/selfcheck-deadend`, on the grounds that the trap had ended
`8abb7f040604`. It had not. That run contains no frozen check at all; its budget went to four
edits that never applied and six read-only diagnosis calls, and its failing logout check was a
genuine product race. The scheduling constraint therefore does not apply: an observer trial taken
before or after that fix is equally valid, because the trap was never in the observer's path. The
fix is still worth having on its own merits, and the repair loop is still the dominant cost
lever, but neither is a precondition for confirming this default.

## 6. What this does not establish

- The probe is one request per model on one screenshot. It is enough to rule `deepseek-v4-flash`
  out and to put `qwen3.6-flash` and `minimax-m3` in. It does not rank how well either reads a UI,
  and `qwen3.6-flash` returned 4,236 observation tokens against `kimi-k3`'s 1,322, so it is
  chattier for the same three images even though it is far cheaper per token.
- `glm-5.2` and `qwen3.6-plus` were not measured on a real screenshot. `qwen3.6-plus` rejected an
  8×8 probe for being under a 10-pixel minimum, which shows it decodes the payload; `glm-5.2`
  returned 20 prompt tokens on that probe, which suggests it drops it. Neither is settled.
- `minimax-m3` has no entry in the price table, so it cannot be costed and was not considered
  further.
- The absence of `deepseek-v4.1-flash` is a fact about this gateway on this date. It says nothing
  about whether the model exists elsewhere.
- Four runs are four runs. The claim is the narrow one: the spread of identical code exceeds the
  observation line item, so a single trial cannot decide it. That is not a distribution, and it
  does not predict any particular next run.
- `qwen3.6-flash` still has no passing official run. The argument for it is arithmetic on
  confirmed rates plus a 20 of 20 local gate, not an official result.
