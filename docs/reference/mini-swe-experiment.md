# mini-SWE-agent comparison

Last reviewed: 2026-09-22.

This opt-in experiment compares VOLO's fixed-feedback, complete-file repair policy
with a pinned mini-SWE-agent native tool loop. It does not replace the competition
entrypoint. Both arms use the same saved application, requirements, protected checks,
Flash model and conservative token-cost allowance. Prompt packaging differs: the
fixed-feedback arm gets a complete snapshot, while mini can inspect and edit files,
build, explore the browser and request verification.

## Components and execution

Upstream is `SWE-agent/mini-swe-agent`, version 2.4.6, commit
`04d809ceab9df28f9adaed044884180159172930`. The repository is imported from its pinned
source checkout. `DefaultAgent.run/step` are unchanged; a subclass saves its trajectory
atomically. Dependencies for this custom model/environment integration are in
`scripts/mini_swe/requirements.txt`; default third-party model adapters are not used.

```sh
uv venv --python 3.11.15 .venv
uv pip install --python .venv/bin/python -r scripts/mini_swe/requirements.txt
.venv/bin/python scripts/mini_swe/run_experiment.py --run-dir RUN_DIRECTORY
```

A plan pins source, requirements, probe, driver hashes, upstream revision, budget and
limits. A terminal receipt prevents repeat calls. Modified code requires an explicitly
recorded recovery manifest or a new experiment plan; do not rewrite frozen inputs.

`arc_model.py` adapts native `bash` tool calls through the existing official platform
client and owned transport. It preserves assistant `reasoning_content`, tool-call IDs,
usage, finish markers and raw private traces. The provider must identify the requested
model. Missing response data is a transport failure, not evidence of a different model.
See the [DeepSeek tool-call requirements](https://api-docs.deepseek.com/guides/thinking_mode/).

`environment.py` implements the upstream environment protocol. The model can execute
shell commands only in a network-isolated Docker workspace. Application source and
diagnostic notes are writable; credentials and evaluator sources are outside the
container. Browser exploration uses a disposable live copy so runtime data does not
silently alter source. The final native API tools are:

- `arc_build`: build a live copy and restart its app/browser.
- `arc_browser(script_path="/workspace/notes/check.js")`: run an async Playwright script with `page`,
  `browser`, `context`, `expect` and `log`. Browser state persists until rebuild.
- `arc_verify`: run protected shared-backend checks and record a checkpoint; regressions
  restore the accepted source.
- `arc_status`: show accepted scoped progress.
- `arc_submit`: finish only when protected verification accepts the scoped goal.

These tools are native function calls, not programs to locate in the shell. An earlier virtual-command interface was rejected after real trajectories showed wasted executable searches.

Model-authored checks remain diagnostic. The unchanged public 125-case evaluator is
used only after selecting outputs, never in model feedback or per-round acceptance.
The initial study uses 27 prior regression journeys plus 9 booking/payment checks.
Accept only a strict target gain without losing any previous passing fixed case.
A scoped pass does not establish full requirement coverage.

## Budget and transport

Each arm uses a CNY 3 allowance computed at the frozen uncached input/output rates
(3/9 CNY per million tokens), at most 32 request slots and 6 verification attempts.
Before sending, the adapter reserves a conservative input bound plus output capacity.
Cache discounts are excluded from this allowance; settled billing is reported separately.
The fixed-feedback arm also retains its two-proposal stagnation stop.

Direct long requests can be interrupted before complete SSE/usage. The detached relay
runs one HTTPS request on the user-owned `hk-zyl` host. Credentials travel through
process pipes, never command arguments or repository files. The remote request has a
bounded lifetime; a stable private job ID makes launch acknowledgement retries idempotent.
Responses are retrieved in checksummed chunks. An ephemeral, shared SSH control
connection reduces repeated authentication; reconnecting does not restart inference.
Cleanup failure cannot invalidate an already complete, verified response.

## Recovery

Preserve old ledgers, receipts and driver snapshots. `recover_run.py` can retrieve a
completed response from an existing relay job without issuing another model request.
A failed SSH launch can release its reservation only when the complete owned-job
inventory and transport evidence establish that no worker/request was started. Unknown
provider usage stays unknown. Never treat a partial stream as a complete application.

```sh
.venv/bin/python scripts/mini_swe/recover_run.py --run-dir INTERRUPTED_RUN
.venv/bin/python scripts/mini_swe/run_experiment.py --run-dir INTERRUPTED_RUN
```

Recovery binds new driver hashes to the unchanged original plan. Restart reconstructs
the native conversation using cached completed model responses and cached tool results,
without re-executing completed actions. An uncertain tool action still stops for review.
The classic arm likewise reuses a recovered complete response. Current app/check and
request hashes must match retained evidence before interpreting the continuation.

The local app runtime remains ARM64, Node 20.19.3 / Playwright 1.57.0, one CPU, 2GB and
one worker. This is not the full official x86_64 submission lifecycle. An external
harness is justified by measured quality/cost/reliability, not by a larger turn count.
