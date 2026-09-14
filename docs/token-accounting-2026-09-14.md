# Token accounting: where the official 555,255 comes from

Read-only reconstruction of run [`a129e387e562`](https://arc-bench.com/runs/a129e387e562) (E057,
Ticket Booking) and of the four small-board winning runs. Per-request data is in
[`evidence/2026-09-14-token-accounting.json`](evidence/2026-09-14-token-accounting.json).
No agent code was changed and no paid model call was made.

## 1. E057 request table

| # | Model | Prompt | of which cache-hit | Completion | of which reasoning | Total | Reconstructed CNY |
|---|---|---:|---:|---:|---:|---:|---:|
| 1 | `kimi-k3` reference observation, 3 images | 7,349 | 0 | 1,322 | 9 | 8,671 | 0.279180 |
| 2 | `deepseek-v4-flash` `build_app` | 11,173 | 4,096 | 31,113 | 23,166 | 42,286 | 0.301658 |
| **Captured sum** | | **18,522** | **4,096** | **32,435** | **23,175** | **50,957** | **0.580838** |
| **Official** | | | | | | **555,255** | **0.668715** |
| **Gap** | | | | | | **504,298** | **0.087877** |

The run made exactly two gateway requests. The runner's own log confirms it:
`[volo] model calls=2 reported_tokens=50957 finish=tool_calls`.

## 2. The official number is a meter delta, not a sum of responses

Two lines from the official runner log, fetched read-only with `./arcbench logs a129e387e562`:

```
[2026-09-12 10:02:54 UTC] [backend] Meter baseline captured for access key [REDACTED]
[2026-09-12 10:06:52 UTC] [backend] Meter usage captured: tokens=555255, cost=0.668715 CNY
```

`token_count` is the movement of the account's usage meter between run start and run finish. It
is attributed to whatever run happens to hold the window open. It is not derived from our
responses, and the platform never reads them.

## 3. Gateway price table, solved exactly

Six runs whose official `token_count` equals our captured usage exactly give six independent
equations in the per-model rates. Solving them over rationals yields round numbers:

| Model | Input, cache miss | Input, cache hit | Output |
|---|---:|---:|---:|
| `deepseek-v4-flash` | 3.0 | 0.1 | 9.0 |
| `deepseek-v4-pro` | 9.0 | 0.3 | 27.0 |
| `kimi-k3` | 20.0 | 2.0 | 100.0 |
| `qwen3.6-flash` | 1.2 | not observed | 7.2 |

CNY per million tokens. Validation: all four small-board winners reconstruct their official
charge to six decimals, with zero token gap.

| Run | Task | Captured | Official | Reconstructed CNY | Official CNY |
|---|---|---:|---:|---:|---:|
| `7fa25acde8dd` | smoke counter | 1,731 | 1,731 | 0.008517 | 0.008517 |
| `d8dcc590abac` | smoke dice | 1,576 | 1,576 | 0.007506 | 0.007506 |
| `8c8a9e509ec6` | evolution counter | 2,976 | 2,976 | 0.011275 | 0.011275 |
| `97e608e5381c` | evolution dice | 2,226 | 2,226 | 0.006535 | 0.006535 |

## 4. What the 504,298 unattributed tokens are made of

The gap carries only CNY 0.087877. With the `deepseek-v4-flash` tiers above, and writing the
unknown split as cache-miss input, cache-hit input and output:

| Bound | Value | Share of the gap |
|---|---:|---:|
| Maximum output tokens | 4,207 | 0.83% |
| Maximum cache-miss input tokens | 12,913 | 2.56% |
| Minimum cache-hit input tokens | 487,178 | 96.6% |

Half a million cache-hit input tokens with almost no generation is the shape of a long
multi-turn loop replaying a cached prefix. It is not the shape of our two requests.

## 5. Hypothesis verdicts

**H1, image tokens: refuted.** Six runs sent the identical three-image payload, 702,596 base64
characters, and their official `token_count` equals captured usage exactly: `234571af19bd`
(99,044), `df908f8ae72e` (428,387), `b9ec4b551834` (314,741), `1e3ae0daa6fe` (153,149),
`414be7cdfa56` (308,563), `71e0a28920b4` (320,116). The gateway bills the three images at 7,349
prompt tokens, consistent with 784-pixel tiles over the 5,405,706 pixels actually sent. The
images are metered correctly and cheaply.

**H2, reasoning tokens: refuted.** `reasoning_tokens` is a subset of `completion_tokens`, not a
separate charge. E057's generation call reports 31,113 completion tokens including 23,166
reasoning tokens; the visible tool arguments are 26,711 characters, which at the residual 7,947
non-reasoning tokens gives 3.361 characters per token, matching the 3.40 to 3.46 measured on the
small boards. The usage records carry `prompt_tokens_details.cached_tokens` and
`completion_tokens_details.reasoning_tokens` and no other token field. Reasoning is billed at the
output rate and fully reported.

**H3, retries or streaming: refuted.** The transport sets `stream: False` (`volo/model.py:54`).
Retries happen only on HTTP 429 and always emit a `model_http_error` trace event; E057's trace has
none, and the runner log independently reports two calls.

**H4, platform-side accounting: confirmed as the mechanism, refuted as extra platform calls.**
E057's complete runner log contains no model request made by the runner itself; feature and
traceability results come from artifacts, not from a judge model. But the meter is the accounting
path, and two documented properties make it leak. The account is shared: `docs/next-stage.md`
already records "Other runs share the account." And the meter is asynchronous: `docs/platform-cli.md`
records that `balance` exposes a synchronization timestamp and a pending billing-event count.
E057 is the last of 102 runs on the account and no other platform run overlapped its window, so
the residual is off-platform use of the same key, or meter events ingested late.

**Bonus, confirmed: an early cache double-count that has since been fixed.** For ten runs between
09-11 05:07 and 09-11 06:35 the gap equals `cached_prompt_tokens` exactly, to the token, in every
case: `39f46bfbb151` +56,832, `a1d0daf8b5bd` +8,192, `ad10919cab86` +6,144, `d3b6850824fb`
+17,152, `8ca47cd69670` +15,104, `2b15f59f6120` +16,128, `f781aa13b23a` +22,784, `874eca048ca3`
+14,592, `dfd21779b423` +4,352, `b30f19283f5a` +51,136. No run after 09-11 06:35 shows that
pattern. The cross-run table in the evidence file carries all 34 comparable runs: 15 match
exactly, 9 match after adding cache hits, 10 have a meter-contamination gap.

## 6. The gap is not the lever it looks like

The score is pass rate divided by **cost**, and the contamination is 13.1% of cost, not 90.8%.

| Quantity | Ours | Official | Contamination |
|---|---:|---:|---:|
| Tokens | 50,957 | 555,255 | 90.8% |
| CNY | 0.580838 | 0.668715 | 13.1% |
| Efficiency at 90% | 154.95 | 134.59 | −13.1% |

Running Ticket when nobody else touches the key is worth about 20 efficiency points. Worth doing,
since it is free, but it is not where the money is.

## 7. Levers, ranked by CNY saved per run

### Ticket Booking, against E057's CNY 0.580838 of real work

| Lever | Tokens saved | CNY saved | Share of our cost | Measurement |
|---|---:|---:|---:|---|
| Drop the Kimi reference observation | 8,671 + 1,575 prompt | 0.283905 | 48.9% | The call is 1.6% of E057's tokens and 48.1% of its cost, because `kimi-k3` bills 20/100 against flash's 3/9. Its 4,929-character output contributes 1,575 tokens to the generation prompt. |
| Halve the observation output | ~1,450 | 0.068500 | 11.8% | The observation is 4,929 characters, about 790 words, returned as 1,322 tokens at 100 CNY/M. `volo/references.py` caps it at 2000 words, so the cap is not binding. |
| Disable DeepSeek thinking | 23,166 | 0.208494 | 35.9% | `reasoning_tokens` measured directly, billed at 9 CNY/M. |
| Stop emitting `checks_js` | 3,034 | 0.027306 | 4.7% | `checks_js` is 10,196 of 26,711 argument characters. Official evaluation never runs it. |
| Compact the batch JSON | 628 | 0.001884 | 0.3% | `volo/requirements.py:120` uses `indent=2`; compacting saves 1,966 of 7,300 characters. |

Dropping the reference observation alone would move E057's efficiency from 134.59 to 231.04,
against the runner-up's 33.23. **This needs an ablation before it ships.** E057 scored 9/10 with
the observation in place and the one failing test is a password-strength meter, which is exactly
the kind of detail an image observation supplies. The requirement batch is 7,370 characters and
the public acceptance specs another 18,558, so the labels may already be stated in text; that is
a measurement someone has to run, not an assumption.

### Small boards

Our smoke pair costs CNY 0.016023 against the leader's 0.003099; our evolution pair costs CNY
0.017810 against 0.004617. Measured composition of the extra 2,000 to 4,000 tokens:

| Lever | Board | Tokens saved | CNY saved | Share of board cost |
|---|---|---:|---:|---:|
| Stop echoing `old` file text in `patch_and_verify` edits | evolution | 743 | 0.005350 | 30.0% |
| Stop emitting `checks_js` on one-shot tasks | smoke | 500 | 0.004500 | 28.1% |
| Scale the system prompt to the task | smoke | ~660 | 0.001980 | 12.4% |
| Compact the batch JSON | smoke | 298 | 0.000894 | 5.6% |
| Drop `application`, `all_requirements`, `reference_assets`, `inherited_constraints` on a single-ATOMIC task | smoke | 199 | 0.000597 | 3.7% |

The `old` echo is the clearest waste on either board: the model re-emits, at the 7.2 CNY/M output
rate, text it was already given at 1.2 CNY/M input. It is 39.1% of the evolution counter
completion and 37.4% of the dice completion.

The smoke system prompt is 1,584 characters, about 440 tokens per run, and most of it describes
Ticket-shaped concerns: routes, `api_js`, named meters, `role=alert` regions, multilingual
aliases. None apply to a counter or a die.

Taking all four smoke levers saves CNY 0.007971 and brings that board to about 0.0081 against
the leader's 0.003099, closing about 60% of the gap. What remains is the generated HTML itself,
432 tokens, and the requirement text we are handed, 626 tokens. Closing the rest would need a
structurally smaller output, not trimming.

## 8. What this does not establish

The price table is inferred from 34 observed runs, not from a published rate card. The
composition bounds in section 4 constrain the residual but do not identify who spent it. No lever
here has been ablated against a real run; every CNY figure is a measurement of what E057 and the
four winners actually sent and received.
