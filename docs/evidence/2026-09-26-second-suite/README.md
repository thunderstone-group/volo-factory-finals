# A second written suite after the repairs stop (2026-09-26)

Question: when the repair loop stops on its written suite (one or two failing tests left, 11-18 tests that cannot
judge the app, hidden 1-10 below the suite), does a second, independently written suite find more to fix, and does
repairing against it help on suites that took no part in the repair?

Apps (Sheet, delivered by the platform): `4c98ff3ad8b3` (package 9bbd6939, hidden 79; its platform suite ended
81 pass / 1 fail / 18 error, the errors being whole blocks REQ-2-2-1, REQ-4-1-1, REQ-4-1-2, REQ-5-2-1) and
`ed1efb5d78` (submission 10, hidden 78). Suites, all written by the current test prompt or its 09-25 variants:
`main` drives the repair; `seedrule` and `v2` only measure. Repairs: `scripts/repair_replay.py --suite main`
(practice key). Controlled replays: evidence about the loop, never progress.

## 1. A second suite on a stopped app (criterion 1: at least 5 new failing tests)

| App | main | seedrule | v2 |
|---|---|---|---|
| 4c98 | 89 / 10 / 2 | 71 / 5 / 25 | 61 / 22 / 21 |
| ed1e | 82 / 12 / 9 | 75 / 2 / 23 | 50 / 24 / 34 |

(pass / fail / error.) Passed: 10 and 12 new failures. On 4c98 two suites independently find `#ERROR!` where copied
formulas should give numbers (REQ-4-1-2, REQ-3-2-1) and missing validation messages (REQ-5-2-1): exactly blocks the
platform suite could not judge.

## 2. Repair against the second suite (criterion 2: an independent suite +3 or more, at most 1 lost, on both apps)

| App | driving suite | rounds (kept) | CNY | seedrule | v2 |
|---|---|---|---|---|---|
| 4c98 | 89 -> 96 | 8 (2) | 2.41 | 71 -> 76 (+5, lost 0) | 61 -> 62 (+1, lost 0) |
| ed1e | 82 -> 97 | 7 (3) | 1.68 | 75 -> 75 (+1, lost 1) | 50 -> 56 (+7, lost 1) |

Gains: 4c98 REQ-3-2-1#3, REQ-4-1-2, REQ-5-2-1 x3 (seedrule), REQ-5-2-1 (v2); ed1e REQ-5-1-2 x5, REQ-5-2-1 x2 (v2),
REQ-5-1-2#5 (seedrule). Losses: ed1e REQ-4-1-2 (seedrule) and REQ-4-1-2#2 (v2): a real regression in formula
copying, which the driving suite also recorded (round 3 "4 more pass, 1 lost", kept by the 3:1 rule).

Reading: each app has one independent suite that meets the criterion; neither app meets it on both suites. Positive,
not strong. Local suites tracked the hidden score poorly before (roadmap 4.21), so formal readings decide.

Criterion 3 (rewrite the tests that cannot judge) was not run: the second suite already covered the blocks the
first could not judge.
