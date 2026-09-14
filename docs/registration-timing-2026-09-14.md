# Where the registration test's 10 seconds went (2026-09-14)

The official E057 run failed exactly one public test,
`REQ-1.1: successfully register a new account and remain signed in`, at 10,013 ms against a
10,000 ms test timeout. This document replays that test against the exact E057 application
and the unchanged public test bytes, extracts a per-action timeline, and ablates the
application to measure what actually shortens it.

Raw numbers: `docs/evidence/2026-09-14-registration-timing.json`. Bench code: `lab/`.

## Answer first

The registration test does not cost anything close to 10 seconds, and no application-side
change buys back more than a tenth of its cost at the latency the hosted runner actually had.

| Configuration | Registration test, median | Nine light tests, min / median / max | Suite wall |
| --- | --- | --- | --- |
| Official hosted E057 | 10,013 ms, timed out | 363 / 795 / 989 ms | 14,571 ms |
| `host` (n=18) | 747 ms, passed | 416 / 846 / 1,610 ms | 5,863 ms |
| container, 2 CPU (n=3) | 1,044 ms, passed | 587 / 1,107 / 1,265 ms | 7,171 ms |
| container, 1 CPU (n=3) | 3,299 ms, passed | 1,640 / 3,519 / 4,591 ms | 20,228 ms |
| container, 0.5 CPU (n=3) | 12,509 ms, timed out | 4,295 / 12,007 / 13,189 ms | 80,906 ms |

The `host` row reproduces the official light-test latencies almost exactly (416 / 846 / 1,610
against 363 / 795 / 989). At that latency the registration test costs 747 ms, which is 7% of
its budget, and eighteen replays ranged from 682 ms to 976 ms. Throttling far enough to
push the registration test past 10 s also pushes eight of the other nine tests past 10 s,
which is not what the official report shows.

Three facts from the official report itself close the case on machine speed:

| Worker | Window, relative to first test start | Work done |
| --- | --- | --- |
| 0 | 0.002 s to 10.015 s | the registration test alone, timed out |
| 1 | 0.000 s to 3.399 s | all four REQ-1.2 tests, 989 / 600 / 814 / 795 ms |
| 2 | 10.532 s to 14.116 s | the five remaining REQ-1.1 tests, 800 / 688 / 363 / 689 / 926 ms |

Worker 1 ran out of work 3.4 s in, so for the last 6.6 s worker 0 had the machine largely to
itself and still made no progress. Worker 2 then drove the same registration form through
five tests, each with more Playwright round trips than the failing one, in 3.6 s total. The
machine, the application process and the form were all healthy on either side of the stall.

The official failure is therefore a single-worker stall, not a cost profile. The application
changes below are worth making for robustness and for headroom under a slow runner, not
because they would have saved that run.

## Step 1: baseline per-action timeline

The test issues 59 measured Playwright steps plus context and page creation. In the
calibrated `host` configuration their leaf durations sum to 519 ms out of a 976 ms reported
test duration; the rest is per-step harness overhead and the page fixture.

| Bucket | Steps | `host` median total | 1 CPU median total |
| --- | --- | --- | --- |
| expect | 23 | 190 ms | 726 ms |
| click and check | 4 | 188 ms | 618 ms |
| evaluate | 15 | 48 ms | 536 ms |
| fill | 9 | 39 ms | 316 ms |
| navigation (`goto` x2, `reload`) | 3 | 40 ms | 320 ms |
| select option | 3 | 7 ms | 21 ms |
| context and page creation | 2 to 3 | 90 ms | 189 ms |
| context teardown | 1 | 4 ms | 66 ms |

The `click` bucket is misleading on its own: two of its four entries are the
`a[href="/register"]` clicks, and each is a full document load, not a click. Counting those,
document loads are five of the test's steps and the single largest group of time.

Ten slowest steps, `host`, representative repetition (test total 725 ms):

| ms | Step |
| --- | --- |
| 108.1 | `Expect "toBeVisible"` on the 账户信息 heading, first assertion after the register load |
| 84.6 | `Click a[href="/register"]` (document load) |
| 82.7 | `Create page` |
| 51.1 | `Click a[href="/register"]` (document load) |
| 38.5 | `Check` the terms checkbox |
| 33.5 | `Click` the 下一步 submit button |
| 13.9 | `Reload` |
| 13.2 | `Navigate to "/"` |
| 12.7 | `Navigate to "/"` |
| 10.5 | `Expect "toHaveValue"` |

Ten slowest steps, 1 CPU, representative repetition:

| ms | Step |
| --- | --- |
| 199.5 | `Click a[href="/register"]` (document load) |
| 192.2 | `Click a[href="/register"]` (document load) |
| 186.6 | `Expect "toBeVisible"` |
| 110.5 | `Expect "toBeVisible"` |
| 106.4 | `Evaluate` on the password-strength meter |
| 104.9 | `Navigate to "/"` |
| 103.2 | `Create page` |
| 103.0 | `Check` the terms checkbox |
| 94.5 | `Expect "toBeVisible"` |
| 92.0 | `Navigate to "/"` |

The password-strength meter, which is where the official run's clock ran out, costs 9 to 12
ms in the calibrated configuration and 106 ms at 1 CPU. Its `evaluate` is the step Playwright
happened to be inside when the timeout fired, not the step that was slow.

## Step 2: slow-machine simulation

No throttling was needed to reach hosted latency: the `host` configuration already matches
it. The containerised runs bracket it on both sides.

| Configuration | Registration test | Crosses 10 s? | Other tests crossing 10 s |
| --- | --- | --- | --- |
| 2 CPU | 1,036 / 1,044 / 1,132 ms | no | none |
| 1 CPU | 3,190 / 3,299 / 3,490 ms | no | none |
| 0.5 CPU | 11,807 / 12,509 / 13,405 ms | yes | 8 of 9 |

There is no throttle setting that reproduces the official picture of one test at 10 s and
nine tests under 1 s. Uniform slowness moves every test together.

## Step 3: ablations

Each variant is a patch over the archived E057 file, generated by `lab/variants.py`. All
variants were run against the unchanged public tests. Deltas are against the baseline median
in the same configuration.

| Variant | 1 CPU median | delta | `host` median | delta | Runs with a failure |
| --- | --- | --- | --- | --- | --- |
| baseline | 3,299 ms (n=3) | reference | 747 ms (n=18) | reference | 4 of 24 |
| a. minimal register-route DOM | 3,311 ms (n=3) | +0% | 794 ms (n=3) | +6% | 2 of 6 |
| b. no decorative paint | 3,292 ms (n=3) | -0% | 754 ms (n=3) | +1% | 2 of 6 |
| c. in-place input handling | not applicable, see below | | | | |
| d. non-blocking `/api/session` | 2,405 ms (n=3) | -27% | 749 ms (n=3) | +0% | 2 of 6 |
| e. client-side route changes | 2,906 ms (n=3) | -12% | 681 ms (n=3) | -9% | 0 of 6 |
| f. no `location.href` after submit | 3,246 ms (n=3) | -2% | 729 ms (n=3) | -2% | 0 of 6 |
| a+b+d+e+f combined | 2,557 ms (n=6) | -22% | 690 ms (n=6) | -8% | 0 of 12 |

Ablation (c) has nothing to remove. The E057 application already mutates the strength meter
and its segments in place on `input`; it never replaces form DOM nodes, so Playwright never
retries on a detached element there. The only DOM replacement is the whole-route
`app.innerHTML` assignment, which happens on navigation, not on input.

Reproducibility caveat, stated because it is larger than most of the effects above: the
combined variant was measured in two batches of three at 1 CPU, with medians 2,312 ms and
3,005 ms from byte-identical behaviour. Batch-to-batch drift at 1 CPU is therefore comparable
to every individual lever except (d). The `host` configuration is far tighter; its two
combined batches gave 698 ms and 682 ms.

What each variant changes:

- **a** drops the brand bar and nav from the register route, keeping every label, role,
  option text and the exact 账户信息 heading. No effect: the DOM was already small.
- **b** removes the gradient, box shadow, rounded corners, hover rules and CJK font stack.
  No effect: paint was not the constraint.
- **d** renders the route synchronously and patches the top bar when `/api/session` answers,
  instead of awaiting that fetch before any markup exists. This is the only single lever
  worth more than 10% under throttling, and it is worth nothing at hosted latency.
- **e** intercepts clicks on the in-app anchors and swaps the view via `history.pushState`,
  so `openRegister` costs one document load instead of two. Worth 9 to 12% in both
  configurations, the most consistent single lever.
- **f** replaces `window.location.href = '/'` after register, login and logout with an
  in-place re-render plus `history.replaceState`. Costs nothing and buys nothing in time, but
  see the reliability finding below.

### The reliability finding is worth more than any of the timings

Ten of the 48 runs whose application still hands the browser a `window.location.href`
assignment failed nondeterministically, always with `page.goto: net::ERR_ABORTED` or
`page.goto: Navigation ... is interrupted by another navigation`, and always in REQ-1.2.

| Application | Runs | Runs with a failure |
| --- | --- | --- |
| keeps `location.href` after submit (baseline, a, b, d, e) | 48 | 10 |
| replaces it with an in-place re-render (f, combined) | 18 | 0 |

The cause is application-side. After an awaited `fetch`, `submitRegister`, `submitLogin` and
`signOut` all assign `window.location.href = '/'`. That navigation starts while the test is
already issuing its next action, and `page.goto` races it. The helper `signOut` compounds the
exposure, because `/登录|login/i` also matches the still-present 退出登录 link, so the
assertion meant to wait for the logged-out page passes in about 3 ms against the old page and
hands control back before the navigation has committed.

Removing self-navigation after a form submit is the single highest-value application-side
constraint found here, because it removes a class of nondeterministic failure rather than
shaving milliseconds. The eighteen runs behind the zero are enough to make chance unlikely at
the observed 21% per-run failure rate, but not enough to call the rate zero.

## Step 4: the worker-fixture hypothesis is false

Playwright 1.57.0 does not charge the worker-scoped browser launch to the first test in a
file. Two independent measurements:

- Across all 15 `host` stability runs, the reported test duration equals the trace span from
  the end of the `browser` fixture to the end of the test, to within 3 to 4 ms, while
  `Launch browser` (287 to 745 ms, one run at 1,540 ms on a cold Chrome) sits entirely
  outside that span.
- A scratch copy of the spec with a trivial first test (kept out of the reported public-test
  replays) moved the registration test from a median of 747 ms to 648 ms at `host` and from
  3,299 ms to 2,916 ms at 1 CPU. Had the launch been inside the clock, handing it to a
  warm-up test would have cut the registration test by the launch time, 287 to 745 ms at
  `host`. It fell by 99 ms. The warm-up test itself took 337 / 217 / 263 ms, which is one
  `page.goto`, not a browser launch.

The residual 11 to 12% is first-request warm-up of the application process and Chromium's
code caches, not fixture setup. It is not available to us, since the tests are fixed.

## Ranked application-side constraints for the generation prompt

Each entry states the measured saving at the calibrated `host` latency, which is the latency
the official runner actually had.

1. **Never navigate the browser yourself after a form submit.** Re-render in place and use
   `history.replaceState`. Saving: 2% of the registration test, and no failures in the 18
   runs of the two variants that do this, against 10 failures in the 48 runs of the five that
   do not. This is a correctness constraint, not a performance one.
2. **Change routes without a document load.** Intercept clicks on in-app anchors and swap the
   view. Saving: 9% at `host`, 12% at 1 CPU. Most consistent single lever.
3. **Never block first paint on a network round trip.** Render the route synchronously, then
   patch whatever the session answer changes. Saving: 0% at `host`, 27% at 1 CPU. Buy it as
   insurance against a slow runner, not as a speed-up.
4. **Everything else measured is noise.** Minimal register-route DOM and removing decorative
   CSS both landed within the run-to-run spread in both configurations, and in-place input
   handling was already satisfied.

All levers combined save 8% at `host` and 22% at 1 CPU. Stated plainly: **no lever, and not
even all of them together, saves more than 10% of the registration test at the latency the
hosted runner had.** The test costs 747 ms against a 10,000 ms budget; the failing run lost
roughly 9.3 s somewhere that this bench cannot reach, and application-side tuning is not the
remedy for it. If E057 is resubmitted, constraint 1 is the change most likely to matter,
because the failure mode it removes is nondeterministic and was observed in 10 of 48 runs.

## Method

The application under test is the archived E057 candidate
(`runs/worktree-archive-20260912/lean-acceptance/runs/e057-dev35-repair-flash`), copied into
`lab/variants/baseline/`. The archive itself was never written to. The public tests are used
byte for byte from `runs/20260912-objective-review/public-tests/`.

Two execution modes:

- **host**: the application runs in the same 1-CPU / 256 MB container the earlier E057 replay
  used, reached through the volo launcher proxy on port 3301. Playwright 1.57.0 and Google
  Chrome run on macOS.
- **cpuN**: the application and the Playwright runner both run inside one
  `hermes-agent:latest` container limited with `--cpus=N --memory=2g`, using
  `chromium_headless_shell-1217`, application on port 3000.

Both use the hosted Playwright settings: `workers: 4`, `fullyParallel: false`, test timeout
10,000 ms, expect timeout 10,000 ms, `retries: 0`, screenshot and video off. Per-action
timelines come from `test.trace` inside each `trace.zip`; only leaf steps are summed, so
wrapper steps are never double counted.

One variant build was defective on its first pass: the standalone client-routing variant
called a helper that only existed in the non-blocking-session variant, so all ten tests timed
out. Those six runs are retained in the evidence file under
`e-client-routing-DEFECTIVE-BUILD` and are excluded from every table above; the corrected
build was re-measured from scratch.

## Environment differences from the hosted runner

| Property | Hosted E057 run | This bench |
| --- | --- | --- |
| Architecture | linux x64 | darwin arm64 (`host`), linux arm64 (`cpuN`) |
| Node | 20.19.3 | 20.19.2 in the container; host Node for the runner |
| Browser | Playwright channel `chromium` | Google Chrome (`host`), `chromium_headless_shell-1217` (`cpuN`) |
| Playwright | 1.57.0 | 1.57.0, same module |
| Trace | off | on, so per-action timings exist; inflates every measurement slightly and equally |
| baseURL | `http://127.0.0.1:3000` | container-mapped port via the launcher proxy (`host`), `http://127.0.0.1:3000` (`cpuN`) |
| Application container | organizer's runner | 1 CPU / 256 MB (`host`), shared with the runner (`cpuN`) |

The `host` mode's application container is CPU-limited while its browser is not; the `cpuN`
modes limit both together. Neither is an exact image of the hosted runner, but the `host` mode
matches its observed light-test latencies to within the run-to-run spread, which is the
property the measurements depend on.
