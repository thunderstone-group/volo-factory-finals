# Current handoff — 2026-09-22: Lite Goal active; first v3 candidate generating directly

The owner explicitly opened a native Goal. Complete only when one fixed candidate/model configuration
independently generates Keep 32/32 and BookStack 34/34 and each task independently passes again.
No token budget was requested. Existing ARC account balance authorizes necessary model calls; no
purchase/recharge is authorized. Do not launch the six-task Web batch. Goal is ACTIVE and incomplete.

## Current execution

Work in this worktree; inspect live Git state. `runs/lite-goal-20260922/state.json` is the execution
pointer. Current process: `generate.py --candidate requirements-first-v3 --app keep --sample direct-a
--model qwen3.7-plus --transport direct`, log `keep-v3-direct-a.log`. The request has produced valid
Qwen SSE through direct HTTPS; use its process/receipt, not a new generation, to resume observation.
Plan: `direct-v3-plan.json`. Candidate ZIP SHA-256:
f286d4e4a09abc7168ed5402638c8c38f06f012c4f7d941f64450947391cb511.

The candidate contains compact requirement-first guidance, a literal-label diagnostic fix and native
input dispatch. After Keep is delivered, run the complete unchanged suite using `replay.py`; then
independently generate BookStack with the same package/model. No official upload/run has occurred.
Only requirements and the generic scaffold enter generation. Tests and diagnostic hand-fixed apps
remain outside the model's generation input. A second independent full success per app is still required.

## Evidence to retain

- Current public corpus was fixed from upstream cfbbc287ee1bbffcf1e936545e4803145693a8d8; current Lite
  API packs match 68 TypeScript files after newline normalization. Keep has 32 cases, BookStack 34.
  Tests stay unchanged and read-only. See reports/2026-09-22-lite-first.md and its evidence.
- Frozen 01fa275 DeepSeek generation: Keep 23/32, BookStack 5/34. Two DeepSeek repair requests returned
  HTTP 429 insufficient_quota despite positive meter balance. Known completed costs: CNY 1.909076.
- Separate Qwen baseline Keep: first draft 27/32 and automatic repair 27/32. Repair was triggered by
  a false arc/esc label collision in interpolated JS. Settled cost 0.552576 + 0.147340 CNY; usage
  52,030 input / 74,482 output. Do not mix model cohorts when attributing improvements.
- Removing that false diagnostic preserves the exact first request and byte-identical draft in an
  offline response replay, skips the unnecessary repair, and inherits the existing 27/32 replay.
  It is not a new independent generation. Native input dispatch separately yields 28/32 (+1/-0).
- Hand-corrected diagnostic apps achieve Keep 32/32 and BookStack 34/34; both retain full pass with
  the input change. They establish failure causes but NEVER satisfy Goal generation requirements.
- Current code validation: one-shot 84 passed; legacy 214 passed / 12 skipped. Evidence:
  evidence/2026-09-22-lite-gates.json, evidence/2026-09-22-lite-goal-baselines.json and raw run files.

## Runtime and transport

Local replay is pinned image sha256:d07f2f6e61faa9e95bff17c589c00e115f7512422a1570751f64e391247d5c05,
ARM64, Node 20.19.3, Playwright 1.57.0, one CPU, 2GB, one worker, 10-second test/expect timeout.
This is not the full official x86_64 lifecycle. Complete reports and immutable input hashes are retained.

The baseline-gate-v2 BookStack qwen-a request has an UNCONFIRMED remote launch at
/tmp/arc-mini-transport-a27697eaccdd4569958eec21d6b776ce. Mac SSH had banner timeouts; a read-only
probe through currently verified wanctl bms reached HK and LS SSH banners. Direct/jump/local SOCKS
from Mac failed. No server configuration changed. Do not regenerate the uncertain request merely
because observation failed. Resume its idempotent job or inspect the marker when SSH becomes reachable.
The new direct-v3 Keep request is a different candidate/request, not a retry of that uncertain job.

Generation-driver snapshots v1 through v5 and transport provenance live under the run root's tools/.
v4 adds bounded safe API-read retries; v5 selects direct or detached relay transport and retains raw
SSE. Direct credentials stay in curl stdin and traces are redacted. Current accounting is in
runs/lite-goal-20260922/accounting.json. Last confirmed preflight balance was CNY 218.377885 with no
active official runs; recheck before new paid traffic. Do not silently overwrite failed receipts.
