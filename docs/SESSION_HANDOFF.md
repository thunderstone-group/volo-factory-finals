# Current handoff — 2026-09-21: recovery verified; six-pair comparison complete

Read [the recovery and final-comparison report](reports/2026-09-21-repair-experiment-recovery.md)
then [the recovery command reference](reference/repair-experiment-recovery.md).

The interrupted fixed-draft experiment completed all six planned pairs. Its frozen
candidate is retained for review: task-equal 35.79% baseline versus 43.20% candidate,
60 new passes and zero additional lost cases against baseline deliveries. No official
run, upload, main merge or official-candidate promotion was performed.

The experiment evidence remains in the fixed-draft-repair-20260920 worktree under
`runs/goal-20260920/`; state is terminal (`retained`). The first five pairs and all
frozen agent/evaluator sources are preserved. Ctrip-3's saved draft replay remained
33/125 after a UTC-day refresh; both retained deliveries are 33/125. Its rejected
proposal independently scores 36/125 (+3/-0), so false rejection remains a real fault.
12306-3 still has the shared 88-to-86 repair regression; no-baseline-regression does
not mean every repair is lossless. The date diagnostic activated on none of the six
independent drafts; the measured independent gain comes from acceptance of the
12306-2 startup-error repair.

Recovery implementation lives on `fix/repair-experiment-recovery-20260921`, branched
from main, in its matching worktree. The operator command has a durable three-attempt
cap, atomic journal/state, inherited worker lock, exact request-byte checks, response
reuse and per-request SSH cleanup. Use Python 3.11.15 for this saved experiment:
Python 3.9.6 changes unordered feedback even with PYTHONHASHSEED=0. That mismatch was
caught before the gateway. Terminal resume was verified to make zero model calls.
No experiment worker or owned temporary tunnel remains running.

This recovery used one new model call: 72,902 input / 30,223 output tokens,
CNY 0.490713 billed. Fourteen recovery tests passed; the required legacy suite had
214 passes and 12 skips. All six pairs passed source, suite, context and case audits;
all twelve raw proposals have matching local replay evidence. Historical goal-phase
known charges are CNY 8.916223, with seven model attempts lacking usage; five earlier
pre-goal failures also lack usage. Do not present the known subtotal as a fully settled
historical total.

Next work should separately test deterministic diagnostic ordering and behavior-based
repair acceptance against the preserved false-rejection/regression examples. Do not
regenerate these six drafts or modify the frozen candidate after seeing their results.
The original Codex thread's goal metadata was not edited from this replacement thread.
