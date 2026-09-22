# One-shot candidate inside VOLO

Last reviewed: 2026-09-22.

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
Source or local metadata changes during generation abort publication. No-op upgrades are rejected after path
normalization. In-place publication uses two renames with rollback, not an atomic directory
exchange: a process kill between renames may leave the original at a sibling
`.oneshot-backup-*` path. A failed rollback leaves that backup outside temporary cleanup.
Gateway redirects are refused.
The budget permits three completed calls and at most five failed transport attempts; failures do
not consume a completed-call slot. Each stream operation makes at most three attempts before a
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
It supplies observations to the existing bounded repair call; no model-generated test or extra
planning call is added. Probe output and whether it actually executed are retained in the trace.
Missing browser infrastructure is reported separately and cannot approve a previously observed
repair. These checks are diagnostic; only the unchanged acceptance suite establishes test scores.

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
replace that measurement. The three-call cap is not a monetary budget.
