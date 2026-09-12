# Competition gap after E054

Observed September 12, 2026. The current bottleneck is reaching Ticket's 80% eligibility
threshold. Our latest 70% result costs CNY 0.787531, below the leading eligible entry's
CNY 2.407166. Lower cost alone cannot move an ineligible entry ahead of that entry.

| Board | VOLO position | VOLO result / CNY | Leader result / CNY |
| --- | ---: | --- | --- |
| Smoke | 3 | 100% / 0.016023 | 100% / 0.003099 |
| Smoke Evolution | 2 | 100% / 0.017810 | 100% / 0.004617 |
| Ticket Booking | 3 | 70% / 0.787531 | 80% / 2.407166 |

## What changed the diagnosis

The user supplied the current [Octos ARC repository](https://github.com/octos-org/octos-arc)
and [workshop tutorial](https://arc-bench-tutorial.vercel.app/). At pinned commit
`342cb7985c71a6e01c4d97cff74277b8e4926e91`, the
[adapter](https://github.com/octos-org/octos-arc/blob/342cb7985c71a6e01c4d97cff74277b8e4926e91/arc/main.py#L871)
supplies public specs and helpers to its executor before implementation. VOLO had supplied
requirements and image observations, while keeping public tests only in operator-side
diagnostic replays. That input difference can explain avoidable omissions, independently
of the relative merits of either agent kernel.

E054 demonstrates one omission directly: the reference's `账户信息` heading is absent.
The unchanged product passes 9/10 public tests locally. A disposable copy changing only
that heading passes 10/10. Neither diagnostic copy is uploaded. Previously, E051's model
also weakened its own selectors to hide duplicated username text. Self-check success was
therefore an unreliable acceptance signal.

The two latest official runs fail the same three cases: successful registration, successful
username login, and successful email login. Local replay fails only the registration
heading. Thus two official failures remain unexplained; neither the missing heading nor
the earlier logout-delay reproduction proves their cause.

The user's screenshot reports another participant experiencing local 10/10 versus official
70% on this task. This is a report of a similar symptom, without that participant's source
or execution trace. It does not establish a shared root cause.

## Environment checks and limits

The Octos [local grader](https://github.com/octos-org/octos-arc/blob/342cb7985c71a6e01c4d97cff74277b8e4926e91/arc/grade-local.py)
uses a 60-second test timeout; our actual official failures report 10 seconds. It also
installs an unpinned Playwright version. Its fresh-install branch references `env` before
assigning it. Its local result must not be treated as an exact official simulation.

Octos records a default-spec-port versus application-port mismatch and requests two
listeners. Reviewing VOLO's complete launch path confirms that its existing launcher
already proxies between 3000 and 3301. The application server alone reads `PORT`, but
that is not the complete startup path. No new port compatibility change is needed.

E055 replays E054's fixed original product with 10-second tests and four workers, once
with `fullyParallel=false` and once with `fullyParallel=true`. Both results are 9/10,
with only the heading failure. The latter setting is a hypothesis control, not a known
official setting. This does not reproduce the two official login failures.
An additional fixed-product replay uses VOLO's actual launcher, starts the server on
3000 and reaches it through the 3301 proxy. It also gives 9/10, only the heading failure.

The repository's runtime lock records an unreleased implementation and no linked
submission. We have not established that its current source and runtime are the exact
package responsible for the leading board result.

## Fresh Fable consultation and next comparison

A third tool-free Fable 5.1 advisory call used the new run evidence, screenshot summary,
and inspected source details. It completed in 56.764 seconds; CLI-reported estimated
cost is USD 0.2736, including auxiliary Haiku usage. This is separate from official
competition metering and from the deprecated playbook skill.

Adopt its recommendations to provide public specifications, avoid a separate heading
verification architecture, and prefer Flash for this comparison. Reject its suggestion
that another listener is necessarily harmless, its treatment of `fullyParallel` as a
known official parameter, and its implication that product logic is already exonerated.

Dev34 changes only the public-specification input relative to dev33. Three byte-identical
public files are bound to the observed requirement fingerprint and their SHA-256 hashes.
They survive the existing context checkpoint. No test is discovered from a runner mount,
rewritten, or treated as executed merely because the model receives it. Existing reasoning,
runtime and repair policies remain unchanged for this comparison. The abandoned heading
experiment is retained only as an ignored diagnostic patch.

The next official Flash result must establish the effect. Even a local 10/10 result would
not establish an official pass or first place.

Update after E056: the public input reached the real model request, but generation
exhausted its token guard after repeated source reads, before official testing. The
new product included the heading and had a separately observed name-validation error.
This establishes a further recovery weakness in VOLO. Dev35 reuses bounded patching
with a complete current snapshot rather than extending the verification architecture.
