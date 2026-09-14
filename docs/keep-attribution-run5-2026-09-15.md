Generation head `b3d2331`, 142 model calls, scored 25 of 32 under the hosted profile and 25 of 32 under the repo profile.

# Keep run 5, head `b3d2331`: every official failure by the locator it waits on

Same method as `attrib/report.md` and `docs/state-contract-2026-09-14.md` section 1.8. Pending
locators come from Playwright's call log in the JSON reports and from the `error-context.md`
accessibility snapshot each failing run writes. The "page has" column comes from driving the
running application directly. No model call, no gateway, no `arcbench`.

Application: `/private/tmp/claude-501/-Users-e0-7-projects/b98aaf0e-55e6-4470-8d5d-fac874f593fb/scratchpad/keep-full-5/app`

Evidence:

* `attrib/iso5/<REQ>/` — one `state_rehearsal.py` run per spec on a fresh store, 1 worker, with
  each run's `artifacts/*/error-context.md`.
* `attrib/iso5/p_<A><B>/` — ordered pairs on one shared store, and `attrib/iso5/solo42_1..6/` —
  REQ-4.2 alone, six times.
* `attrib/p5a.mjs`, `p5b.mjs`, `p5c.mjs`, `p5d.mjs`, `p5e.mjs` — direct Playwright probes.

Scores reproduce the brief: hosted 25 of 32, repo 25 of 32, same seven failures.

## 0. What the run changed, and what that bought

Run 5 adopted the **other** permitted shape: row actions are `display:none` and revealed on
`:hover` / `:focus-within` (`frontend/public/features/coloring.js:21-22`), with row-scoped names
(`"Color for <title>"`, `"Archive for <title>"`, `"Pin for <title>"` / `"Unpin for <title>"`).
All four new interface rules are present in `app/checks/interface.spec.cjs`: verb collapse, the
one-click and hover walk, chooser inertness, and form durability.

Measured on the entry page (`attrib/p5a.mjs`):

| Quantity | Run 4 | Run 5 |
|---|---:|---:|
| Visible action controls | 85 | **13** |
| Hidden-but-present controls | 0 | **76** |
| Visible verb buckets holding more than one control | 4 (`more`, `archive`, `pin`, `color`, 19 each) | **0** |
| Exact duplicate visible names | 0 | 0 |

The verb-collapse rule is satisfied legitimately, not by accident: with the row actions hidden,
`getByRole` excludes them from the accessibility tree, so `/archive/i` matches one button while a
row is hovered and none otherwise. **Every group-a failure of run 4 is gone.** REQ-2.3.3, 2.5.3,
2.6.1, 2.7.1, 2.7.2, 2.8.1 and 2.8.3 no longer fail for a naming reason; the three that still fail
do so because their feature was rolled back.

## 1. Every failing spec

`h.ts` is `arc-bench/webapp/keep/tests/helpers.ts`.

| Spec | Fails at | Locator pending | What the page actually offers at that moment | Cause |
|---|---|---|---|---|
| REQ-2.7.4 Assign default label when creating note | `REQ-2.7.4.spec.ts:12` via `h.ts:313` → `h.ts:124` | `getByLabel(/Reminders/i).first()`, resolved to `<button role="menuitem" aria-label="Reminders">`, **not visible** | With the composer expanded the visible buttons are `Menu, Gear, List view, Grid view, Note color, Close, Pin, Reminders` — **0 match `/more/i` or `/options/i`**. Step `:10` therefore resolves `[/more/i, /options/i, /menu/i]` to the banner **`"Menu"`** button, and step `:11` resolves `[/change labels/i, /labels/i]` to the sidebar **`"Edit Labels"`** nav item, which opens the modal `dialog "Edit labels"`. That dialog holds **0 checkboxes** (rows are plain text: `Work`, `Reminders` + `Default`, `Work editable`). `setLabel('Reminders')` then finds **count 0 on every role rung** — the dialog is correctly `aria-modal` and the sidebar is inert — and only `getByLabel` matches, returning the hidden sidebar button. The composer's own visible `"Reminders"` toggle, which is the control the requirement means, is never reached | b |
| REQ-2.7.5 Edit labels | `REQ-2.7.5.spec.ts:13` via `h.ts:149` | `getByRole('button',{name:/Projects/i}).first()` | In the modal `dialog "Edit labels"`, `getByLabel(/Work editable/i)` → **count 2, first is `<button aria-label="Rename Work editable">`, not visible**; `getByPlaceholder` and `getByRole('textbox',{name})` → **0**; `/label name/i` → **0** (the create box is named `"Create new label"`). `fillField` falls through to the bare `getByRole('textbox').first()`, which is the **banner `"Search"` box, outside the dialog and visible**. The failure snapshot records it: `textbox "Search": Projects`. `Done` closes the dialog and no control named Projects exists | b |
| REQ-2.8.2 Unpin note | `REQ-2.8.2.spec.ts:10` via `h.ts:282` → `h.ts:144` | `getByRole('button',{name:/Meeting\s+agenda\s+2\.8\.2/i}).first()`, resolved to `<button class="icon-btn row-action col-btn" aria-label="Color for Meeting agenda 2.8.2">`, **not visible** | `pinNote` succeeds: hovering the title text reveals exactly one `/pin/i` button, `"Pin for Meeting agenda 2.8.2"`, and the card moves into PINNED. The mouse is still over the old card when `unarchiveNote`'s `hoverNamed` evaluates rung 1, so `getByRole('button',{name:/Meeting agenda 2.8.2/i})` has **count 3** and `.first()` is the hover-only colour button. The pin re-render then moves the card, the row actions return to `display:none`, and that element is never visible again — hovering it would be what makes it visible. Measured: while hovered, rung 1 count 3 visible; after the click and re-render, rung 1 count 0 and only `getByText` (count 1, a `div.note-title`) is visible | e |
| REQ-4.2 Detailed settings | `REQ-4.2.spec.ts:10` via `h.ts:139` → `h.ts:124` | `getByRole('button',{name:/^settings$/i}).first()` | At the failure the page has **no dialog** and the sidebar is missing **`"Notes"` and `"Settings"`**, and the banner has lost the `"List view"`/`"Grid view"` group — exactly the controls `hideOutsideDialog` marks `data-settings-hidden` (`features/settings.js:63-75`, matched bidirectionally against `['Settings','Cancel','Save','Notes and Lists','Sharing']`; `styles.css:4` makes that `display:none !important`). So nothing named exactly `Settings` remains and `clickNamed` blocks. The hide is applied **after** an async `fetch('/api/settings')` (`settings.js:87`) while both restores are synchronous (`settings.js:79`, `settings.js:85-86`), so an open that is superseded before its fetch resolves leaves the page hidden with no dialog. Order-dependent, not worker-dependent (§3) | c |
| REQ-2.3.3 Trash list | `REQ-2.3.3.spec.ts:11` via `h.ts:205` | `getByText(/Delete me 2\.3\.3/i).first()` | Hovering a card reveals `Color for…`, `Archive for…`, `Pin for…` and a bare `More options`, but clicking `More options` yields **0 controls matching `/delete note/i`**, and the `Trash` nav item renders the ordinary unfiltered `PINNED`/`OTHERS` list. **Not attributable: batch 7 hit the call cap and was rolled back** | rolled back |
| REQ-2.5.3 Show archived notes | `REQ-2.5.3.spec.ts:11` via `h.ts:205` | `getByText(/Travel plans 2\.5\.3/i).first()` | The `Archived` nav item renders the same unfiltered `PINNED`/`OTHERS` list; there is no archived view. **Not attributable: batch 7 rolled back** | rolled back |
| REQ-2.5.4 Unarchive | `REQ-2.5.4.spec.ts:11` via `h.ts:144` | `getByRole('button',{name:/Travel\s+plans\s+2\.5\.4/i}).first()` | As above, plus no unarchive control anywhere. **Not attributable: batch 11 rolled back** | rolled back |

## 2. Cause groups

Over the **four** specs that were implemented and self-checked and then failed officially:

| Group | Count | Specs |
|---|---:|---|
| **a** — wrong control picked because a generic pattern matches every row | **0** | — |
| **b** — the control exists but is unnamed, or named differently from what the helper searches for | **2** | 2.7.4, 2.7.5 |
| **c** — behaviour missing or wrong | **1** | 4.2 |
| **d** — four-worker shared-store interference | **0** | — |
| **e** — other, named: **hover-reveal circularity** — a row-title lookup resolves to a hover-only control, and the row's own re-render hides it before it can be hovered | **1** | 2.8.2 |

Three further failures are not attributable: REQ-2.3.3, REQ-2.5.3 (batch 7) and REQ-2.5.4
(batch 11) belong to the two batches that hit the 20-call cap and were rolled back, and their
features are measurably absent.

### 2.1 Why REQ-2.5.2 and REQ-2.7.6.2 pass although their batch was rolled back

Both assert on behaviour an **earlier** batch already delivered; the rolled-back batch's own
contribution is not what they check.

* **REQ-2.5.2 Archive Undo** is covered by **REQ-2.5.1** (batch 3, `features/coloring.js`). Driven
  directly: hovering `Travel plans 2.5.2` reveals exactly one `/archive/i` button,
  `"Archive for Travel plans 2.5.2"`; clicking it shows `Note archived` with one `Undo` button;
  clicking `Undo` puts the note back in the list. The spec never opens the Archived screen, which
  is the part batch 7 lost.
* **REQ-2.7.6.2 View all notes** is covered by **REQ-2.7.6.1** (batch 10, label filtering) plus
  the `Notes` nav item from the home feature. Driven directly: clicking the `Work` label leaves
  `Design review` visible and `Movie list` at 0; clicking `Notes` brings both back to 1, which is
  exactly the assertion. Batch 11 had nothing left to add.

## 3. REQ-4.2 is order-dependent at one worker, so it is not worker interference

| Run | Order | Result |
|---|---|---|
| REQ-4.2 alone, six times | — | **6 of 6 pass** |
| `REQ-4.1` then `REQ-4.2` | 4.1 first | both pass |
| `REQ-4.2` then `REQ-5.1` | 4.2 first | both pass |
| `REQ-3.2` then `REQ-4.2` | 3.2 first | **4.2 fails** |
| `REQ-2.6.1` then `REQ-4.2` | 2.6.1 first | **4.2 fails** |

The shared store is not the carrier: diffing the stores of the failing pairs against the isolated
run shows only a regenerated `settings` row id, plus the colour REQ-2.6.1 legitimately writes
(`Garden tasks existing` `color: default → green`). Every note, label and settings value is
otherwise identical. What differs is timing, and `settings.js` is not re-entrant across it: on the
happy path `/settings/i` resolves to the sidebar `menuitem "Settings"`, which opens the dialog
directly, and `/^settings$/i` then matches the dialog's `heading "Settings"` (measured at four
different inter-click gaps: counts button 0, menuitem 0, heading 1, with `save`, `cancel` and two
`/bottom/i` texts all present, so the spec passes). On the failing path the hide has been applied
and the dialog has not survived, and the run never recovers.

I did not isolate the precise interleaving that produces the superseded open; the mechanism above
is read from the code and confirmed by the failure snapshot, not by a reproduction of the exact
race. Recorded as **not fully measured**.

## 4. Did the new interface rules fire, and should they have?

| Rule | REQ-2.7.4 | REQ-2.7.5 | REQ-2.8.2 | REQ-4.2 |
|---|---|---|---|---|
| **Verb collapse** (`auditNames`) | no, correctly — 0 ambiguous verb buckets in any state | no, correctly | no, correctly | no, correctly |
| **One-click / hover walk** | reached the state; found nothing to report | reached the state; found nothing to report | the hover walk hovers `getByText(title)` and audits names only, so the circularity is invisible to it | the walk clicks each verb once from a fresh reload, so it never issues the second `Settings` click |
| **Chooser inertness** (`auditInertness`) | no, correctly — the dialog is `aria-modal` and the sidebar is genuinely inert | **should have fired and was exempted** | n/a | n/a |
| **Form durability** (`probeForm`) | n/a | n/a | n/a | n/a |

Two gaps, both general:

**G1 — the `aria-modal` exemption is wrong for Playwright.** `auditInertness` skips any chooser
with `role="dialog"` and `aria-modal="true"`. Playwright's `getByRole` honours `aria-hidden` and
`inert`; it does **not** honour `aria-modal`. Measured with the Edit labels dialog open:
`getByRole('textbox')` returns **2**, the in-dialog `"Create new label"` and the banner
`"Search"`, and `fillField`'s bare fallback takes `.first()`, which is Search. The exemption
removed the check from exactly the state where the leak happened.

**G2 — the leak test only compares names, and the helper's last resort has no name.** Even
without G1 the rule would not have caught this: it looks for an outside control whose name shares
a substring with an inside one, and `"Search"` shares nothing with `"Create new label"`,
`"Create"` or `"Done"`. `fillField` (`h.ts:176-180`) ends at `getByRole('textbox')` with no name
at all, so any visible text input outside an open chooser is a candidate.

## 5. Harness-level rules that would have prevented each

**RA — while a chooser is open, no control outside it may be reachable by role, and no text input
outside it may be visible. Recovers REQ-2.7.5.** Two edits to `auditInertness`: drop the
`aria-modal` exemption, because the evaluator's resolver does not honour it, and add a nameless
clause — if a chooser is open and any `textbox`/`searchbox` outside it is visible, fail, since
`fillField`'s last resort is the first textbox on the page regardless of name. The repair the
application needs is `inert` or `aria-hidden="true"` on the siblings, which it already knows how
to do (`settings.js:63-75` hand-rolls it for the settings dialog).

**RB — a row's own title must resolve to a control that is visible without hovering. Recovers
REQ-2.8.2.** The hover walk already hovers each seeded title; extend it to assert that, from an
unhovered page, `getByRole(<action role>, {name: <title>})` has **count 0** — the title must be
carried by static text, not by a hover-only button. Today the row-scoped name and the hover-reveal
shape are each individually accepted and together they are circular: the only control answering to
the title is one that must already be visible to be hovered. Requirement-general, and it is the
exact trap the run-4 fix walked into.

**RC — every action the requirement attaches to a row or to the composer must be reachable from
that row or composer by the verb the evaluator uses. Recovers REQ-2.7.4.** The composer offers no
`more`, `options` or `menu` control, so the ladder leaves the composer and lands on the banner.
Extend the one-click walk: for each seeded row and for the composer, open it and assert that the
generic verbs the helpers use (`more`, `options`, `menu`, `labels`, `color`, `pin`, `archive`,
`delete`) each resolve **inside** that container, or not at all. A verb that resolves to a control
outside the container the test is working in is the defect, and it is detectable without knowing
what Keep is.

**RD — a control that hides other controls must restore them synchronously, and a state walk must
assert the page recovers. Recovers REQ-4.2.** Any application that hand-rolls inertness by hiding
rival names owns a hide/restore pair, and `settings.js` applies the hide after an async fetch while
restoring synchronously. General check: after each click in the one-click walk and a reload, assert
the entry page's visible control set is restored to the baseline captured at the start. A click
that permanently removes controls from a reloaded page is a defect whatever the application.

**RE — a batch that hits the call cap and is rolled back should be retried once with its own
findings, or reported as a scheduled gap.** Three of the seven failures are batches 7 and 11,
which ran, failed to converge in 20 calls, and left nothing. That is now the largest single group,
as unreached batches were in run 4. Two of the five requirements in those batches
(REQ-2.5.2, REQ-2.7.6.2) pass anyway on earlier features, so the real loss is three specs.

## 6. Not measured

* The exact interleaving that leaves `data-settings-hidden` applied with no settings dialog. The
  mechanism is read from `settings.js:79-87` and confirmed by the failure snapshot; the race
  itself was not reproduced on demand.
* Whether RA through RE, applied, change a generation's outcome. No generation was run.
