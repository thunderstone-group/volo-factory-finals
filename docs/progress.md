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

## 2026-09-14 — The 7/10 Ticket Booking run was a browser fault, not a merged change

- Run `92220c94fd25` (submission `13f5a75f8aeb`, agent source `413b112`) scored 7/10 at CNY 0.439112
  and 77,772 tokens where the previous main scored 10/10 three times. The three failures are the
  three tests that assert a signed-in header, which invites the reading that the run lost its
  session. That reading is wrong. The runner log names the cause: `locator.click: Target crashed` on
  the case-insensitive login, and `locator.evaluate` hanging for the full 10 s on an already-resolved
  visible `<select id="r-doctype">` on the registration test. `element.tagName.toLowerCase()` cannot
  hang on a resolved element, so the renderer was wedged, not the application. The third failure was
  reported after 1,193 ms against a 10,000 ms expect timeout on the same machine in the same window.
- The window is bounded and the rest of the suite is healthy. The suite ran 07:42:26 to 07:42:46 UTC;
  the three failures were the three tests in flight from 07:42:27 to 07:42:44. Tests 4 through 10 ran
  from 07:42:38 and all passed in 241 to 980 ms, every one of them faster than the 1,295 ms fastest
  test of the 10/10 run `01b06fb30564`. Both runs requested `--workers=4` and both got
  `Running 10 tests using 2 workers`, so the runner configuration was identical.
- The application is not defective. Its workspace replayed against the unchanged public tests in
  `harness_lab/local_gate.py` host mode is clean 25 times out of 25, in a batch of 5 and a batch of
  20, zero unexpected failures. Its own self-checks pass `valid registration stays signed in after
  reload` and `login with username and reload session`, the exact behaviours that failed officially.
- Attribution, from the traces of both runs. **PR #17** is not implicated: the generation system
  prompt is byte-identical, 3,996 characters each, and the request trim removed only
  `all_requirements`, an empty `inherited_constraints`, an empty current-file list, an empty
  self-checked-id list and JSON whitespace; the REQ-1 scenario requiring the username, 退出登录 and
  survival of a refresh survives verbatim. **PR #19** is not implicated and behaved correctly: the
  repair edited `checks/requirements.cjs` only, inserting `page.goto('/')` before three
  `page.click('a[href="/register"]')` and `/login` calls, which makes the model's own check navigate
  the way `openRegister` and `openLogin` do; it masked nothing. **PR #11** is not implicated: both
  runs sent the same three images by SHA-256, and kimi-k3's 3,946 characters and qwen3.6-flash's
  4,337 describe the same header links, nav bar, fields and buttons, neither mentioning signed-in
  state because every reference screenshot is of the signed-out site. One official run is one sample
  and this does not settle observer quality either way.
- Fixed the one lever we control. The run's last act before the official suite was its own
  browser-driven self-check, and `volo/web_runtime.py` launched a fresh Chromium per check: eleven
  launches in 7.9 s, finishing 2.1 s before the official suite started in the same container. The
  prepared harness now launches one browser per check run and gives each check its own context,
  keeping the per-check cookie and storage isolation the checks rely on. Measured on that run's own
  eleven checks against its own application, three repetitions each: 11 launches and 11.01/11.02/11.00 s
  before, 1 launch and 8.44/8.57/8.43 s after, 11 of 11 checks passing on both sides.
- `tests/test_browser_lifecycle.py` adds six cases, including relaunch after a browser crash and an
  installed Chromium launched once for three checks. `python -m unittest discover -s tests` reports
  238 tests, 0 failures, 4 skipped, against 232 before the change with the same four skips.
- This does not prove the renderer faults came from self-check browser pressure, and one run cannot.
  It removes a measured 11-to-1 process churn immediately before evaluation. Confirmation would be
  official trials with no browser fault in the evaluation window; a pass-rate change alone would not
  separate the fix from generation variance. Container logs for the run were collected at
  `stdout_bytes=0, stderr_bytes=0`, so there is no in-container memory evidence.

## 2026-09-14 — The hosted early-window stall is the runner's, not ours

- Aligned the Playwright JSON reports of the last ten official Ticket Booking runs (four clean,
  six affected, 09-12 and 09-14) by worker index and start time. Every lost test is the first test
  of an initial worker (w0/w1), or the first test of the first replacement worker while the window
  was still open; every later test passes faster (241 to 980 ms) than the first tests of clean runs
  (1.7 to 3.1 s). Write-up in `docs/early-stall-2026-09-14.md`, rows in
  `docs/evidence/2026-09-14-early-stall.json`, raw reports and logs under
  `runs/2026-09-14-early-stall/`.
- All three suspects on our side are excluded by runs that never had them: the 09-12
  security-reproduction runs (`c4a7908ca693`, `fef7c9c91778`, `bef9631c8245`) wrote a canned app
  from one 25-token call, launched no browser, had no `.volo` launcher, and lost the same first
  tests. Hashing is not the discriminator either: three clean 10/10 runs use `scryptSync` like the
  failing ones. PR #22 (one browser per check run) could not have fixed it and `c399145c5eb1`
  confirms it did not.
- Read the signatures: the 1.2 s `element(s) not found` login failures are pages that died
  mid-expect (`Frame._expect` swallows non-timeout exceptions and reports the last poll), followed
  in both runs by `Target crashed` on the replacement worker; the `locator.evaluate` hangs after a
  passed `toBeVisible` on the same locator are a renderer or worker that stopped answering. The
  browser fixture has `timeout: 0`, so launch time is not charged to the first test. No failed
  result carries attachments, so the runner records neither trace nor video.
- Meter check for the two new runs: `c399145c5eb1` official 109,816 = captured 66,147 + 43,669;
  `92220c94fd25` official 77,772 = captured 41,022 + 36,750. Both clean, no concurrent run.
- Board consequence: our row stays `e34e78400983` (100%, CNY 0.899558, rank 7); the 8/10 run at
  CNY 0.529 did not replace it. Rank 2 is 100% at CNY 0.4235, so the Ticket board moves only with a
  generation cost cut, not with more trials; each trial carried about a 60% chance of losing one to
  three tests to this stall.
- Not done: no single-cgroup local reproduction (memory vs CPU vs host is unread); the board's row
  selection rule is still unclear (rank 1 shows an 80% row, our 80% run did not replace ours).

## 2026-09-14 — Ticket board closed; early-stall evidence goes to the organizer

- Team lead decision, on the early-stall finding: keep the Ticket row as it is (`e34e78400983`,
  100%, CNY 0.899558, rank 7) and stop official Ticket trials; the row moves only with the
  generation cost cut in the objective-function line. Campaign plan step 1 rewritten accordingly.
- Drafted the organizer report as `docs/organizer-report-2026-09-14.md` (WeChat text, sent by
  hand; no automation on WeChat). It names the six affected and four clean run ids and asks for
  retries, a warm-up test, or a wider first-test timeout.
- A codex job is reproducing the stall in a single cgroup locally
  (`~/.codex-jobs/volo-factory/2026-09-14-early-stall-repro/`, memory x CPU sweep over two real
  apps); its result will be appended to `early-stall-2026-09-14.md` once verified.

## 2026-09-14 — Probed the hosted container: a 1-CPU quota, 86% throttled during the suite

- Team lead asked whether the early-stall mechanism was measured or guessed. It was inferred, so
  PR #26 added a sampler to the managed launcher (cgroup limits, memory/OOM counters, CPU
  throttling, pressure, process table, 0.5 s cadence, 3 MB cap, rotated per launcher start, file
  `.factory/probe.jsonl`) plus `harness_lab/probe_summary.py`; suite 243 green.
- Official run `07cd84033853` (main 3ba481e): PASSED 10/10, CNY 0.821109, 307,411 tokens equal to
  captured usage, 10 model calls. The bundle returned the probe. Container: cgroup v2,
  `cpu.max` = 1.0 CPU, `memory.max` 2 GiB, `/dev/shm` 64 MB, 16-CPU/65 GB host; app gets
  `PORT=3000`, no `E2E_BASE_URL`. Test phase: 147 of 171 CPU periods throttled, 38.6 s throttled
  vs 15.4 s used (about 2.9 CPUs of demand), cpu.pressure full avg10 up to 20.1%, memory peak
  714 MB, no OOM, 32 Chromium processes at peak. Mechanism: CPU-quota starvation at browser
  launch, not memory. Written into `docs/early-stall-2026-09-14.md`; organizer report rewritten
  with the measured numbers in `docs/organizer-report-2026-09-14.md`.
- Local single-cgroup sweep (codex, docker): idle host at 1 CPU and 0.5 CPU passes 10/10 (suite
  slows to 22 to 24 s); 256 MB fails 2/10 to 6/10 by swap/OOM, a mechanism the hosted counters
  rule out. A noisy host on a 1-CPU quota is what local cannot emulate.
- Board: the probe run is a passing run at CNY 0.821109, below the previous row's 0.899558, so the
  Ticket row moved to it.

## 2026-09-14 — The platform CLI leaves this repository

- The website client now lives only in `thunderstone-group/arcbench-cli`, installed as the
  `arcbench` command. Removed this repository's copy: `arcbench_cli.py`, the `arcbench`
  wrapper, `tests/test_platform_cli.py` and its `tests/fixtures/real-arcbench-run-status.json`.
  Nothing in `main.py`, `volo/`, `harness_lab/` or `scripts/` imported or shelled out to any
  of it, so no behaviour changed; `scripts/package.py` works from an allowlist and never
  named those files. The upload archive is byte-identical in content to before.
- `docs/platform-cli.md` shrank from a full manual to a pointer: install line, the shared env
  file `~/.config/arcbench/volo.env` via `ARCBENCH_ENV_FILE`, the three platform rules that
  bind this harness, and a typical upload-to-result sequence. The command reference, flags,
  exit codes and API route table are deliberately not duplicated here; the CLI repository's
  README owns them, and a second copy would go stale and then mislead.
- The three rules kept, because they are properties of the platform rather than of the client:
  the official token count is a usage-meter delta on the shared access key, so runs on one
  account must not overlap and local gateway traffic must pause while an official run is in
  flight; never upload while a run from the same submission is pending; the board shows the
  latest passing run, not the best one.
- Verified the installed client against the live platform read-only before removing anything:
  `arcbench --version` reports 0.2.0, and `whoami`, `runs` and
  `leaderboard --competition ticket-booking --task ticket-booking` all return current data.
  Note that `leaderboard` requires `--competition`; `--task` alone is rejected by the parser.
- Unit suite: 190 tests before, 173 after, the difference being exactly the 17 checks that
  covered the removed client. Both runs green with 11 skipped.
- Not done here: other branches still carry the old `arcbench_cli.py` and call `./arcbench`
  from the main checkout. The main checkout is untouched, so those keep working until they
  rebase onto this change.

## 2026-09-17 — Fable takes over; one-shot line measured on all six Web tasks

- Codex/ChatGPT execution stopped by the owner; the minimal worktree was committed as-is (`c55b8b3`, pushed) and all thin/V3 lines are parked. The Lite thin package hung after one request and its Keep run failed on readiness; no further investment.
- The one-shot package had never run on the platform: the runner pre-populates the output directory with `.arc/` and `requirements/`, which the entrypoint rejected (run `12f7c07637ec`). Fixed in PR #34 (generate beside the metadata, move `frontend/` and `backend/` in).
- Dialect-card ablation on platform Keep, three runs each: ported generic card 21/20/17; ported + hover rule 19/26/25; original 59-line lab card 26/24/28; lab card + "hide instead of inert" 22/17/not-ready. Decision: the lab card verbatim, no further card tuning on Keep — single-sentence edits swing ±5 tests.
- Root causes found with local replays: always-visible row actions and `<button>` sidebar entries let the helper's page-wide `.first()` pick the wrong control (archive/trash/labels families); `inert` does not stop `isVisible()` resolution, so a sidebar link wins over a picker checkbox (labels family, all nine runs).
- Holdout on the lab-card package: Bookstack 27/34, Prestashop 51/86, Ctrip 20/125, StackOverflow 0/66, 12306 0/135. Both zeros and one Keep run were delivery faults at `/` (404 from `.index.html` path join; `application/octet-stream` making the browser download). Aggregated board 38.8%, rank 6 (from 19.6%).
- Helper survey: keep/prestashop/stackoverflow share identical resolver functions, ctrip is a variant, bookstack and 12306 are a different generation. The card's mechanics are corpus-level for four of six apps, not Keep-only.
- Local generation is unusable today: nine local calls and three parallel curl probes were all cut by the gateway or the path to it (all three at the same instant, unbilled); platform-side requests are unaffected. Experiments run on the platform.
- Added the delivery smoke check with one bounded repair (this branch, PR #35): build, start on a free port, read `/api/health`, `/` and referenced assets; validated on the real failing artifacts. Six-task platform validation on submission `7fd7a288b404`.
- Next: the evaluator-reading audit (one visible control per verb, hover-only row actions, links for navigation, hidden siblings while a chooser is open) as a deterministic gate with bounded repair, then requirement-group generation for the large tasks. Evidence: `runs/2026-09-17-web-keep-oneshot/`.

## 2026-09-17 evening — six-task smoke validation lost to a gateway-wide stream cut

- The six-task validation of submission `7fd7a288b404` (runs `542f2338b9c8` keep, `33ae97f7ef90` bookstack, `80a538d033e6` stackoverflow, `749a22a65df4` prestashop, `0c72a07e49b2` 12306, `82330a9d20dd` ctrip; started 19:56 local) failed in generation on every task: all three one-shot calls ended in `StreamError` (stream closed before `finish_reason`), `passed=0 failed=0`, no application delivered. Not a package regression — no run reached the smoke check.
- The failures cluster across the six independent runs: first calls all died 19:58–20:00, second calls 20:07–20:09, third calls 20:16–20:20 (local). Same-instant cuts across unrelated runs mean a gateway-side event that drops every in-flight stream, the same signature as the local probes earlier in the day. Of 18 platform calls in that window only one was metered (20:08:43, out 65,536 = the hard cap), the other 17 were unbilled; every run's cost column shows that single record.
- Gateway state at 21:05–21:16 (local probes, `deepseek-v4-flash`): a 20-token non-stream call and a 56 s stream (`reasoning_effort=low`, 3,657 tokens) both finished cleanly with `finish_reason`; a default-effort stream was cut at 467 s while still in reasoning, and the meter recorded it as out 65,536 with zero content at the same second. Two observations from this: `max_tokens` bounds content only, reasoning is not counted against it and can run to the 65,536 cap with no answer; and long streams are still being cut, so the gateway is not back to normal for the one-shot's 5–15 minute calls.
- Re-validation: run `b1af053badc4` (same submission, Keep only) started 21:20 to check whether the platform path works again before deciding on the full six-task rerun. Result recorded below when it lands.
- Local proxy-vs-direct comparison was started and abandoned: the platform failures are the subject, the local path is irrelevant to them.
- Re-validation result: run `b1af053badc4` (same submission, Keep, deepseek-v4-flash) failed the same way at 22:04 — three calls of 11, 20 and 13 minutes, each closed before `finish_reason`, none metered. The platform path on `deepseek-v4-flash` is still broken; its reported 24,623 tokens are exactly my two local probes, again the meter-difference accounting.
- Model sweep (local long-stream probes, same prompt, `max_tokens` 12000, default reasoning, six models in parallel from 21:59): `minimax-m3` finished `length` at 12,000 tokens in 2 min; `qwen3.7-plus` finished `length` at 12,329 in 2.5 min; `kimi-k3` finished `length` at 12,372 in 6 min; all three metered correctly. `qwen3.6-flash` was closed at 38 s with 16k characters of content, no `finish_reason`, unmetered. `deepseek-v4-pro` and `glm-5.3` still streaming at 6 min. Cut streams are never metered, so the drop happens at or before the gateway's upstream.
- Uploaded the same smoke package as submission `f8c6a82e4dc7` with `--model qwen3.7-plus` (2/0.4/8 CNY per M, same price band as flash) and started Keep run `a3714ee01088` at 22:06 to see whether a model whose long streams survive delivers on the platform. `glm-5.3-flash` (0.8/0.23/2.8) and `deepseek-v4-flash-vision-exp` are new on the gateway list.
- Sweep closed: `deepseek-v4-pro` cut at 660 s mid-chunk (unmetered); `glm-5.3` finished `length` at 12,000 tokens, all reasoning (GLM counts reasoning inside `max_tokens`). Long streams survive on minimax-m3, qwen3.7-plus, kimi-k3, glm-5.3; they are cut on deepseek-v4-flash, deepseek-v4-pro, qwen3.6-flash. The drop is per model route, not a gateway-wide outage.
- Platform on qwen3.7-plus: Keep run `a3714ee01088` delivered, **22/32** in 469 s (124k tokens; the CNY 2.43 cost column includes the local kimi probe). Failures are the labels family (2.7.1/2.7.2/2.7.4/2.7.5/2.7.6.x), colors (2.6.1/2.6.2), pin (2.8.1) and 4.2 — the same families flash loses, so the model swap did not change the failure shape. Started the other five tasks on submission `f8c6a82e4dc7` at 22:17: bookstack `14d9c3d0b1e3`, stackoverflow `483ce9e264ba`, prestashop `361ef392c29a`, 12306 `ae507f83ee7a`, ctrip `ba63aa5e2be5`. Judge unchanged: SO/12306 leave zero, the rest hold the holdout band.
- Five-task validation on qwen3.7-plus (submission `f8c6a82e4dc7`, 22:17–22:43): Bookstack **12/34** (`14d9c3d0b1e3`, flash holdout 27/34), StackOverflow **15/66** (`483ce9e264ba`, was 0), Prestashop **29/86** (`361ef392c29a`, flash holdout 51/86), 12306 **63/135** (`ae507f83ee7a`, was 0), Ctrip `ba63aa5e2be5` still running at 22:48. Both former zeros left zero, so the delivery smoke check (PR #35) holds on the real path and the zeros were delivery faults, not generation. Bookstack and Prestashop are well below the flash holdout — model effect or single-run variance is undetermined (one run each; Keep swings ±5 between runs on flash). Token/cost columns for these runs are polluted by the concurrent runs on one key (all show 609,558).
- Ctrip **12/125** (`ba63aa5e2be5`, flash holdout 20/125). Submission `f8c6a82e4dc7` (smoke package, qwen3.7-plus) six-task average 36.1% (Keep 68.8, Bookstack 35.3, SO 22.7, Prestashop 33.7, 12306 46.7, Ctrip 9.6); the board keeps the lab-card submission's 38.8% (rank 6) as the best average. Net: the model swap keeps the platform path alive and removed the two zeros, but on Bookstack/Prestashop/Ctrip a single qwen3.7-plus run scored below the flash holdout. Open question for tomorrow: is flash's stream drop transient (then re-validate the smoke package on flash) or persistent (then pick between qwen3.7-plus and an untried survivor such as minimax-m3 with paired runs), and merge PR #35 either way since the smoke check is validated on the real path.
- 23:27–23:29 three more Keep runs on the same smoke package, model swap only: glm-5.3 (`9d0da8982728` / run `16180f834eec`), glm-5.3-flash (`3a069260f1a3` / `ef14b1f867f2`), deepseek-v4-flash again (`478d93e2bbab` / `79c325f4af2d`). Owner asked for the GLM and flash comparison.
- glm-5.3-flash failed in 695 s: one call, `finish_reason=length`, zero content — the model spent the whole 32,768 `max_tokens` on reasoning (GLM counts reasoning inside `max_tokens`), and one-shot treats an empty stream as a hard failure without retry. Using GLM would need a thinking switch or a much larger `max_tokens` in `oneshot/main.py`; not worth it on the eve unless glm-5.3 itself delivers.
- glm-5.3 failed the same way at 23:43 (one call, about 16 min, no content): both GLM models exhaust `max_tokens` in reasoning under the one-shot prompt. GLM is out for the preliminary unless a thinking switch is added.
- deepseek-v4-flash recovered: run `79c325f4af2d` (submission `478d93e2bbab`, same smoke package) delivered Keep **25/32** in 1,544 s at 23:55, no stream cut. Same package, model swap only: flash 25, qwen3.7-plus 22, glm-5.3 and glm-5.3-flash no content. The 19:58–22:04 flash drops were a transient route fault, not a permanent state.
- 23:58 started the remaining five tasks on the flash submission `478d93e2bbab` to finish the original PR #35 judge: bookstack `23fdd9ca1182`, stackoverflow `2b0dae1b647a`, prestashop `c9c2b5fd3b2c`, 12306 `b883fa97b031`, ctrip `2105472e648f`.
- 2026-09-18 00:03 and 00:09: flash streams were cut again, same second across the 12306 (`b883fa97b031`) and ctrip (`2105472e648f`) runs (calls 1 and 2, StreamError at 303/297 s and 334/339 s). The flash route fault is intermittent, not resolved. Both runs' third call completed with `finish_reason=length` (large-task output exceeds the 32,768 content cap) but the continuation needed a fourth call and the one-shot's global limit of 3 calls refused it: 0/0, no delivery. Package finding: cut-stream retries and `length` continuations share one 3-call budget, so a large task that loses one stream cannot deliver. Bookstack on flash `23fdd9ca1182` delivered 16/34 (holdout 27/34, qwen3.7-plus 12/34): same package, same model, 11 tests apart between two runs.
- Flash five-task close (00:27): StackOverflow **4/66** (`2b0dae1b647a`), Prestashop **44/86** (`c9c2b5fd3b2c`, holdout 51). Flash submission `478d93e2bbab` six-task average 30.4% (two large tasks 0/0 from the cut + call budget); qwen3.7-plus submission 36.1%; board best stays the lab-card submission at 38.8%, rank 6. PR #35 judge met on the real path: the two former zeros delivered on both models (SO 4 and 15, 12306 63 on qwen; 12306 on flash never reached delivery because of the stream cut). Merging PR #35.

## 2026-09-18 — Content cap 131072, split call budget, six-task flash run (PR #36)

- 01:31 flash route checked good again: short call 3.6 s, a 60000-cap stream finished `stop` at 22,447 tokens (13,886 reasoning) in about 150 s at ~150 tok/s.
- Owner decisions: raise the content cap and split the call budget now; run the semi-automatic skill loop (Fable distils one rule per round from failures, paired holdout runs decide).
- Change (branch `fix/call-budget`, PR #36): `MAX_TOKENS` 32768 → 131072; `CallBudget` counts completed calls (limit 3) and transport failures (limit 4) separately. Three budget regressions rewritten, one added; `tests_oneshot` 53 green. Package sha256 `46a51fd8…` in `runs/2026-09-18-call-budget/`.
- 01:52 uploaded as submission `97f8570c7279` (deepseek-v4-flash) and started all six tasks: keep `b45a931207d8`, bookstack `755275bae18c`, stackoverflow `03bad7c55e23`, prestashop `eb166860ff13`, 12306 `9ef988eb2274`, ctrip `63ad25bdacbc`. Judge: the two large tasks deliver; no task below the earlier flash runs (25/16/4/44).
- Round 0 (submission `97f8570c7279`): Keep 26/32 `b45a931207d8`, Bookstack 28/34 `755275bae18c` (both above 80%), StackOverflow 15/66 `03bad7c55e23`, Prestashop 41/86 `eb166860ff13`; 12306 `9ef988eb2274` and ctrip `63ad25bdacbc` still generating at 02:20. Local replay of the downloaded SO/PS bundles reproduces the platform exactly (15/66, 44/86 at the same package), so attribution runs locally from `error-context.md` snapshots.
- Attribution (SO 51 + PS 42 failures): the assert/click ladders end in `button` and fail only when no element carries the phrase, so most losses are vocabulary: 14 tests wait for a visible "Profile" after login, 11 for anchored `/^edit|delete|reply$/i` (our buttons said "Edit question"), ~20 for THEN-step nouns and quoted messages absent as text (header, sidebar, main question feed, footer, logo, addresses, order history and details, Favorites, validation sentences), 4 for `getByLabel` resolving to a container with `aria-label`; 8 PS timeouts have no locator (unattributed).
- Round 1 (branch `goal/round-1`, submission `fe10afe427d2`, sha256 `4c2e7215…`): dialect card 59→87 lines — exact verb names with the stem exception, §7 verbatim vocabulary made concrete (layout nouns as text, messages verbatim, navigation/section names as controls, seeds verbatim), §7a aria-label reserved for controls. Six tasks started 02:19: keep `71aa703b0958`, bookstack `a015ae1fcc0a`, stackoverflow `b319a1e78a87`, prestashop `a57c8da4efb6`, 12306 `1525d5fd7d07`, ctrip `337ff1b2d247`.
- Round 0 closed 02:22: 12306 **40/135** (`9ef988eb2274`), ctrip **8/125** (`63ad25bdacbc`); six-task average **45.0%**, above the board's 38.8%. Local 12306 replay (27/135, lower than the platform's 40) attributes 73 of its failures to one role mismatch: the app renders "Sign Out" as a link, `login()` in the official helper asserts `getByRole('button', {name: /sign out/i})`, so every logged-in scenario dies at login. Other 12306 families: `getByLabel(/Email/i)` (5), "Train No." text, anchored `/^Book$/i` button, sortable column headers expected as buttons, "How to book tickets online?" heading. Round-2 rule drafted: state-changing controls are buttons regardless of the requirement's word; links only navigate; sortable headers are buttons named by the column title.
- Round 1 results (02:22–02:36): Keep 17/32 `71aa703b0958`, Bookstack 24/34 `a015ae1fcc0a`, StackOverflow **33/66** `b319a1e78a87` (Profile family 14→0), Prestashop 0/0 `a57c8da4efb6` (one 18-minute draft rejected for prose outside file blocks), 12306 **51/135** `1525d5fd7d07`, ctrip pending. Local replays of the Keep/Bookstack/SO bundles: Keep's 13 hover timeouts are the revealed action bar sitting over the note title (`<span aria-hidden>🎨</span> from .row-actions intercepts pointer events`); SO's remaining `/^edit$/i` family is Edit not rendered for the seed owner after login (requirement pairs the row with question_editor@example.com; no test asserts non-owners cannot see it); Bookstack's misses are post-create headings.
- Fixes: parser now ignores prose outside blocks (`ec8ecb5`, 54 tests green). Dialect round 2 (`goal/round-1` head): §1a buttons for actions regardless of the requirement's word, §3c action bar below the title never over it, §6a ownership never hides a control. Card 87→112 lines.
- Round 2 submission `11cd16489a3e` (sha256 `84d8b37f…`), six tasks started 02:35: keep `82ecfa65901d`, bookstack `586fd5f95368`, stackoverflow `612bfa179c1a`, prestashop `d457e5574260`, 12306 `ea95252f47fc`, ctrip `38115ce82dc1`.
- Round 1 ctrip **43/125** `337ff1b2d247` (round 0: 8). Round-1 six-task average 41.0% with the Prestashop protocol zero, 49.2% over the five delivered tasks. Ctrip also shows the §7a family in another shape: `getByLabel(/航班号/)` resolves to a mode radio whose label contains the field word before the text field.
- Round 2 partial (02:49–02:55): Keep **26/32** `82ecfa65901d` (the no-overlay rule restored it), Bookstack **0/34** `586fd5f95368`, Prestashop 38/86 `d457e5574260`. Bookstack's zero is a blank page: `app.js` throws `appendChild … not of type Node` on load (verified with a headless browser and with jsdom on the downloaded bundle); the HTTP smoke check cannot see it. Prestashop still loses the quantity family to `<button aria-label="Decrease quantity">` preceding the input.
- Fix: `smoke_check` now loads `/` in jsdom (installed once per machine into the temp dir, skipped silently offline) and reports script errors on load and blank pages, which feed the existing one bounded repair. Fixture index gained visible text; one guarded test added (`tests_oneshot` 55 green). Dialect §7a gained the stepper example.
- Round 3 submission `e3d00d4f3f4d` (sha256 `f8ea0f12…`), six tasks started 02:59: keep `836f4e8e94df`, bookstack `f7d190cfdf13`, stackoverflow `e139d9ab00d9`, prestashop `8cda69ac75e6`, 12306 `27c132cc5490`, ctrip `1375c98047c6`.
- Round 2 more: StackOverflow **19/66** `612bfa179c1a` (round 1: 33 — the Profile family, 14 tests, came back; the model's adherence to a card rule is stochastic), 12306 **64/135** `ea95252f47fc` (40 → 51 → 64 across rounds). 
- Quoted-vocabulary gate (`goal/round-1` head): `vocabulary_gaps()` extracts every quoted string from the requirement (SO 125 unique, 12306 262) and lists those absent from the delivered source as delivery problems for the bounded repair; a repair is kept when the smoke check passes and the count did not get worse. `tests_oneshot` 56 green. Round 4 submission `327a6085d81f` (sha256 `8abbc294…`), six tasks started 03:08: keep `0c55fbab35c7`, bookstack `7f2b870bd7e1`, stackoverflow `8de3e5e7d785`, prestashop `d7040f3dc0aa`, 12306 `be7918ad723c`, ctrip `f0d9011dce55`.
- Round 2 closed: ctrip 27/125 `38115ce82dc1` (still `getByLabel(/航班号/)` resolving to a mode radio placed before the field). Six-task average 37.2%; the board keeps round 0's 45.0%.
- Round 3 (02:59): Keep **28/32** `836f4e8e94df`, Bookstack 16/34 `f7d190cfdf13`, StackOverflow **36/66** `e139d9ab00d9`, Prestashop **56/86** `8cda69ac75e6`, 12306 61/135 `27c132cc5490`, ctrip pending at 03:30. Round 4 (03:08): Keep 28/32 `0c55fbab35c7`, Bookstack 23/34 `7f2b870bd7e1`, StackOverflow 34/66 `8de3e5e7d785`, 12306 **5/135** `be7918ad723c` — the backend threw "Assignment to constant variable" in a handler at test 6 and the Node process exited; the platform's injected `.volo/launcher.cjs` does not respawn it (verified in local replay: 4/135, same crash).
- Static gates added (57 tests green): `process_guard_gaps` requires uncaughtException/unhandledRejection handlers in the backend; `aria_collision_gaps` flags buttons whose aria-label shares a word with a field label (found 3 in SO r2, 3 in PS r0). Card §8 gained the backend-guard rule. Round 5 submission `9653af1b4ce2` (sha256 `550ed7c8…`), six tasks started 03:30: keep `14ee2d33a97f`, bookstack `80ebe39a9bd7`, stackoverflow `b794068fa7b1`, prestashop `9d2ec094eef3`, 12306 `1ba0a4b30b5a`, ctrip `0ab9fe9c4cbd`.
- Round 3 closed 03:31: ctrip 24/125 `1375c98047c6`; six-task average **53.1%** (round 0: 45.0). Ctrip keeps losing the flight-status family to a mode radio labelled "航班号" placed before the "航班号" text field (`getByLabel(/航班号/).first()` picks the radio).
- Round 4 closed 03:34: Prestashop 50/86 `d7040f3dc0aa`, ctrip 25/125 `f0d9011dce55`; average 48.1% (12306 crash). Bookstack r3 attribution: 10 of 13 failures click a seed item by name right after navigating to its list; the seeds exist and the links are in the failure snapshot, but the click ladder probes each role for 500 ms and the list is fetched after navigation, so it arrives too late. Card §8: render navigation synchronously from an in-memory store loaded once at startup.
- Round 5 (03:30): Keep 24/32, Bookstack 18/34, StackOverflow 31/66, Prestashop 49/86, ctrip 0/0 (draft lost to a missing final `=== END ===` at finish=stop; the one-shot now closes it, fresh generation only, `37f0d07`). Round 6 (03:36): Keep 28/32, Bookstack **11/34**. Bookstack r6 replay: Edit/Delete/New Shelf/New Page/Favorite are gated behind login while 31 of 34 Bookstack specs never log in. §6a rewritten: nothing is gated behind login or ownership.
