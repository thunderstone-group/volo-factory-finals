# Progress

## 2026-09-11 — Fresh implementation requested

- Confirmed the formal event and read its official home and rules pages through Chrome.
- Confirmed Smoke is a public practice competition, not the preliminary ranking.
- Recorded preliminary/final dates, allowed model families, evaluation dimensions and
  unresolved weights in `strategy.md`.
- User explicitly requested a fresh design and implementation with no reference to
  previous smoke code. No previous agent code is included in this repository.
- User authorized submission to the practice platform after implementation, with first
  place as an intermediate milestone. Overall ambition: win the final.
- User requested that the entire process be versioned in a Thunder GitHub repository.

### Next acceptance boundary

Deliver the first complete agent, deterministic tests, and a reproducible upload ZIP.
Then run real model-backed platform evaluations, inspect official results and usage,
and iterate from observed failures. A generated app or mock transport test is not enough.

## 2026-09-11 — Version 0.1 implemented

- Added requirement graph validation, topological batching, a single metered model
  transport, coding tools, real build/start/check verification, repair and verified recovery.
- Added redacted tracing, budget limits, subprocess environment cleanup and reproducible packaging.
- Ran 13 local checks successfully. They include a real local Node HTTP application,
  intentionally failing behavior followed by a repair, provider-protocol replay,
  fresh verification on checkpoint recovery, process timeout, path guards and archive reproducibility.
- Model responses in local protocol tests are explicitly synthetic. Real gateway and
  official competition verification are the next gate, not yet completed.
- Fixed a macOS `/var` versus `/private/var` path normalization issue found by execution tests.
- Current limitation: binary reference images are not yet analyzed.

## 2026-09-11 — First platform failure and version 0.2

- First real gateway run completed generation and self-checks, but official evaluation
  failed before any app assertions: the required Chromium revision was missing.
- Downloaded and inspected the actual run artifact. The generated checks installed a
  newer Playwright, whose browser garbage collection removed the evaluator's pinned revision.
- Added deterministic browser-module discovery, preserved the official cache, reduced
  redundant environment probing, and reused verification only for an unchanged source tree.
- Added a redacted fixture from the real gateway response and regression checks for
  browser-cache protection and existing-tool discovery. All 16 local checks passed.
- See `experiments.md` for official run link, source commit, measured cost and failure evidence.

## 2026-09-11 — Measured efficiency iterations

- Versions 0.2 and 0.3 both passed all official Smoke tests. Both reached second place;
  another team improved its result during the experiments.
- Traces showed unnecessary reasoning, fragmented writes and repeated runtime-code generation.
  Added a small-task path that keeps requirement-specific code and assertions model-generated,
  while supplying reusable build, serving and browser-test lifecycle code.
- Version 0.5 exposed a real empty-optional-field bug in this runtime. Version 0.5.1 fixes
  it, with a captured real tool-call fixture and a real HTTP regression test.
- Large requirements retain dependency-ordered batches and the full repair tool loop.
  Intermediate folder constraints are now included in batch context.

### Evidence and privacy

Commit source, plans, redacted experiment summaries, selected reproducible fixtures
and official result links. Keep keys, sessions, private raw logs, generated working
directories and large artifacts out of Git. The public rules may change; annotate
each rule snapshot and experiment with date and source.
