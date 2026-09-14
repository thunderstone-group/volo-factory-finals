# lab/ — registration timing bench (task `exp/reg-timing`)

Measures where the wall-clock time of the official public test
`REQ-1.1: successfully register a new account and remain signed in` goes for the E057
candidate, and what application-side changes shorten it.

- `bench.py` builds a candidate app, launches it, runs the unchanged public tests under a
  hosted-shaped Playwright config, and extracts a per-action timeline from `trace.zip`.
- `variants.py` generates ablation variants as explicit patches over `variants/baseline`.
- `experiment.py` runs a plan (variant x mode x repetitions) and writes raw JSON.
- `analyze.py` folds the raw JSON into `docs/evidence/2026-09-14-registration-timing.json`.

Modes: `host` (app in a 1-CPU container, Playwright and Google Chrome on macOS) and
`cpuN` (app and the Playwright runner in one container limited to N CPUs).

Public test bytes are never modified. `variants/baseline` is a copy of the archived E057
application; the archive itself is read-only input.
