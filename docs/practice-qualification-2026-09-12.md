# Practice branch: top-two checkpoint

The user's immediate target is the top two, on a **separate specialization branch**.
All work is retained on `perf/arc-practice`. Main is unchanged at `1717ef4` and this
branch must not be merged into it automatically.

The latest live snapshot is:

| Board | Team rank | Pass rate | Reported CNY | Validated package |
|---|---:|---:|---:|---|
| Smoke | **1** | **100%** | **0.002114** | practice1 |
| Smoke Evolution | **2** | **100%** | **0.003011** | practice4 |
| Ticket Booking | **2** | 90% | 0.668715 | Prior dev35; read-only refresh |

These are current leaderboard positions, not guaranteed final positions or an offline
admission award. The user said top two may apply to both practice and formal boards;
we could not confirm the corresponding current official notice. Ticket was not rerun.
The original three-board 100%/first-place goal remains broader than this milestone.

## Successful artifacts

- Smoke, source `50c1bef`: Counter [d222d1133ef7](https://arc-bench.com/runs/d222d1133ef7),
  Dice [a498a01b5c0f](https://arc-bench.com/runs/a498a01b5c0f).
  ZIP SHA-256 `941874953fe1cf7cc2b0bfde46432e5058eb8c29518ad39ba451c72df22fb350`.
- Evolution, source `69972fb`: Counter [a912f4545088](https://arc-bench.com/runs/a912f4545088),
  Dice [2ef485a91200](https://arc-bench.com/runs/2ef485a91200).
  ZIP SHA-256 `dc071c4d398a25c0d4e325d5d163c392e2b8d925010922e604d260ac17f0ae95`.

All four winning task runs use one real Qwen3.6 Flash call and pass independent public
acceptance before the separate official evaluation. Captured and official token totals
match. Product HTML is returned by the model; no prewritten answer applications or
meaningless metering calls are included. The existing runtime and original public
assertions are reused. [Full receipts and usage](evidence/2026-09-12-practice-top-two.json).

## Changes and evidence-driven revisions

The practice runner consumes normative descriptions rather than the general task/tree
wrapping and tool schemas. It outputs raw HTML. Evolution first verifies the supplied
app's original behavior, then supplies its source and the requested change to the model.
The model returns the entire updated page; fixed tests verify both original and new behavior.
Non-default backends, oversized sources and unbound inputs retain the general executor.
This is an explicitly narrow practice profile, not a generalization claim.

Practice1 won Smoke but its Evolution response had an invalid nested edit structure.
Practice2 made the edit shape explicit, but the model treated inline JavaScript as a
separate file. Both failed during generation, before official tests. That protocol was
rejected rather than expanded with speculative compatibility rules.

Practice3 reused raw HTML generation and reached Evolution rank 2 at CNY 0.004319. Its
counter first returned only the added fragment, then repaired it after public acceptance
rejected the missing original controls. Practice4 makes complete-page output explicit;
both tasks pass on their first generation at CNY 0.003011, giving more margin over the
Orchestra reference at CNY 0.004617.

The practice experiments, including failed attempts, cost **CNY 0.022484**. Including
the preceding dev36–dev38 work in this continuation, reported official model charges
are **CNY 0.410255**. These are platform charges, not total engineering/assistant cost.

## Validation and scope

The unchanged base has 175 passing regression checks. The initial practice full run
had two new-test errors caused by a missing `time` import; it was restored before any
submission. Focused checks then passed. The final practice profile passes four real
browser/HTTP controls, including preservation of old behavior and the general fallback.
All successful packages are hash-checked against source; the captured product fixtures
and local evidence are excluded. No rank stability or unseen-task result is claimed.

Raw evidence and frozen ZIPs are retained in the canonical checkout under
`runs/practice1-raw/`, `runs/practice2-edits/`, `runs/practice3-html/` and
`runs/practice4-complete-page/`. Earlier candidate evidence is retained under
`runs/dev36-small-acceptance/`, `runs/dev37-product-only/` and `runs/dev38-compact-request/`.
No official run or scheduled continuation remains active.

The very low competitor charges are observations, not proof of misconduct. The client
renders percentage-based efficiency as `pass/CNY`; it is not an actual completed-task
count. Even our genuine Smoke winner displays 0.0M after rounding its 452 actual tokens.
See the [metric interpretation](small-task-optimization-2026-09-12.md) before making claims.
