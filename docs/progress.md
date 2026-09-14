# Progress

## 2026-09-11 — Fresh implementation requested

- Confirmed the formal event and read its official home and rules pages through Chrome.
- Confirmed Smoke is a public practice competition, not the preliminary ranking.
- Recorded preliminary/final dates, allowed model families, evaluation dimensions and
  unresolved weights in `strategy.md`.
- User explicitly requested a fresh design and implementation with no reference to
  previous smoke code. No previous agent code is included in this repository.
- User authorized submission to the practice platform after implementation, with first
  place as an intermediate milestone. Overall ambition: win the final.
- User requested that the entire process be versioned in a Thunder GitHub repository.

### Next acceptance boundary

Deliver the first complete agent, deterministic tests, and a reproducible upload ZIP.
Then run real model-backed platform evaluations, inspect official results and usage,
and iterate from observed failures. A generated app or mock transport test is not enough.

## 2026-09-11 — Version 0.1 implemented

- Added requirement graph validation, topological batching, a single metered model
  transport, coding tools, real build/start/check verification, repair and verified recovery.
- Added redacted tracing, budget limits, subprocess environment cleanup and reproducible packaging.
- Ran 13 local checks successfully. They include a real local Node HTTP application,
  intentionally failing behavior followed by a repair, provider-protocol replay,
  fresh verification on checkpoint recovery, process timeout, path guards and archive reproducibility.
- Model responses in local protocol tests are explicitly synthetic. Real gateway and
  official competition verification are the next gate, not yet completed.
- Fixed a macOS `/var` versus `/private/var` path normalization issue found by execution tests.
- Current limitation: binary reference images are not yet analyzed.

## 2026-09-11 — First platform failure and version 0.2

- First real gateway run completed generation and self-checks, but official evaluation
  failed before any app assertions: the required Chromium revision was missing.
- Downloaded and inspected the actual run artifact. The generated checks installed a
  newer Playwright, whose browser garbage collection removed the evaluator's pinned revision.
- Added deterministic browser-module discovery, preserved the official cache, reduced
  redundant environment probing, and reused verification only for an unchanged source tree.
- Added a redacted fixture from the real gateway response and regression checks for
  browser-cache protection and existing-tool discovery. All 16 local checks passed.
- See `experiments.md` for official run link, source commit, measured cost and failure evidence.

## 2026-09-11 — Measured efficiency iterations

- Versions 0.2 and 0.3 both passed all official Smoke tests. Both reached second place;
  another team improved its result during the experiments.
- Traces showed unnecessary reasoning, fragmented writes and repeated runtime-code generation.
  Added a small-task path that keeps requirement-specific code and assertions model-generated,
  while supplying reusable build, serving and browser-test lifecycle code.
- Version 0.5 exposed a real empty-optional-field bug in this runtime. Version 0.5.1 fixes
  it, with a captured real tool-call fixture and a real HTTP regression test.
- Large requirements retain dependency-ordered batches and the full repair tool loop.
  Intermediate folder constraints are now included in batch context.

## 2026-09-11 — Practice milestone achieved

- Version 0.6.0 (`0abcf10`) passed both official Smoke tasks and reached **rank 1**.
- The selected submission cost CNY 0.016023 in total and averaged 5 seconds per task.
- Checked both the public leaderboard API and the Chrome leaderboard row.
- Retained source commits, failure analyses, redacted real fixtures, result links and
  a dated leaderboard snapshot. All 18 local checks passed before the winning upload.
- Promote this verified source to `main` and preserve version `v0.6.0` as the practice baseline.
- The final-championship objective remains ahead. Next gates are incremental behavior,
  stateful application correctness, transfer to unseen requirements, and the formal task packs.

### Evidence and privacy

Commit source, plans, redacted experiment summaries, selected reproducible fixtures
and official result links. Keep keys, sessions, private raw logs, generated working
directories and large artifacts out of Git. The public rules may change; annotate
each rule snapshot and experiment with date and source.

## 2026-09-11 — Evolution first place and broader harness preparation

- Ran unchanged v0.6.0 on Smoke Evolution from its own verified Smoke applications.
  Counter and Dice each passed 2/2 official tests. VOLO AI ranked first with 100% pass
  rate, CNY 0.056842 combined selected-run cost and 15 seconds average runtime.
- Ticket Booking saves uploads but cannot create a run. Recorded download-200 versus
  run-409 evidence and a separate archive-404 control. The user will contact the organizer;
  no model or official tests ran on those failed starts.
- Reviewed ARC, Octos, Codex, Claude Code documentation, Pi and DeepSeek Harness.
  Pinned source references and distinguished implemented policies from future candidates.
- Cataloged the supplied corpus: 22 YAML documents, 20 semantically unique. Added a
  reproducible, hash-checked inspection command without redistributing official tests.
- Corpus inspection exposed ancestor-container references that the scheduler expanded
  into false self-dependencies. Fixed their scheduling interpretation while retaining
  original model input. All 22 documents now parse and schedule.
- Added context projection with preserved raw evidence, complete recent tool exchanges,
  current workspace facts and latest actual failure. Unpressured prompts stay unchanged.
- Version 0.7.0.dev1 passed 26 local checks, including real HTTP failure/repair under
  context pressure. This development candidate has no official gateway evaluation yet;
  both recorded leaderboard wins remain attributed to the preserved v0.6.0 source.

## 2026-09-11 — CLI replaces repeated browser operations

- The user requested a CLI for lower-overhead submission and result inspection.
- Implemented authenticated upload, hash verification, run creation/start, status,
  change-only waiting, bounded logs, artifact download and leaderboard queries.
  Login is reused from a private local session; no credential is printed or committed.
- The real CLI chain succeeded on submission `c522484096e0` / run `0726df707e05`.
  Current platform upload/start behavior works. Older archive observations are kept
  as dated evidence, not an assertion that a current platform outage persists.
- The run then failed waiting for the first model response after 180 seconds. The
  downloaded artifact confirms a read timeout before generation or official tests.
  This separates the CLI integration result from the agent's remaining execution issue.

## 2026-09-11 — Reasoning evidence and a new deployment failure

- E012's 600-second read timeout recovered the first response after 500 seconds. The
  response reported 58,034 reasoning tokens and truncated its tool arguments. Later
  requests wrote configuration but repeated malformed file-write arguments; the agent
  exhausted its observed token budget at 190,383 reported tokens. Official tests did
  not run. Source traces and redacted usage metadata preserve this result.
- Version 0.7.0.dev3 explicitly requests low-effort DeepSeek thinking and asks for smaller
  file batches. Its saved ZIP downloads with an exact hash match.
- Both new runs failed before generation because the executor could not find run-local
  `agent.zip`. Stopped after one same-submission retry and updated the concrete report.
  The low-effort policy therefore has local validation only; no improved score is claimed.
- CLI cancellation was also exercised. A returned HTTP 500 was followed by a CANCELLED
  state, so the client preserves uncertain outcomes and never retries mutations silently.
- Refreshed leaderboard snapshots: both v0.6 Smoke wins remain current at observation;
  Ticket Booking has no passing application result. Ticket Evolution remains unpublished.
- All 39 local checks passed on the final development tree. The candidate, CLI,
  experiment outcomes, current deployment report and dated board snapshots are versioned
  together on `feat/platform-cli`.

## 2026-09-12 (Asia/Taipei) — Runtime repaired; complete reference input next

- User resumed after intermittent travel connectivity and confirmed another team had
  a Ticket Booking score. Live runs now confirm deployment and all 10 tests execute.
- Kimi K3 generates the app but exposes two gaps: authored UI checks were not selected,
  and the published tests use a different port from the runner's readiness probe.
- Dev4 adds a managed single-app launcher and automatic authored-browser-check coverage.
  Its DeepSeek run completes implementation with one coding response, passes self-checks,
  and scores 2/10 officially. Both ports replay identically at 5/10 locally.
- Local diagnostics prove missing visual headings, combined dynamic text and absent
  meter semantics account for the five local failures. Three disposable-copy edits
  pass 10/10, without changing tests or uploading manually repaired application code.
- A real metered Kimi image request reads the missing reference detail. Dev5 connects
  linked-image observations to generation and improves generic UI assertions; 48 local
  checks pass. Full official verification follows. Earlier practice wins remain dated.
- Used the user-supplied standalone ArcBench CLI for a successful real submission;
  the existing thin CLI handles hash/status/balance evidence. All credentials remain
  in private configuration outside Git. No other team's run or source was modified.

## 2026-09-12 (Asia/Taipei) — Reference flow and independent checks

- Dev5's full-resolution image group hits gateway HTTP 413. Dev6 bounds the encoded
  payload; the real three-image flow succeeds and the app scores 5/10 officially,
  compared with 9/10 when replaying the unchanged public tests locally.
- Dev7 adds browser acceptance planning before implementation. It exposes a context
  cost regression: seven responses consume 154,583 tokens and stop before verification.
  Dev8 reduces repeated context and compacts planning guidance; 56 local checks pass.
- Refreshed leaderboards: Smoke remains first; Smoke Evolution is now second behind
  a lower-cost 100% entry. Ticket Booking's account entry is second at 70%, from a
  separate submission; this new agent's best official Ticket result remains 50%.
- Individual-source retrieval now avoids full artifacts for small diagnostic files.
  Read-only polling tolerates bounded transient transport failures. Platform archive
  deployment still intermittently fails, while successful starts reach model execution.

## 2026-09-12 (Asia/Taipei) — Reduce the acceptance layer after real failures

- Immutable model-generated test programs introduced undefined variables and shared
  account fixtures. Removed that design and its temporary parser dependencies. Fixed
  checks now use literal UI contracts and harness-owned code; stateful scenarios remain
  real implementation-authored browser tests plus the separate official evaluator.
- A real Chrome probe confirms that missing native label association fails and a
  proper label repairs it. Dev12's Pro run is the next formal Ticket validation.
- Dev11 passes both Evolution tasks again. One-call verified edits reduce selected
  combined cost from CNY 0.056842 to CNY 0.030432 and average runtime from 15 to six
  seconds. Rank remains second behind CNY 0.018816. Dev13 trims byte-identical runtime
  source and repeated edit context; 59 local checks pass, with live cost verification pending.

## 2026-09-12 (Asia/Taipei) — Evolution first again; Ticket recovery remains unproven

- Dev16 with Qwen3.6 Flash passes all four Evolution tests and returns to first:
  CNY 0.017810 total, seven seconds average. Both tasks finish in one verified edit
  call. The `v0.7.0-dev16` tag preserves the exact source, and the live board snapshot
  is saved in `docs/evidence/2026-09-12-evolution-qwen-leaderboard.json`.
- The first Qwen attempt exposed default thinking and malformed single-string argv;
  provider-specific thinking control and pre-write command validation remove those
  observed extra calls. Metering from a run overlapping another account user is kept
  separate from the clean paired results used by the board.
- Ticket candidates still fail to complete verification reliably. Dev14 permits
  requirement-grounded corrections to training UI metadata, dev15 verifies authored
  test bundles as soon as they are written, and dev17 bounds source reads and removes
  the unprepared small-app tool from normal mode. These respond to recorded failures;
  65 passing local checks do not establish a higher official Ticket score.
- E032 first fails before startup because its run-local ZIP is absent. A same-package
  retry deploys successfully but exhausts 302,864 observed tokens before writing tests.
  Chunk reads work; excessive source rereads remain. Keep the ZIP unchanged for a Qwen
  model comparison. Best official Ticket accuracy from this fresh agent is still 50%.

## 2026-09-12 (Asia/Taipei) — Remove the misleading intermediate UI constraints

- Qwen reveals a JSON/tool-call mismatch; a narrow parser fix works in a real run.
  Its next run reaches app/test generation, but discovery excludes its chosen test
  framework and the run exhausts its budget before execution.
- Dev19 triggers authored test entrypoints by filename and retains a larger context.
  Two missing-archive failures recover after saving the byte-identical package under a
  fresh submission. Later Qwen and Pro requests stall; incomplete usage remains unknown.
- Pro's generated app also exposes a deeper design failure: the extra UI planner turns
  one required agreement checkbox with alternative names into two required controls.
  Offline public tests fail on that exact duplicate interaction.
- Dev20 removes the planning call, associated tools/module and five component-specific
  tests. Original requirements, observed references, actual build/start/check execution,
  incremental edits and trace integrity remain. All 61 remaining checks pass; an official
  dev20 Pro run is underway. No improved Ticket score is claimed yet.

## 2026-09-12 (Asia/Taipei) — Separate semantic quality from delivery overhead

- E037 completes real verification and repair but scores 3/10 officially. Its local
  public-test replay improves from 5/10 to 10/10 with diagnostic-only meter/alert
  markup fixes. The manually repaired application is never uploaded.
- Source-review probes do not reliably identify those omissions, so no reviewer is
  added. Instructions become explicit about semantic controls and negative-form checks.
- Kimi K3 requires documented low-effort control; it cannot disable reasoning. A real
  low-effort run reaches checks but fails before evaluation at CNY 5.714784. Pro's
  same-package run also reaches browser checks, then exhausts its budget at CNY 1.200237.
  Both official token totals match the captured responses in these two runs.
- Dev23 reuses the existing generic build/server/browser lifecycle for bounded new
  applications. The model still generates all product logic, UI and assertions. This
  addresses repeated boilerplate/serialization/build overhead with one existing path,
  while preserving the frozen Smoke/Evolution winners and avoiding another planning layer.
- Its first real run exposes a missing browser base URL, fixed and verified with Chrome
  in dev24. The next Pro run reaches browser checks, but duplicate controls and a missing
  phone label remain; its full-bundle retry changes assertions without fixing the label.
  Cancelled with no official evaluation. Dev25 opens narrow repairs immediately after a
  failed bounded build and provides clearer, faster failure feedback. All 65 local checks
  pass, including real HTTP repair and Chrome navigation/missing-control behavior.
- Qwen3.8 Max uses the repair path in E044, but still fails before official evaluation
  after 376 seconds at CNY 2.462617. Its body-reading Promise never resolves; repair
  guesses at navigation without observing pending requests. Dev26 adds visible browser
  state and pending-request diagnostics to failed checks, plus an independent unnamed-
  meter check. All 67 local checks pass with real Chrome. These are harness results;
  neither dev25 nor dev26 has an improved official Ticket score at this checkpoint.
- E045 demonstrates actual repair: browser diagnostics expose an overlong generated
  test username, and Pro fixes it and completes all 8 self-checks. Official evaluation
  still scores 0/10 because homepage shortcuts duplicate primary navigation destinations
  under different labels. The unchanged public tests also fail 0/10 locally, then pass
  10/10 after deleting only those shortcuts from an offline diagnostic copy.
- Dev27 checks that non-home primary destinations have one visible link in the prepared
  small-app runtime. It derives destinations from the app, without benchmark route names
  or business logic. Real Chrome covers aliases, hidden links and home-link exceptions;
  all 68 local checks pass. Another official run must establish actual improvement.
- E046 improves from 2/9 to 4/9 self-checks, then fixes the reported name-validation
  defect just as its observed token count reaches 300,495. It stops before another
  verification. Its untouched final source passes 5/9 own checks and 3/10 public checks
  locally, so a final verification alone would not make this run correct.
- Dev28 returns concrete paths for generated source, allows the existing check to run
  after a budget-ending edit, and increases the default observed token allowance to
  450,000. The previous two official run costs were CNY 1.507691 and 1.218660; the
  extra allowance aims to finish measured repair, not to consume a quota. All 72 checks
  pass, including correct/incorrect/unchanged final-edit cases with no extra model call.
- Dev28 reaches actual delivery much faster: E047 completes 13/13 self-checks in 199
  seconds and scores 6/10 officially; E048 completes 8/8 in 155 seconds but scores 4/10.
  They use only 130,064 and 85,689 observed tokens respectively, below the old ceiling.
- E047's unchanged app passes four local runs of all ten public tests at the official
  ten-second timeout. A controlled delay reveals an exit-label ambiguity: a login regex
  matches the Chinese sign-out label before logout completes. The permitted English
  sign-out alias avoids that early match. E048 instead combines the exact username and
  a link in one element; isolating the username alone makes its diagnostic copy pass 10/10.
- Dev29 clarifies leaf text values and consistently permitted English navigation aliases.
  All 73 local checks pass. No diagnostic application or evaluator is uploaded.
- Task-filtered leaderboard requests work while aggregate requests fail with HTTP 500.
  The CLI now supports the same task selector as the website. Current per-task cost sums
  preserve Smoke's CNY 0.016023 and Evolution's CNY 0.017810, below their nearest rival's
  CNY 0.017079 and 0.018816. This comparison is derived; aggregate ranks are unavailable.
- Dev29's Pro run receives the intended instructions but still duplicates the username,
  reaching 7/7 scoped self-checks and only 5/10 officially. Its response usage nearly
  consumes the larger allowance. The next comparison keeps the archive unchanged and
  switches the coding model to MiniMax M3; no claim about its quality is made before execution.
- MiniMax repeatedly truncates whole-app output, and the harness fails to leave that
  generation mode. The user requests a stop because the elapsed work and Codex quota
  usage are disproportionate to the result. The active run is cancelled and its status
  confirmed. Further experiments and code changes stop. Ticket first place is unachieved;
  a mature Pi baseline has not been run, and no conclusion about its performance is justified.

## 2026-09-12 — Consolidate evolution before the next architecture experiment

- User requested a unified review and merge of all existing evolution into `main`,
  followed by a fresh development branch. Saved the uncommitted browser-acceptance
  experiment as `8881122` before changing the original checkout.
- Integrated the three independent candidates with merge ancestry preserved. Fixed
  acceptance remains optional in the uploaded runtime; model probes, generic external
  evaluation and Pi/container experiments now have a single `harness_lab/` map.
- Resolved recovery/status overlap and an incompatible synthetic fixture without
  relaxing active-tool enforcement. Final suite: 156 passed, zero failures/skips,
  including actual Chrome and Docker checks. Installed Pi 0.83.0 passes the separate
  positive and malformed-argument probes against scripted loopback responses.
- Two upload builds are byte-identical and contain no lab experiments. Source and
  incoming-history secret scans pass. Source-bound results are in
  `docs/evidence/2026-09-12-consolidation.json`.
- Inspected pinned GitHub sources for Octos/Octoscode/ARC adapter, Pi, mini-SWE-agent,
  OpenHands and Harbor. The proposal keeps a small executor, external calibrated
  evidence, and optional bounded diagnosis; it does not default to a second LLM.
- No real model calls or official evaluations ran. Ticket's fresh-agent best remains
  6/10. GUI acceptance calibration and a matched alternative-executor comparison
  remain future work, described in `docs/harness-design-2026-09-12.md`.

## 2026-09-12 — Run the first fixed-artifact acceptance controls

- User asked why the proposed experiment had not run; resumed with retained artifacts,
  without new generation or paid model calls. Retrieved E047 source read-only and
  confirmed that the retained replay files match it.
- A fixed external logout-state assertion passes all three variants without injected
  delay. At 400 ms, it rejects the original product and the identical product with an
  exit-0 self-check, while accepting only the single-label product correction.
- Final six observations complete in 13.393 seconds with unchanged retained sources and
  no cleanup errors. The earlier zero-delay instrumentation race was corrected without
  changing the measured public-helper sequence. This is one scenario, not a full
  public-suite replay or official score. See `docs/logout-calibration-2026-09-12.md`.

## 2026-09-14 — Forbid browser self-navigation in generated applications

- Acted on the registration-timing finding: the generation prompts now forbid assigning
  `window.location`, calling `location.assign/replace/reload`, emitting a meta refresh or
  letting a native form navigate after a submit or sign-out, and require an in-place
  re-render with `history.replaceState` plus `pushState`/`popstate` routing.
- `Workspace.verify` now rejects those patterns statically in product source the run
  authored, before dependency installation, reporting file and line into the existing
  bounded repair path. Reads of `location.pathname` and `history.*` calls stay allowed.
  New deterministic tests: 169 passed, 0 failures, 11 environment skips.
- Local gate before uploading: one Ticket Booking application generated through the
  organizer gateway with `deepseek-v4-flash` contained no forbidden pattern and replayed
  the unchanged public tests 20 times with 10/10 every time, median suite wall 5.41 s.
  A first generation attempt was discarded after it lost its token budget to a frozen
  self-check that called `assert(locator).toBeVisible()`; the prepared-bundle prompt now
  states that `assert` is `node:assert/strict`.
- Official run `01b06fb30564` passed 10/10 at 100%, CNY 0.629725, 72,854 tokens, 279 s.
  The registration test that timed out in E057 took 2,299 ms. One of two allowed trials
  was used. See `docs/nav-race-2026-09-14.md` and
  `docs/evidence/2026-09-14-nav-race-trial.json`.

## 2026-09-14 — Check the nav-race trial against the meter definition

- The official token count is a meter delta on the shared access key between run start
  and run finish, so any use of the key inside that window is charged to the run. Run
  `01b06fb30564` was checked against that definition after the fact, since the rule
  arrived after it had finished.
- Its meter window was 03:15:44 to 03:20:55 UTC and reported 72,854 tokens. The run's own
  checkpoint records 43,978 prompt plus 28,876 completion tokens across three calls,
  which is the same number: the meter delta minus our captured usage is zero.
- No run on the account, from any user of the key, overlapped that window; the previous
  one finished on 2026-09-12 at 19:53:44, and the two old PENDING entries have never
  started. The last local gateway call was at 03:10:57 UTC and the gate replays make no
  model calls. E057's 555,255-versus-50,957 gap stays unresolved, but it is not a
  systematic offset between the two counters.
## 2026-09-14 — Ablated the reference-image observation; the lever is not there

- Made the observation switchable. `FACTORY_VISION_MODEL` selects the model, an off value
  removes the call and the agent is told the images were not inspected. `DEFAULT_VISION_MODEL`
  is unchanged at `kimi-k3`. `Agent.observe_references` holds the branch so the disabled path
  is testable without a gateway. Tests: 176 passed, 0 failures, 11 environment skips.
- Ruled `deepseek-v4-flash` out as a cheap observer by measurement, not assumption: the
  gateway accepts an image payload for it and the model does not see it, replying that the
  image data is truncated at 209 prompt tokens. `qwen3.6-flash` reads the same screenshot
  correctly at 1,801 prompt tokens and became variant B.
- Both variants passed the calibrated local gate 20 of 20 at 10/10 with no self-navigation
  in product source. Neither gate predicted its official run; both local charges already
  exceeded the retained run's official CNY 0.629725.
- Official trials, both allowed ones used. Variant A, observation off, run `d855ead6df43`,
  10/10 at CNY 0.779834 and 173,870 tokens: it removed CNY 0.284 of `kimi-k3` and added four
  `deepseek-v4-flash` repair rounds. Variant B, run `8abb7f040604`, exhausted its 450,000-token
  budget over 15 calls repairing its own logout self-check and never reached the suite; the
  observation itself cost CNY 0.037054 of that run's 1.072651.
- Conclusion: the observation is 45% of a passing run's charge and what it buys is a first
  draft needing one repair instead of five. The default did not move. Both variants remain one
  environment variable away. See `docs/image-ablation-2026-09-14.md` and
  `docs/evidence/2026-09-14-image-ablation.json`.
- Consequence to undo: the Ticket Booking board reflects the most recent passing run, so
  variant A's run replaced the retained one and VOLO AI moved from rank 2 at efficiency 158.80
  to rank 4 at 128.23. Restoring it needs one official run on the unchanged default.
- Test suite caveat: one run reported a single unnamed failure and seven consecutive runs
  afterwards were green. Not reproduced, not attributed.
- Local gates must assert `browser_environment.available` first. A variant A generation run
  without a discoverable Playwright produced HTTP-only self-checks and an application with two
  `/register` links that failed all ten public tests in 20 of 20 replays; it was discarded.

## 2026-09-14 — `deepseek-v4.1-flash` does not exist here; the cheap observer does

- Checked a directive to move the reference-image observation to `deepseek-v4.1-flash`. The
  organizer gateway does not serve it. `GET /v1/models` returns 11 ids and none is a 4.1; four
  spellings each return HTTP 400 `provider_not_selected`; an invented model name returns the
  identical error and `deepseek-v4-flash` succeeds, so that code means unknown model. No 4.1
  appears in 143 account runs or in 31 leaderboard rows across five competitions.
- Confirmed the inferred `qwen3.6-flash` price against official charges rather than assuming it.
  1.2 CNY per million cache-miss input and 7.2 output reconstruct `8abb7f040604` exactly, and the
  same method reproduces `01b06fb30564` and `d855ead6df43`, all three with a zero token gap and a
  residual under one micro-yuan. It is cheaper than `deepseek-v4-flash`, not the same price. The
  cache-hit rate stays unobserved because one observation call per run never gets a cache hit.
- Reading the three references costs CNY 0.037054 on `qwen3.6-flash` against 0.284180 on
  `kimi-k3`: a measured CNY 0.247126 per Ticket Booking run, with the screenshots still read.
- Recorded the dangerous failure mode: the gateway accepts an image payload for
  `deepseek-v4-flash` and the model never receives it, answering that the image data is truncated
  at 209 prompt tokens. Any observer change must transcribe a known screenshot before it ships,
  not merely return HTTP 200.
- Headline, from four official runs that all reconstruct exactly: `01b06fb30564` and
  `b6b89caa3f8c` are the same agent, default, model and task, both 10 of 10, and they cost CNY
  0.629725 and 0.870779. That spread, 0.241054, is the size of the whole `kimi-k3` observation,
  0.266640 to 0.284180. No single official trial can decide this lever in either direction, and
  the earlier reading that removing the observation cost more is equally unsafe. Generation cost
  across the four runs is 0.345545, 0.604138, 0.779833 and 1.035597 over 2, 3, 6 and 14 calls.
- `DEFAULT_VISION_MODEL` is flipped to `qwen3.6-flash` on this branch. It has a 20 of 20 local
  gate and confirmed rates; it has no passing official run, and its one trial died on the
  unfixed frozen-self-check budget trap rather than on anything to do with the observer.
  See `docs/vision-model-availability-2026-09-14.md`.
- Confirmation condition, agreed with the team lead: no official trial was spent on this. The
  flip must be confirmed by the first official trial taken after the frozen-self-check fix on
  `fix/selfcheck-deadend` lands, so that the observer result is not confounded by the trap that
  ended `8abb7f040604`. Until then this default carries a local gate and price arithmetic only.
## 2026-09-14 — A self-check that cannot pass no longer consumes the repair budget

- Two runs the same day spent their whole budget repairing a check instead of a product. The
  nav-race first local generation froze a check bundle containing `assert(locator).toBeVisible()`,
  where `assert` is `node:assert/strict`; from call 3 to call 14 the frozen bytes returned the same
  `TypeError` while the product changed every round, and it died at 464,707 tokens with nothing
  delivered. By call 7 the model had already written a correct check and could not make the harness
  use it.
- Official run `8abb7f040604` was a different failure and two earlier documents were wrong to call
  it the same one. Nothing was frozen there. Its 477,861 tokens split into 111,438 on four edits
  that never applied and 204,820 on six read-only diagnosis calls; it applied a plausible fix on
  its last call and ran out before verifying it. Four of those calls were lost to a bare `KeyError`
  reaching the model as the string `'path'`.
- Fix, three rules and no configuration knobs. Harness/API misuse inside the run's own checks
  (assertion-library misuse, missing module, undefined symbol, syntax error) is reported as
  `defective_check` with the exact error and is never frozen. A captured check is released at its
  first failure if that failure is a check defect, or at the second consecutive identical failure
  signature over changed product source. `verify` results and `.factory/checkpoint.json` carry
  `browser_available`, and `harness_lab/local_gate.py` refuses to score a generation that had no
  browser. The malformed-edit message now names the missing keys.
- Calibrated before any model call by replaying the detector over the retained check logs of five
  generations: 6 positives, all of them the dead end's own frozen-check runs, and 0 across 26 logs
  from four healthy generations and the official run's check steps.
- `python -m unittest discover -s tests -v` reports 190 tests, 0 failures, 11 skipped, against 176
  on main.
- Local Ticket Booking generation with the fix: a bundle was frozen at call 2, calls 3 and 4
  produced the identical failure over changed source, and the capture was released at call 4 with
  reason `no_progress`. The run then delivered at call 15. `python -m harness_lab.local_gate`
  scored it 20 of 20 at 10/10, browser availability asserted from the recorded value.
- Official trial `e34e78400983`: PASSED, 10/10, features 2 of 2, 143,279 tokens, CNY 0.899558,
  372 s. Its captured usage equals the meter delta exactly and no run was concurrent. It made five
  model calls and never froze a check, so it does not exercise the new guard; it shows the change
  does not break a healthy run.
- Not fixed: neither run bounds diagnosis stalls. The local generation spent calls 6 to 13 on
  read-only calls, the official failure calls 9 to 15. That is the largest remaining block of
  avoidable spend. See `docs/selfcheck-deadend-2026-09-14.md` and
  `docs/evidence/2026-09-14-selfcheck-deadend.json`.

## 2026-09-14 — Correction: variant B was not killed by the frozen-self-check trap

- I attributed run `8abb7f040604`'s budget exhaustion to the frozen self-check dead end. That was
  wrong. The `selfcheck-fix` agent re-read the trace while working on that trap and found no
  preserved-self-check event in it; its failing logout check was genuinely failing, a real product
  race with `POST /api/logout` still pending when the assertion read the page. I verified both
  points against the retained trace before correcting.
- Where the 477,861 tokens actually went: 9,698 on the observation, 45,379 on the first
  `build_app`, 111,438 on four edits that never applied, 204,820 on six read-only diagnosis calls
  that produced no verification, 38,031 on a plausible `doSignout` fix applied on the last call and
  never verified, 30,904 on one `patch_and_verify` that applied and failed, 37,591 on the rest.
  Two of the four failed edits were rejected with the bare message `'path'`, a `KeyError` leaking
  from the harness, which tells the model nothing it can act on.
- Consequence for the plan: the confirmation trial for the `qwen3.6-flash` default no longer has
  to wait for `fix/selfcheck-deadend`. The trap was never in the observer's path, so a trial before
  or after that fix is equally valid. The fix remains worth having, and the repair loop remains the
  dominant cost lever, but neither is a precondition here.
- One subtotal in the correcting report, 215,001 tokens over seven read-only diagnosis calls, does
  not reproduce from per-call usage; I count 204,820 over six, or 242,851 including the final
  unverified edit. Recorded rather than reconciled, because the headline does not depend on it.
- Corrected in `docs/image-ablation-2026-09-14.md`, `docs/vision-model-availability-2026-09-14.md`
  and both evidence files.


## 2026-09-14 — Correcting my own subtotal for run 8abb7f040604

- The `image-ablation` agent could not reproduce the figure `215,001 tokens over seven read-only
  diagnosis calls` that I put in `docs/selfcheck-deadend-2026-09-14.md` and in the progress entry
  above. They were right and I was wrong. Recomputed from the retained per-call usage, the number
  matches no subset of the calls; it was an arithmetic error on my part, not a classification
  difference.
- Their count reproduces exactly: 204,820 over calls 6, 9, 10, 11, 13 and 14. Their classification
  is also the better one. I had lumped call 12, which wrote a diagnostic API simulation, and call
  15, which applied the real fix, in with the reads; both are writes.
- The figure that does not depend on the split: after the last verification at call 8, 250,609
  tokens were spent without producing another verification. That is the quantity the next bound
  should target.
- `111,438` on the four failed edits is unchanged and reproduces exactly, as do calls 4 and 7 being
  the two rejected with the bare `'path'`.
- Corrected in `docs/selfcheck-deadend-2026-09-14.md` and in the entry above.


## 2026-09-14 — Small-board token reduction, measured against the public tests

- Implemented the ranked small-board levers from `token-accounting-2026-09-14.md` and measured each
  one through the real gateway: an anchored `insert_after` edit that does not repeat kept text, a
  harness-prepared interface check derived from the literal test ids and button names the
  requirement states, and request sections that state nothing being dropped.
- Official result on the shipped commit: Smoke board CNY 0.013428 against 0.016023, Smoke Evolution
  0.008119 against 0.017810, every run 100% pass and 100% feature implementation. Per-task board
  positions are rank 4, 3, 3 and 3.
- Five configurations were measured and rejected, including the accounting document's biggest
  single Smoke lever. Dropping authored checks in favour of prepared ones was the cheapest thing
  measured and shipped three broken applications out of eight; telling either prompt that test ids
  are checked elsewhere made the model stop rendering them. Both findings are in
  `small-board-tokens-2026-09-14.md` with their numbers.
- One official dice run failed 1/2 after passing every local check: the model added the required
  element, never wired it, and never extended the authored check. Its re-run passed. The harness
  has no check that a newly required behavior is actually asserted, which is the next piece of work.
- Local campaign cost CNY 2.4827 over 138 generations; the seven official runs cost CNY 0.093.

## 2026-09-14 — Merge, re-gate, and two levers that did not survive measurement

- Merged `main` into `perf/small-board-tokens` for PR #13's failed-edit reporting, resolved the two
  conflicts, and gave the same guarantee in this branch's edit vocabulary. The nine-call evolution
  run was checked for that bug first: its trace has no bare `'path'` result, so its repair loop was
  the prompt claim this branch had already removed.
- Re-ran the full gate on the merged head: twelve generations, sixty replays, 55 fully passing. The
  five failures are one application exhibiting the unasserted-requirement defect, which had only
  been seen officially before.
- `deepseek-v4.1-flash` is not routable on the organizer gateway: HTTP 400 `provider_not_selected`
  for four spellings, while `deepseek-v4-flash` succeeds with the same key and body. A submission
  naming it would fail at its first model call, so both boards stay on the current models.
- Implemented and withdrew a rule requiring an evolution edit to assert the requirement it adds. It
  prevents the defect, 40 of 40 replays, and costs more than it saves in all three variants
  measured: model calls of 8, 6 and 19 appear where the merged head uses 1 or 2.
- Two official runs of the merged head passed 1/1 with one model call each and captured 1,495 and
  1,486 tokens, but their meter deltas were 6,526 and 56,328. The contamination is other use of the
  shared key inside the run windows, which includes teammates' local generation, not only official
  runs. The Evolution board was left on its clean rows rather than re-validated during it.

## 2026-09-14 — Attribute every repair round, then fix the three mechanical defects (`fix/repair-loop`)

- Labelled all 124 model calls of 16 retained runs by failure source: the five official Ticket
  Booking runs of 2026-09-14, six local generations and five archived E052 to E057 traces. Rows in
  `docs/evidence/2026-09-14-repair-loop-autopsy.json`, write-up in
  `docs/repair-loop-autopsy-2026-09-14.md`. The five official runs reconstruct their official
  charge from these rows to six decimals, which is the check on the parse.
- 43 of 124 calls and CNY 2.7433 of CNY 14.6536 are harness defects: 34.7% of calls, 18.7% of cost.
  They are concentrated in four runs. The four official runs that passed have none; the one that
  failed has nine. `product_assertion`, the repair loop working, is the largest block at CNY 5.13
  and is not waste.
- Defect 1, bare exception strings. `{"error": str(exc)}` sent run `8abb7f040604` the message
  `'path'` twice. Every escaping tool exception now goes through `tool_failure`, which names the
  tool, what was wrong and what to do; `write_files` and `deliver` validate entries by position so
  a malformed file can no longer raise a bare `KeyError`.
- Defect 2, edits that never applied. `Exact old text must occur exactly once: <file>` carried no
  count, no line numbers, no failing edit index and no current text. `edit_anchor_failure` now
  reports the occurrence count and line numbers for an ambiguous anchor, and for an absent one how
  many characters matched, what the file holds there, what the edit expected and a marked window of
  the real text.
- Defect 3, unbounded read-only diagnosis, the largest block at 25 calls and CNY 1.2325. Two fixed
  values, no knobs: after two consecutive calls that neither write nor run a check the next tool
  result carries the complete current source of what the model has read, bounded at 48,000
  characters; after three the run switches to the bounded full-source repair path with
  `patch_and_verify` as the only offered tool.
- The external review's check-authority claim held. Captured self-checks ran at the head of the
  check loop with fail-fast, so a defective frozen bundle could stop a correct product before
  independent acceptance. They are still executed and still reported, now with
  `authority: diagnostic_only`; the requirement assertions decide, independent acceptance decides
  whenever configured, and operator-supplied required checks keep their authority. Nothing about
  independent acceptance is weakened.
- Adopted the team lead's classification-independent per-run metric, tokens spent after the last
  call that produced a verification without producing another. It reproduces their figure for run
  `8abb7f040604` exactly: last verification at call 8, seven calls after it, 250,609 tokens, 52% of
  the run. Across the sixteen retained runs only four have any tail at all, and E056's is 402,906
  tokens, 88% of that run, larger than any single category total in it. The corrected read-only
  subtotal for `8abb7f040604` is 204,820 over calls 6, 9, 10, 11, 13 and 14; the withdrawn 215,001
  is not used anywhere in this branch. That run's logout self-check was a genuine product race, not
  a check defect, and the autopsy says so.
- Local measurement, gateway only, no official run started and none queued or running: five
  generations on `main` and five on the branch, each replayed by `harness_lab.local_gate` at three
  repetitions. Harness-defect calls fell from 15 to 4 and their cost from CNY 0.7971 to 0.2228.
  Read-only diagnosis fell from 11 calls to 1, non-applying edits from 3 to 1. On the robust metric
  the unverified tail fell from 103,587 tokens and CNY 0.1099 to zero: every run on the branch ends
  on a call that produced a verification. Mean cost fell from CNY 0.8516 to 0.6975 and mean calls
  from 8.4 to 5.2; four of five runs completed on each side. The spread did not narrow: the most
  expensive run in the measurement is `after 3` at CNY 1.6179, which ended on a gateway transport
  failure, not on budget, and whose zero tail is real rather than favourable because that failing
  call consumed no tokens.
- Both new mechanisms fired on a real model. `after 3` records `diagnosis_stall_sources` and
  `diagnosis_stall_repair` and then made three product edits instead of more reads; `after 5`
  received the new anchor message and delivered on its very next call. The check-authority change
  was not exercised by these ten generations and rests on the unit tests.
- Corrections in the same branch: the E057 timeout root cause is not proven and the change's
  defensible claim is a removed failure class plus 10/10; the observer switch is measured only at
  the observation call, CNY 0.23 to 0.25, with the end-to-end effect unmeasured; the single-sample
  causal comment in `volo/references.py` is gone; the corpus navigation-keyword recommendation is
  narrowed to the actual interaction path. The corpus counts already read 460 spec files and 478
  test cases and needed no change.
- Merged current `main` (`b00679c`, through PR #17). The edit protocol it added, `insert_after`
  alongside `old` with per-file grouping through `apply_edits`, is kept whole; its anchor failures
  now route through `edit_anchor_failure`, so a missing or repeated anchor reports its count and
  line numbers, or where it stops matching and what the file holds there, for both anchor kinds.
- `python -m unittest discover -s tests -v` reports 232 tests, 0 failures, 11 skipped, against 213
  on `main` at `b00679c`. `tests/test_external_gate.py` flaked twice under heavy concurrent load
  with `[Errno 1] Operation not permitted` and passed on every clean run, including on `main`.


## 2026-09-14 — A global state contract before page generation, rehearsed on Keep

- The load-bearing risk for the formal competition is not tool-call batching. Our scheduler gives
  a later batch only the names and dependencies of earlier ones, while 426 of the published
  corpus's 460 specs depend on state declared once in requirement prose with no reset API.
  Independent batches invent conflicting accounts, entities, routes and seeds.
- `volo/contract.py` extracts a machine-readable contract from the complete package in one model
  call before any page exists, and every batch receives it verbatim. Quoted literals and seed
  sentences are recovered from the requirement text without a model and reattached mechanically,
  so a model that reorganizes them cannot lose a named identity. Keep: 48 literals and 26 seed
  sentences declared, 22 seed rows accepted, 0 unresolved, 13,631 tokens in one call. Bookstack:
  38, 29, 32 rows, 0 unresolved, 17,446 tokens.
- `volo/state_runtime.py` turns those rows into a harness-written startup seeder, applied at most
  once per data file, and `/api/health` answers ready only after the seed commits. A probe of a
  generated build served all 22 declared Keep identities, including the three private rows the
  destructive requirements own, through the model's own request handler.
- Routing is derived, not configured: the contract runs when `requirements.batches()` returns more
  than one batch, so Ticket Booking (2 nodes) and the small boards (1 node) take the unchanged
  path. Measured, not assumed: one Ticket generation gated five times with this branch's server
  file and five times with main's restored byte for byte gave 9 of 10 in every replay under both,
  the same failing test, medians 15.03 s and 15.32 s.
- Best scored applications: Keep 17 of 32 at 7 of 15 batches, Bookstack 15 of 34 at 9 of 18. Both
  short of the 26 and 28 the review asked for, and both partial: no run implemented its whole
  schedule, because a batch costs five to thirteen calls and the machine was running several
  agents' generations at once.
- The more useful number is how they failed. **Every single failing spec timed out; not one was a
  failed assertion.** The same application scores identically under the hosted profile (4 workers,
  10 s) and the repository profile (1 worker, 60 s), on exactly the same fifteen specs, while the
  suite takes 44.7 s against 560.5 s. Six times the budget changes nothing, so this is not time
  pressure: the controls those specs look for are absent or carry names the helpers' resolution
  ladder never matches. No failure was a missing seed row, a renamed field or a value that
  disagreed. What the contract set out to prevent did not appear; control naming and presence is
  the next lever.
- Nine generations, CNY 13.66, plus CNY 0.40 for the Ticket gate. Most of that was spent learning
  what the batch loop wastes, not on the contract: reads of harness files the agent is told not to
  modify, scripts hunting a syntax error the parser already knew, a 30 KB tool call that arrived as
  invalid JSON, extraction at the model's default reasoning effort, and one context-limit death
  from delivering source without a budget. Each is fixed and each is a synthetic test.
- One transient `Gateway HTTP 502` from the gateway's own proxy discarded eleven paid calls, so
  502, 503 and 504 are now retried alongside 429. Request errors are not.
- None of the rehearsals had `main`'s repair-loop bounds, which landed while they were running and
  are merged here. The largest single cost in them is a batch repairing itself thirteen calls at a
  time, which is exactly what that work bounds, so the merged head should beat every number above.
  Nothing here measures the two together.
- Detail, per-iteration cost and limits in `docs/state-contract-2026-09-14.md`, raw record in
  `docs/evidence/2026-09-14-state-contract.json`. No official run was started, and no corpus test
  or public specification entered any generation prompt.

### 2026-09-14, later — leakage check and per-cause failure analysis

- **No public specification and no corpus test reached any generation prompt.** Checked three ways
  over all ten retained traces: zero `public_specs_supplied` events; zero of 159 exact lines from
  the published `keep` and `bookstack` specs present in any message sent to the gateway; and
  `load_public_specs()` returns `None` for both packages. The mechanism is the fingerprint binding
  in `volo/public_specs.py`: its manifest holds one entry, for `ticket-booking--ticket-booking` at
  fingerprint `a22b340306d1…`, while Keep hashes to `cbc9dfa4779c…` and Bookstack to `2cef30f1dff8…`.
  The one apparent marker, `@playwright/test`, comes from our own system prompt telling the model
  not to use that runner. Script and per-run counts are in the evidence file under
  `public_spec_leakage`. The Keep and Bookstack numbers are therefore not contaminated.
- Failures grouped by cause, in `docs/state-contract-2026-09-14.md` section 1.7. The dominant Keep
  defect is one accessible name shared by every row: the home page carries **19 buttons named
  "More options", 19 "Background options", 19 "Archive"**, all permanently visible, and the
  published helpers take `.first()`. A probe confirms the element `.first()` resolves for `/more/i`
  sits in the "Sprint goals" card, so a test naming any other note acts on the wrong one and times
  out. Second defect: no placeholder or label matches `/note/i` or `/content/i`, so REQ-2.4 types
  the note body into the search box through the helper's bare `textbox` fallback.
- Bookstack's instability is in implemented behaviour, not missing behaviour: of the 13 specs that
  flip between replays, ten were self-checked and three had their batch started; **none is a
  requirement the run never reached.** Keep, whose mutating tests act on rows that already exist,
  is stable at 17 across four replays. The reading is that four workers share one store while a
  Bookstack test creates entities as it runs. The direct control, replaying at one worker, ran
  930 s without finishing and was stopped; it is recorded as attempted, never counted, and is the
  first measurement to take next.
- Merged `origin/main` at b565095. Suite green at 278.

### 2026-09-14, later still — every timed-out Keep spec by the locator it waits on

- Section 1.8 of `docs/state-contract-2026-09-14.md` now names, for all fifteen failures, the
  locator the spec is pending on and what the page offers instead. Pending locators come from
  Playwright's own call log; the "page has" column from driving the running application. Re-run at
  30 s per test and one worker, the seven that print no call log still time out at 30 s, so none of
  them is a slow page.
- Three causes, in the order worth attacking: **five specs pick the wrong control** because one
  accessible name is shared by every row and the helpers take `.first()`; **three specs cannot
  reach a control that exists** because it has no name matching what the helper searches for (no
  label or placeholder matches `/note/i` or `/content/i` for the note body, no palette swatch
  matches `/green/i`, no field matches `/label name/i` in Edit Labels); **seven are screens,
  controls or behaviour the run never implemented**.
- The first two groups are eight specs, and both are about names. The contract already carries the
  requirement's own vocabulary in `exact_texts`; nothing consumes it as a naming rule yet. That is
  the concrete next change.
- Ticket: told `ticket-regression` that my gated app fails `REQ-1.1: successfully register a new
  account and remain signed in` in all ten replays, but **not** on signed-in state — the two other
  REQ-1.1 tests, which both call `expectSignedIn` after `registerAccount`, pass. It hangs on the
  first assertion, `getByText('账户信息', {exact: true})`, which the register page never renders;
  its only heading is `注册旅客账号`. Every other locator in that test resolves, including the
  `密码强度` meter. So my generation does not reproduce the official signed-in regression.

### 2026-09-14, evening — the two naming rules, checked mechanically, and a schedule that finishes

- `checks/interface.spec.cjs` is harness-owned, generated from the contract, and runs with every
  batch because check discovery already collects every `checks/*.spec.*`. It **fails** on two
  things and only two: two controls visible at the same moment sharing an accessible name, and a
  visible input, swatch, field, toggle or meter with no accessible name at all. Those are the two
  defects section 1.8 measured, worth eight of fifteen Keep failures. Both permitted shapes pass —
  actions revealed only on hover or focus, and actions carrying their row's own title.
- The same check **reports without failing** every name matching no requirement text, against a
  `checks/vocabulary.cjs` built from the contract's exact texts, navigation names, entity and field
  names, seeded values, and the strings a reference observation transcribed. The asymmetry is
  deliberate: ambiguity and namelessness are unambiguous defects, while a name outside the
  vocabulary is a smell, and failing a run on a smell buys the repair loop this branch already
  measured at CNY 2.22 in one iteration.
- The observed-headings source is load-bearing, not decorative. Section 1.9 records the chain for
  Ticket: the observation step **was enabled** (`qwen3.6-flash`), it transcribed *"a centered
  modal-style form titled \"Account Information\" (账户信息)"*, that reached the generation prompt,
  the requirement prose contains 账户信息 zero times, and the page still rendered only
  `注册旅客账号`. So the image was read and the model dropped the string anyway — prompt adherence,
  not a gap in observation, and the image is the only source for that required string.
- `run_schedule()` now gives every batch its first implementation. A batch that cannot converge is
  recorded under `batch_incomplete` and the batches after it still get their turn; only an
  exhausted call, token or wall-clock budget stops the schedule, under
  `schedule_stopped_on_budget`. Every verified tree is snapshotted and a run ending on a tree no
  verification matches restores the last one that did. `incomplete_requirements` is reported
  alongside `self_checked_requirements`.
- Suite 295, 4 skips. None of this has been through a generation yet; the next iteration tests the
  fixes rather than re-rolling the same application.

### 2026-09-14, night — the twelve calls one Keep generation spent on rejected tool calls

One complete Keep generation at head `b8e92a0` made 148 model calls. Twelve of them returned
nothing, because the harness rejected the tool call outright:

- **8 × `read_files` over the 12,000-byte bound.** Two shapes. At the start of nearly every batch
  the model read every earlier batch's `checks/batch-N.spec.cjs` together with the harness-owned
  check files; by batch 11 four batch specs alone exceeded the bound. And `frontend/public/app.js`
  itself grew past the bound (17.6 KB to 25.7 KB), so every later batch opened with a read of it
  that could not be answered.
- **3 × `read_file_chunk` with a limit above 8000**, asking for a 24 KB file whole.
- **1 × `edit`** on an earlier batch's check whose old text did not match the file.

Five changes, each pinned by a synthetic test:

- `read_file_chunk` clamps a limit above 8000, and a negative or unusable offset to 0, instead of
  raising. A limit of 24000 is an unambiguous request for the whole file; it is answered with the
  first 8000 characters and the `next_offset` that continues it.
- `read_files` past the bound returns what fits rather than nothing: files complete in the order
  asked, then the first that does not fit as a leading chunk with its `next_offset`, then the
  remaining names and sizes under `_read_bound` with the hint to continue with `read_file_chunk`.
  The 20-path and 80,000-byte single-file guards are unchanged. A read never costs a call and
  returns nothing.
- Earlier batches' `checks/batch-N.spec.cjs` are now owned by the batch that wrote them. From the
  next batch on, a read of one is answered the way a harness-owned file is — one line naming the
  requirements it covers, that it passes, that it must not be edited, and where this batch's own
  check file goes — and `edit` and `write_files` on one are refused with the same reminder that a
  failure there is a regression in the application. A stall no longer hands back their bytes either.
- The contract supplement now tells each batch to put its frontend code in its own
  `frontend/public/features/<slug>.js`, loaded from `index.html`, and never to rewrite another
  batch's feature file. Instruction text only; there is no module system.
- The interface check's reported vocabulary list strips the `"<Action> for <title>"` suffix the
  rule itself prescribes before matching, which collapses one row action per row to the action
  word, and caps the printed list at 20 names with a count of the rest. Every self-check run
  created fresh rows, so that list grew with each verification and was re-sent with each one.

Also: a second `HarnessReadTests` class shadowed the dispatch-level class of that name, so three
tests of the read interception never ran. The first is renamed `HarnessReadDispatchTests` and its
one stale assertion corrected.

Suite 322, 4 skips, with a local Playwright 1.61.1 and Chromium supplied so the browser-gated
checks ran. No generation has been run against these changes.

## 2026-09-14 — What the naming rules bought, and the four rules that replace them

`feat/state-contract`. The Keep generation at `b8e92a0` was attributed failure by failure
(`docs/keep-attribution-2026-09-14.md`, copied into the repo unedited). The headline is that
section 8's naming rules were obeyed and did not help: across nine measured states the page had
**zero** duplicate accessible names and **zero** nameless controls, and six of the eight
attributable official failures still picked the wrong row. The published helpers never search a
full name. `archiveNote` searches `/archive/i`, `pinNote` searches `/pin/i`, `deleteNote` searches
`/more/i`, then take `.first()`. Nineteen buttons named `"Archive for <title>"` are nineteen
matches, and DOM order put the pinned card first. A unique name is not an unambiguous one.

What the branch does about it, all in `checks/interface.spec.cjs`, which the harness writes and
the model may not edit:

- **The duplicate-name rule is replaced by a verb-collapse rule.** Every visible action name has
  its row-scoping stripped — a trailing ` for <anything>`, a leading `<anything>: `, and every row
  title the contract seeds, now exported as `titles` from `checks/vocabulary.cjs` — and two
  controls that collapse to the same remainder fail, naming the verb and the count. The
  hover-revealed shape passes, because only the hovered row's actions are in the tree. Nineteen
  rows of actions at rest do not.
- **The rules run in every state one interaction away.** The check used to inspect the single tree
  `checks/browser.cjs` loads and stop, and every one of the eight failures happened in a state it
  never reached. It now clicks each visible control once from a fresh load, deduplicated by the
  verb the helpers would search for, applies the rules to the resulting tree, and reloads; then
  hovers each seeded row title. Every finding names the state it was found in.
- **An open chooser must leave the page behind it inert.** When a click opens a `dialog`,
  `listbox`, `menu` or `role="group"` holding controls, either it is a `dialog` with
  `aria-modal="true"` or no control outside it may share a name substring with one inside it. This
  is REQ-2.7.1 and REQ-2.7.2: a picker offered `checkbox "Work for Sprint goals"` while the sidebar
  still offered `menuitem "Work"`, and the ladder reaches menuitem two rungs before checkbox.
- **Typing must survive a click inside the same form.** Each input group is filled with markers,
  each other button in it is clicked once, and a lost marker fails. A click that sends a non-GET
  request is exempt: a form is allowed to clear itself on a successful submission, and the write
  is the discriminator, not a list of English verbs.
- **The supplement says all four in the words the model receives**, plus a fifth the harness cannot
  enforce: a self-check for a row-scoped action asserts on the named row afterwards, never only on
  a toast. Four of the last run's specs passed against a toast while acting on the wrong row.

Two supporting changes the walk needs. `backend/state.cjs` gained `store.snapshot()` and
`store.restore()`, and `backend/server.cjs` serves them at `/__factory/store`: the check reaches
an application's states by clicking its own controls, which moves rows, so it saves the store
before the walk and puts it back afterwards. A regression test drives an application whose only
button deletes every seeded row and asserts the store on disk is intact afterwards. And
`source_snapshot()` now skips harness-owned paths in a contract run: the interface check grew to
20 KB, and it was being counted against the 24,000-character budget that decides whether a small
edit gets inline source at all.

Measured on the generated Keep application at `b8e92a0`, fresh data directory, this machine:

| Quantity | Value |
|---|---|
| States inspected | 27 |
| Input groups probed | 2 |
| Check wall time | 4434, 4453, 4516 ms over three runs |
| Ambiguity | fires, 6 findings: `more options` ×19, `change color` ×19, `archive` ×19 and `pin note` ×18 on the entry page, `edit label` ×3 and `delete label` ×3 after clicking "Edit Labels" |
| Namelessness | does not fire |
| Inertness | does not fire: the label picker is two clicks from the entry page, not one |
| Form durability | fires, 6 findings, all in the composer opened by clicking "Take a note": `Title` and `Take a note` are lost to each of "Choose color for new note", "Pin new note" and "Change labels for new note" |
| Rows left moved by the walk | none; the store is byte-identical afterwards |

Suite 334, 4 skips, with a local Playwright 1.61.1 and Chromium supplied so the twenty
browser-gated interface checks ran; 31 skips without them.
The synthetic fixtures under `tests/fixtures/` are hand written and implement no requirement:
`synthetic-hover-rows.html` passes all four rules, and `synthetic-leaky-chooser.html` is the
inertness defect reduced to one picker and one sidebar item. No generation has been run against
any of this.

### 2026-09-14, night — the second Keep run: the rules changed the shape, then one batch ate the budget

- Second full Keep generation at ccf0600 (all three fix sets in), budget 320 calls / 8,000,000
  tokens. Batches 1–3 converged in 9, 7 and 17 calls. Measured on the batch-2 application: at rest
  the home page has **no** row-action buttons; hovering "Groceries" reveals exactly one
  "More options" whose menu holds "Delete Note" — the shape the official helpers drive
  (`hoverNamed(title)` then the first `/more/i`). The ambiguity rule fired once in batch 3 on a
  real defect (two "Archive" visible after hovering "Team retro remove label") and the model
  repaired it in two rounds. The frontend was split into `features/*.js` as instructed.
- Batch 4 (REQ-2.7.1 alone) then spent **36 calls without converging**: its own check called
  `page.goto(undefined)`, and the model thrashed between that check and three duplicate feature
  files (`labels.js`, `assign-labels.js`, `label-assign.js`), re-reading the same regression
  checks each round. The only bound on the contract path was the run-wide call budget. The run
  was stopped at 72 calls / 2.36 M tokens.
- Two defects found in the process: **no real run had ever written a product snapshot**
  (`product_snapshot` events: 0 in both runs, against 9 and 3 verified batches), because
  `backend/.volo/launcher.cjs` is a protected path and one `ValueError` aborted the whole
  snapshot; so "restore the last verified tree" had never been possible. And a batch that failed
  left its debris in place for the next batch to build on.
- Changes: `BATCH_CALL_LIMIT = 16` on the contract path records the batch incomplete and moves on;
  a failed batch restores the last verified snapshot, removing files added since; the snapshot
  skips runtime data and dot-directories instead of aborting. Three synthetic tests pin them.
- One more rejected call to answer later: a `write_files` whose JSON was invalid because the model
  wrote CSS `content:"\22EF"` inside a JS string (an invalid `\2` escape at the JSON level).

### 2026-09-14, late — runs three and four: the cap and the restore, measured

- Run 3 (fc496c4): batch 1 converged in 16 calls and, for the first time in any real run, wrote a
  product snapshot. Batch 2 hit the cap; the restore then died on `backend/.volo/launcher.cjs`,
  a protected path it tried to remove because the snapshot leaves it out. Fixed in 69a7f59: the
  restore skips the same paths as the snapshot and a restore failure is recorded, not fatal.
- Run 4 (69a7f59): batches 1–2 converged, batch 3 (archive and colour) hit the cap and the tree
  was restored to batch 2's; batch 4 started clean. The cause of batch 3: the page hid row actions
  until hover as rule 1 asks, and the model's own check waited for "Archive for Travel plans 2.5.1"
  without hovering. The supplement now states the evaluator's own sequence for self-checks
  (hover the title, then the verb), and the cap is 20 (b3d2331). Run 4 was stopped at 42 calls
  rather than paying for the same failure in every later batch. Run 5 started on b3d2331.
- Also landed: a `write_files` whose JSON fails only on a backslash escaped one level short is
  repaired instead of rejected (155f14a).

### 2026-09-15, after midnight — run five: every batch ran, 25 of 32 under both profiles

- Run 5 (b3d2331): all 15 batches ran, 142 calls, 3.66 M prompt tokens (2.42 M cached),
  488 k output tokens, about CNY 8.4 at the gateway's list prices. Hosted profile 25/32, repo
  profile 25/32, the same seven failures under both. Previous best 19/32 hosted (b8e92a0).
- Two batches hit the 20-call cap and were rolled back: REQ-2.3.3/2.5.2/2.5.3 (stacked Undo
  toasts made four buttons named "Undo"; "Delete Note" not found after hover) and
  REQ-2.5.4/2.7.6.2. Three of those five fail officially; REQ-2.5.2 and REQ-2.7.6.2 pass on
  features earlier batches had already built. Four implemented requirements fail officially:
  REQ-2.7.4, 2.7.5, 2.8.2, 4.2 — attribution in progress.
- Snapshot ordering bug found from this run's events and fixed in 11e21cc: the snapshot's
  `completed` lagged one batch, so the restore after batch 7 dropped batch 6's three
  requirements from every list while their files stayed in the tree (they pass officially).
- Evidence: `runs/2026-09-14-keep-full-5/` (git-ignored) with the app, trace, both scores and
  both Playwright reports.

## 2026-09-15 — Run five: what the new rules caught, and the four that catch the rest

`feat/state-contract`, on the generation at `b3d2331` (25 of 32 under both profiles, 142 calls).
The attribution is in `docs/keep-attribution-run5-2026-09-15.md`, verbatim. Run 5 adopted the
other shape the rules permit: row actions `display:none` and revealed on hover, with row-scoped
names. It worked. The entry page went from 85 visible action controls to 13, from four verb
buckets holding nineteen controls each to none, and **every group-a failure of run 4 disappeared**.
Four failures were attributable and each is a rule the check did not yet have.

- **The `aria-modal` exemption was wrong and is gone.** `auditInertness` used to skip any chooser
  that declared itself modal. Playwright's `getByRole` honours `inert` and `aria-hidden` and
  ignores `aria-modal`, so the exemption removed the check from exactly the state where the leak
  happened. The rule now also fails when any text input outside an open chooser is visible, named
  or not, because the evaluator's last resort for filling a field is `getByRole('textbox').first()`
  with no name at all. That is REQ-2.7.5, where "Projects" was typed into the banner's search box
  while the Edit labels dialog was open.
- **A row title may not be answered only by a hover-only control.** The helpers resolve a row's
  title through the same role ladder they use for actions, and rung 1 is button. With the row
  hovered, `"Color for <title>"` beats the row's own title text, and the next re-render hides it
  for good: REQ-2.8.2. The check compares the controls answering to each seeded title with the row
  at rest and with it hovered, and fails when hovering is what made one appear. The supplement now
  says that a hover-revealed action is named by its verb alone, since only one row shows its
  actions at a time and the verb is already unambiguous.
- **Every row and composer action must be reachable inside it by the verb the helpers use.** With
  no `more`, `options` or `menu` control in the composer, `openMoreOptionsForNote` left the
  composer and clicked the page banner's own "Menu": REQ-2.7.4. The check hovers each seeded row,
  opens each input group, and fails a verb that resolves only outside the container.
- **A freshly loaded entry page must carry every control it carried before.** `settings.js` applied
  its hide after an async fetch and restored synchronously, so a superseded open left the page
  hidden with nothing open: REQ-4.2. The walk now compares the reloaded entry page against the
  baseline after every click.
- **A batch that spends its own call cap gets one more attempt.** Batches 7 and 11 hit the 20-call
  cap, were rolled back, and three of the seven official failures were their requirements. The
  retry starts from the restored tree, is capped at 12 calls, and carries the first attempt's last
  failing check output in its request. `batch_retry` goes on the trace; a second failure records
  `batch_incomplete` exactly as before. Only the call cap earns a retry: any other failure would
  spend a second batch's calls on the wall it just hit.

Two supporting changes. The walk now restores the store before every reload, not only at the end,
so a state is always reached from the seeded rows and a control missing after a reload means
something. And the container rule is not applied to an input group that lies inside an open
chooser or wraps one, because the inertness rule governs those; without that, one application's
search filter dialog rendered inside its banner read as a single container holding the banner's
search box and the dialog's own buttons.

Measured on `runs/2026-09-14-keep-full-5/app`, fresh data directory, this machine:

| Quantity | Value |
|---|---|
| States inspected | 25 |
| Check wall time | 6727, 6887, 7077 ms over three runs, against 6503 ms for the rules as they stood |
| Verb collapse, namelessness, form durability | do not fire, correctly |
| Chooser inertness, name leak | fires once: the search filter dialog leaves `Work` and `Reminders` addressable behind it |
| Chooser inertness, exposed input | fires four times, including the Edit labels dialog with the banner's `Search` box visible |
| Row title answered by a hover-only control | fires on every seeded row, naming `Color for <title>` |
| Verb resolving outside its container | fires twice on hovered rows (`menu`, `labels`) and twice on the composer |
| Controls a reload does not restore | does not fire |

Two honest limits. The recovery rule cannot catch REQ-4.2 as that defect actually behaves: the
hide lives in the DOM and a reload rebuilds the page, so only a hide that outlives a reload is
visible to it. Its fixture is a page that remembers the hide, and the race itself is still not
reproduced. And the container rule is the one rule here that can fire where no requirement asked
for the action: a page with a global control answering a verb, and a row that legitimately has no
such action, is a finding. The composer is checked against the six verbs the published helpers
actually use on a composer rather than all eight, which removes the noisiest case.

Suite 352, 4 skips, with a local Playwright 1.61.1 and Chromium supplied. Five synthetic fixtures under
`tests/fixtures/` are hand written and implement no requirement: the hover-rows page that passes
every rule, and one page each for a modal that is not inert, a hover-only control carrying the row
title, a verb that resolves outside its row, and controls a reload does not bring back. No
generation has been run against any of this.
