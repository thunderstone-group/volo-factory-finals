# Current handoff — 2026-09-21 17:04 CST: goal comparison complete, candidate promotion rejected

Read [the frozen report](reports/2026-09-21-requirement-goal-comparison.md),
[initial evidence](evidence/2026-09-21-requirement-goal-comparison.json),
[verifier hardening evidence](evidence/2026-09-21-requirement-goal-hardening.json), and
[execution reference](reference/business-feedback-loop.md). The prior handoff is
archived as `archive/handoffs/2026-09-21-before-requirement-goal.md`.

The user authorized fixing incomplete/misleading verification and trying a goal-style
harness or an external harness with our tools. This study added a requirement inventory
to the existing Flash repair controller, researched mini-SWE-agent as an alternative,
and completed two local saved-draft trials. No native Codex goal or external harness
integration was performed. The default competition entrypoint and main are unchanged.

Independent results: Ctrip A 49/125 to 42/125 (+0/-7); Ctrip B 48/125 to 48/125 with
identical passing cases. A's unchanged baseline was rerun and exactly reproduced all
49 passes. Reject A's candidate and retain original competition selections. B's tested
business behavior improved, but there is no independent score gain to promote.

The original 27-check isolated probe measured A 22 to 25, then 25 again; its second
complete proposal was rejected for no progress. B reached 27/27 in one repair. The
inventory contains 225 nodes / 125 atomic requirements; 99 atomic requirements remain
unobserved. Group observations never imply verified children, and green scoped checks
never assert full requirement verification.

Post-run diagnosis: a lost passenger case passes alone but fails in the full sequence.
The candidate restores every shared-state key and saves on render; failure pages show
an earlier workflow's signed-in user in a fresh browser context. The old probe restarted
the backend per case, hiding batch-state regressions. New goal plans now default to
shared-backend probes. Real shared-gate replay: A baseline 22/27, A candidate 14/27
(eight lost passes, no gains, rejected), correct B positive control 27/27. No model
calls were made after this hardening. Individual causes of all seven public losses
were not separately proved.

Before a paid call, the current controller validates application/check hashes and
server lifecycle against the observations. Cached replays enforce the same boundary.
Source/check/lifecycle changes require a new measured baseline. Keep the shared batch
gate for acceptance; per-case server resets remain an explicit isolated diagnostic.

Three SSH streams interrupted A's second repair: HTTP 200/1.1, curl 18, SSH exit 255,
remote-closed stderr, no final usage. The three-attempt cap remains exhausted in the
original trial. A separately declared one-attempt direct-HTTPS continuation completed
with the identical request SHA and no probe gain; it stopped as stalled. Do not reset
the parent trial or attribute the SSH failures solely to the provider. No global proxy
or SSH setting changed, and the owned diagnostic tunnel was cleaned up.

Actual gateway requests: six, with three complete and three incomplete. Confirmed
completed-call cost CNY 1.201896, 221,761 input / 101,858 output tokens. The three
incomplete calls have unknown usage/cost, not zero. Existing ARC balance remains
user-authorized within scoped experiments; ask only if funds are insufficient.
Costs exclude prior studies and generation. No official run/upload occurred.

Run root: `runs/goal-comparison-20260921/`. Original pilots are `goal-a/` and `goal-b/`;
continuation is `goal-a-direct-continuation/`. Parent A is intentionally interrupted at
its persistent limit; B is coverage_incomplete; continuation is stalled. No workers or
owned model tunnels remain. Exact paid-run drivers are preserved in parent `driver-v1/`
folders and continuation `driver-v2/`. Current scripts include later verifier hardening;
use matching snapshots for old plans. Completed terminal resumes make zero new calls.

Validation: 10 goal/preflight tests, 7 loop tests, 16 recovery tests; required legacy
suite 214 passed / 12 skipped in the local Python 3.11.15 venv. Request/patch provenance
audits passed for all completed calls; interrupted and direct request hashes match.
Runtime is pinned local ARM64, Node 20.19.3 / Playwright 1.57.0 / Chromium 143.0.7499.4,
one CPU / 2GB / one worker / UTC. It is not the complete official x86_64 lifecycle.

Branch `exp/requirement-goal-loop-20260921` is based on main plus PR #39 and #41 ancestry;
review as a stacked experimental PR against #41's branch. Main remains on main. The
preliminary-notice update remains separate in PR #40. Future harness comparisons should
reuse these fixed verification/rollback/accounting boundaries. Longer iteration alone
has not shown a scoring advantage in this study; 99 unobserved requirements and safe
separation of account data from session/view state remain the concrete coverage gaps.
