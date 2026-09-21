# Resume the saved paired-repair experiment

Last reviewed: 2026-09-21.

This operations command resumes the fixed-draft experiment's existing `plan.json`,
frozen baseline/candidate sources, completed receipts and browser results. It is not
part of the competition agent or ZIP and does not create official runs or uploads.

```sh
uv run --no-project --python 3.11.15 python scripts/resume_repair_experiment.py status --run-dir /path/to/runs/goal-20260920
uv run --no-project --python 3.11.15 python scripts/resume_repair_experiment.py resume --run-dir /path/to/runs/goal-20260920
```

Use the experiment's original Python runtime. For this saved experiment it is **3.11.15**;
the repository's older 3.9 virtual environment produces different unordered diagnostic
text even with `PYTHONHASHSEED=0`. The byte guard stops that change before a model request.
Each new attempt records its Python version and executable. A mismatched preparation
stops the current invocation; after correcting the runtime, resume can use the remaining
attempts without resetting the cumulative limit. The frozen agent is not rewritten to
change sorting in the middle of this experiment.

Run from the `repair-experiment-recovery-20260921` worktree (or a checkout containing
these versioned scripts); `--run-dir` points to the separate preserved experiment.
The resume command rejects other Python versions before changing state or contacting
the model.

The existing local `arcbench-cli` client supplies authentication from
`~/.config/arcbench/volo.env`. The command uses the existing `hk-zyl` SSH host by default;
`--ssh-host` selects another already-configured host. Each actual model request owns
its temporary SOCKS tunnel and curl process. No global routing or proxy setting changes.
The recorded legacy replay environment must remain installed: the saved published
suites, Chromium, and `bigtask-keep/harness_lab/state_rehearsal.py`.

## Recovery contract

- The candidate must match the frozen plan hash; baseline source must match the plan's
  Git commit. The comparison keeps the original model, feedback, generation and
  acceptance rules. A retry's request bytes must match the saved request before it
  reaches the gateway.
- Completed pairs are skipped. A completed step requires its receipt, application and
  consistent trace. A complete provider response without a completed receipt stops for
  offline artifact recovery; it is never automatically regenerated.
- Each model step has **three cumulative attempts**, including imported historical
  attempts and local setup failures. Reinvoking the command does not reset the cap.
  Only diagnosed incomplete streams or local setup failures are retried automatically,
  with a 15-second delay. Permanent HTTP and unknown failures stop the batch.
- A file lock prevents concurrent recovery commands. Worker children inherit the lock,
  so losing the controller does not allow another request while its worker is alive.
  A lock file's existence is not proof of activity; the operating-system lock is used.
- `holdout/recovery.json` stores reservations, outcomes, request hashes and archive
  intents. State, receipts and progress JSON are replaced atomically. Failed directories
  are archived without replacing their traces. A completed attempt is never selected
  or discarded according to its score.
- Identical repair requests can reuse a saved complete response; the complete request
  parameters are compared, not just messages. Source-identical applications share a
  browser result within the paired comparison's UTC day.
- Completed historical pairs remain intact. When resuming an incomplete pair on a
  different UTC day, its old browser result is archived and its unchanged application
  is replayed on the new day. This costs no model call. A day boundary during a pair
  stops the comparison. A finished browser summary can be finalized without another
  evaluation; an incomplete browser run requires inspection before reuse.

## Inspect a stopped step

Read `holdout/state.json` and the active step's `transport.json`, `trace.json`,
`curl.stderr` and `ssh.stderr`. Distinguish no request reaching the gateway, a partial
stream, a completed response with an invalid application, and a browser infrastructure
failure. Missing usage is unknown, not zero. The controller does not raise its retry
limit when the gateway keeps failing.

After a six-pair terminal outcome, use the existing saved audit and accounting tools
to check source/suite identities, case-level gains and losses, known charges and unknown
usage. A local retention decision is a review artifact, not an official benchmark score
or permission to replace an official submission.

## Verification

```sh
PYTHONPATH=scripts python -m unittest discover -s tests_oneshot -p test_experiment_recovery.py -v
```

The recovery tests cover interrupted atomic writes and archive updates, cumulative
retry bounds, complete-response preservation, request mismatches, permanent HTTP
failures and a real child process retaining the operating-system lock. Generated
transport fixtures are labeled synthetic; live gateway and browser evidence is
reported separately in the dated recovery report.
