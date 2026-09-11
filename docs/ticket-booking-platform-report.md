# Ticket Booking storage observations

**Latest observation, 2026-09-11 around 08:38 UTC:** saving, downloading, creating and
queueing a run succeed, but two runs of submission `ac411627b87f` failed during deployment
because the executor could not find its run-local `agent.zip`. The saved archive still
downloads with the exact upload hash. Earlier CLI runs `0726df707e05` and `2ee804a2030f`
did execute the agent. These are distinct dated observations, not one diagnosed outage.

## Current deployment failure

- Submission: `ac411627b87f`, `volo-factory-ticket-v0.7.0-dev3-2793296-cli`.
- Upload and a second archive download after both failures match SHA-256
  `82413746aba52bb0802dddb07ed18f19672e6a73209f2b8772882d7c1081297b`.
- Run creation and start both succeeded, returning QUEUED. The runs then failed in
  `deploy_agent`, before any model execution:
  - https://arc-bench.com/runs/fcc9a2ee4c3e
  - https://arc-bench.com/runs/3ddae12e17ac
- Error: `[Errno 2] No such file or directory:
  '/mnt/arcbench/bucket-15/users/<account>/runs/<run-id>/agent.zip'`.
  Account-specific path text is omitted here; both run pages contain the complete error.
- The CLI sent the official frontend's multipart `submission_id` and `requirement_id`
  fields to `/api/runs`, followed by POST `/api/runs/{id}/start`. It did not re-upload
  between the two attempts. No further identical run was attempted after the retry.

Please inspect the saved-archive to run-directory copy and the executor's storage
visibility for these IDs. Client evidence does not identify the server-side cause.

## Earlier archive availability observations

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

## Earlier successful recheck through the CLI

The organizer reported that the submission path was currently normal. We rechecked
using the deployed official web client's request contract and the logged-in account:

- `32d6d2fe7737` still downloaded with the original matching hash, but creating a run
  now returned 409: `Runs must use the latest saved agent submission for this competition`.
  That is a different response from the earlier archive-availability error.
- `b1b0dc34ca64` still returned archive 404. It was not run.
- Fresh submission `c522484096e0`, candidate 0.7.0.dev1, saved successfully. Its downloaded
  SHA-256 matched `835e2d7cf7fe84168fa8888480c1d6df8b8735d49e24edfc9043ecae14335475`.
- Creating and starting `0726df707e05` succeeded. CLI polling observed QUEUED, RUNNING,
  then FAILED in agent execution. Downloading its generated artifact also succeeded.

Those checks confirmed the path worked with a new latest submission at that time. They do
not retrospectively identify the server-side cause of the earlier archive errors.
