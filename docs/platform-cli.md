# ArcBench CLI

`./arcbench` calls the same website API as the official web client. It is a local
operations tool, separate from `main.py`, which is the agent entrypoint inside the
competition runner. The CLI and its session are excluded from uploaded agent ZIPs.
It uses Python 3.9+ and the standard library, with no browser needed for normal operations.

The user also supplied [thunderstone-group/arcbench-cli](https://github.com/thunderstone-group/arcbench-cli),
checked at commit `6df264e05f52a8c2e4062e66c3f9bf89e6c0beb9`. Its task fetch and
submit/create/start chain were exercised on E017. It uses a dedicated private
`ARCBENCH_ENV_FILE`, leaving other users' CLI configuration untouched. Its package/replay
paths that depend on another harness were not used. This repository's thin CLI remains
useful for archive hashing, balance, logs and compact status; neither CLI is in the upload.

## Commands

Run from the repository root:

```sh
./arcbench whoami
./arcbench balance
./arcbench competitions
./arcbench tasks ticket-booking
./arcbench submissions --competition ticket-booking

./arcbench upload dist/volo-factory.zip \
  --competition ticket-booking --name my-agent-version
# Use the returned submission.id:
./arcbench run SUBMISSION_ID --task ticket-booking--ticket-booking

./arcbench status RUN_ID
./arcbench wait RUN_ID --interval 10 --timeout 1200
./arcbench logs RUN_ID --tail 30
./arcbench logs RUN_ID --offset NEXT_OFFSET --tail 30
./arcbench download RUN_ID --output runs/my-run/artifact.zip
./arcbench source RUN_ID .factory/events.jsonl --output runs/my-run/events.jsonl
./arcbench cancel RUN_ID
./arcbench leaderboard --competition ticket-booking --team 'VOLO AI'
```

Output is compact JSON; `wait` emits JSON lines only when the summarized state changes.
The summary includes official pass counts/rate, duration, model usage, explicit cost
currency, execution stages and failed tests. The API field `token_cost_usd` is not
assumed to mean USD: actual observed responses use `token_cost_currency: CNY`.
`status --full` returns the redacted full response when more detail is needed.
`logs` returns a bounded console tail and cursor without duplicating stdout and console.

`upload` saves a submission, downloads its archive and checks the SHA-256 against the
local ZIP. A missing or mismatched download returns nonzero but retains the saved ID.
Saving, creating a run and starting it are distinct operations. `run` performs create
then start. If start fails, the output retains the created run ID; inspect it before
using `./arcbench start RUN_ID`. Mutating requests are never automatically retried.
Network failures and server errors can have uncertain outcomes.
`cancel` sends one cancellation request and then reads the run state. If its POST
returns an error, inspect `status` before taking further action: E012 returned HTTP
500 even though the state changed to CANCELLED. No automatic retry is made.

The live server currently requires the latest saved submission for a competition.
Do not create another upload while a run from the previous version is pending.
`wait` handles the observed QUEUED state and waits through unknown intermediate states.
It exits 0 on PASSED, 1 on failure/cancellation/pause, and 2 when the local waiting
deadline expires. Timing out the wait does not cancel the remote run.
Archive downloads refuse to overwrite an existing local file.

During an observed status poll, the server closed after 993 bytes with 1,010 bytes
still expected. The client now reports incomplete HTTP bodies as transport failures.
`wait` tolerates up to two consecutive transport/5xx failures within its deadline,
then performs a fresh read. It never treats a partial response as a run result or
retries a mutation. Two actual local HTTP truncation regressions cover these boundaries;
all 15 CLI checks pass after the change. The uploaded agent archive is unaffected.

## Authentication

The existing authorized Chrome session was imported once. Future CLI requests use
`~/.config/volo-factory/arcbench-session.json`, with mode 0600. The file is outside the
repository and contains only cookies for the configured origin, including the website's
route-affinity cookie. Cookie updates from the server are preserved.

If the session expires, use a fresh authorized browser export. For an agent-assisted
handoff, `./arcbench auth-import --listen` opens a single-use localhost form for the
origin-scoped cookie JSON. The form expires after three minutes, accepts only a matching
same-origin POST, validates the session with `/auth/me`, and then closes. It does not
put cookies in a URL or command arguments. An unsuccessful import does not replace an
existing session file. No browser control is required after this one-time handoff.

An existing private export can also be piped to `./arcbench auth-import` on stdin. The
expected shape is `{"origin":"https://arc-bench.com","cookies":[...]}`, with Chrome/CDP
cookie fields `name`, `value`, `domain`, `path`, `secure`, `httpOnly` and `expires`.
Never paste a session export or model key into chat, a command argument, or Git.

By default, upload retrieves the logged-in account's model access key directly from
`/auth/access-key` and submits it to the official platform without printing or saving it.
To use an explicitly configured key, pass its environment variable name with
`--api-key-env VARIABLE_NAME`. The model gateway defaults to `https://api.arc-bench.com/v1`.
CLI output redacts credential fields, known keys/session values and meter identifiers.
Authenticated redirects to another origin are refused.

The metering site has a separate cookie session. `./arcbench auth-import --meter --listen`
imports an existing authorized meter session with the same private one-use form, validates
it against `/api/user/me`, and saves `~/.config/volo-factory/meter-session.json` with mode
0600. This handoff has been completed using the user's logged-in meter tab. `balance`
now reads its balance, currency, synchronization timestamp and pending billing-event
count directly. Decimal balances remain strings; a zero balance is not treated as missing.
Neither service's session cookies are sent to the other service.

The balance contract comes from the meter's deployed
[user client](https://meter.arc-bench.com/user.js), inspected on 2026-09-11:
`GET /api/user/balance` and `GET /api/user/freshness`. It was verified against the live
account and complemented by a local contract check with synthetic amounts.

## Contract source and verification

The API contract was read from the official site's deployed
[client bundle](https://arc-bench.com/assets/index-BoG82IpV.js) on 2026-09-11, SHA-256
`33eb789dc513b1725ced0642cf4157e37c87b98a5b63a00253c1808c7643feb9`.
This bundle is not vendored. The client uses `/api` and cookie credentials, with these
observed request shapes:

| Operation | Method and route | Body |
|---|---|---|
| Save upload | `POST /api/submissions` | Multipart competition_id, runtime, catalog, agent_source, display_name, base_url, api_key, model, file |
| Download upload | `GET /api/submissions/{id}/archive` | None |
| Create run | `POST /api/runs` | Multipart submission_id, requirement_id |
| Start run | `POST /api/runs/{id}/start` | None |
| Cancel run | `POST /api/runs/{id}/cancel` | None |
| Status/logs | `GET /api/runs/{id}` and `/logs` | Logs accept log_offset |
| Generated artifact | `GET /api/runs/{id}/workspace/template-bundle` | None |

Real integration evidence is recorded in `experiments.md`. Local HTTP tests validate
multipart bytes, cookie affinity, private persistence, redaction, redirect boundaries,
archive verification, create/start failure handling and waiting through QUEUED.
A labeled real status fixture validates the actual pass-count and currency fields.
Those tests complement the real platform run; they do not substitute for it.

`source` uses the official file viewer's `GET /api/runs/{id}/source?file_path=...&kind=file`
route, verified against E020's live observation cache, app source and event trace. It saves
one redacted text file with mode 0600 and prints only metadata. This avoids downloading
the entire template ZIP merely to inspect a small diagnostic file. The output path must
not exist. All 16 CLI checks pass after adding its request/redaction contract.
