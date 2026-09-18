# VOLO Factory strategy

Updated 2026-09-11. Goal: win the final of the GOSIM Software Factory hackathon.
This implementation starts from scratch. Prior smoke code is not an input.

## Verified contest facts

- Bootcamp: September 7–20. Preliminary: September 21–30. Final: October 1–7.
- The preliminary involves selected GitHub and Spreadsheets features, including Actions,
  organization permissions, audit and rulesets. The top 20 advance to a harder enterprise task.
- The official site labels the current Smoke leaderboard as a public practice competition,
  **not the formal preliminary ranking**.
- Official evaluation measures GUI test pass rate, all model tokens metered by the gateway,
  and elapsed wall time. The final weights are not yet published.
- Organizer-issued Kimi, GLM, MiniMax and DeepSeek models use the unified gateway.
- The harness may change; evaluator tests, gateway metering and scoring may not.
- There are two special prizes. A practice leaderboard first place is a milestone, not a final win.
- The rules page lists runnable source/startup, production traces and a 3–5 minute demo;
  the homepage FAQ says only an agent is required. This discrepancy needs organizer clarification
  before final delivery. Preserve evidence and an executable demo either way.

Sources: [official home](https://create.gosim.org/factory26/),
[rules](https://create.gosim.org/factory26/rules),
[course labs](https://github.com/code-philia/agentic-software-engineering-hackathon),
[practice platform](https://arc-bench.com/competition).

## Design and immediate evidence gates

1. Parse the requirement dependency graph deterministically. Do not spend model tokens
   rediscovering hierarchy, dependencies or file names.
2. Give small tasks one bounded working context. For larger requirements, schedule small
   dependency-ordered batches, retain the generated application and verify regressions.
3. Use a compact tool loop with file batching, exact edits, bounded commands, and real
   build/start/check execution. Reuse the stable prompt prefix; do not resend verbose logs.
4. Require successful verification of the current source before accepting completion.
   A model saying "done" does not finish a run.
5. Save reproducible inputs, model usage, tool evidence and checkpoints. Resume only when
   requirement and source fingerprints match. Preserve the existing project for evolution tasks.
6. Treat official GUI results as the performance evidence. Local synthetic transport tests
   verify protocol plumbing, not the model's coding ability.

Initial experiment: actual model generation on Smoke, then Evolution using its generated
outputs. Promotion requires all official tests passing with nonzero, correctly metered
useful model work. Next: Ticket Booking, followed by broader unseen requirement variations.
Optimize tokens and time only after repeatable correctness; the formal scoring weights are unknown.

## Practice leaderboard snapshot (2026-09-11)

| Track | Current leading account | Pass rate | Metered model cost | Average runtime |
|---|---|---:|---:|---:|
| Smoke | 睿欣达工场 | 100% | CNY 0.328128 | 123 s |
| Smoke Evolution | 睿欣达工场 | 100% | CNY 1.371543 | 367 s |
| Ticket Booking | ARC | 100% | CNY 4.483621 | 3976 s |

These are practice snapshots. They do not establish the final contest's scoring function.
Sources: [Smoke leaderboard API](https://arc-bench.com/api/competitions/leaderboard?track=all&competition_id=smoke),
[Evolution leaderboard API](https://arc-bench.com/api/competitions/leaderboard?track=all&competition_id=smoke-evolution),
[Ticket Booking leaderboard API](https://arc-bench.com/api/competitions/leaderboard?track=all&competition_id=ticket-booking).
These links are live; the table above is the dated observation, not a promise of current standings.

## Open questions

- Final score weights, tie-breaking, and aggregation across repeated submissions.
- Formal task publication, holdout evaluation and allowed reference implementations.
- Model choices actually enabled by the competition gateway and allotted team token budget.
- Whether a demo video is required (conflicting official pages).

Do not delay the local implementation for these questions. Do not claim the unknown rules are settled.
