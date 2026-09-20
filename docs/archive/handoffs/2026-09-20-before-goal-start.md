# Current handoff — 2026-09-20: fixed-draft repair experiment

Branch `exp/fixed-draft-repair-20260920` starts from main `248eb65`. Read
[the experiment report](reports/2026-09-20-fixed-draft-repair.md) and its
[evidence receipt](evidence/2026-09-20-fixed-draft-repair.json).

## Observed results

- Recovered three real platform traces and verified all eight delivered source files per
  application against the downloaded ZIPs. Immutable drafts/repairs are in ignored
  `runs/fixed-draft/`; local replays used disposable copies, fresh data and UTC.
- 12306 original Flash repair: 73/135 before, 74/135 after, one new pass and no regression.
- Ctrip original Flash repair: 0/125 before, 42/125 after. Historical acceptance rejects it;
  r28 acceptance keeps the same response. This is a local, same-draft counterfactual.
- Manual diagnostic references, explicitly not Flash outputs: 12306 date seed repair
  73/135 to 87/135 (16 gained, 2 order regressions); Bookstack dispatch repair 16/34 to
  18/34 under the saved current Lite suite (2 gained, no regressions).
- Bookstack calibration is unresolved: historical official Lite was 22/34; upstream Web
  replays 24/34 twice; current platform Lite pack replays 16/34. Do not mix these scores.
- The fresh same-model diagnostic arm is incomplete: five transport failures and no code
  returned. Preserve those attempts; do not classify them as model repair failures.
- Last meter check 09:22:55 UTC: CNY 83.889382, zero pending events, no new billed requests.
  Failed-request token usage is unknown. No official run or upload was created.

## Next

Use the evidence to prioritize filled-form/business-path feedback and retaining effective
whole-app repairs. The date-only manual patch regresses order behavior and is not a
candidate. The production harness/package remain unchanged. When model transport recovers,
resume the explicit-diagnostic Flash arm from its saved prompts and original draft; the
existing free replays do not need repeating unless their inputs/environment change.

The user explicitly authorized ARC experiments to use the existing balance without
per-call budget questions; ask about funding only when funds are insufficient. This does
not authorize unrelated work or silently turning a diagnostic patch into the candidate.
