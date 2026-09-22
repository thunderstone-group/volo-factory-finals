# ARC-Bench evaluator dialect — how the official Playwright suite reads your app
The current requirements are authoritative. Their exact roles, names (including backticks), scope,
initial seed states and attributes override historical conventions and scaffold examples below.
Do not change explicit semantics merely to satisfy a guessed locator fallback.
Use semantic HTML and accessible names. The requirements can also specify HTML elements and
attributes such as mark, title, aria-pressed and aria-expanded; implement those literally.
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
## 3. Preserve exact names within their declared scope
A row action belongs inside its record; a form action belongs in its form; a sidebar action belongs
inside the sidebar. Preserve required names even when the same verb appears in another scope.
Never append an extra noun to an explicit name to satisfy a global-name heuristic. Keep actions
unique within the required scope, including exactly one completion button in an editor. A nested
chooser must not duplicate the editor's Close/Save button: reuse the existing completion action.
Row actions can be revealed on hover/focus to reduce clutter, but must keep the record's layout
stable. A record's title is plain text, not the accessible name of a secondary action button.
## 3c. Hover-revealed actions must never cover the thing that gets hovered
The suite hovers the row TITLE (`getByRole('heading', {name})`) and then clicks an action. If the revealed
action bar is absolutely positioned over the title, the hover lands on an icon (`<span aria-hidden>🎨</span>
from .row-actions intercepts pointer events`), Playwright retries until the 10 s budget dies, and every
hover-then-act test on that screen fails (13 of 15 Keep failures on one run). So the action bar is a normal
block BELOW the text in the card's flow (`display:none` → `display:flex` on `:hover` / `:focus-within`),
never `position:absolute` over the title, never overlapping any text a test may hover or click. Nothing
else may sit on top of a title either: no full-card overlay links, no `::after` covers.
When the requirement says the record/article itself opens its editor, make the whole article the
primary target, including blank padding. Keep secondary action buttons away from the card centre;
a generic article click must open the editor, not accidentally trigger a toolbar control.
## 4. Modal editors isolate their background
Use the scaffold's dialog primitive for named modal editors. While it is open, keep background
siblings inert and aria-hidden. Ordinary contextual menus and palettes are not automatically modal;
keep them in the scope the requirement describes. Label fields uniquely inside their actual editor.
Idle dialog and notification roots remain hidden and must not intercept clicks.
## 5. A verb must resolve INSIDE the container the test is working in
With the composer ("Take a note" editor) open the test still searches `/more|options|menu/i` and
`/labels/i`. If the composer offers neither, the ladder escapes to the banner "Menu" button and the sidebar
"Edit Labels" item and the test goes somewhere else entirely. Every action a requirement attaches to a row
or to the composer must be reachable from inside it by the generic verb.
## 6. Seed data describes the initial state
Create every named seed record with its specified initial properties. An active/deletable record
starts active; an unpinned record starts unpinned. Do not infer a final state from a scenario title,
GIVEN state reached by dependencies, or THEN result. Operations such as archive, delete, pin and
favorite must create their own results through the UI. Keep distinct named fixtures distinct.
Use the supplied initial text exactly. Leave optional record bodies empty when no content is
specified; do not turn scenario descriptions or action instructions into stored user content.
## 6a. Do not invent an authentication prerequisite
Keep the content, actions and dashboard lists needed by a public browsing journey available without
an extra login step. A seeded verified account does not itself make every list private. Authentication
changes account controls; apply additional access restrictions only when the requirements state them.
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
## 7a. Named containers and fields
Expose the forms, dialogs, regions and records explicitly named by the requirements using semantic
roles and aria-label/aria-labelledby. There is no global ban on container names. Label inputs exactly;
avoid accidental collisions with unrelated controls inside the same scope. Never rename an explicitly
required field or container. Keep typed values and native input elements stable while editing.
A checkbox change updates its checked state without removing the checkbox or closing its chooser.
Native input semantics apply immediately; live filtering must not wait for a later blur event.
## 8. Mechanics
- Every screen must be reachable by clicking from `/`. Deep links are untestable and unnecessary.
- When an entity has a reading/details view and a separate Edit action, its primary record links
  open that view for every lifecycle state, including drafts. Keep the Edit action available there.
  Enter an editor directly only when the requirements explicitly describe that activation.
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
- The home button uses the brand as its accessible name. If a requirement specifies a name and role,
  follow those exactly; do not append "logo" to an explicitly required brand name.
- Put contextual command menus and color palettes in the scope explicitly required. Selecting a
  command to edit an entity's fields enters that entity's existing named editor. Label/tag editing
  inherits the same editor/dialog/form name unless the requirements explicitly name another editor;
  do not leave editor fields in an unrelated record popover. Reuse the editor's unique Close/Save
  control while a nested chooser is visible. Keep its checkboxes mounted after selection.
- An explicit role is part of the contract. Do not override a required native button with role=option
  merely because it appears in a listbox. Similarly, keep a required textbox as a textbox.
- Keep any explicitly requested root attributes. Also expose each record state on a visible DESCENDANT
  element inside the card whose `title` is the state word (`<span
  title="Pinned">`): suites read `article >> [title="Pinned"]`.
- A settings list row that edits one value is a `<fieldset>` whose `<legend>` and the input's label are both
  `"<Noun> <value>"` (`Label Work`) with its own `Save` button: suites scope `group /^Label Work$/ >> getByLabel`.
- Toggle buttons (List view / Grid view, Pin) carry `aria-pressed` reflecting the state.
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

Nested route-table callbacks must bind to the table that owns their sibling methods, or use explicit object references.
