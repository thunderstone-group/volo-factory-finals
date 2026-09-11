# VOLO Factory

A new requirement-driven software agent for the **GOSIM Software Factory 2026**
hackathon. The goal is a final-winning system; current public leaderboards are
development milestones, not evidence of a final result.

## Status

**Version 0.6.0 reached first place on both Smoke and Smoke Evolution on September 11, 2026.**
Smoke passed 2/2 official tests, costing CNY 0.016023 with 5 seconds average runtime.
Evolution passed 4/4, costing CNY 0.056842 with 15 seconds average runtime. These are
dated practice milestones; the formal preliminary and final are separate competitions.
Ticket Booking uploads, generation and all 10 official tests now execute. The latest
evaluated candidate passed 2/10; its original app passes 5/10 in a local replay of the
unchanged public tests. Input-reference and UI-contract gaps remain. Historical upload
failures are retained as dated observations, not a current blocker.
The design and competition facts are recorded in
[docs/strategy.md](docs/strategy.md). This project does not reuse the previous
smoke submission.

The current development candidate, **0.7.0.dev5**, adds reference-image observations
through the same metered gateway. A real Kimi K3 image request successfully read the
previously omitted heading. The full candidate still needs official evaluation.
Version dev4 already verifies browser checks and serves the same app on both observed
runner entrypoints. DeepSeek completed its implementation and self-checks in one coding
call, but self-checks did not catch all UI-contract gaps. All 22 supplied requirement
documents (20 unique) parse and schedule. The `v0.6.0` tag preserves the recorded wins.
All 48 local checks pass, including real HTTP repair, reference routing and cache
invalidation, captured response accounting, launcher lifecycle and CLI contracts.

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
- Small empty projects use one initial bundle-delivery call, then real verification;
  failed deliveries enter the full repair loop.
- Small-app runtime scaffolding supplies only build, HTTP serving and browser-test lifecycle.
  Product markup, behavior, API logic and test assertions remain model-generated.
- DeepSeek thinking/tool message continuity and explicit usage accounting.
- DeepSeek thinking is disabled for small requirement batches and uses explicit low
  effort for larger bounded coding turns. Product correctness still requires verification.
- Deterministic discovery of provided Playwright tooling and protection of shared browser caches.
- A managed backend launcher serves one application on the observed 3000/3301 runner
  entrypoints; custom `PORT` values remain isolated. Authored standalone browser checks
  using the supplied Playwright module also run when the selected command only runs API tests.
- Linked images in active requirements and ancestor descriptions are observed by
  `FACTORY_VISION_MODEL` (default `kimi-k3`) using the same gateway and key. Image calls
  share the generation budget and trace. Successful observations cache by image bytes,
  prompt and model. An empty variable disables observation and records that limitation.
- Verified-checkpoint recovery with requirement and source fingerprints.
- Context pressure first prunes old tool output, then uses a fresh workspace checkpoint
  plus complete recent tool exchanges. Retained reasoning fields stay intact; raw trace
  evidence is preserved. The 160,000-character limit is not a provider token estimate.
- Redacted `.factory/` trace, commands, verification record and checkpoint; optional official SDK events.
- Default caps: 32 attempted requests, 150,000 observed tokens, 1,200 seconds and
  16,384 output tokens per coding request. Environment overrides use `FACTORY_MAX_CALLS`,
  `FACTORY_TOKEN_BUDGET`, `FACTORY_TIMEOUT`, `FACTORY_MAX_OUTPUT_TOKENS`.
- The observed token cap is checked between responses; an in-flight response can
  exceed the remaining amount. Organizer gateway quotas are authoritative.
- Local PNG/JPEG/WebP references up to 8 MiB each are supported, in groups of three.
  Remote/missing/unsupported references are explicitly listed as unavailable. Written
  requirements override conflicting screenshot defaults and out-of-scope functionality.
- Agent-authored checks and build success do not substitute for official GUI evaluation.

## Development record

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
