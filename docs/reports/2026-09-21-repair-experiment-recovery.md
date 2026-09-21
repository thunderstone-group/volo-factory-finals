# Paired repair recovery and final comparison — 2026-09-21

The saved six-pair experiment is complete. The frozen candidate passes its predeclared
local retention gate: task-equal pass rate rises from **35.79% to 43.20%**, with **60 new
passes and no additional lost cases relative to the baseline agent's deliveries**.
Retain it for review. This is not an official benchmark result or a promotion of an
official submission.

The new recovery command completed the interrupted final pair with **one additional
model call**, billed **CNY 0.490713**, reporting **72,902 input / 30,223 output tokens**.
The candidate reused that same actual response because its full request matched.

## What changed in operations

The earlier experiment depended on unversioned scripts and manual directory/state
edits after network failures. The recovery command promotes those experiment drivers
into version control and adds atomic state writes, an inherited process lock, retained
failed attempts, a cumulative three-attempt limit per step, request-byte checks and
per-request SSH/curl cleanup. Restarting does not reset the attempt counter or repeat
a completed pair. Complete provider responses without completed artifact receipts
stop for offline recovery instead of another model generation.

The command and runtime requirements are documented in
[the recovery reference](../reference/repair-experiment-recovery.md).
The competition agent sources and the original frozen comparison policies were not
changed by this operations repair.

## A real recovery fault caught before spending

The repository's Python 3.9.6 environment regenerated different diagnostic text from
the same application even with `PYTHONHASHSEED=0`. The request-byte guard stopped it
before any model request. The differing text came from same-length entries in the
agent's set-based label ordering; the sample and selected first twelve diagnostics
changed. This is our runtime/control problem, not a model transport failure.

Using Python 3.11.15 reproduced the original request byte for byte, verified offline
before retrying. Its SHA-256 was
`4732178b4bd008b890c18e223a89c1128903b500e2316cd973f42357d5abe98b`.
The final real call returned HTTP 200, curl exit 0, a finish reason, usage and `[DONE]`.
The local preparation failure still counts toward the cumulative attempt limit and
is recorded as not reaching the gateway. Runtime identity is now recorded per attempt.

## Paired local outcomes

The first five completed pairs were preserved. The sixth draft was reused, not
regenerated. Its original 33/125 result was replayed once because recovery crossed a
UTC day; the same source again scored 33/125. Both arms were then compared on that day.

| Pair | Raw draft | Baseline delivery | Candidate delivery | New passes | New losses |
|---|---:|---:|---:|---:|---:|
| 12306-1 | 60/135 | 60/135 | 60/135 | 0 | 0 |
| Ctrip-1 | 24/125 | 49/125 | 49/125 | 0 | 0 |
| 12306-2 | 24/135 | 24/135 | 84/135 | 60 | 0 |
| Ctrip-2 | 29/125 | 29/125 | 29/125 | 0 | 0 |
| 12306-3 | 88/135 | 86/135 | 86/135 | 0 | 0 |
| Ctrip-3 | 33/125 | 33/125 | 33/125 | 0 | 0 |

The gain comes from retaining the same startup-error repair that the baseline rejected
in 12306-2. The new date diagnostic did not activate on any of the six independent
drafts; its development-draft improvement is not independent evidence of generalization.

## Acceptance limitations remain

Both policies rejected the final Ctrip repair for changing the source-detected names
`+ 添加返程` and `请输入验证码`. A supplemental replay of the discarded proposal scored
**36/125 versus 33/125, three gains and no regressions**. The gains cover combined
filters, sorting by on-time performance and sorting by departure time. This is another
false rejection, alongside Ctrip-2's previously measured 30/125 versus retained 29/125.
These diagnostic replays do not change the frozen six-pair comparison.

Conversely, 12306-3 already loses three raw-draft passes in both arms while gaining one
other pass, dropping from 88 to 86. Thus “no additional regression versus baseline”
does not mean every repair preserves all originally working behavior. The next policy
experiment should address both false rejections and accepted behavioral regressions;
simply removing the name guard is not justified.

All twelve baseline/candidate raw proposals now have source-matched replay evidence,
reusing identical applications where possible. The supplemental-source audit allows
only the existing launcher's `backend/package.json` start-command rewrite in the
disposable execution copy; other original source bytes match their proposals.

## Validation and evidence

- 14 focused recovery checks passed, including a real child retaining the OS lock,
  interrupted atomic writes/renames, retry caps across restarts, request mismatch
  handling and preservation of complete provider responses.
- Required legacy suite: 226 tests, 214 passed, 12 skipped. Skips are not passes.
- Live chain: same saved draft and request, real gateway response, exact cached-response
  reuse, six-pair source/suite/context/case audit, and real browser replay.
- Reinvoking `resume` after the terminal outcome returned `new_model_calls: 0`.
- No experiment worker or owned temporary SSH tunnel remained after completion.

[The evidence receipt](../evidence/2026-09-21-repair-experiment-recovery.json) contains
case counts, hashes, proposal checks, request provenance, the retry journal and the
matched bill. Private prompts, generated source, raw model reasoning and credentials
are not included in that receipt.

The full goal-phase ledger has **CNY 8.916223 in matched known charges** and **seven
model attempts without usage**. Five earlier pre-goal failures also have unknown usage.
These historical unknowns are separate from the settled CNY 0.490713 for this recovery.
The local evaluation uses four Chromium workers and ten-second limits; it does not
reproduce hosted CPU quotas. Three drafts per task establish this planned comparison,
not broad generalization.
