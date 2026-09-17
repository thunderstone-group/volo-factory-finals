# ARC-Bench evaluator dialect — how the official Playwright suite reads your app
The suite sees ONLY the accessibility tree and visible text. It never uses CSS/id/data-* selectors, never
navigates except `page.goto('/')`, never touches localStorage, never reads the URL, never calls `/api/*`,
never runs `page.evaluate`. `data-testid` buys nothing. Build the DOM for a screen reader: semantic
elements, `aria-label`, `<label for>`, real landmarks.
## 1. The locator ladder (fixed and public)
- Click: role `button`, then `link`, `tab`, `menuitem`, `option`, then `getByText` — FIRST VISIBLE WINS.
- Assert visible: `getByText`, then roles `heading, button, link, tab, cell, columnheader, textbox, combobox`, then `getByLabel`, then `getByPlaceholder`.
- Fill a field: `getByLabel`, then `getByPlaceholder`, then roles `textbox, combobox, spinbutton`, then a LAST RESORT bare `getByRole('textbox').first()` with no name at all.
- Hover: same ladder as click, `button` first, `getByText` last.
- Roles in use: button, textbox, link, combobox, checkbox, tab, heading, radio, option, menuitem, searchbox, spinbutton, cell, status, row, alert, dialog, region.
## 2. Names are case-insensitive SUBSTRING regexes
`/archive/i` matches "Archive note". Whitespace runs are flexible. A few helpers ANCHOR the pattern:
`/^archived?$/i` for the archive view, `/^settings$/i` for the settings screen. Assume any sidebar
navigation target may be matched anchored.
## 3. The ambiguity rule — this is where most points are lost
The suite looks up row actions by BARE VERB — `/more/i`, `/options/i`, `/menu/i`, `/archive/i`, `/pin/i`,
`/color/i`, `/delete/i`, `/labels/i`, `/close/i`, `/done/i`, `/save/i`, `/cancel/i` — then takes `.first()`
in DOM order. Therefore: **at any instant at most ONE visible control may match each of those verbs.**
Two shapes are fatal:
- (a) Every note card shows its Archive button at rest → N matches, the first card always wins, so every
  archive/pin/delete/colour test mutates the wrong note. Zero points across a whole requirement family.
- (b) A row action named the bare word `Archive` while the sidebar has `Archived`: the anchored
  `/^archived?$/i` matches that BUTTON, and button outranks link, so "open the archive view" archives a
  second note instead — and destroys another test's fixture on the way.
**The shape that works.** Row actions are `display:none`, revealed only on `:hover` / `:focus-within`, so
exactly one row's actions are in the accessibility tree at a time. Name them `More options`, `Archive
note`, `Unarchive note`, `Pin note`, `Unpin note`, `Change color`, `Change labels`, `Delete note` — the
bare verb matches as a substring, the anchored sidebar pattern does not.
**Never put a note's own title inside an action control's accessible name.** The suite hovers the title to
reveal the actions; if a button also answers to the title it resolves to that hover-only button, the click
re-renders the row, the button vanishes, and the test deadlocks. On an unhovered page
`getByRole('button', {name: /<any note title>/i})` must have count 0 — titles live in plain text nodes.
## 4. An open chooser must HIDE the rest of the page — `inert` is not enough
The suite resolves names with `isVisible()`, which ignores `inert`, `aria-hidden` and `aria-modal`. While
a dialog, dropdown, colour palette or label picker is open, every other interactive element that is
still visible competes for the same name, and `link` outranks `checkbox`, `button` outranks everything:
a sidebar link named like a picker option wins, the click lands on an inert element and the test hangs
until timeout. So while a chooser is open set `visibility: hidden` (or `display: none`) on the rest of the
app (render the chooser outside that container), and restore it on close. In particular **no text input
outside the open chooser may be visible**: the fill helper's last resort is the first bare textbox on the
page, so a header Search box will silently swallow typing meant for the dialog. Picker options are native
`<input type="checkbox">` elements that are themselves visible (not visually hidden behind a styled span)
with the option name as their label.
## 5. A verb must resolve INSIDE the container the test is working in
With the composer ("Take a note" editor) open the test still searches `/more|options|menu/i` and
`/labels/i`. If the composer offers neither, the ladder escapes to the banner "Menu" button and the sidebar
"Edit Labels" item and the test goes somewhere else entirely. Every action a requirement attaches to a row
or to the composer must be reachable from inside it by the generic verb.
## 6. Seed data is the contract
93% of tests need pre-seeded rows and there is no reset API. Every quoted title in a requirement
description ("The system contains …") is a literal seed row: create it at startup with that exact title,
one dedicated row per mutating requirement, never shared between tests. Four workers hit one server at once.
## 7. Verbatim vocabulary
Every quoted string and every noun in a THEN step must appear literally as visible text or as an accessible
name; synonyms score zero. Notifications are `role="status"` carrying the literal message plus an `Undo`
button. A named section must be a real landmark (`<section aria-label="…">` → role region).
## 8. Mechanics
- Every screen must be reachable by clicking from `/`. Deep links are untestable and unnecessary.
- A view transition must UNMOUNT the old view, never cross-fade; a stale control visible for 100 ms loses
  the race and loses the test.
- Typing must survive a re-render: an in-form click (pin toggle, colour swatch) must not wipe the
  title/body inputs. Do not rebuild `innerHTML` on every state change.
- Mutations write to the store before the success message renders.
- Budget: 10 s per test. No animations that gate visibility, no artificial delays, no redirect chains.
