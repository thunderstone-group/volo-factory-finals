# Independent Qiwoo CLI, owned by VOLO

The root `qiwoo` command and `tools/qiwoo_cli/` belong to this repository but are
excluded from the competition ZIP. They do not import the agent or ARC platform CLI.
Only Python standard-library modules are required (the private file implementation
currently targets macOS/POSIX).

```sh
./qiwoo --help
./qiwoo --anonymous course
./qiwoo competition --offset 0 --limit 20
./qiwoo search OOM
./qiwoo search "playwright worker" --topic competition
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

Authentication is independent of ARC credentials. Default reads are anonymous when
`~/.config/qiwoo/auth.json` is absent. An explicit `--auth-file` must exist. Authorized
origin-scoped session JSON can be imported on redirected stdin with
`./qiwoo auth import`; it accepts only `origin` and `cookie` fields for the exact HTTPS
forum origin. Do not put credentials in argv, Git, terminal chat, or shell history.
The credential file must be a regular single-link file owned by the user, mode 0600,
inside a user-owned 0700 directory. Requests never send cookies to another origin.
Import validates the local format, NOT server authentication. No Chrome database,
Keychain or browser session was read or exported by this implementation.

`draft` writes a private local JSON file without overwriting an existing file and
marks the target as unvalidated. `publish` intentionally returns exit code 4 without
sending any network request. Posting, authenticated browser handoff and CSRF handling
remain future work; this is not a completed live forum integration.

## Verification

The first 42 synthetic tests passed in the delegate and coordinator environments.
Two additional coordinator tests cover reply linkage and malformed reply fields.
Run `python3 -B -m unittest discover -s tests_forum -v` to check the complete suite.
All tests are synthetic/mocked; no actual topic contents, real login or write action
has been successfully validated. The client explicitly labels its contract
`discourse_site_unverified` until that site-specific validation is performed.
The legacy project-wide suite is not a new green result from this work.
