# Grid mechanics on the official Sheet drafts (09-24 afternoon)

Local diagnosis only; nothing here goes into the package.

- `probe_sheet.cjs BASEURL` — one browser session on a Sheet-like app: new workbook, whether a grid cell receives
  `click`, the double-click editor `Edit A1`, typing into a selected cell, the formula bar, external Ctrl+V, the
  context-menu Paste, reload. `probe_events.cjs BASEURL` traces which pointer events reach the grid.
- `patch_arc.py ARC_JS` — the experimental form of the arc.js press fix, patched into an existing app's arc.js.
- `run_suite.sh TESTDIR BASEURL OUT.json [grep]` + `summ.py A.json [B.json]` — the opening-day written suite
  (`../2026-09-24-opening-day/testgen/sheet-tests`) against a live app, and a pass-set comparison. Paths point at
  the 09-24 afternoon session scratchpad.
- `written-suite-orig-vs-patched.json` — per-test status of that 48-test suite on three drafts (sub1 = submission 1
  Sheet, sub2 = submission 2 Sheet, gena = a local opening-day draft), original arc.js vs the press fix.
- `codex-testgen-review*.md` — the Codex (GPT-6) adversarial review of the written-test repair loop and its brief.

Probe results (13:10, macOS Chromium; `Control+V` is not the paste shortcut there, so external paste is only
meaningful for apps that read the clipboard themselves):

| app | click reaches a cell | double-click editor | type into cell | formula bar | Ctrl+V external | menu Paste |
|---|---|---|---|---|---|---|
| sub2 | no | no | no | yes | no | no |
| sub1 | no | no | no | yes | yes | no |
| local a | no | no | no | yes | no | no |
| local b | new workbook flow fails | | | | | |
| sub2 + press fix | yes | yes | no | yes | no | no |
| sub1 + press fix | yes | yes | no | yes | yes | no |
| local a + press fix | yes | yes | no | yes | no | no |

Event trace on sub2: a single click and a double-click on a grid cell deliver only mousedown/mouseup; the app
re-renders `#app` inside its mousedown/mouseup handlers, and Chromium drops `click` and `dblclick` for the
removed element.
