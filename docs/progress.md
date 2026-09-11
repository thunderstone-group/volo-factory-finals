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

### Evidence and privacy

Commit source, plans, redacted experiment summaries, selected reproducible fixtures
and official result links. Keep keys, sessions, private raw logs, generated working
directories and large artifacts out of Git. The public rules may change; annotate
each rule snapshot and experiment with date and source.
