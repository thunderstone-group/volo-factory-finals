# Current handoff — 2026-09-22 16:35: official v5 still running; runtime requirements differ; v8 prepared

The user requested the native Goal, focused solely on Keep (32) and BookStack (34), and explicitly
said to submit to official Lite evaluation once a candidate looks promising. No repeat permission
is needed. Complete the Goal only when the same candidate/model independently generates both full
passes and repeats each. Official full passes may count as independent repeats with exact package,
model and corpus identity. Manual diagnostic full passes and frozen-draft repairs do not count.
Existing ARC balance is authorized for necessary calls; no recharge/purchase. No six-task Web batch.

## Input identity: newly confirmed divergence

The downloaded CURRENT official Keep workspace contains a different requirements.yaml from the public
exercise used locally. Parsed comparison finds85 semantic FIELD differences, not whitespace changes.
The public copy exactly matches clean upstream HEAD cfbbc287ee1bbffcf1e936545e4803145693a8d8.
Public SHA-2565cbc81e3fe147070e3d5c226923cf097a60b23cb8bce73bc67a2d848b93965be;
runtime SHA-256446b912bab64e30bb084e7c0d89f553ea9def59831b232de76b90b7bdfef810a.
Official runtime omits many explicit roles/names/editor constraints found in the public version.
Do NOT replace or edit the public corpus, silently pool input versions, or count this official run
as an identical-input public Goal repeat. The public Lite objective remains the priority; the already
authorized official trial is distinct evidence. Runtime evaluation-source identity is still unverified.
The runtime input is separately frozen read-only at R/corpus-runtime/keep/requirements/requirements.yaml.
Full comparison: R/official/semantic-browser-v5/requirement-comparison.json. The live workspace
snapshot still contains only byte-identical scaffold application files, with no generated app content.
This establishes the observed stage, not whether an upstream model request is live or failed.
The configured upload key DOES equal the current account key; no key values/hashes were recorded.

## Current execution

Worktree: `lite-first-20260922`, branch `exp/lite-first-20260922`. Main remains untouched.
Live pointer: `runs/lite-goal-20260922/state.json` (R below). Current candidate `semantic-browser-v5`,
ZIP SHA-256 `43b071f8a8ed9b30064dd54f47b96196aee4c54a128b524d879f5e5adc347137`.
It retains the full targeted v4 card, fixes native checkbox/control clicks and literal label scanning,
and adds a deterministic real Chromium diagnostic to the existing one-repair flow. There is no
model-generated probe or extra planning call. The packaged helper is allowlisted. Runtime gaps are
recorded separately, never called app failures; an unavailable browser recheck cannot approve a repair.

Current official submission `9331665b18ae`, name `volo-lite-semantic-v5`, model `qwen3.7-plus`.
Remote archive was downloaded and exactly matches the v5 ZIP hash above. Official Keep run
`2eef0a0f987a`, https://arc-bench.com/runs/2eef0a0f987a, is RUNNING: environment/dependencies passed,
agent executing. Read `R/official/semantic-browser-v5/keep-status.json` and poll the existing run.
CLI status exits1 while a run is still RUNNING; inspect its JSON status rather than treating exit1
alone as a run failure. Stop all local model traffic until BOTH official tasks finish. When Keep
is terminal, run BookStack from the SAME submission9331665b18ae with the existing arcbench CLI,
retain its new run id, and wait. Never upload another package while this pair is pending/running.
No BookStack official run has been created for this candidate yet.

Fresh independent v5 Keep finished29/32, +2/-0 versus v4 first draft27/32. Remaining failures are
REQ-2.7.1/2.7.2/2.7.4, all label editor paths. One call20,296 input/53,707 output,1021.063s, settled
CNY0.470248. The initial smoke/browser probe saw zero issues because search navigation displaced
its record traversal; this does NOT prove full coverage. No independent full Goal pass yet.
`R/generations/semantic-browser-v5/keep-direct-a` and full replay under `R/replays/semantic-browser-v5`.

While official v5 runs, a separate unpaid v6 probe was prepared: only semantic_probe.cjs changes,
card/main/scaffold unchanged. It resets focus side effects, prioritizes entry and record actions,
and diagnoses field-editor dialogs opened from a record with the wrong declared editor name.
It finds both real roots of the three v5 Keep failures: Change labels is a menuitem instead of the
required button, and record field editing opens a Change labels dialog instead of Note editor.
Positive Keep32/BookStack34 samples produce zero errors, while the action trace actually visits
the label paths. Evidence `R/probe-v6/integrated-*/receipt.json`; packaging2/2 tests and JS syntax
pass. V6 is a PREPARED snapshot; it has NOT generated/repaired/uploaded anything.
V6 ZIP `R/candidates/semantic-browser-v6/candidate.zip`, SHA-256
`aba35a4ed761d15068de320b31da31a74054ab3607fcda2b0617a1db186f6d11`.
V7 snapshot `session-store-v7`, SHA-256
`1d36d56969428487b98e4ee1aea72030acc96e7d372c2371dc867e373e96b693`.
Relative to v6, only scaffold/README.md and scaffold/frontend/public/lib/arc.js change. The library
restores/saves ARC.state synchronously in sessionStorage. This preserves login and domain state
within a tab across full navigation while independent browser contexts still start from seed.
Current working source is PREPARED `entity-flow-v8`, ZIP SHA-256
`b7b167f9e7e13bd281a0086367e493db7374c266669ac80522ed5129ffc76981`.
Relative to v7 only dialect.md changes: for entities with both reading/details and an Edit action,
primary links consistently open the reading/details view for all states including drafts, unless
requirements explicitly demand direct editor entry. No task IDs/answers are injected. This prompt
change has NOT been tested with a fresh model call. V6/v7/v8 remain unuploaded; official uses v5.


The earlier BookStack draft-save diagnosis is now confirmed by real browser reproduction, not an
authentication-precondition guess: the official test DOES call login. Its helper then navigates to
/ again; the old scaffold re-seeds state and loses that session. Before: signed-in true then false.
After the storage fix: true then true; a separate browser context stays signed-out. Replacing ONLY
this primitive improves the frozen BookStack32/34 to33/34 (+REQ-6.1.2/-0). A one-line DIAGNOSTIC navigation change then improves33/34 to34/34 (+REQ-6.1.3/-0): draft links
open the existing reading view, followed by its existing Edit action. The v8 card records the general
entity-flow rule above. This hand-applied application diagnostic is NOT an independent Goal pass.
Both positive diagnostic apps keep32/32 and34/34 after the store change. One-shot91 tests pass;
the strengthened real-browser persistence fixture was individually rerun and passed. These manual
library swaps do not count as independent Goal passes. No local model traffic occurred.

V6 was also replayed OFFLINE against the exact recorded v5 request/response: initial request bytes
and all delivered app source hashes are identical; the improved probe now reports the two label
root causes. New model calls0; recorded usage is historical and must not be billed/count again.
`R/diagnostics/keep-v6-exact-response-replay/receipt.json`.

The official Keep waiter is live session15024:
`arcbench ... --json wait 2eef0a0f987a --interval20 --timeout3600`.
`R/official/semantic-browser-v5/keep-wait.json` is a JSON-lines progress stream, despite its suffix.
It recorded one transient TLS EOF GET failure and retries the SAME run; an observation failure is
not a terminal run. Poll the existing process or authoritative run API; never recreate the run.
Goal still requires the same candidate/model to independently pass both full suites and repeat.

## Observed evidence

- Current public corpus: upstream cfbbc287ee1bbffcf1e936545e4803145693a8d8; API packs match all
  68 TypeScript files after newline normalization. Requirements/tests remain read-only.
- Qwen original Keep: first draft27/32, false automatic repair27/32; native input dispatch alone28/32.
- V3 compact card rejected: fresh Keep25/32, BookStack28/34. `docs/evidence/2026-09-22-lite-v3-pair.json`.
- V4 targeted card: fresh Keep27/32; BookStack first draft28/34, false form-label repair23/34.
  Corrected the scanner's preceding-button heuristic and protected backtick names in current v5.
- Real browser observations from Keep v4 exposed missing region, button-role overrides, field chooser
  outside the named editor, native checkbox cancellation and a focus recursion error. One model repair
  reached32/32 (+5/-0), with no manual app code edits: `R/repairs/v5-keep-browser-feedback` and
  `R/replays/diagnostic/keep-v5-browser-repair/result.json`. This is fixed-draft evidence, not independent.
  Usage30,638 input /7,263 output,116.632sec; settled cost CNY0.119380.
- Packaged diagnostics match positive Keep32 and BookStack34 samples with zero errors on macOS and
  Linux; catch two missing homepage lists on raw v4 BookStack. `R/probe-v5/integrated-*/receipt.json`.
- One-shot90/90 deterministic regressions passed, log `R/semantic-v5-tests.log`; legacy214 passed/12 skipped
  under `~/projects/volo-factory/.venv/bin/python`, log `R/semantic-v5-legacy-tests.log`.

## Runtime and recovery

Local replay image sha256:d07f2f6e61faa9e95bff17c589c00e115f7512422a1570751f64e391247d5c05,
ARM64, Node20.19.3, Playwright1.57.0, Chromium143.0.7499.4, 1CPU/2GB, worker1,10s timeouts.
This is not the complete official x86_64 lifecycle. `R/replay.py` preserves test identity and refuses
overwrite. Current generator `R/generate.py` freezes source, retains raw SSE/requests/usage, and uses
existing arcbench-cli for platform preflight. Prefer direct transport; credentials stay off logs.
For local v5 execution, set NODE_PATH=R/browser-runtime/node_modules and
PLAYWRIGHT_BROWSERS_PATH=R/browser-cache. Production helper installs pinned Playwright if unavailable.

DeepSeek repair twice returned429 insufficient_quota despite positive meter balance; keep the Qwen
cohort separate. Latest settled balance CNY215.641837 before the official run, pending billing0 at that preflight.
Keep v5 costs CNY0.470248; BookStack fixed repair CNY0.141568. `R/accounting.json` retains actual bills.
One older relay request remains UNCONFIRMED: baseline-gate-v2/bookstack-qwen-a,
/tmp/arc-mini-transport-a27697eaccdd4569958eec21d6b776ce. No SSE received; SSH banner failed.
Never reissue it merely because observation failed. Inspect/resume that same idempotent job when
SSH recovers. Do not expand infrastructure work. The later direct runs are different requests.
