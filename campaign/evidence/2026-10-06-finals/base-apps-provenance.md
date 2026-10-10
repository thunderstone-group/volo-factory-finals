# Practice evolution starting apps (fetched 2026-10-06 12:35-12:40 +08)

Fetched with `arcbench source <run> <path>` from the output-dir of the baseline runs while the agent was still
running (the package stages its work in a temp dir and publishes only at the end, so output-dir still held the
platform-supplied starting app). File lists were guessed from index.html references; verify against the final
bundles before relying on byte equality.

| dir | task | run |
|---|---|---|
| base-lite-a6e70f4061d2 | arc-bench-lite-evolution--keep | a6e70f4061d2 |
| base-lite-108d9b96822e | arc-bench-lite-evolution--bookstack | 108d9b96822e |
| base-web-12306 | arc-bench-evolution--12306 | 6908dfd75b2b |
| base-web-bookstack | arc-bench-evolution--bookstack | 41019cb9e0e1 |
| base-web-ctrip | arc-bench-evolution--ctrip | f1a38fbc4e47 |
| base-web-keep | arc-bench-evolution--keep | 70b53c1fe2bb |
| base-web-prestashop | arc-bench-evolution--prestashop | 5dbadb474c70 |
| base-web-stackoverflow | arc-bench-evolution--stackoverflow | 5ae9b83511a9 |

The lite "baseline implementation" uses our scaffold layout (lib/arc.js, seed.js), i.e. it is one of our own
arc-bench-lite results, not an organizer-written app.

## Correction (14:55)

The `base-web-*` (and likely `base-lite-*`) copies above are NOT faithful: `arcbench source` output passes through the CLI's
secret redaction, which replaced fragments such as `ARC.state.session = ...` and `password = ...` with `***`, breaking the
JavaScript (five of six web apps render a blank shell). Do not use them as baselines. Faithful starting apps for the six
web tasks were recovered by the regression-guard work from the `Existing application to extend` source JSON in each round-2
bundle's `.arc/stdout.log`, with every file's SHA-256 matched to the snapshot: see `base-recovered/`.
