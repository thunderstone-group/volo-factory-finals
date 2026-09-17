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
**Name an action control EXACTLY the verb the requirement quotes.** Many helpers anchor the verb:
`/^edit$/i`, `/^delete$/i`, `/^reply$/i`, `/^save$/i`, `/^cancel$/i`. "Edit question" or "Delete answer"
does not match an anchored pattern and the whole edit/delete/reply family scores zero. The ONLY time
to add a noun ("Archive note") is when a navigation entry shares the verb's stem (sidebar "Archived"
vs action "Archive"): then the anchored navigation pattern would catch the bare button, because button
outranks link. Otherwise: bare verb, nothing else. Where the requirement says "Edit" link, a link named
exactly "Edit" is fine — the click ladder reaches links.
**Never put a note's own title inside an action control's accessible name.** The suite hovers the title to
reveal the actions; if a button also answers to the title it resolves to that hover-only button, the click
re-renders the row, the button vanishes, and the test deadlocks. On an unhovered page
`getByRole('button', {name: /<any note title>/i})` must have count 0 — titles live in plain text nodes.
## 4. An open chooser must make the rest of the page inert
Playwright does NOT honour `aria-modal`. Put `inert` and `aria-hidden="true"` on every sibling while a
dialog, dropdown, colour palette or label picker is open. In particular **no text input outside the open
chooser may be visible**: the fill helper's last resort is the first bare textbox on the page, so a header
Search box will silently swallow typing meant for the dialog.
## 5. A verb must resolve INSIDE the container the test is working in
With the composer ("Take a note" editor) open the test still searches `/more|options|menu/i` and
`/labels/i`. If the composer offers neither, the ladder escapes to the banner "Menu" button and the sidebar
"Edit Labels" item and the test goes somewhere else entirely. Every action a requirement attaches to a row
or to the composer must be reachable from inside it by the generic verb.
## 6. Seed data is the contract
93% of tests need pre-seeded rows and there is no reset API. Every quoted title in a requirement
description ("The system contains …") is a literal seed row: create it at startup with that exact title,
one dedicated row per mutating requirement, never shared between tests. Four workers hit one server at once.
## 7. Verbatim vocabulary — the largest family of lost points on big apps
The assert-visible ladder ends in `getByRole('button', {name})`; when it fails it means NOTHING on the page
carried the phrase. Every quoted string and every noun phrase in a THEN step must appear literally as
visible text or as an accessible name; synonyms and paraphrases score zero. Concretely:
- Layout nouns are text, not just tags: "header, sidebar, main question feed, footer, logo, filter panel,
  right sidebar widgets" must each be visible words on the page (a small caption or heading `Sidebar`,
  a footer line starting with `Footer`, the logo image's alt text `Logo`). `<header>` alone is invisible.
- Every validation / error / success message quoted in a requirement is rendered VERBATIM in a
  `role="status"` or `role="alert"` element with the exact sentence, punctuation included.
- Every navigation target, account section, tab, filter and widget named in a requirement is a visible
  control with exactly that name ("Profile", "Addresses", "Order history and details", "Favorites",
  "Recently viewed", "Watch tag"). After login the word "Profile" must be a visible button or link.
- Every seed name, product title, wishlist name, tag or username quoted in a requirement exists verbatim.
Notifications are `role="status"` carrying the literal message plus an `Undo` button. Section titles are
visible headings (`<h2>Comments</h2>`), never an `aria-label` on the container.
## 7a. `aria-label` is reserved for form controls and icon-only buttons
The fill ladder's FIRST rung is `getByLabel(/price/i)`, and `getByLabel` matches ANY element whose
`aria-label` / `aria-labelledby` contains the pattern: `<section aria-label="Price">`,
`<form aria-label="Search">`, `<div aria-label="Comments">`. The container precedes its own input in DOM
order, so `.first()` returns the container and `fill()` fails ("Element is not an <input>"). One such
container kills every test that types into that field. Therefore containers (`section`, `form`, `nav`,
`div`, `ul`, `table`, `article`, `aside`) carry NO `aria-label` and NO `aria-labelledby`; only `input`,
`textarea`, `select` and icon-only `button`s do, and no two visible controls on a screen share a label
word. Exception: a requirement that names a region literally ("the Contact information section") gets one
`<section aria-label="Contact information">` whose name shares no word with any field label on that screen.
## 8. Mechanics
- Every screen must be reachable by clicking from `/`. Deep links are untestable and unnecessary.
- A view transition must UNMOUNT the old view, never cross-fade; a stale control visible for 100 ms loses
  the race and loses the test.
- Typing must survive a re-render: an in-form click (pin toggle, colour swatch) must not wipe the
  title/body inputs. Do not rebuild `innerHTML` on every state change.
- Mutations write to the store before the success message renders.
- Budget: 10 s per test. No animations that gate visibility, no artificial delays, no redirect chains.
