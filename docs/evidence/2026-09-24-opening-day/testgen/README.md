# Flash-written acceptance tests (prototype, not in the package)

- `testgen_proto.py REQUIREMENTS_YAML OUT_DIR`: one flash call writes `fixtures.cjs` (state built through the UI),
  then one call per top-level requirement folder writes `REQ-n.spec.cjs`, one test per ATOMIC scenario.
  Imports `main.py`/`scenarios.py` from `~/projects/volo-factory/oneshot`; key from `ARC_BENCH_API_KEY` in
  `~/.config/arcbench/volo.env`. Sheet cost CNY 2.41 for the five spec calls (fixtures reused).
- `run_suite.sh TESTDIR BASEURL OUT.json`: Playwright 1.57 runner, 1 worker, 15 s tests, 5 s actions, clipboard
  permissions. Its paths point at the 09-24 session scratchpad (`pwt/` holds `npm i @playwright/test@1.57.0`); edit
  `SP` before reuse.
- `sheet-tests/`: the 48 Sheet tests; `fixtures.cjs` carries one manual fix (the generated `chooseOption` used an
  undefined `page`, which failed 12 tests with ReferenceError).
- Calibration against hidden results on submission 2's Sheet app (hidden 42/100): every requirement where these
  tests failed on an application defect also has hidden failures (exact tab name, missing `Edit A1` inline editor,
  paste, absolute references). With the fixture fixed, every REQ-5 test fails on native `<select>` options that a
  click cannot reach, or on the same option name in three selects (strict mode) — the evidence behind PR #67.
