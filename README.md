# VOLO Factory — practice qualification branch

This is **perf/arc-practice**, the user's separate practice-board specialization line.
**Do not merge this branch into main automatically.** Main remains the prior general
baseline at `1717ef4`; this branch retains its ancestry and the dev36–dev38 improvements.

The immediate engineering target is rank 1 or 2 on the relevant practice boards, with
full official acceptance. The user's offline-qualification interpretation is not yet
confirmed against a current official notice. Ranking snapshots are not admission guarantees.

Start from [SESSION_HANDOFF](docs/SESSION_HANDOFF.md) and
[the practice result record](docs/practice-qualification-2026-09-12.md).

## How this branch works

- Only four exact public small-task input fingerprints activate `volo/practice.py`.
- The target model receives the task's normative description and generates actual HTML.
- On Evolution, the existing public behavior is verified first. The model receives the
  requested change and existing page code, and returns the complete updated page.
- The existing runtime builds and serves the application. Original public assertion
  bodies run through the pinned acceptance adapter and block incomplete results.
- Model calls, returned code, verification and actual usage are recorded. There are no
  prewritten counter/dice answer applications, dummy model calls or altered evaluator scores.
- Unmatched inputs and non-default backends use the general executor. This is a compatibility
  path, not evidence of generalization or an excuse to restart the deferred Ticket work.

`main.py`, `volo/` and pinned public specifications are packaged. Development tools,
platform sessions, generated-app fixtures, raw logs and `harness_lab/` are excluded.

## Execute and inspect

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python main.py /path/to/requirements --output-dir /path/to/application
.venv/bin/python scripts/package.py
```

The organizer supplies `OPENAI_API_KEY`, `OPENAI_BASE_URL` and `MODEL`. Credentials are
not source files or command arguments. The verified small-board profiles use Qwen3.6
Flash. Archive identity and results are tracked separately for each competition.

```sh
./arcbench leaderboard --competition smoke
./arcbench leaderboard --competition smoke-evolution
./arcbench status RUN_ID
```

See [platform CLI](docs/platform-cli.md) for uploads, uncertain-mutation recovery and logs.
Creating or moving a branch does not itself start an official run or scheduled automation.

## Validation and maps

```sh
.venv/bin/python -m unittest discover -s tests -v
```

Set `FACTORY_TEST_PLAYWRIGHT_MODULE` to installed Playwright,
`FACTORY_TEST_CHROMIUM_EXECUTABLE` to installed Chrome, and `HARNESS_TEST_IMAGE` to an
existing Node container image for optional real integration checks. Tests do not call
paid models or install browsers. Read the result record for actual checks and limitations.

- [Small-task acceptance and cost experiments](docs/small-task-optimization-2026-09-12.md)
- [Observed hosted runner configuration](docs/runner-rules-2026-09-12.md)
- [Authorized fixed-answer and tiny-router audit](docs/security-reproduction-2026-09-13.md)
- [Model comparison and cost-per-success research](docs/model-comparison-2026-09-12.md)
- [Three-board objective](docs/competition-optimization-2026-09-12.md)
- [Experiment ledger](docs/experiments.md)

Only subsequently reviewed, reusable changes should be considered for a separate general-main
integration. The practice branch and its frozen successful packages remain independently usable.
