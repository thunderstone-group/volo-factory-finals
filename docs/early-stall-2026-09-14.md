# The hosted early-window stall is the runner's, not ours (2026-09-14)

Handoff item 1 asked why official Ticket Booking runs lose tests that start in the first 10 to
17 seconds of the test phase, and named three suspects on our side: process-tree teardown, app
cold start, and the 3000/3301 relay. All three are excluded. The stall is a property of the hosted
runner at suite start, it has hit 6 of the last 10 Ticket runs on this account, and no change to
the agent can remove it. Per-test rows for all ten runs are in
[`evidence/2026-09-14-early-stall.json`](evidence/2026-09-14-early-stall.json); the raw Playwright
JSON reports, run logs and full statuses are kept locally under `runs/2026-09-14-early-stall/`.

## The pattern, from the Playwright JSON reports

The hosted runner requests 4 workers and gets 2 (`actualWorkers: 2`), one per spec file. Playwright
tears a worker down after a failed test and starts a replacement, so `workerIndex` 2 and above are
replacements. Aligning every result by worker and start time:

| Run | Date | Score | w0 first test | w1 first test | Replacement workers |
| --- | --- | --- | --- | --- | --- |
| 01b06fb30564 | 09-14 | 10/10 | 2,299 ms pass | 2,902 ms pass | none |
| d855ead6df43 | 09-14 | 10/10 | 2,218 ms pass | 3,112 ms pass | none |
| b6b89caa3f8c | 09-14 | 10/10 | 1,707 ms pass | 2,108 ms pass | none |
| e34e78400983 | 09-14 | 10/10 | 2,240 ms pass | 2,503 ms pass | none |
| a129e387e562 | 09-12 | 9/10 | 10,013 ms timeout | 989 ms pass | w2 passes 5/5 |
| bef9631c8245 | 09-12 | 9/10 | 1,382 ms pass | 15,016 ms timeout | w2 passes 3/3 |
| fef7c9c91778 | 09-12 | 9/10 | 1,531 ms pass | 15,015 ms timeout | w2 passes 3/3 |
| c399145c5eb1 | 09-14 | 8/10 | 10,011 ms timeout | 15,017 ms timeout | w2 5/5, w3 3/3 |
| 92220c94fd25 | 09-14 | 7/10 | 10,013 ms timeout | 1,193 ms crash | w2 first test crashed, w3 5/5, w4 2/2 |
| c4a7908ca693 | 09-12 | 7/10 | 10,012 ms timeout | 1,613 ms crash | w2 first test hung 15 s, w3 5/5, w4 2/2 |

Every failure is the first test of an initial worker, or the first test of the first replacement
worker started while the window was still open. Every later test passes, and passes faster
(241 to 980 ms) than the first tests of the clean runs (1.7 to 3.1 s). Nothing after the window
is slow, so the application is not heavy and the server is not wedged.

## Why our side is excluded

- **Three of the affected runs had no agent phase to speak of.** `c4a7908ca693`, `fef7c9c91778`
  and `bef9631c8245` are the 09-12 security-reproduction runs: one 25-token model call wrote a
  canned application, the run finished in 1 s, there was no self-check, no browser launched by us,
  and no `.volo` launcher (`start` is `node server.cjs`). They show the identical signature. So
  process-tree teardown, self-check browser pressure (the target of PR #22) and the 3000/3301 relay
  are not necessary for the stall.
- **Password hashing is not the discriminator.** Three clean 10/10 runs (`01b06fb30564`,
  `d855ead6df43`, `b6b89caa3f8c`) use `scryptSync` exactly like the failing ones.
- **App boot order is the same on both sides.** The failed `c399145c5eb1` and the clean
  `e34e78400983` both render nothing until `GET /api/me` returns, then route.
- **Cold start is not it.** In the failing runs the first tests got as far as visible form fields
  (`locator resolved to visible <select id="r-doctype">`) before hanging, and the deploy phase
  (install, build, server ready) took under 2 s in every run.
- **The agent-to-suite gap is identical.** Agent exit to `playwright test` start is 3 s in the
  failing runs and 3 s in the clean ones.
- **PR #22 could not have fixed it and did not.** `c399145c5eb1` ran with one browser per check
  run and lost both initial workers.

## What the failure signatures mean

- `locator.evaluate: Test timeout exceeded` right after `expect(control).toBeVisible()` passed on
  the same locator, with the call log stuck at `waiting for getByLabel(...)`, is a renderer or
  worker that stopped answering. `element.tagName.toLowerCase()` cannot block.
- The two login tests that failed in about 1.2 s with `element(s) not found` did not skip their
  10 s expect. `Frame._expect` in `playwright-core/lib/server/frames.js` catches any non-timeout
  exception raised while polling, such as a renderer crash, and reports the last intermediate poll
  result instead of the exception. In both runs the next test on the replacement worker reported
  `Target crashed` or hung for 15 s, which is the browser that died.
- `Target crashed` is a Chromium renderer killed under it. With the whole run in one container
  (`/workspace/tests`, `/opt/arcbench/node_modules/playwright`, `/ms-playwright/chromium-1200` are
  the same paths our self-check discovered), two browsers launching at once plus two workers
  compiling specs is the peak of the run. Whether the trigger is the memory limit, the CPU quota or
  a noisy host cannot be read from our side: container logs are collected empty and the workspace
  exposes no cgroup facts.
- The built-in `browser` fixture carries `timeout: 0`, so browser launch time is not charged to the
  first test; the stall is inside the test body.
- No failed result has attachments, so the hosted runner records neither trace nor video. The local
  gate's trace/video-off setting matches the runner; what it does not match is running the browsers
  inside the same resource-limited container as the app.

## The 09-14 regression note, corrected

`ticket-regression-2026-09-14.md` read the 7/10 run correctly as a browser fault and wrongly
proposed self-check browser churn as the one lever in our control. The churn was real and removing
it was harmless, but the security-reproduction runs show the stall without any browser of ours.

## Consequences

- **Ticket board.** Rank 1 (`你也秃对不队`) is a canned application at 80% and CNY 0.000024; rank 2
  (`net1111`) is 100% at CNY 0.423495; our row is 100% at CNY 0.899558, rank 7. Each of our runs is a
  cost draw between 0.63 and 0.90 and has carried a roughly 60% chance of losing one to three tests
  to this stall. Re-running the current package cannot reach rank 1; only a generation cost cut to
  about CNY 0.4 at 100% moves the row, and that is the objective-function line of work. Our 8/10 run
  at CNY 0.529 did not replace the row, so a failed trial does not cost board position.
- **Big board.** Two lost tests per suite is under 2% on 126 to 138 tests and irrelevant to the
  80% threshold there.
- **Formal round.** If the formal runner has the same start-of-suite behaviour, every team on a
  10-test task carries the same 20 to 30 point risk. That is the organizer's to fix: retries of 1,
  a warm-up test, or a longer timeout on the first test per worker would remove it. Reporting it,
  with these run ids, is a decision for the team lead.
- **Local gate.** `harness_lab/local_gate.py` puts only the application in the 1 CPU / 256 MB
  container and runs Chrome on the host. It cannot see this failure class and should not be read as
  predicting it. A faithful replica would run app, workers and browsers in one limited container.

## Not done

- No local reproduction under a single cgroup was attempted; the mechanism (memory vs CPU vs host)
  remains unread. A bounded experiment in the `arc-reproduction:latest` image with the official
  specs, two workers and a memory or CPU sweep would settle it without spending a trial.
- The board's row selection is not fully understood: rank 1 shows an 80% row while our own 80%
  run (status `FAILED`) did not replace our 100% row.
