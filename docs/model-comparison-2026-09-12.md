# Fixed-agent model comparison

The user suggested that model characteristics may explain the small-board results.
Test that hypothesis with the unchanged dev35 package, using Qwen3.6 Flash against
the immediately preceding DeepSeek V4 Flash runs E058–E061. Ticket remains deferred.

This is a comparison of the models as configured by the existing adapter. It is not
a ranking of their intrinsic coding ability. Both are instructed to disable thinking;
DeepSeek receives `temperature=0`, whereas the existing Qwen adapter leaves temperature
at the provider default. Those settings were recorded, not silently changed for the trial.

## Controls and units

- Agent source: `70e9236`; checkout before this review: `2305ef4`.
- Same ZIP for both models:
  `081a5e66334114a86648a8f12017214a983b1a95b690476658a421ef48529f8c`.
- Same model gateway, maximum output of 16,384 tokens, runtime, prompts and tools.
- Complete each board's two tasks. One new generation per task, no automatic mutation
  retry, maximum four new runs; stop if a candidate fails or completed charges exceed
  the CNY 1 guard before starting another run. This guard is not a hard billing cap.
- Run Evolution before generating another Smoke template. Compare requirement
  fingerprints, complete first-request messages and tool-schema hashes afterward.
  Reading only the task ID would not establish that the starting applications match.
- Exclude inherited template trace events before counting the current invocation.

The immediately preceding Flash comparison is the control, including all four tasks.
The historical dev16/Qwen winner is a separate reference, not the same-agent control.
One sample per model/task cannot establish long-run reliability or a durable provider
trait. No large sweep or subsequent paid batch belongs to this comparison.

## How to interpret a difference

Keep correctness, generated output and price separate. The decision is to preserve
full official acceptance first, then compare cost and reproducibility of the configured
candidate. A lower price per token does not guarantee a lower run charge if the model
produces substantially more output or requires repair. Cross-model token counts also
use different tokenizers, so retain actual output character counts and patch structure.

The Evolution counter provides a concrete example: both models pass 2/2 with identical
request messages and tool schemas. Qwen generates whole replacements for the HTML and
checks, using 1,218 output tokens, while Flash uses 439. Qwen's actual charge is
CNY 0.010787 versus Flash's CNY 0.009366, about 15.2% higher despite its lower retained
unit-price schedule. This describes this sampled output, not a rule that Qwen always
writes larger patches.

For the campaign, treat model/provider settings as an optimization dimension alongside
input size, output format and repair policy. Avoid changing all of them at once. Select
models on the actual task family and confirm candidates with predeclared independent
trials before making reliability claims. A model switch that passes the small public
tasks does not establish an advantage on the deferred Ticket task or the larger corpus.

## Official results

Three runs completed; the fourth was not started after the first failed candidate.
All three new requests have the same requirement fingerprints, exact message hashes
and tool-schema hashes as their corresponding Flash controls.

| Task | Flash control | Qwen result | Official Qwen CNY | Run |
|---|---:|---:|---:|---|
| Evolution Counter | 2/2, CNY 0.009366 | 2/2 | 0.010787 | [f6082b65cf6e](https://arc-bench.com/runs/f6082b65cf6e) |
| Evolution Dice | 2/2, CNY 0.013152 | 2/2 | 0.005837 | [afd068451ab7](https://arc-bench.com/runs/afd068451ab7) |
| Smoke Counter | 1/1, CNY 0.008145 | 0/1 | 0.052143 | [224d26e14467](https://arc-bench.com/runs/224d26e14467) |
| Smoke Dice | 1/1, CNY 0.006990 | Not run | — | Stop condition reached |

Evolution remains rank 2 with a new personal best: **4/4 at CNY 0.016624**, 26.2%
cheaper than current dev35/Flash and 6.7% cheaper than the historical dev16/Qwen best.
The first-place cost is still CNY 0.004617. This nominates Qwen for this task family;
it does not establish a reliable or universal model advantage.

The Smoke failure is an observed product contract omission. The official report waits
at spec line 10 for `getByTestId('count')` to show `0` and reports no matching element.
The downloaded final HTML has `id="count"` but no `data-testid`; the requirement explicitly
asks for test id `count`. Generated self-checks use `#count` and pass. This is a confirmed
mismatch between product/self-check and the requested interface, unlike the unresolved
Ticket timing issue. Do not label every timeout as a platform failure.

That Smoke run reports 268,975 official tokens versus 1,915 captured response tokens.
Its CNY 0.052143 remains the actual reported charge; the discrepancy is unresolved and
must not be attributed to token efficiency. Total charges for the three runs are
**CNY 0.068767**. No additional retry, Smoke Dice run, Ticket run or automation started.
Final run-list inspection contains no RUNNING/QUEUED run.

[Detailed receipts and matched-input evidence](evidence/2026-09-12-model-comparison.json).
Raw source, logs and papers are retained locally in canonical-checkout
`runs/20260912-model-comparison/`.

## Research: an expensive model can cost less per completed task

The user's follow-up points to a different mechanism from these one-call trials:
a more capable model can need fewer steps or retries, reducing total input/output
and the cost of repeatedly carrying history. Unit price, inference effort and task
completion cost therefore need separate measurements.

Relevant primary papers checked on September 12:

- **Prompt-Induced Waste in Coding Agents** (2026 preprint, v6),
  [Appendix J and Section 7](https://arxiv.org/html/2608.01347v6).
  In its six-task Kimi replication, the authors report the lowest baseline cost per
  compliant success for Kimi-K3 despite 2.5–3.3 times the unit prices of its K2 comparators.
  Lower reasoning volume and substantial caching both matter. This is a bounded
  reported result, not proof that fewer tool steps alone caused the saving.
- **How Do AI Agents Spend Your Money?** (2026 preprint, v2),
  [Sections 3–5](https://arxiv.org/html/2604.22750v2).
  Eight models are evaluated with OpenHands on 500 SWE-bench Verified tasks, four
  runs per task/model. Model-specific file-access and revision patterns explain part
  of the token variation; efficient models do fewer repeated actions. Its retained
  full-history setup differs from VOLO's bounded context policy.
- **AI Agents That Matter** (2024),
  [paper](https://arxiv.org/abs/2407.01502).
  Jointly evaluate accuracy and cost and use held-out evaluation; leaderboard accuracy
  alone can reward unnecessarily expensive systems. This supports the evaluation
  method, not a rule that premium models always have lower total cost.
- **FrugalGPT** (2023),
  [paper](https://arxiv.org/abs/2305.05176).
  Model selection/cascades can improve the cost–accuracy tradeoff. Its query tasks
  are adjacent evidence rather than a direct experiment on long coding trajectories.

Add this metric to the existing full-pass/rank objectives, within a fixed task family
and a predeclared evaluation cohort:

```
Cost per successful task = sum(cost of every attempt) / count(fully successful trials)
```

Failed attempts remain in the numerator. If nothing succeeds, report no finite estimate;
do not call a failed cheap run efficient. For independent identically configured restarts,
the theoretical quantity is expected attempt cost divided by success probability. This
is an accounting model, not authorization to keep restarting until success.

For each run, retain uncached input, cached input/write, output/reasoning where reported,
model rounds, repeated reads/edits, repairs, terminal success, wall time and provider CNY.
Report the all-run mean/sum and successful-trial count alongside median and tail behavior.
Do not silently compare different task mixes or omit expensive failures.

The three new Qwen runs and their Flash controls each used one model call. They test
output choices and pricing, **not the hypothesis that a stronger model needs fewer
iterations**. That needs a later matched task slice with actual multi-step execution
or recovery. Ticket stays deferred under the current user instruction; this research
adds a future comparison axis rather than starting a premium-model campaign.
