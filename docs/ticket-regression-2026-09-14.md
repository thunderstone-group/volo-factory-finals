# The 7/10 Ticket Booking run was a browser fault, not a merged change (2026-09-14)

Official run [`92220c94fd25`](https://arc-bench.com/runs/92220c94fd25) scored **7/10** at CNY 0.439112
and 77,772 tokens, where the previous main scored 10/10 three times the same day. **No merged change
produced the failing behaviour.** All three failures are browser-process faults on the hosted runner
inside one 19.3-second window, and the application that run generated passes the unchanged public
tests **25 times out of 25** locally in the calibrated hosted configuration.

Raw numbers are in [`docs/evidence/2026-09-14-ticket-regression.json`](evidence/2026-09-14-ticket-regression.json).

## What actually failed

The three failures are the three tests that assert a signed-in header. That pattern invites the
reading that the run lost its session, and it is the wrong reading. The runner log names the cause.

| Test | Status | Runner error |
| --- | --- | --- |
| REQ-1.1 successfully register and remain signed in | timedOut 10,013 ms | `locator.evaluate: Test timeout of 10000ms exceeded`, call log `locator resolved to visible <select id="r-doctype">` |
| REQ-1.2 sign in with a valid username and password | failed 1,193 ms | `getByText('tb-user-…', {exact:true})` element(s) not found |
| REQ-1.2 sign in with a case-insensitive email | timedOut 15,018 ms | `locator.click: Target crashed` |

`Target crashed` is a Chromium renderer crash. The registration failure is the same thing one step
earlier: `element.tagName.toLowerCase()` cannot hang on an element Playwright has already resolved to
visible, so the renderer was wedged, not the application. The login failure was reported after
1,193 ms against a 10,000 ms expect timeout, on the same machine inside the same window, so that
expect never ran its timeout either. The third duration, 15,018 ms against a 10 s test timeout, is
teardown hanging on the dead target as well.

The window is bounded. The suite started at 07:42:26 UTC and finished at 07:42:46. The three
failures are the three tests that were in flight from 07:42:27 to 07:42:44. Tests 4 through 10 ran
from 07:42:38 and all passed, in 241 to 980 ms — **every passing test in the 7/10 run is faster than
the fastest test of the 10/10 run**, which was 1,295 ms. The application is not heavier or slower.

Both runs requested `--workers=4` and both got `Running 10 tests using 2 workers`, so the runner
configuration was identical.

## The application is not defective

The generated workspace was replayed against the unchanged public tests in `harness_lab/local_gate.py`
host mode: the application in a 1 CPU / 256 MB container behind the volo launcher, Playwright workers
4, `fullyParallel` false, 10 s timeouts, retries 0.

| Batch | Replays | Clean 10/10 | Unexpected failures |
| --- | --- | --- | --- |
| First | 5 | 5 | 0 |
| Second | 20 | 20 | 0 |

Reading the source confirms it. The frontend rehydrates from `GET /api/session` on load, registration
and login set `currentUser` from the response and re-render in place with `history.replaceState`, and
the backend sets an `HttpOnly` session cookie on both paths and resolves it on `/api/session`. The
run's own self-checks pass `REQ-1: valid registration stays signed in after reload` and
`REQ-2: login with username and reload session` — the exact behaviours that failed officially.

## Attribution

**PR #17, small-board token cuts: not implicated.** The generation system prompt is byte-identical
between the two runs, 3,996 characters each. The trim removed `all_requirements`, an empty
`inherited_constraints`, an empty current-file list, an empty self-checked-id list, and JSON
pretty-printing. Requirement semantics survive verbatim, including the REQ-1 scenario that states the
home page shows the username and 退出登录 and stays signed in after a refresh.

**PR #19, repair loop: not implicated, and it behaved correctly.** The first self-check failed 3 of
11. The repair edited `checks/requirements.cjs` only, inserting `page.goto('/')` before three
`page.click('a[href="/register"]')` and `/login` calls. That makes the model's own check navigate the
way the official helpers do, since `openRegister` and `openLogin` both call `openHome` first. It
corrected a defect in the check and masked nothing in the application. The 10/10 run has the same
shape: first self-check fails, one repair round, second passes, three model calls.

**PR #11, observer model: not implicated.** Both runs sent the same three images, same SHA-256 values
and same transformed sizes. `kimi-k3` returned 3,946 characters in 59.7 s; `qwen3.6-flash` returned
4,337 characters in 14.9 s. Both describe the same header links, nav bar, form fields and buttons.
Neither mentions signed-in state, because all three reference screenshots are of the signed-out site.

**One run is one sample.** A 7/10 and a 10/10 on this board differ by three tests that died to
browser faults, and the bench has now shown that failure at least once.

## The fix

The one lever in our control. The run's last act before the official suite was its own browser-driven
self-check, and `volo/web_runtime.py` launched a fresh Chromium per check: eleven launches in 7.9
seconds, finishing 2.1 seconds before the official suite started in the same container. The harness
now launches one browser for the whole check run and gives each check its own browser context, which
keeps the per-check cookie and storage isolation the checks rely on.

Measured on that run's own `checks/requirements.cjs`, 11 checks against its own application, three
repetitions each:

| | Browser launches | Wall seconds | Checks passed |
| --- | --- | --- | --- |
| Before | 11 | 11.01 / 11.02 / 11.00 | 11 of 11 |
| After | 1 | 8.44 / 8.57 / 8.43 | 11 of 11 |

The browser is closed in a `node:test` `after` hook, a crashed browser is relaunched so one bad check
cannot fail every later one, and context teardown no longer masks the authored failure.

`tests/test_browser_lifecycle.py` adds six cases: one browser for three checks with a context each, a
single close after the last check, a failing check still releasing both, relaunch after a crash,
missing Playwright still failing the check rather than the module load, and an installed Chromium
launched once for three checks. `python -m unittest discover -s tests` reports **238 tests, 0
failures, 4 skipped**, against 232 before the change, with the same four Docker-image skips.

**What this does not claim.** It does not prove the renderer faults were caused by self-check browser
pressure, and one run cannot. It removes a measured 11-to-1 process churn immediately before
evaluation. Confirmation would be official trials on this board with no browser fault in the
evaluation window; a pass-rate change alone would not separate the fix from generation variance.

## Open

- The renderer crash itself is unexplained beyond the runner log. Container logs for the run were
  collected at `stdout_bytes=0, stderr_bytes=0`, so there is no in-container memory evidence.
- Whether `qwen3.6-flash` or `kimi-k3` is the better observer is untouched by this run. Testing it
  needs a local generation with the single change reverted.
