# ARC optimization loop — 2026-09-19

This report defines the controller for the next ARC tuning rounds. It is a
local decision rule over sanitized evidence; it does not start platform runs or
infer a score from a model response.

## Loop

1. Freeze the parent candidate and record two independent Web/Lite samples.
2. Attribute failures to a family using the real downloaded bundle or a local
   replay. A family is a repeated mechanism, not a list of test names.
3. Select exactly one carrier for the next change: gate, scaffold primitive,
   requirement table/planner, then prose only as a last resort.
4. Run local build, syntax, DOM and action-outcome checks. A failed local gate
   cannot consume a platform run.
5. Run two independent candidate samples. The controller requires both samples,
   rejects delivery/protocol failures, limits regressions in non-target tasks,
   and requires a target-task gain above the noise guard.
6. Keep the candidate only when the controller says `keep`; otherwise retain the
   parent and choose one next family from the measured failures.

The first target pair is 12306 and Ctrip because they account for about 72% of
the r27 failed cases while representing only two of the six tasks. The first
implementation experiment should validate action outcomes after navigation and
form actions, then add a short requirement plan for those two tasks.

The action-outcome gate has now been replayed against the immutable Lite Bookstack
bundle `832aea526d315d3006df2edecb3ffe51f45d813afd753d0e4f790e95cb7de9ee`.
It reported six `Edit` route-no-op cases, matching the independently observed
`shelvesScreen` dispatch defect. The sanitized receipt is in
`docs/evidence/2026-09-19-action-outcome-gate.json`.

## Evidence schema

The CLI consumes a JSON object with `round_id`, `change_id`, two or more
`samples`, and a `local_gate` object. Each sample contains all six tasks with
`passed`, `total`, `delivered`, `status`, and optional `failures` counts. The
controller reports task-equal mean, pooled mean, lower-sample rate, per-task
deltas, delivery failures, and one next action.

The rule is intentionally conservative: a single high sample cannot promote a
change, a protocol failure is never traded for score, and a large target gain
cannot hide a regression in Bookstack, Keep, StackOverflow or Prestashop.

## First-round acceptance

- two independent samples exist for the candidate and baseline;
- local action-outcome and delivery gates pass;
- no task has a delivery/protocol failure;
- target-task mean improves by at least three percentage points;
- no non-target task drops by more than three points;
- the lower candidate sample is within two points of the lower baseline sample.

These are development guards, not official claims. Platform scores remain
separate evidence and must retain their run IDs and package hash.
