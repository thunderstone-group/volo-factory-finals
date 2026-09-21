# Current handoff — 2026-09-21 15:40 CST: business-feedback pilot complete

Read [the frozen report](reports/2026-09-21-business-feedback-pilot.md),
[evidence receipt](evidence/2026-09-21-business-feedback-pilot.json), then
[execution reference](reference/business-feedback-loop.md). The prior handoff is
archived under `archive/handoffs/2026-09-21-before-business-feedback.md`.

The user authorized trying requirement-derived business feedback and repeated
goal-style repair, and asked whether long competitor runtimes imply many model turns.
This bounded local study is complete. It did not create a native Codex goal, submit
an official run, generate new drafts or replace the default competition agent.

Two immutable Ctrip drafts were repaired by four actual DeepSeek V4 Flash calls.
The unchanged 125-case suite gave 33 to 49 passes for Ctrip-3 (+16/-0), and 29 to 48
for Ctrip-2 (+19/-0). Ctrip-2's business-only repair first stayed at 29; a separately
declared keyboard-input follow-up produced the 19-case gain. The evidence supports
combining business and existing delivery/input-contract feedback, rather than merely
raising the round limit. Broader requirements and independent fresh drafts are still
unverified; do not promote this hand-authored probe as complete task verification.

Pilot A's original probe reported 8/13, 11/13, 13/13. A separate post-run audit corrected
an overly narrow contact label and hover/scoping of deletion: the corrected sequence
is 8/13, 13/13, 13/13. Its first model feedback was unchanged. Round 2 still added 13
published-suite passes, but those raw probe gains are not two newly implemented
business capabilities. The later trials used calibrated probes and real positive
controls. All original plans and results remain unchanged.

Local run roots are `runs/business-loop-20260921/`,
`runs/business-loop-replication-20260921/`, and
`runs/business-loop-input-contract-20260921/`. Each is terminal; no controller is left
running. Their exact executed drivers are preserved in `driver-v1/`, `driver-v2/` and
`driver-v3/` respectively. Use Python 3.11.15 and the matching snapshot when resuming
or auditing a frozen plan. Terminal resume was checked to make zero new model calls.
The current scripts match the third plan. Earlier drafts/evaluators were not edited.

Model spending settled at CNY 1.675812, 254,737 input / 131,645 output tokens, four
completed calls, no unknown usage or unmatched bills. This excludes historical draft
generation. Existing ARC balance remains authorized within scoped experiments; ask
only if funds are insufficient. Public-suite code, scores and failed-case lists were
not passed to the repair model or used for per-round selection. Request reconstruction
and patch-provenance audits passed for all four calls; Codex did not edit app files.

Runtime: Node 20.19.3, Playwright 1.57.0, Chromium 143.0.7499.4, 1 CPU, 2GB, one worker,
UTC, local ARM64. This is not the full official x86_64 submission lifecycle. Generated
persistence uses localStorage; same-browser reload success does not prove multi-browser
account consistency. Seven controller tests passed; required legacy suite had 214
passes and 12 skips. No official score/rank change is claimed.

The worktree is `business-feedback-loop-20260921`, branch
`exp/business-feedback-loop-20260921`, based on main plus recovery PR #39. Review as a
stacked experimental PR; do not silently enable it in the competition entrypoint.
The preliminary-notice update remains separate in PR #40; consult that report for
the supplied formal rules instead of older campaign assumptions.

The leaderboard duration snapshot supports investigating more iteration: nontrivial
Lite 100% entries took about 33–114 minutes, compared with VOLO's 12.7 minutes; the
Web 99.5% examples took 3.6–6.3 hours versus 18.9 minutes. These are aggregate timings,
not call traces, so they cannot establish another team's turn count or goal feature.
The next design priority is accurate, broader completion criteria that preserve
existing interaction contracts, before production integration or additional spending.
