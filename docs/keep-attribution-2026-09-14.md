Generation head `b8e92a0`, scored 19 of 32 under the hosted profile and 21 of 32 under the repo profile.

# Keep, head `b8e92a0`: every official failure by the locator it waits on

Method as in `docs/state-contract-2026-09-14.md` section 1.8. Pending locators come from
Playwright's own call log in the JSON reports and from the `error-context.md` accessibility
snapshot each failing run writes. The "page has" column comes from driving the running
application directly. No model call, no gateway, no `arcbench`.

Application: `/private/tmp/claude-501/-Users-e0-7-projects/b98aaf0e-55e6-4470-8d5d-fac874f593fb/scratchpad/keep-full/app`

Evidence:

* `attrib/iso/<REQ>/` — one `state_rehearsal.py` run per spec, fresh store, 1 worker, with each
  run's `artifacts/*/error-context.md` accessibility snapshot.
* `attrib/iso/pair/` — `REQ-2.3.1` then `REQ-2.8.1` on one shared store, plus the resulting
  `data/store.json`.
* `attrib/repro/` — eight full-suite replays (five hosted, three repo counting the original).
* `attrib/probe.mjs`, `probe2.mjs`, `probe3.mjs`, `probe4.mjs`, `probe5.mjs`, `probe6.mjs` — direct
  Playwright probes against the running application.

## 0. Two corrections to the premise before the numbers

**REQ-2.5.4 was never reached.** `state_batching` plans 15 batches and `batch_started` fires 10
times (`app/.factory/events.jsonl`). REQ-2.5.4 sits in batch 11, `["REQ-2.5.4", "REQ-2.7.6.2"]`,
which never started, and it is absent from `self_checked_requirements`. It belongs with the
unreached group, not with the set to attribute. That leaves **eight** attributable specs, not nine.

**Neither REQ-2.6.1 nor REQ-2.8.1 is a deterministic four-worker failure.** Replayed against
identical bytes:

| Run | Workers | Passed | REQ-2.6.1 | REQ-2.8.1 |
|---|---:|---:|---|---|
| hosted, original | 4 | 19 of 32 | FAIL | FAIL |
| hosted replay 1 | 4 | 21 of 32 | pass | pass |
| hosted replay 2 | 4 | 20 of 32 | pass | FAIL |
| hosted replay 3 | 4 | 20 of 32 | pass | FAIL |
| hosted replay 4 | 4 | 20 of 32 | pass | FAIL |
| repo, original | 1 | 21 of 32 | pass | pass |
| repo replay 1 | 1 | 21 of 32 | pass | pass |
| repo replay 2 | 1 | 21 of 32 | pass | pass |

The other eleven failures are identical in all eight replays. Section 3 explains both flips;
neither is shared-store interference in the Bookstack sense.

## 1. Every failing spec

`h.ts` is `arc-bench/webapp/keep/tests/helpers.ts`. Counts are measured on the seeded home page
(`attrib/probe.mjs`: 19 note cards, 85 visible action controls).

| Spec | Fails at | Locator pending | What the page actually offers at that moment | Cause |
|---|---|---|---|---|
| REQ-2.3.3 Trash list | `REQ-2.3.3.spec.ts:11` via `h.ts:205` | `getByText(/Delete me 2\.3\.3/i).first()` | Trash holds **"Sprint goals"** (`button "Restore Sprint goals"`). `deleteNote` (`h.ts:258`) clicks `/more/i`.first(); **19 buttons match `/more/i`** and the first is `"More options for Sprint goals"` | a |
| REQ-2.5.3 Show archived | `REQ-2.5.3.spec.ts:11` via `h.ts:205` | `getByText(/Travel plans 2\.5\.3/i).first()` | Archive holds **"Sprint goals"**, with `button "Unarchive for Sprint goals"`. `archiveNote` (`h.ts:268`) clicks `/archive/i`.first(); **19 buttons match** and the first is `"Archive for Sprint goals"` | a |
| REQ-2.6.1 Change note colour | `REQ-2.6.1.spec.ts:13` | `expect(after.equals(before)).toBe(false)` | `/background options/i` matches **0**; `/color/i`.first() is `"Change color for Sprint goals"`; the swatch then clicked is `"Light green"` **inside the Sprint goals card**. `Garden tasks existing` keeps `class="note-card color-default"` and its two clips are byte-identical (3677 bytes each) | a, plus a race (§3) |
| REQ-2.7.1 Assign label | `REQ-2.7.1.spec.ts:11` via `h.ts:243 → 139 → 124` | `getByRole('button',{name:/close/i}).first()` | Two wrong turns then a dead click. `/more/i`.first() opens the **Sprint goals** menu, so `"Change labels"` opens Sprint goals' picker. `setLabel('Work')` resolves `/Work/i` to the **sidebar `menuitem "Work"`** (menuitem is rung 3 of `h.ts:92-102`, checkbox rung 5) instead of the picker's `checkbox "Work for Sprint goals"`, so it navigates to the Work filter. That view has **0 buttons named `/close/i` and 0 named `/done/i`**, and `clickNamed` at `h.ts:124` sits outside any `try`, so it blocks until the budget runs out | a + b |
| REQ-2.7.2 Remove label | `REQ-2.7.2.spec.ts:11` via `h.ts:243 → 139 → 124` | `getByRole('button',{name:/close/i}).first()` | Identical to REQ-2.7.1. The snapshot at timeout shows the Work-filtered list, `Team retro remove label` and `Design review` only | a + b |
| REQ-2.7.5 Edit labels | `REQ-2.7.5.spec.ts:13` via `h.ts:149` | `getByRole('button',{name:/Projects/i}).first()` | On Edit Labels, `getByLabel(/Work editable/i)` returns **count 2, first a `<button aria-label="Edit label Work editable">`**; `.fill()` on it throws, so `fillField` falls through to `/label name/i`, which is the **`"New label name"`** create box. The page's **only textbox is `"New label name"`**; the row's value sits in a `<span>` (`app.js:314`). "Projects" is typed into the create box, `Done` (1 match) navigates home, and nothing named Projects exists anywhere | b |
| REQ-2.8.1 Pin note | `REQ-2.8.1.spec.ts:10` via `h.ts:149` | `getByRole('button',{name:/pinned/i}).first()` | `pinNote` clicks `/pin/i`.first() = **`"Unpin note for Sprint goals"`** (19 matches), unpinning the only seeded pinned row. The snapshot shows Sprint goals under **OTHERS** and no `PINNED` heading, so no rung of the ladder matches `/pinned/i` | a |
| REQ-2.8.3 Pin note on create | `REQ-2.8.3.spec.ts:14` via `h.ts:149` | `getByRole('button',{name:/Meeting\s+agenda\s+created/i}).first()` | A note **with an empty title** was created and pinned: the snapshot shows `heading [level=3]` (empty), `button "More options for"`, `button "Unpin note for"`. Measured directly: after both `fillField` calls the inputs hold `"Meeting agenda created"` and `"Pin this note"`; clicking `"Pin new note"` runs `render()` (`app.js:642`), which rebuilds `app.innerHTML` (`app.js:68`), and `renderComposer` emits the title input and body textarea **with no `value` attribute** (`app.js:131-132`), so both read `""` afterwards. `saveNote` (`app.js:373-379`) then posts the empty pair | c |
| REQ-2.5.4 Unarchive | `REQ-2.5.4.spec.ts:11` via `h.ts:144` | `getByRole('button',{name:/Travel\s+plans\s+2\.5\.4/i}).first()` | Archive holds Sprint goals only. Nothing on the page matches the title on any rung, so `hover` waits out the budget. **Not attributable: batch 11 never started** | unreached |
| REQ-2.7.6.3 View Reminders | `REQ-2.7.6.3.spec.ts:12` via `h.ts:186` | `getByText(/Movie\s+list/i)` to reach count 0 | Clicking `menuitem "Reminders"` shows **all** notes: `Call dentist existing` count 1 **and** `Movie list` count 1. `Reminders` is a `NAV_ITEMS` entry (`app.js:4`) and `sidebarLabelsHtml` filters out any label whose name is in `NAV_ITEMS` (`app.js:48`), so the label filter is unreachable and `loadAll` requests unfiltered `/api/notes` (`app.js:226-229`). **Not attributable: batch 10 recorded `batch_incomplete`** | unreached |
| REQ-4.2 Detailed settings | `REQ-4.2.spec.ts:11` via `h.ts:149` | `getByRole('button',{name:/save/i}).first()` | `menuitem "Settings"` exists and is clickable, but `render()` has no Settings branch (`app.js:81`), so it re-renders the notes list. **0 `/save/i`, 0 `/cancel/i`, 0 text matching `/bottom/i`**. **Not attributable: batch 15 never started** | unreached |
| REQ-5.1 Toggle views | `REQ-5.1.spec.ts:9` via `h.ts:124` | `getByRole('button',{name:/list view/i}).first()` | **0** anywhere on the page for `/list view/i` and **0** for `/grid view/i`, any role. **Not attributable: batch 13 never started** | unreached |
| REQ-5.2 Grid view by default | `REQ-5.2.spec.ts:9` via `h.ts:149` | `getByRole('button',{name:/list view/i}).first()` | As above | unreached |

## 2. Cause groups

Over the **eight** specs that were implemented, self-checked and then failed officially:

| Group | Count | Specs |
|---|---:|---|
| **a** — wrong control picked: the helper searches by a *generic* pattern that matches every row, then takes `.first()` | **6** | 2.3.3, 2.5.3, 2.6.1, 2.7.1, 2.7.2, 2.8.1 |
| **b** — the control exists, but the name the helper searches for is attached to something else, or sits behind a higher rung of the resolution ladder | **1 primary, 2 contributing** | 2.7.5 primary; 2.7.1 and 2.7.2 contributing |
| **c** — behaviour wrong: typed state not preserved | **1** | 2.8.3 |
| **d** — four-worker shared-store interference | **0** | — |
| **e** — other | **0** | — |

Five further failures are not attributable: REQ-2.5.4, REQ-4.2, REQ-5.1 and REQ-5.2 sit in
batches 11 to 15, which never started, and REQ-2.7.6.3 is in batch 10, which recorded
`batch_incomplete` on `Observed model token budget exhausted`.

### 2.1 Group **a** in detail: the naming rule was obeyed and did not help

This is the finding that matters. Section 8's row-scoping rule **worked**: every row action now
carries its row's own title, and the page has no ambiguity by the interface check's own
definition. Measured on the seeded home page (`attrib/probe.mjs`):

| Quantity | Value |
|---|---:|
| Visible action controls | 85 |
| Duplicate visible accessible names | **0** |
| Visible named-role controls with no accessible name | **0** |
| Buttons matching `/more/i` | **19** |
| Buttons matching `/options/i` | **19** |
| Buttons matching `/archive/i` | **19** |
| Buttons matching `/pin/i` | **19** |
| Buttons matching `/color/i` | **19** |
| Buttons matching `/pinned/i` | 0 |
| Buttons matching `/background options/i` | 0 |

Uniqueness of the *full* name does not survive the helpers, because the helpers never search by
the full name. `archiveNote` searches `/archive/i`, `pinNote` searches `/pin/i`, `deleteNote`
searches `/more/i`. A substring search plus `.first()` is decided by DOM order, and DOM order
puts the pinned "Sprint goals" card first. So `"Archive for Sprint goals"` is unique *and* is
what every archive test clicks.

The second permitted shape — actions revealed only on hover or focus — is the one that would
have worked, because then exactly one row's actions are visible when the click lands. The
generated application chose the other shape, which the check accepts and the evaluator cannot use.

### 2.2 Would the interface check have fired? No, in any state

`checks/browser.cjs:15` loads `/` once and runs the check against that single tree; it never
interacts. I applied the check's exact `describe()` logic (`interface.spec.cjs:12-39`) to nine
states (`attrib/probe5.mjs`, `attrib/probe6.mjs`):

| State | Visible action controls | Duplicate names | Nameless |
|---|---:|---|---|
| home, default (the only state the check visits) | 85 | none | none |
| home, composer open | 89 | none | none |
| home, a row dropdown open | 87 | none | none |
| home, a colour palette open | 97 | none | none |
| home, a label picker open | 88 | none | none |
| Edit Labels page | 17 | none | none |
| Edit Labels, a row in edit mode | 17 | none | none |
| Archive page | 10 | none | none |
| Trash page | 11 | none | none |

Neither rule fires anywhere. On the specific points raised:

* **Emoji-only names.** `"⋮"`, `"📌"`, `"🎨"`, `"📥"` are only the *visible text*; the accessible
  name comes from `aria-label` and is the full scoped phrase. The check reads `aria-label` first
  (`interface.spec.cjs:26`), so it correctly sees real names. The emoji are not the problem here.
* **Row actions hidden until hover.** Not applicable: the generated rows show their actions at
  rest (`app.js:193-206`), which is precisely why 19 of each are visible simultaneously.
* **Vocabulary drift such as "Archive for <title>" vs `/archive/i`.** Both still match as
  case-insensitive substrings, so drift is not what breaks these. `/background options/i` alone
  finds 0, but `clickFirstAvailable` falls through to `/color/i` and proceeds. The one place
  drift does bite is REQ-2.7.5, in group b below.

### 2.3 Group **b** in detail

Two distinct shapes, both requirement-general:

* **A row's value used as a button's name shadows the row's field.** On Edit Labels the label
  name is a `<span>` with `"Edit label Work editable"` and `"Delete label Work editable"` beside
  it (`app.js:314-317`). `fillField` looks for a *field* called `Work editable` and `getByLabel`
  hands it a button. No input exists for the row until Edit is clicked, and the input it then
  creates is named the generic `"Label name"` (`app.js:310`).
* **An open picker does not make the page behind it inert.** With the label picker open there are
  **2 menuitems and 2 checkboxes matching `/Work/i`**, and `namedLocators` reaches menuitem
  (rung 3) before checkbox (rung 5), so `setLabel` clicks the sidebar filter instead of the
  checkbox `"Work for Sprint goals"`. The picker is an inline `role="group"` inside the card
  (`app.js:176`), not a modal dialog.

## 3. The two flips, reproduced

### REQ-2.6.1 is a race in the spec's own pixel assertion, not worker interference

The colour always goes to the wrong card: `/color/i`.first() is `"Change color for Sprint goals"`,
and after the click Sprint goals carries `class="note-card color-light-green"` while
`Garden tasks existing` stays `color-default` (`attrib/probe3.mjs`). Whether the spec notices
depends on when the screenshot lands. Measured by varying only the settle time between the
`Escape` press and the second snapshot (`attrib/probe4.mjs`):

| Settle before the second snapshot | Title y before → after | Clips equal | Spec verdict |
|---:|---|---|---|
| 0 ms | 633 → **651** | no | **passes** |
| 50 ms | 633 → 633 | yes | fails |
| 150 ms | 633 → 633 | yes | fails |
| 400 ms | 633 → 633 | yes | fails |
| 1000 ms | 633 → 633 | yes | fails |

With no settle the palette inside the Sprint goals card has not collapsed yet, so
`Garden tasks existing` is still pushed down 18 px and the clipped region differs. The spec
therefore passes whenever the machine screenshots before the re-render lands. Four workers load
the machine, the re-render usually wins, and the spec fails. It flipped in **1 of 5** four-worker
replays and **0 of 3** one-worker replays.

### REQ-2.8.1 passes in a full one-worker run only because an earlier spec broke the page first

In isolation on a fresh store it **fails** (`attrib/iso/REQ-2.8.1.json`, 0 of 1), while the full
one-worker suite passes it every time. The difference is contamination, and it is measurable.
Running only `REQ-2.3.1` and then `REQ-2.8.1` on one shared store gives **2 of 2 passed**, and the
store afterwards (`attrib/iso/pair/data/store.json`) reads:

```
Sprint goals    pinned=True   deleted=True
Groceries       pinned=True   deleted=False
Delete me 2.3.1 pinned=False  deleted=False
```

REQ-2.3.1 deleted **Sprint goals** instead of "Delete me 2.3.1" — and still passed, because
`REQ-2.3.1.spec.ts:10` only asserts that a `/deleted/i` and `/undo/i` toast appeared. That removes
the pinned card from the top of the list, so REQ-2.8.1's `/pin/i`.first() lands on
`"Pin note for Groceries"`, a `PINNED` heading appears, and the spec passes while
"Meeting agenda 2.8.1" was never pinned. Under four workers the interleaving does not reliably
produce that state, so it fails in 4 of 5 replays.

The same vacuous-pass mechanism covers REQ-2.3.1, REQ-2.3.2, REQ-2.5.1 and REQ-2.5.2: all four
assert on a notification, not on the named row.

## 4. What, at harness level, would have prevented each

Ordered by specs recovered. None of these is a Keep-specific patch.

**R1 — drive the contract's seed rows through the published resolution ladder. Recovers 6, and
detects the 7th.** The ladder is fixed and public: role order `button, link, menuitem, tab,
checkbox, heading, option`, then label, placeholder and text, with substring matching and
`.first()` (`helpers.ts:89-116`; the matching discipline is stated in
`scripts/audit-benchmark-tests.js:39-46`). Reimplement it in `checks/` and, for every seeded row
and every per-row action the contract records in `mutated_by`, resolve the action by a **bare
verb** (`/archive/i`, `/pin/i`, `/more/i`, `/color/i`, `/delete/i`), click it, and assert that the
row the contract names is the one that changed. This is the check the agent cannot write for
itself, because its own self-checks use the names it chose. It fails today on 2.3.3, 2.5.3, 2.6.1,
2.7.1, 2.7.2 and 2.8.1, and it also catches 2.8.3, because the created row's title comes back empty.

**R2 — replace "no duplicate names" with "at most one visible control per action verb". Recovers
the same 6, more cheaply.** The current rule (`interface.spec.cjs:47-60`) compares whole names and
passes a page carrying 19 archive buttons. The contract already holds every seed title: strip the
seed titles out of each visible action name and fail when two or more names collapse to the same
remainder. That fails on 19 × `"…for <title>"` while still passing the hover-revealed shape and
still passing genuinely distinct controls. It is the rule the section 8 text already intends,
applied to the part of the name the evaluator actually searches.

**R3 — run the interface rules on every state one click from the entry page. Prerequisite for R2
to see anything.** `checks/browser.cjs:15` inspects one tree and stops. Every one of these eight
failures happens in a state that check never reaches. Walk the visible action controls from a
fresh load, click each once, and re-apply the rules to each resulting tree. Bounded by the control
count and requirement-free.

**R4 — a form-durability check: typing must survive an in-form click. Recovers 1 (REQ-2.8.3).**
For each form, fill every visible named input with a marker, click each other visible control in
that form once, and assert the inputs still hold their markers. `app.js:642` re-renders on a pin
toggle and `app.js:131-132` emits the inputs with no `value`, so the markers vanish. Nothing in
the contract or in the naming rules can see this; it is a general property of any generated
re-render-on-state-change UI and deserves its own check.

**R5 — an open picker or dialog must make the rest of the page inert. Recovers the second half of
2.7.1 and 2.7.2.** Require `role="dialog"` with `aria-modal`, or `inert` / `aria-hidden` on the
siblings, whenever the application opens a chooser. Then a picker entry named with a contract
literal is the only match for that literal, and rung order stops deciding the outcome. State it in
the contract supplement and assert it in the interface check on the states R3 reaches.

**R6 — a generated self-check for a row-scoped action must assert on the named row, never on a
notification.** REQ-2.3.1, 2.3.2, 2.5.1 and 2.5.2 pass officially while acting on the wrong note,
and the agent's own checks agreed with them. Add the rule to the batch supplement, and let R1 be
the harness-side enforcement.

**On what section 8 already bought.** The naming rules are not wasted. There are **zero** nameless
controls and **zero** duplicate names across nine measured states, and the swatch palette now
carries `"Light green"` (`attrib/probe2.mjs`, section F) where the previous generation exposed no
green swatch at all, so the section 1.8 entry "the swatch name list is empty" is fixed. The
schedule change also worked: 10 batches ran against the previous run's 7, and 19 requirements were
self-checked against 13. What section 8 did not anticipate is that `.first()` is decided by a
*substring* of the name, so scoping a name makes it unique without making it unambiguous.

## 5. Not measured

* Why the hosted profile returns 19, 20, 20, 20 and 21 across five replays beyond the two specs
  above. The other eleven failures are constant, so the spread is entirely REQ-2.6.1 and
  REQ-2.8.1, but I did not instrument the worker interleaving itself.
* Whether R1 through R6, applied, change a generation's outcome. No generation was run.
