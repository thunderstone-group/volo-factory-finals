# Current handoff — 2026-09-22 01:08 CST: mini-SWE comparison complete, migration not justified

Read [the frozen report](reports/2026-09-22-mini-swe-comparison.md),
[evidence receipt](evidence/2026-09-22-mini-swe-comparison.json), and
[execution/recovery reference](reference/mini-swe-experiment.md). Previous handoff:
`archive/handoffs/2026-09-21-before-mini-swe.md`.

The user approved a same-model/baseline/budget comparison of mini-SWE-agent with our
fixed-feedback repair policy, scoped to booking through payment. It is complete.
Do not migrate the competition entrypoint on these results; retain original candidates.
No native Codex goal, official upload/run, or main merge was performed.

Final comparison (all on the same nine target checks plus 27 protected regressions):
classic A 5/9 to 9/9 in one call, public 49/125 unchanged; classic B 6/9 to 9/9 in one
call, public 48/125 to 46/125, losing payment cases REQ-4.3.1 and REQ-4.3.2. Reject B.
Corrected native-tool mini A completed 22 calls, mini B 17, but both stopped at the
conservative budget gate without app edits or protected verification. Their original
source hashes and 49/125, 48/125 baselines remain unchanged. They wrote exploratory
scripts in notes; those are not completed application repairs.

Each arm had a CNY 3 uncached token-cost allowance (3/9 CNY per million input/output),
32 request slots, six verifications and next-request reservations. Cache discounts do
not increase this allowance; it can stop below the nominal ceiling. This is not a
claim that mini spent CNY 3 in settled fees or that larger budgets cannot change results.
Final settled costs: classic A 0.281351, mini A 0.298123, classic B 0.390647, mini B
0.401176 CNY. Final comparison total 1.371297; all phases confirmed total 2.044966.
Six incomplete direct calls retain unknown usage/cost. Two relay SSH setup failures
were confirmed not sent; all completed calls have matched bills. See accounting.json.

mini-SWE-agent 2.4.6 is pinned at 04d809ceab9df28f9adaed044884180159172930 under
`~/projects/arcbench-campaign/upstream/mini-swe-agent`. DefaultAgent's loop
is unchanged; a subclass saves atomically. Current native tools: bash, arc_build,
arc_browser, arc_verify, arc_status, arc_submit. An earlier virtual-bash-command
interface caused executable searches; that was our adapter defect and was corrected
before the final mini trials. Keep earlier trials separate from the final comparison.

Code is under `scripts/mini_swe/`. App/browser tools use network-isolated Docker copies;
credentials and fixed evaluators are outside the model container. The gateway adapter
preserves native tool IDs/reasoning and complete usage. Long direct streams failed,
so detached HTTPS on hk-zyl was added with idempotent job IDs, shared ephemeral SSH,
checksummed retrieval, and nonfatal cleanup. Credentials use process pipes only.
Classic A's complete response was recovered without new inference. Recovery reuses
completed model responses/tool results and retains original receipts/ledgers.

Run root: `runs/mini-swe-20260921/`. Final arms: `classic-a-relay`, `classic-b-relay`,
`mini-a-native-tools`, `mini-b-native-tools`. All are terminal. Earlier direct/relay
adapter trials and their failures remain. Source versions are preserved in driver-v1,
driver-v2 and driver-v3 snapshots; driver-recovery.json binds revised transport code
to unchanged original plans. Current sources match the corrected native-tool plans.
Do not repeat completed calls. Use exact snapshots for historical plans.

Validation: 45 current control tests pass (12 adapter/relay plus 33 inherited); required
legacy suite 214 passed / 12 skipped. Final 41 completed comparison responses match
captured SSE, model IDs, usage and request hashes. Classic selected sources exactly
match model patches; mini source is unchanged. Real container build/browser access,
relay read/model delivery, idempotent launch and no-regeneration recovery were verified.
The local ARM64 / Node 20.19.3 / Playwright 1.57.0 / one CPU / 2GB / one-worker runtime
is not the full official x86_64 lifecycle. Timing includes transport/recovery effects.

Branch exp/mini-swe-goal-20260921 preserves main plus PR #42 ancestry. Review as a
stacked experimental PR against #42's branch. Main and the competition package are
unchanged. Keep this result as a negative/conditional experiment, not proof that an
external harness or longer iteration improves ARC scores. A next change should target
concrete behavior/verification gaps and demonstrate useful edits at comparable cost.
