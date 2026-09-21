# Requirement-aware goal comparison — 2026-09-21

The previous loop could stop with fourteen successful checks while much of the task
remained unobserved. This experiment adds explicit requirement coverage and calibrated
checks, then measures a one-proposal checkpoint against further goal-driven repair.
The model, gateway, immutable starting applications and independent suite are fixed.

The current controller was selected to isolate these changes. mini-SWE-agent exposes
[step/cost limits and saved trajectories](https://mini-swe-agent.com/latest/reference/agents/default/)
and [customization hooks](https://mini-swe-agent.com/v2/advanced/cookbook/), but still needs
an application-specific completion verifier. No third-party harness performance was
measured. The implementation follows the durable objective/validation idea described
in [Follow a goal](https://learn.chatgpt.com/use-cases/follow-goals); it does not invoke
native Codex goal tools inside the competition agent.

Both starts passed the previous fourteen checks and 22 of the expanded 27. The
calibrated failures concern registration followed by real login, invalid invoice tax
IDs, conditional VAT fields, and independent-session profile/contact persistence.
The inventory includes 225 requirement nodes, of which 125 are atomic; 99 atomic
requirements remain unobserved by this probe. A passing group does not cover children,
and passing every probe does not establish every scenario of the referenced requirement.

Calibration preceded model calls. The first draft of new checks had ambiguous navigation,
a traveler-label mismatch, a hidden airport menu and an unscoped registration submit;
the second version uses valid UI operations. Both baselines share that frozen version.
The existing fourteen checks still pass. Invalid invoice input has a valid-input
control, and same-browser saved-data checks accompany independent-session checks.

Each plan permits at most three repairs, with rollback on any probe regression and a
two-proposal stagnation limit. Full-suite outcomes are not passed to the model or used
for round acceptance. Preserve both the app selected after proposal one and the final
selection. If the first proposal is rejected, the first selected checkpoint is the
baseline, not the rejected proposal. Raw plans and outputs remain immutable.



## Measured outcome

| Saved app | Published baseline | After proposal one | Final selected | Gained / lost cases | Completed repair calls |
|---|---:|---:|---:|---:|---:|
| A, Ctrip-3 | 49/125 | 42/125 | 42/125 | +0 / -7 | 2 |
| B, Ctrip-2 | 48/125 | 48/125 | 48/125 | +0 / -0 | 1 |

A's first repair improved the isolated probe from 22/27 to 25/27. Its second complete
proposal stayed at 25/27 and was rolled back. B reached 27/27 in one repair. A's final
selected artifact is therefore its first repair; no separate final-score rerun was
needed for identical selected bytes. The three interrupted transport attempts below
are additional requests, not completed repair rounds.

An unchanged A baseline was independently rerun and reproduced all 49 passing cases
exactly. The A candidate loses special-passenger configuration, five booking/payment
entry paths, and historical voucher-order navigation. Reject it for promotion. B's
published pass set is identical before and after repair. This study demonstrates no
independent score improvement from the goal prototype; retain the original candidates.

## Batch-state regression and verifier correction

A lost published passenger case passes when run by itself against the candidate.
The same unchanged case fails in the full sequence. Source inspection shows that the
candidate added asynchronous restoration of every server-state key, plus saves on
render. Shared-probe failure pages show the previous workflow's user already signed
in in a fresh browser context. The change carries session/view state across workflows;
the evidence does not prove that every one of the seven lost cases has precisely the
same cause.

The old probe restarted the backend before each case. Published evaluation uses one
backend for the suite, so that isolation hid an important class of state regressions.
Post-pilot hardening adds a shared-server probe and makes it the default for new goal
plans. The baseline, candidate and positive B control use the same frozen 27 checks
and shared-server runtime. These later results are recorded separately; the paid
pilot's original outcomes and plans are unchanged.

| Shared-backend check | Passed | Interpretation |
|---|---:|---|
| Original A baseline | 22/27 | Matches its isolated baseline |
| A candidate | 14/27 | Eight baseline passes lost; current gate rejects it |
| Repaired B positive control | 27/27 | The same checks work with a correct shared-session implementation |

This is a verifier improvement, not a new score-improvement result. The original
isolated gate accepted A's 22-to-25 gain; the hardened shared gate rejects its
22-to-14 regression.

Before a new model request, the current controller now rejects observations from a
changed app, changed checks or different server lifecycle. Replay cache reuse enforces
the same boundaries. The goal inventory distinguishes observed success, observed
failure and unverified work; even green scoped checks cannot assert full requirement
verification. No new model generation was performed with the hardened shared gate.

## Transport interruption and recovery boundary

A's second repair had three incomplete SSH/SOCKS streams. All had HTTP 200/1.1, curl
exit 18, SSH exit 255 and remote-closed SSH stderr; none provided final usage. This
establishes failure of the SSH path, not a model-quality result or proof of an official
gateway defect. The original trial's persistent three-attempt cap was left intact.

A direct GET /models preflight returned HTTP 200. A separately declared continuation
allowed exactly one attempt over direct HTTPS and required the original request SHA:
`911c06dba8bad7e8e76909e144005f57f3760cb179895f00b32fc0fa590f8f40`.
It completed, preserved request bytes/model/parameters/source/feedback, and produced
the non-improving proposal described above. New retry configuration can lower the cap
to one, cannot raise it above three, and cannot alter a saved cap on resume. No global
SSH or proxy setting was changed.

There were six gateway requests: three completed and three incomplete. Confirmed
completed-call cost is CNY 1.201896, with 221,761 input and 101,858 output tokens. The
three incomplete calls have no usage receipt or conclusively matched bill; their
usage and cost remain unknown, not zero. Spending excludes earlier studies and draft
generation. Billing matches use exact model/token totals and completion time, not a
claimed direct mapping between provider and billing request IDs.

## Validation and remaining limits

Ten goal/preflight tests, seven existing loop tests and sixteen recovery tests pass.
The required legacy suite passed 214 tests with 12 skips in a dedicated Python 3.11.15
environment. Earlier environment-mismatched attempts are retained in the run folder;
the final result does not count those failed attempts as passes. Saved complete model
requests and patches passed provenance audits, and terminal resumes made no new calls.
Application changes came solely from model output; official tests were not modified.

The local runtime pins Node 20.19.3, Playwright 1.57.0, Chromium 143.0.7499.4, one CPU,
2GB, one worker and UTC. ARM64 and the replay wrapper differ from the full official
x86_64 lifecycle. Some replay jobs overlapped; elapsed time is not a speed comparison.
Two saved drafts, 27 hand-authored checks and 99 unobserved atomic requirements do not
establish fresh-draft generalization or a complete acceptance system. Shared-session
checks do not by themselves establish concurrent-write or all-user isolation behavior.

Retain the coverage and regression-control changes as an opt-in experiment. An external
harness comparison should reuse the same model, frozen app, browser checks, rollback
and accounting. Current evidence does not justify replacing the competition entrypoint
or attributing a scoring gain to longer iteration. No official run/upload, main merge,
native Codex goal or external harness integration occurred.

See [the frozen pilot receipt](../evidence/2026-09-21-requirement-goal-comparison.json),
[the later hardening receipt](../evidence/2026-09-21-requirement-goal-hardening.json), and
[execution reference](../reference/business-feedback-loop.md).
