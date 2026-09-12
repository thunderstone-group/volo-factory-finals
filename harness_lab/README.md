# Harness experiments

Reviewed 2026-09-12. This directory contains optional developer tools and is excluded
from the competition upload. It does not select the production agent or start model
requests implicitly. The uploaded optional acceptance runner is `volo/acceptance.py`.

| Entry | Purpose | Model calls | Current boundary |
|---|---|---|---|
| `python -m harness_lab.acceptance_probe` | Generate a bounded declarative browser plan from original requirements and initial page evidence | Zero by default; one attempted gateway request with `--allow-model-calls` | Diagnostic proposal; synthetic plans and real browser plumbing tested, model quality not measured |
| `python -m harness_lab.external_gate` | Evaluate an already-running app with a pinned interpreter/script and structured case evidence | None | Caller binds the URL to an isolated app and frozen source; checks themselves need calibration |
| `python -m harness_lab.evaluate` | Snapshot candidate and trusted suite, run in separate local containers | None | HTTP/isolation calibration exists; a competition-equivalent GUI suite/image is not supplied |
| `python -m harness_lab.pi_probe` | Run installed Pi against scripted loopback responses, optionally evaluate its artifact in Docker | None | Real Pi tools, synthetic model responses; no quality comparison |
| `pi_adapter.py` | Prepare an explicit, isolated Pi configuration | None during preparation | Real model execution still needs a runner with sandbox, metering and budget controls |

Detailed contracts: [model browser probe](../docs/acceptance.md),
[external process runner](../docs/external-gate.md),
[container runner and Pi protocol](../docs/verified-harness-core.md).

The process runner and container runner are retained as explicit experiments with
different contracts. Neither runs in addition to the pinned production acceptance
unless the operator invokes it. A future shared evaluator should be selected using
real GUI positive/negative controls; merely combining their APIs would not improve
our ability to judge a product.

Do not promote a model's proposed checks to authoritative tests automatically. A test
suite that accepts a known-bad app or rejects a known-good app needs correction before
it is used to rank executors. Report coverage, failures and unverified requirements.

## Completed artifact calibration

`python -m harness_lab.calibrate_logout` runs the E047-specific 0/400 ms logout
controls with original, self-check-weakened and one-label-corrected copies. See
[the measured result](../docs/logout-calibration-2026-09-12.md). It is a narrow
laboratory case, not a general product rule or an official score.
