# Next evidence gates toward the final

The practice leaderboard is one milestone. These gates test whether the same agent
can handle changing and larger requirements, rather than repeating a fixed demo.

1. **Incremental development:** run Smoke Evolution from this agent's own verified
   Counter and Dice outputs. Pass both original behavior and added requirements.
   Inspect whether the agent preserves working code and regression assertions.
   **Completed with v0.6.0:** both tasks passed 2/2 official tests; rank 1 at observation.
2. **Stateful application:** complete all currently published Ticket Booking tests.
   Independently check server-side validation, persistence after restart, session
   invalidation and duplicate-account handling described by the requirements.
   **Current evidence:** E020 reads all three image references successfully, passes
   5/10 official tests and 9/10 in a local public-test replay. Its code and self-checks
   still omit the same visual detail. Dev7 generates fixed browser acceptance checks
   from inputs before implementation. Evaluate that candidate next. Official page crashes
   and timeouts did not reproduce locally; their exact cause remains unconfirmed.
3. **Transfer:** run unseen variants of small requirements, then a larger public task.
   Freeze the agent version before the held-out variant; do not embed expected
   applications or change official tests. Track failures by parsing, generation,
   integration, runtime and evaluation stage.
4. **Formal preliminary:** when the actual GitHub/Spreadsheets task packs and score
   weights are published, freeze their versions and map shared authentication,
   organization permissions, workflows, rulesets and audit dependencies.
   Optimize only from measured pass rate, metered tokens/cost and wall time.
5. **Final preparation:** preserve prompts, tool events, measured usage, source
   revisions, interventions and official result links. Keep a runnable demonstration
   ready while the official pages disagree on whether a video is mandatory.

## Current limitations to address before broad claims

- Full image observation works through the organizer's gateway. Faithful implementation
  of every observed detail is not established merely by a successful observation.
- Requirement batching is deterministic, but large-project quality and stable
  long-run recovery still need real evaluations. Version 0.7.0.dev1 passed local context
  pressure/repair checks and schedules all supplied documents; gateway validation remains.
- Agent-authored assertions are useful for repair, not an independent accuracy oracle.
- Gateway token totals sometimes differ from response totals; E017's discrepancy
  is larger than cached prompt tokens and its cause is unconfirmed. Keep both figures
  and use official metering for leaderboard claims. Other runs share the account.
- Platform archive/log access has intermittently failed. Preserve available local
  artifacts and avoid claiming an exact trace when it could not be retrieved.

Do not change the agent solely to exploit the practice score presentation. The
desired advantage is repeatable correctness with less unnecessary model work.
