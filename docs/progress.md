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
