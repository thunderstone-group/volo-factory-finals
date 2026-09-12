# Observed runner rules, September 12

We captured the actual generated Playwright configuration from our authorized Smoke
counter run [199816b1dd39](https://arc-bench.com/runs/199816b1dd39). The run passed its
one official case, used one real Qwen3.6 Flash call (224 tokens), and cost CNY 0.001013.

The original [playwright.config.ts](evidence/2026-09-12-runner-rules/playwright.config.ts)
and [package.json](evidence/2026-09-12-runner-rules/package.json) are preserved byte for
byte. [The evidence record](evidence/2026-09-12-runner-rules.json) contains their hashes,
the package identities, official result, token reconciliation and verification scope.

| Setting | Actual value | Source |
|---|---|---|
| Playwright | 1.57.0 | Generated package and effective official report |
| Node / OS / architecture | 20.19.3 / Linux / x64 | Probe process |
| Test timeout | 10,000 ms | Generated configuration |
| Assertion timeout | 10,000 ms | Generated configuration |
| Workers | 4 configured | Generated configuration; actual concurrency depends on the test set |
| fullyParallel | false | Generated configuration |
| Retries | 0 | Effective official report |
| baseURL | http://127.0.0.1:3000 | Generated configuration |
| Browser channel | chromium | Generated configuration |
| Trace / screenshot | off / off | Generated configuration |
| JSON report | /workspace/template/.arc/playwright-report.json | Generated configuration |

The entrypoint observes existing tests at `/workspace/tests`, but the configuration
does not yet exist. The runner starts the generated backend, waits for an HTTP 200
(the log states a 120-second readiness timeout), then prepares the configuration.
The bounded backend observer captured it after that step. A startup-only probe would
have missed it. The probe did not import or execute the collected TypeScript.

The observed Smoke test hash is exactly the hash of the currently published test.
We also refreshed Ticket's public registration, login and support files: all three
match our vendored originals. This does not establish that every live Ticket setting
is identical to Smoke; no Ticket run was started for this investigation.

The prior Ticket E057 report independently confirms Playwright 1.57.0, four configured
workers, two actual workers, ten-second tests and zero retries. Its browser `use`
settings are not present in that report. Its registration timeout at line 67 remains
unexplained. Trace and screenshot collection being disabled in the observed Smoke
configuration explains the lack of those artifacts for this run; do not promote that
observation into a proven cause of Ticket's timeout.

The new run reports `run_duration_seconds=2`, while its API start-to-finish timestamps
span 15.123508 seconds. The duration field therefore must not be treated as full job
wall time. Its apparent relationship to the generation phase is an inference from
logs, not a recovered backend implementation. CPU/memory allocation and the private
backend scoring implementation were not captured.

## Reproducible probe

The user explicitly described this as an authorized lab investigation. The capture
scope is the test directory identified by our own official report: three fixed
configuration/support paths and at most 32 top-level test fingerprints. It does not
follow symlinks, recurse through the host, change test files, export environment values,
or install a remote-control service. Source is read as bounded text, with credential
redaction. The server observer checks one exact configuration path for at most twenty
seconds, and its timer does not keep the server alive.

`scripts/package_rule_probe.py` injects the probe into an explicitly supplied frozen
ZIP. The normal package builder does not include it. The base ZIP and all original
public assertions are unchanged. Normal packaging still produces the exact practice4
SHA-256 `dc071c4d398a25c0d4e325d5d163c392e2b8d925010922e604d260ac17f0ae95`.

Probe source is commit `ce107b8`; its ZIP is
`37a848aa5495f958dad9ea7ba56878063261bcbc74fa6355cc1bb3857d3ec4d3`.
Submission `6b9ede02a261` was downloaded and hash-verified before execution. An initial
archive-download transport error was resolved by retrying only that read, without
creating a duplicate upload. It is now the latest saved Smoke submission; that fact
does not change the identity of earlier successful frozen packages.

Validation: 183 regression checks completed (178 passed, five container checks skipped
because no image was configured). Four new checks exercise real Node/file behavior,
redaction, symlink/FIFO/size boundaries and package preservation. A real local browser
check of the unpacked probe used synthetic model HTTP. Its first attempt exposed the
existing local browser-discovery mismatch; selecting the installed Chrome explicitly
passed. The subsequent official run validates the real uploaded package and gateway.

Raw evidence is retained under `runs/rules-20260912/` in the canonical checkout. The
small rules-only archive is also sent through the existing local wanctl controller to
our server at `/root/.local/share/volo-factory/rules-20260912/runner-rules-evidence.tar.gz`.
The remote file hash matches the local archive:
`e07e31abc4506baf4d7b1306e1eb14dbe9808b1c272696cd9cf6f92f9ab18b40`.
The evaluation container contains no wanctl binary or controller credential.

## Public reference material

[Lab 1](https://github.com/code-philia/agentic-software-engineering-hackathon/blob/3e0ec288cbfb5375e5d5da8bef84878a1a903395/Lab/Lab01/README.md)
distinguishes generated training tests from fixed validation tests.
[Lab 4](https://github.com/code-philia/agentic-software-engineering-hackathon/blob/3e0ec288cbfb5375e5d5da8bef84878a1a903395/Lab/Lab04/README.md)
describes the local Visualizer validation process. That process is useful context,
but is not proof of complete equivalence to the hosted runner.
[The public SDK path contract](https://github.com/code-philia/agentic-requirement-compiler/blob/c52f92d2af6a2d773d31ed4663eef395ae722c46/src/arcbench_agent_runtime/context.py)
describes the project, traceability and event paths; it does not implement scoring.
