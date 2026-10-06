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
Read `docs/reference/oneshot.md`, `docs/reference/forum-cli.md` and the current handoff before experiments.
Run the relevant deterministic suites; a sandbox-denied integration test is not a pass
and must not be rerun by broadening permissions. Keep one-shot packaging allowlisted.
No generation/behavior/score improvement is proved by mock tests or successful packaging.

## Documentation map

`docs/README.md` is the map of `docs/` and the documentation policy; read it before adding or moving
a document. Entry order for a continuation: `docs/SESSION_HANDOFF.md` (one section, current),
`docs/reference/finals-roadmap.md` (living finals plan: verified finals facts, workstreams with completion
criteria, decisions; the preliminary `docs/reference/roadmap.md` is history), `docs/progress.md` (append-only ledger of the current line), then `docs/reports/`
(dated, frozen) and the rest of `docs/reference/` (stable, maintained) as the handoff directs.
Competition rules live in `docs/reference/preliminary-rules.md`. `docs/archive/` holds the frozen
multi-round harness era and old handoff sections; `docs/evidence/` holds the JSON the reports cite.

Code map: `oneshot/` (active candidate, `oneshot/scaffold/README.md` is its architecture knowledge
base, `oneshot/dialect.md` the card), `tests_oneshot/`, `scripts/package_oneshot.py`; frozen legacy
`main.py`, `volo/`, `harness_lab/` (its README; `harness_lab/state_rehearsal.py` is still the local
replay tool), `tests/`; `qiwoo` / `tools/qiwoo_cli/` (forum CLI, `docs/reference/forum-cli.md`).
The platform client is the separate `arcbench-cli` repository (`docs/reference/platform-cli.md`).

## Rules

Keep the main checkout on `main`. Start new development from current `main` in
`../volo-factory-worktrees/<task>/`, and merge through a PR. Preserve branch ancestry
when integrating independent work; remove completed worktrees after retaining their
unversioned evidence. Read live Git state instead of assuming a historical document
names the current branch or candidate.

Self-checks are diagnostic, including a captured self-check: it reports an observed ambiguity and
never decides a verification. Only an explicitly supplied calibrated acceptance suite
may populate `verified_requirements`; official scores remain a separate result.
The legacy model-generated browser probe stays opt-in in `harness_lab/`. The scenario self-check's
one translation call per task (`oneshot/scenario_translate.py`, cached by requirements hash) is part of
the default repair loop since roadmap 4.3. Do not merge a new experiment by silently enabling it.

Use the organizer's configured model gateway for competition model calls. Never embed API keys.
Treat official requirements and evaluator files as read-only. Do not optimize by editing tests,
spoofing usage, or adding purposeless model calls to manipulate efficiency.
Keep true prompts, tool results, model usage and timings in the run trace, with credentials redacted.
Agent verification and official benchmark scores are separate facts.
Make no claim of winning or generalization without official results on the relevant tasks.

Run `python -m unittest discover -s tests -v` in the project virtual environment.
Any transport fixture must be labeled synthetic until replaced by a redacted real response.
