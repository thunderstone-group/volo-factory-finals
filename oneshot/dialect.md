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
## 1a. Buttons for actions, links only for navigation — regardless of the requirement's word
Helpers assert session and action controls by ROLE (`getByRole('button', {name: /sign out/i})`,
`getByRole('button', {name: /^Book$/i})`, a sortable column header by `getByRole('button', {name})`). A
requirement may call such a control a "link"; the suite still wants a `<button>`. Rules:
- Anything that changes state or triggers an action — sign in/out, submit, book, buy, add to cart, sort,
  filter toggle, apply, confirm, vote, follow — is a real `<button type="button">` with the exact name.
- Only navigation to another screen is an `<a href>` link, and it still carries the exact name.
- A sortable or toggleable column header is a `<button>` inside the `<th>`, named exactly the column title.
  Two visible tables with the same column headers make the sort helper fail in strict mode (it uses no
  `.first()`); show one table at a time. A header starts in the "unsorted" state: the first click sets
  ascending explicitly, the second descending. Values that sort as strings must be rendered so that lexical
  and numeric order agree (zero-pad numbers and times).
- No field label may be a whole-word substring of another field label on the same screen:
  `getByLabel('From')` without `.first()` then hits two elements and fails in strict mode.
- After login the header shows the exact controls the requirement lists, as buttons.
## 2. Names are case-insensitive SUBSTRING regexes
`/archive/i` matches "Archive note". Whitespace runs are flexible. A few helpers ANCHOR the pattern
(`/^archived?$/i`, `/^settings$/i`). Assume any sidebar navigation target may be matched anchored.
## 3. The ambiguity rule — this is where most points are lost
The suite looks up row actions by BARE VERB (`/more/i`, `/options/i`, `/menu/i`, `/archive/i`, `/pin/i`,
`/color/i`, `/delete/i`, `/labels/i`, `/close/i`, `/done/i`, `/save/i`, `/cancel/i`, …) then takes
`.first()` in DOM order. Therefore: **at any instant at most ONE visible control may match each verb.**
Two shapes are fatal:
- (a) Every row shows its action buttons at rest → N matches, the first row always wins, so every
  row-action test mutates the wrong row. Zero points across a whole requirement family.
- (b) A row action named the bare verb while a navigation entry shares the stem (action "Archive" vs
  sidebar "Archived"): the anchored pattern matches the BUTTON, button outranks link, and "open the
  archive view" archives another row instead — destroying another test's fixture on the way.
**The shape that works.** Row actions are `display:none`, revealed only on `:hover` / `:focus-within`, so
exactly one row's actions are in the accessibility tree at a time. The bare verb matches as a substring of
the action's name; the anchored navigation pattern must not.
**Name an action control EXACTLY the verb the requirement quotes.** Many helpers anchor the verb
(`/^edit$/i`, `/^delete$/i`, `/^reply$/i`, `/^save$/i`, `/^cancel$/i`); "Edit question" does not match
an anchored pattern and the whole family scores zero. The ONLY time to add a noun to the verb is when a
navigation entry shares the verb's stem (then the anchored navigation pattern would catch the bare button,
because button outranks link). Otherwise: bare verb, nothing else. Where the requirement says an "Edit"
link, a link named exactly "Edit" is fine — the click ladder reaches links.
**Never put a row's own title inside an action control's accessible name.** The suite hovers the title to
reveal the actions; if a button also answers to the title it resolves to that hover-only button, the click
re-renders the row, the button vanishes, and the test deadlocks. On an unhovered page
`getByRole('button', {name: /<any row title>/i})` must have count 0 — titles live in plain text nodes.
## 3c. Hover-revealed actions must never cover the thing that gets hovered
The suite hovers the row TITLE (`getByRole('heading', {name})`) and then clicks an action. If the revealed
action bar is absolutely positioned over the title, the hover lands on an icon that intercepts pointer
events, Playwright retries until the 10 s budget dies, and every hover-then-act test on that screen fails.
So the action bar is a normal block BELOW the text in the card's flow (`display:none` → `display:flex` on
`:hover` / `:focus-within`), never `position:absolute` over the title, never overlapping any text a test may
hover or click. Nothing else may sit on top of a title either: no full-card overlay links, no `::after` covers.
## 4. An open chooser must make the rest of the page inert
Playwright does NOT honour `aria-modal`. Put `inert` and `aria-hidden="true"` on every sibling while a
dialog, dropdown, colour palette or picker is open. In particular **no text input outside the open
chooser may be visible**: the fill helper's last resort is the first bare textbox on the page, so a header
Search box will silently swallow typing meant for the dialog.
**An idle overlay root must not exist in the hit-test tree.** A permanent dialog root / toast root /
backdrop that covers the viewport intercepts every hover and click even when empty. Keep such roots
`display:none` (or `pointer-events:none`) until a dialog actually opens, and remove the backdrop when it closes.
## 5. A verb must resolve INSIDE the container the test is working in
With an inline editor or composer open the test still searches the generic verbs (`/more|options|menu/i`,
`/labels/i`, …). If the composer offers neither, the ladder escapes to the page header or sidebar and the
test goes somewhere else entirely. Every action a requirement attaches to a row or to a composer must be
reachable from inside it by the generic verb.
## 6. Seed data is the contract
Most tests need pre-seeded rows and there is no reset API. Every quoted title in a requirement description
("The system contains …") is a literal seed row: create it at startup with that exact title, one dedicated
row per mutating requirement, never shared between tests. Four workers hit one server at once.
## 7. Verbatim vocabulary — the largest family of lost points on big apps
The assert-visible ladder ends in `getByRole('button', {name})`; when it fails it means NOTHING on the page
carried the phrase. Every quoted string and every noun phrase in a THEN step must appear literally as
visible text or as an accessible name, on the screen where the requirement places it; synonyms and
paraphrases score zero. Concretely:
- Layout nouns the requirement names are text, not just tags: a region called "sidebar" or "footer" in the
  requirement carries that word visibly (a small caption or heading). `<header>` alone is invisible.
- Every validation / error / success message quoted in a requirement is rendered VERBATIM in a
  `role="status"` or `role="alert"` element with the exact sentence, punctuation included.
- Every navigation target, account section, tab, filter and widget named in a requirement is a visible
  control with exactly that name.
- Every seed name, product title, tag or username quoted in a requirement exists verbatim.
- Apps whose requirement is written in Chinese: the suite's patterns carry English fallbacks
  (`/账号|account/i`, `/密码|password/i`, `/登录|login/i`). Give every form field and primary action a
  bilingual accessible name (`密码 Password`, button `登录 Login`) so either language matches. When a
  requirement defers a form's exact wording to a screenshot you cannot see, the bilingual label is the only
  reliable hit.
Notifications are `role="status"` carrying the literal message plus an `Undo` button. Section titles are
visible headings, never an `aria-label` on the container.
## 7a. `aria-label` is reserved for form controls and icon-only buttons
The fill ladder's FIRST rung is `getByLabel(/word/i)`, and `getByLabel` matches ANY element whose
`aria-label` / `aria-labelledby` contains the pattern: `<section aria-label="Price">`,
`<form aria-label="Search">`. The container precedes its own input in DOM order, so `.first()` returns the
container and `fill()` fails ("Element is not an <input>"). One such container kills every test that types
into that field. Therefore containers (`section`, `form`, `nav`, `div`, `ul`, `table`, `article`, `aside`)
carry NO `aria-label` and NO `aria-labelledby`; only `input`, `textarea`, `select` and icon-only `button`s
do, and no two visible controls on a screen share a label word. Icon buttons next to a field (steppers,
clear, swap) must not share the field's word, and the input comes BEFORE its buttons in DOM order. The same
leak applies to radios and checkboxes placed before a text field whose word they share: `fill()` on a radio
fails. Exception: a requirement that names a region literally gets one `<section aria-label>` whose name
shares no word with any field label on that screen.
## 8. Mechanics
- Every screen must be reachable by clicking from `/`. Deep links are untestable and unnecessary.
- Every screen, INCLUDING the home screen at `/`, renders through the one shared layout function (global
  header with its navigation and account controls, sidebar, main content, footer). A home screen that renders
  only its feed loses every header, navigation, login and sidebar test at once.
- A view transition must UNMOUNT the old view, never cross-fade; a stale control visible for 100 ms loses
  the race and loses the test.
- Typing must survive a re-render: an in-form click must not wipe the inputs. Do not rebuild `innerHTML` on
  every state change.
- Mutations write to the store before the success message renders.
- Navigation renders SYNCHRONOUSLY from an in-memory store. The click ladder probes each rung for only
  500 ms, so a list that appears one second after the click is never found. Load all data once at startup
  before enabling the UI (or embed seeds in the initial HTML), keep it in memory, render every screen from it
  in the same tick as the click; write-through to the API in the background.
- Budget: 10 s per test. No animations that gate visibility, no artificial delays, no redirect chains.
- The backend must survive its own bugs: register `process.on('uncaughtException', …)` and
  `process.on('unhandledRejection', …)` handlers that log and keep serving, and wrap every request handler in
  try/catch that answers HTTP 500. One thrown handler otherwise ends the Node process and every later test
  fails with ERR_CONNECTION_REFUSED.
