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
Helpers assert session and action controls by ROLE: `getByRole('button', {name: /sign out/i})` right after
login, `getByRole('button', {name: /^Book$/i})`, `getByRole('button', {name: /Departure\s+Time/i})` for a
sortable column header. A requirement may call it a "link" ("replace the Register link with Sign Out"); the
suite still wants a `<button>`. On one 12306 run a `<a>Sign Out</a>` failed 73 of 135 tests because every
logged-in scenario first waits for that button. Rules:
- Anything that changes state or triggers an action — sign in/out, submit, book, buy, add to cart, sort,
  filter toggle, apply, confirm, vote, follow — is a real `<button type="button">` with the exact name.
- Only navigation to another screen is an `<a href>` link, and it still carries the exact name.
- A sortable or toggleable column header is a `<button>` inside the `<th>`, named exactly the column title.
  Two tables with the same column headers (direct trains and transfer plans) must never be visible at
  once — the sort helper uses `getByRole('button', {name: 'Departure Time'})` WITHOUT `.first()` and fails
  in strict mode on two matches; render the second table only after its tab/toggle is chosen.
  The FIRST click sorts ascending, the second descending (the suite asserts exactly that order). Every
  header starts in the "unsorted" state even when the list happens to be in ascending order already: the
  first click must set ascending explicitly, never toggle from an assumed ascending default (that is how
  every 12306 sort test lost: first click produced descending). Values
  that sort as strings must be rendered so that lexical and numeric order agree: zero-pad times and
  durations (`05h28m`, `07:00`), never mix `5h28m` with `13h50m`.
- No field label may be a whole-word substring of another field label on the same screen ("From" and "From
  Station"): `getByLabel('From')` without `.first()` then hits two elements and fails in strict mode.
- After login the header shows the exact controls the requirement lists (e.g. "Sign Out"), as buttons.
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
## 3c. Hover-revealed actions must never cover the thing that gets hovered
The suite hovers the row TITLE (`getByRole('heading', {name})`) and then clicks an action. If the revealed
action bar is absolutely positioned over the title, the hover lands on an icon (`<span aria-hidden>🎨</span>
from .row-actions intercepts pointer events`), Playwright retries until the 10 s budget dies, and every
hover-then-act test on that screen fails (13 of 15 Keep failures on one run). So the action bar is a normal
block BELOW the text in the card's flow (`display:none` → `display:flex` on `:hover` / `:focus-within`),
never `position:absolute` over the title, never overlapping any text a test may hover or click. Nothing
else may sit on top of a title either: no full-card overlay links, no `::after` covers.
## 4. An open chooser must make the rest of the page inert
Playwright does NOT honour `aria-modal`. Put `inert` and `aria-hidden="true"` on every sibling while a
dialog, dropdown, colour palette or label picker is open. In particular **no text input outside the open
chooser may be visible**: the fill helper's last resort is the first bare textbox on the page, so a header
Search box will silently swallow typing meant for the dialog.
**An idle overlay root must not exist in the hit-test tree.** A permanent `<div id="dialog-root">` /
toast root / backdrop that covers the viewport intercepts every hover and click even when empty
(`<div id="dialog-root"></div> intercepts pointer events` killed 26 of 32 Keep tests on one run). Keep such
roots `display:none` (or `pointer-events:none`) until a dialog actually opens, and remove the backdrop
when it closes.
## 5. A verb must resolve INSIDE the container the test is working in
With the composer ("Take a note" editor) open the test still searches `/more|options|menu/i` and
`/labels/i`. If the composer offers neither, the ladder escapes to the banner "Menu" button and the sidebar
"Edit Labels" item and the test goes somewhere else entirely. Every action a requirement attaches to a row
or to the composer must be reachable from inside it by the generic verb.
## 6. Seed data is the contract
93% of tests need pre-seeded rows and there is no reset API. Every quoted title in a requirement
description ("The system contains …") is a literal seed row: create it at startup with that exact title,
one dedicated row per mutating requirement, never shared between tests. Four workers hit one server at once.
## 6a. Nothing is gated behind login or ownership
Most tests never log in: 31 of 34 Bookstack tests open a shelf or book anonymously and expect the bare
"Edit", "Delete", "New Shelf", "New Page", "Favorite" controls right there. Others log in as the seed account
the requirement pairs with a row and expect "Edit" on that row. No test ever asserts that an anonymous
user or a non-owner CANNOT see a control. So: every action control a requirement mentions is rendered for
everyone, logged in or not, owner or not; login only changes the header (avatar / "Profile" / "Sign Out").
Seed rows are owned by exactly the seed account the requirement names. A control hidden behind a
condition the test does not perform scores zero for its whole family.
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
- Chinese-language apps: a name the requirement quotes is rendered exactly (§7b), with the English in an
  `aria-hidden` sibling if you want it (`<button>登录<span aria-hidden="true"> Login</span></button>`). Every
  OTHER form field and primary action — the ones whose wording the requirement leaves to a screenshot —
  gets the product's own Chinese name AND an English word in one bilingual label, because the suite's
  patterns carry both (`/账号|account/i`, `/密码|password/i`, `/到达城市/`, `/search/i`): `账号 Account` for
  the multi-purpose login identifier with placeholder `邮箱/用户名/手机号` (that order, the product's wording;
  the suite matches `/邮箱.*用户名.*手机号/`), `密码 Password`, `出发城市 Origin`, `到达城市 Destination`,
  `出发日期 Departure date`, `搜索 Search`, `提交订单 Submit order`. A run that renamed these to `出发地` /
  `到达地` and reversed the placeholder lost 106 of 125 Ctrip tests; the bilingual, product-worded labels
  scored 36–54.
Notifications are `role="status"` carrying the literal message plus an `Undo` button. Section titles are
visible headings (`<h2>Comments</h2>`), never an `aria-label` on the container.
## 7b. A quoted control name is the WHOLE accessible name, byte-exact
The formal suite anchors the names the requirement quotes: `getByRole('button', {name: /^Take a note$/i})`,
`getByRole('textbox', {name: /^Note content$/i})`, `getByText(/^Notes$/i)`, `getByRole('dialog', {name:
/^Note editor$/i})`. Any decoration in the same accessible name fails the match: a bullet or icon glyph
before the word (`• Notes`, `🔔 Reminders`), an ellipsis after it (`Take a note...`), a count
(`Notes (3)`), or an added noun (`Archive note` when the requirement quotes "Archive"). Put icons in a
separate `<span aria-hidden="true">` and give the control `aria-label` equal to the quoted name. The role
follows the requirement's verb: click/press → `<button>`; field/enter → textbox labelled exactly;
dialog/editor → `role="dialog"` named as the requirement calls it; menu → `role="menu"` with
`menuitem`s. §3's "add a noun" applies only to names the requirement does NOT quote.
## 7a. `aria-label` is reserved for form controls and icon-only buttons
The fill ladder's FIRST rung is `getByLabel(/price/i)`, and `getByLabel` matches ANY element whose
`aria-label` / `aria-labelledby` contains the pattern: `<section aria-label="Price">`,
`<form aria-label="Search">`, `<div aria-label="Comments">`. The container precedes its own input in DOM
order, so `.first()` returns the container and `fill()` fails ("Element is not an <input>"). One such
container kills every test that types into that field. Therefore containers (`section`, `form`, `nav`,
`div`, `ul`, `table`, `article`, `aside`) carry NO `aria-label` and NO `aria-labelledby`; only `input`,
`textarea`, `select` and icon-only `button`s do, and no two visible controls on a screen share a label
word. The stepper next to a "Quantity" field is the classic leak: a `<button aria-label="Decrease
quantity">` placed before the input is what `getByLabel(/quantity/i).first()` returns, and
`inputValue()` on a button fails. Name steppers "Minus" / "Plus" (or "Fewer" / "More"), never with the
field's word, and put the input BEFORE its steppers in DOM order. The same leak with radios: a mode switch
`<label><input type="radio"> 航班号</label>` placed before the "航班号" text field is what
`getByLabel(/航班号/).first()` returns, and `fill()` on a radio fails. Mode/filter radios and checkboxes must
not share a word with any text field on the screen (name the modes "按编号查询" vs field "航班号", or put the
text field first in DOM order). Exception: a requirement that names a region literally ("the Contact information section") gets one
`<section aria-label="Contact information">` whose name shares no word with any field label on that screen.
## 8. Mechanics
- Every screen must be reachable by clicking from `/`. Deep links are untestable and unnecessary.
- Every repeated record (note, book, product, question, order) is an `<article>`; suites scope a row's
  actions as `getByRole('article').filter({has: getByText(title)}).getByRole('button', {name})`.
- A search field is `<input type="text" aria-label="Search">` (role textbox), never `type="search"`: one
  suite generation asks for `getByRole('textbox', {name: /^Search$/i})`.
- Sidebar entries (labels, filters, Archive, Trash) are the scaffold's `<button>`s inside `<aside>`; header
  entries are links.
- Every `<form>` is named after the phrase the requirement uses for it, in `aria-label`, capitalised, ending in
  "form": `<form aria-label="Login form">`, `<form aria-label="Shelf creation form">`. One suite generation
  scopes the submit button as `getByRole('form', {name: /^Login form$/i}).getByRole('button', {name: /^Login$/i})`;
  an unnamed form has no accessible name and every test that logs in fails (Lite Bookstack: 6 of 34). The
  form's name must not share a word with a field label inside it (§7a): "Login form" with fields "Email
  address" / "Password" is fine.
- A quoted field name is BOTH the `<label>` and the `placeholder` of its input, byte-exact ("Page title",
  "Write your page content here..."): one suite generation fills by `getByPlaceholder(/^Page title$/i)`
  only, the other by label first. Never a placeholder that differs from the label.
- The logo is the scaffold's `<button aria-label="<Brand> logo">` beside the brand link; keep both.
- Every screen, INCLUDING the home screen at `/`, renders through the one shared layout function (global
  header with its navigation and account controls, sidebar, main content, footer). A home screen that renders
  only its feed loses every header, navigation, login and sidebar test at once (one StackOverflow run: 1/66).
- A view transition must UNMOUNT the old view, never cross-fade; a stale control visible for 100 ms loses
  the race and loses the test.
- Typing must survive a re-render: an in-form click (pin toggle, colour swatch) must not wipe the
  title/body inputs. Do not rebuild `innerHTML` on every state change.
- Mutations write to the store before the success message renders.
- Navigation renders SYNCHRONOUSLY from an in-memory store. The click ladder probes each rung for only 500 ms
  (`button`, `link`, `tab`, …), so a list that appears one second after the click is never found even though
  it is on the page by the time the test times out (Bookstack lost 10 of 34 this way: the shelf list was
  fetched after navigation). Load all data once at startup before enabling the UI (or embed seeds in the
  initial HTML), keep it in memory, and render every screen from it in the same tick as the click;
  write-through to the API in the background.
- Budget: 10 s per test. No animations that gate visibility, no artificial delays, no redirect chains.
- The backend must survive its own bugs: register `process.on('uncaughtException', …)` and
  `process.on('unhandledRejection', …)` handlers that log and keep serving, and wrap every request handler in
  try/catch that answers HTTP 500. One thrown handler otherwise ends the Node process and every later test
  fails with ERR_CONNECTION_REFUSED (a 12306 run died at test 6 of 135 on "Assignment to constant variable").
