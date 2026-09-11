# VOLO Factory

A new requirement-driven software agent for the **GOSIM Software Factory 2026**
hackathon. The goal is a final-winning system; current public leaderboards are
development milestones, not evidence of a final result.

## Status

Versions 0.2 and 0.3 passed both official Smoke tasks. Version 0.4 reduces small-task round trips. The design and competition facts are recorded in
[docs/strategy.md](docs/strategy.md). This project does not reuse the previous
smoke submission.

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
- DeepSeek thinking/tool message continuity and explicit usage accounting.
- DeepSeek thinking is disabled for small requirement batches and retained for larger ones.
- Deterministic discovery of provided Playwright tooling and protection of shared browser caches.
- Verified-checkpoint recovery with requirement and source fingerprints.
- Redacted `.factory/` trace, commands, verification record and checkpoint; optional official SDK events.
- Default caps: 32 attempted requests, 150,000 observed tokens, 1,200 seconds and
  8,192 output tokens per request. Environment overrides use `FACTORY_MAX_CALLS`,
  `FACTORY_TOKEN_BUDGET`, `FACTORY_TIMEOUT`, `FACTORY_MAX_OUTPUT_TOKENS`.
- The observed token cap is checked between responses; an in-flight response can
  exceed the remaining amount. Organizer gateway quotas are authoritative.
- Binary image references are listed but not analyzed in this version.
- Agent-authored checks and build success do not substitute for official GUI evaluation.

## Development record

- [Strategy and verified rules](docs/strategy.md)
- [Progress and evidence boundaries](docs/progress.md)
- [Contributor instructions](AGENTS.md)

Local checks use Python's standard `unittest` runner. Only actual runs against
the organizer's model gateway and official GUI tests will establish competition performance.
