# VOLO Factory

A new requirement-driven software agent for the **GOSIM Software Factory 2026**
hackathon. The goal is a final-winning system; current public leaderboards are
development milestones, not evidence of a final result.

## Status

**Version 0.6.0 reached first place on both Smoke and Smoke Evolution on September 11, 2026.**
Smoke passed 2/2 official tests, costing CNY 0.016023 with 5 seconds average runtime.
Evolution passed 4/4, costing CNY 0.056842 with 15 seconds average runtime. These are
dated practice milestones; the formal preliminary and final are separate competitions.
The September 12 update restores Smoke Evolution to first with dev16 / Qwen3.6 Flash:
4/4 official tests, CNY 0.017810 total, seven seconds average. Tag `v0.7.0-dev16`
preserves that source and the matching upload is recorded in the experiment log.
Ticket Booking has reached generation and all 10 official tests. This agent's best
official result is E047's 6/10; its unmodified artifact passed 10/10 in local public-test
replays. That local result does not replace the official result or resolve all timing
differences. Intermittent missing-archive deployment failures remain distinct from
application failures.
The design and competition facts are recorded in
[docs/strategy.md](docs/strategy.md). This project does not reuse the previous
smoke submission.

The current development candidate, **0.7.0.dev29**, generates bounded new applications
through a generic Node runtime. The model supplies the product UI, API logic and checks
from the complete requirements and image observations; the runtime handles build,
serving and browser lifecycle. Build and actual behavioral verification are mandatory.
After a failed first implementation, larger bounded apps immediately get source/edit
tools for a narrow repair. Failure feedback preserves both log ends, and missing browser
controls fail within five seconds. Browser failures include visible page text and pending
requests; separate checks reject unnamed visible meters and repeated links to non-home
primary destinations even when the model's own assertions pass. The latter is a minimal
navigation rule for the prepared small-app runtime, not a universal accessibility rule.
Real Chrome regressions cover those diagnostics, semantics, navigation and timeouts;
a real HTTP regression covers verified source-only repair.
Failed bundles return their exact source paths to avoid redundant discovery. The default
observed-response token budget is 450,000, configurable through `FACTORY_TOKEN_BUDGET` or
`--token-budget`. If that budget ends immediately after an edit, the existing checks can
still run within the wall-time limit without another model call; only a real pass completes.
Small incremental edits retain their existing single-patch path. Exact values use leaf
elements, and explicitly permitted English navigation aliases are preferred consistently.
Official tests remain separate. This candidate scores 5/10 with Pro; the MiniMax
comparison was cancelled after repeated truncation, before evaluation. Further attempts
are stopped at the user's request. The best Ticket result is E047's 6/10; see
[experiments](docs/experiments.md) for the evidence and remaining failures.

The September 12 [architecture audit](docs/harness-architecture-2026-09-12.md) resumes
research only. Offline diagnostics reproduce zero-assertion acceptance, self-check
weakening, and a truncation path that never releases full-bundle tool forcing. These
are limitations of the unchanged runtime, not new model results. Model-backed runs
and official submissions remain paused during this review.

All 22 supplied requirement documents (20 unique) parse and schedule. Local checks cover
real HTTP incremental edits and repair, source/context boundaries, reference routing and
cache invalidation, captured response accounting, launcher lifecycle and CLI contracts.

The ArcBench entrypoint is:

```sh
python main.py /path/to/requirements --output-dir /path/to/application
```

Model credentials will come from environment variables supplied by the competition
runner. Never add a key, private credential, or unredacted run capture to this repository.

## Develop and package

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m unittest discover -s tests -v
.venv/bin/python scripts/package.py
```

The upload is `dist/volo-factory.zip`. It contains only the entrypoint, dependency file,
and `volo/` package. The archive is deterministic.

To include the real browser regression, set `FACTORY_TEST_PLAYWRIGHT_MODULE` to an
installed Playwright package and `FACTORY_TEST_CHROMIUM_EXECUTABLE` to an installed
Chromium/Chrome executable when running the test suite. Otherwise that check is skipped.

Use the local [ArcBench CLI](docs/platform-cli.md) to upload, start runs, wait for results,
inspect logs and download artifacts. Normal operations use the authenticated website API:

```sh
./arcbench upload dist/volo-factory.zip --competition ticket-booking --name my-agent-version
./arcbench run SUBMISSION_ID --task ticket-booking--ticket-booking
./arcbench wait RUN_ID
./arcbench leaderboard --competition ticket-booking
```

For a local input inspection with no model calls:

```sh
.venv/bin/python main.py /path/to/requirements --output-dir runs/inspection --inspect
```

Actual generation needs `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `MODEL`. Use the
competition gateway and an allowed model. The agent has no alternative model endpoint.
Run model-generated code only in a suitable disposable sandbox; workspace path guards
are not an OS-level sandbox for subprocesses.

## Behavior and limits

- Dependency-ordered requirement batches and existing-project preservation.
- Batched file edits, bounded commands, build/start/behavioral-check verification, repair loop.
- Writing a complete authored Node test bundle triggers real verification immediately,
  preventing source rereads from consuming the budget before the first execution.
  Discovery uses `checks/*.test.*` / `checks/*.spec.*` filenames, including tests whose
  framework is imported through a helper. All use `node --test`; incompatible imports
  fail visibly instead of silently suppressing verification.
- Small empty projects use one initial bundle-delivery call, then real verification;
  failed deliveries enter the full repair loop.
- New applications up to three features and 16,000 requirement characters use that
  same runtime with concise stateful/routing/semantic guidance. The model supplies the
  complete product and tests; the runtime supplies no task-specific implementation.
- Small existing projects receive a bounded snapshot of product code and concise edit
  instructions, with a forced `patch_and_verify` call for the complete change. Edits
  are validated together before any write; failures can enter the normal repair loop. Runtime state,
  credentials and protected files are excluded; larger source sets use normal file tools.
  Known runtime boilerplate is omitted only after an exact-byte comparison; custom runtime
  edits remain visible. The full requirement data stays intact in compact serialization.
- Small-app runtime scaffolding supplies only build, HTTP serving and browser-test lifecycle.
  Product markup, behavior, API logic and test assertions remain model-generated.
- DeepSeek thinking/tool message continuity and explicit usage accounting.
- DeepSeek thinking is disabled for batches of up to three features / 16,000 requirement
  characters and uses explicit low effort for larger batches. The smaller 3,500-character
  threshold still controls compact runtime/edit tools. Correctness requires verification.
  Qwen3 hybrid models receive the equivalent `enable_thinking` control.
  Kimi K3 always reasons: requests use its documented `reasoning_effort: low`, including
  image observation, instead of silently accepting its default maximum effort. Returned
  reasoning fields remain intact. The batch policy is logged as requested intent; the
  actual request parameters establish the provider controls sent.
- Check commands are validated before writing delivery/edit bundles. A quoted single-string
  argv is split without a shell, preventing retries against already-edited source when
  a model supplies a malformed command shape.
- Deterministic discovery of provided Playwright tooling and protection of shared browser caches.
- A managed backend launcher serves one application on the observed 3000/3301 runner
  entrypoints; custom `PORT` values remain isolated. Authored standalone browser checks
  using the supplied Playwright module also run when the selected command only runs API tests.
- Linked images in active requirements and ancestor descriptions are observed by
  `FACTORY_VISION_MODEL` (default `kimi-k3`) using the same gateway and key. Image calls
  share the generation budget and trace. Successful observations cache by image bytes,
  prompt and model. An empty variable disables observation and records that limitation.
- Browser checks are authored directly from requirements and image observations.
  Required dynamic levels use a named meter with a changing numeric value; invalid
  submissions use visible, nonempty alerts and preserve the expected account/session state.
  Generation instructions require browser assertions for those semantics.
  The separate generated UI-contract layer was removed after E036 demonstrated that
  it converted one consent control with alternative names into two required controls.
  Its earlier source and measured failures remain in Git and the experiment log.
- Verified-checkpoint recovery with requirement and source fingerprints.
- Context pressure first prunes old tool output, then uses a fresh workspace checkpoint
  plus complete recent tool exchanges. The last completed tool result, including successful
  reads, is also preserved in a bounded checkpoint when its full exchange cannot fit.
  Retained reasoning fields stay intact; raw trace
  evidence is preserved. The 120,000-character limit is not a provider token estimate.
  E034's 60,000-character window discarded earlier implementation before the first
  tests were written, causing substantial source rereads; the larger default retains
  that observed application-sized history for the next real comparison.
- Source tools return at most 12,000 total bytes or an 8,000-character file chunk with
  a continuation offset. Chunk boundaries preserve Unicode; full-file editing remains
  separate from what is returned to the model. The prepared small-app builder is only
  advertised when its runtime has actually been scaffolded.
- Redacted `.factory/` trace, commands, verification record and checkpoint; optional official SDK events.
- Default caps: 32 attempted requests, 450,000 observed tokens, 1,200 seconds and
  16,384 output tokens per coding request. Environment overrides use `FACTORY_MAX_CALLS`,
  `FACTORY_TOKEN_BUDGET`, `FACTORY_TIMEOUT`, `FACTORY_MAX_OUTPUT_TOKENS`.
- The observed token cap is checked between responses; an in-flight response can
  exceed the remaining amount. Organizer gateway quotas are authoritative.
- Local PNG/JPEG/WebP references up to 8 MiB each are supported. Small screenshots
  remain byte-exact; larger rasters use bounded JPEGs with a 1920-pixel maximum edge.
  Groups contain at most three images and under 780,000 encoded content bytes.
  Remote/missing/unsupported references are explicitly listed as unavailable. Written
  requirements override conflicting screenshot defaults and out-of-scope functionality.
- Agent-authored checks and build success do not substitute for official GUI evaluation.

## Development record

- [Architecture audit, offline evidence and baseline plan](docs/harness-architecture-2026-09-12.md)

- [Strategy and verified rules](docs/strategy.md)
- [Progress and evidence boundaries](docs/progress.md)
- [Actual experiments and result links](docs/experiments.md)
- [Next evidence gates toward the final](docs/next-stage.md)
- [Harness source review and implemented policies](docs/harness-research.md)
- [Supplied corpus, deduplication and scheduling audit](docs/corpus.md)
- [Ticket Booking platform report](docs/ticket-booking-platform-report.md)
- [Contributor instructions](AGENTS.md)

Local checks use Python's standard `unittest` runner. Only actual runs against
the organizer's model gateway and official GUI tests will establish competition performance.
