# One-shot candidate inside VOLO

`volo-factory` is the only main ARC project. `oneshot/` is its active one-shot candidate;
`oneshot-lab/arc-package` is the preserved source experiment, not a second active project.
The original three source hashes and Git head are in `oneshot/source_manifest.json`.

## Build and verify

```sh
.venv/bin/python scripts/package_oneshot.py
.venv/bin/python -m unittest discover -s tests_oneshot -v
```

The default artifact is `oneshot/dist/oneshot.zip`, with a sibling `.zip.manifest.json`.
Only `main.py`, `dialect.md`, and `requirements.txt` are in the ZIP, flattened to its root.
Timestamps, order, permissions and uncompressed ZIP encoding are fixed. The external
manifest binds every current source file to the ZIP hash and retains import provenance.
Neither forum tools nor platform sessions, test fixtures, or run evidence are packaged.

Run the extracted entrypoint as `python3 main.py REQUIREMENT_DIR --output-dir EMPTY_DIR --type web`.
Real generation uses the authorized gateway environment, never credentials in arguments.
This invocation is paid model work; it was NOT run against a real model in this change.

## Boundaries

Paths must be relative and resolve within the output tree. Generation is staged and the
validated directory is published by one rename. Existing nonempty output is rejected
before any model call, rather than silently mixing old files. Gateway redirects are refused.
A single global three-request limit includes stream retries and one truncation continuation.
Permanent HTTP failures (including 402) are not retried. Observed token usage is accumulated
across all attempts; incomplete usage remains unknown and is not reported as zero cost.
True prompts, responses, usage and timings are logged with the key redacted.
Missing delivery files or malformed output fail nonzero. There is no model backfill loop.

The deterministic delivery check validates manifests, scripts, the backend entry file,
nonempty frontend HTML and the zero-dependency contract. It does NOT run npm build,
start the generated application or establish health/behavior correctness. A successful
exit is therefore not an official acceptance result. The original root `main.py` / `volo/`
are a frozen legacy baseline; this change does not silently replace that entrypoint.

## Validation on 2026-09-16

Coordinator reran 25 mock/file tests successfully, including retry isolation, traversal,
402 handling, missing usage, global budget, failure exit, redirect refusal and packaging.
Two builds were byte-identical. Current candidate SHA-256:
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
