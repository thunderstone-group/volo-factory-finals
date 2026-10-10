The organizer added application-only self-tests, but repeated uploads and result inspection require browser interaction. Add `arcbench selftest` commands for session capture, task/history discovery, application ZIP upload, status polling, and failure screenshots through the deployed HTTP API. Self-test results are explicitly separate from leaderboard scores.

Self-test credentials are isolated from competition and model credentials. Signed object uploads use a separate opener without account cookies or redirects. Writes are never retried; upload/submission checkpoints let callers inspect uncertain outcomes and resume polling without another submission. The current history endpoint omits quota, which the CLI documents without fabricating an allowance.

Validation:
- 130 tests passed, including bounded retries for transient polling failures observed during a real Stage 2 run. The fixture comes from a real response with account identifiers removed.
- Live authenticated HTTP verified task/history reads, an existing 10/30 result, and a downloaded failure PNG. A different repaired app was then uploaded through all three HTTP steps and polled to its terminal 19/30 result using the same submission id. This validates the CLI lifecycle, not an agent leaderboard score.
- ZIP checks, credential isolation, interrupted uploads, polling deadlines, and response parsing covered; secret scan and diff check passed.

A live Stage 2 status read hit TLS unexpected EOF after a successful upload. Recovery queried the same submission id and obtained its 21/29 terminal result; no upload was repeated. Status polling now tolerates two consecutive transport/5xx errors, preserving authentication and deadline boundaries.
