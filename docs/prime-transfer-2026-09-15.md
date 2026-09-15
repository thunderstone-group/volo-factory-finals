# Prime Agent ideas applied to the big board — plan of 2026-09-15

Owner: main session (Fable). Log of results goes to `docs/progress.md`; this file holds the
decisions and the acceptance bars so a later session can tell what was decided and why.

## Board state at 09:10

| Task | Rank 1 | Our row |
|---|---|---|
| keep | 100% at CNY 16.58, 28.8 M tokens, 9038 s, deepseek-v4-flash, efficiency 6.03 | rank 4, 59.4% (run `762faa0bd756`, CNY 9.68, 100 min) |
| bookstack | two rows at 100% | none |

Senior tier (≥ 80%) ranks by pass rate ÷ cost. To pass rank 1 on Keep as senior the cost must
stay under 100 × k/32 ÷ 6.03: 26/32 → CNY 13.47, 28/32 → 14.51, 32/32 → 16.58. Target chosen:
**28/32 at ≤ CNY 12** (efficiency ≥ 7.29), not 32/32 first.

## What Prime Agent (Prime Intellect, 2026-08) has that we use

| Prime mechanism | Our translation | Status |
|---|---|---|
| Goal + gate + bounded autonomous continuation (`--autonomous-max-*`, gate output fed back) | Outer loop over incomplete batches after every batch had a first pass, round-robin, ≤ 3 entries per batch; a capped batch quarantines its own checks and keeps its tree when the regression bundle stays green ("salvage"); run ends on cost budget, not wall clock; always deliver | agent `gate-loop`, feat/state-contract |
| "Run functions over data instead of reading data through tokens" | Fix the empty `Current product source` bug (batches 11–15 of run 5 carried no source); bounded relevance-ordered source per batch | agent `gate-loop` |
| Harness state as data the loop can change | Cost meter in CNY on the shared usage object; per-batch status (completed / salvaged / incomplete) in checkpoint and result | agent `gate-loop` |
| Verification in the evaluator's own semantics | Official-ladder locator primitives + requirement-scenario checks (GIVEN/WHEN/THEN with a fixed denominator, unknown ≠ pass); same-page overlay lifecycle check for the REQ-4.2 race | agent `rules-fix` (D2, D3 first), then phase 2 |
| Continual harness (`/refine` over the trajectory) | Deferred until after the preliminary. Reason (GPT-6 review): re-deriving RA–RE from Keep reports proves recall, not generalisation; rules-as-files also needs the packaging whitelist changed. Cheap substitute now: deterministic evidence digest per run (failure fingerprint, pending locator, source, repetitions, cost) | not started |

Not adopted: persistent IPython kernel as the only tool (rewrite risk before 09-21), recursive
sub-agents (a 1-CPU hosted container and a shared store make parallel browsers a loss).

## Facts that changed the plan today (GPT-6 review, `~/.codex-jobs/volo-factory/2026-09-15-prime-transfer-review/`)

- Run `762faa0bd756` ran the full 100-minute default and still scored 19/32 with failures among
  implemented features; removing the wall clock alone is not "19 → 25".
- 12 M tokens at run 5's token mix is ≈ CNY 24; a token budget is the wrong stop. Budget is CNY.
- The six official `helpers.ts` share the ladder style but not one contract (bookstack and 12306
  differ); phase 2 verifies behaviour from requirement scenarios, the ladder is the locator
  layer, not the whole gate.
- Rule text contradicts itself (row actions "keep the title" vs "verb only") and RC checks verbs
  no requirement asks for. Fixed before any new generation.

## Order and bars

1. `gate-loop` + `rules-fix` land on feat/state-contract, suite green.
2. Local Keep generation (run 7) on the merged head, hosted profile replayed 3×, worst score
   counts. Bar to continue: ≥ 26/32 and ≤ CNY 12; otherwise attribute first.
3. Phase 2 (scenario checks on official-ladder primitives), then Keep runs 8–9.
4. Freeze bar for an official run: Keep 3 consecutive generations, worst replay ≥ 28/32, each
   ≤ CNY 12; Bookstack 2 generations ≥ 28/34 without tuning on it.
5. Official Keep run with the frozen package; no local gateway use while it runs.

Discipline unchanged: one scheduler on the shared key, no upload from an agent, trace/video off
locally, one sample is not a cause.

## 10:12 — three parallel tracks (team lead's decision, 2026-09-15)

The team lead accepted concurrent official runs and local generation on the shared key ("the
gateway is concurrent"). Consequence, stated once: official token counts for runs that overlap
local generation are inflated, so baseline cost figures are upper bounds; junior rows are not
ranked by cost, so this does not change rank.

1. **Baselines on the board.** (a) The platform's ARC reference template uploaded as its own
   submission and run on Keep and Bookstack first, the other four after the Keep cost is known;
   (b) the current Keep package (submission `672b777e6cbe`) run on the other five tasks so VOLO AI
   appears on the aggregated board at all.
2. **Our harness, as planned above** (gate loop → cost budget → rules → local Keep run 7 → phase 2).
3. **Single-tool harness experiment**: fuse dsh's "ptc" with Prime Agent's one-tool design (one
   persistent code runtime as the only tool; file reads, edits and checks are programs the model
   writes). Exploratory; the team lead wants heavy discussion before and during. Not on the
   critical path for 09-21 unless it beats track 2 on the same local Keep bar.
