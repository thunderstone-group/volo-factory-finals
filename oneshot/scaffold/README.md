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
| `lib/arc.js` §Store | synchronous state, same-tab session snapshot, background API writes | `ARC.save()` preserves login and domain changes across full navigation; a fresh browser context starts from `seed.js`; screens render without waiting for a fetch |
| `lib/arc.js` §Router | hash routes, `ARC.navigate`, in-app link interception | every screen reachable by clicking from `/`; navigation renders in the SAME task as the click — the click ladder probes each rung with `isVisible()` (no wait) right after the click resolves, and a render deferred to the `hashchange` task loses that race (Lite Bookstack 6 → 22 of 34 with this alone) |
| `lib/arc.js` §Layout | one layout function | header (landmark) + navigation + account controls + sidebar + main + footer on EVERY route including `/`; home button named exactly by the brand beside the brand link; footer ends with the layout nouns as visible words (`/header/i`, `/sidebar/i` layout tests) |
| `lib/arc.js` §Dialog | `openDialog` / `closeDialog` | siblings `inert` + `aria-hidden` while open (Playwright ignores `aria-modal`); no outside textbox visible to the fill ladder |
| `lib/arc.js` §Popover | `openPopover(host, items, {kind, id, label})` / `closePopover()` | renders inside the supplied host; the requirements decide its scope and whether a command opens a named entity editor; native buttons by default, explicit menu/menuitem roles only for a required menu |
| `lib/arc.js` §Notification | `notify(message, {undo})` | `role=status` with the literal message and an Undo button |
| `lib/arc.js` §Row actions | `rowActions([...], id)` | at most one row's actions visible at any instant, bare-verb names |
| `lib/arc.js` §Events | delegated `data-action` / `data-change` | value changes use native `input` events so live search updates before blur; forms submit with their fields as an object; actions call `ARC.render()` after changing state |

Gates that protect it: `scaffold_gaps` (shell still loads seed/arc/app; primitives still defined),
the DOM smoke (no throw on load, text rendered, landmarks present), the collision and vocabulary gates.

Validation: local Keep probe 2026-09-18 — model wrote only `app.js` + `seed.js`, primitives byte-identical,
replay 31/32 (previous best 30/32). Platform pair = round 17.
