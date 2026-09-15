# VOLO Factory

This is a new competition agent for the GOSIM Software Factory 2026 hackathon.
Do not use or extend the previous smoke submission. It is not a baseline for this implementation.

## Current project boundary

`volo-factory` is the only main ARC project. Active one-shot work belongs under
`oneshot/`, its tests under `tests_oneshot/`, and its packaging entry is
`scripts/package_oneshot.py`. `oneshot-lab` is an untouched import/recovery source,
not a parallel active project. `qiwoo` / `tools/qiwoo_cli/` are independent development
operations, never agent-package dependencies; tests live under `tests_forum/`.
Use the existing standalone `arcbench-cli` as the only platform client. Do not revive
the removed `arcbench_cli.py` or create a second forum repository by default.

Root `main.py`, `volo/`, `harness_lab/`, and `scripts/package.py` are frozen legacy
components, not the current one-shot candidate. Changes to their role must be explicit.
Read `docs/oneshot.md`, `docs/forum-cli.md` and the current handoff before experiments.
Run the relevant deterministic suites; a sandbox-denied integration test is not a pass
and must not be rerun by broadening permissions. Keep one-shot packaging allowlisted.
No generation/behavior/score improvement is proved by mock tests or successful packaging.

## Historical and reference map

- `docs/campaign-plan-2026-09-14.md`: competition rules as stated by the organizers, the arc-bench-web board state, the objective-driven generalisation strategy and the order of work up to the 2026-09-21 preliminary.
- `docs/SESSION_HANDOFF.md`: current continuation entrypoint, retained run evidence and unresolved work.
- `docs/competition-optimization-2026-09-12.md`: three-board objective, fresh Fable review, exact E057 failure step and current-main small-board comparison.
- `main.py`: ArcBench upload entrypoint.
- `volo/`: requirement scheduling, model transport, workspace tools, verification and agent loop.
- `harness_lab/`: opt-in developer evaluation and Pi/model-browser probes; see its README.
- `tests/`: deterministic transport, recovery and execution tests. These are not evidence of model quality.
- `docs/vision-model-availability-2026-09-14.md`: which gateway models actually read an image,
  which ids the gateway serves, and the price table confirmed against official charges.
- `docs/image-ablation-2026-09-14.md`: whether the reference-image observation pays for itself,
  the `FACTORY_VISION_MODEL` switch and which gateway models actually read an image.
- `docs/selfcheck-deadend-2026-09-14.md`: why a run can spend its whole budget repairing its own
  check, the two autopsies, and the rules that bound it.
- `docs/ticket-regression-2026-09-14.md`: why the 7/10 Ticket Booking run was a hosted-runner browser
  fault rather than a merged change, the 25-of-25 local replay that clears the application, the
  per-PR attribution from both traces, and the one-browser-per-check-run fix.
- `docs/repair-loop-autopsy-2026-09-14.md`: every model call of every retained run labelled by
  failure source, the three mechanical defects that cost CNY 2.74 across sixteen runs, and why a
  captured self-check is diagnostic rather than authoritative.
- `docs/harness-consolidation-2026-09-12.md`: integration decisions and validation boundaries.
- `docs/harness-design-2026-09-12.md`: pinned-source comparison and proposed next experiments.
- `docs/strategy.md`: verified competition facts, design choices and next experiments.
- `scripts/package.py`: reproducible upload ZIP; excludes credentials, tests and development artifacts.
- `docs/platform-cli.md`: how to install and configure the separate `arcbench` platform
  client, and the platform rules that bind this harness. The client is not in this
  repository; it lives in thunderstone-group/arcbench-cli.

## Rules

Keep the main checkout on `main`. Start new development from current `main` in
`../volo-factory-worktrees/<task>/`, and merge through a PR. Preserve branch ancestry
when integrating independent work; remove completed worktrees after retaining their
unversioned evidence. Read live Git state instead of assuming a historical document
names the current branch or candidate.

Self-checks are diagnostic, including a captured self-check: it reports an observed ambiguity and
never decides a verification. Only an explicitly supplied calibrated acceptance suite
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
