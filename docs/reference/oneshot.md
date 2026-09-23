# One-shot candidate inside VOLO

Last reviewed: 2026-09-23.

`volo-factory` is the only main ARC project. `oneshot/` is its active one-shot candidate;
`oneshot-lab/arc-package` is the preserved source experiment, not a second active project.
The original three source hashes and Git head are in `oneshot/source_manifest.json`.

## Build and verify

```sh
.venv/bin/python scripts/package_oneshot.py
.venv/bin/python -m unittest discover -s tests_oneshot -v
```

The default artifact is `oneshot/dist/oneshot.zip`, with a sibling `.zip.manifest.json`.
The root allowlist is `main.py`, `dialect.md`, `requirements.txt`, `semantic_probe.cjs`, and the scenario
self-check files `scenarios.py`, `scenario_check.py` and `scenario_check.cjs`;
regular scaffold files are packaged under `scaffold/`.
Timestamps, order, permissions and uncompressed ZIP encoding are fixed. The external
manifest binds every current source file to the ZIP hash and retains import provenance.
Neither forum tools nor platform sessions, test fixtures, or run evidence are packaged.

Run the extracted entrypoint as `python3 main.py REQUIREMENT_DIR --output-dir EMPTY_DIR --type web`.
Real generation uses the authorized gateway environment, never credentials in arguments.
The platform's Evolution invocation may prepopulate OUTPUT_DIR with an existing application.
The CLI recognizes a source template containing frontend/backend package manifests and supplies
its bounded source snapshot to the same one-shot call. For a separate immutable input, use
`--template-dir EXISTING_APP --output-dir EMPTY_DIR`. The Python `generate()` API retains its
empty-output default unless `template=` is supplied explicitly.

## Boundaries

Paths must be relative and resolve within the output tree. Generation is staged and the
validated new-build directory is published by one rename. New builds reject nonempty output
unless the CLI recognizes an application template.
Evolution starts from an isolated copy, emits complete replacements for changed/new files,
and retains unmentioned files. The prompt excludes dotfiles, node_modules, dist and Python
caches; these remain preserved in the delivered tree and cannot be edited by the response.
Source snapshots are bounded to 256 files / 2 MiB with explicit failure instead of truncation.
Symlinks in source are rejected; ignored metadata is copied without following links.
Source or local metadata changes during generation abort publication. No-op upgrades are rejected after path
normalization. In-place publication uses two renames with rollback, not an atomic directory
exchange: a process kill between renames may leave the original at a sibling
`.oneshot-backup-*` path. A failed rollback leaves that backup outside temporary cleanup.
Gateway redirects are refused.
The budget permits three completed calls and at most five failed transport attempts; failures do
not consume a completed-call slot. Generation and repair streams each make at most three attempts before a
different configured fallback may be selected. Kimi K2.7 Code stays on its selected model and uses
the provider-required temperature 1.0. Other current model settings are unchanged.
Permanent HTTP failures (including 402) are not retried. Observed token usage is accumulated
across all attempts; incomplete usage remains unknown and is not reported as zero cost.
True prompts, responses, usage and timings are logged with the key redacted.
During generation, the owned temporary staging directory also holds `progress.json`: phase,
request hash, byte/event counts and output/reasoning character counts. It contains no prompts,
response text or credentials and is removed with the temporary directory after completion.
Missing delivery files or malformed output fail nonzero. There is no model backfill loop.

The delivery check validates manifests, scripts, the backend entry file, nonempty HTML and
the zero-dependency application contract. With Node/npm available, it builds the frontend,
starts the backend, checks health and assets, and executes a jsdom crash probe. Requirements
with explicit UI declarations also receive a deterministic Chromium diagnostic: declared home
controls, accessible roles, dialog action ambiguity, editor scope and native checkbox behavior.
It supplies observations to the bounded repair flow; no model-generated test or planning call is
added. If an accepted repair exposes remaining runtime problems, a remaining call within the same
three-call global cap can address them. A regressing follow-up restores the previous accepted stage.
Each repair and whether its browser check actually executed are retained in the trace.
Missing browser infrastructure is reported separately and cannot approve a previously observed
repair. These checks are diagnostic; only the unchanged acceptance suite establishes test scores.

The browser helper uses Playwright 1.57.0. It reuses a reachable Node package and browser cache,
or installs the pinned package and headless Chromium into runtime caches with bounded waits.
`NODE_PATH` and `PLAYWRIGHT_BROWSERS_PATH` may supply existing installations. Generated apps still
receive no gateway credentials. The root `main.py` / `volo/` remain frozen legacy components.

## Scenario self-check

`oneshot/scenario_check.py` executes the requirements' own GIVEN/WHEN/THEN scenarios against a built
application in Chromium and reports `pass`, `fail`, `unparsed` or `error` per ATOMIC scenario, with one
observation sentence (screen hash, h1/h2, expected role and name, matches found). It ships in the
package; `main.py` does not call it yet. It reads only the requirements and the application, never
evaluator tests, and calls no model.

```sh
python oneshot/scenario_check.py --requirements requirements.yaml --app APP_DIR --out result.json [--port N]
python scripts/calibrate_scenarios.py --requirements requirements.yaml REPLAY_DIR... [--jobs 4] [--out summary.json]
```

The result is `{"scenarios": [{"id", "name", "status", "observation", "steps"}], "invariants": [...],
"coverage": {"total", "parsed"}, "seconds"}`; a requirement with several scenarios gets ids `REQ-x`,
`REQ-x#2`, ... `invariants` holds a main-heading check (after activating a link named like a seeded
entity, the new screen's h1 or main heading contains that name) and every distinct uncaught page error.

- **Parser** (`oneshot/scenarios.py`, standard library only): a YAML subset checked against PyYAML on
  the Lite and large-task requirement files. Names come from backticks, or double quotes when a sentence
  has none. Parsed WHEN shapes: open the application URL; activate / click / press / select a named
  control (role words such as `link or button`, `button`, `tab`, `checkbox`; `unique`; scopes `in the
  top navigation bar`, ``inside the `X` ``); enter / fill a named field with a value; check or uncheck;
  select an option; press a key; hover; `The system ...` waits. THEN shapes: a (visible / exactly one /
  unique) heading, region, form, button, link, entry or text named X, optionally in a named region or
  list; `X is absent`; `keeps X unchanged`; `changes the control to X with aria-pressed=true`;
  `headings or named regions matching A, B and C`. Any clause outside these shapes, or a quoted name no
  shape consumes, makes the whole scenario `unparsed`.
- **GIVEN**: the dependency chain runs first (prerequisites' WHEN steps only, one path when a
  requirement lists alternatives, preferring the one reaching the requirement's seed kind), then the
  scenario's own WHEN, then only its own THEN is asserted. A prerequisite activation of a sibling
  entity (`Shelf 4.2.1`) uses the requirement's own seed of that kind (`Shelf 4.4.1`). A GIVEN page
  the chain does not reach is entered with the opening activations of a same-folder sibling with the
  same dependencies (`on the shelf creation page` -> `New Shelf`); `logged in` prepends the requirement
  that logs in; `a non-homepage page` adds a navigation activation; `on the homepage` in a THEN first
  performs the requirement that returns home. Other GIVEN states are `unparsed`.
- **Locators**: role + exact name, role + name substring, label, placeholder, text; `unique` requires
  exactly one visible element at the first rung that finds any; waits are 2.5 s per action or expectation.
- **Isolation**: `frontend/` and `backend/` are copied to a scratch directory (dependencies linked,
  never written) and built once; a pristine copy is kept. Every scenario gets a new browser context
  and a backend started fresh on its own free port with a private TMPDIR; afterwards the backend's
  process group and descendants are stopped and every file created, changed or removed under the copy
  is restored from the pristine copy. The given application directory is never written.
- **Playwright**: found through `NODE_PATH` / `PLAYWRIGHT_BROWSERS_PATH`, the global npm root, or the
  same runtime cache `main.py` installs into.

The calibration script aligns verdicts with `result.json` cases by requirement id and reports
agreement and false passes over decided verdicts, with unparsed counted separately. The verdicts are
diagnostic; only the unchanged acceptance suite establishes scores.

## Continuation validation on 2026-09-16

The continuation adds Evolution source input, rollback/preservation regressions, and
`scripts/arc_read.py` for bounded read-only preflights. The helper retains each attempt's
exit code, stdout/stderr, timeout and error type in private JSONL, including failed attempts
before a later success. It never retries platform mutations. Both output streams must be
captured; callers should use the standalone CLI's `--log-file` for request-level details.
See `docs/reports/2026-09-16-oneshot-evolution.md` for exact candidate hashes, local behavioral results,
real cost and the Lite gate decision. These are distinct from the original import checks.

## Original import validation on 2026-09-16

Coordinator reran 25 mock/file tests successfully, including retry isolation, traversal,
402 handling, missing usage, global budget, failure exit, redirect refusal and packaging.
Two builds were byte-identical. Original imported candidate SHA-256:
`778f2ec1a39efe6bcb44b34dfc074f18ec2d6b18f6604b785b74a004b587d058`.
The import hashes were checked against the untouched experiment files.

One additional extracted-ZIP loopback HTTP test exists, but the delegate sandbox refused
socket binding; that test was not rerun with broader permissions and is not counted as
passed. To reproduce only the validated offline subset without opening sockets:

```sh
PYTHONPATH=.:tests_oneshot .venv/bin/python -m unittest test_oneshot.OfflineCase test_oneshot.PackageTests -v
```

No official run, real model generation, new Keep/Bookstack score, or quality improvement
is claimed. Next validation must use a fixed candidate, independent Lite generations,
and the actual official worker/time-limit environment. Static delivery checks do not
replace that measurement. The three-call cap is not a monetary budget.
