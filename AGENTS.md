# VOLO Factory

This is a new competition agent for the GOSIM Software Factory 2026 hackathon.
Do not use or extend the previous smoke submission. It is not a baseline for this implementation.

## Map

- `main.py`: ArcBench upload entrypoint.
- `volo/`: requirement scheduling, model transport, workspace tools, verification and agent loop.
- `tests/`: deterministic transport, recovery and execution tests. These are not evidence of model quality.
- `docs/strategy.md`: verified competition facts, design choices and next experiments.
- `scripts/package.py`: reproducible upload ZIP; excludes credentials, tests and development artifacts.
- `arcbench` / `arcbench_cli.py`: local website API client for uploads, runs, logs and results;
  separate from the uploaded agent. See `docs/platform-cli.md`.

## Rules

Use the organizer's configured model gateway for competition model calls. Never embed API keys.
Treat official requirements and evaluator files as read-only. Do not optimize by editing tests,
spoofing usage, or adding purposeless model calls to manipulate efficiency.
Keep true prompts, tool results, model usage and timings in the run trace, with credentials redacted.
Agent verification and official benchmark scores are separate facts.
Make no claim of winning or generalization without official results on the relevant tasks.

Run `python -m unittest discover -s tests -v` in the project virtual environment.
Any transport fixture must be labeled synthetic until replaced by a redacted real response.
