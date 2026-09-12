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

## E026 — Data-only UI contract and further incremental cost reduction

- Source `ef32e17`, dev12, submission `d3ecf23b5d36`, matching ZIP SHA-256
  `8cb99941caadb1f93689d8e878afc0da6bd8a47308457ed9e1739757845a6909`.
  https://arc-bench.com/runs/d07b379f9662 starts with DeepSeek V4 Pro. Its generated
  UI data treats translated navigation labels as separate required controls and treats
  agreement phrases as exact checkbox names. Those are training-interpretation errors.
- The coding model repeatedly calls `read_acceptance`: its three responses spend
  66,938 reasoning tokens and return only 90 non-reasoning tokens. Each long assistant
  exchange exceeds the context limit, so projection drops the entire completed read.
  The checkpoint contains failures but not the successful result; the next call repeats
  the same read. Five completed responses total 105,592 tokens, plus uncertain in-flight
  usage. No application files are written. Cancel returns 500, then status confirms
  CANCELLED; no repeated cancellation is sent and official cost remains null.
- Dev13 removes unchanged runtime boilerplate from small incremental requests only
  after exact-byte comparison with this agent's static server, build and browser helper.
  Any custom edit remains in context. Full requirement data is retained using compact
  JSON; the prompt asks for short unique edit anchors and reuse of existing assertions.
- All **59 local checks pass** in 25.887 seconds. The added check proves that changing
  a known runtime file makes its full source visible again and that requirement data is
  unchanged. Actual incremental token cost is the next gate.

## Dev14 preparation — Preserve successful reads and correct training metadata

- Dev14 retains a bounded last-tool result in workspace checkpoints, including successful
  reads whose full reasoning/tool exchange cannot fit. A real HTTP repair test exercises
  an oversized synthetic reasoning exchange and proves the read content remains in the
  next request while the original oversized exchange is omitted intact.
- UI contracts are training metadata, not immutable external tests. `revise_ui_contract`
  accepts validated data and a specific requirement-based reason, preserves the previous
  pages/hash, and invalidates prior verification. It cannot change evaluator files or
  introduce executable test code. This follows the organizer's [training versus validation
  distinction](https://github.com/code-philia/agentic-software-engineering-hackathon/tree/main/Lab/Lab01).
- Batches with at most three features and 16,000 requirement characters use non-thinking
  DeepSeek calls; compact scaffold/edit routing still requires 3,500 characters. The real
  gateway result, rather than this heuristic, must establish quality and cost.
- All **62 local checks pass** in 27.639 seconds, including verified full-tool delivery
  under the bounded-batch policy, read retention, contract correction/history/cache
  invalidation, and all earlier protocol/runtime checks.

## E027 — Less input, but replacement output still varies

- Source `93b68dd`, dev13, submission `55d9bdbc12a0`, matching ZIP SHA-256
  `9ea80fca20fa164069fed9ce14f75310a4ae42272285240c649b2c52a590b20d`.
- Counter https://arc-bench.com/runs/b0728ec24122 passes **2/2**, five seconds,
  2,369 tokens, CNY 0.010731. Dice https://arc-bench.com/runs/5ea2fa99d86c passes
  **2/2**, eight seconds, 2,922 tokens, CNY 0.016560. Both use one model call.
- The board selects this complete submission at **CNY 0.027291**, rank 2. It does not
  combine this Counter with the lower-cost Dice from dev11. Repeated source input fell,
  but Dice replacement output grew; input reduction alone does not guarantee lower cost.

## E028 — Code generation progresses, but first verification still starts too late

- Source `ba8b56e`, dev14, submission `7d0e5f1f2434`, matching ZIP SHA-256
  `bf9962042a9758643796e265988791b5c5c4292da915284f968c88dde4e93ea1`.
- https://arc-bench.com/runs/1e3ae0daa6fe generates all application and authored test
  files, then rereads source until the 150,000-token cap. No tests are reached.
  Official result: 226 seconds, **153,149 tokens, CNY 1.286309**.
- Non-thinking Pro calls avoid the earlier reasoning loop. The main implementation
  response takes 83.534 seconds / 17,315 tokens, followed by two edits and a 35.464-second
  test-writing response. Tests exist at 217.58 seconds, but three further source reads
  consume the remaining budget before a finish call.
- Dev15 recognizes authored `node:test` files under `checks/` once frontend build and
  backend start manifests exist. Writing that bundle immediately executes verification;
  a passing current tree can complete the batch. The observed-token cap becomes 300,000
  to leave room for actual repair. All **63 local checks pass** in 29.387 seconds,
  including a real HTTP app accepted after one test-writing response and no extra model call.

## E029 — Qwen is available, but default thinking and command shape increase cost

- The authenticated platform price table reports Qwen3.6 Flash at CNY 1.2 input / 7.2
  output per million tokens, versus DeepSeek Flash at 3 / 9. Saved a dated price snapshot.
- Run https://arc-bench.com/runs/aa3708303f7f uses the unchanged dev14 ZIP with
  `qwen3.6-flash`, submission `811cf91a1dfb`. Counter passes **2/2**, 63 seconds,
  72,502 tokens and CNY 0.148940. No rank improvement is claimed.
- The first response includes 3,844 reasoning tokens and sends `check_command` as one
  string inside an array. Edits are already applied when command validation rejects it;
  retries then reuse stale old text. This explains the extra repair calls.
- Alibaba's [official thinking documentation](https://www.alibabacloud.com/help/en/model-studio/deep-thinking)
  confirms Qwen3.6 defaults to thinking and uses the top-level `enable_thinking` parameter
  in raw OpenAI-compatible JSON. Provider control and pre-write command validation need
  a fresh real run before the lower price can be treated as an efficiency advantage.

## E030 — Large source replies expose another context failure

- Source `d814120`, dev15, submission `9da01d82bcde`, matching ZIP SHA-256
  `7e5337b53ec0bed9e29ee4187a6d466e4d1a6cf53f2d0c2cc48a62154a0ea9bd`.
  https://arc-bench.com/runs/ae581e093699 starts with Pro, automatic authored-test
  execution and the larger repair budget. It fails before official tests: **262 seconds,
  611,799 official tokens, CNY 1.579687**. Actual 23-response usage is 300,496 tokens;
  preserve the discrepancy rather than claiming isolated accounting.
- The model selects the small-app builder outside its prepared mode, causing a missing
  manifest failure. Its subsequent complete delivery reaches UI checks, which fail.
  Nineteen source-read replies then repeat: each reply is 34,079 or 44,280 characters.
  Combined with the requirement/recovery prefix, the latest read cannot fit 60,000
  characters and is omitted. A bounded last-result summary cannot replace all that code.
- Dev16 maps Qwen3 thinking policy to `enable_thinking`, preserving all returned
  reasoning fields. Check commands now have an explicit argv schema and are validated
  before bundle writes. The observed one-string array is split using `shlex`, never a
  shell. Unsupported runners/operators are rejected before edits can become stale.
- All **64 local checks pass** in 29.427 seconds. Real HTTP verification accepts the
  captured command shape, an invalid command leaves source untouched, and synthetic
  transport checks confirm Qwen's outbound true/false field. Real Qwen effectiveness
  remains the next formal-run gate.

## E031 — Smoke Evolution returns to first; bound source reads for Ticket

- Source `418ba6f`, dev16, Qwen3.6 Flash submission `c57c371b9f3e`, matching ZIP
  SHA-256 `f5cb0753ca5092125b701ac1a75ab86ae6279362ee9af61086e233e872c944db`.
- First Counter run `0e6164e0c991` passes 2/2 in six seconds. Its one response uses
  2,563 tokens with `enable_thinking=false`; official metering reports 135,093 tokens
  and CNY 0.026841 while a separate shared-account Ticket run is active. This does not
  establish isolated cost. Waited for that other run to finish before rechecking.
- Counter https://arc-bench.com/runs/8c8a9e509ec6 passes **2/2**, eight seconds,
  2,976 tokens, CNY 0.011275. Dice https://arc-bench.com/runs/97e608e5381c passes
  **2/2**, six seconds, 2,226 tokens, CNY 0.006535. Both finish with one verified edit call.
- Live board: **rank 1, 100%, CNY 0.017810, seven seconds average**, ahead of
  CNY 0.018816. Saved the leaderboard snapshot and tagged `v0.7.0-dev16`; no further
  Evolution optimization is needed for the current milestone.
- Dev17 rejects oversized multi-file reads with a specific chunk-reading instruction.
  A new character-offset source tool returns at most 8,000 characters; 12,000 bytes is
  the aggregate full-read limit. Internal atomic edits and small snapshots still use
  complete source. Unprepared `build_app` is no longer advertised in full-tool mode.
- All **65 local checks pass** in 29.636 seconds, including Unicode chunk reconstruction,
  preserved full edits of files larger than the read limit, and correct tool availability.
- Offline replay of the exact E028 app also fails 10/10 at duplicate registration links.
  No copied application or diagnostic code was uploaded. This remains evidence that
  generation must reach real verification and repair, not a new official outcome.

## E032 — Bounded reads work, but Pro still does not reach verification

- Unchanged source `f596d8c`, dev17, submission `52879312973d`, ZIP SHA-256
  `ce790c03b047734b770fbcce179c892095361e051efd95e4c4d4a2c9882e9c84`.
  First run `3354c34bdb63` fails before startup with a missing run-local ZIP.
- Same-submission retry https://arc-bench.com/runs/0c1c1a49d881 deploys successfully,
  writes the application, and follows the new chunk tool after an oversized read is
  rejected. It still spends its remaining calls reading source before writing tests.
  No verification or official test runs. Result: **434 seconds, 788,931 official
  tokens, CNY 2.423078**; completed model responses total **302,864 tokens**.
- Requests use disabled thinking and reported reasoning tokens are zero. Two ordinary
  assistant content fields nevertheless contain over 34,000 characters of analysis
  before read calls, requiring context projection. Preserve those true outputs in the
  trace; do not treat provider controls as proof of effective generation behavior.
- A separate shared-account run is active after this run. The official/response usage
  discrepancy therefore does not establish isolated cost. The next comparison keeps
  the dev17 ZIP byte-identical and changes the main model to Qwen3.6 Flash.
- Replaying its exact logged application writes against the unchanged public suite
  fails 10/10 in 6.103 seconds: the first shared registration navigation matches two
  `/register` links. This confirms an application gap as well as the execution-loop
  failure. The diagnostic app is not repaired or uploaded; its container is removed.

## E033 — Qwen exposes a data-response contract mismatch

- The identical dev17 ZIP is uploaded as `a5a52c13a7e9` with Qwen3.6 Flash, with a
  matching archive hash. Waited for the observed other active run to finish before
  starting https://arc-bench.com/runs/684ec0e6a53f.
- Image observation succeeds in 44.1 seconds. Qwen twice returns a complete JSON UI
  contract in ordinary assistant content, first fenced and then bare, despite forced
  `define_ui_contract` selection and `enable_thinking=false`. The planner only accepts
  tool calls, so it rejects both before application generation. Official result:
  **50 seconds, 76,676 tokens, CNY 0.487596**. Actual responses total 22,648 tokens.
- Dev18 accepts a complete JSON object, optionally enclosed in one JSON fence, only
  in this literal metadata step. It requires exactly pages/coverage and runs the same
  UI-data validation. It rejects prose, executable/extra fields, extra objects and
  truncated responses. It never invents a tool call or executes response text.
- A new real-response fixture captures both observed Qwen outputs. Local regression
  verifies first-response acceptance, unchanged raw protocol fields and attachment
  of deterministic checks. The next formal run must still establish application quality.
- All **66 local checks pass** in 31.595 seconds. Dev18 ZIP SHA-256:
  `45d6b9f36ae637efca3fb0ef27d9c2e73db3c178eed094ea7389efe8ad7ffd8d`.

## E034 — Planning repaired; source retention and test discovery still delay execution

- Dev18 source `2191407`, submission `c062a2f26d7d`, verified ZIP SHA-256
  `45d6b9f36ae637efca3fb0ef27d9c2e73db3c178eed094ea7389efe8ad7ffd8d`.
  An uncertain upload disconnect is reconciled against the full submission list before
  a retry. https://arc-bench.com/runs/9a7b3c951a6e then deploys successfully.
- Qwen's first JSON plan is accepted at 55.541 seconds, including the reference heading
  and one registration-link language. It writes the application by 133.077 seconds and
  behavioral tests at 159.721 seconds. The discovered tests import `@playwright/test`,
  which the automatic discovery filter excludes, so verification never starts.
- The 60,000-character window begins dropping original implementation at 133 seconds;
  source rereads consume many later calls. Two narrow backend edits occur, but the run
  exhausts **313,454 actual response tokens** before its first check. Official result:
  **172 seconds, 1,331,064 tokens, CNY 1.188089**, no official tests. Accounting remains
  discrepant; do not claim the official count is the isolated sum of this trace.
- Dev19 discovers authored test entrypoints by filename without guessing their framework
  from source strings. `node --test` executes them; incompatible test-runner code produces
  an actual error for repair rather than being silently ignored. The default context
  window becomes 120,000 characters so this application's initial implementation and
  checks can coexist. Token/call/time budgets remain unchanged.
- All **66 local checks pass** in 30.866 seconds. The real HTTP bundle test now imports
  its framework through a helper and still completes immediately when written.
  Dev19 ZIP SHA-256: `fd69e93a7a6e052a2a2e5a7f5882d13f9c276b951a377be142e8f31d64a2382d`.
- Offline reconstruction of the exact E034 writes and two edits cannot start:
  `backend/server.cjs` imports `express`, but its manifest declares no dependencies.
  The unchanged public suite therefore sees connection refusal; this is a startup
  finding, not a measured functional score. No dependency or app fix is applied to
  this diagnostic copy, and its container is removed.

## E035 — Deployment recovers, but a Qwen request stops returning

- Dev19 source `7e42efd`, ZIP SHA-256
  `fd69e93a7a6e052a2a2e5a7f5882d13f9c276b951a377be142e8f31d64a2382d`.
  Submission `ee4916f55af4` downloads correctly before and after two missing-run-ZIP
  failures (`026c37ec93f1`, `ec1c4eae8595`). Re-saving identical bytes as `619f262a9a92`
  again verifies, and https://arc-bench.com/runs/4342487db5a5 deploys successfully.
- Reference observation and planning complete in 42.751 seconds. The agent performs
  several inspection calls and writes the two app manifests at 49.813 seconds.
  The next Qwen request, started at 20:39:09 UTC, has no complete response after more
  than its configured 600-second waiting window. Only 62,201 tokens from eight
  completed responses are known; pending-request usage is unknown.
- Cancelled this stalled run. The cancellation POST returns HTTP 500, then a fresh
  status confirms **CANCELLED**; no second cancellation is sent. Official duration,
  token count and cost are null, not zero. No application or tests complete.
- Keep the exact dev19 package for a Pro comparison. Test discovery and the larger
  context window are locally validated but have not yet reached a real verification
  step in this run; the gateway wait does not establish their application-quality effect.

## E036 — Remove the planner that introduces contradictory UI constraints

- Unchanged dev19 ZIP, Pro submission `8f63bff5375b`, verified hash as E035.
  https://arc-bench.com/runs/4cbb7715dd75 deploys and writes all seven application files
  in its first coding response at 134.046 seconds. Original implementation remains in
  the larger context. The next model request has not returned when the run is stopped.
- The written requirement specifies one required checkbox whose accessible name contains
  either of two agreement phrases. The intermediate UI planner instead requires two
  exact-name checkboxes. The generated application follows that mistaken plan.
- Offline execution of the exact generated app starts successfully, but the unchanged
  public suite fails 10/10 in 7.213 seconds because its agreement-checkbox interaction
  matches both controls. This is a concrete conflict between the original input and
  model-created constraints, not a deployment or dependency failure.
- Cancelled the run after identifying the incorrect constraint; a fresh status confirms
  CANCELLED after the POST returns HTTP 500. Known completed responses total **32,440
  tokens**; the in-flight request and null official cost are not treated as zero.
- Dev20 deletes the additional UI-planning model call, its tools, generated-check module
  and five component-specific tests. The real fixed-check execution invariant remains.
  The coding agent receives the original requirements and observed images directly,
  writes executable browser/state checks, and must pass build/start/behavior verification.
  No official tests or generated application are edited or included in the upload.
- Remaining **61 local checks pass** in 27.892 seconds. Dev20 ZIP SHA-256:
  `eebc913cb272ffa4940e2935e4ff51861315090758b1bb7ef6f3bd0172bceb07`.

## E037 — Real verification and repair return; semantic UI omissions remain

- Dev20 source `504a8c5`, Pro submission `8f9e01161e33`, verified ZIP as E036.
  https://arc-bench.com/runs/612cef92d824 completes generation and reaches evaluation.
  The test bundle is written at 165.962 seconds and immediately runs. Its initial
  14/16 result exposes navigation failures; the agent fixes the application and then
  corrects overly broad text queries. All 16 self-checks pass at 259.475 seconds.
- Official outcome: **3/10, 260 seconds, 11,433,898 tokens, CNY 4.996943**. Ten actual
  model responses total **208,558 tokens**. The accounting discrepancy is preserved;
  neither the response sum nor a quiet run list establishes isolated official billing.
- Exact generated source plus all successful logged edits replays the unchanged public
  suite locally at **5/10 in 34.711 seconds**. Five failures concern the missing semantic
  password-strength meter and alert semantics on visible validation feedback. Official
  execution has additional flow timeouts that do not reproduce in this local replay.
- A disposable diagnostic copy adds a named, dynamically valued meter and alert roles,
  without changing business logic. The unchanged suite then passes **10/10 in 5.437
  seconds**. This manually repaired copy is not uploaded; both replay containers are removed.
- The next bounded experiment asks an independent model to review only the original
  inputs and original application source, without evaluator code or failure logs. Check
  whether it can identify these omissions before adding another automated review phase.

## E038 — Independent review probes do not justify another review layer

- Read-only probes send the original E037 requirement/reference input and original
  application source to the organizer gateway. They receive no evaluator files, failure
  logs, diagnostic fixes or known-gap list. No competition run or app edit is created.
- Kimi K3 returns an incomplete review: 125.429 seconds, 21,048 tokens, finish `length`.
  Qwen3.7 Plus with disabled thinking also truncates its free-form review: 51.207
  seconds, 19,168 tokens, finish `length`. Neither is a completed review result.
- Qwen3.6 Flash with a forced findings tool returns in 11.219 seconds / 16,614 tokens.
  Its structured list includes multiple explicit "No discrepancy" entries, focuses on
  language-alias interpretation, and fails to identify the two reproduced semantic gaps.
  This experiment does not support promoting the reviewer to the completion pipeline.
- Dev21 keeps the single implementation/verification loop. Its instructions explicitly
  require native/ARIA meter semantics with a changing numeric value, visible alert
  regions for validation errors, and browser assertions for both. This is a generic
  semantic-UI contract, not copied evaluator code or a packaged task implementation.
- All **61 local checks pass** in 28.357 seconds. Dev21 ZIP SHA-256:
  `5d0f8e2d4de91c384fa5764353946822d29656fbc59e74e380b9b5b0c0272c27`.

## E039 — Kimi K3 needs effort control, not a binary thinking switch

- Dev21 source `e894c02`, Kimi submission `d19113f4a2bc`, verified ZIP as E038.
  https://arc-bench.com/runs/618ed6962a92 deploys; image observation succeeds at
  47.535 seconds. Its first generation response at 210.062 seconds consumes the entire
  16,384-token output cap as reasoning, with no content or tool calls, finish `length`.
- Later calls write four backend files and one validation edit, but no frontend or
  complete application is reached before cancellation. Five completed responses total
  74,650 tokens; the final pending request is unknown. Cancellation POST returns HTTP
  500, followed by confirmed CANCELLED. Null official metrics are not zero usage.
- Moonshot's [official K3 model usage](https://github.com/MoonshotAI/Kimi-K3#6-model-usage)
  states that K3 always reasons, defaults to maximum effort and accepts top-level
  `reasoning_effort` values low/high/max. The earlier assumption that its thinking could
  be disabled was incorrect. Dev22 sends `low` without binary-thinking or sampling
  overrides and preserves complete returned assistant fields.
- A local HTTP regression verifies both requested on/off intents map to the supported
  low-effort request and that the next request retains the exact preceding reasoning
  and tool fields. A real run must still establish whether this reduces wasted output.
- All **62 local checks pass** in 28.527 seconds. Dev22 ZIP SHA-256:
  `e1ee2c4ebedb1fff35ff7085d1e8cd39b4acb1290fe3ef844e07bc7b51bc4bff`.

## E040 — Kimi low effort reaches execution, but not a verified delivery

- Dev22 source `bd930b1`, Kimi submission `ef0a03d2b2ec`, verified ZIP as E039.
  https://arc-bench.com/runs/71e0a28920b4 sends `reasoning_effort: low` on the
  image and coding requests. Image observation completes at 36.291 seconds;
  the first coding response at 51.339 seconds contains a valid tool call.
- Generation recovers from reading a reference-image path as application source,
  writes the app and tests, then fixes a missing frontend build manifest. One
  delivery call lacks its required check command. Real verification finally runs
  at 464.677 seconds and finishes **11/28 self-checks passing** at 505.793 seconds.
- The generated server falls back to the homepage for the extensionless registration
  and login routes. Tests also omit required confirmation data in otherwise valid
  account fixtures and assert dynamic navigation in raw HTML. These are application
  and check-authoring defects, not evidence that the official evaluator ran.
- A final diagnostic response exhausts the observed token budget. Official result:
  **FAILED before evaluation, 514 seconds, 320,116 tokens, CNY 5.714784**. All 16
  captured response usages sum to exactly the official token count in this run.
  No official test is reported as executed; the dashboard's zero score is not 0/10.
- Do not increase Kimi's budget for another expensive retry. Compare the same dev22
  package with Pro, whose earlier E037 app reached all self-checks and whose two
  locally reproduced semantic gaps are now explicitly covered by the instructions.

## E041 — Boilerplate and repair consume the Pro budget

- Same dev22 source and exact ZIP as E040; Pro submission `1206d072c6bc`.
  https://arc-bench.com/runs/414be7cdfa56 completes in **289 seconds, 308,563 tokens,
  CNY 1.200237**, failing before official evaluation. Captured response usage equals
  the official token count. No official tests execute.
- Two initial backend bundles contain invalid JSON backslash escapes in JavaScript
  regular expressions. Both are rejected without writes; the model eventually recovers
  with smaller files. Frontend build then exposes a CommonJS/ES-module mismatch,
  which the agent repairs. These steps consume generation budget before UI verification.
- All 11 HTTP checks pass. Three browser checks fail on duplicate registration links,
  hidden error feedback and duplicate username text. An app edit follows, but the next
  budget guard stops execution before another verification. The original source also
  uses presentation-only strength markup despite explicit semantic instructions.
- Dev23 reuses the existing task-independent runtime for new apps with at most three
  features and 16,000 requirement characters. The model supplies only inline product
  UI, optional API logic and executable assertions through `build_app`; actual build,
  startup, checks and repair remain mandatory. Existing-project and small-task behavior
  stay on their prior paths. No application, evaluator or learned test data is packaged.
- The bounded builder receives concise routing, state, accessible-control and negative-case
  instructions. Invalid JSON remains rejected; no heuristic argument-repair parser is added.
- All **63 local checks pass** in 30.387 seconds, including a bounded new app that
  serves extensionless routes and real API state transitions through the unchanged runtime.
  Dev23 ZIP SHA-256: `20a0b78badd5666df5a60247113fdf025f47cf99b4a0b3f85d4ef6f0e3f9ccc6`.

## E042 — Bounded generation exposes a browser-helper routing omission

- Dev23 source `4c0d756`, Pro submission `c09ec62d46d2`, verified ZIP as E041.
  https://arc-bench.com/runs/5b816873c9e5 generates all product UI, API logic and
  eight browser checks in one `build_app` response at 118.251 seconds. Real build,
  startup and verification begin immediately. The page includes the observed heading
  and a named native strength meter, but full product correctness is not yet established.
- All checks fail at relative `page.goto('/...')` calls: the provided browser helper
  creates its page without a base URL. Two complete bundle retries repeat that same
  error. After three attempts the full tool path begins repairing helper/check files.
- Cancelled the run while further verification was pending. Cancellation POST returns
  HTTP 500, then fresh status confirms CANCELLED. Eight completed responses total
  **222,777 tokens**; official cost/duration remain null and no official tests execute.
- Dev24 sets `baseURL` to `FACTORY_BASE_URL` when creating the provided browser page.
  A regression uses installed Playwright and real Chrome against the managed HTTP
  application, navigating to `/details` and `/` and asserting the visible heading.
  All **64 local checks pass** in 34.895 seconds, including that real browser check.
- Dev24 ZIP SHA-256:
  `0185eb2530fdf24780daf5a8fea81c5d6aa146afd9294e8818296e27ab776208`.

## E043 — Whole-bundle retry leaves a reproduced UI failure unchanged

- Dev24 source `6191c42`, Pro submission `455526e9919d`, verified ZIP as E042.
  https://arc-bench.com/runs/1bd4bfc1fc1f generates UI, API logic and browser checks
  at 139.948 seconds. Relative navigation now works and the meter check passes.
- The phone input has no associated label. Several checks each wait 30 seconds for
  that control, exhausting the 180-second command limit. Earlier checks also find
  duplicate navigation and immediate assertions before asynchronous error feedback.
- The second full bundle arrives at 406.842 seconds. It leaves the phone input and
  UI unchanged while scoping two navigation assertions to `#nav`, hiding ambiguity.
  Cancelled this run before another repeated timeout; fresh status confirms CANCELLED
  after cancellation POST returns HTTP 500. Three complete responses report **56,768
  tokens**. Official cost/duration are null and no official tests execute.
- Dev25 opens ordinary source/edit/verify tools immediately after a real failed build
  for larger bounded apps. Invalid arguments still use the existing bounded retries;
  small-app and incremental behavior retain their established paths. Error feedback
  uses a bounded head/tail excerpt instead of retaining only the tail. The provided
  browser uses five-second control waits and fifteen-second navigation waits.
- All **65 local checks pass** in 37.819 seconds. A real HTTP failure/repair regression
  keeps original assertions unchanged and verifies both ends of a long failure log reach
  the next model request. Real Chrome verifies relative routing and missing-control timeout.
- Dev25 ZIP SHA-256:
  `1dcc084a58e0c84d37b0d9606b8a7e1b3c4a0cfa31b96ff6c170f799379bcc39`.
- The latest website bundle `index-zCY9AZyV.js` still requests the same leaderboard
  endpoint and parameters as the CLI. The repeated leaderboard HTTP 500 responses
  have no identified client-contract mismatch; current ranks cannot be asserted.

## E044 — Narrow repair works, but timeout-only feedback obscures the cause

- Dev25 source `aeec7d2`, Qwen3.8 Max submission `42a4dbfbbb48`, verified ZIP as E043.
  https://arc-bench.com/runs/3002683500de generates a complete bundle at 108.559 seconds.
  The first browser run finishes at 185.302 seconds with **1/8 passing**.
- The next request correctly receives full tools. It reads relevant source and makes
  two narrow navigation changes, then replaces nonexistent `assert.eventually` calls
  with a real polling helper. The next self-check still finishes **1/8 passing**.
- Both generated POST handlers await a Promise whose data callback never resolves it.
  Requests hang before validation. The source also incorrectly rejects spaces in names
  despite the provided successful examples. Later source reads and diagnostic test edits
  do not produce a verified repair before the budget guard stops execution.
- Official result: **FAILED before evaluation, 376 seconds, 1,919,823 tokens,
  CNY 2.462617**. The 14 complete captured responses total **332,845 tokens**.
  Preserve both totals; this discrepancy is not explained. No official tests execute.
- The image observation correctly reports the reference title `账户信息`, but generation
  replaces it with a different title. Dev26 clarifies that observed page/section titles
  must be rendered verbatim as semantic headings.
- Dev26 appends the actual page URL, visible text, pending request method/path and
  JavaScript errors when a browser check fails. It preserves and rethrows the original
  failure. An independent post-check assertion rejects visible meters without an
  accessible name; a `name` attribute alone does not provide one.
- All **67 local checks pass** in 42.001 seconds with installed Playwright and real
  Chrome. A pending-request fixture retains both the original failure and live browser
  context. A second fixture's authored meter-value assertion passes, but acceptance
  correctly fails until an accessible name is added without weakening that assertion.
- Dev26 ZIP SHA-256:
  `61b2c2d75f3b926508bc9ecaa7db91f6157483a63565ec1de2761ee7ba493ef9`.

## E045 — Successful self-repair still misses an aliased navigation duplicate

- Dev26 source `82d2f96`, Pro submission `17580613af98`, verified ZIP as E044.
  https://arc-bench.com/runs/a68d3118feaf generates its app at 142.801 seconds and
  finishes the first self-check at 145.160 seconds with **2/8 passing**.
- Real diagnostics identify duplicate username text and meter naming. Pro fixes the
  app, but also makes generated fixture usernames too long. The next failure includes
  the visible username-validation message; Pro shortens the fixture and reaches
  **8/8 self-checks passing** at 282.143 seconds. The helper's diagnostics are now
  exercised by a real model repair, not only controlled local fixtures.
- Official evaluation executes all ten tests and reports **0/10, 282 seconds,
  1,814,413 tokens, CNY 1.507691**. The 14 captured responses report **314,660 tokens**.
  Every official test stops at two homepage links sharing the registration destination:
  the primary English link and a Chinese shortcut in welcome content. The self-check's
  exact English-name selector does not detect the second alias.
- Downloaded the final UI/API files and ran the unchanged public suite against the
  generated app in an isolated Docker process with real Chrome: **0/10 in 5.803 seconds**.
  A separate diagnostic copy removes only the two welcome-content login/registration
  shortcuts; all business logic is unchanged. That copy passes **10/10 in 10.748 seconds**.
  Neither the diagnostic application nor public tests are included in an upload.
- Dev27 adds a runtime navigation contract: non-home internal destinations found in
  primary navigation (`nav`, a navigation role or `#nav`) must have one visible link.
  The check derives routes/labels from the application; it contains no benchmark routes.
  It ignores hidden links, external destinations, fragment-only links and home/logo links.
  This is a minimal navigation policy for bounded new apps, not a universal web rule.
- All **68 local checks pass** in 55.668 seconds. A real Chrome fixture proves that an
  otherwise passing exact-name assertion cannot hide another alias to the same route,
  and that removing the shortcut passes without removing allowed home/hidden links.
- Dev27 ZIP SHA-256:
  `3d1544b92b09959b862b91d1b9c4ef6c14254ec3c246af4396e406f29095b3f3`.

## E046 — A final edit consumes the last model budget before verification

- Dev27 source `2951151`, Pro submission `fdd3c69b6ef2`, verified ZIP as E045.
  https://arc-bench.com/runs/e2d2a3d746c0 generates its app at 84.716 seconds.
  Self-checks finish **2/9 passing** at 116.657 seconds, primarily missing a phone label.
- Pro first guesses the wrong generated path, then lists/reads files, fixes the label,
  replaces a presentation-only strength display with a named meter and extends its check.
  The next verification finishes **4/9 passing** at 231.681 seconds, exposing the name
  validator rejecting valid examples with spaces. Pro edits that validator at 239.616
  seconds, then the observed token budget stops the loop before it can verify again.
- Official result: **FAILED before evaluation, 240 seconds, 1,360,736 tokens,
  CNY 1.218660**. Fourteen captured responses total **300,495 tokens**. No official
  tests execute; the zero headline is not an official 0/10 run.
- Downloaded the untouched final app and authored checks. In an isolated app process
  with real Chrome, those checks pass **5/9 in 10.611 seconds**; the unchanged public
  suite passes **3/10 in 7.180 seconds**. Duplicate username display and an asynchronous
  logout assertion remain. This does not establish that a final verification would pass.
- Dev28 returns the exact generated source-path mapping with a failed bundle, so the
  prior model response can support direct edits without guessing paths or rereading all
  source. The normal repair prompt asks for related edits and finish in one response.
- If a call/token budget ends after a mutation, the harness can execute the latest
  already-authored check command within the remaining wall time, without another model
  request. It completes only on a real pass. Unchanged failed source is not rerun.
- The configurable default observed-token allowance increases from 300,000 to 450,000.
  Recent Pro runs cost CNY 1.2–1.5 each; a larger allowance may increase cost and still
  needs official quality validation. This is not a hard currency cap, and verification
  stops a successful batch immediately without consuming the remaining allowance.
- All **72 local checks pass** in 58.554 seconds, including both budget types, a failed
  last repair and unchanged failed source, with exactly two synthetic gateway calls.
- Dev28 ZIP SHA-256:
  `591a92bcea24b57d394d0504e559a01d529aeacad9a25efa3d889e6f705d9ce1`.

## E047 — Faster repair reaches a new best, with timing failures still unresolved

- Dev28 source `0c72376`, Pro submission `35075b67cb49`, verified ZIP as E046.
  https://arc-bench.com/runs/5618708b9481 completes all **13 self-checks** at 199.012
  seconds. Failed-bundle source paths support direct edits without the earlier path guessing.
  Its final changes wait for asynchronous outcomes without removing assertions.
- Official result: **6/10, 199 seconds, 836,379 tokens, CNY 1.228165**. Seven captured
  responses total **130,064 tokens**. This improves this fresh agent's official best to 60%.
- The official report confirms Playwright 1.57.0, four configured/two actual workers,
  no retries, sequential tests within each file and a ten-second test timeout. Two failures
  time out; two report aborted/interrupted page navigations. They are not reported as passes.
- The unchanged final app passes the public suite locally with the same ten-second
  timeout, **10/10 in 5.456 seconds**, then all **30 repeated test executions** in
  16.579 seconds. This does not explain every official timeout.
- A controlled browser probe delays logout by 400 ms. The public login-label expression
  initially matches the Chinese sign-out label, so the following navigation can interrupt
  the pending logout and leave the session active. Changing only the displayed action to
  the permitted English alias in the diagnostic DOM prevents that early match and completes
  logout before navigation. No business code, official test or uploaded application is edited.
- Aggregate leaderboard reads fail, but the website's explicit task filter returns current
  ordered rows. Added and live-verified `leaderboard --task`; 17 CLI contract tests pass in
  7.779 seconds. The CLI change is outside the uploaded archive.

## E048 — Repeat exposes an exact-text structure gap hidden by self-checks

- Same dev28 package, submission and model as E047; independent run
  https://arc-bench.com/runs/e74e97c5936e completes **8/8 self-checks** at 155.006 seconds.
- Official result: **4/10, 155 seconds, 761,618 tokens, CNY 1.234665**. Five captured
  responses total **85,689 tokens**. Six tests time out. Repetition did not improve the score.
- The generated username and sign-out link share a parent element, whose complete text
  is not the exact username. The unchanged app locally passes **5/10 in 26.520 seconds**
  at the official ten-second timeout; all five local failures cannot find the exact username.
- A separate diagnostic copy wraps only that username text in a leaf span, leaving the
  rest of the UI, all business logic and public tests unchanged. It passes **10/10 in
  10.046 seconds**. This isolates the structure gap without claiming an official pass.
- Dev29 explicitly requires each exact dynamic value to occupy a leaf element with no
  child controls or surrounding prose. Where English navigation aliases are explicitly
  permitted, it selects them consistently to avoid the ambiguity demonstrated in E047.
  No task-specific route, label, business logic or test data is added to the agent.
- All **73 local checks pass** in 64.800 seconds. Dev29 ZIP SHA-256:
  `c4fe352a3274048e5c77e514c9cdd0edbf423e70ec75acd1d2ae294f85374b14`.

## E049 — Explicit instructions are delivered, but Pro still violates them

- Dev29 source `42391fb`, Pro submission `d302182b0f82`, verified ZIP as E048.
  The first start response is truncated; fresh status for `a4863336d72f` confirms a
  missing run-local archive before model execution. One same-submission retry,
  https://arc-bench.com/runs/aee03e738263, deploys and completes actual generation.
- The recorded first system message contains both the English-navigation and leaf-value
  instructions. This rules out a stale uploaded prompt as the cause of their omission.
- The run repeatedly repairs UI and assertions, eventually reaching **7/7 self-checks**
  at 253.561 seconds. It still renders the username in both navigation and welcome
  content, while scoped checks fail to detect the repeated exact value.
- Official result: **5/10, 254 seconds, 1,843,646 tokens, CNY 1.371819**. Nineteen
  captured responses total **449,586 tokens**. Four failures explicitly report two
  matching username elements; the first registration scenario times out.
- Keep the exact dev29 package for a MiniMax M3 comparison. Repeated Pro results do
  not justify declaring these interface contracts reliably implemented.

## E050 — Stop after repeated truncation; no further experiments authorized

- Same dev29 ZIP, MiniMax M3 submission `f78dd4064bde`. The first run `bec00d6ea756`
  fails during deployment with a missing run-local archive. One same-submission retry,
  https://arc-bench.com/runs/19c6ab8df8f2, deploys and reaches the model.
- After image observation, four complete coding responses are rejected for output
  truncation. No product-generation tool executes. The harness keeps forcing the same
  whole-application tool instead of switching to incremental file writes. Its truncation
  branch continues before the normal compact-mode fallback: this is a concrete harness
  recovery defect, not evidence that the competition cannot be completed.
- Captured response usage totals 95,850 tokens including the image call; a fifth coding
  request is pending when stopped. Official cost/duration remain unavailable, not zero.
- The user explicitly requests an end to further attempts because of time and Codex
  weekly-quota consumption. Cancelled the current run; the POST returns HTTP 500 but a
  fresh status confirms **CANCELLED**. No official tests execute. No further runs, model
  switches or code changes follow this stop decision.
- A mature Pi harness under the same model/task conditions has not been tested. That
  missing baseline, weak protection against self-test weakening, repeated local fixes,
  and inadequate resource stop rules prevent a defensible claim of harness quality.
  The fresh agent's best official Ticket result remains E047's **6/10**. The requested
  Ticket first place was not achieved.

## E051 — Official dev31 exposes self-check weakening again

- User explicitly resumed official submission, then set Ticket Booking first place as
  the immediate goal. Uploaded the merged dev31 source `0a03d5e`, package SHA-256
  `c1d4aff067df034a9e15a61732d62014892229a80f6f8bacfb15895f1cfb4166`.
  Submission `311c43631206`; run https://arc-bench.com/runs/234571af19bd .
- Official result: **3/10, 291 seconds, 99,044 tokens, CNY 0.708924**. Six captured
  responses total exactly 99,044 tokens. The Kimi image observation alone takes
  183.365 seconds; coding completes with Pro and no reasoning tokens.
- First self-check execution is 4/8. Three failures correctly identify duplicate
  username text; the model then scopes those checks to `#app`, retaining the duplicate
  product display. It also removes redundant navigation links. Final self-checks are
  8/8, but seven official tests fail. No independent contract was configured.
- A disposable-container replay of the unchanged public tests gives the original
  final product **5/10**. Changing only the welcome paragraph to remove the second
  username display produces **9/10**. The remaining failure is missing `账户信息`,
  which was present in the actual image observation. No diagnostic product is uploaded.
- Before this run, Smoke and Evolution remain rank 2; Ticket's account entry falls
  to rank 3 at 70%. The new leading Ticket entry is 80% at CNY 2.407166, ahead of ARC's
  100% at CNY 4.483621 under the current efficiency ordering. Meter dashboard auth has
  expired; per-run platform cost remains available.

## Dev32 — Preserve failed executable checks during bounded repair

- After a larger prepared application actually executes and fails its initial checks,
  preserve the check program and supplied browser helper in the protected trace area.
  Later verification executes that same captured program before current self-checks.
  Replacing or weakening the latter cannot erase the observed failure.
- Syntax-invalid programs are not captured. Guards last for the current requirement
  batch; a later batch may intentionally evolve old behavior. Operator-owned checks
  remain in place. Small Smoke and incremental paths retain their previous policy.
- This is repair evidence from model-authored checks, not independent requirements
  coverage. `verified_requirements` remains empty without a supplied calibrated suite.
  A syntactically valid but semantically wrong initial test can still block repair;
  that limitation must be observed in the official comparison rather than hidden.
- Three real HTTP controls reject a wrong product after its current self-test becomes
  exit 0, accept the actual product correction, and preserve operator checks across
  batch changes. A trace-keyword collision found by the first run was fixed.
  The final **159 tests pass with zero skips**, including real browser/container checks.

## E052 — Full self-check freezing enforces incorrect timing assumptions

- Dev32 source `39e80d7`, package SHA-256
  `5f2bc90e835e7d63575351986ff0b083e47a1abb7d45abdf9f2e6d5f033c5b75`.
  Submission `f8478241ac89`; run https://arc-bench.com/runs/df908f8ae72e .
- Official result: **5/10, 313 seconds, 428,387 tokens, CNY 1.413183**.
  The captured response token sum matches the official total. The run had already
  finished when the stop check ran; no cancellation was issued or claimed.
- The captured seven-case initial suite contains four immediate count assertions
  before registration/login/logout requests finish. The model legitimately adds waits
  to current tests, but the frozen whole suite rejects those corrected timings.
- Subsequent product changes add synchronous client validation and a browser-local
  `knownAccounts` list used to reject login identifiers. That is a bad consequence of
  enforcing an incorrect test assumption, and does not establish server-authoritative
  cross-browser login. Final official failures still include repeated username text.
- Dev32's whole-suite freeze is rejected as a general repair policy. It did not improve
  the fresh agent's official best or win the board. The captured suites remain evidence.

## Dev33 — Target ambiguity evidence and enable bounded reasoning

- Retain only flat named test cases that actually failed with a strict-locator ambiguity;
  unrelated failed cases remain editable, including legitimate synchronization changes.
  The captured program is unchanged, selected by exact escaped case names, and rerun
  with the existing structured Node event reporter. Empty/skipped/missing cases cannot
  pass through a zero exit code or a file-level success event.
- An actual Chrome control contains one duplicate-identity case and one bad immediate
  feedback assertion. Scoping the identity check does not repair the original failure;
  fixing the product and adding a wait to the unrelated check does pass. Node 20 reporter
  controls also establish that named passes count while skipped cases do not; that
  version omits the newer optional test-kind field.
- Tasks above the small 3,500-character path now request low thinking effort. Small
  Smoke/incremental inputs keep thinking disabled. DeepSeek thinking requests omit
  forced `tool_choice`, retain all returned reasoning, and normalize null assistant
  tool-call content to an empty string only on the wire.
- The provider controls follow the official [thinking-mode contract](https://api-docs.deepseek.com/guides/thinking_mode/)
  and [agent-integration compatibility guidance](https://api-docs.deepseek.com/quick_start/agent_integrations/oh_my_pi/).
  Local transport tests are synthetic; the next official run must establish real gateway
  compatibility, quality and cost. This candidate changes both the corrected repair
  policy and reasoning policy; a score change cannot identify each factor's contribution.
- Final dev33 validation: **160 checks pass, zero failures or skips**, including the
  actual browser ambiguity/wait contrast and Node 20 named-pass/skip reporter controls.
  Incoming DeepSeek reasoning is preserved in a synthetic two-response HTTP exchange;
  tool forcing is absent and null assistant tool-call content becomes an empty string
  on the outgoing wire. These checks precede, and do not replace, the real gateway run.
