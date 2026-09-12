# VOLO Factory

A requirement-driven software agent for the GOSIM Software Factory 2026 hackathon.
The objective is repeatable correctness on new requirements and subsequent changes.
Official evaluation establishes competition performance; local checks establish only
what they actually exercise.

## Practice qualification branch

This branch is reserved for the user's practice-board top-two objective. It starts
from the measured dev38 small-task improvements and may deliberately specialize the
published small-task execution path. Keep these changes on `perf/arc-practice`; do
not merge them into `main` automatically. Main remains the prior general baseline.
The offline qualification rule is user-reported and is being checked separately.

[Dev38 results and acceptance boundary](docs/small-task-optimization-2026-09-12.md)
record 100% on both small boards with lower cost, but rank 3. Models still generate
product code; public tests and truthful provider usage remain the evaluation boundary.

## General baseline

Version **0.7.0.dev35** is the latest consolidated agent. Its E057 official Ticket Booking
run scored **9/10**, **CNY 0.668715**, **212 seconds**, and reached **rank 1** in the
September 12, 18:08 Taipei snapshot. One registration test still times out. The new
bounded repair branch did not execute in that run, so its model convergence remains
unverified. The [competition review](docs/competition-gap-2026-09-12.md) separates
the observed result, comparisons and remaining limitations.

Start a continuation from [SESSION_HANDOFF](docs/SESSION_HANDOFF.md). Current standings
come from the platform CLI; [experiments](docs/experiments.md) preserves dated results.
The earlier [consolidation review](docs/harness-consolidation-2026-09-12.md) records how
the prior runtime, explicit acceptance and optional lab tools were integrated.

## Repository map

| Location | Responsibility |
|---|---|
| `main.py`, `volo/` | Uploaded agent: requirements, model transport, execution, recovery and optional pinned acceptance |
| `harness_lab/` | Development experiments: isolated verifier, generic external runner, Pi adapter and model-generated browser probes; excluded from uploads |
| `arcbench`, `arcbench_cli.py` | Authenticated platform operations; excluded from uploads |
| `scripts/package.py` | Deterministic upload archive |
| `scripts/evaluate_candidate.py` | Run a supplied pinned Node acceptance suite against an existing local application, without model calls |
| `tests/` | Transport, recovery, HTTP, browser and evaluator regressions |
| `docs/experiments.md`, `docs/evidence/` | Dated results and source-bound evidence, not live state |

`AGENTS.md` maps development work. Keep the main checkout on `main`; create each new
branch in `../volo-factory-worktrees/` from current `main`, and merge through a PR.

## Run the competition agent

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python main.py /path/to/requirements --output-dir /path/to/application
```

Real generation requires the organizer-provided `OPENAI_API_KEY`, `OPENAI_BASE_URL`
and `MODEL`. Credentials never belong in source or command arguments. Use `--inspect`
to inspect requirements without model calls. See `main.py --help` for execution limits.

The agent schedules dependency-ordered requirements, observes supported image references,
builds and starts the application, executes behavioral checks and repairs from actual
failures. Small applications reuse a generic Node runtime; product logic and assertions
are model-generated. A truncated response executes no tools and releases forced-bundle
mode; three consecutive truncations stop the batch. Larger prepared apps retain named self-check cases that failed with locator ambiguity
as repair comparisons. Changing later selectors cannot remove those captured failures;
unrelated assertions can receive legitimate waits. These checks remain model-authored
and do not certify independent coverage. Small tasks disable thinking; larger DeepSeek
batches explicitly use low effort with the provider-compatible tool-call format.

Self-check success is reported in `self_checked_requirements`. Independent acceptance
requires an explicitly supplied, reviewed manifest:

```sh
.venv/bin/python main.py /path/to/requirements --output-dir /path/to/application \
  --acceptance-contract /absolute/separate-suite/contract.json
```

The [pinned acceptance contract](docs/evidence-gated-harness.md) uses executable tests,
not a second model. Missing coverage, altered tests and broken evaluators cannot certify
completion. Without a manifest, `verified_requirements` stays empty and
`independent_acceptance` is `not_configured`. Even a supplied suite proves only its
calibrated cases; official evaluation remains separate.

## Validate and package

```sh
.venv/bin/python -m unittest discover -s tests -v
.venv/bin/python scripts/package.py
```

To exercise optional integration checks, set `FACTORY_TEST_PLAYWRIGHT_MODULE` to an
installed Playwright package, `FACTORY_TEST_CHROMIUM_EXECUTABLE` to installed Chrome,
and `HARNESS_TEST_IMAGE` to an existing local Node/Python Docker image. Missing optional
tooling is reported as skipped. No test downloads a browser or calls a paid model.
The separate `python -m harness_lab.pi_probe` command exercises an installed Pi with
scripted loopback responses; see the [lab map](harness_lab/README.md).

`dist/volo-factory.zip` contains `main.py`, `requirements.txt`, `volo/` modules and
hash-pinned public specifications used as model input. The lab, platform sessions,
generated applications, development regression tests and raw evidence are excluded.
Run model-generated code in a suitable disposable sandbox; path guards and evaluator
hashes are not an operating-system sandbox.

## Platform and research

Use [the platform CLI](docs/platform-cli.md) for uploads, statuses, logs and standings:

```sh
./arcbench leaderboard --competition ticket-booking --task ticket-booking
./arcbench status RUN_ID
```

Model calls and official submissions are separate experiment decisions; merging this
baseline does not start them. The [current architecture proposal](docs/harness-design-2026-09-12.md)
compares Octos/ARC adapter, Pi, mini-SWE-agent, OpenHands and Harbor at pinned revisions.
It distinguishes proven local behavior, research findings and untested proposals.
