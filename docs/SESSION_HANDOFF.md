# Current handoff — 2026-09-22 19:11: Kimi HighSpeed v13 independent Keep running; Goal active

The user explicitly requested this native Goal and authorized an official Lite trial when promising.
Only Keep32 and BookStack34; never launch the six-task Web batch. Existing ARC balance is authorized
for necessary scoped model calls, no recharge/purchase. Complete only when the same candidate/model
independently generates both full passes and independently repeats each. Diagnostic edits and cached
response replays do not count. No independent full pass has yet been established for the current v13.

## Current execution

Worktree `lite-first-20260922`, branch `exp/lite-first-20260922`; main stays untouched. R is
`runs/lite-goal-20260922`. Live pointer R/state.json. Source is current `runtime-retention-v13`.
ZIP SHA-25601872ebe97ba4ac461fcceb8638510c780cc00e0e81fa3322f21292b3b837099.
Model kimi-k2.7-code-highspeed, temperature1.0, max_tokens131072, cross-model fallback disabled.
Current process (session96391): R/generate.py --candidate runtime-retention-v13 --app keep
--sample highspeed-a --model kimi-k2.7-code-highspeed --transport direct.
Log R/keep-v13-highspeed-a.log; output R/generations/runtime-retention-v13/keep-highspeed-a.
The request is live and returning actual HighSpeed SSE. Do not repeat/restart it on an observation gap.
When it finishes, run the complete public32-case replay. Then generate/replay BookStack with this
SAME frozen candidate/model. If both full-pass, independently repeat each. If partial, diagnose from
unchanged full test results and apply controlled fixes without calling diagnostic copies Goal passes.

## Current candidate changes and validation

- Earlier common fixes: native input dispatch; native checkbox/control clicks; exact brand names;
  template-expression/form false-collision fixes; backtick name protection; same-tab sessionStorage
  restores login/domain state after full navigation, fresh browser contexts start from seed.
- A real Kimi failure revealed openPopover(child-of-current-menu) detached its new controls when the
  old menu was removed. The library now keeps the connected anchor and the selected record id.
- The deterministic Chromium probe derives explicit initial states from Seed data (active/deletable/
  regular/pinned/etc.), rather than GIVEN/THEN. It detects four wrong Kimi seed flags, plus label scope
  and duplicate Close issues. Real positive Keep32/BookStack34 controls remain clean. Use ONLY
  R/probe-v12/verified-*/receipt.json: earlier integrated-* accidentally loaded v6 (recorded, not erased).
- Probe traversal resets focus side effects, prioritizes entry/record actions, observes native controls,
  and checks explicit roles/editor scopes. No model-generated probe or extra planning call.
- Live progress.json in the owned staging directory records phase, request hash and received/answer/
  reasoning character counts. No raw prompts, answer text or credentials in that snapshot. Final true
  traces remain logged; counts are not token estimates. v9 cached real-SSE replay preserved exact content
  and usage, and request-byte comparison with v8 was identical.
- v13 fixes a retention false positive: a literal Change labels button became a data-driven menu item.
  Static source parsing lost its name, although Chromium successfully clicked it. Successful runtime
  actions now establish retained names; failed/unexecuted observations do not waive the guard.
- Current validation:98 tests passed before the retention change; its two new regressions and the
  existing actual-rename rejection test passed. Raw logs: seed-popover-full-tests.log and
  runtime-name-retention-tests.log. Earlier legacy214 passed/12 skipped; legacy remains unchanged.

## Measurements, separated by cohort

Qwen historical/public: original Keep27/32; v3 compact card25/32 and BookStack28/34 (rejected).
v4 Keep27/32, BookStack first draft28/34; false form-label repair23/34. v5 fresh public Keep29/32,
1021.063s, one call20,296 input/53,707 output, settled CNY0.470248.
Controlled automatic repairs: earlier Keep32/32, BookStack32/34. Session-store-only library swap then
BookStack33/34 (+REQ-6.1.2/-0); a diagnostic primary-link change gives34/34 (+REQ-6.1.3/-0).
Those manual/frozen diagnostics never count as independent generations.

Latest user steering: supplier notice says Kimi may be more stable/fluent. Live ARC catalogue confirms
kimi-k2.7-code (input6.5/output27 CNY per1M) and highspeed (13/54). Provider docs require temperature1.0
and always-on thinking. Adapter verified with real SSE through the organizer gateway; no new key or
subscription. Default/HighSpeed configurations are tracked separately; do not credit model differences
as code gains. Latest balance before Kimi calls was CNY214.391777, pending billing0.

Standard Kimi v11 (ZIP494c73eb2e1c9f49172b3b9c97f6cff8942289dc03b37c2e01918094c294b62c):
Keep25/32, one call995.977s,20,031 input/45,187 output (35,204 reasoning). No retry. BookStack failed
at the LOCAL curl1200s cap: exit28,178,046 reasoning chars,0 answer chars, no usage/DONE. This is not
proved provider instability and no application was delivered. Preserve that attempt; never blindly
reissue it. Its receipt is R/generations/kimi-adapter-v11/bookstack-direct-a/receipt.json.

HighSpeed v12 (ZIP966eda3309d2877ec20fa1a3d17fae177f437cbf89325a53e813e68d2a29da11):
Keep finished generation+automatic repair in290.335s,2 completed calls, no failures,50,686 input/
52,844 output. The static name guard rejected its otherwise clean repair and published25/32.
Reconstructing ONLY the model's already-produced repair yields32/32 (+7/-0). No manual app edits.
R/replays/diagnostic/keep-highspeed-rejected-repair/result.json is the full score. v13 cached exact-
request/response replay automatically accepts the same repair and produces identical app hashes:
R/diagnostics/keep-runtime-retention-replay/receipt.json. New calls0; not an independent v13 pass.

## Official v5 trial completed

Submission9331665b18ae, Qwen3.7-plus, ZIP43b071f8a8ed9b30064dd54f47b96196aee4c54a128b524d879f5e5adc347137.
Remote archive matched exactly. Keep2eef0a0f987a finished14/32; run field3708s, wall clock65m26s,
122,304 metered tokens, CNY0.665106. Two initial calls failed with StreamError at1200s each,0 answer
chars and unknown usage. Third call completed (19,392 input/59,539 output,46,333 reasoning,
1161.018s); fourth repaired (32,829/10,544,123.025s). All requested Qwen. The process/test steps
completed; this was a functional partial result. Raw numeric traces (private) are in
R/official/semantic-browser-v5/keep-model-trace-raw.json; CLI blanket string redaction masks token
numbers inside console JSON, so use the existing client's get_run_logs and redact actual credentials
when numeric trace fidelity is needed. Do not invent usage for the failed calls.

BookStack1f56fb1be7fc finished27/34,1003s reported agent duration,115,063 tokens,CNY0.584954.
Both official runs are terminal; no official traffic is active. It is safe to resume scoped local model
calls after each driver's live preflight. Official/public inputs are NOT globally interchangeable:
Keep runtime requirements differ in85 semantic fields from clean public upstream cfbbc287ee1bbffcf1e936545e4803145693a8d8.
The SAME official Keep application scores13/32 locally; only REQ-1.1 differs (public requires Notes
workspace region, absent in source). Runtime evaluator source identity remains unproved. BookStack
runtime requirements were fetched and parsed with0 semantic differences versus public. Preserve
per-task identities; do not blame its seven failures on a requirement mismatch. Both runtime copies
are frozen separately under R/corpus-runtime; public R/corpus stays unchanged/read-only.

## Runtime and next comparisons

Local acceptance image sha256:d07f2f6e61faa9e95bff17c589c00e115f7512422a1570751f64e391247d5c05,
ARM64, Node20.19.3, Playwright1.57.0, Chromium143.0.7499.4,1CPU/2GB, worker1,10s timeouts.
R/replay.py checks all32/34 IDs and unchanged test hashes. This differs from official x86_64 lifecycle.
Local browser env: NODE_PATH=R/browser-runtime/node_modules; PLAYWRIGHT_BROWSERS_PATH=R/browser-cache.
Only existing arcbench-cli is the platform client. Credentials never enter arguments/output.
Current generate.py adds confirmed Kimi model IDs; prior driver snapshots remain in R/tools.
Qwen thinking16k-v10 is merely PREPARED/unrun; set aside while following the user's Kimi notice.
Supplier supports thinking_budget but organizer forwarding/quality was not tested.

An older UNCONFIRMED relay launch still exists: baseline-gate-v2/bookstack-qwen-a,
/tmp/arc-mini-transport-a27697eaccdd4569958eec21d6b776ce. Never blindly reissue it. This is distinct
from the now terminal standard-Kimi client timeout and from the current HighSpeed request.
