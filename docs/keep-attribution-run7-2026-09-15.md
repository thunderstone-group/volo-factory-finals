# Keep run 7, head `03152c0`: the model could not see its failures

Attribution by an Opus agent from `runs/2026-09-15-keep-full-7/` (git-ignored), checked by the
main session against `volo/context.py`. 186 calls, CNY 12.03 (budget stop), 129 min, hosted
22/32 = repo 22/32 = two hosted replays, identical failure set.

## 0. Summary

Money and time went to the model not seeing its failures, not to hard requirements. From batch
5 on, verification output returned to the model is cut to head 1.6 KB + tail 3.3 KB
(`excerpt(output, 5000)` in `volo/context.py:16`, head = 1/3, tail = 2/3) while the failures
sit in the middle of a 310 KB TAP log: in 26 failed verifications the model saw zero failing
test names 20 times. Batches 8–12 burned 20 calls each inside that blind spot, delivered no
requirement, and cost 47% of the run.

Second layer: the self-check suite runs 66 test instances for 23 unique tests (2.87×) and is
not idempotent; completed requirements (2.3.3, 2.5.1, 2.4, 2.3.1, 2.8.1, 2.8.3) fail falsely in
almost every verification although all pass officially. Those false failures poison the model's
diagnosis and make the salvage criterion (old bundle must pass before keeping a capped batch)
always `bundle_failed`, so batches 8–12's product code was discarded, including batch 11's
already-fixed 2.7.6.2.

Of the ten official failures eight are "batch not delivered"; the two real defects share one
cause: row actions named bare `Archive` under this run's rule collide with the sidebar
`Archived` under the official helper's `/^archived?$/i`.

## 1. Batches 8–12

Counts come from `.factory/command-NNNN.log`, not from the truncated `verification.output`.

| Batch | Reqs | Real failures at first verification | Of this batch | Seen by model | What the model did | Failures changed? | End |
|---|---|---|---:|---:|---|---|---|
| 8 | 2.7.2, 2.7.4 | 5: 2.7.2, 2.7.4, 2.3.1, 2.5.1, 2.3.3 | 2 | **0** | wrote `note-label-editor.js`, edited `index.html`; 5 of 7 `run` calls re-read logs | yes: its own check then hit a 404 endpoint (`"Not found" is not valid JSON`) | cap 20; salvage failed on 2.3.3 (pollution); rolled back |
| 9 | 2.7.5 | 4: 2.7.5 ×2, 2.4, 2.3.3 | 2 | **0** | wrote `edit-labels.js`, `card-labels.js`, rewrote `batch-8.spec.cjs`; 6 `run` calls all re-read logs | yes: later the interface rule (verb resolves outside container), a real new defect | cap 21; rolled back |
| 10 | 2.7.6.1, 2.7.6.3, 2.8.2 | **34**, 28 of them `locator.hover: Timeout` | 1 | **1** (`not ok 7 REQ-2.4`) | wrote `view-by-label.js`, `label-view.js`, `batch-10/11.spec.cjs`, edited `index.html` | **no**: five verifications, same visible failure, 71 s each | cap 20; rolled back |
| 11 | 2.5.4, 2.7.6.2 | 5: 2.5.4, 2.5.1, 2.8.1, 2.8.3, 2.3.3 | 1 | **0** | edited `note-listing.js`, wrote `view-all-notes.js`; **all 17 `run` calls grep command logs** | partly fixed: 2.7.6.2 passes at the end, 2.5.4 not | cap 21; salvage failed only on 2.5.1 ×2 and 2.3.3, none of this batch; code discarded |
| 12 | 3.1, 4.1 | 8: 3.1, interface rule, 2.3.1, 2.5.1 ×2, 2.8.1, 2.3.3 | 1 | **0** | wrote `search-settings.js`, `batch-12.spec.cjs`, patched | 3.1 never passed | call 20 hit the CNY 12 budget |

Of the 19 failed verifications in batches 8–12, 14 showed the model zero failures and 5 showed one.

## 2. The hover regression in batch 10

Introduced at t=4903 by two `edit`s on `frontend/public/features/note-editor.js` before the first
verification: a new rule `.note .label-btn{right:148px}` and a per-card
`<button class="action-btn label-btn" aria-label="Change labels">`. `.note .action-btn` is
`position:absolute; display:none`, shown by `.note:hover`. The existing buttons at `right:44px`
and `right:80px` sit in blank space right of the title; the new one at `right:148px` lands on
`.note-title`. Every earlier batch's check opens with `getByText(title).hover()`: the hover
reveals the button, the button covers the point under the cursor, Playwright reports
`<button … class="action-btn label-btn"> intercepts pointer events`. Self-referential: the
control revealed by the hover blocks the element that revealed it. `command-0113.log`: 28 hover
timeouts and 3 click timeouts, all this.

The model never saw that text: each of the five 310 KB outputs was cut to 1642 + 3285 chars,
the visible failure was always `not ok 7 - REQ-2.4`, and 1.2 KB of the tail was header HTML
printed by `tmp-debug.spec.cjs`.

Rollback was correct: `restored_product_snapshot` returned to fingerprint `ea99c35e` (batch 7),
new files removed, both edits reverted (`grep -c label-btn note-editor.js` = 0 in the delivered
snapshot; batch 11's first verification has zero `label-btn` interceptions and takes 32 s
again). Residual: rollback ignores `checks/`; the model recreated the quarantined
`batch-8.spec.cjs` in batch 10 and it was quarantined again in 9, 10 and 11 (four copies under
`.factory/unverified/`).

## 3. The read-only loops: the model was fetching its own logs

Harness-issued: `checks/browser.cjs`, `checks/vocabulary.cjs`, `checks/interface.spec.cjs`.
Model-written: `checks/reset.cjs`, `checks/requirements.cjs`, `all.spec.cjs`,
`run-all.spec.cjs`, `tmp-debug.spec.cjs`, every `batch-N.spec.cjs`.

| Metric | Value |
|---|---:|
| Read-only tool calls | 134 / 195 |
| File reads landing in `checks/` | 142 / 161 |
| Reads of `checks/browser.cjs` | 27 |
| `run` calls that re-read `.factory/command-*.log` | 40 / 51 |
| `diagnosis_stall_sources` fired | 36 |
| Stall repairs with no source snapshot | 26 / 30 |

Two mechanisms. First, TAP points every browser failure at the harness wrapper:
`browser.cjs:4` is the `nodeTest.test(name, …)` call site, so each failure carries
`location: '.../checks/browser.cjs:4:12'`; reading that file is a reasonable inference with no
answer in it (27 reads). Second, the model noticed the truncation and rescued itself: `grep -n
"not ok" .factory/command-0135.log`, `sed -n '120,175p'` — 17 of 17 `run` calls in batch 11,
21% of all tool calls in the run.

The harness's reaction was to detect "two consecutive read-only calls" and take over: 26 of 30
`diagnosis_stall_repair` ended `bounded_repair_unavailable`, because `source_snapshot`
(`agent.py:1263`) returns `None` above 20 candidate files or `STALL_SOURCE_LIMIT = 48000`
bytes. By batch 8 the candidates were 21 files ≈ 75 KB, 34.5 KB (46%) of them model-written
`checks/*.cjs`. Last success at t=2145 (batch 4); after that only a text hint "do not read
anything else", to no effect.

## 4. Cost of the self-check suite

| Metric | Value |
|---|---:|
| Verifications | 46 |
| Wall time in verification | 18.2 min (14% of 129) |
| Healthy single run | ≈ 12 s |
| Batch 10 single run | 71 s, 6.0 min total |
| Test instances per run | 66 |
| Unique tests | 23 (2.87× duplication) |
| Time waiting on the model | 110.3 min, 35.8 s per call |

Duplication comes from stale aggregators: `all.spec.cjs` requires up to batch-3,
`run-all.spec.cjs` up to batch-4 plus interface plus tmp-debug, both frozen at the batch that
wrote them; the harness `check_command` still passes every spec file as its own argv to
`node --test`, so batch-1/2/3 run three times, interface and tmp-debug twice. `run-all.spec.cjs`
even comments "argv parallelism races the shared store, so I require serially" — the model wrote
the guard and the harness bypassed it.

`tmp-debug.spec.cjs` was written in batch 1 (t=395) as a one-off probe (prints header HTML and
role counts, then `assert.ok(true)`); `regression_checks_recorded` kept it as a permanent
regression check. Its cost is not time (0.7 s ×2) but the 1.2 KB of HTML it prints into the
tail the model can see.

Dedup would save ≈ 12 minutes against 110 of model wait; the real cost is non-idempotence.
`reset.cjs` PATCHes one fixed list and runs once in a `before` hook, which does not stop
parallel processes mutating the same persistent store. Consequence beyond noise: batch 11's
salvage verification (`command-0155.log`) failed only 2.5.1 ×2 and 2.3.3, none of batch 11, and
the harness ruled `bundle_failed`, discarding `view-all-notes.js` and the fixed 2.7.6.2. The
delivered snapshot fails its own suite too (`command-0168.log`, 5 failures);
`delivered_verified_snapshot` only checks for an exception and `fresh_verification_error` is
the empty string.

## 5. Official failures 2.5.3 and 2.7.1: one cause

Both are `Test timeout of 10000ms exceeded`; the locator was reconstructed from
`error-context.md`, `score-hosted/data/store.json` and the worker timeline.

**REQ-2.5.3 Show archived notes — group a.** Stops after `h.openArchive(page)` at
`expectNoteVisible` waiting on `getByText(/Travel plans 2\.5\.3/i).first()`. `archiveNote`
hovers the title and clicks `/archive/i`: success (`status: Note archived`). The mouse stays over
the list, so another card's row actions are revealed. `openArchive` then runs
`clickFirstAvailable([[/^archived?$/i, /^archive$/i]])`, and `helpers.ts:89` ranks `button`
before `link`. The delivered app names the row action bare `Archive`, which the anchored
`/^archived?$/i` matches, so the button rung returns first and the sidebar `Archived` link (also
count 1) is never reached: the test archives a second note and the page stays on the unfiltered
list. Reproduced with a probe on the delivered app:

```
BEFORE hover: {"button":0,"link":1}
AFTER hover title, /archive/i buttons: {"button":1}
openArchive resolve: button count 1 visible true | link count 1
WOULD CLICK: <button type="button" aria-label="Archive" class="action-btn archive-btn">📥</button>
```

The model's own check (`batch-7.spec.cjs:60`) pins the role: `getByRole('link', { name:
'Archived' })`. Self-check green, official red: the check pins the role, the helper guesses it.

**REQ-2.7.1 Assign label to a note — group d, caused by 2.5.3's a.** Stops at
`hoverNamed(page, ['Team retro add label'])`, all ten rungs count 0. The note was archived 70 ms
before the test began, by 2.5.3's mis-click:

| Time | Event |
|---|---|
| 06:34:56.862 | 2.5.3 starts on worker 2 |
| 06:34:57.005 | `note-travel-plans-253` → archived (archiveNote, intended) |
| 06:34:57.063 | `note-team-retro-add-label` → archived (openArchive's mis-click) |
| 06:34:57.133 | 2.7.1 starts on worker 1; fixture gone |

`labelAddTitle` is referenced only by `REQ-2.7.1.spec.ts`.

| Group | Count | Specs |
|---|---:|---|
| a — generic pattern picks the wrong control | 1 | 2.5.3 |
| d — shared-store interference, caused by a | 1 | 2.7.1 |
| batch rolled back, not delivered | 6 | 2.5.4, 2.7.2, 2.7.4, 2.7.5, 2.7.6.2, 4.1 |
| batch never started | 2 | 4.2, 6.1 |

## 6. Against run 5

| Quantity | Run 5 `b3d2331` | Run 7 `03152c0` |
|---|---:|---:|
| Hosted | 25/32 | 22/32 |
| Batches | 15/15 | 12, 7 completed |
| Calls | 142 | 186 |
| Prompt / completion tokens | 3.66 M / 488 k | 5.19 M / 845 k |
| Cost | CNY 8.4 | CNY 12.03 |
| Capped batches | 3 | 5 |
| Verifications | 28 | 46 |

Of the extra CNY 3.6, 3.17 is output tokens. Batches 8–12: 102 calls, CNY 5.61 (47%), zero
requirements delivered; batches 1–7: 82 calls, CNY 6.37, 52.0 min model wait, 7.2 min
verification; batches 8–12: 57.9 min model wait, 11.1 min verification.

Mechanism by mechanism:

- **Hover-action rule `32740e2` backfired, hardest evidence.** It changed row actions to bare
  verbs ("the evaluator searches bare verbs; `Archive for Sprint goals` also matches"). True for
  `archiveNote`'s unanchored `/archive/i`, false for the sidebar helper's anchored
  `/^archived?$/i`. Run 5 wrote `'Archive for ' + note.title` (`coloring.js:154`), which the
  anchored pattern cannot match, so the sidebar link always won. `Trash` is unaffected because no
  row button is named Trash. Cost: 2.5.3 plus 2.7.1 by contagion.
- **Gate loop `6448d12`: cost realised, benefit not.** It replaced "one cheap 12-call retry of a
  capped batch" with "≤ 3 entries per batch, each a full 20 calls, round-robin". Every batch in
  this run has `entries = 1`: the CNY 12 budget ended the run before the first pass finished, so
  the second round never happened. Net: a stuck batch went from ≤ 32 calls to 20 then abandoned,
  and batches 13–15 never started, whereas run 5 ran them. 4.2 and 6.1 have no code at all.
- **CNY budget `c0ca9cc` is correct** (stopped at 12.03) and exposed the two above.
- Overlay primitive, rule narrowing, read caps: no adverse trace; the interface rule reported
  real findings in batches 9 and 12.

Correction to the earlier note: model wait is 110.3 min (paired request→response, 35.8 s per
call), not 93; 129 − 110.3 = 18.5 min matches the 18.2 min of verification.

## 7. Root causes, ranked, with the smallest change that tests each

1. **Failure feedback truncated to hide the failures.** `agent.py:1779` `excerpt(output, 5000)`
   keeps head 1/3 + tail 2/3; TAP spreads failures through the middle. 20 of 26 failed
   verifications showed zero failures; batch 10's five 71 s runs showed 1 of 34, and not the
   regression. 40 `run` calls re-reading logs are the direct corroboration. Smallest change:
   extract every `^not ok` line with its `error:` block into a failure digest placed before
   `check_output`; keep the raw truncation. Test: run the extractor offline on
   `command-0113.log`, expect all 34 failures present at bounded length.
2. **Self-check suite not idempotent; false failures trigger wrong rollbacks.** Six requirements
   fail locally in the second half and pass officially; batch 11's salvage failed only on those
   and the fixed 2.7.6.2 was discarded. Smallest change: salvage judges the set difference only
   (new failures = `bundle_failed`; a test failing both before and after the batch is no reason
   to drop product code). Test: replay `command-0153` / `command-0155`, expect empty difference
   and the batch kept.
3. **Bare-verb naming collides with the official sidebar pattern.** Probe reproduced the
   mis-click; `store.json` timestamps pin the contagion.
