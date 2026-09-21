# Business-feedback repair pilot — 2026-09-21

Four real DeepSeek V4 Flash repair calls were tested on two immutable Ctrip drafts.
The experiment demonstrates that additional, specific feedback can improve a saved
application, while a small self-check set can declare success far below full task
coverage. It does not establish competitors' implementation choices or a general
100% solution.

## Independent local results

All rows use the unchanged 125-case published Ctrip suite. Probe results are separate.

| Draft / stage | Baseline | After first repair | Final selected | New passes | Lost baseline passes |
|---|---:|---:|---:|---:|---:|
| Ctrip-3, business feedback | 33 | 36 | 49 after two repairs | 16 | 0 |
| Ctrip-2, calibrated business feedback | 29 | 29 | 29 after one repair | 0 | 0 |
| Ctrip-2, separate input-contract follow-up | 29 | 48 | 48 after one repair | 19 | 0 |

The last row starts from the model-produced, business-corrected Ctrip-2 checkpoint.
It is a separately declared follow-up, not a rewrite of the original comparison.
Its feedback combines our browser observations with the generator's already-existing
`readonly_gaps` diagnostic. It adds an actual keyboard-entry search check while
preserving the thirteen earlier business journeys. The prior suite review found 33
failures involving non-editable inputs; the failed-case list and evaluator code were
not passed to the repair model. The new diagnostic comes from source inspection and
our separately frozen keyboard interaction.

## What the goal-style loop actually did

The controller repeatedly repairs the current accepted application until all frozen
probe journeys pass, two proposals fail to make accepted progress, or the round cap
is reached. Acceptance requires a strict probe gain without losing a previously
successful probe. Transport attempts have their own persistent cap and exact-request
checks. Published-suite outcomes are not part of model feedback or per-round selection.
The main pilots allowed six repairs; the focused follow-up allowed two. They actually
used two, one and one repairs respectively, without transport retries.

This implements the useful part of the [goal workflow](https://learn.chatgpt.com/use-cases/follow-goals):
a durable objective, externally checked progress and explicit stopping conditions.
It does not invoke Codex's native goal tool inside the submitted agent.

## Calibration and interpretation

The original first pilot probe reported 8/13, 11/13, then 13/13. A post-run audit
found that its contact-phone label was too narrow and its deletion action did not
hover/scope the contact row. With valid equivalent UI operations the sequence is
8/13, 13/13, 13/13. The first model request's feedback is byte-equivalent under the
corrected baseline audit, but the second call was partly driven by probe mismatch.
That second call normalized the contact label, exposed row controls and adjusted
contact deletion; it nevertheless added thirteen real published-suite passes.
Do not relabel those as two newly implemented business capabilities.

The second draft used a separately frozen calibrated probe, accepting legitimate
bilingual labels, picker entry, scoped form submission and menu/tab/order-link roles.
Its real positive control was the first pilot's final application. It improved from
10/13 to 13/13, fixing profile edit routing and same-browser persistence, yet its
published-suite score remained 29/125. A complete result on thirteen hand-selected
journeys is not complete coverage of the application.

The fourteen-check follow-up has both a positive control (14/14) and the failing
keyboard baseline (13/14). Its model patch removes read-only restrictions, adds field
names/change handlers and reads typed form values into the actual search state. All
thirteen existing business checks were preserved.

The original executed drivers and probes remain under each run's `driver-v*` snapshot.
`tests_oneshot/fixtures/business_probe_v1.cjs` preserves the first executed probe for
review. Plans and original result records were not rewritten after calibration.

## Environment, provenance and cost

The app/evaluation containers were measured at Node 20.19.3, Playwright 1.57.0,
Chromium 143.0.7499.4, one CPU, 2GB, one worker and UTC. These are local ARM64 containers
with our app-replay wrapper, not the full official x86_64 submission lifecycle.
The same runtime and unchanged suite were used within each paired comparison.
Model inference runs on the host through the authorized gateway.

Every saved model request was reconstructed from the requirements, accepted source
and declared diagnostic inputs. Every app snapshot matches the model's complete-file
patch applied to its predecessor. Frozen requirements, drafts, checks and public
suite sources were checked separately. Codex did not hand-edit the applications.

Actual repair spending: **CNY 1.675812**, four completed calls, **254,737 input /
131,645 output tokens**, no unknown usage or unmatched bills. These amounts exclude
historical draft generation and are not an end-to-end competitor cost comparison.
The model-request elapsed time totals about 13.7 minutes; deployment, probe and full
suite times are recorded separately. Full single-worker replays are much slower when
many cases consume their ten-second timeout.

Control tests: seven passed. Required legacy suite: 214 passed and 12 skipped.
The evidence receipt includes sources, case deltas, parameters, matched bills and
idempotent terminal-resume checks. No official run/upload, ranking update, main merge
or default-agent replacement was performed.

## What can be inferred from the leaderboard

The earlier official leaderboard snapshot shows nontrivial Lite 100% entries around
33–114 minutes; VOLO's displayed average was 12.7 minutes. Web 99.5% entries showed
about 3.6 and 6.3 hours, versus VOLO's 18.9 minutes. These are displayed aggregate
runtimes, not exposed model-call traces. They support investigating a larger iteration
budget but cannot establish the number of turns or use of a particular goal feature.

## Decision and practical limit

Retain the loop and calibrated feedback combination for further controlled work: the two saved drafts ultimately gain 16 and 19 published cases respectively, with no baseline losses. The business-only replication was neutral, so the evidence supports combining useful feedback sources and continuing when meaningful requirements remain, not merely raising the iteration count. This is not ready to replace the default competition agent: broader requirement coverage and independent fresh drafts remain unverified.

The important next design constraint is to preserve delivery/interaction-contract
knowledge while adding business verification, and to distinguish unverified
requirements from a finished application. Increasing a round limit alone cannot
repair failures that the feedback never observes. Probe operations must remain valid
for the actual UI and should not force cosmetic application changes unnecessarily.
The generated persistence patches use localStorage; multi-browser account-data
consistency was not verified and must not be inferred from same-browser reload tests.

See [the evidence receipt](../evidence/2026-09-21-business-feedback-pilot.json) and
[the execution reference](../reference/business-feedback-loop.md).
