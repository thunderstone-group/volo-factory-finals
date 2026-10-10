# Draft-only mode: criteria written before the runs (09-28 10:30)

Question: is a submission that only drafts (no written tests, no repairs; about CNY 1-1.5 a task) a better lottery
ticket for the best-ever S than the full pipeline (about CNY 14 a submission)?

Data: 6 Sheet + 6 GitHub draft-only runs of pkg-flash.zip (main c03f09c + per-call fallback), practice key, scored
by the hidden-intent evaluator (Sheet: `sheet`; GitHub: `github-polluted`, the mode that matches the hidden suite).
Cost per run from the `usage` line (estimated_cost_cny).

Mapping to hidden (from the 09-27 calibration, not refit on these runs):
- Sheet: hidden = evaluator - 12 (median offset on 13 apps); pessimistic - 17.
- GitHub polluted: hidden = evaluator - 13; pessimistic - 15.

For every Sheet x GitHub pair: p = (G + S) / 2, b = cost_G + cost_S, S = p * (0.8 p / b)^0.1.

Decision:
- Cheap mode goes on the official budget when, under the pessimistic mapping, the expected number of draws with
  S >= 60 that CNY 100 buys is at least twice the full pipeline's. Full pipeline reference: 1 of 8 recent submissions
  beat 57.4, none reached 60; take P_full(S >= 60) = 0.05 at CNY 14, i.e. 0.36 expected draws per CNY 100.
- Otherwise it stays off, and the result is recorded as a negative.
