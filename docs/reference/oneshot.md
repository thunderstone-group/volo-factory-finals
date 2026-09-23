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
The root allowlist is `main.py`, `dialect.md`, `requirements.txt`, and `semantic_probe.cjs`;
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
Source or local metadata changes during generation abort publication. A no-op upgrade (detected
after path normalization) is reported and ships the unchanged original. In-place publication uses
two renames with rollback, not an atomic directory exchange: a process kill between renames may
leave the original at a sibling `.oneshot-backup-*` path. A failed rollback leaves that backup
outside temporary cleanup. Gateway redirects are refused.

## Model calls

The default model is `deepseek-v4-flash` (`MODEL`). Completed calls are capped per phase: four
for the draft (first draft, continuations, redrafts; `ONESHOT_DRAFT_CALLS`) and two for the
delivery repairs (`ONESHOT_REPAIR_CALLS`); a malformed value stops the CLI before any request.
Transport failures (cut streams, 408/429/5xx) share one cap of five across both phases and never
consume a completed call. A call makes at most three attempts on its model; then the rest of the
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
is dropped. A reply without any usable block (an empty stream whose reasoning used the whole
output, prose, a break before the first complete file) is a completed call and is sent again
unchanged; only after a cut between files does a reply that stops without blocks end the draft.
Partial blocks are never written.

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
and is not demanded. The check supplies observations to the bounded repair flow; no
model-generated test or planning call is added. If an accepted repair exposes remaining runtime
problems, the remaining repair call can address them. A regressing follow-up restores the
previous accepted stage. Each repair and whether its browser check actually executed are retained
in the trace. Missing browser infrastructure is reported separately and cannot approve a previously
observed repair. A repair that removes a whole-application failure (blank page, crash) is kept even
when the rename, vocabulary or browser-recheck guard would reject it; the waived guards are listed
in `smoke.repair.waived`. Control names are compared without leading or trailing symbols. These
checks are diagnostic; only the unchanged acceptance suite establishes test scores.

The browser helper uses Playwright 1.57.0. It reuses a reachable Node package and browser cache,
or installs the pinned package and headless Chromium into runtime caches with bounded waits.
`NODE_PATH` and `PLAYWRIGHT_BROWSERS_PATH` may supply existing installations. Generated apps still
receive no gateway credentials. The root `main.py` / `volo/` remain frozen legacy components.

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
