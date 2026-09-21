# Business-feedback repair pilot

Last reviewed: 2026-09-21.

This is an opt-in local experiment around immutable generated applications. It keeps
the generator/scaffold baseline and asks the same Flash model for targeted repairs
using observed business behavior. It is not a general test generator, a replacement
for the full requirements, or an official submission entrypoint.

The loop borrows the [goal workflow](https://learn.chatgpt.com/use-cases/follow-goals)
principle: specify a verifiable stopping condition, inspect progress after each change,
preserve successes and stop when the objective or an explicit limit is reached.
It does not invoke Codex's native goal tools inside the competition agent.

## Execution

Use Python 3.11.15 and the exact driver snapshot named by a frozen plan. For example,
inspect the finished direct continuation without making another model call:

```sh
uv run --no-project --python 3.11.15 python \
  runs/goal-comparison-20260921/goal-a-direct-continuation/driver-v2/scripts/business_loop.py \
  --run-dir runs/goal-comparison-20260921/goal-a-direct-continuation
```

The first business pilots are preserved in their original worktree's `driver-v1/`,
`driver-v2/` and `driver-v3/` folders. The first requirement-goal pilots use `driver-v1/`;
the direct continuation uses `driver-v2/`. Current scripts include later shared-server
hardening. Hash guards intentionally reject mixing driver versions with old plans.

Each plan pins source/check/driver hashes, requirements and the baseline probe. Limits
are experiment-specific: the first business pilots allowed six repairs, the requirement
goal pilots allowed three, and the diagnosed direct continuation allowed one attempt.
The inherited recovery module keeps three cumulative transport attempts per round,
an inherited process lock, exact retry-request checks and atomic state/receipts.
Completed calls are never repeated merely because the controller was interrupted.

`business_model_step.py` sends only the requirements, current accepted application and
our probe observations. Public-suite scores and failures are excluded from model
feedback. The model emits complete changed application files; the original application
and evaluator files are preserved. No-op, invalid or regressing proposals do not reset
the stagnation counter. These scripts use the existing `arcbench-cli` client and the
user-owned SSH route, with credentials outside the repository.

## Checks and their limits

The fixed Ctrip probe covers 13 journeys: login/logout and negative login paths,
search/date behavior, entering booking, profile saving, contact creation/deletion and
order cancellation. It resets the app process between probe cases and observes real
Chromium interactions, visible results and state after page reloads. It does not
verify all 125 published cases or all multi-browser/shared-data behavior.

Probe validity must be checked before interpreting a failure. In the first pilot,
a valid 联系方式 label and a hover-only row action caused false failures. A separate
post-run audit retained the original results and proved that round 1 already completed
the intended business journeys. The current probe accepts those valid interactions,
scopes login submission to its form, supports bilingual labels/read-only pickers and
finds actual menu/tab/order navigation controls. These are adaptations of actions,
not permission to weaken expected business outcomes.

The first pilot's exact executed scripts and hashes remain under
`runs/business-loop-20260921/driver-v1/`; its original plan was not rewritten after the
audit. The replication uses a separately frozen, calibrated probe and a real positive
control. Do not mix versions of checks within a paired comparison.

## Independent evaluation

`business_replay.py --mode score` runs the unchanged published suite against disposable
application copies. Compare the baseline, the first repair, and the final selected
repair, recording newly passing and newly failing cases. Probe success is only a
local stopping condition; candidate promotion needs an independent gain without
losing baseline-passing behavior.

A separate bounded follow-up restores the existing `readonly_gaps` diagnostic rather
than dropping delivery/input-contract knowledge when adding business feedback. It
uses `ctrip_keyboard_contract.spec.cjs`: the 13 calibrated journeys plus a real
keyboard-entry search. Its plan enables `include_readonly_diagnostics`, has 14 checks
and caps repairs at two rounds. Earlier plans and outcomes remain unchanged.

The local container pins Node 20.19.3, Playwright 1.57.0, Chromium, one worker, one CPU,
2GB memory and UTC. Runtime metadata is read from inside the container. Model calls
run on the host; application checks run in the container. This aligns relevant runtime
versions and resource limits, but uses native ARM64 and our application replay wrapper,
not the complete official x86_64 submission lifecycle. Results remain local evidence.

The model-generated persistence changes observed in the pilot use browser localStorage.
Passing the reload journeys does not establish cross-browser account-data consistency.
Keep that limitation visible when reviewing any generated patch or considering a
production integration of this prototype.

## Requirement-aware goal experiment

The optional `goal_catalogue` plan field attaches a persistent requirement inventory
built from the supplied requirement document. Atomic requirements and folder-level
descriptions are retained separately. A passing folder observation never marks its
children as checked. Each round records observed passes, observed failures and
unverified requirements in `goal-state.json`; these are not full requirement claims.

Terminal states distinguish `scoped_checks_passed` and `coverage_incomplete` from
`stalled` and `round_limit`. Empty/duplicate evidence and application build failures
cannot establish completion. Unknown requirements remain visible to the repair model;
they are not permission for speculative unrelated rewrites. The existing strict
no-regression acceptance, rollback and transport recovery apply unchanged.

For the 2026-09-21 goal comparison, compose the frozen probe by concatenating
`ctrip_keyboard_contract.spec.cjs` and `ctrip_goal_checks.cjs`. The latter adds
registration, traveler/address/invoice flows, flight status, airport transport and
independent browser-session persistence. Both valid and invalid company tax IDs are
checked. These are opt-in experiment checks, not a general requirement compiler.

The comparison preserves the previous app, the selected app after one proposal and
the final selected app. If the first proposal is rejected, the one-proposal checkpoint
is the baseline. Evaluator scores never enter model feedback or per-round selection.
Use independent final case deltas before promoting any candidate. Parallel replay
elapsed times are measurements, not a speed benchmark.

This implements a goal workflow with the existing Flash gateway and browser tools.
It does not invoke native Codex `/goal`. mini-SWE-agent is a researched alternative:
its [DefaultAgent](https://mini-swe-agent.com/latest/reference/agents/default/) exposes
step/cost limits and saved trajectories, and its
[customization hooks](https://mini-swe-agent.com/v2/advanced/cookbook/) can support a
verifier. This pilot retains the existing controller to measure verification and
continuation changes before adding another model/environment adapter. No external
harness integration or external-harness performance result is claimed.


After the first goal pilot, a published case that failed in the complete sequence
passed on its own. The generated repair restored and saved shared state, while the
old business probe restarted the backend before every case. That isolation can hide
cross-flow state regressions. New requirement-goal plans therefore default to a
shared backend for the probe; use `business_replay.py --mode probe --shared-server`
when collecting their baseline. `shared_probe_server: false` remains an explicit
isolated diagnostic mode, not a substitute for the batch regression gate.

Runtime records include `server_lifecycle`. Before a paid repair, the controller checks
that the current application, check-source hash and server lifecycle match its saved
observations. Cached replay results cannot cross check versions or lifecycle modes.
The first pilots remain frozen under their preserved drivers; their outcomes are not
rewritten as though they used this later hardening.

`direct_transport: true` uses direct HTTPS instead of the user-owned SSH SOCKS route.
`max_transport_attempts` can lower the persistent cap from three to one, but cannot
raise it. A saved cap cannot change during resume. For the diagnosed SSH failures,
a separately recorded one-attempt continuation required the original request hash;
the prior three failures and their unknown usage remain in accounting.
