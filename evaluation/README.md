# External developer acceptance gate

The worker may change its implementation and self-checks. It does not provide the
acceptance suite used here. The same gate can evaluate a VOLO, Pi, or other worker's
output; it has no worker-specific or Ticket Booking rules.

## Current boundary

`python -m evaluation.gate` evaluates an **already running application** against a
pinned developer-owned check script. It does not run a model, build/start candidate
code, install dependencies, fetch tests, or submit an official evaluation.

The operator must run generated code in a disposable OS/container sandbox, launch
from the intended source snapshot, and supply its loopback URL. The source-to-URL
binding is operator-supplied, **not attested by this gate**. Use a frozen candidate
snapshot separate from its mutable runtime data. Check suite, candidate snapshot
and original requirements must be disjoint directories. Store reports outside all
three. Run the gate outside the worker's OS security domain for a real access boundary.

Hashes detect observed changes; they do not prevent same-user processes from editing
files or modifying/restoring them between checks. Dependency caches are excluded from
tree hashes (`.git`, `.factory`, `__pycache__`, `.venv`, `node_modules`). For reproducible
campaigns, additionally pin container/runtime/dependency versions. The report records
OS information and the interpreter binary hash, not a complete hermetic environment.

## Contract

A trusted operator creates `manifest.json` beside its check script, before running
the candidate. No model-generated contract is automatically trusted. A manifest is:

```json
{
  "schema_version": 1,
  "requirements_sha256": "<tree_digest of original requirements directory>",
  "requirement_ids": ["R1"],
  "cases": [{"id": "greeting", "requirement_ids": ["R1"]}],
  "argv": ["/absolute/path/to/python", "check.py"],
  "files": {"check.py": "<SHA-256 of check.py>"}
}
```

The angle-bracket strings above are placeholders, not valid hashes. Compute input
hashes with `evaluation.gate.tree_digest(Path(...))` and file hashes with
`evaluation.gate.digest_file(Path(...))`. Include every local helper/input used by the
check script in `files`; pin external library/runtime dependencies separately.
`argv` starts with an installed absolute interpreter and a pinned script path; use
a trusted wrapper to integrate Playwright or another runner.

The script receives `FACTORY_BASE_URL`, `E2E_BASE_URL` and `PLAYWRIGHT_BASE_URL`. It
runs from the check-suite directory, with a clean environment and temporary HOME,
not from the candidate workspace. Model keys, cookies, NODE_OPTIONS and PYTHONPATH
are not inherited. The script must print one JSON object on stdout:

```json
{
  "cases": [
    {"id": "greeting", "status": "passed", "evidence": "Observed expected HTTP response body"}
  ]
}
```

Use `passed`, `failed`, `error` or `skipped`; evidence must be nonempty. Each declared
case must appear exactly once. Unknown/duplicate IDs, duplicate JSON keys, missing
results, blank evidence, empty suites and stdout without results fail closed. A
nonzero exit cannot override an all-pass report; exit codes other than 0/1 are errors.
Errors/skips are incomplete, never passes. The entire declared requirement scope is
accepted only if all associated cases pass and the runner exits 0. This proves the
**declared contract**, not that the operator declared every meaningful requirement.

The gate checks suite/interpreter hashes and input snapshots before and after an
execution, enforces a wall-time limit and a 1 MiB combined output limit, and terminates
remaining process-group children. It reports input, candidate, contract and output
hashes. Official evaluation is always separately labeled `not_run`.

## Invocation

```sh
python -m evaluation.gate \
  --contract /path/to/trusted-suite/manifest.json \
  --candidate /path/to/frozen-candidate \
  --requirements /path/to/original-requirements \
  --base-url http://127.0.0.1:39300 \
  --timeout 120 \
  --output /path/to/results/candidate.json
```

Exit 0: declared acceptance scope passed. Exit 1: completed non-pass/incomplete/error
report. Exit 2: invalid setup/contract or report write failure. Never use the exit
code alone without preserving the structured evidence.

## Calibration and next integration

The gate cannot determine whether the check script's interpretation is correct.
First run known-correct and deliberately incorrect implementations. Calibrate false
positives as well as false negatives; freezing an incorrect judge does not fix it.
Check changes require an independent version and rerunning all compared candidates.
No official/private test set is included or assumed available.

`tests/test_external_gate.py` uses a real local HTTP server with tiny authored
fixtures. It proves the mechanism can accept the correct body, reject the wrong one
even after self-check weakening, reject missing/changed evidence, and bound execution.
It does not establish Ticket Booking coverage or Pi performance. A genuine Pi
adapter, suite-specific reporter, and identical sandbox/source-to-URL runner remain
integration work; none is silently claimed complete here.

## Runtime evidence migration

Dev30's `volo` still performs local checks for fast repair and scheduling. Its result
now exposes `self_checked_requirements` and `verification_scope=local_checks_only`;
`verified_requirements` is empty. Local verification results also declare
`requirements_verified=false`. The SDK no longer receives per-requirement
`mark_test_passed` for uncalibrated self-checks. Consumers must not interpret local
`status=completed` as authoritative requirement acceptance. Official compatibility
of the changed SDK progress events still needs a separately authorized validation.
