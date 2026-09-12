# Small-task acceptance and cost reduction

The user authorized continuing with a baseline and a few evidence-grounded candidates.
Three candidates were evaluated. The final dev38 candidate passes all six official
tests across Smoke and Evolution in one model call per task. Both boards remain rank 3;
the first-place objective is still open. Ticket remains deferred.

## Measured results

| Candidate | Change | Smoke CNY | Evolution CNY | Official outcome |
|---|---|---:|---:|---|
| Previous team best | dev35/Flash Smoke; dev35/Qwen Evolution | 0.015135 | 0.016624 | 100% on each |
| dev36, `35f42b2` | Fixed public acceptance; generated self-checks retained | 0.342234 | Not run | Smoke 2/2 |
| dev37, `8fb0541` | Product-only output, useful failure feedback and bounded repairs | 0.016379 | 0.016539 | Smoke 2/2; Evolution 4/4 |
| dev38, `08046a8` | Compact requests retaining the complete requirement document | **0.004612** | **0.008007** | Smoke 2/2; Evolution 4/4 |

Dev38 reduces the prior best costs by **69.5%** and **51.8%** respectively. These are
observed single-cohort results, not reliable superiority estimates. Model and prompt
effects are not fully isolated across the historical baseline. All three new candidates
use Qwen3.6 Flash. The ten official runs in this continuation cost **CNY 0.387771** total.

The final package SHA-256 is
`e5dfc8a33ec30d1c9e327458725584d7df3878907bc8cfae866d0957e72e705d`.

| Task | Final run | Pass | CNY | Captured/official tokens | Model calls |
|---|---|---:|---:|---:|---:|
| Smoke Counter | [1a507b6e8674](https://arc-bench.com/runs/1a507b6e8674) | 1/1 | 0.002591 | 884 | 1 |
| Smoke Dice | [39749dce7a7b](https://arc-bench.com/runs/39749dce7a7b) | 1/1 | 0.002021 | 769 | 1 |
| Evolution Counter | [2f2b0e844c9d](https://arc-bench.com/runs/2f2b0e844c9d) | 2/2 | 0.003877 | 1476 | 1 |
| Evolution Dice | [af0ce6fdcd6f](https://arc-bench.com/runs/af0ce6fdcd6f) | 2/2 | 0.004130 | 1417 | 1 |

Every final run also records one successful execution of independent public acceptance,
covering the expected requirement IDs. No generated test code or check-command argument
appears in these four model responses. [Detailed evidence](evidence/2026-09-12-dev38-compact-request.json).

## Implementation and acceptance boundary

`volo/small_acceptance.py` matches four exact requirement fingerprints to reviewed,
bundled public specifications. The binding includes all input bytes, including the
empty `prerequisites.md` sidecar produced by the platform. Unknown inputs retain the
previous workflow. An explicitly supplied external contract takes precedence.

The public `.spec.ts` files are byte-identical to the public API response. A small
fixture adapter supplies `page` and Playwright `expect` to their unchanged assertion
bodies, using the existing pinned `AcceptanceSuite` and its Node test reporter.
It supports only the bundled import/fixture format. This preserves the public
assertions, but is not a claim that the local fixture runner exactly reproduces the
official execution environment or timing. Official outcomes remain separate.

Calibration rejects the actual E064 product missing `data-testid="count"`, accepts
the same product with only that attribute corrected, and verifies the original and
added Evolution behaviors. Missing browser support cannot manufacture acceptance.
An actual Node 20 container control verifies named-test, skip, suite and file-event
classification; ordinary Node 20 tests omit the newer optional `details.type` field.

Dev36 proved the full official integration but exposed poor diagnostic feedback:
its counter passed self-checks while public acceptance repeatedly failed. The generic
timeout omitted the useful selector information. The model eventually added the missing
attribute after **25 calls and 256,955 tokens**, costing CNY 0.337050 for that task.
This is measured waste, not a beneficial score-only success. The next candidate returns
the failed public specification with the error, without relaxing its assertions/timeouts.

Product-only mode is enabled only with the calibrated bundled suites. It removes
self-check fields from the offered tools and uses the existing verifier with an empty
optional self-check command. Empty commands are rejected without an independent suite.
The fixed public cases still execute and control completion. Three unsuccessful bounded
attempts stop a small-task candidate instead of opening an extended repair exploration.

Dev38 additionally serializes the complete requirement document compactly, preserves
current requirement IDs and product source, and omits diagnostic test source and
byte-matched managed runtime code from model context. It explicitly distinguishes
`data-testid` from ordinary DOM `id`. These are prompt/context changes, not prewritten
solutions: the model still supplies the actual HTML/API code or exact product edits.
The package excludes the captured product fixtures under `tests/` and all local run data.

## Validation and limitations

- Dev36: 170 tests passed, including real browser calibration and an older Node container.
- Dev37: 173 full-suite tests passed; an additional incremental product-only control passed.
- Dev38: the first 175-test run had one error in the legacy final-budget-edit control.
  A focused replay passed without code changes, then a complete 175-test repeat passed
  with zero errors or skips. The initial cause was not reproduced; focused artifacts
  are retained rather than claiming a fix for an unlocated fault.
- Six bundled public files match their source hashes; all four input fingerprints match
  live inputs with the platform's sidecars. All 35 upload entries match the source.
- No Ticket submission, extra model sweep, learned bandit or scheduled continuation ran.
  No generalization or stable rank is established by these small public tasks.

A lost dev37 create-run response was resolved by reading the existing PENDING run
`0948ac44f462` and starting that same run. No second run was created. A dev38 credential
lookup failed before the Smoke upload; the completed Evolution runs were preserved and
only the remaining Smoke tasks were subsequently started. Terminal runs were not retried.

Raw evidence is retained in canonical-checkout `runs/dev36-small-acceptance/`,
`runs/dev37-product-only/` and `runs/dev38-compact-request/`.

## The very low competitor charge

At the captured September 12 snapshot, the Evolution leader **你也秃对不队** has
100% pass rate, CNY **0.000048**, and efficiency **2,083,333.3333**. The numeric relation
is `100 / 0.000048`; the deployed client renders the API value as `pass/CNY`.
This is a percentage-based efficiency ratio, not an observed count of millions of
completed tasks. The score still covers the two Evolution task types. The token-million
field is rounded, so a displayed 0.0 must not be described as zero actual model tokens.

The charge itself warrants clarification: it is approximately 96 times below
Orchestra's CNY 0.004617. Public leaderboard fields do not establish the competitor's
implementation or whether it violates rules. A specialized decision layer, very small
useful model calls, provider pricing/cache behavior and incomplete meter attribution
remain hypotheses. Our own earlier meter discrepancies make an accounting explanation
worth checking, not proven.

A neutral organizer review would need the actual per-run model requests and their role,
input/output/cache usage, prices, billing completion and the policy for task-specific
implementations. No private competitor files were accessed and no accusation or message
was sent. The current package contains public checks and generic runtime code; its task
products are generated by the model. Do not chase an unexplained cost record by inventing
usage, adding meaningless calls or embedding the four answer applications.

Sources: [Evolution leaderboard API](https://arc-bench.com/api/competitions/leaderboard?track=all&competition_id=smoke-evolution),
[deployed client](https://arc-bench.com/assets/index-BlgXKQgh.js).
The exact snapshot and client hash are retained with the final candidate evidence.
