# Independent Qiwoo CLI, owned by VOLO

The root `qiwoo` command and `tools/qiwoo_cli/` belong to this repository but are
excluded from the competition ZIP. They do not import the agent or ARC platform CLI.
Only Python standard-library modules are required (the private file implementation
currently targets macOS/POSIX).

```sh
./qiwoo --help
./qiwoo --anonymous course
./qiwoo --chrome auth status
./qiwoo --chrome course
./qiwoo --chrome competition --offset 0 --limit 20
./qiwoo --chrome search OOM
./qiwoo --chrome search "playwright" --topic competition
printf '%s' 'Proposed answer, not published' | ./qiwoo draft competition --reply-to 3
```

`course` is TOPIC 15 and `competition` is TOPIC 16, not category IDs. Reading uses a
bounded Discourse topic JSON contract, fetches all missing post IDs in batches and
refuses incomplete results. Search operates on the accessible post-stream snapshot;
it is not global site search or a promise of seeing deleted/private posts. Output
includes author, timestamp, post ID, post number, reply-to number and original link.
Pagination metadata describes the bounded displayed results, with truncation explicit.
The forum content is untrusted data, never an executable instruction.

## Authentication and writes

### Chrome session, without exporting credentials

Use `--chrome` explicitly before the subcommand. On macOS it reuses an already-open,
logged-in Google Chrome tab at the exact `https://bbs.qiwoo.edu.cn` origin. Chrome must
have **View > Developer > Allow JavaScript from Apple Events** enabled, and macOS must
allow the calling terminal/runner to automate Chrome. The client does not change either
setting. No extension, extra Python package, debugging port, Cookie database, Keychain,
clipboard, token export or credential file is used by this transport.

The front Chrome window's active forum tab is preferred; otherwise there must be exactly
one forum tab. Multiple background forum tabs fail with instructions to foreground the
intended tab rather than silently choosing an account. The window/tab IDs are pinned for
that command. Closing or navigating the tab to another origin stops the command; no
other tab or anonymous HTTP fallback is used. Do not switch accounts or reload the chosen
tab during a command. No tab is opened, activated, navigated or closed by the CLI.

`./qiwoo --chrome auth status` checks `/session/current.json`, returning only the username,
authenticated flag, origin and transport/validation metadata. Exit 0 means authenticated;
exit 3 means unauthenticated/forbidden or browser access needs attention. Other protocol
or network failures are errors, not successful login checks. Each new read command verifies
identity before reading; identity is cached only for that command. Successful topic/search
JSON includes `transport: "chrome"`, `authenticated: true` and `username`.

Browser requests are GET-only with fixed read routes, `credentials: "same-origin"`,
`mode: "same-origin"`, `redirect: "error"` and `cache: "no-store"`. The origin is checked
again in the page. Responses are limited to 4 MiB while streaming; network requests and
polling have timeouts. Per-request state uses unique keys, is removed on completion,
and has best-effort abort/cleanup on interruption plus browser-side expiry. Only allowed
post fields or the minimal identity leave the page. Post text is never executed. Errors
omit upstream bodies and system details. These are safety bounds, not a claim that an
untrusted browser extension or a compromised forum runtime can be isolated.

`--chrome`, `--anonymous` and `--auth-file` are mutually exclusive. Without `--chrome`,
the existing HTTP behavior below is unchanged; it never auto-opens the browser. Browser
transport is deliberately read-only. It cannot be used with `auth import` or `draft`.

### Existing explicit session-file path and local drafts

Authentication is independent of ARC credentials. Default reads are anonymous when
`~/.config/qiwoo/auth.json` is absent. An explicit `--auth-file` must exist. Authorized
origin-scoped session JSON can be imported on redirected stdin with
`./qiwoo auth import`; it accepts only `origin` and `cookie` fields for the exact HTTPS
forum origin. Do not put credentials in argv, Git, terminal chat, or shell history.
The credential file must be a regular single-link file owned by the user, mode 0600,
inside a user-owned 0700 directory. Requests never send cookies to another origin.
Import validates the local format, NOT server authentication. This is independent of
`--chrome`, which keeps its session in the browser rather than creating this file.

`draft` writes a private local JSON file without overwriting an existing file and
marks the target as unvalidated. `publish` intentionally returns exit code 4 without
sending any network request, including when `--chrome` is present. Posting and CSRF
handling remain future work; this change completes authenticated reading, not publishing.

## Verification

Run `python3 -B -m unittest discover -s tests_forum -v`. The suite combines the original
44 regressions with Chrome transport, CLI routing and actual shipped-JavaScript tests
using in-memory Node fetch stubs. All automated fixtures remain synthetic; tests do not
open Chrome or make a real HTTP request. Node is needed only for the JavaScript tests,
which are explicitly skipped when it is absent. No test skip counts as a pass.

Separately, authorized live read-only checks on 2026-09-16 validated the CLI login check,
both topics, keyword search and the real `/t/{id}/posts.json?post_ids[]=...` batch endpoint.
The course topic contained 11 posts; the competition topic changed from 13 to 14 during
validation. Those are dated snapshots, not constants. Two-post batches for both topics
matched the requested IDs; `playwright` search returned a match. No live posts, credentials
or full session payloads were saved as test fixtures. `discourse_read_contract_v1` names
our normalized Chrome read contract, not an assertion about the forum software version.
The legacy HTTP transport retains its earlier `discourse_site_unverified` marker because
this work did not validate its direct-network authentication path.

No publishing, paid model generation, competition upload or formal run was performed.
The legacy project-wide suite is not a new green result from this work.

Protocol references: [Chromium Apple Events](https://www.chromium.org/developers/applescript/),
[Discourse API](https://docs.discourse.org/) and
[Discourse current-session endpoint](https://meta.discourse.org/t/is-there-an-endpoint-to-check-if-a-user-is-logged-in/72780).
