# Independent acceptance: bounded experiment, not an official score

This optional entrypoint does not change `main.py`, the generation strategy or the
official evaluator. It does not repair product code or resume competition runs.
The operator starts a **disposable local copy** of an application, then explicitly
opts into one model request. Never target a production service or real user data.

The experiment reads the original requirements and an initial browser accessibility
snapshot, asks the organizer's configured model for a declarative test plan, validates
the entire plan, then executes real browser operations and assertions. It does not
read the implementation, its tests, or its conversation history. There is no manager
Agent, conversation between Agents, repair loop, arbitrary generated JS, or shell tool.

## Configure and run

Reuse `OPENAI_BASE_URL`, `OPENAI_API_KEY`, and `MODEL` from the organizer's secure
environment. There is no default gateway/model and no fallback to ChatGPT/Codex quota.
Never paste credentials into source, commands, reports or this documentation.
Configure `FACTORY_PLAYWRIGHT_MODULE` to an installed Playwright package (>=1.49).
The existing provided-browser discovery is used when it is omitted. Optionally set
`FACTORY_CHROMIUM_EXECUTABLE` to an installed Chrome/Chromium executable. No browser
or package is automatically installed. Existing user browser profiles are not used.

```sh
# Inspection only: no model request, browser session, or application mutation.
.venv/bin/python -m harness_lab.acceptance_probe /path/to/requirements \
  --base-url http://127.0.0.1:3000

# Explicit paid/gateway opt-in. Use a NEW report directory each time.
.venv/bin/python -m harness_lab.acceptance_probe /path/to/requirements \
  --base-url http://127.0.0.1:3000 \
  --report-dir runs/acceptance-example --allow-model-calls
```

Limits: one attempted model request, no automatic retries, 4,096 maximum output
tokens by default, at most eight checks / forty total steps, and 120 seconds total
wall time (plus bounded process cleanup). Input exceeding 40,000 serialized user-message
characters fails before a model call rather than silently dropping requirements.
`--max-output-tokens` and `--timeout` are configurable within validated bounds.
Output tokens are not the total token bill: prompt tokens and any provider accounting
also matter. Actual returned usage is recorded; gateway quotas/metering are authoritative.
Missing usage is reported, never invented. An uncertain request is not retried.

`report.json` contains executed steps, failed assertions, unchecked requirement IDs,
elapsed time, and model usage; `events.jsonl` keeps redacted prompts and results.
Screenshots capture actual final browser state per check, with password fields masked.
Reports can still contain test data; treat the directory as private. Screenshots are
evidence for human review, not images sent to the planning model.

## Evidence limits

`no_issues_found` means the selected model-generated checks passed, NOT that every
requirement is fully covered or that official tests will pass. `failed_check` may
expose an application defect or a mistaken generated assertion; inspect the evidence.
Missing controls/action failures are `blocked`, not falsely reported as success.
Malformed/truncated plans, unavailable tooling and exhausted time are inconclusive.
Every planned check must return an ordered execution record with the matching requirement,
check name, actions and assertion values. Missing/duplicate checks, unknown statuses,
incomplete step records and results arriving after the deadline are inconclusive, even
when another check for the same requirement passed. Raw browser results stay in the trace.
Each check gets a fresh browser context; server data is not reset. The model receives
a unique test-data prefix. Only exact role/name, label, placeholder and text locators
are available. No screenshot-based visual judgment is implemented in this first slice.

Browser requests are limited to the specified loopback origin. Cross-origin resources,
WebSockets, service workers, popups and downloads are blocked, so apps requiring these
may be inconclusive. This restriction is not an OS-level sandbox. Run generated apps
in a disposable sandbox; browser automation is not remote control of the user's desktop.

Tests use synthetic model plans. Real Chrome tests establish browser plumbing only,
not the quality of the organizer model or the value of independent acceptance.
