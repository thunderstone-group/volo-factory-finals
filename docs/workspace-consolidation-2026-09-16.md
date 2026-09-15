# ARC workspace consolidation — 2026-09-16

## Decisions

VOLO remains the sole main project. One-shot is `oneshot/`, the independent forum
command is `qiwoo` plus `tools/qiwoo_cli/`, and the reusable platform client stays in
its existing standalone repo. No second copy of that client is retained. The old
multi-round runtime remains a frozen baseline; its root entry is not silently replaced.

## Recovery and retired work

Before removal, every retained file was hashed, packed, read back and compared to its
live source. Regenerable caches, virtual environments and node_modules were excluded.
The original `oneshot-lab` files, including dirty/untracked work, were backed up but
NOT removed or rewritten. All private archives are under
`runs/workspace-archive-20260916/` in the main checkout, mode 0700/0600, outside Git.
They must not be published as attachments: raw experiment evidence is private.

| Removed worktree | Preserved tip | Pushed annotated tag |
|---|---|---|
| bigtask-keep | `62ce5ca` | `archive/2026-09-16/bigtask-keep` |
| cli-sync | `2757b78` | `archive/2026-09-16/cli-sync` |
| small-public-acceptance | `57b0873` | `archive/2026-09-16/small-public-acceptance` |
| ts-kernel | `8edb1ee` | `archive/2026-09-16/ts-kernel` |
| upload-keep | `875fbaa` | `archive/2026-09-16/upload-keep` |

Six `.tar.gz` files have per-file `.manifest.json` inventories, including the source
experiment. `volo-factory.bundle` and `oneshot-lab.bundle` were verified with Git.
Recovery is either a new worktree from an archive tag or a clone from the bundle;
inspect the private manifest before extracting supplementary untracked evidence.

23 already-merged remote branches were removed atomically with exact per-ref leases.
The branch manifest and verification are retained in `remote-branch-prune-result.json`.
PR #21 (state contract) was closed with archive references; its advanced local tip was
pushed as a tag first. CLI de-vendoring from PR #18 was integrated with merge ancestry,
preserving both sides of the append-only progress-document conflict.

## Processes and cloud runs

An orphaned read-only status poll (PID 46429 at inspection) still occupied ts-kernel.
Its 13 awaited run IDs were each confirmed PASSED or FAILED before SIGTERM to that
specific shell and its sleep child. No editor, running generation or remote run was
stopped by that operation. The fifth worktree was removed only after the cwd guard
cleared and its files again matched the archived manifest.

The expanded platform query returned 198 runs: 87 PASSED, 99 FAILED, 10 CANCELLED,
and 2 PENDING. Those older pending records use the names `pi-harness-agent-reqcap`
and `pi-harness-agent`. Their IDs are `c5608657cdd0` and `a6d5b8635598`. The attempted
cancellation was blocked by the safety layer before execution, so both remain. There
was no new paid model experiment, official run or upload; history and scores are retained.
The local Docker daemon could not be reached. No claim is made about stopped container
or image residue, unknown cloud VMs, or unrelated project resources.

## Delegation and validation

WebCodex native `coding_agent_start` returned `agent_capability_unavailable` for this
Runner. Actual delegation used installed Codex CLI 0.154.0 `codex exec` in separate
workspace-write worktrees. All three initial jobs timed out after producing partial
patches; this was NOT treated as successful delivery. The coordinator reviewed the
files, fixed the one-shot HTTP cleanup/redirect boundary, preserved forum reply links,
ran the offline checks and committed validated component changes. CLI hardening is a
separate review in its own repo, not a claim about an already-upgraded installed CLI.

One-shot: 25 mock/file tests passed; deterministic package SHA-256 is
`778f2ec1a39efe6bcb44b34dfc074f18ec2d6b18f6604b785b74a004b587d058`.
Forum: 44 synthetic tests passed. No real forum authentication or posting was performed.
The additional one-shot loopback test was denied socket binding in the delegate
sandbox, and was not rerun with expanded permissions. The old project-wide suite is
not reported as newly green. These checks prove plumbing only, not generated app quality.
