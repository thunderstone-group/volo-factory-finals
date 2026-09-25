# Sheet gap diagnosis: why submissions 9 and 10 stop at 79 and 78

2026-09-25 evening (subagent diagnosis, saved by the main session). Task: `hackathon--sheet` (100 scenarios = 100 hidden
tests). Practice-key spend CNY 5.00. **O** = observed (ran it); **I** = inference.

## 1. Bottom line

- **O:** The draft of submission 9 labelled the worksheet-name field correctly. A repair added
  `aria-label="Workbook name"`, so the field's accessible name is no longer "Worksheet name". That blocks all 3
  REQ-2-1-3 scenarios.
- **O:** A repair also added a reset: whenever a fresh browser session loads the page, the server state goes back to
  the seed.
- **O:** Four families fail on all official drafts: context-menu Copy/Cut on a range, the menu left inside the cell,
  menu Paste without permission, and a filter hiding its header row (3 of 4).
- **O (patch test):** fixing four defects in a copy of the submission 9 app moves the suites 87→97 (main), 70→73 (v2),
  52→55 (v1), with 0 losses. Gains on written suites, not the hidden one.
- **I:** The defects found explain about 10 of the 21 hidden failures. The rest likely sit in REQ-3/REQ-5 grid
  mechanics shared by all drafts.

## 2. What was run (O)

| What | Detail |
|---|---|
| Bundles | Submission 9 run `2c8e9b1f5e5f` in `b-2c8e/`; submission 10 run `ed1ef8fb5d78` in `b-ed1e/`; submissions 7 and 8 from the existing unpacks. |
| Platform logs, sub 9 | 11 repair rounds, 5 kept, stopped after 4 discards in a row. Written suite ended 88 pass / 1 fail / 11 error. Repair CNY 1.54. |
| Platform logs, sub 10 | 22 rounds, 11 kept, stopped at the 24-call cap. Written suite ended 86 / 2 / 14. Repair CNY 4.40. |
| Log limits | The trace is cut after the draft and the first repair call, so the platform's written suites are not recoverable. |
| Written suites | v1 (09-24 prompt), v2 (strict prompt), and a fresh "main" suite with the current main prompt (100 tests, CNY 5.00). Each ran on all 4 apps. |
| Probes | 102 Playwright probes with the hidden runner's settings (1 worker, 10 s timeouts, no clipboard permission), each on a freshly started server. |
| Patch test | `s9-patched/`: submission 9 with 4 small patches, rerun under all three suites. |
| Gate prototypes | `label_override_gate.py` and `probes/fresh_session_reset.cjs`. |

## 3. Per-requirement tables

### 3a. Written suites (pass/fail/error; hidden score in the header)

| Req | n | main s7 (43) | main s8 (53) | main s9 (79) | main s10 (78) | v2 s9 | v2 s10 | v1 s9 | v1 s10 |
|---|---|---|---|---|---|---|---|---|---|
| 1-1-1 | 2 | 2/0/0 | 2/0/0 | 2/0/0 | 2/0/0 | 2/0/0 | 2/0/0 | 2/0/0 | 2/0/0 |
| 1-2-1 | 1 | 1/0/0 | 1/0/0 | 1/0/0 | 1/0/0 | 1/0/0 | 1/0/0 | 1/0/0 | 1/0/0 |
| 1-2-2 | 2 | 2/0/0 | 2/0/0 | 2/0/0 | 2/0/0 | 2/0/0 | 2/0/0 | 2/0/0 | 2/0/0 |
| 1-3-1 | 4 | 4/0/0 | 4/0/0 | **3/1/0** | 4/0/0 | 4/0/0 | 4/0/0 | 4/0/0 | 4/0/0 |
| 1-3-2 | 4 | 4/0/0 | 2/0/2 | 4/0/0 | 4/0/0 | 4/0/0 | 4/0/0 | 4/0/0 | 4/0/0 |
| 2-1-1 | 2 | 2/0/0 | 2/0/0 | 2/0/0 | 2/0/0 | 2/0/0 | 2/0/0 | 0/0/2 | 0/1/1 |
| 2-1-2 | 5 | 5/0/0 | 5/0/0 | 5/0/0 | 5/0/0 | 5/0/0 | 5/0/0 | 2/3/0 | 1/4/0 |
| 2-1-3 | 3 | 3/0/0 | 3/0/0 | **0/3/0** | 3/0/0 | **0/0/3** | 3/0/0 | **0/0/3** | 2/0/1 |
| 2-1-4 | 4 | 2/1/1 | 2/1/1 | 4/0/0 | 3/1/0 | 4/0/0 | 4/0/0 | 4/0/0 | 1/3/0 |
| 2-2-1 | 5 | 5/0/0 | 5/0/0 | 5/0/0 | 5/0/0 | 4/1/0 | 4/1/0 | 0/0/5 | 0/0/5 |
| 2-2-2 | 5 | 5/0/0 | 0/0/5 | 5/0/0 | 5/0/0 | 4/1/0 | 4/1/0 | 0/5/0 | 0/0/5 |
| 3-1-1 | 4 | 3/1/0 | 2/2/0 | 3/1/0 | 3/1/0 | 3/1/0 | 0/1/3 | 0/0/4 | 0/0/4 |
| 3-1-2 | 5 | 0/0/5 | 5/0/0 | 5/0/0 | 5/0/0 | 4/0/0 | 3/1/0 | 0/0/5 | 0/0/5 |
| 3-1-3 | 2 | 2/0/0 | 2/0/0 | 2/0/0 | 2/0/0 | 2/0/0 | 2/0/0 | 2/0/0 | 2/0/0 |
| 3-2-1 | 4 | **0/4/0** | **0/4/0** | **0/4/0** | **0/4/0** | 4/0/0 | 2/0/2 | 2/2/0 | 2/2/0 |
| 3-2-2 | 7 | 2/5/0 | 7/0/0 | 7/0/0 | 7/0/0 | 0/0/7 | 2/5/0 | 0/0/7 | 0/0/7 |
| 4-1-1 | 5 | 5/0/0 | 2/1/2 | 5/0/0 | 5/0/0 | 3/1/1 | 3/1/1 | 3/2/0 | 0/0/5 |
| 4-1-2 | 2 | 0/0/2 | 1/0/1 | 2/0/0 | 2/0/0 | 1/0/1 | 1/0/1 | 0/2/0 | 0/0/2 |
| 4-2-1 | 3 | 2/1/0 | 3/0/0 | 3/0/0 | 3/0/0 | 0/0/3 | 0/0/3 | 3/0/0 | 3/0/0 |
| 4-2-2 | 5 | 5/0/0 | 2/0/3 | 4/1/0 | 3/0/2 | 0/0/5 | 0/0/5 | 5/0/0 | 5/0/0 |
| 5-1-1 | 6 | 6/0/0 | 0/0/6 | 6/0/0 | 6/0/0 | 4/0/2 | 0/0/6 | 5/1/0 | 0/0/6 |
| 5-1-2 | 5 | 2/1/2 | 0/0/5 | **2/3/0** | 0/0/5 | **4/1/0** | 0/1/4 | **4/1/0** | 0/0/5 |
| 5-2-1 | 6 | 5/1/0 | 0/6/0 | 6/0/0 | 3/3/0 | 3/3/0 | 0/1/5 | 6/0/0 | 1/4/1 |
| 5-3-1 | 9 | 0/0/9 | 0/0/9 | 9/0/0 | 7/0/2 | 9/0/0 | 1/4/4 | 3/0/6 | 0/0/9 |
| **pass** | 100 | **67** | **52** | **87** | **82** | 70 | 49 | 52 | 30 |

v2 and v1 on submissions 7 and 8: v2 45 and 30, v1 30 and 22. The main suite ranks the apps closest to the hidden
scores; it only swaps s7 and s8. v1 and v2 underrate s10 because they assert seed values that s10 stores differently.

### 3b. Submission 9: defect and expected hidden loss (I)

| Req | Defect (O) | Expected losses |
|---|---|---|
| 1-1-1 | New browser session resets the server to the seed (added by a repair) | 0–1 |
| 1-2-2 | Editor title is a `<span>`, not a heading | 0–1 |
| 1-3-1 | CSV parser merges rows at CRLF (submission 9 only) | 1–2 |
| 1-3-2 | Invented seed rows 6–7 appear in the export; CRLF line ends (all 4 drafts) | 0–1 |
| 2-1-1 | Invented Sheet3 in the seed, so "Add worksheet" makes Sheet4 | 1 |
| 2-1-3 | "Worksheet name" field renamed by `aria-label` | **3** |
| 2-1-4 | "Last worksheet" path needs an extra delete because of the invented Sheet3 | 0–1 |
| 2-2-x | Header menus open on right-click only (the reference image shows right-click) | 0 (10 if the tests left-click) |
| 3-1-1 | No Enter/Tab/arrow navigation (all 4 drafts) | 0–1 |
| 3-1-2 | Menu Paste needs clipboard permission; a trailing newline blanks the next row (all 4) | 0–1 |
| 3-2-1 | Right-click inside the range collapses the selection; the menu stays inside the cell after Cut | **1–4** |
| 5-1-1 | Blank values sort first; formulas in moved rows keep their old references | 1–2 |
| 5-1-2 | Filter hides the header row with its "Filter …" buttons; one selected cell gives a one-cell filter range; checkboxes start unchecked | **2–3** |
| 5-2-1 | Reopened rule shows Rule type "Select" | 1 |
| 5-3-1 | Invented row 6 inside the seeded `A1:C6` gives East 2400; false "Pivot field is no longer available…" alert on a new pivot | 0–1 |

## 4. Likely hidden failures of submission 9

| # | Scenario | Mechanism | Evidence | Conf. |
|---|---|---|---|---|
| 1–3 | 2-1-3 S1–S3 | Field label overridden by `aria-label` | All 3 suites fail on s9 only; the draft in the trace was clean; the patch passes 3/3 | 0.9 each |
| 4 | 5-1-2 S1 | Header row hidden after the first filter | v1, v2 and main all fail at "Filter Sales"; passes after the patch | 0.75 |
| 5 | 5-1-2 S2 | Same mechanism | main #2 and #4 fail, pass after the patch | 0.5 |
| 6–9 | 3-2-1 S1–S4 | Menu Copy/Cut on a dragged range acts on one cell; menu left inside the cell | main fails 4/4 on all drafts; patch fixes 3/4 | 0.45 each |
| 10 | 1-3-1 (one) | CRLF rows merged | main's own CSV used `\r\n` | 0.5 |
| 11 | 5-2-1 (reopen) | Rule type prefill shows "Select" | probe p07 | 0.5 |
| 12 | 2-1-1 (one) | Sheet4 instead of Sheet3 | probe p02; v1 expected Sheet3 | 0.5 |
| 13 | 5-1-1 (one) | Sort doesn't re-anchor formulas | probe p09 (s10 passes it) | 0.45 |
| 14 | 5-1-2 (one of S3–S5) | One-cell filter range or unchecked boxes | probes p03, p06 | 0.3 |
| 15 | 5-1-1 (one) | Blank values sort first | probes p06, p07 | 0.3 |
| 16 | 1-3-2 (one) | Invented rows and CRLF in the export | probe | 0.3 |
| 17 | 1-2-2 (one) | Title not a heading | probe p01 | 0.3 |
| 18 | 5-3-1 (one) | Invented row 6 or the false alert | v1 pivot helper: expected 1200, got 2400 | 0.3 |
| 19 | 3-1-2 (one) | Menu Paste without permission | probe p04 | 0.25 |
| 20 | 1-1-1 S1 | New session wipes shared state | reset check (s9 only) | 0.25 |
| 21 | 2-1-4 S4 | Invented third sheet | seed | 0.2 |
| 22 | 3-1-1 (one) | No keyboard navigation | probe p01 | 0.15 |
| 23–24 | 2-2-x | Menus on right-click only | probe p05 | 0.1 |

These slots add up to about 10 expected failures (I). Submission 10 scores 78 although `keyboard.type` into a cell keeps
only the first character (its formula bar, `fill` and paste work), so hidden tests most likely enter values through the
labelled formula bar. The five seed descriptions of "Q3 Sales" contradict each other (A1 is `Region`, `Item` or `2`),
yet top teams reach 99, so hidden REQ-3/REQ-4 tests most likely enter their own values.

## 5. Written-suite errors

The platform's per-test error lists are unrecoverable. Local samples:

| Run | helper-blocked | wrapped quote | numbered name | file doesn't parse | total |
|---|---|---|---|---|---|
| main s9 / s10 / s7 / s8 | 0 / 9 / 18 / 33 | 0 / 0 / 1 / 1 | 0 | 0 | 0 / 9 / 19 / 34 |
| v2 s9 / s10 | 22 / 34 | 0 | 0 | 0 | 22 / 34 |
| v1 s9 / s10 | 26 / 49 | 0 / 2 | 2 / 1 | 4 / 4 | 32 / 56 |

- Real app defects hidden as errors: REQ-2-1-3 ×3 (label override, one shared-helper failure); v1 REQ-5-3-1 ×6
  (invented seed row).
- The test's own seed assumptions (17 of v2's 22 and 17 of v1's 32 errors): the test expects `A1` to be `Item`, `2` or
  `East`. These push repairs toward seed hacks (submission 10 storing `v:'Item'` with `display:'Region'`; submission 9's
  session reset).
- Wrongly ruled "a name the requirements never give": 5 quoted Sheet phrases broken across YAML lines ("Worksheet name
  already exists", "Please delete or rebuild dependent pivot tables first", "Workbook name cannot be empty", "Please
  enter a number between <minimum> and <maximum>", "<target worksheet name>"); `_phrases()` and the `name in text` check
  read the raw YAML (Sheet 5 of 131 phrases, GitHub 0 of 57). Numbered names: `Sheet3` is ruled ungrounded, which hid
  the Sheet4 defect.

## 6. Mechanism families (submission 9)

| Family | Slots | Expected losses | Also on other drafts |
|---|---|---|---|
| A. Repair-introduced overfitting to the written suite (label alias, session reset) | 4 | ≈3.0 | s9 only |
| B. Grid menu and selection mechanics | 8 | ≈2.9 | 4 of 4 |
| C. Filter hides its own controls | 2 | ≈1.25 | 3 of 4 |
| D. Invented seed content from conflicting seed descriptions | 4 | ≈1.3 | all drafts |
| E. Data edge cases (CRLF, sort re-anchoring, blanks, validation prefill) | 4 | ≈1.75 | mixed |
| F. Title not a heading | 1 | ≈0.3 | s9 only |
| Unattributed | — | ≈10–11 | — |

## 7. Ranked generic fix candidates

1. **Scaffold menus and selection (B).** `ARC.openPopover` renders into its own root at the anchor, not inside the
   cell, and closes after any menuitem action; `pasteFromClipboard()` falls back to the app's own last copy when
   `readText` is missing or rejected; card 8a: a right-click inside the current multi-item selection keeps the whole
   selection. Expected REQ-3-2-1 +2..+4, REQ-3-1-2 +0..+1. ~40 lines + 2 scaffold browser tests; risk low-medium.
   Verify: probes p04/p07 pass as scaffold tests; Lite replays hold (Keep 32/32, BookStack 34/34); one local Sheet
   draft passes REQ-3-2-1 4/4 in the main suite.
2. **Repair judge charges accessible-name overrides and session-state resets (A).** `control_names()` stops counting a
   `<label for=X>` text when X carries a different `aria-label`/`aria-labelledby`; a static gate "an aria-label
   overrides the field's visible label" costs as many lost tests as scenarios quoting that label; a smoke check "a page
   load in a fresh session must not change shared state". Expected +3 here (0.9) and +0..+1 on REQ-1-1-1. ~60 lines;
   risk low (prototypes flag only submission 9 among 8 saved bundles).
3. **Merge conflicting seed descriptions (D).** `seed_checklist()` groups lines by the backticked record name; for a
   record with conflicting contents, seed it once with what the lines agree on and add no sheets/rows for the other
   versions; mirror in the testgen prompt (enter needed values through the UI; never assert a contradicted seed).
   GitHub has the same conflict (`acme-docs` owner). Expected +1..+3 plus ~17 fewer seed-assumption errors per suite.
4. **Card §8: a filter never hides its own controls (C).** Expected +1..+2; tiny; low risk.
5. **Written-suite signal.** Collapse whitespace in the requirement text before grounding checks; accept numbered
   variants of quoted/seeded names (`Sheet3`); print one line at repair end with final written-test ids by status.
   Indirect +0..+2; tiny.

Not ranked: scaffold CSV helper (1 of 4 parsers broken); keyboard grid navigation; sort blanks-last and re-anchoring
(too spreadsheet-specific); left-click header menus.

Combined estimate (I): fixes 1–4 recover about +6..+11 on a draft like submission 9 (roughly 85–90); above 90 also needs
the ≈10 unattributed failures.

## 8. Limits

No per-test hidden results exist, so every slot is a probability; patch results are gains on written suites. The probes
use one test style; the hidden generator may use keyboard shortcuts instead of context menus. Submissions 9 and 10 have
many opposite specific defects yet land at 79 and 78, which supports shared gaps plus a few app-specific ones.

## 9. Artifacts (this directory)

`proxy-table.md`, `res/{main,v1,v2}-{s7,s8,s9,s10,s9p}.json`, `run_suites.log`, `run_main.log`; `suite-main/` and
`suite-main-write.log`; `probes/p01…p10*.spec.cjs`, `probes/matrix-table.md`, `probes/pw.config.cjs`,
`probes/runfresh.sh`; `s9-patched/`, `label_override_gate.py`, `probes/fresh_session_reset.cjs`; `b-2c8e/`, `b-ed1e/`,
`logs/`.
