# Harness consolidation review

Date: 2026-09-12. User requested that existing evolution be reviewed, combined into
`main`, and subsequent development start from that baseline. This record describes
integration choices; use Git for current branch/worktree state.

## Inputs retained

- `8095500` and its ancestry: official dev29 candidate, all earlier runtime/CLI work,
  experiments and frozen Smoke/Evolution results. `main` had remained at `b8652aa`.
- `596fe7b`: pinned Node acceptance integrated with verification and repair, bounded
  environment discovery, active-tool enforcement, coverage-aware recovery.
- `8f0f25d`: isolated Docker evaluator and real Pi CLI protocol probes, plus output
  recovery checks. Pi responses in those probes are synthetic.
- `fbd0a2a`: pinned generic external process evaluator, self-check terminology and
  additional recovery/status regressions.
- `8881122`: previously uncommitted bounded model-browser experiment, captured before
  modifying or clearing the original working directory. Its exact original files are
  recoverable from this commit; subsequent commits relocate it without enabling it.

Independent branch parents remain in merge history, rather than being represented as
three successive verified competition improvements. Version `0.7.0.dev31` identifies
the consolidated upload candidate; it has no new official result.

## Overlap decisions

1. Keep one production truncation path: reject incomplete tools, release forced mode,
   preserve source, stop after three consecutive truncations and retain a structured
   failure in context. Normalize older test expectations to its event vocabulary; do
   not maintain three event aliases or three execution loops.
2. Keep the pinned `node:test` runner in `volo/acceptance.py`, explicitly enabled by an
   external contract. Retain self-checked and independently verified requirements as
   separate fields in outputs, checkpoints and model context. A configured suite may
   emit requirement-pass events only for cases it actually verifies.
3. Move the model-generated browser experiment to `harness_lab/acceptance_probe.py`
   and its browser implementation beside it. It uses the shared transport's one-attempt
   option. Default inspection makes no model call; normal agent transport retains its
   existing retry policy. This experiment is not the fixed acceptance runner and is
   excluded from upload packages.
4. Put generic process evaluation at `harness_lab/external_gate.py`; keep the Docker
   evaluator and Pi adapter in the same lab. The [lab map](../../../harness_lab/README.md)
   explains their different invocation and isolation contracts. They are opt-in tools,
   not stacked default stages. Runtime unification beyond these overlaps needs evidence.
5. Shorten README and update the agent map so the repository has one current entry.
   Earlier branch reports and their hash-bound test evidence remain dated history.

## Findings and remaining limits

- Executor-authored checks may still be weakened. Without a calibrated independent
  contract, the result correctly remains self-checked only. Pinned tests are not a
  semantic oracle; correct/incorrect application controls are still required.
- One older recovery test returned `finish` while only `patch_and_verify` was offered.
  Active-tool enforcement correctly rejected that response. The fixture now weakens a
  self-test through the offered patch tool and confirms that the wrong product remains
  independently unverified; no production guard was removed to satisfy the test.
- Local HTTP/Chrome and container tests establish execution boundaries. They do not
  replace Ticket GUI calibration, explain every official timing failure, establish
  a Pi/Octos quality advantage or demonstrate generalization.
- The inherited primary-navigation uniqueness heuristic remains an explicit known
  limitation. This integration did not silently change competition behavior beyond
  preserving and reconciling the reviewed candidate work.
- The main checkout's ignored `runs/` contains prior private artifacts; it is not pushed.
  Ignored evidence from retired worktrees is retained there before removal. Frozen
  competition tags and original source history remain available.

The [architecture review](harness-design-2026-09-12.md) identifies which ideas to test
next and links the exact GitHub source revisions inspected.

## Validation

See [consolidation evidence](../../evidence/2026-09-12-consolidation.json) for source hashes,
actual checks, packaging and remaining integration limits. No paid model request or
official competition run belongs to this consolidation.
