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

## E015 — Kimi K3 reaches evaluation and exposes the runtime contract

- Same dev3 source `2793296`, model `kimi-k3`, submission `4acd5cdecf7f`.
- https://arc-bench.com/runs/b30f19283f5a — generation completes, **0/10 official
  tests**, 603 seconds, CNY 4.231912, 192,558 official tokens.
- Seven actual responses report 141,422 tokens. The first two responses consume the
  8,192-token output limit but claim `tool_calls` despite truncated argument strings;
  JSON parsing rejects them. Later calls write the app and pass seven HTTP checks.
- A browser check was written but omitted from the final command. It subsequently
  fails in a local real-browser replay because two elements display the same username.
- The runner starts the backend at 3000; the current public test helper defaults to
  3301. All official tests receive `ERR_CONNECTION_REFUSED`. Input prerequisites are
  empty and the supplied text does not specify this extra port.
- Complete artifact SHA-256:
  `4d446ce044aafacbe71fe999f0d94c42cefc9e5beb6f8c3b78efb1dd158269dc8`.

## E016 — Reproduce before changing the harness

- Replay the original E015 app in a disposable restricted Docker container, with
  fresh-profile host Chrome and Playwright 1.57.0. Public test sources stay unchanged.
- On the working primary port, initial result is **0/10**, with duplicate registration
  navigation links. The authored browser script also fails on duplicate username text.
- Two diagnostic edits to this disposable app copy remove duplicate introductory
  links/identity text. Result becomes **5/10**; remaining failures include an omitted
  reference heading and a concatenated bilingual password label.
- Implement generic fixes in `e953f4c` / `fc3a4f3`, version dev4: managed single-service
  launcher on both observed ports, mandatory execution of recognized authored browser
  checks, 16,384 coding output cap, clearer malformed-JSON recovery and exact-name UI
  guidance. Three real Node launcher tests check shared state, cleanup, port conflict
  failure and symlink boundaries. All **44 local checks pass** in 19.763 seconds.
- Diagnostic app edits and official test sources are not packaged or committed.

## E017 — DeepSeek dev4 completes with one call; official score is 2/10

- Source `fc3a4f3`, submission `a88b673b4cf3`, model `deepseek-v4-flash`.
- Archive SHA-256: `6eecc8814c9f1e802f0230b2c04ad9d65f9817baedb89a4328491be0f3f5f45e`.
  Saved archive download matches exactly. The user-supplied standalone CLI performs
  submit/create/start successfully; the thin CLI verifies the archive and retrieves evidence.
- https://arc-bench.com/runs/df4bf94d459e — **2/10 official tests**, 174 seconds,
  CNY 0.481799, 2,161,039 official tokens. One actual model response reports 31,022
  tokens (4,782 prompt; 26,240 completion, including 14,742 reasoning), in 149.526
  seconds. The large official/response discrepancy has no established cause; preserve
  both counts and do not ascribe other shared-account activity to this agent.
- Generated React/Vite and Express app passes nine authored HTTP tests and its
  real browser flow. The harness additionally runs the recognized standalone browser
  script. Official tests reach the application, confirming the port fix.
- Original app replay of the **unchanged public tests**: **5/10 on port 3000 and
  5/10 on port 3301**, with identical failures. Username text is merged into a greeting;
  the reference heading is absent, and the strength widget has presentation-only semantics.
  Official results also include earlier field-interaction timeouts and one target crash;
  their exact environment cause is not inferred from the local result.
- Three diagnostic changes in the disposable app copy isolate the username, restore
  the reference heading and add a named meter/value. Local public suite becomes
  **10/10 in 7.192 seconds**. This establishes those concrete app gaps; it is not a
  new official score or a model-generated result. No diagnostic app is uploaded.
- Full artifact SHA-256:
  `15d68381c60ed0a85f04990c9cbd572ce8ca61cab860484c7a896ba465e06336`.

## E018 — Verify actual multimodal input, then prepare dev5

- Send one supplied reference image to `kimi-k3` through the organizer gateway,
  using the same authorized key. The model accurately reads its heading and color.
  Actual response: 32.111 seconds, 1,807 prompt + 192 completion = 1,999 tokens.
  This is a separate development probe, not a submitted benchmark run.
- Preserve a redacted real response fixture. Version dev5 observes images linked by
  active requirements and ancestor descriptions, groups at most three per request,
  and shares generation's usage/budget and trace. Successful observations cache by
  exact image bytes, prompt and model. Text requirements override conflicting visuals.
- Strengthen generic instructions for exact dynamic text, semantic status controls,
  reference headings and requirement-derived browser assertions. No task solutions,
  official test code or manual diagnostic app patches enter the archive.
- All **48 local checks pass** in 19.616 seconds, including cache invalidation, input
  boundary handling and captured multimodal-response accounting. Full dev5 platform
  evaluation is the next gate; no improved official result is claimed here.

## E019 — Dev5 exposes the gateway's request-size boundary

- Source `2dc48cc`, submission `e22044e619ac`. Saved archive download exactly matches
  SHA-256 `858e6abdb133cdea555ad1ade39741d775bef3c53592f01d24f07c7564ad604b`.
- Waited for the pre-existing shared-account run to finish, as the user requested.
  https://arc-bench.com/runs/dd19e1660e38 then failed at deployment with a missing
  run-local `agent.zip`. No model request occurred.
- One same-submission retry, https://arc-bench.com/runs/6bdd4e55d7cb, deploys and starts
  the agent. The first image request receives **HTTP 413 Request Entity Too Large**.
  The runner records one second, zero tokens and CNY zero. No app is generated.
- Actual referenced PNG sizes are 3,622,330 (homepage), 146,387 (registration) and
  4,009,963 bytes (login), before base64 expansion. The earlier single-image probe
  used only the small registration screenshot and therefore did not exercise this limit.
- This is a payload-size failure after a successful deployment, distinct from the
  first attempt's intermittent archive failure. The model itself has not evaluated
  the rejected image request.
- Dev6 uses Pillow 11.3.0 locally: preserve small images exactly, resize larger rasters
  to a 1920-pixel maximum edge, encode bounded JPEGs, and split batches by actual
  encoded bytes as well as image count. The real three-image input becomes **526,945
  bytes** before base64; the text-heavy registration image stays byte-identical.
- All **52 local checks pass** in 22.317 seconds, including a high-resolution raster
  case and an encoded-size case that must split despite containing only three images.
  Gateway acceptance of the normalized group remains the next live check.

## E020 — Full image flow works; implementation still omits a reference detail

- Source `c76f1dd`, dev6, submission `99754b183641`, matching saved ZIP hash
  `52a40dbb268ae233a520af5be4e3f34390345b0a931e9d64381dbf60473b479b`.
- https://arc-bench.com/runs/15daf231bb0e — **5/10 official tests**, 361 seconds,
  CNY 1.337888 and 4,589,434 official tokens. Another account run overlapped; actual
  trace usage is separately retained and no isolated-cost claim is made.
- Kimi K3 accepts the normalized three-image request and returns accurate observations,
  including the registration heading: **121.207 seconds, 8,398 reported tokens**.
  DeepSeek generates the app in 225.955 seconds / 48,584 tokens, then makes three small
  read/edit/finish calls. Combined five-response usage is **92,071 tokens**.
- The first real self-check catches duplicate login links. The agent edits the app,
  reruns, and passes 14 authored HTTP/browser checks. It still uses a generic registration
  title and a progressbar for password strength, despite receiving the observed heading.
- The original app reconstructed from exact logged writes plus the final source file
  passes **9/10 local public tests**, with no page crash. Official failures also include
  two page crashes and timeouts. Their exact infrastructure cause remains unconfirmed.
- Version dev7 adds an independent browser-check planning call before implementation
  for larger browser tasks. It receives only requirements and observations; fixed checks
  run on every verification, cannot be silently altered, and invalidate previous acceptance
  when added. The implementation still writes its own supplemental checks.
- All **56 local checks pass** in 25.725 seconds, including a real HTTP case where a
  newly added fixed check invalidates a previous pass, forces an app repair, and rejects
  a later attempt to replace the check with an unconditional exit.
- Added a live-verified CLI `source` command for reading individual run files, avoiding
  full ZIP downloads for small diagnostics. This CLI change is outside the agent upload.

## E021 — Independent planning exposes a context-cost regression

- Source `084bc76`, dev7 ZIP SHA-256
  `786c9cc7a78fc4aa00d5e37dc6b133ab40fbee99425207b3b8a9ee145b9d8a8e`.
  Run `cbe2fc6a6286` fails before generation because run-local `agent.zip` is missing.
  Another account submission becomes latest before the retry; re-saving the identical
  ZIP as `e302cde50c01` passes the download/hash check.
- https://arc-bench.com/runs/8ca2006ca78d deploys successfully, then stops at the
  **150,000 reported-token budget before verification**. Official results: 211 seconds,
  537,677 tokens, CNY 1.240562, no tests reached. Another account run overlaps.
- Actual seven-response usage is **154,583 tokens**: 121,475 prompt and 33,108 completion,
  including 78,144 cached prompt tokens. Image observation takes 47.658 seconds;
  the 11-test planning response takes 25.616 seconds and 10,969 tokens.
- The first coding response has malformed JSON despite `finish_reason=tool_calls`.
  The agent recovers with four smaller write calls and creates the application/check
  files, but stops just before a verification call. Requests grow from 39,821 to
  122,281 serialized message characters, below the old 160,000-character projection
  threshold, so the failed response remains in every subsequent request.
- The fixed script also omits a reference heading and uses invalid short document
  numbers in some negative examples. Its independent origin does not make its content
  an accuracy oracle; neither app acceptance nor a functional score is claimed.
- Offline replay of the exact logged application writes: the unchanged public suite
  fails all 10 tests at duplicate registration links. The original fixed script passes
  8/11 and rejects duplicate registration/login navigation and the logout flow in
  11.129 seconds. It would have blocked acceptance had execution reached verification.
  The short-document negative examples do not fail in this replay because the generated
  backend reports multiple validation errors; no such false-failure claim is made.
- Dev8 projects above 60,000 characters, supplies only fixed-check coverage by default,
  and exposes the exact fixed script through a read-only tool when needed. Planner
  guidance asks for shared valid-data helpers, isolated negative changes, reference
  headings/status checks, and compact scripts. Supplemental checks focus on uncovered
  server behavior. All **56 local checks pass** in 25.937 seconds.

## E022 — Dev8 Ticket run and incremental-edit preparation

- Source `5937ea8`, submission `3386eacdc9cb`, ZIP SHA-256
  `6d3f9a83605dc2aea70c49552d21c4ab039b2b53ef5e0b64cbce910b964c456d`.
  https://arc-bench.com/runs/02be3333a76c deploys successfully and reaches verification,
  but the fixed script references `t` outside its defining function. Nine checks fail;
  the agent cannot change fixed checks and exhausts the budget while investigating.
  Official result: no tests reached, 311 seconds, 2,492,519 tokens, CNY 1.340060.
  Actual trace totals 157,487 tokens across 11 responses. Cancellation arrives after
  failure and returns 409; it does not cancel another run or create an uncertain state.
- Replaying the exact initial app against unchanged public tests fails all 10 at its
  unlabeled phone input. It does preserve the reference heading and meter semantics.
  This app defect is separate from the acceptance script's undefined variable.
- Concurrent local preparation addresses the refreshed Smoke Evolution cost gap.
  E008 Counter needed five calls: a source read, three separate edits and finish.
  Dev9 includes up to 20 product-code files / 24,000 bytes for small existing projects,
  supplies concise incremental instructions and asks for edits plus finish in one response.
  Data files, credentials and protected harness files are excluded from that snapshot.
- All **57 local checks pass** in 26.668 seconds. A real HTTP test edits and verifies an
  existing app with one captured model response, preserves unrelated code, excludes state
  and secrets, and falls back for oversized source. This validates orchestration only;
  reduced model cost and restored Evolution rank require a new official result.

## E023 — Compact prompt alone does not reduce incremental calls

- Source `7d985d5`, dev9, submission `48a6556d903e`, matching ZIP SHA-256
  `d8dbabf52979a379c970959d9d692b23cb79338940e124163d654de3be4aae3a`.
- First Counter start `9914e105f0e9` fails at deployment with missing `agent.zip`.
  Retrying create loses its HTTP response; listing runs reveals pending `f30f29fdfd38`,
  which is started once without creating a duplicate.
- https://arc-bench.com/runs/f30f29fdfd38 **passes 2/2**, 17 seconds, 21,686 tokens,
  CNY 0.032382. Actual response usage matches the official total in this run.
  The source snapshot and compact prompt are present, but the model still rereads
  supplied files and performs three separate edits plus finish: five calls again.
  The old lower-cost Counter result remains selected; Evolution stays second.
- Dev10 adds static scope checking for generated acceptance scripts, using bundled
  Acorn 8.18.0 and ESLint Scope 9.1.2. The exact E022 script is rejected at line 7;
  a diagnostic variable-scope repair passes static analysis. A minimized real fixture
  proves the planner receives the error and regenerates before a check is installed.
  All **58 local checks pass** in 27.151 seconds. This does not prove test semantics.

## E024 — Pro with static acceptance analysis; verified edit batches prepared

- The organizer's live model catalog confirms `deepseek-v4-pro` is available.
  Source `41bcdec`, dev10, submission `ba7d446bdbf4`, ZIP SHA-256
  `c243c22c74f8781e73b79f95bed1e4d54411ed697febcd5b5bc74cc790b4cd62`.
  The first saved-archive download is incomplete. A second read matches all 78,494
  bytes and the exact hash; no duplicate submission is created.
- https://arc-bench.com/runs/6d2bdfec5d0f deploys and starts with DeepSeek V4 Pro.
  The plan includes the reference heading and meter, but reuses one module-global
  username across independent registration tests, conflicting with uniqueness rules.
  The run is cancelled while the first coding request is pending. Cancel returns HTTP
  500, then read-back confirms CANCELLED; no second cancellation is sent. Two completed
  responses report 17,142 tokens; cancelled in-flight usage is unknown and official cost
  remains null. No application or official score is claimed from this run.
- Dev11 separately replaces prompt-only incremental batching with a forced
  `patch_and_verify` tool. It validates all exact edits before writing and runs the
  existing app's build/start/check lifecycle. Three unsuccessful compact attempts
  can fall back to regular tools; failed verification includes current product source.
- All **58 local checks pass** in 25.504 seconds, including real one-call HTTP changes,
  forced tool selection and all-or-nothing validation before editing. An unrelated
  ephemeral-port collision in the launcher test was removed by binding its reserved
  conflict socket before choosing and installing the test ports; launcher code is unchanged.

## E025 — One-call incremental edits work; narrow the independent contract

- Dev11, submission `0b88bc4db291`, matching ZIP SHA-256
  `8eb5b112f9ea53d6d1144107b43f9e0d01f7a01652e91273edbe3c2277f47184`.
- Counter https://arc-bench.com/runs/82dda8779d5a passes **2/2**, seven seconds,
  3,874 tokens, CNY 0.017184. One real `patch_and_verify` response reports 2,947 prompt
  and 927 completion tokens; all old and new checks pass. The supplied template matches
  this project's earlier v0.6 runtime byte-for-byte.
- Dice https://arc-bench.com/runs/343bcd73b739 passes **2/2**, five seconds,
  3,330 tokens, CNY 0.013248. The board selects both results: **CNY 0.030432**, six
  seconds average, rank 2. The leader remains CNY 0.018816 at 100%.
- Repeated failures invalidate the assumption that input-derived generated JavaScript
  can safely become an immutable acceptance oracle. Dev12 restricts the independent
  output to data-only UI structure: same-origin routes, visible headings, labels and
  roles. A deterministic harness script performs the checks without state-changing
  actions. Arbitrary generated scripts and the now-unused parser bundle are removed.
- All **58 local checks pass** in 25.132 seconds. A real Chrome probe rejects an input
  with only `aria-label` where a native label is required, then passes all six supported
  check kinds after adding the actual label. This checks the execution boundary, not
  model extraction quality. Stateful application tests and official evaluation remain
  separate requirements.
