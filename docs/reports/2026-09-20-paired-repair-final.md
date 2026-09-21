Update 2026-09-21: [Recovery evidence and supplemental rejected-proposal results](2026-09-21-repair-experiment-recovery.md).

# Paired repair decision — 2026-09-20

Retain the frozen candidate for review.

All six planned comparisons finished: three independently generated drafts each for 12306 and Ctrip. The candidate changes only requirement-driven literal-clock diagnostics and acceptance of repairs that clear startup errors despite source-detected control-name changes.

Local task-equal pass rate: **35.79% baseline, 43.20% candidate**, a **7.41 percentage-point** change, with **0 additional lost cases** versus the baseline delivery. These are not official scores.

| Pair | Raw draft | Baseline delivery | Candidate delivery | New passes | New losses |
|---|---:|---:|---:|---:|---:|
| 12306-1 | 60/135 | 60/135 | 60/135 | 0 | 0 |
| ctrip-1 | 24/125 | 49/125 | 49/125 | 0 | 0 |
| 12306-2 | 24/135 | 24/135 | 84/135 | 60 | 0 |
| ctrip-2 | 29/125 | 29/125 | 29/125 | 0 | 0 |
| 12306-3 | 88/135 | 86/135 | 86/135 | 0 | 0 |
| ctrip-3 | 33/125 | 33/125 | 33/125 | 0 | 0 |

## Evidence and attribution

The source, evaluator, request-context and case-count audits are in [the receipt](../evidence/2026-09-20-paired-repair-final.json). Drafts were reconstructed from actual complete model responses over the frozen scaffold. Baseline and candidate operate on the same draft. Identical repair requests reuse the same actual reply, and source-identical deliveries reuse the same replay outcome. This isolates acceptance differences from a lucky additional model draw.

In 12306-2, the same proposal was rejected by baseline for source-detected From Station / To Station changes and retained by candidate. The retained score changed from 24/135 to 84/135, with 60 gains and no baseline loss. Both station-filter cases are among the gains. The proposal hash matches the candidate delivery.

The current-date diagnostic improved the earlier fixed development draft; its activation on the independent samples is recorded in `runs/goal-20260920/mechanism-activation.json`. Do not attribute every independent gain to the date diagnostic.

## Limits and remaining faults

Ctrip-2 illustrates a remaining conservative rejection: both arms retained 29/125, while a supplemental replay of the discarded proposal reached 30/125 (+1, no loss). The frozen candidate was not changed to exploit this result.

12306-3 illustrates pre-existing repair damage: raw 88/135 became 86/135 in both arms, with one gain and three losses from the raw draft. Those three cases concern essential-information edits/password validation and opening password reset from quick login. “No additional regression” must not be read as “every repair is lossless.”

The two initial uncontrolled label-diagnostic calls in 12306-1 differed only in a Date/Name example because of Python hash randomization. They remain archived. PYTHONHASHSEED=0 was fixed before judging the pair; the canonical request matched the original baseline request exactly, so its actual response was reused without selecting by score. Generator prompts were unchanged.

Incomplete model streams remain transport failures with retained records; no scored pair was discarded and replaced. An existing user-owned HK SSH SOCKS route enabled complete responses, but both HTTP/2 and HTTP/1.1 still had intermittent incomplete streams. There is no claim that changing HTTP version permanently fixed the upstream issue.

## Expense and review artifact

Known billed model expense: **CNY 8.916223**. Known reported tokens: **951,865 input / 908,991 output**. **7 attempts lack usage**; missing usage is not counted as zero. The receipt lists bill matches and unmatched attempts. Active calls must be absent before closing the goal.

Engineering validation: 30 smoke tests passed; 40 offline/package tests passed; legacy required suite 214 passed and 12 skipped (226 total). These checks are distinct from the application scores above.

Review ZIP: `runs/goal-20260920/candidate-v1.zip`, SHA-256 `3991d48c14b19fd2bf1f277dfc4d1ea7d5b69aa665fa52006cbbe3aabb2c3043`. Its main.py matches the frozen candidate. No official run/upload, main-branch merge, or official-candidate promotion was performed.
