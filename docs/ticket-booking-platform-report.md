# Ticket Booking archive inconsistency

Observed 2026-09-11 on [Ticket Booking](https://arc-bench.com/competitions/ticket-booking/tasks/ticket-booking--ticket-booking).
Prepared for the user to forward to the organizer; no external report was sent by the agent.

Account/team: `VOLO-AI` / `VOLO AI`.

1. Saving `volo-factory-ticket-v0.6.0-0abcf10-r2` succeeded, producing submission
   `32d6d2fe7737`.
2. `GET /api/submissions/32d6d2fe7737/archive` returned HTTP 200. The downloaded ZIP
   matched the uploaded archive exactly: SHA-256
   `f8683f93a2bf5668bda76a295e4e684790b24b6a5f601c451ef4311043f6ab27`.
3. The task page then sent `POST /api/runs` with multipart fields
   `submission_id=32d6d2fe7737` and `requirement_id=ticket-booking--ticket-booking`.
   Response: HTTP 409, `{"detail":"The submitted agent archive is no longer available"}`.
4. A packaging control containing the identical agent source plus `build-info.json`
   saved as `volo-factory-ticket-v0.6.0-buildinfo`, submission `b1b0dc34ca64`.
   Its archive download returned HTTP 404. No run was attempted for this missing archive.

The same agent source already executed successfully in Smoke and Smoke Evolution.
The Ticket Booking failures happened before model generation or official evaluation;
there is no Ticket Booking model run or score to assess from these attempts.

Please check consistency between archive save, download and run-creation storage paths
or backends for these IDs. Client evidence establishes the contradictory availability
results, but does not identify the server-side root cause. Repeated re-uploads were
stopped after the controls above.
