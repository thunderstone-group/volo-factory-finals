# ADR 0001 — Optimisation doctrine: push know-how down the carrier ladder

Date: 2026-09-18. Status: accepted (owner, 12:47).

## Context
The formal round (09-21) runs the generator unattended on the organizer's gateway with flash-class
models. Score gains on 09-18 came almost entirely from deterministic gates, while the same rules as
prose were violated repeatedly. Sample variance (±13 tests per task) dominates rule effects.

## Decision
Every failure family is addressed at the lowest carrier that can hold it, in this order: gate (code
check + bounded repair) → scaffold primitive shipped with the package → table computed from the
requirement and prepended to the prompt → prose rule in the card. A prose rule is the last resort, not
the first. New candidates are judged by paired six-task samples, never one sample; a swing inside ±3
tests on one task is noise.

## Consequences
The card stops growing; the package gains a scaffold directory and a planning/table stage. Rules that are
task-shaped (six public tasks) are ablated (`exp/generic-card`) rather than kept on faith. Logic faults
that no carrier reaches are accepted as the tail.
