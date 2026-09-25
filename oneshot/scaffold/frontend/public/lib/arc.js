'use strict';
// ARC primitives. Each section names the evaluator mechanic it satisfies. Keep every function; extend
// through window.LAYOUT and window.APP in app.js, not by rewriting this file.
(function () {
  const ARC = {};

  // --- Store: records are shared through the server; the sign-in and view state stay in this browser.
  // Every browser session (another user's isolated session, a later visit, a second tab) reads the same
  // records from the server, so what one session creates the next one sees, and a record's URL opens the
  // same record in any session. Reads and writes are synchronous XHRs: the click ladder probes each rung
  // right after the click (rendering stays in the click's task), and a write must land before another
  // session reads. Shared: every top-level key declared in seed.js and every array. Per browser:
  // `session` (the signed-in user's id; localStorage, so one sign-in per browser session that survives
  // reloads and new tabs) and every other key, such as `ui` view state, form drafts and messages
  // (sessionStorage, this tab). Declare every record collection in seed.js, even when it starts empty.
  const SEEDED = new Set(Object.keys(window.SEED || {}));
  const isShared = (k, v) => k !== 'session' && k !== 'ui' && (SEEDED.has(k) || Array.isArray(v));
  function split(state) {
    const shared = {}, local = {};
    for (const [k, v] of Object.entries(state || {})) (isShared(k, v) ? shared : local)[k] = v;
    return { shared, local };
  }
  function sync(method, body) {
    try {
      const x = new XMLHttpRequest();
      x.open(method, '/api/state', false);
      if (body !== undefined) x.setRequestHeader('Content-Type', 'application/json');
      x.send(body === undefined ? null : body);
      return x.status === 200 ? x.responseText : null;
    } catch (e) { return null; }
  }
  function readLocal() {
    let local = {};
    try { local = JSON.parse(sessionStorage.getItem('arc:local:v2') || '{}') || {}; } catch (e) {}
    try {
      const s = localStorage.getItem('arc:session:v2');
      if (s !== null) local.session = JSON.parse(s);
    } catch (e) {}
    return local;
  }
  ARC.state = JSON.parse(JSON.stringify(window.SEED || {}));
  // Replace the shared keys with the server's copy, in place (code may hold a reference to ARC.state).
  ARC.pull = function () {
    let data = null;
    try { data = JSON.parse(sync('GET') || 'null'); } catch (e) {}
    if (!data || typeof data !== 'object' || Array.isArray(data) || !Object.keys(data).length) return false;
    for (const k of Object.keys(ARC.state)) if (isShared(k, ARC.state[k])) delete ARC.state[k];
    Object.assign(ARC.state, split(data).shared);
    return true;
  };
  ARC.save = function () {
    const { shared, local } = split(ARC.state);
    const { session, ...view } = local;
    try { sessionStorage.setItem('arc:local:v2', JSON.stringify(view)); } catch (e) {}
    try { localStorage.setItem('arc:session:v2', JSON.stringify(session === undefined ? null : session)); } catch (e) {}
    sync('PUT', JSON.stringify(shared));
  };
  if (!ARC.pull()) sync('PUT', JSON.stringify(split(ARC.state).shared));
  Object.assign(ARC.state, readLocal());
  ARC.uid = function (prefix) { return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 9); };
  ARC.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); };

  // --- Router: hash routes, `#/name/param1/param2`. Every screen is reachable by clicking from `/`.
  ARC.route = function () {
    const parts = (location.hash || '#/').replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    return { name: parts[0] || 'home', params: parts.slice(1), hash: location.hash || '#/' };
  };
  // Navigation renders in the SAME task as the click. The click ladder probes each rung with
  // `isVisible()` (no wait) right after the click resolves; a render deferred to the `hashchange`
  // task loses that race under load, and the step then waits for the wrong rung until the test
  // times out (every "click an entry after navigation" step of one medium practice task, and a
  // stochastic seed-click failure family on the large ones).
  ARC.navigate = function (hash) {
    if ((location.hash || '#/') !== hash) location.hash = hash;
    if (ARC.dialogOpen) ARC.closeDialog();
    ARC.pull();
    ARC.render();
  };

  // --- Layout: EVERY screen, the home screen included, renders through this one function so the same
  // header (landmark + navigation + account controls), sidebar, main and footer exist on every route.
  // The footer ends with the layout nouns as visible words ("Header · Sidebar · Main content · Footer"):
  // layout tests assert /header/i, /sidebar/i as visible text, and a landmark tag alone is invisible
  // (one practice task lost its two layout requirements in both samples once the model stopped writing them).
  // The home button uses the brand as its accessible name. Preserve an explicitly
  // required name rather than decorating it with an extra "logo" suffix.
  // Header entries are links (navigation). Sidebar entries are BUTTONS inside <aside> (role
  // complementary): one suite generation resolves them as `complementary >> button /^Name$/`. The aside
  // comes AFTER <main> in DOM order (CSS puts it back on the left) so a page-wide `.first()` for a verb
  // like /archive/i reaches a card's hover-revealed action before the sidebar's "Archived" entry.
  ARC.layout = function (mainHtml, route) {
    const L = window.LAYOUT || {};
    const user = ARC.currentUser();
    const link = (n) => `<a href="${ARC.esc(n.hash)}"${route && route.hash === n.hash ? ' aria-current="page"' : ''}>${ARC.esc(n.label)}</a>`;
    const entry = (n) => `<button type="button" data-action="arc:nav" data-hash="${ARC.esc(n.hash)}"${route && route.hash === n.hash ? ' aria-current="page"' : ''}>${ARC.esc(n.label)}</button>`;
    const nav = (L.nav || []).map(link).join('');
    // Built-in and data-derived destinations may overlap; render each identical entry once.
    const side = [...new Set((L.sidebar || []).map(entry))].join('');
    return `<header class="app-header">
  <button type="button" class="brand-logo" aria-label="${ARC.esc(L.brand || 'App')}" data-action="arc:nav" data-hash="#/"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="M4 5h16v14H4z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 9h8M8 13h5" stroke="currentColor" stroke-width="2"/></svg></button>
  <a class="brand" href="#/">${ARC.esc(L.brand || 'App')}</a>
  <nav aria-label="Main navigation">${nav}</nav>
  <div class="account">${L.account ? L.account(user) : ''}</div>
</header>
<div class="layout">
  <main id="main-content" class="main">${mainHtml}</main>
  ${side ? `<aside class="sidebar">${side}</aside>` : ''}
</div>
<footer class="app-footer">${ARC.esc(L.footer || 'Footer')} <span class="landmarks">Header · Sidebar · Main content · Footer</span></footer>`;
  };
  ARC.currentUser = function () {
    const s = ARC.state;
    if (!s || !s.session) return null;
    return (s.users || []).find((u) => u.id === s.session) || null;
  };

  // --- Presses: the browser sends `click`, and `dblclick` on a second press, only to an element that is still
  // in the document when the button is released. A render inside a mousedown/mouseup handler replaces that
  // element and silently drops the click and the double-click (09-24: three of three spreadsheet drafts
  // re-rendered their grid on a press, so no cell ever received a click and the double-click editor never
  // opened). While a left-button press is in progress, ARC.render() waits for the end of its click sequence
  // (after `click`, or after `dblclick` on a second press), in the same task.
  let pressing = false, postponed = false;
  const settle = () => { pressing = false; if (postponed) { postponed = false; ARC.render(); } };
  const press = (ev) => { if (ev.button === 0) pressing = true; };
  const release = (ev) => { if (ev.button === 0) { pressing = true; setTimeout(settle, 0); } };
  for (const type of ['pointerdown', 'mousedown']) window.addEventListener(type, press, true);
  for (const type of ['pointerup', 'mouseup']) window.addEventListener(type, release, true);
  window.addEventListener('click', (ev) => { if (ev.detail < 2) settle(); });
  // A double-click handler that opened an editor itself (focus is now in a text field of the screen) keeps it:
  // the render postponed from the second press would wipe it.
  window.addEventListener('dblclick', () => {
    const active = document.activeElement, app = document.getElementById('app');
    if (active && app && app.contains(active) && active.matches('input, textarea, [contenteditable="true"]')) postponed = false;
    settle();
  });
  // A press on a popover belongs to the popover. Grid and list pointer handlers took the cell around a menu as the
  // pressed cell and re-selected it, so a menu Copy on a dragged range copied one cell (two of four spreadsheet
  // drafts, 09-25). The press still counts above; the click still reaches the popover's commands.
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
    window.addEventListener(type, (ev) => {
      if (ev.target && ev.target.closest && ev.target.closest('[data-popover]')) ev.stopPropagation();
    }, true);
  }

  // --- Helpers reachable through `this` from any part of APP. A helper written on APP.screens and called as
  // `this.helper()` from a screen that runs with APP as `this` (or the other way round, or from an action)
  // threw "this.helper is not a function" and blanked the screen: dozens of drafts on six tasks. Every
  // function on APP, APP.screens, APP.actions and APP.helpers is also reachable from the others under the
  // same name (non-enumerable, never replacing an own entry); actions run with APP.actions as `this`.
  const RESERVED = new Set(['screen', 'screens', 'actions', 'helpers', 'afterRender']);
  ARC.shareHelpers = function (app) {
    const holders = [app, app && app.screens, app && app.actions, app && app.helpers]
      .filter((o) => o && typeof o === 'object');
    for (const from of holders) {
      for (const key of Object.keys(from)) {
        if (RESERVED.has(key) || typeof from[key] !== 'function') continue;
        for (const to of holders) {
          if (to === from || Object.prototype.hasOwnProperty.call(to, key)) continue;
          try { Object.defineProperty(to, key, { value: from[key], writable: true, configurable: true, enumerable: false }); } catch (e) { /* frozen */ }
        }
      }
    }
  };

  // --- Render: rebuild #app from the store in the same tick as the click. Views are unmounted, never
  // cross-faded. Text typed into a form survives in-form clicks because actions call ARC.render()
  // only after they change state, and forms keep their values via ARC.preserveInputs.
  ARC.render = function () {
    if (pressing) { postponed = true; return; }
    const route = ARC.route();
    ARC._renderedHash = route.hash;
    ARC._popover = null;  // the screen is rebuilt; an open popover goes with it
    ARC._combobox = null;
    const app = window.APP || {};
    ARC.shareHelpers(app);
    const main = app.screen ? app.screen(route) : '<h1>Home</h1>';
    document.getElementById('app').innerHTML = ARC.layout(main, route);
    if (ARC.dialogOpen) ARC.setInert(true);
    if (app.afterRender) app.afterRender(route);
    ARC.collapseDuplicates();
  };
  // --- One copy of an identical control per screen. Suites click a quoted name in strict mode
  // (`getByRole('link', {name: 'Sign in', exact: true})`); the same link in the header and in the page body
  // resolved to two elements and failed three tests on 09-24 and six on the next draft. A visible link or
  // button whose markup is byte-identical to an earlier visible one (same name, target, action and data) does
  // the same thing, so the later copy is hidden. Controls that differ in anything (a record id, a role) stay.
  ARC.collapseDuplicates = function () {
    const seen = new Set();
    for (const el of document.querySelectorAll('#app a[href], #app button')) {
      if (el.hidden || !el.getClientRects().length) continue;
      const key = el.outerHTML.replace(/\s+/g, ' ').trim();
      if (seen.has(key)) { el.hidden = true; el.setAttribute('data-arc-duplicate', ''); } else seen.add(key);
    }
  };

  // --- Dialog: while a chooser is open every sibling is inert + aria-hidden (Playwright ignores
  // aria-modal), so no text input outside the dialog is visible to the fill ladder. The root is hidden
  // when idle so it never intercepts hovers or clicks.
  ARC.dialogOpen = false;
  ARC.openDialog = function (html, opts) {
    const root = document.getElementById('dialog-root');
    root.innerHTML = `<div class="dialog" role="dialog" aria-label="${ARC.esc((opts && opts.title) || 'Dialog')}">${html}</div>`;
    root.hidden = false;
    ARC.dialogOpen = true;
    ARC.setInert(true);
    const first = root.querySelector('input, textarea, select, button');
    if (first) first.focus();
  };
  ARC.closeDialog = function () {
    const root = document.getElementById('dialog-root');
    root.hidden = true; root.innerHTML = '';
    ARC.dialogOpen = false;
    ARC.setInert(false);
  };
  ARC.setInert = function (on) {
    for (const id of ['app', 'status-root']) {
      const el = document.getElementById(id);
      if (!el) continue;
      if (on) { el.setAttribute('inert', ''); el.setAttribute('aria-hidden', 'true'); }
      else { el.removeAttribute('inert'); el.removeAttribute('aria-hidden'); }
    }
  };

  // --- Popover: render contextual UI inside its supplied host. The requirement determines
  // the host and whether the interaction is a popover or an entity editor/dialog.
  // Command menus are not a replacement for the entity's named field editor.
  // items are { label, action, extra? }; kind 'buttons' renders native buttons;
  // kind 'menu' explicitly renders role=menu and role=menuitem.
  // The popover closes on render, Escape, a click outside it, and after one of its menu items ran: a menu left
  // open inside a grid cell became part of the cell's text ("PenCopyCutPaste" after a menu Cut, 09-25).
  // It stays inside the host: apps find the record or cell a command acts on through the menu's ancestors.
  ARC.openPopover = function (host, items, opts) {
    const record = host && host.closest('article[data-id], [role="article"][data-id]');
    const id = (opts && opts.id) != null ? String(opts.id) :
      (host && host.dataset && host.dataset.id) || (record && record.dataset.id) || '';
    // A menu item may replace its own menu. Keep the connected anchor before removing it.
    if (host && ARC._popover && ARC._popover.contains(host)) host = ARC._popover.parentElement;
    ARC.closePopover();
    if (!host) return;
    const kind = (opts && opts.kind) || 'buttons';
    const button = (a) => `<button type="button"${kind === 'menu' ? ' role="menuitem"' : ''} data-action="${ARC.esc(a.action)}" data-id="${ARC.esc(id)}"${a.extra ? ' ' + a.extra : ''}>${ARC.esc(a.label)}</button>`;
    const body = typeof items === 'string' ? items : items.map(button).join('');
    const wrap = document.createElement('div');
    wrap.className = 'popover';
    wrap.setAttribute('data-popover', '');
    if (kind === 'menu') { wrap.setAttribute('role', 'menu'); if (opts && opts.label) wrap.setAttribute('aria-label', opts.label); }
    wrap.innerHTML = body;
    host.appendChild(wrap);
    ARC._popover = wrap;
  };
  ARC.closePopover = function () {
    if (ARC._popover && ARC._popover.parentNode) ARC._popover.parentNode.removeChild(ARC._popover);
    ARC._popover = null;
  };

  // --- Combobox: a named combo box whose options are CLICKED. Suites open the box by its name
  // (`getByRole('combobox', {name: 'Priority', exact: true})`) and then click the option by its visible name
  // (`getByRole('option', {name: 'High', exact: true})`). A native <select> fails that: its <option>s are
  // never visible to a click, and several selects offering the same option name make the option ambiguous.
  // Here the listbox exists only while its box is open, so an option name shared by several boxes resolves
  // to one element. The value rides in a hidden input named `name`, so forms submit it like any field.
  // ARC.combobox({ label, name, options: ['A', 'B'] | [{ value, label }], value, change: 'actionName' })
  // renders a <label>, the box (role=combobox, named by the label) and the hidden input; `change` names an
  // APP.actions entry called with { value, name } after a pick.
  ARC.combobox = function (o) {
    const id = 'cb-' + String(o.name || o.label).replace(/[^A-Za-z0-9_-]/g, '_') + '-' + (ARC._cbSeq = (ARC._cbSeq || 0) + 1);
    const options = (o.options || []).map((x) => (typeof x === 'object' ? { value: String(x.value), label: String(x.label != null ? x.label : x.value) } : { value: String(x), label: String(x) }));
    const current = options.find((x) => x.value === String(o.value == null ? '' : o.value));
    return `<span class="combobox" data-combobox="${id}"${o.change ? ` data-cb-change="${ARC.esc(o.change)}"` : ''}>` +
      `<label id="${id}-label" for="${id}">${ARC.esc(o.label)}</label> ` +
      `<button type="button" id="${id}" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="${id}-list" aria-labelledby="${id}-label"` +
      ` data-action="arc:combobox" data-options="${ARC.esc(JSON.stringify(options))}">${ARC.esc(current ? current.label : (o.placeholder || 'Select'))}</button>` +
      `<input type="hidden" name="${ARC.esc(o.name || '')}" value="${ARC.esc(current ? current.value : '')}"></span>`;
  };
  ARC._openCombobox = function (box) {
    const wrap = box.closest('[data-combobox]');
    const open = wrap.querySelector('[role="listbox"]');
    ARC.closeCombobox();
    if (open) return;  // a second click on an open box closes it
    let options = [];
    try { options = JSON.parse(box.dataset.options || '[]'); } catch (e) {}
    const value = (wrap.querySelector('input[type="hidden"]') || {}).value;
    const list = document.createElement('div');
    list.id = box.getAttribute('aria-controls');
    list.className = 'listbox';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-labelledby', box.getAttribute('aria-labelledby'));
    list.innerHTML = options.map((x) => `<div role="option" tabindex="-1" aria-selected="${x.value === value}" data-action="arc:option" data-value="${ARC.esc(x.value)}">${ARC.esc(x.label)}</div>`).join('');
    wrap.appendChild(list);
    box.setAttribute('aria-expanded', 'true');
    ARC._combobox = wrap;
  };
  ARC.closeCombobox = function () {
    const wrap = ARC._combobox;
    ARC._combobox = null;
    if (!wrap) return;
    const list = wrap.querySelector('[role="listbox"]');
    if (list) list.remove();
    const box = wrap.querySelector('[role="combobox"]');
    if (box) box.setAttribute('aria-expanded', 'false');
  };
  ARC._pickOption = function (option) {
    const wrap = option.closest('[data-combobox]');
    const box = wrap.querySelector('[role="combobox"]');
    const input = wrap.querySelector('input[type="hidden"]');
    if (input) { input.value = option.dataset.value; input.dispatchEvent(new Event('input', { bubbles: true })); }
    box.textContent = option.textContent;
    ARC.closeCombobox();
    box.focus();
    const change = wrap.dataset.cbChange;
    const app = window.APP || {};
    if (change && app.actions && app.actions[change]) { ARC.shareHelpers(app); app.actions[change]({ value: option.dataset.value, name: input && input.name, el: box }); }
  };

  // --- Clipboard: copy, cut and paste go through the browser's clipboard, so text another program (or a test)
  // put there pastes into the app, and what the app copies pastes elsewhere. Outside text fields:
  //   ARC.onCopy((cut) => text | { text, data } | null)  Ctrl/Cmd+C or X: the text to put on the clipboard
  //     (tab-separated columns, newline-separated rows for a range); `data` is kept for a paste of that same text.
  //   ARC.onPaste((text, data) => {})  Ctrl/Cmd+V, and ARC.pasteFromClipboard() for a menu's "Paste" command;
  //     `data` is what onCopy kept when the clipboard still holds the text the app copied, else null.
  // The native copy/cut/paste events carry the text: never preventDefault a Ctrl+C/X/V keydown, which cancels
  // them. When no event follows the keys (a page listener cancelled it), the async clipboard API is used.
  let onCopy = null, onPaste = null, copied = null, taken, copySeen = true, pasteSeen = true;
  const editing = (el) => !!(el && el.closest && el.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]'));
  ARC.onCopy = function (fn) { onCopy = fn; };
  ARC.onPaste = function (fn) { onPaste = fn; };
  const take = (cut) => {
    const out = onCopy ? onCopy(cut) : null;
    if (out == null) return null;
    copied = typeof out === 'object' ? { text: String(out.text == null ? '' : out.text), data: out.data } : { text: String(out), data: null };
    return copied.text;
  };
  // Pasted text arrives with \n line ends and without the one line break that ends copied rows (spreadsheets and
  // text editors put it there; it is not an extra empty row).
  const lines = (text) => String(text == null ? '' : text).replace(/\r\n?/g, '\n').replace(/\n$/, '');
  const give = (text) => {
    text = lines(text);
    const same = copied && text === lines(copied.text);
    if (onPaste) onPaste(text, same ? copied.data : null);
  };
  // A menu's Paste reads the browser clipboard. Where that read is missing, refused (no clipboard permission) or
  // does not answer, the app's own last copy is pasted instead, so a menu Copy followed by a menu Paste works in
  // any browser context.
  ARC.pasteFromClipboard = function () {
    const own = () => { if (!copied) return false; give(copied.text); return true; };
    if (!navigator.clipboard || !navigator.clipboard.readText) return Promise.resolve(own());
    return new Promise((resolve) => {
      let settled = false;
      const finish = (fn) => { if (settled) return; settled = true; clearTimeout(timer); resolve(fn()); };
      const timer = setTimeout(() => finish(own), 400);
      navigator.clipboard.readText().then(
        (text) => finish(() => { if (text === '' && copied) return own(); give(text); return true; }),
        () => finish(own));
    });
  };
  // A menu's "Copy" / "Cut" command.
  ARC.copyToClipboard = function (cut) {
    const text = take(!!cut);
    if (text == null || !navigator.clipboard || !navigator.clipboard.writeText) return Promise.resolve(false);
    return navigator.clipboard.writeText(text).then(() => true, () => false);
  };
  const outside = (ev) => !editing(ev.target) && !editing(document.activeElement);
  // The keys read the app's selection at once (a later click must not change what is copied); the native event,
  // dispatched in the same task, carries the text, and a zero-delay fallback covers a cancelled event.
  window.addEventListener('keydown', (ev) => {
    const key = (ev.key || '').toLowerCase();
    if (!(ev.ctrlKey || ev.metaKey) || ev.altKey || key.length !== 1 || !'cxv'.includes(key) || !outside(ev)) return;
    if (key === 'v') {
      if (!onPaste) return;
      pasteSeen = false;
      setTimeout(() => { if (!pasteSeen) { pasteSeen = true; ARC.pasteFromClipboard(); } }, 0);
      return;
    }
    if (!onCopy) return;
    const text = take(key === 'x');
    taken = text;
    copySeen = false;
    setTimeout(() => {
      if (copySeen) return;
      copySeen = true; taken = undefined;
      if (text != null && navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});
    }, 0);
  }, true);
  for (const type of ['copy', 'cut']) {
    document.addEventListener(type, (ev) => {
      if (!onCopy || !outside(ev)) return;
      const text = copySeen ? take(type === 'cut') : taken;
      copySeen = true; taken = undefined;
      if (text == null || !ev.clipboardData) return;
      ev.clipboardData.setData('text/plain', text);
      ev.preventDefault();
    });
  }
  document.addEventListener('paste', (ev) => {
    if (!onPaste || !outside(ev)) return;
    pasteSeen = true;
    ev.preventDefault();
    give(ev.clipboardData ? ev.clipboardData.getData('text/plain') : '');
  });

  // --- Notification: a role="status" element carrying the literal message plus an Undo button.
  ARC.notify = function (message, opts) {
    const root = document.getElementById('status-root');
    ARC._undo = opts && opts.undo;
    // The message sits in its own <span>: an anchored `getByText(/^Item deleted$/)` must find an element whose
    // whole text is the message, and the status container's text also holds the Undo button's label.
    root.innerHTML = `<div class="status" role="status"><span class="status-text">${ARC.esc(message)}</span>${ARC._undo ? ' <button type="button" data-action="arc:undo">Undo</button>' : ''}</div>`;
    root.hidden = false;
    clearTimeout(ARC._statusTimer);
    ARC._statusTimer = setTimeout(() => { root.hidden = true; root.innerHTML = ''; ARC._undo = null; }, (opts && opts.ms) || 6000);
  };

  // --- Row actions: hidden at rest, revealed by :hover/:focus-within (styles.css), so at any instant
  // at most one row's actions match a bare verb. Names are the bare verb the requirement quotes
  // ("Edit", "Delete", "Archive") unless a navigation entry shares the stem; never the row's title.
  ARC.rowActions = function (actions, id) {
    return `<div class="row-actions">${actions.map((a) => `<button type="button" data-action="${ARC.esc(a.action)}" data-id="${ARC.esc(id == null ? '' : id)}"${a.extra ? ' ' + a.extra : ''}>${ARC.esc(a.label)}</button>`).join('')}</div>`;
  };

  // --- Events: one delegated listener. Buttons/links carry data-action; forms carry data-action on the
  // <form> and are handled on submit with their fields as an object. APP.actions[name](ctx) receives
  // { id, data, el, event, form } and calls ARC.render() itself after changing state.
  function dispatch(name, el, event, form) {
    const app = window.APP || {};
    if (name === 'arc:undo') { const u = ARC._undo; ARC._undo = null; document.getElementById('status-root').hidden = true; if (u) u(); return; }
    if (name === 'arc:close') { ARC.closeDialog(); return; }
    if (name === 'arc:nav') { ARC.navigate(el.dataset.hash || '#/'); return; }
    if (name === 'arc:combobox') { ARC._openCombobox(el); return; }
    if (name === 'arc:option') { ARC._pickOption(el); return; }
    const fn = app.actions && app.actions[name];
    if (!fn) return;
    ARC.shareHelpers(app);
    // Act on the records as they are now, including other sessions' writes. A popover command acts on what the app
    // set up when it opened the popover instead: a right-click that selected a cell without saving yet was undone
    // by reading the records back, and the command acted on the old selection.
    if (!el.closest('[data-popover]')) ARC.pull();
    fn.call(app.actions, { id: el.dataset.id, data: { ...el.dataset }, el, event, form });
  }
  document.addEventListener('click', (ev) => {
    if (ARC._popover && !ARC._popover.contains(ev.target) && !ev.target.closest('[data-action]')) ARC.closePopover();
    if (ARC._combobox && !ARC._combobox.contains(ev.target)) ARC.closeCombobox();
    const el = ev.target.closest('[data-action], button, input, textarea, select, a, label');
    if (!el || !el.hasAttribute('data-action') || el.tagName === 'FORM') {
      // In-app links render synchronously too (see ARC.navigate); the browser's own fragment
      // navigation would only render on the later hashchange task.
      const link = ev.target.closest('a[href^="#/"], a[href="#"]');
      if (link && !ev.defaultPrevented && !ev.metaKey && !ev.ctrlKey) {
        ev.preventDefault();
        ARC.navigate(link.getAttribute('href') === '#' ? '#/' : link.getAttribute('href'));
      }
      return;
    }
    // Native controls must keep their own activation behavior. In particular,
    // cancelling checkbox clicks reverts the checked state after our handler.
    if (!el.matches('input, textarea, select, label')) ev.preventDefault();
    // An activated menu item is done with its menu (a Copy that renders nothing left it open over the grid),
    // unless the action opened another popover in its place.
    const menu = el.getAttribute('role') === 'menuitem' ? el.closest('[data-popover]') : null;
    dispatch(el.dataset.action, el, ev, null);
    if (menu && (ARC._popover === menu || ARC._popover === null)) {
      if (menu.parentNode) menu.parentNode.removeChild(menu);
      if (ARC._popover === menu) ARC._popover = null;
    }
  });
  document.addEventListener('submit', (ev) => {
    const formEl = ev.target.closest('form[data-action]');
    if (!formEl) return;
    ev.preventDefault();
    const form = Object.fromEntries(new FormData(formEl).entries());
    dispatch(formEl.dataset.action, formEl, ev, form);
  });
  // Value-change actions run while typing, not only after a control loses focus.
  // Programmatic value updates should emit a bubbling input event too.
  document.addEventListener('input', (ev) => {
    const el = ev.target.closest('[data-change]');
    if (!el) return;
    dispatch(el.dataset.change, el, ev, null);
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && ARC._popover) ARC.closePopover();
    if (ev.key === 'Escape' && ARC._combobox) ARC.closeCombobox();
  });
  window.addEventListener('hashchange', () => {
    if ((location.hash || '#/') === ARC._renderedHash) return;  // already rendered in the click's task
    if (ARC.dialogOpen) ARC.closeDialog();
    ARC.pull();
    ARC.render();
  });
  document.addEventListener('DOMContentLoaded', () => ARC.render());
  window.ARC = ARC;
})();
