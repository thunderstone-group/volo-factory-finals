# Current handoff — 2026-09-22 16:00: Lite v5 uploaded; official Keep running; v6 probe prepared

The user requested the native Goal, focused solely on Keep (32) and BookStack (34), and explicitly
said to submit to official Lite evaluation once a candidate looks promising. No repeat permission
is needed. Complete the Goal only when the same candidate/model independently generates both full
passes and repeats each. Official full passes may count as independent repeats with exact package,
model and corpus identity. Manual diagnostic full passes and frozen-draft repairs do not count.
Existing ARC balance is authorized for necessary calls; no recharge/purchase. No six-task Web batch.

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
pass. Current working source is this PREPARED v6; it has NOT generated/repaired/uploaded anything.
V6 ZIP `R/candidates/semantic-browser-v6/candidate.zip`, SHA-256
`aba35a4ed761d15068de320b31da31a74054ab3607fcda2b0617a1db186f6d11`.
Do not confuse it with the frozen v5 source/ZIP used by the official pair.

BookStack's earlier integrated fixed-draft repair32/34 (+4/-0) has remaining REQ-6.1.2/6.1.3 draft
failures. Code reads show anonymous homepage still gates recent drafts, and draft links bypass
the reading/Edit flow. Wait for official BookStack feedback before deciding the next change.
The two prior controlled repairs total64/66 (+9/-0), but are NOT independent Goal passes. Goal
still requires the same candidate/model to independently pass both full suites and repeat each.

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
