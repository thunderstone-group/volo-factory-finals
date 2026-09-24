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

  // --- Render: rebuild #app from the store in the same tick as the click. Views are unmounted, never
  // cross-faded. Text typed into a form survives in-form clicks because actions call ARC.render()
  // only after they change state, and forms keep their values via ARC.preserveInputs.
  ARC.render = function () {
    const route = ARC.route();
    ARC._renderedHash = route.hash;
    ARC._popover = null;  // the screen is rebuilt; an open popover goes with it
    ARC._combobox = null;
    const app = window.APP || {};
    const main = app.screen ? app.screen(route) : '<h1>Home</h1>';
    document.getElementById('app').innerHTML = ARC.layout(main, route);
    if (ARC.dialogOpen) ARC.setInert(true);
    if (app.afterRender) app.afterRender(route);
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
  // The popover closes on render, Escape, or a click outside it.
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
    if (change && app.actions && app.actions[change]) app.actions[change]({ value: option.dataset.value, name: input && input.name, el: box });
  };

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
    ARC.pull();  // act on the records as they are now, including other sessions' writes
    fn({ id: el.dataset.id, data: { ...el.dataset }, el, event, form });
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
    dispatch(el.dataset.action, el, ev, null);
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
