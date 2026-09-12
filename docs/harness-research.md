# Harness mechanisms to adopt

**Follow-up, 2026-09-12:** see the [architecture audit](harness-architecture-2026-09-12.md)
for newly reproduced acceptance/recovery gaps and a gated mature-harness comparison.
The source review below is historical; local mechanisms do not establish end-to-end
performance or an independent acceptance oracle.

Reviewed 2026-09-11. Goal: strengthen VOLO for larger and changing requirements while
keeping all competition model calls on the organizer gateway. This is a source review;
it is not a performance ranking of the reviewed projects.

## Decision

Keep one execution core and introduce selected, independently measurable policies.
Do not stack several complete agents on every requirement. Keep version 0.6.0 as the
measured baseline and use fixed task versions for each comparison.

| Project | What it is useful for | Candidate mechanism | Initial integration choice |
|---|---|---|---|
| ARC | A competition-oriented requirement compiler | Requirement-to-interface/test/code traceability; dependency scheduling; phase-aware retry and incremental operations | Adopt node change tracking and narrow retry semantics as larger tasks require them |
| Octos | An embeddable Rust harness kernel with a controller protocol | Explicit task lifecycles, committed checkpoints, supervised jobs, context preparation | Borrow lifecycle and checkpoint invariants; evaluate a kernel adapter separately if needed |
| Codex | A coding runtime with mature history and tool handling | Separate durable history from the model window; preserve user facts and tool pairs; structured patches | Improve local context projection without depending on a provider-specific compaction endpoint |
| Claude Code | An agent product with documented hooks, checkpoints and isolated subagents | Deterministic pre/post-tool and completion gates; scoped work; reversible edits | Keep real verification as a completion gate and make policy hooks explicit when a second policy is needed |
| Pi | A small agent loop separated from model conversion and session management | Context transforms, valid compaction cut points, a retained recent tail, tool argument validation | Use a compact context policy and provider-neutral message representation before considering a TS runtime |
| DeepSeek Harness | A composable plugin runtime with an event-sourced session | Model-visible context derived from logged events; tool-result pruning; persistence barriers | Preserve exact raw events and log every model-visible projection or compaction |

## Source observations

### ARC

At `c52f92d2af6a2d773d31ed4663eef395ae722c46`, `ARCWorkflowManager` can append
incremental operations for affected nodes. Interrupted work preserves useful files
and records the phase and dirty-file context. Retry logic distinguishes a design
failure from an implementation failure, preserving a completed design when possible.

This is more precise than VOLO's current whole-requirement fingerprint. A future
delta planner should identify changed nodes and their dependents, then verify the
affected behavior plus existing regressions. It needs trustworthy requirement/file/test
relationships; merely skipping unchanged text would be unsafe.

Sources: [incremental operations](https://github.com/code-philia/agentic-requirement-compiler/blob/c52f92d2af6a2d773d31ed4663eef395ae722c46/src/core/workflow.py#L683),
[interruption recovery](https://github.com/code-philia/agentic-requirement-compiler/blob/c52f92d2af6a2d773d31ed4663eef395ae722c46/src/core/workflow.py#L922),
[phase-aware retry](https://github.com/code-philia/agentic-requirement-compiler/blob/c52f92d2af6a2d773d31ed4663eef395ae722c46/src/core/workflow.py#L1015).

### Octos

At `8558a3bff41f43838130808a1fa6cf0299e0bc40`, Octos is a reusable Rust kernel,
with C/Python/Swift/Kotlin bindings and OUP for controlling sessions and tasks.
Its pipeline checkpoint stores completed node outcomes and resume state with
atomic writes. Conversation preparation treats ordering and tool-call/result pairs
as protocol invariants, and avoids competing truncation owners.

For VOLO, the useful lesson is one owner per execution/context state and explicit
accepted/running/completed/failed outcomes. A saved upload or accepted RPC is not a
verified result. We have already encountered that distinction in platform archive failures.

Sources: [kernel overview](https://github.com/octos-org/octos/blob/8558a3bff41f43838130808a1fa6cf0299e0bc40/README.md),
[message preparation](https://github.com/octos-org/octos/blob/8558a3bff41f43838130808a1fa6cf0299e0bc40/crates/octos-agent/src/agent/loop_compaction.rs),
[pipeline checkpoints](https://github.com/octos-org/octos/blob/8558a3bff41f43838130808a1fa6cf0299e0bc40/crates/octos-pipeline/src/checkpoint.rs).

### Codex

At `eabb7c91d1619010be044cc17b2380ad11c9b651`, the context manager distinguishes
the current prompt from retained history and facts. Removing a history item also
handles corresponding protocol items. Compaction and tool-output truncation have
explicit lifecycle and budget handling.

Adopt those invariants rather than assuming the competition gateway supports an
OpenAI-specific compaction API. The gateway's Responses/compaction compatibility
has not been verified. Our existing Chat Completions transport remains the tested path.

Sources: [history manager](https://github.com/openai/codex/blob/eabb7c91d1619010be044cc17b2380ad11c9b651/codex-rs/core/src/context_manager/history.rs),
[budgeted compaction](https://github.com/openai/codex/blob/eabb7c91d1619010be044cc17b2380ad11c9b651/codex-rs/core/src/compact_token_budget.rs),
[official conversation-state documentation](https://developers.openai.com/api/docs/guides/conversation-state).

### Claude Code

The reviewed official documentation describes edit checkpoints and lifecycle hooks
before/after tools and before stopping. File checkpoints do not roll back effects in
remote databases or APIs. The public documentation is the evidence here; this review
does not claim inspection of the complete product's internal source.

VOLO already requires actual build/start/behavioral checks before completion. Extend
that policy where failures justify it, and keep file rollback separate from external
side-effect recovery.

Sources: [how Claude Code works](https://code.claude.com/docs/en/how-claude-code-works),
[hook lifecycle](https://code.claude.com/docs/en/hooks#hook-lifecycle).

### Pi

The former `badlogic/pi-mono` repository now resolves to `earendil-works/pi`.
Reviewed commit: `d12cd92e45e308d4af000554292165ef1984253b`, coding-agent 0.85.1.
The loop separates context transforms from provider conversion and emits tool lifecycle
events. Compaction uses valid cut points and a recent tail; session context is rebuilt
from the latest compaction entry and subsequent events. Truncated tool arguments are
not executed as though they were complete.

Its package requires Node >=22.19.0. Our observed competition runner has Node 20.19.3,
so direct embedding needs a separately validated runtime bootstrap. The same context
and tool-validation policies can be implemented in the current Python runtime first.

Sources: [agent loop](https://github.com/earendil-works/pi/blob/d12cd92e45e308d4af000554292165ef1984253b/packages/agent/src/agent-loop.ts),
[compaction](https://github.com/earendil-works/pi/blob/d12cd92e45e308d4af000554292165ef1984253b/packages/agent/src/harness/compaction/compaction.ts),
[session projection](https://github.com/earendil-works/pi/blob/d12cd92e45e308d4af000554292165ef1984253b/packages/agent/src/harness/session/context.ts),
[runtime requirement](https://github.com/earendil-works/pi/blob/d12cd92e45e308d4af000554292165ef1984253b/packages/coding-agent/package.json).

### DeepSeek Harness

Reviewed clean local checkout: `47f943859bef60e4160492346772ded9b24f765a` from
`deepseek-ai/deepseek-harness`. Its event log is the source for model history. The
tool-result pruner retains full events while creating bounded model-facing replacements.
Its checkpoint policy flushes before model requests and top-level tool side effects.

This is a useful rule for our audit trail: a compact prompt must remain reconstructable
from saved evidence, even when old tool output is omitted from the next request.
The full plugin tree is not required to implement that rule. This checkout also requires
a newer Node runtime than the observed competition image.

Sources: [architecture](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/docs/architecture.md),
[tool-result pruning](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/compaction/compaction-tool-result-pruner/README.md),
[persistence barriers](https://github.com/deepseek-ai/deepseek-harness/blob/47f943859bef60e4160492346772ded9b24f765a/packages/session/session-checkpoint-policy/README.md).

## Integration order and acceptance

1. Run the unchanged v0.6 baseline on Evolution and Ticket Booking. Preserve its source
   revision and official results before adding mechanisms.
2. Replace coarse context resets if longer runs expose context loss. Retain current
   requirements, decisions, file inventory, real failures and complete recent tool exchanges;
   preserve provider-specific reasoning fields in retained messages and log the projection.
3. Introduce requirement-level deltas and phase-aware recovery when unchanged work is
   being repeated. Verify both changed and unaffected behavior on evolution tasks.
4. Add stronger completion/coverage checks when an application builds but required flows
   are missing. Self-authored checks remain repair feedback, not official scores.
5. Add bounded implementation/review concurrency only after serial execution is reliable,
   with isolated writes and explicit token budgets. No unmeasured multi-agent fan-out.

For each mechanism, compare enabled/disabled runs on the same task and model conditions.
Record pass rate, tokens/cost, wall time and repeatability. Keep a held-out task for transfer.
No third-party runtime source was vendored by this review.

## Implemented in 0.7.0.dev1

The unchanged v0.6 baseline won Smoke Evolution (4/4 official tests). Ticket Booking
could not create a run because of platform archive availability, recorded separately.

The first integration applies the shared Codex/Pi/DSH context invariants in `volo/context.py`:
keep durable raw events, derive a bounded model window, prune only old tool results,
and retain a contiguous tail of complete assistant/tool exchanges. When that still
exceeds the character limit, construct a checkpoint from the current requirements,
file inventory, completed IDs, DESIGN.md excerpt and latest actual verification/tool
failure. Accepted verification and latest attempted verification are now distinct.
Retained provider reasoning fields and tool arguments are unchanged. Each projection
is logged, and the subsequent model-request event contains the exact projected prompt.
No extra model request or provider-specific compaction endpoint is introduced.

Under the limit, the existing prompt is unchanged. If even the current checkpoint
exceeds the limit, fail explicitly rather than send an oversized prompt or fabricate
tool results. This is deterministic context reduction, not a semantic summary model.

Validation: 26 local checks passed, including a real Node HTTP check failure and repair
across forced context pressure, retained real-response protocol fields, raw-history
preservation and exact below-limit prompts. Corpus inspection also exposed and fixed
ancestor-container dependency expansion (see `corpus.md`). Neither the new context
policy nor its effect on model quality/cost has yet been evaluated on the official gateway.

## Decisions from later real runs

- Keep one execution core, exact raw traces and protocol-preserving context projection.
  E025–E031 validate one-call incremental edits; dev16 returns Evolution to first.
- Keep execution as a completion gate and trigger authored test entries immediately.
  E034 shows that source-string framework detection can suppress the first verification;
  filename-based entrypoint discovery avoids that silent omission.
- Remove the additional model-created UI contract. Separate generation did not make
  its interpretation independent of model errors: E036 changed an alternative name
  requirement into two controls and caused the implementation to reproduce that mistake.
  Dev20 passes original requirements and image observations directly to the coding agent.
- Generated tests remain repair feedback. Before promoting another generated test layer
  to a completion gate, establish its accuracy against an independent reference or known
  correct implementation. A second model call alone does not establish that accuracy.
- Keep the failed designs, exact source revisions and measured outcomes in Git and
  `experiments.md`; do not preserve an unused layer merely because it has passing unit tests.
- E038 tests source review without evaluator input. Two reviews truncate, and the one
  completed structured response misses both reproduced semantic defects. Keep the
  single implementation/check loop; reviewer independence must be measured, not assumed.
- Provider controls need model-specific documentation and real request evidence.
  Kimi K3 always reasons and defaults to maximum effort; dev22 uses its supported
  low setting. E040 reaches execution but still fails before official evaluation, so
  improved output completion does not establish implementation quality or lower winning cost.
