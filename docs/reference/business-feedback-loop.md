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

Use Python 3.11.15 and the preserved experiment plans:

```sh
uv run --no-project --python 3.11.15 python scripts/business_loop.py \
  --run-dir runs/business-loop-input-contract-20260921
```

All three saved runs are complete; this command reports terminal state without making
another model call. The current scripts match the input-contract plan. Earlier plans
must use their preserved `driver-v1/` or `driver-v2/` scripts because the hash guard
intentionally rejects later driver versions.

Each plan pins source/check/driver hashes, requirements and the baseline probe. The
main pilots allow six completed repairs; the input-contract follow-up allows two.
Two consecutive non-improving proposals are the stagnation limit.
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
