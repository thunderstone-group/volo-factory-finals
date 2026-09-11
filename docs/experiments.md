# Experiments

## E001 — First fresh Agent run

- Date: 2026-09-11.
- Source: `bb2620c` on `feat/agent-v1`.
- Submission: `volo-factory-v0.1.0-bb2620c`.
- Archive SHA-256: `b178b7f2bb4b6eda4c0e396eb083f350073e91d15129519f5fd2d66d82099833`.
- Model: `deepseek-v4-flash`, organizer gateway `https://api.arc-bench.com/v1`.
- First task: Smoke Counter.
- Run: https://arc-bench.com/runs/39f46bfbb151
- Status: **official failure, 0/1 tests**. Generated application built and passed its
  own real Playwright checks, but the official test never reached application assertions.
- Official error: `browserType.launch: Executable doesn't exist at /ms-playwright/chromium-1200/chrome-linux64/chrome`.
- 11 model requests. API responses total 94,213 tokens, including 56,832 cached prompt
  tokens. Gateway records 151,045 tokens and CNY 0.192947; displayed duration 124 seconds.
- The gateway's token figure equals response totals plus cached prompt tokens in this run.
  This is an observed accounting difference, not a verified general scoring specification.
- Root cause: generated tool commands installed Playwright 1.63.0 and downloaded Chromium
  revision 1243 into the shared `/ms-playwright` cache. Only revision 1243 remained afterwards;
  official evaluation still required revision 1200. Playwright's documented stale-browser
  garbage collection explains the loss of the prior revision.
- Evidence: the downloaded run artifact is retained locally under ignored
  `runs/e001-counter/`. Its trace contains actual provider responses and tool commands.
- Fix: deterministic discovery of preinstalled browser tooling, an explicit module path for
  generated checks, `PLAYWRIGHT_SKIP_BROWSER_GC=1`, and an isolated browser cache when no
  compatible preinstalled module is available. Do not change official evaluator settings.
- Efficiency change: provide runtime facts in the first prompt, avoid duplicate input reads,
  discourage environment probing and reuse a successful check only when source is unchanged.

Reference: [Playwright browser versioning and stale browser removal](https://playwright.dev/docs/browsers).

Run tasks serially when using one metered team key, because the platform captures
usage baselines around runs. Concurrent use could complicate per-run attribution.
This is a conservative experiment-control choice; the exact gateway aggregation
semantics have not been independently verified.

The fresh agent receives the requirement document and generates its implementation.
No previous smoke code or prewritten task solution is packaged into this submission.

## E002 — Compatible browser runtime and fewer discovery calls

- Source: `ac8c4ab`, submission `volo-factory-v0.2.0-ac8c4ab`.
- Archive SHA-256: `3712dc79d21e1b401612803d138cdfc563611ff8a7fb75fd45dc2e790f5660e6`.
- Counter: https://arc-bench.com/runs/a1d0daf8b5bd — **1/1 official tests**, 41 seconds.
- Dice: https://arc-bench.com/runs/bfe886440565 — **1/1 official tests**, 28 seconds.
- Both actual traces confirm discovery of `/opt/arcbench/node_modules/playwright/index.js`
  and the existing Chromium revision 1200. Self-checks used real browser interactions.
- Counter used three model requests; dice used two. The first responses spent 4,134 and
  2,965 tokens respectively on reasoning despite the small requirement scope.
- Combined leaderboard cost: CNY 0.161127; reported gateway tokens: 0.047M; average runtime: 34 seconds.
- Rank at observation: **2**. Another team improved its cost to CNY 0.044692 while these
  runs were in progress. The earlier leaderboard snapshot was not treated as a fixed target.
- Next experiment: disable DeepSeek thinking only for small batches, retain it for larger
  requirements, and expose only one completion/verification action to eliminate redundancy.
- Raw generated artifacts remain local under ignored `runs/e002-counter/` and `runs/e002-dice/`.

## E003 — Small-batch thinking disabled

- Source: `4cca774`; effective submission `volo-factory-v0.3.0-4cca774-r2`.
- Archive SHA-256: `533d4510869f327962b9d69e8d8a60d8d2ed967330d31eb775d47a325628f487`.
- The first saved record could not start: browser Network diagnostics captured HTTP 409,
  `The submitted agent archive is no longer available`. No model run was created by those
  failed starts. Saving identical bytes under a unique filename succeeded; the underlying
  platform storage failure has not been independently diagnosed.
- Counter: https://arc-bench.com/runs/ad10919cab86 — **1/1**, 49 seconds, 21,800 gateway tokens.
- Dice: https://arc-bench.com/runs/d3b6850824fb — **1/1**, 61 seconds, 47,752 gateway tokens.
- Combined cost displayed by the platform: CNY 0.0986, down from CNY 0.1611. Still behind
  the observed leading cost of CNY 0.044692. The elapsed time increased.
- Actual Counter response usage confirms zero reasoning tokens. However it spent five
  calls on listing files, splitting file writes, an unnecessary edit, and completion.
  It also chose a frontend dependency/build stack for a tiny interaction.
- Next experiment: a single forced bundle-delivery tool for a small empty project,
  followed by automatic real verification. If that fails, use the normal repair tool loop.
  Prefer built-in runtime libraries for small feature sets. This changes orchestration,
  not the task solution; all application code still comes from the model and requirements.

## E004 — Complete file delivery

- Source: `9cfb086`, submission `volo-factory-v0.4.0-9cfb086`.
- Archive SHA-256: `6bf7963dcf86cae3ac1471cffe71307269fef0681cf06159fee4f3d2458276b2`.
- Counter: https://arc-bench.com/runs/0956c2bdeb3f — **1/1**, 16 seconds, 7,173 gateway tokens,
  approximately CNY 0.0375. The platform's code/log export was incomplete when inspected,
  so this record does not assert an exact model-call count.
- The Counter cost alone approached the observed leader's two-task total. The second
  task was not run for this revision; the next experiment addresses duplicated runtime code.
- Next: supply task-independent build, HTTP serving and browser-check lifecycle code.
  The model still generates all product-specific HTML, JavaScript, optional API logic and assertions.
  This removes repeated infrastructure generation without embedding a task solution.

## E005 — Task-independent web runtime

- Source: `51bcf4b`, submission `volo-factory-v0.5.0-51bcf4b`.
- Counter: https://arc-bench.com/runs/8ca47cd69670 — **1/1**, 46 seconds, 39,165 gateway tokens,
  approximately CNY 0.0334.
- The actual first response used only 1,658 reported tokens (1,152 input, 506 output,
  zero reasoning), and generated the product UI and browser assertions correctly.
- A harness bug caused the extra work: the optional `api_js` was an empty string, which
  overwrote the default no-op handler. The server then raised `TypeError: api is not a function`.
  The repair loop fixed it, so official tests passed, but the extra calls and readiness
  wait consumed time and tokens.
- Version 0.5.1 treats empty optional API code as absent and makes invalid handler exports
  fail immediately. A regression fixture was captured from this real tool call and tested
  against an actual local HTTP server.
- The Dice task was deferred until this concrete harness defect was fixed.

## E006 — Empty API fix, then inspect remaining repair cost

- Source: `b362e41`, submission `volo-factory-v0.5.1-b362e41`.
- Initial Counter run `c26fa8c2c79e` failed before the model started because its platform
  run copy could not find `agent.zip`. A new run of the same submission succeeded.
- Counter: https://arc-bench.com/runs/2b15f59f6120 — **1/1**, 27 seconds.
- Dice: https://arc-bench.com/runs/f781aa13b23a — **1/1**, 31 seconds.
- Combined cost CNY 0.095639, average runtime 29 seconds, still second at observation.
- The actual Counter trace showed a product-code consistency error: JavaScript looked
  up an element by id, but the generated HTML had only the matching data-testid. Real
  browser checks caught this. The full repair loop then wasted calls rediscovering files
  already present in the conversation before fixing the markup and assertions.
- Next: generate a self-contained HTML/JavaScript document for small pages, use temperature
  zero for the small-task path, expose JavaScript startup errors clearly, and keep up to
  three repair attempts in the compact bundle protocol before falling back to general tools.

## E007 — First place on the public Smoke leaderboard

- Source: `0abcf10`, version 0.6.0.
- Effective submission: `volo-factory-v0.6.0-0abcf10-r2`.
- Archive SHA-256: `f8683f93a2bf5668bda76a295e4e684790b24b6a5f601c451ef4311043f6ab27`.
- The first saved record returned HTTP 409 on run creation and HTTP 404 on archive
  download. Re-uploaded identical bytes under a new filename. The new archive endpoint
  returned HTTP 200, and its downloaded SHA-256 exactly matched the local upload.
- Counter: https://arc-bench.com/runs/7fa25acde8dd — **1/1 official tests**, 5 seconds.
- Dice: https://arc-bench.com/runs/d8dcc590abac — **1/1 official tests**, 5 seconds.
- Official leaderboard at **2026-09-11 06:13:08 UTC**:
  - rank **1**, team **VOLO AI**;
  - average pass rate **100%**;
  - combined metered model cost **CNY 0.016023**;
  - efficiency **6241.0285 pass-rate points/CNY**;
  - average runtime **5 seconds**;
  - token field **0.003M** (rounded by the leaderboard API).
- Also confirmed the first-place row visually through Chrome's page content.
- Source snapshot: [final leaderboard JSON](evidence/2026-09-11-smoke-leaderboard-final.json).
- This cost is the selected successful submission's two-task cost, not the sum of all
  development experiments. Earlier failures and their costs remain recorded above.
- This result validates the small-task path. It does **not** establish performance on
  the upcoming GitHub/Spreadsheets preliminary or enterprise final.

## E008 — First place on Smoke Evolution with the unchanged baseline

- Source: `0abcf10`, version 0.6.0, submission `volo-factory-evolution-v0.6.0-0abcf10`.
- Archive SHA-256: `f8683f93a2bf5668bda76a295e4e684790b24b6a5f601c451ef4311043f6ab27`.
- Counter: https://arc-bench.com/runs/874eca048ca3 — **2/2 official tests**, 18 seconds.
- Dice: https://arc-bench.com/runs/dfd21779b423 — **2/2 official tests**, 12 seconds.
- Platform selected the existing matching Smoke apps. The downloaded Counter artifact
  and its first request confirm the supplied project was VOLO v0.6's generated app.
- Official leaderboard at **2026-09-11 06:38:45 UTC**: **rank 1**, VOLO AI, 100% average
  pass rate, CNY 0.056842 combined selected-run cost, 15 seconds average runtime,
  efficiency 1759.2625, displayed tokens 0.052M.
- [Leaderboard snapshot](evidence/2026-09-11-evolution-leaderboard.json).
  This demonstrates two small incremental changes, not general enterprise evolution.

## E009 — Ticket Booking blocked before run creation

- Baseline source and archive are identical to E008. Submission `32d6d2fe7737` downloaded
  successfully with an exact SHA-256 match but `POST /api/runs` returned HTTP 409 saying
  the submitted agent archive was unavailable.
- A separate source-identical packaging control `b1b0dc34ca64` saved successfully but
  its archive download returned 404. No model run or official score was produced.
- [Reproduction details for the organizer](ticket-booking-platform-report.md).
  The server-side root cause is unknown; failed starts are not coding-quality failures.

## E010 — Local context and corpus compatibility candidate

- Source: `b0e46b9`, version 0.7.0.dev1.
- Candidate archive SHA-256: `835e2d7cf7fe84168fa8888480c1d6df8b8735d49e24edfc9043ecae14335475`.
- Version 0.7.0.dev1 introduces deterministic context projection and separates failed
  verification evidence from accepted verification. Raw events remain intact, retained
  reasoning/tool fields remain exact, and context cuts never split a tool exchange.
- A local synthetic gateway drives a real Node application: the first behavioral check
  fails, a deliberately oversized history triggers a workspace checkpoint, and the
  second tool response repairs the failure. Actual check outcomes are `[false, true]`.
- All **26 local checks passed**. Real gateway response captures additionally validate
  provider-field preservation; replay does not establish current gateway acceptance.
- Inspected all supplied requirement YAMLs against pinned byte hashes. Initially Ctrip
  and Stack Overflow were rejected due to ancestor references expanded into self-cycles.
  After the fix, **22/22 documents schedule**, representing 20 unique requirement sets.
- [Scheduling evidence](evidence/2026-09-11-corpus-scheduling.json) and [scope](corpus.md).
- At this stage no official gateway run, score improvement or token/cost benefit was
  claimed for this candidate. E011 records its subsequent real platform run.
- Before publishing this development work, refreshed both public leaderboard APIs:
  VOLO AI remained rank 1 in [Smoke](evidence/2026-09-11-smoke-leaderboard-latest.json)
  and [Smoke Evolution](evidence/2026-09-11-smoke-evolution-leaderboard-latest.json).

## E011 — Real CLI integration and a model response timeout

- User requested a CLI to replace repeated browser operations. Implemented `./arcbench`
  using the deployed official frontend's API contract. Normal operations now use HTTP
  with an origin-scoped cookie jar, including the route-affinity cookie.
- Rechecking the older submission returned the server's latest-submission-only rule.
  Fresh upload `c522484096e0` saved and passed download/SHA-256 verification. Agent
  source remains `b0e46b9` / 0.7.0.dev1 with the E010 archive hash.
- CLI created and started https://arc-bench.com/runs/0726df707e05, observed QUEUED and
  RUNNING, waited until FAILED, read the actual logs and downloaded the artifact.
  This verifies the CLI upload/run/status/wait/log/download integration independently
  of whether the generated application succeeds.
- The first model request used `deepseek-v4-flash`, thinking enabled, non-streaming,
  max_tokens 8192. The trace reported `The read operation timed out` after 180.355
  seconds. No completed response or tool action followed; official tests were not reached.
- Platform recorded 180 seconds and 0 tokens / CNY 0. The transport result is uncertain;
  the client cannot infer that the upstream provider consumed no computation.
- Artifact SHA-256: `900deacb759d11c3027589e9bb6c76486ece8e3a049850b9664e5c7b40480022`;
  retained privately under ignored `runs/e011-ticket-cli/` with the extracted trace.
- Current upload/start availability is confirmed. The earlier archive error and the
  present model timeout must not be conflated. [Historical report](ticket-booking-platform-report.md).
- Ran the full 36-check suite, then 11 CLI checks after adding the final log-redaction
  case. Multipart encoding, cookies, archive hashes, recovery boundaries, queued-state
  waiting and actual status-field/currency mapping are covered.

## E012 — Test a longer bounded model response wait

- Source: `cde6cd4`, version 0.7.0.dev2. The only agent change from E011 is a default
  individual response timeout of 600 seconds instead of 180, plus timeout trace metadata.
  The overall 1,200-second execution deadline is unchanged. No uncertain request is retried.
- Candidate archive SHA-256: `b666919d78db490c7007e04c7e7e31cb828e99d564b9e4c4c2208700b6d4106f`.
- CLI saved submission `ce35147771f5`, verified the downloaded hash, and created/started
  https://arc-bench.com/runs/2ee804a2030f. Generation started at 08:22:02 UTC.
- A live artifact downloaded during generation showed the first response arriving
  after **499.666 seconds**, with 4,659 prompt tokens and 66,227 completion tokens,
  including **58,034 reasoning tokens**. Its finish reason was `length`; the incomplete
  tool call was rejected without writing files, and the agent requested a smaller call.
- The submitted `max_tokens: 8192` did not bound reported completion tokens in this
  response. Do not infer a hard cost limit from it. The retained metadata fixture is
  `tests/fixtures/real-deepseek-truncated-metadata.json`; reasoning and product code are
  deliberately omitted from that fixture.
- Extending the wait recovered an actual response, exposing excessive reasoning and
  output truncation. It did not establish application correctness.
- All 37 local checks passed after the timeout change. A passing local transport check
  does not establish provider latency or generation quality.
- The complete trace shows four requests totaling **190,383 reported tokens**. The
  second response wrote configuration and DESIGN.md; the third and fourth supplied
  malformed `write_files` arguments (`path` at the top level and a file missing its path).
  Both were rejected. At **808.488 seconds** the agent failed its observed token-budget
  guard, before behavioral checks or official evaluation. The budget is checked between
  responses, so the last response can exceed the remaining amount.
- A cancellation request during status inspection returned HTTP 500 while subsequent
  status showed CANCELLED. The retrieved runner log independently records the budget
  failure, process exit and container removal. Do not treat CANCELLED/null metering as
  evidence that no model work or charges occurred. The run API did not expose final cost.
- The user subsequently supplied the logged-in [metering dashboard](https://meter.arc-bench.com/user).
  At 08:43 UTC its four request timestamps matched this trace and showed CNY 0.598142,
  0.286664, 0.128567 and 0.046444, totaling **CNY 1.059817**. This recovers actual billing
  from the meter without interpreting a null run-API cost as zero.
- Complete artifact SHA-256:
  `26203ce7e9febeaecc5918e1ca8a4b6a19c549a7f0a421ffefab86d3bf659333`.

## E013 — Low-effort candidate blocked during deployment

- Source: `2793296`, version 0.7.0.dev3. Thinking-enabled DeepSeek requests now explicitly
  request `reasoning_effort: low`, and the general coding prompt asks for smaller file
  batches. Small-task thinking-disabled behavior is unchanged.
- [DeepSeek's current official contract](https://api-docs.deepseek.com/guides/thinking_mode/)
  documents high as the default effort and low as a supported V4 setting. Read on
  2026-09-11; acceptance by the organizer gateway remains to be verified.
- Candidate SHA-256: `82413746aba52bb0802dddb07ed18f19672e6a73209f2b8772882d7c1081297b`.
  Submission `ac411627b87f` passed download/hash verification when saved and again after
  both failed runs. The source upload is still available.
- https://arc-bench.com/runs/fcc9a2ee4c3e and a single same-submission retry
  https://arc-bench.com/runs/3ddae12e17ac both failed in `deploy_agent`, with missing
  `/mnt/arcbench/bucket-15/users/<account>/runs/<run-id>/agent.zip`.
  Neither started the model or official tests. No further identical runs were attempted.
- This is an executor deployment-path observation, distinct from E009's create-409
  and E011/E012's model execution problems. [Current report](ticket-booking-platform-report.md).
- Refreshed all three public leaderboards after these attempts: VOLO AI remains first
  on Smoke and Smoke Evolution, and third with no passing result on Ticket Booking.
- The final development tree passed all **39 local checks** in 16.193 seconds, including
  the real-response metadata and cancel-500/state-change regression. Local passing
  checks do not replace the blocked model-backed evaluation.

## E014 — Same-agent GLM-5.3 comparison

- The user confirmed available budget and requested trying another model. Keep the
  agent source and task fixed at E013's `2793296` / 0.7.0.dev3; select `glm-5.3` through
  the organizer gateway. DeepSeek-specific thinking parameters are not sent to GLM.
- Submission `a6faad3043c4` passed upload/download hash verification, with the same
  SHA-256 `82413746aba52bb0802dddb07ed18f19672e6a73209f2b8772882d7c1081297b`.
- Run: https://arc-bench.com/runs/ba22ff04e471. Deployment succeeded. The first model
  request received **HTTP 502 Bad Gateway** from an `openresty` page after **371.452
  seconds**. No assistant response or tool call was produced, and official tests did
  not start. This does not evaluate GLM's application quality.
- The run API reports 372 seconds, zero tokens and CNY zero. The meter balance was
  unchanged and reported no pending billing events at the subsequent check.
- Artifact SHA-256: `2f701da2557f890463d925c1c7e76c8a00cf29df4911dae5d41bbee1833db922`.
- Added and live-verified `./arcbench balance`, reusing the authorized meter login in
  a separate private origin-scoped session. No balance cookie or model key is committed.
