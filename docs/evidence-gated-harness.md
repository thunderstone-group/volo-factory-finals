# Implemented: bounded recovery and independent acceptance

> Historical branch record for `596fe7b`. For the combined implementation and current paths,
> see [the consolidation review](harness-consolidation-2026-09-12.md) and [lab map](../harness_lab/README.md).

This implementation follows the architecture audit, without adding another planning
model or task-specific layout rule. The frozen official candidate remains in Git;
this branch is an unsubmitted implementation candidate, identified by its Git revision.

## What changed

A truncated bundle/compact-edit response now immediately releases forced-tool mode.
The next request has ordinary incremental file/edit tools. No tool from an incomplete
response executes; rejected fragments are not inserted as incomplete tool exchanges.
Three consecutive truncated responses stop that batch instead of using its entire
call allowance. Tools not advertised in the active mode cannot execute.

`volo/acceptance.py` runs reviewed, operator-supplied `node:test` files outside the
application. It consumes parent test-runner events, not arbitrary stdout or exit code
alone. Expected case identity includes file and test name. Missing, duplicate, skipped,
todo and non-test/suite results do not count as passing expected cases. Nonzero process
exit and timeouts cannot produce acceptance. Files and the manifest are SHA-pinned,
copied into a fresh external directory, and checked before and after execution.

A case maps to requirement IDs and a source reference. A requirement is independently
verified only when ALL its currently applicable cases pass. Uncovered requirements stay unverified.
Incremental runs select cases for the cumulative implemented requirement scope; future
cases are not claimed as passed. The versioned contract cannot reuse an earlier
self-check or an acceptance proof covering fewer requirements after resume.

`Workspace.verify` uses this acceptance when explicitly configured. Agent-generated
checks may still be edited for diagnostics, but they cannot weaken the configured
acceptance. The same suite can evaluate another worker's running application through
`scripts/evaluate_candidate.py`; that path performs no model calls or platform writes.

Environment discovery now tries local/provided browser modules first and runs both
metadata scanning and module loading inside a single timed Node child. The default
three-second timeout covers the directory walk as well as `require()`. Metadata entry
counts are bounded, and the discovery process receives neither model credentials nor
Node preload hooks. A timeout is reported as unavailable rather than silently hanging
before the agent starts. No browser installation or shared-cache change is performed.

## Result semantics and limits

Without a supplied contract, generation can still complete after self-checks, but the
result reports `independent_acceptance: not_configured`, an empty `verified_requirements`,
and separate `self_checked_requirements`. It does NOT manufacture authoritative tests
or label all requirement nodes independently passed. `status: completed` means the
agent's generation/check loop completed, not that official evaluation has passed.

With a contract, failures block completion and return per-case evidence to the repair
loop. Official results remain separate. Missing cases, skips, broken suite integrity and
runner errors stop execution rather than spend further model calls repairing an
unreliable evaluator. Real product assertion failures still enter bounded repair.
The evidence includes contract, requirement,
reporter, source and report fingerprints, requested/executed cases, Node version, process
outcome and timeout state. The standalone CLI records both candidate-tree fingerprints:
stateful tests may legitimately modify application data, so a tree change is recorded
rather than silently described as a source-code change.

This is an integrity/observability boundary, NOT an OS security sandbox. Arbitrary code
running as the same user can attack other files/processes. Production untrusted apps
need separate containers/permissions and appropriate read-only mounts. Hash checks
are not a claim to defeat an adversary that changes and restores files between checks.
Keep imported helper files pinned; separately pin/review shared runtime dependencies.

Fixed tests can still be wrong or too weak. A named test without useful assertions is
not made correct by this runner. Reviewed suites require positive/negative calibration
and a separate versioned review when challenged. No automatic LLM-generated acceptance
plan is promoted to authority. These tests do not demonstrate generalization or improved
official scores. Pi's actual adapter and matched model baseline remain unimplemented.

## Contract format

The manifest and all authored helper/test files live in a directory that is neither
inside the generated application nor its ancestor. Use canonical absolute paths when
loading a manifest (resolve OS path aliases first); symlinked acceptance files are
rejected. Requirements and evaluator artifacts must be authorized for this use.

```json
{
  "version": 1,
  "requirement_fingerprint": "<RequirementSet.load(input_path).fingerprint>",
  "files": {"flows.cjs": "<SHA-256 of reviewed flows.cjs bytes>"},
  "cases": [{
    "id": "greeting-visible",
    "file": "flows.cjs",
    "name": "shows the required greeting",
    "requirements": ["REQ-1"],
    "source": "requirements.yaml#REQ-1"
  }]
}
```

Use flat, uniquely named `node:test` cases. Browser cases can use the provided
Playwright library; this implementation does not install or change browsers. Tests
receive `FACTORY_BASE_URL`, `E2E_BASE_URL` and `PLAYWRIGHT_BASE_URL`. All generation
model calls still use the existing organizer gateway; no alternative model is added.

Enable the gate for the current agent:

```sh
python main.py /absolute/input --output-dir /absolute/app \
  --acceptance-contract /absolute/acceptance/contract.json
```

Evaluate a candidate already running in its own sandbox, without starting a worker:

```sh
python scripts/evaluate_candidate.py \
  --requirements /absolute/input --application /absolute/app \
  --contract /absolute/acceptance/contract.json \
  --base-url http://127.0.0.1:3301 --output /absolute/results/acceptance.json
```

The standalone CLI exits 0 only on acceptance, 1 on non-acceptance, and 2 on invalid
configuration. It does not start the application, install dependencies, create a
submission or infer a score from a model's textual response. Optional explicit
`--playwright-module` and `--chromium-executable` paths are passed to trusted tests
as `FACTORY_PLAYWRIGHT_MODULE` and `FACTORY_CHROMIUM_EXECUTABLE`.

## Regressions

Final validation: **101 passed, 0 failures/errors, 0 skipped**, including actual Chrome
checks. The wrapper measured 177.135 seconds and verified source hashes were unchanged
during the run. The package was built twice with identical bytes. See the
[version-bound evidence](evidence/2026-09-12-evidence-gated-harness.json) for exact source
hashes, local runtime versions, package SHA-256, and the earlier incomplete timeout.
No real model API call or official evaluation was performed.

`tests/test_recovery.py` covers truncation -> incremental generation -> actual HTTP
verification, existing-project preservation, bounded stop, and active-tool enforcement.
`tests/test_acceptance.py` includes positive/negative controls, empty output, forged
stdout, skips/todos/duplicates, coverage gaps, contract mutation, symlinks, timeout,
real HTTP repair, real browser evaluation, stale-proof resume and worker-neutral CLI.
`tests/test_environment.py` separately exercises real local discovery, an intentionally
hanging module with a hard timeout, and credential/preload exclusion. Unrelated unit
test setup stubs only host-wide discovery; it does not stub the actual application,
HTTP checks, browser fixtures or the dedicated discovery tests. This removes repeated
machine-wide scans without deleting behavioral assertions.
The model transport is synthetic; app, test runner, HTTP and enabled browser execution
are real. Existing real-browser checks can be enabled with the two documented
`FACTORY_TEST_*` variables; no remote model is required.

Runner interface source: https://nodejs.org/api/test.html#test-reporters . This branch
uses test:pass/test:fail events observed with local Node v22.22.0; compatibility with
the current official runner still needs an environment-matched deployment check.
