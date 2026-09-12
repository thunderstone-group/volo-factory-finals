# VOLO Factory

This is a new competition agent for the GOSIM Software Factory 2026 hackathon.
Do not use or extend the previous smoke submission. It is not a baseline for this implementation.

## Map

- `docs/runner-rules-2026-09-12.md`: actual hosted Playwright config, bounded opt-in probe and remaining unknowns.
- `harness_lab/runner_rules_probe.py` / `scripts/package_rule_probe.py`: explicitly selected lab capture; excluded from normal uploads.
- `docs/practice-qualification-2026-09-12.md`: current practice branch, top-two results and frozen packages.
- `volo/practice.py`: branch-only raw HTML execution for the four bound small tasks.

- `docs/SESSION_HANDOFF.md`: current continuation entrypoint, retained run evidence and unresolved work.
- `docs/small-task-optimization-2026-09-12.md`: dev38 public acceptance, product-only generation and official cost comparison.
- `docs/competition-optimization-2026-09-12.md`: three-board objective, fresh Fable review, exact E057 failure step and current-main small-board comparison.
- `main.py`: ArcBench upload entrypoint.
- `volo/`: requirement scheduling, model transport, workspace tools, verification and agent loop.
- `volo/small_acceptance.py` and `volo/small_acceptance/`: calibrated public assertion bodies bound to four exact small-task inputs; loaded through the existing acceptance runner.
- `harness_lab/`: opt-in developer evaluation and Pi/model-browser probes; see its README.
- `tests/`: deterministic transport, recovery and execution tests. These are not evidence of model quality.
- `docs/harness-consolidation-2026-09-12.md`: integration decisions and validation boundaries.
- `docs/harness-design-2026-09-12.md`: pinned-source comparison and proposed next experiments.
- `docs/strategy.md`: verified competition facts, design choices and next experiments.
- `scripts/package.py`: reproducible upload ZIP; excludes credentials, tests and development artifacts.
- `arcbench` / `arcbench_cli.py`: local website API client for uploads, runs, logs and results;
  separate from the uploaded agent. See `docs/platform-cli.md`.

## Rules

Keep the main checkout on `main`. Start new development from current `main` in
`../volo-factory-worktrees/<task>/`, and merge through a PR. Preserve branch ancestry
when integrating independent work; remove completed worktrees after retaining their
unversioned evidence. Read live Git state instead of assuming a historical document
names the current branch or candidate.

Self-checks are diagnostic. Only an explicitly supplied calibrated acceptance suite
may populate `verified_requirements`; official scores remain a separate result.
The model-generated browser probe stays opt-in in `harness_lab/` and never becomes a
default second model call. Do not merge a new experiment by silently enabling it.

Use the organizer's configured model gateway for competition model calls. Never embed API keys.
Treat official requirements and evaluator files as read-only. Do not optimize by editing tests,
spoofing usage, or adding purposeless model calls to manipulate efficiency.
Keep true prompts, tool results, model usage and timings in the run trace, with credentials redacted.
Agent verification and official benchmark scores are separate facts.
Make no claim of winning or generalization without official results on the relevant tasks.

Run `python -m unittest discover -s tests -v` in the project virtual environment.
Any transport fixture must be labeled synthetic until replaced by a redacted real response.


## Practice branch scope

The user explicitly requested a separate specialization branch for the practice boards.
Keep this line on `perf/arc-practice`; do not merge it into main without a later explicit
request. The immediate engineering target is top two on the relevant small boards.
Do not claim offline qualification without checking the applicable official rule.
Preserve real model work, original public tests, exact package identity and usage traces.
