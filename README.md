# VOLO Factory

A requirement-driven software agent for the GOSIM Software Factory 2026 hackathon.
The objective is repeatable correctness on new requirements and subsequent changes.
Official evaluation establishes competition performance; local checks establish only
what they actually exercise.

## Development baseline

Version **0.7.0.dev31** consolidates the prior competition agent, bounded recovery,
pinned acceptance, isolated evaluation, Pi protocol probes and the optional model-based
browser acceptance experiment. The [consolidation review](docs/harness-consolidation-2026-09-12.md)
records what was combined and how overlapping behavior was resolved.

This version has no official score. The fresh VOLO agent's best official Ticket Booking
result is E047's **6/10**; its later dev29 result is 5/10. Historical Smoke/Evolution wins,
local replays and platform failures are recorded separately in
[experiments](docs/experiments.md). Current standings come from the platform CLI.

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
mode; three consecutive truncations stop the batch. Larger prepared apps also retain their first executable failed
self-check as a repair comparison. Changing later self-checks cannot remove that failure;
this does not promote authored tests to independently verified requirements.

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

`dist/volo-factory.zip` contains only `main.py`, `requirements.txt` and `volo/` modules.
The lab, platform sessions, source applications, development tests and evidence are excluded.
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
