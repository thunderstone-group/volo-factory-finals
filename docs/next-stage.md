# Next evidence gates toward the final

The practice leaderboard is one milestone. These gates test whether the same agent
can handle changing and larger requirements, rather than repeating a fixed demo.

1. **Incremental development:** run Smoke Evolution from this agent's own verified
   Counter and Dice outputs. Pass both original behavior and added requirements.
   Inspect whether the agent preserves working code and regression assertions.
   **Passed with v0.6.0:** both tasks passed 2/2 official tests. The refreshed September
   12 board returns to **rank 1 with dev16 / Qwen3.6 Flash**: 4/4, CNY 0.017810,
   seven seconds average. Source is frozen under `v0.7.0-dev16`.
2. **Stateful application:** reach first place on the published Ticket Booking board,
   reporting the actual pass rate and remaining failures even if rank 1 is below 10/10.
   Independently check server-side validation, persistence after restart, session
   invalidation and duplicate-account handling described by the requirements.
   **Current evidence:** E020 reads all three image references successfully, passes
   5/10 official tests and 9/10 in a local public-test replay. Its code and self-checks
   still omit the same visual detail. Generated fixed scripts introduced runtime and
   shared-data errors; their data-only replacement still misinterpreted alternatives as
   extra controls. Dev20 removes that extra planning call and returns implementation and
   checks to the complete original inputs. E037 completes verification and repair but
   scores 3/10 officially; its local 5/10 replay becomes 10/10 after diagnostic-only
   meter/alert markup changes. Read-only reviewer probes miss those gaps, so no review
   layer is added. Dev21 makes these semantics explicit; dev22 uses Kimi's documented
   low effort. Kimi then reaches self-checks but exhausts its budget at 11/28, before
   official evaluation. Pro also reaches browser checks but exhausts its budget before
   completing repair. Dev23 applies the already-tested generic runtime to bounded new
   apps, removing generated boilerplate. Its first run writes the whole product in one
   call but exposes a missing browser base URL. Dev24 repairs that helper and passes a
   real Chrome navigation regression. E043 then reaches the app but wastes its check
   budget on repeated missing-label timeouts; its full-bundle repair leaves that defect
   unchanged. Dev25 opens narrow source repairs after the first failed bounded build,
   preserves both ends of error logs and bounds missing-control waits to five seconds.
   Qwen3.8 Max reaches that repair path but still exhausts its budget with 1/8 self-checks
   passing. Its generated request-body reader never resolves, while errors show only UI
   timeouts. Dev26 adds actual page/pending-request diagnostics and an independent check
   for unnamed visible meters. E045 uses those diagnostics to reach 8/8 self-checks,
   but official tests score 0/10 because a second registration link uses another alias.
   Removing only duplicate homepage shortcuts in an offline diagnostic copy produces
   10/10. Dev27 adds a generic primary-destination uniqueness check; its official
   Ticket validation remains the next gate. The diagnostic app is never uploaded.
   Official page crashes
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
