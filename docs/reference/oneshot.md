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
`tests_oneshot/test_package_names.py` fails when a packaged file names a practice task (the compliance
rule in `preliminary-rules.md`); `main.py` is exempt only until its comments are cleaned.

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
Source or local metadata changes during generation abort publication. A no-op upgrade (detected
after path normalization) is reported and ships the unchanged original. In-place publication uses
two renames with rollback, not an atomic directory exchange: a process kill between renames may
leave the original at a sibling `.oneshot-backup-*` path. A failed rollback leaves that backup
outside temporary cleanup. Gateway redirects are refused.

## Model calls

The default model is `deepseek-v4-flash` (`MODEL`). Completed calls are capped per phase: four
for the draft (first draft, continuations, redrafts; `ONESHOT_DRAFT_CALLS`) and six for the
repairs (`ONESHOT_REPAIR_CALLS`). The repairs also stop at a spend limit, CNY 3 per task by default
(`ONESHOT_REPAIR_CNY`), which counts the repair calls and the scenario translation; costs are
estimated from the reported usage with the gateway's price list, and a cut stream from its
characters. A malformed value stops the CLI before any request.
Transport failures (cut streams, 408/5xx) share one cap of five across both phases and never
consume a completed call. A refusal before any reply byte (HTTP 401, 403, 429) is not counted: the
call waits 15, 30, 60, 120, 240 s between tries on the same model, at most 1200 s in all, and only
then counts as an ordinary failure (09-27: a few minutes of gateway 401s stopped a repair loop in
one second). A call makes at most three attempts on its model; then the rest of the
run switches to the fallback: `kimi-k2.7-code-highspeed` for flash or any other non-Kimi model,
`deepseek-v4-flash` for a Kimi model, each request with its own model's parameters (Kimi's
provider-required temperature is 1.0). `FALLBACK_MODEL` overrides the pairing and an empty value
disables it. A `content_filter` finish continues the draft on the same fallback, or on the current
model when the fallback is disabled. Permanent HTTP failures (including 402) are not retried.
Observed token usage is accumulated across all attempts; incomplete usage remains unknown and is
not reported as zero cost. True prompts, responses, usage and timings are logged with the key
redacted; each trace record names its phase. During generation, the owned temporary staging
directory also holds `progress.json`: phase, request hash, byte/event counts and output/reasoning
character counts. It contains no prompts, response text or credentials and is removed with the
temporary directory after completion.

## Drafting and delivery

A `length` cut is continued while the draft allowance lasts: inside a file, the model re-emits
that file from its beginning; between files, it gets the list of complete files and writes the
rest. A reply that breaks the file framing (a missing `=== END ===`, a stray or malformed marker)
keeps the complete blocks before the break and is continued the same way; the rest of that reply
is dropped. A draft stream that breaks off after complete blocks (the gateway cuts one stream at
about 1200 s; a dropped connection, a missing `[DONE]`) keeps them and is continued like a
`length` cut; the attempt still counts as a failed, billed transport attempt with unknown usage.
A stream that breaks off before its first complete block is retried from scratch as before, and a
cut repair is never salvaged: the pre-repair application stays. A reply without any usable block
(an empty stream whose reasoning used the whole output, prose, a break before the first complete
file) is a completed call and is sent again unchanged; only after a cut between files does a reply
that stops without blocks end the draft. Partial blocks are never written.

Any error after the stage is set up (a spent allowance, transport failures, a rejected path, a
crash in the checks) still publishes the stage when it passes the delivery check, and stderr names
the error: `[oneshot] delivering the last complete version after an error: ...`. An incomplete
stage fails nonzero. The CLI also exits 1 after publishing when no delivered file came from the
model, for example the bare scaffold after a gateway outage, or an Evolution original whose patch
was rejected whole, so the platform sees the failure. There is no model backfill loop.

The delivery check validates manifests, scripts, the backend entry file, nonempty HTML and
the zero-dependency application contract. With Node/npm available, it builds the frontend,
starts the backend, checks health and assets, and executes a jsdom crash probe. Requirements
with explicit UI declarations also receive a deterministic Chromium diagnostic: declared home
controls, accessible roles, dialog action ambiguity, editor scope and native checkbox behavior.
Quoted requirement phrases (backticks, straight or curly double quotes) drive the prompt's
vocabulary checklist, the vocabulary and exact-name gates and the repair's rename guard; a phrase
quoted only in backticks that the user types (`fills X with ...`, `enters ...`) is a runtime value
and is not demanded. These checks feed the repair loop below as findings and hints; only the
unchanged acceptance suite establishes test scores.

## Repair loop

`repair_delivery` (roadmap 4.3) assesses the staged draft: the delivery check, the static gates
(process guards, label collisions, exact names, readonly inputs, scaffold primitives), the quoted
vocabulary, and, when the application is not broken as a whole, the scenario self-check below.

- **Trigger.** A repair is requested only while the application is broken as a whole (build or
  syntax failure, dead backend, `/` not served, load error, blank page, a page that never settles)
  or a requirement scenario fails. A load failure that only the jsdom probe reports (jsdom lacks
  `ResizeObserver`, canvas and other browser APIs) stands only when Chromium passes no scenario
  either; otherwise it becomes a hint (`smoke.jsdom_only`). Family-level smoke problems (a throwing
  click handler, a missing landmark), the static gates and the vocabulary gap ride along as hints
  and never trigger a call on their own.
- **Request.** The whole-application failures, else each failing scenario with the steps the
  browser performed and what it observed (up to 40), the ids of the passing scenarios to keep, and
  the hints. The files are re-emitted whole.
- **Acceptance.** A repair that makes a broken application work again is kept whatever else it did
  (the waived guards are listed in `rounds[].waived`). Otherwise it is kept only when at least one
  scenario that failed now passes, it gains three such scenarios for every passing one it loses, no
  clean static gate starts flagging, no quoted phrase disappears and no control name the requirement
  quotes is renamed (compared without leading or trailing symbols; a name the browser activated
  counts as present). Only verdicts both checks reached compare: a scenario that was unparsed or
  errored before is never a gain, one unparsed or not started after is never a loss. Lost
  scenarios, and gains of at most two, are rechecked once. A check that cannot run at all (no
  browser, every scenario errored) is retried once and then marked `checker`: the repair is
  discarded, but the model is not told it failed.
- **Fixed plan.** The first check fixes the scenario plan for the whole loop: a translation that
  failed (or had no key) is not retried, so every check compares the same scenarios.
- **Discard.** A discarded repair is swapped back by renames within one directory (the stage never
  goes missing); its reply never enters the conversation, and the next request says why it was
  discarded and what it left failing. A transport failure changes nothing the model hears.
- **Stop.** When nothing fails; when the next call would exceed the spend limit (spend so far plus an
  estimate: the whole prompt uncached and as much output as the largest completed repair, at least
  8000 tokens; the retries of one failing stream and an unusually long reply can still overrun it);
  at the repair call or transport failure limit; after three discarded repairs in a row; or after
  three hours of repairs. One scenario check starts no scenario after 30 minutes (those left are
  `Not run`).
- **Record.** `smoke.rounds` holds every round: `fatal` and `failing` (what triggered it), `reason`,
  `gained`, `lost`, `flaky`, `unconfirmed`, `files`, `seconds`, `cost_cny` and the scenario summary
  after it; `smoke.repair` repeats only the last round. `smoke.scenarios` and
  `smoke.scenarios_after` summarize the first and the final report; `smoke.stopped` says why the loop
  ended. Every translation call, failed ones included, appears in the trace like any other call.

`scripts/repair_replay.py` runs the loop on an existing application as if it were the draft, with
real model calls (a controlled repair: evidence about the loop, never candidate progress).

The browser helper uses Playwright 1.57.0. It reuses a reachable Node package and browser cache,
or installs the pinned package and headless Chromium into runtime caches with bounded waits.
`NODE_PATH` and `PLAYWRIGHT_BROWSERS_PATH` may supply existing installations. Generated apps still
receive no gateway credentials. The root `main.py` / `volo/` remain frozen legacy components.

## Scenario self-check

`oneshot/scenario_check.py` executes the requirements' own GIVEN/WHEN/THEN scenarios against a built
application in Chromium and reports `pass`, `fail`, `unparsed` or `error` per ATOMIC scenario, with one
observation sentence (screen hash, h1/h2, expected role and name, matches found). It ships in the
package and drives the repair loop above. It reads only the requirements and the application, never
evaluator tests.

```sh
python oneshot/scenario_check.py --requirements requirements.yaml --app APP_DIR --out result.json [--port N]
python scripts/calibrate_scenarios.py --requirements requirements.yaml REPLAY_DIR... [--jobs 4] [--out summary.json]
```

The result is `{"scenarios": [{"id", "name", "status", "observation", "steps", "source"}], "invariants": [...],
"coverage": {"total", "parsed", "rules", "model"}, "translation": {...}, "seconds"}`; a requirement with several
scenarios gets ids `REQ-x`, `REQ-x#2`, ... `invariants` holds a main-heading check (after activating a link named
like a seeded entity, the new screen's h1 or main heading contains that name) and every distinct uncaught page
error. `translation` reports the model fallback: status, accepted and rejected ids with reasons, usage and CNY cost.

- **Rules** (`oneshot/scenarios.py`, standard library only): a YAML subset checked against PyYAML on the Lite and
  large-task requirement files. Names come from backticks, or double quotes when a sentence has none. WHEN shapes:
  open the application URL; activate / click / press / select / hover / focus a named control (role words such as
  `link or button`, `button`, `tab`, `checkbox`; `unique`; `twice`; scopes `in the top navigation bar`, ``inside the
  `X` article``, ``In the `X` article, ...``, `its`); enter / fill / replace a named field with a value; check or
  uncheck; select an option; press a key; `The system ...` waits. THEN shapes: a (visible / exactly one / unique)
  heading, region, section, form, button, link, article, entry or text named X, optionally in a named or described
  container; `X is absent` / `closes`; `keeps X unchanged`; `the X article displays Y`; `the notes list contains X`;
  aria states, computed background colour; `after the first activation` places the check after that action. Every
  word of a clause must be read by a shape: an unread qualifier (`is assigned`, `has no title`, an absence inside an
  unnamed container) makes the whole scenario `unparsed` rather than a weaker check.
- **GIVEN**: the dependency chain runs first (prerequisites' WHEN steps only, one path when a requirement lists
  alternatives, preferring the one reaching the requirement's seed kind), then the scenario's own WHEN, then only
  its own THEN is asserted. A prerequisite activation of a sibling entity (`Shelf 4.2.1`) uses the requirement's
  own seed of that kind (`Shelf 4.4.1`), in scopes too. A prerequisite's data entry (a segment that fills, checks
  or selects) is not replayed unless it logs in for a GIVEN that needs it or acts on this requirement's seed items.
  A GIVEN page the chain does not reach is entered with the opening activations of a same-folder sibling with the
  same dependencies (`on the shelf creation page` -> `New Shelf`); ``the "X" editor is open`` activates X;
  `logged in` prepends the requirement that logs in; `a non-homepage page` adds a navigation activation; a state
  clause (`the note is pinned`) must share a distinctive word with an executed prerequisite's name;
  `on the homepage` in a THEN first performs the requirement that returns home. Other GIVEN states are `unparsed`.
- **Model fallback** (`oneshot/scenario_translate.py`): every scenario the rules leave unparsed goes to one
  `deepseek-v4-flash` call per requirements text (temperature 0, reasoning effort low, gateway and key from
  `OPENAI_BASE_URL` / `OPENAI_API_KEY` as in `main.py`), with all requirement records, the rules' reading of every
  other requirement's WHEN steps and the fragment the rules could not read. The reply must be strict JSON in the
  executor's step format. Each scenario is validated alone: step types the executor supports, ARIA roles and keys
  from fixed lists, ARIA states only on roles that support them, every name, option and expected text equal to a
  quoted name of the requirements or a value the scenario typed, and every quoted name of the scenario's own
  GIVEN / WHEN / THEN used by its steps. A rejected scenario stays `unparsed`. The reply is cached by the SHA-256
  of the requirements text with the prompt version and model (`SCENARIO_CACHE_DIR`, default
  `$TMPDIR/oneshot-scenario-cache`), so repair rounds never call again; the cache record keeps the true prompt,
  reply, usage and timing. `SCENARIO_TRANSLATE=0` switches the fallback off; without a key only a cached reply is
  used.
- **Locators**: role + exact name, then for roles named by their content (article, list item, row, region, ...)
  the element that contains the name as text, role + name substring, label, placeholder, text. `unique` requires
  exactly one visible element at the first rung that finds any, after the pointer is parked (hover-revealed row
  actions do not count). An action inside a named record hovers the record first; a card is clicked near its
  top-left corner. A section titled by a heading scopes by document position (after its heading, before the next
  heading of the same level). Waits are 2.5 s per action or expectation.
- **Isolation**: `frontend/` and `backend/` are copied to a scratch directory (dependencies linked, never written)
  and built once; a pristine copy is kept. Every scenario gets a new browser context and a backend started fresh
  on its own free port with a private TMPDIR (retried on a new port when a parallel run took it); afterwards the
  backend's process group and descendants are stopped and every file created, changed or removed under the copy is
  restored from the pristine copy. The given application directory is never written.
- **Playwright**: found through `NODE_PATH` / `PLAYWRIGHT_BROWSERS_PATH`, the global npm root, or the same runtime
  cache `main.py` installs into.

The calibration script aligns verdicts with `result.json` cases by requirement id and reports agreement and false
passes over decided verdicts, with unparsed counted separately; `docs/evidence/2026-09-23-scenario-check-calibration-*.json`
hold the Keep and BookStack runs. The verdicts are diagnostic; only the unchanged acceptance suite establishes scores.

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
replace that measurement. The completed-call allowances are not a monetary budget.
