# E047 sign-out acceptance calibration

Observed 2026-09-12. This is one controlled browser interaction on retained application
code, not new generation, a full public-suite replay, or an official score.

## Result

The same external assertion distinguishes a product correction from weakening self-tests:

| Candidate | No injected delay | 400 ms before forwarding logout | Self-check-only mutation |
|---|---|---|---|
| Original E047 application | Passed; session absent | Failed; session still active | None |
| Identical product, self-check replaced with exit 0 | Passed; session absent | Failed; session still active | The weakened command actually exits 0 |
| Only the sign-out label changed to permitted `Sign out` | Passed; session absent | Passed; session absent | None |

All six final observations are valid, with no observation errors or cleanup errors.
The final control run took 13.393 seconds. No model request or official evaluation ran.
The [source-bound evidence](../../evidence/2026-09-12-logout-calibration.json) contains exact
source, candidate, probe and controller hashes and each observed outcome.

## What was held fixed

The original frontend, API handler, HTTP server and authored self-check were retrieved
read-only from [E047](https://arc-bench.com/runs/5618708b9481). The first three match
retained local replay files byte-for-byte. Existing public test files also match the
retained public test pack and were not modified.

Each candidate runs in a fresh non-root Docker container with a read-only candidate
mount, a read-only root filesystem and temporary application data. The candidate is
published only on host loopback through a dedicated bridge. The browser uses a fresh
context and only the application origin. No user browser profile or credentials are
used. Docker image and browser versions are recorded; this is not an assertion of
parity with every detail of the official execution environment.

The probe creates a synthetic account through the observed application API, then
reproduces the two operations in the public `signOut` helper: click the sign-out link
and wait for a link matching the login expression. It then navigates home and checks
actual session state through `/api/me`. Its extra assertion belongs to this narrow
calibration; the full ten-test public suite was not executed in this experiment.

The product correction replaces exactly one `text: '退出登录'` literal with
`text: 'Sign out'` in a disposable copy. The API, server and self-check remain identical.
The weakened-self-check candidate has the identical product bytes and replaces only
`checks/requirements.cjs` with `process.exit(0)`.

## Interpretation

The public login expression also matches the original Chinese sign-out label. Under
an injected request delay, that wait can finish before logout is handled, and the next
navigation aborts the pending request while leaving the session alive. The permitted
English label removes that particular ambiguity.

An `ERR_ABORTED` log alone does not identify failure: it also appears in successful
controls after the server has cleared the session. Actual state distinguishes them.
A model critic that judges only error words in tool logs could misclassify these cases.

This is evidence that a calibrated external executable check can reject the observed
failure while accepting its specific correction, and is unaffected by self-test
weakening. It does not establish coverage of all requirements, the cause of every
official timeout, a higher competition score, or the quality of an LLM acceptance agent.
There is no new reason from this experiment to enable an additional model by default.

## Reproduction

Use the four source files returned by `arcbench source 5618708b9481` for
`frontend/public/index.html`, `backend/api.cjs`, `backend/server.cjs`, and
`checks/requirements.cjs`, saved as `index.html`, `api.cjs`, `server.cjs` and
`requirements.cjs` in a private source directory. Then run:

```sh
python -m harness_lab.calibrate_logout \
  --source /absolute/retained-source \
  --output /absolute/new-report-directory \
  --playwright /absolute/node_modules/@playwright/test \
  --chromium /absolute/installed-chrome \
  --image existing-local-node-image
```

This entry is E047-specific laboratory code and is excluded from the uploaded agent.
The fixed 0/400 ms controls stop after six observations. An error is recorded as an
inconclusive observation rather than a passing case. A first infrastructure attempt
failed before browser execution; a subsequent diagnostic read raced zero-delay
navigation. That read now happens before clicking, leaving the measured helper
sequence uninterrupted. Both earlier attempts remain in private run evidence.
