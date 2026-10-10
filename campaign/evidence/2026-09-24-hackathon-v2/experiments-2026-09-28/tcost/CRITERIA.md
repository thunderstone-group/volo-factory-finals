# Cheaper written tests: criteria written before the suites came back (09-28 11:05)

Why: every official run since 09-27 06:00 hit a per-run key wall at CNY 6.2-7.6; the written suite alone costs
CNY 4-5.4 a task (92 % of its output is reasoning), so the repair loop gets 1-2 yuan before the wall. A cheaper suite
buys repair rounds inside the wall and lowers b (S ~ b^-0.1).

Arms (Sheet, same requirements, practice key, flash, one suite each): scenarios per file 8 (current, 16 files),
16 (8 files), 99 (one file per top-level requirement group, 5 files).

Measure on 10 apps with known hidden scores (43 b491, 53 e6cf, 56 a440, 69 ad9a, 78 ed1e, 79 2c8e, 79 4c98,
80 f49b, 81 f686, 82 fa94): Spearman of written passes vs hidden, own-code errors per app, suite cost.

An arm replaces the current grouping when all hold:
1. suite cost at least 30 % below the 8-per-file arm;
2. Spearman >= 0.85 (the 8-per-file arm scored 0.93-0.97 on 8 apps on 09-27);
3. mean own-code errors at most 5 above the 8-per-file arm;
4. no file lost to a length cut (finish `length` with no usable block).
One sample per arm: a pass is a candidate for one official submission, not a proven effect.

## Arm `cov` (roadmap 4.30: tests cover every behaviour the description states), 8 per file

Extra measure: on the five best apps (hidden 78-82: ed1e, 4c98, f49b, f686, fa94) count the requirements where the
hidden-intent evaluator fails a test AND the written suite fails a test of the same requirement (defects the suite
can hand to the repair loop). `cov` goes to a full local A/B (roadmap 4.30 judge: +3 mean evaluator passes over two
runs) when it catches at least 3 more such requirements than `g8`, with Spearman >= 0.85 and own-code errors at most
5 above `g8`.

## Arm `cov99` (4.30 prompt + one file per group), written 11:50 after `cov` failed criterion 3

`cov` caught 13 of 18 evaluator-failed requirements (g8 7, g99 10), Spearman 0.899, but 24 own-code errors on every
app (errors 35.7 vs g8 21.3). `cov99` replaces g99 when: caught >= 13 of 18; Spearman >= 0.85; errors per app at most
10.8 (g99 5.8 + 5); cost at most 30 % above g99 (2.98).

## `cov99` + suite mend (written 12:05, after cov99 missed criterion 3 with a constant 13 own-code errors)

The pipeline mends files whose tests broke in their own code (roadmap 4.25, one writer call per such file) before the
repair loop, so the fair comparison includes it. Mend once from the 4c98 report, rerun on the ten apps. cov99+mend
replaces g99 when: errors per app <= 10.8; caught >= 13 of 18; Spearman >= 0.85; write + mend <= CNY 2.98.

## Results 12:10
- cov99: CNY 2.16, caught 13/18, Spearman 0.863, errors 16.1 (13 own-code on every app: t01 titles dropped the
  `<id>: ` prefix, masked names repeat, Playwright refuses duplicate titles, the file does not load). Mend (CNY 0.19)
  rejected by the faithfulness check. Criterion 3 missed: 4.30 not adopted. cov (8 per file) had the same failure
  shape (24 own-code). Candidate follow-up: normalise test titles to the listed ids after writing.

## `cov99` + title normalisation (written 12:25, before its runs)

`name_tests` (branch fix/test-titles) gives bare-name titles their listed ids; on cov99's t01 the duplicates go from
3 to 0 and Playwright lists 100 tests in 5 files. Same bar as the mend attempt: errors per app <= 10.8, caught >= 13 of
18, Spearman >= 0.85 (cost unchanged, 2.16). If met, the 4.30 prompt joins the package together with name_tests.
