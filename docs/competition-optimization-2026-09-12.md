# Three-board optimization model

The [fixed-agent model comparison and research](model-comparison-2026-09-12.md) is the
latest continuation. It adds success-adjusted total cost to the objective, records a
new Evolution best with Qwen, and distinguishes a verified Smoke contract omission
from the deferred Ticket failure.

The target is **100% and rank 1 on Smoke, Smoke Evolution and Ticket Booking**,
then a measurable lead, then the supplied broader task corpus. Ticket rank 1 at
90% does not meet that target. This review advances diagnosis and experiment design;
it does not claim a new competition result.

**Latest user direction:** pause Ticket investigation after obtaining the available
official failing step. First submit the unchanged current dev35 agent with Flash to
both small boards and measure the result. This is an authorized four-task comparison,
not an ablation or a Ticket resubmission. Its results will be recorded below. The
longer-term three-board objective remains, with Ticket temporarily deferred.

Current source is main `48fc9a6`, containing dev35 `70e9236`. The frozen submission
ZIP remains `081a5e66334114a86648a8f12017214a983b1a95b690476658a421ef48529f8c`.
No production code or evaluator files changed in this review. The subsequent user-authorized
small-board trial selects Flash for both boards; the older Evolution winner selected Qwen.

## Live baseline

Official API observations at **18:40 Taipei, September 12, 2026**:

| Board | VOLO rank | Pass rate | Official CNY | Runtime | Strongest other eligible row |
|---|---:|---:|---:|---:|---|
| Smoke | 3 | 100% | 0.016023 | 5 s average | 100%, CNY 0.003099 |
| Smoke Evolution | 2 | 100% | 0.017810 | 7 s average | 100%, CNY 0.004617 |
| Ticket Booking | 1 | 90% | 0.668715 | 212 s | 80%, CNY 2.407166 |

These are respectively the two-task aggregate boards and the Ticket task-filtered
board. A team can have multiple rows. Compare with the strongest eligible **other
team's row** on the same board, rather than counting our older entries as opponents.
All three responses expose an 80% efficiency threshold. Their efficiency values
match percentage pass rate divided by official CNY. Final-contest weights, tie rules
and the exact selection of repeated runs remain separate questions; this observation
does not invent those rules.

The visible run list has no RUNNING/QUEUED run. The two historical unstarted PENDING
runs were left untouched. Meter balance returned HTTP 401, so available balance is
unknown. This is not evidence of zero balance. The live catalog now lists six large
web applications and **484 tests**, whereas the older corpus note recorded 480.

Sources: [Smoke API](https://arc-bench.com/api/competitions/leaderboard?track=all&competition_id=smoke),
[Evolution API](https://arc-bench.com/api/competitions/leaderboard?track=all&competition_id=smoke-evolution),
[Ticket API](https://arc-bench.com/api/competitions/leaderboard?track=all&competition_id=ticket-booking&task_id=ticket-booking),
[E057 run](https://arc-bench.com/runs/a129e387e562).
The retained [baseline evidence](evidence/2026-09-12-optimization-baseline.json)
records the observation time, calculation inputs and evidence hashes.

## What is actually deficient

### Ticket: the last failure occurs before registration

The fresh official Playwright report narrows E057's only failure to registration
spec line 67, `passwordStrength.evaluate(element => element.outerHTML)`. Filling
`short` and the preceding visibility assertion returned. The strong-password update,
registration submission and subsequent session checks had not executed.

This rules out registration password hashing or persistence as the explanation for
this specific failing step. It does **not** prove that `evaluate` itself consumed ten
seconds: the report has a test-wide timeout, no per-step timings and no attachments.

One new replay of the **unchanged E057 product** passes **10/10**, with zero skips
or flaky cases. The registration test takes 1,050 ms. It uses:

- unchanged public spec/helper bytes, Playwright 1.57.0, ten-second tests and no retry;
- workers=4, fullyParallel=false, and two actual workers, matching the official report;
- the existing VOLO launcher with ports 3000/3301;
- a disposable Linux app container limited to one CPU and 256 MB, with a fresh writable
  application copy; the browser is the installed macOS Chrome.

The official browser image, host scheduling and app-plus-browser resource allocation
are not reproduced. This local success is one fixed-product observation, not a new
official pass or a measure of generation reliability. No new ten-run stress grid is
warranted merely because the first replay passed.

E057's inspected `updateStrength` changes the native meter's value and sibling segment
colors; it does not hide, debounce or replace that meter. Fable's second-round suggestion
of a delayed DOM replacement remains unsupported by this source. Keep hypotheses tied
to the actual failing step rather than adding generic authentication or UI rules.

### Small boards: both inputs and outputs cost too much

The exact two winning Smoke traces already use one Flash call each, no reasoning tokens
and no image observation. There is no extra planning call to remove.

| Smoke task | Input tokens | Output tokens | Product HTML characters | Self-check characters |
|---|---:|---:|---:|---:|
| Counter | 1,177 | 554 | 880 | 919 |
| Dice | 1,113 | 463 | 606 | 799 |

Using the retained price snapshot, the two runs' input contribution is CNY 0.006870 and
output contribution CNY 0.009153, exactly reconciling their official CNY 0.016023 total.
This is about **43% input / 57% output**. Self-check character counts identify a candidate
for reduction; they are not token counts or a predicted saving.

To match today's first place requires approximately **80.7% less Smoke cost** and
**74.1% less Evolution cost** at full correctness. Removing a few prompt sentences is
not a demonstrated route to either target. Measure input reduction and output reduction
separately, then test their combination only after each contribution is understood.

Evolution's winning counter run generates a whole HTML replacement and a whole test
replacement. Its current-invocation usage is 1,692 input / 1,284 output tokens; winning
dice is 1,582 / 644. The inherited trace also contains its original Smoke generation;
counting every response in that file would double-count the template's history.
The prior counter attempt uses fewer captured output tokens but a higher official
cost, so output length alone cannot predict the leaderboard charge for every run.

### Ticket has expensive reasoning, but correctness comes first

E057 uses Kimi image observation (8,671 captured tokens, approximately 41.1 s), then
one Flash build (42,286 captured tokens, approximately 165.3 s). Flash reports
23,166 reasoning tokens out of 31,113 completion tokens, **74.5%**. Its generated checks
are 10,196 characters versus 16,515 characters of HTML/API product code.

These are concrete reduction candidates. Disabling reasoning before achieving full
acceptance could lose the useful reasoning that produced 9/10. Test that ablation after
a full-pass baseline, unless a bounded comparison is specifically justified.

The official report records 555,255 tokens while captured responses total 50,957.
Do not infer missing calls, an effective mixed unit price or a billing error from that
ratio. Keep official CNY for ranking; keep per-invocation response usage for diagnosing
work. Reconcile future runs within an attributable billing interval where possible,
without changing another user's shared key or activity. An unresolved Ticket discrepancy
does not invalidate the four small-board winning runs whose response-based calculations
match their official charges.

### Evidence and decisions have been mixed

E057 passed its first eleven generated checks. The dev35 bounded repair branch did not
run, so E057 does not establish that branch's real-model convergence. Similarly, a public
spec being provided to the model is not a spec execution. The current result explicitly
says independent acceptance is not configured. A new verifier only earns its cost if
it distinguishes a real faulty product from a corrected control or prevents a measured
failure. Pi transport probes and the broader scheduler audit are not quality baselines.

## Optimization model

Keep the model small enough to guide the next experiment. A candidate `theta` fixes
source/package, model and thinking policy, inputs, context policy, repair budget and
runtime. Generated product `A = G(theta, task, generation randomness)` and evaluation
`Y = Eval(A, evaluator environment)` are different experimental units.

For board `b`, record pass fraction `q_b`, official CNY `C_b`, observed rank `r_b`,
and efficiency `E_b = 100*q_b/C_b` when the official eligibility rule applies.
Let `E*_b` be the strongest eligible other-team efficiency in the same dated snapshot.

The campaign target is the following **ordered** objective, not a weighted average:

```
1. Minimize D = max_b(1 - q_b), until D = 0.
2. Reach r_b = 1 on every board while retaining q_b = 1.
3. Increase M = min_b(E_b / E*_b), subject to the full-pass gates and budget.
```

`M` is a dashboard of our weakest relative lead. It is not the rule that allocates
every next experiment to the weakest small board. Choose the next action by whether
its possible outcomes would change a decision, its chance of advancing an unmet gate,
and its measured cost. Keep budget as an explicit constraint, not an invented coefficient
converting dollars, human attention and reliability into one score.

Separate three views:

1. **Leaderboard achievement:** dated official full-pass rows and ranks.
2. **Candidate promotion:** predeclared new generations with the same frozen candidate;
   retain every failure, compare median cost across complete trials, and report the worst
   pass fraction. Never discard failed runs to improve the cost denominator.
3. **Diagnosis:** fixed-product replays, self-checks, public-spec execution and response
   usage, each labeled with its actual environment and scope.

One complete Smoke/Evolution board trial contains both tasks; Ticket contains one.
Two specs or ten test cases are not ten independent generated applications. A development
run can nominate a candidate; a separate frozen-version repeat validates that nomination.
If it passes, up to two further complete trials can provide a small operational stability
gate within the authorized cap. Record `k/n`; three successes are not proof of 95%
reliability. Under an IID Bernoulli assumption, 3/3 has only about a 36.8% one-sided 95%
lower bound. Local repeat success is not a lower bound on official reliability.

Twofold efficiency on every board is a **proposed stretch interpretation** of a substantial
lead, not an agreed replacement for the user's words. At this snapshot, full-pass costs
for that interpretation would be at most CNY 0.0015495, 0.0023085 and 1.50447875 respectively.
The small-board targets are unproven. Do not infer a physical minimum from rounded tokens
or a two-second leaderboard row. If measured reductions reach diminishing returns before
that stretch goal, present the actual frontier and opportunity cost for a user decision;
do not silently abandon either full correctness or the requested sequence.

## Next experiments and decisions

| Experiment | Controlled change | Evidence that changes the next decision | Stop / promotion rule |
|---|---|---|---|
| T1: locate the Ticket stall | Fixed E057, one instrumented diagnostic replay of the steps before line 67; separately vary a justified browser/environment factor | Time spent before evaluate; DOM identity and pending operations; match official error location | A matching reproducible cause permits one harness/input correction. Otherwise preserve the environment gap and require better official observability; no blind rewrite |
| S1: reduce small-task input | Same main candidate, models, task bytes and runtime; remove only measured redundant input | Actual new-generation usage plus unchanged public behavior | Advance only with complete-board full passes and lower measured cost; retain failure and stop that hypothesis when the same failure recurs |
| S2: reduce verification output | Reuse the existing external verification path with unchanged available public specs; change only the source of checks | Less model-written test output and a gate that rejects a known bad product and accepts its correction | Keep a fresh official full-pass result as a separate gate; record added wall time and any paid repair calls |
| E1: reduce repeated edits | Same Evolution source template/model; require minimal unique edits instead of whole-file replacements | Actual patch/output reduction with original plus incremental tests passing | Compare both tasks, including inherited behavior; no quality claim from patch size |
| T2: repair / full-pass confirmation | One correction justified by T1, frozen package and actual generated product | Official 10/10 and true run cost | No manually repaired answer app upload; failure returns to its concrete evidence, not unlimited resubmission |
| R1: confirm winners | Frozen candidate, independent new generations declared before the results | `k/n` complete-board passes; all-run median cost and latency | A failure keeps the stability gate open. Do not keep sampling until only the best run looks good |

T1 is now deferred by the user. Before that change, T1 and the no-model parts of S1/S2 were independent. Ticket's unknown environment does not
require stopping useful small-board work. Official runs stay serialized within a submission
chain. Before a bounded paid batch, record the task list, run limit, cost observations
and balance availability. An unknown balance stays unknown; do not report it as zero
or imply that a task-count cap guarantees an exact monetary cap. Prior competition authorization remains valid; the current user message explicitly authorizes
the unchanged-agent small-board comparison, so it does not require another approval;
this review does not authorize an unlimited automatic campaign or create a scheduled run.
The API may finish billing after cancellation, so token/time guards are not an exact CNY cap.

An experiment row should contain only: hypothesis, one changed factor, source/package and
input hashes, model/settings, artifact/run IDs, local and official results, captured usage,
official CNY, duration, disposition and the next decision. Consultation USD, official CNY,
and engineering time are separate totals. No new experiment-management framework is needed.

## Transfer after the three boards

The [supplied corpus](corpus.md) contains 22 documents, 20 after semantic deduplication:
six web packs with public specs, ten mobile packs without executable specs, and
GitHub/Sheets/demo/Ticket. Parsing all 22 does not establish successful execution.

After the three-board achievement and lead gates:

1. Check small unseen requirement variants with a version frozen before their evaluation.
2. Use a modest web pack, such as BookStack, for an end-to-end development slice; verify
   current requirements and actual executable-test counts before choosing its scope.
3. Reserve a whole different web pack, provisionally PrestaShop, for a transfer evaluation.
   Earlier generic scheduling/source exposure means it is a held-out **development task**,
   not a claim that nobody has ever seen its public requirements. Freeze before task-specific
   tuning and report the first result, including failure.
4. Expand toward the published GitHub/Sheets competition work with current rule/test packs.
   Treat mobile execution as a separately scoped runtime project once its evidence exists.

Do not optimize all twenty tasks first and then call their results unseen generalization.
The practice boards also do not establish a final GOSIM championship.

## Fable consultation and review limits

Two fresh tool-free Fable 5.1 advisory calls completed. Codex supplied evidence, challenged
the initial answer and checked the suggestions against source and official reports.
Fable did not inspect files or run tests itself. CLI-reported combined consultation cost
is approximately **USD 1.1021**, including auxiliary Haiku usage; this is an estimate,
not a competition charge. The consultation and fixed replay made **zero** official competition runs. A later user
message separately authorized the four-task small-board comparison recorded below.

The [dialogue and decisions](fable-optimization-dialogue-2026-09-12.md) preserve both answers.
Adopt the separate reliability/leaderboard views, measured input/output reductions and
bounded single-factor experiments. Reject the initial slow-hash and missing-nine-tenths
claims; also reject a local pass rate as a probability lower bound, unmeasured DOM-replacement
claims, automatic infrastructure expansion, and using the old 90% run's cost as an absolute
ceiling that would prevent attaining 100%.

Remaining unknowns are explicit: the official line-67 cause, exact billing attribution for
anomalous runs, repeat-run aggregation/tie policy, and current meter balance. No full regression
suite was rerun for this documentation-only review; the new actual test evidence is the fixed
E057 ten-test replay above, not a new 163-test or official acceptance claim.


## Current dev35 submitted to the small boards

The user's follow-up explicitly deferred Ticket and requested this comparison before
optimizing further. Submit the exact E057 agent package with DeepSeek V4 Flash to both
small boards, with no code changes or automatic retries. Test both tasks on each board.
The old Smoke reference is v0.6.0; the old Evolution reference is dev16 with Qwen3.6 Flash.
This comparison answers whether the current submitted combination is better, not which
individual historical change caused any difference.

All four runs completed with **6/6 official tests passed**. The batch cost is
**CNY 0.037653**. No automatic retry or Ticket run occurred. Final run-list inspection
shows no RUNNING/QUEUED run.

| Board | Current dev35 + Flash | Previous best | Change | New row rank | Team best rank |
|---|---:|---:|---:|---:|---:|
| Smoke | 100%, CNY 0.015135 | 100%, CNY 0.016023 | 5.5% cheaper | 3 | 3 |
| Evolution | 100%, CNY 0.022518 | 100%, CNY 0.017810 | 26.4% more expensive | 4 | 2, retained Qwen row |

The official average-runtime fields are four seconds for the new Smoke row and five
seconds for the new Evolution row. Those are not full submission-to-result latencies.
Both current combinations still cost approximately 4.9 times their respective leaders.
The newer agent therefore does not dominate both historical winners. Preserve the new
Smoke best and the existing Evolution best; the leaderboard retains the older rows.

Runs: Smoke [counter](https://arc-bench.com/runs/97bb0befad0a),
[dice](https://arc-bench.com/runs/096d97ac9729); Evolution
[counter](https://arc-bench.com/runs/576813a77e3d),
[dice](https://arc-bench.com/runs/9523ff0e9580).
[Detailed comparison and trace hashes](evidence/2026-09-12-dev35-small-boards.json).

The new Smoke responses total 2,342 input / 901 output tokens, versus the older
2,290 / 1,017. Inputs increased slightly while outputs decreased in this sample.
That is an observed decomposition, not proof of a deterministic improvement caused by
dev35. The Evolution comparison additionally changes the model from Qwen to Flash.
One new generation per task cannot establish a reliable superiority claim.

The immediate next gate is measured small-task cost reduction while retaining all
public behavior. Keep Ticket deferred. No additional model trial, second batch or
scheduled continuation was started after this comparison.
