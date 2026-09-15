# The minimal loop — spec of 2026-09-15 17:20

Decided with the team lead through the afternoon. This replaces §3.4/§3.5 of
`ts-kernel-design-2026-09-15.md` as the loop we build; §3.3 (checks) stands and is being
calibrated. Principle: fewest moving parts, not one-shot.

## Shape

```
contract   requirements.yaml → seeds, quoted literals, navigation, entities   (existing extractor)
design     one call → design card: screens + entry path, navigation names, per-requirement
           controls {verb, accessibleName, role, hoverRevealed, container}, seed rows and
           initial state, where to observe each action's result. Self-checked against the
           dialect card. Shared by every later step.
partition  requirements → disjoint sets in dependency order (design card's screens are the
           natural unit; target 4–7 sets for Keep, ≤ 8 atomics each)
generate   per set: a fresh session whose prefix is fixed (dialect card + design card +
           runtime API card + file tree); tools: read, edit (in place), write (new files only),
           run (product commands). No model-written checks. Session ends on a fixed
           "SET DONE" line or at a call cap; no wall-clock kill.
verify     harness runs the calibrated checks for all sets so far; structured digest
repair     per failed scenario: one fresh session with the digest + relevant source, ≤ N calls;
           stop when the scenario passes or N is spent; budget in CNY reserved up front for
           every set's generation before any repair
deliver    last tree whose protected pass set (scenarios that ever passed) is intact
```

## Measured reasons for each part

- Fixed prefix + fresh session per set: Prime keep-2 grew 15k → 110k tokens inside one turn of
  7 requirements; the gateway window for flash is configured at 131k. Cache hits come from the
  stable prefix (Prime: 4.8 M cached vs 141 k fresh), not from keeping the session alive.
- Edit in place, never rewrite: output tokens are 52% of our cost (run 5: 488 k); Prime wrote
  the same amount of app for 37 k.
- Harness-owned checks: every run-7 root cause lived in model-written checks.
- Design card: the run-7 Archive/Archived collision and the run-5 dialog names are
  cross-batch naming disagreements; one shared card removes the disagreement at the source
  and gives the check compiler and the implementer the same names.
- No gate/kernel: Prime's gate fired 0 times in two runs; kernel calls were 1:1 with model
  calls. Nothing to adopt beyond the three properties above.

## Pending inputs (tonight)

1. `oneshot-lab`: does the design card raise the one-shot score (flash ×2 with vs without)?
   If not, the design step is dropped and the partition uses the contract alone.
2. `checks/` calibration on runs 5 and 7: official-fail → local-pass must be 0. Until then the
   repair step has no verdict source and the loop stops after generate + verify.

## Size and place

`kernel/` on `feat/ts-kernel`, TypeScript, same toolchain as `checks/`. Target ≤ 800 lines
excluding tests. `main.py` shim execs `node kernel/dist/index.js`. First run: Keep, flash,
compare with run 8 (fallback) and Prime keep-3 on score, calls, output tokens, CNY.
