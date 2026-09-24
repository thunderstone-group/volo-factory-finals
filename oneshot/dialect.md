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
## 1a. When the requirement names no role: buttons for actions, links only for navigation
A role the requirement names is the contract. Where it names none, helpers assert session and action
controls by ROLE (`getByRole('button', {name: /sign out/i})` right after login). One large-task run
rendered its sign-out control as `<a>` and lost 73 of 135 tests, because every logged-in scenario first
waits for that button. Defaults:
- Anything that changes state or triggers an action — sign in/out, submit, save, delete, sort, filter
  toggle, apply, confirm — is a real `<button type="button">` with the exact name.
- Only navigation to another screen is an `<a href>` link, and it still carries the exact name.
## 2. Quoted names are matched EXACTLY and must be UNIQUE on the screen
The formal suite locates a quoted name with `getByRole(role, {name: 'Export report', exact: true})`
in strict mode: the name must equal the element's whole accessible name, and exactly one element may
match. One formal run lost three tests because a page showed the same named link both in the header
and in its form ("strict mode violation ... resolved to 2 elements").
- Show each quoted control once per screen. Do not repeat a page's own action in the header, sidebar or
  footer.
- Never nest a named control inside an element whose name comes from its content (a tab, button, link,
  option or menu item). A tab holding its options button is named "Draft Options for Draft", so
  `getByRole('tab', {name: 'Draft', exact: true})` finds nothing. Put such controls BESIDE it:
  `<span class="tab-wrap"><button role="tab" aria-selected="true">Draft</button><button
  aria-label="Options for Draft">⋯</button></span>`.
- A combo box whose options the requirements name (or call clickable, or give the option role) is driven
  by clicking the box and then the option: use the scaffold's `ARC.combobox`, never a native `<select>`,
  whose options a click cannot reach.
## 3. Preserve exact names within their declared scope
A row action belongs inside its record; a form action belongs in its form; a sidebar action belongs
inside the sidebar. Preserve required names even when the same verb appears in another scope.
Never append an extra noun to an explicit name to satisfy a global-name heuristic. Keep actions
unique within the required scope, including exactly one completion button in an editor.
Row actions can be revealed on hover/focus to reduce clutter, but must keep the record's layout
stable. A record's title is plain text, not the accessible name of a secondary action button.
## 4. Modal editors isolate their background
Use the scaffold's dialog primitive for named modal editors. While it is open, keep background
siblings inert and aria-hidden. Ordinary contextual menus and palettes are not automatically modal;
keep them in the scope the requirement describes. Label fields uniquely inside their actual editor.
Idle dialog and notification roots remain hidden and must not intercept clicks.
## 6. Seed data describes the initial state
Create every named seed record with its specified initial properties. Do not infer a final state from
a scenario title, GIVEN state reached by dependencies, or THEN result. Operations such as archive,
delete, pin and favorite must create their own results through the UI. Keep distinct named fixtures
distinct. Use the supplied initial text exactly. Leave optional record bodies empty when no content is
specified; do not turn scenario descriptions or action instructions into stored user content.
## 6a. Do not invent an authentication prerequisite
Keep the content, actions and dashboard lists needed by a public browsing journey available without
an extra login step. A seeded verified account does not itself make every list private. Authentication
changes account controls; apply additional access restrictions only when the requirements state them.
## 6b. Seeded records are reachable from `/` by name
Each test opens `/` in a fresh, signed-out browser and never types a URL: it reaches a seeded record by
clicking a visible link named with that record's seeded name. So the home screen lists, as links named
exactly by their seeded names, every seeded top-level record a signed-out visitor may see (public groups,
public projects, shared documents), and after sign-in also the ones that user may see (their groups and
private projects). Every record screen links onward to its child records the same way. Headings, links
and `owner/name` paths show the seeded name verbatim (`Team Alpha/site-docs`, never a slug such as
`team-alpha/site-docs` in its place); an id or slug may live only in the URL.
## 7. Verbatim vocabulary — the largest family of lost points on big apps
The assert-visible ladder ends in `getByRole('button', {name})`; when it fails it means NOTHING on the page
carried the phrase. Every quoted string and every noun phrase in a THEN step must appear literally as
visible text or as an accessible name; synonyms and paraphrases score zero. Concretely:
- Layout nouns are text, not just tags: a header, sidebar, footer or logo that a THEN step names is a
  visible word on the page (a small caption or heading `Sidebar`, a footer line starting with `Footer`,
  the logo image's alt text `Logo`). `<header>` alone is invisible.
- Every validation / error / success message quoted in a requirement is rendered VERBATIM in a
  `role="status"` or `role="alert"` element with the exact sentence, punctuation included.
- Every navigation target, account section, tab, filter and widget named in a requirement is a visible
  control with exactly that name.
- Every seed name, record title, tag or username quoted in a requirement exists verbatim.
Section titles are visible headings (`<h2>Comments</h2>`), never an `aria-label` on the container.
## 7b. A quoted control name is the WHOLE accessible name, byte-exact
The formal suite anchors the names the requirement quotes: `getByRole('button', {name: /^Add item$/i})`,
`getByRole('textbox', {name: /^Item name$/i})`, `getByText(/^Items$/i)`, `getByRole('dialog', {name:
/^Item editor$/i})`. Any decoration in the same accessible name fails the match: a bullet or icon glyph
before the word (`• Items`, `🔔 Alerts`), an ellipsis after it (`Add item...`), a count
(`Items (3)`), or an added noun (`Archive item` when the requirement quotes "Archive"). Put icons in a
separate `<span aria-hidden="true">` and give the control `aria-label` equal to the quoted name. The role
follows the requirement's verb: click/press → `<button>`; field/enter → textbox labelled exactly;
dialog/editor → `role="dialog"` named as the requirement calls it; menu → `role="menu"` with
`menuitem`s.
## 7a. Named containers and fields
Expose the forms, dialogs, regions and records explicitly named by the requirements using semantic
roles and aria-label/aria-labelledby. There is no global ban on container names. Label inputs exactly;
avoid accidental collisions with unrelated controls inside the same scope. Where the requirement leaves
labels open, no field label may be a whole-word substring of another field label on the same screen:
`getByLabel` without `.first()` then hits two elements and fails in strict mode. Never rename an
explicitly required field or container. Keep typed values and native input elements stable while
editing. Native input semantics apply immediately; live filtering must not wait for a later blur event.
## 8. Mechanics
- Keep the scaffold's delegated events reachable. A capturing listener that stops propagation before
  the delegated handler silently disables menu actions; implement actions through APP.actions.
- Every screen must be reachable by clicking from `/`. Deep links are untestable and unnecessary.
- Unless the requirement names another role, every repeated record is an `<article>`; suites scope a
  row's actions as `getByRole('article').filter({has: getByText(title)}).getByRole('button', {name})`.
- When the requirement says the record itself opens its editor, make the whole record the primary
  target, including blank padding. A click on a record lands on its centre: keep secondary action
  buttons away from the centre so it opens the editor, not a toolbar control.
- Unless the requirement names a searchbox, a search field is `<input type="text">` (role textbox) with
  the required name, never `type="search"`: one suite generation asks for
  `getByRole('textbox', {name: /^Search$/i})`.
- Unless the requirement names their role, sidebar entries are the scaffold's `<button>`s inside
  `<aside>`, and header entries are links.
- When the requirement quotes a field name and no separate placeholder, that name is both the `<label>`
  and the `placeholder` of its input, byte-exact: one suite generation fills by `getByPlaceholder` only,
  the other by label first.
- The home button uses the brand as its accessible name. If a requirement specifies a name and role,
  follow those exactly; do not append "logo" to an explicitly required brand name.
- An explicit role is part of the contract. Do not override a required native button with role=option
  merely because it appears in a listbox. Similarly, keep a required textbox as a textbox.
- Keep any explicitly requested root attributes. Also expose each record state on a visible DESCENDANT
  element inside the card whose `title` is the state word (`<span title="Starred">`): suites read
  `article >> [title="Starred"]`.
- Toggle buttons carry `aria-pressed` reflecting the state.
- Every screen, INCLUDING the home screen at `/`, renders through the one shared layout function (global
  header with its navigation and account controls, sidebar, main content, footer). A home screen that renders
  only its feed loses every header, navigation, login and sidebar test at once (one practice run: 1 of 66).
- A view transition must UNMOUNT the old view, never cross-fade; a stale control visible for 100 ms loses
  the race and loses the test.
- Typing must survive a re-render: an in-form click (a toggle, a colour swatch) must not wipe the
  inputs already typed. Do not rebuild `innerHTML` on every state change.
- Mutations write to the store before the success message renders.
- Navigation renders SYNCHRONOUSLY from an in-memory store. The click ladder probes each rung for only 500 ms
  (`button`, `link`, `tab`, …), so a list that appears one second after the click is never found even though
  it is on the page by the time the test times out (one medium-task run lost 10 of 34 this way: a list was
  fetched after navigation). Load all data once at startup before enabling the UI (or embed seeds in the
  initial HTML), keep it in memory, and render every screen from it in the same tick as the click;
  write through to the API.
- Records are shared by every browser session: an account registered or a record created in one session
  is usable from another user's separately signed-in session and after its URL is reopened in a new
  session. With the scaffold, keep the signed-in user's id in `ARC.state.session` and per-viewer view state
  (open forms, drafts, messages) under `ARC.state.ui`, declare every record collection in `seed.js`, and
  call `ARC.save()` after each change.
- Budget: 10 s per test. No animations that gate visibility, no artificial delays, no redirect chains.
- The backend must survive its own bugs: register `process.on('uncaughtException', …)` and
  `process.on('unhandledRejection', …)` handlers that log and keep serving, and wrap every request handler in
  try/catch that answers HTTP 500. One thrown handler otherwise ends the Node process and every later test
  fails with ERR_CONNECTION_REFUSED (one large-task run died at test 6 of 135 on "Assignment to constant
  variable").

## 8a. Every path the requirements allow: pointer, keyboard, clipboard
A test reaches a feature through any path the requirements allow, so implement each one:
- Edit in place: where users edit an item in place (a cell, a title, a row), double-click opens its named editor
  with the current value, AND typing a printable character while the item is selected opens the same editor
  starting with that character; Enter commits, Escape cancels, clicking elsewhere commits.
- Clipboard: register `ARC.onCopy((cut) => text | {text, data})` and `ARC.onPaste((text, data) => ...)`; the
  scaffold handles Ctrl/Cmd+C, X and V. A menu's "Copy", "Cut" or "Paste" command calls
  `ARC.copyToClipboard(cut)` or `ARC.pasteFromClipboard()`. Tests put text on the browser clipboard themselves:
  never keep a private clipboard instead of it, and never preventDefault those keys. Ranges travel as
  tab-separated columns and newline-separated rows; `data` comes back only when the app pastes its own copy
  (keep formulas or other detail text cannot carry there).
- A context menu opens on the real `contextmenu` event of the element the requirements name (a row number, a
  column header, a cell), as `role="menu"` with `menuitem`s, and acts on what it was opened on: a right-click
  outside the current selection first selects that item, as a left click would.
- ARC.render() already waits for a press's click sequence; do not rebuild the pressed element yourself
  (`innerHTML`) inside a mousedown or mouseup handler, which drops its click and double-click.

Nested route-table callbacks must bind to the table that owns their sibling methods, or use explicit object references.
