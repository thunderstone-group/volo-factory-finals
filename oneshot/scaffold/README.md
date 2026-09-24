# Scaffold — the architecture knowledge base for ARC-Bench web apps

Shipped in the package and placed in the stage before a fresh generation; the model extends it
(`seed.js`, `app.js`, style additions, API routes inside `api()`), never re-invents it. Each file's
header comment names the evaluator mechanic it satisfies. When a failure family is found, the first
question is whether a primitive here can absorb it (ADR 0001).

| file | primitive | mechanic it satisfies |
|---|---|---|
| `backend/server.js` | static + `/api/health` + `/api/state` | health only after seed; process guards; try/catch per request (one thrown handler otherwise ends the process) |
| `frontend/public/index.html` | shell | `#dialog-root` / `#status-root` hidden while idle (never intercept pointer events); script order seed → arc → app |
| `frontend/public/styles.css` | row actions, dialog, status | actions `display:none` at rest, shown on `:hover` / `:focus-within` BELOW the text, never over a title |
| `lib/arc.js` §Store | records shared through the server, sign-in and view state per browser | every browser session reads the same records (another user's isolated session, a later visit, the same URL reopened), so what one session creates the next one sees; `ARC.state.session` (the signed-in user) stays in its own browser session, `ARC.state.ui` and other non-record keys in its tab; every key declared in `seed.js` and every array is a shared record collection; reads and writes are synchronous, so screens still render in the click's task |
| `lib/arc.js` §Router | hash routes, `ARC.navigate`, in-app link interception | every screen reachable by clicking from `/`; navigation renders in the SAME task as the click — the click ladder probes each rung with `isVisible()` (no wait) right after the click resolves, and a render deferred to the `hashchange` task loses that race (one medium practice task went from 6 to 22 of 34 with this alone) |
| `lib/arc.js` §Layout | one layout function | header (landmark) + navigation + account controls + sidebar + main + footer on EVERY route including `/`; home button named exactly by the brand beside the brand link; footer ends with the layout nouns as visible words (`/header/i`, `/sidebar/i` layout tests) |
| `lib/arc.js` §Dialog | `openDialog` / `closeDialog` | siblings `inert` + `aria-hidden` while open (Playwright ignores `aria-modal`); no outside textbox visible to the fill ladder |
| `lib/arc.js` §Popover | `openPopover(host, items, {kind, id, label})` / `closePopover()` | renders inside the supplied host; the requirements decide its scope and whether a command opens a named entity editor; native buttons by default, explicit menu/menuitem roles only for a required menu |
| `lib/arc.js` §Combobox | `combobox({label, name, options, value, change})` | a named combo box whose options are clicked: `role=combobox` named by its label, a `role=listbox` of `role=option` elements that exists only while open (an option name shared by several boxes stays unique), the value in a hidden input so forms submit it; never a native `<select>` for such boxes, whose options a click cannot reach |
| `lib/arc.js` §Presses | `ARC.render()` waits during a left-button press | the browser sends `click` (and `dblclick` on the second press) only to an element still in the document at release; a render in a mousedown/mouseup handler replaced it, so no grid cell of three 09-24 spreadsheet drafts ever received a click and no double-click editor opened. The render runs at the end of the click sequence, same task; an editor a dblclick handler wrote itself is kept |
| `lib/arc.js` §Clipboard | `onCopy(fn)`, `onPaste(fn)`, `copyToClipboard(cut)`, `pasteFromClipboard()` | copy/cut/paste go through the browser clipboard (tests put the text there themselves): native copy/cut/paste events outside text fields, the async clipboard API when a page listener cancelled the event and for menu commands; the text to copy is read when the keys are pressed; `data` returns with a paste of the app's own copy |
| `lib/arc.js` §Notification | `notify(message, {undo})` | `role=status` with the literal message and an Undo button |
| `lib/arc.js` §Row actions | `rowActions([...], id)` | at most one row's actions visible at any instant, bare-verb names |
| `lib/arc.js` §Events | delegated `data-action` / `data-change` | value changes use native `input` events so live search updates before blur; forms submit with their fields as an object; actions call `ARC.render()` after changing state |

Gates that protect it: `scaffold_gaps` (shell still loads seed/arc/app; primitives still defined),
the DOM smoke (no throw on load, text rendered, landmarks present), the collision and vocabulary gates.

Validation: local probe on a medium practice task, 2026-09-18 — the model wrote only `app.js` + `seed.js`,
primitives byte-identical, replay 31/32 (previous best 30/32).
