# Current handoff — 2026-09-22: Lite Goal active; automated Keep repair 32/32, packaged v5 ready

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

Current process: `R/generate.py --candidate semantic-browser-v5 --app keep --sample direct-a
--model qwen3.7-plus --transport direct`, log `R/keep-v5-direct-a.log`, output
`R/generations/semantic-browser-v5/keep-direct-a`. This is a fresh independent generation.

BookStack's packaged fixed-draft repair completed32/34 (+4/-0) in178.697s with one real Qwen call;
remaining failures are REQ-6.1.2/REQ-6.1.3 (draft workflows). No official evaluator is fed to repair.
Full replay: `R/replays/diagnostic/bookstack-v5-integrated-repair/result.json`.
The two controlled repairs now total64/66 (+9/-0). The user wants an official trial when promising:
after the independent Keep replay shows no material regression, submit the exact v5 ZIP to official
Lite and use those runs as the next independent generation evidence. Do not wait for every local
Goal repeat before this first authorized trial. Official Keep/BookStack runs must be sequential;
stop local model traffic for their entire lifecycle. Verify no active/pending conflicting submission
before upload, verify archived ZIP identity, and retain task/model/run/cost evidence. No new official
upload/run has occurred yet. Goal still requires both independent full passes and repeats.

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
cohort separate. Latest meter CNY216.253653, pending billing0, no active official runs (see
`R/billing-semantic-v5`). Actual settled costs are in `R/accounting.json`.
One older relay request remains UNCONFIRMED: baseline-gate-v2/bookstack-qwen-a,
/tmp/arc-mini-transport-a27697eaccdd4569958eec21d6b776ce. No SSE received; SSH banner failed.
Never reissue it merely because observation failed. Inspect/resume that same idempotent job when
SSH recovers. Do not expand infrastructure work. The later direct runs are different requests.
