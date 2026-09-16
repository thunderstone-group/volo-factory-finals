# One-shot Evolution and CLI diagnostics — 2026-09-16

The Evolution entrypoint compatibility defect is fixed. The candidate now reads and
extends the supplied application in a staged copy, with source/metadata change detection,
rollback and preservation of untouched files. This is an engineering result: the new
local samples still fail the small-board quality gate, so no Lite or official run was started.

## Delivered changes

- `oneshot/main.py`: the platform's prepopulated output directory is an explicit template
  input to generation. An optional `--template-dir` supports separate immutable input.
  The ordinary Python new-build API still rejects nonempty output. Source snapshots
  are bounded, with no silent truncation. No-op/path-alias updates fail; original files
  remain untouched on generation/validation failure. Opaque local files are copied but
  never sent to the model or editable by generated blocks. Source and opaque metadata
  mutations during generation abort publication. See `oneshot.md` for rename/recovery limits.
- `oneshot/dialect.md`: general semantic indicator, heading and singular identity guidance.
  The state contract distinguishes transient visitor state from shared domain data.
  These prompt changes did not establish a quality improvement in this sample.
- `scripts/arc_read.py`: read-only preflight retry helper records every subprocess attempt,
  including exit code, stdout/stderr, timeout, error class and duration. Redaction preserves
  numeric token counts; output truncation is explicit. It cannot retry write commands.
- The separate platform CLI PR [#7](https://github.com/thunderstone-group/arcbench-cli/pull/7)
  is merged as `389e1a4` and installed as `arcbench 0.3.1`. Request diagnostics use
  `--log-file PATH`; errors/progress go to stderr and JSON results remain on stdout.
  A real installed-entrypoint meter login/balance/freshness sequence succeeded. The
  previous query failure was not reproduced; its original cause remains unknown.
  Draft CLI PR #6 (launch preflight hardening) is separate and remains unmerged.

## Candidate identities and local behavior

| Candidate | Evidence | Local result |
|---|---|---|
| `778f2ec1` (previous session) | Smoke counter and dice | 1/1 each; reused evidence, no fresh Smoke generation here |
| `778f2ec1` (previously generated) | Ticket, behavior evaluated in this session | 5/10 |
| `07063031` | Fresh Evolution counter | 1/2 |
| `07063031` | Fresh Evolution dice | 2/2 |
| `07063031` | Fresh Ticket | 5/10 |
| `cf96d99b` | One follow-up Evolution counter after state-contract correction | 1/2 |

The table is a development history, not a single fixed-package 10/16 result. No new
best sample, repeatability or official score is claimed. All applications were generated
by the candidate; none was manually patched before acceptance. The original templates
and downloaded official tests retained their byte hashes. Model input contained supplied
requirements, dialect and template source, not evaluator tests.

Local acceptance used unmodified downloaded Playwright 1.57.0 tests, installed Chrome,
1 worker, 10-second test/expect timeouts, no retries, trace/video off, isolated application
copies and credential-free child environments. Each app built and passed the exact health
contract before behavior testing. This is a macOS host replay, not a cloud runner result.

Failures:

- Counter retains the supplied app's globally shared backend count. Its later test reaches
  the count assertion before Reset with a noninitial value. Both independent updates failed
  this test; adding a general state-scoping instruction alone did not remove the inherited
  design. This is an application/state failure, not another entrypoint failure.
- Ticket's first sample duplicated standalone usernames; the second renders the username
  only inside a prefixed label, which still fails the exact-text contract. Both also lack
  the expected `账户信息` heading. That text is absent from the supplied YAML; the input
  references optional images but this local input directory contains no image files.
  The package reads YAML only. The new semantic meter is present, but the earlier heading
  assertion prevents the successful-registration test reaching that check.
- Because this gate is not satisfied, do not promote to Lite or replace a board row on
  the strength of offline regression results. A further quality change should address
  inherited state and explicit public input/acceptance mismatches, not add a repair loop
  or retry the same candidate blindly.

## Final package and verification

Final ZIP SHA-256:
`8e59406c7960f4301d51c7f20978e0cf58bdd5bc22a6aedfce0174a5c183d007`.

The last changes after `cf96d99b` only add metadata mutation detection and early template
validation. A deterministic replay through the extracted final ZIP used the real captured
counter response: its complete model prompt and output application bytes matched the
`cf96d99b` run exactly. That replay made zero network/model calls and is not an independent
sample. Final-package manifest hashes bind all three allowlisted source files.

- Final one-shot/preflight suites: 41 tests passed, no skips in the selected offline suites.
- Frozen legacy suite: 226 executed, 214 passed and 12 skipped; no new legacy changes.
- CLI: 107 tests passed. Installed module bytes matched CLI main; live JSONL mode was 0600
  and the configured credential scan was clean.
- The previously sandbox-denied synthetic loopback one-shot test was not rerun. It is not
  counted above. Actual paid generation and browser acceptance are separate evidence.

## Spend and retained evidence

This session made 4 model requests, each one call with no transport retry or continuation.
Reported usage totals: 17,067 prompt tokens + 105,836 completion tokens = 122,903 tokens.
Observed settled balance: CNY 64.545694 to 63.541969, a decrease of **CNY 1.003725**.
Including the previous batch, the decrease from 65.819143 is CNY 2.277174, below its CNY 5
between-task guard. The guard is not an in-request monetary cap. Pending billing was zero.
No official run, upload, cancellation or paid Lite work was performed in this session.

Raw local evidence under the canonical checkout (Git ignored):

- `runs/20260916-oneshot-smallboards-778f2ec1/`: original generation and new Ticket evaluation.
- `runs/20260916-oneshot-evolution-07063031/`: first three fresh generations, evaluations,
  captured preflights, CLI installed-entrypoint logs and regression output.
- `runs/20260916-oneshot-state-cf96d99b/`: bounded counter follow-up, evaluation, final
  regression log, and `final-package/recorded-response-replay.json` with the packaged artifact.

These directories retain requirements/tests, source/ZIP hashes, raw model traces, known
usage, settled balances and individual failures. The final candidate remains an unproven
quality candidate; the usable delivery here is the repaired CLI and Evolution runtime.
