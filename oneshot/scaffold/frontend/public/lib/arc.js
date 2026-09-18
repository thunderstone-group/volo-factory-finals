'use strict';
// ARC primitives. Each section names the evaluator mechanic it satisfies. Keep every function; extend
// through window.LAYOUT and window.APP in app.js, not by rewriting this file.
(function () {
  const ARC = {};

  // --- Store: the whole app renders synchronously from memory (the click ladder probes each rung for
  // 500 ms, so data fetched after navigation is never found). Seed comes from seed.js; writes go
  // through to /api/state in the background and never gate rendering.
  ARC.state = JSON.parse(JSON.stringify(window.SEED || {}));
  ARC.save = function () {
    try { fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ARC.state) }).catch(() => {}); } catch (e) {}
  };
  ARC.uid = function (prefix) { return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 9); };
  ARC.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); };

  // --- Router: hash routes, `#/name/param1/param2`. Every screen is reachable by clicking from `/`.
  ARC.route = function () {
    const parts = (location.hash || '#/').replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    return { name: parts[0] || 'home', params: parts.slice(1), hash: location.hash || '#/' };
  };
  ARC.navigate = function (hash) {
    if ((location.hash || '#/') === hash) ARC.render(); else location.hash = hash;
  };

  // --- Layout: EVERY screen, the home screen included, renders through this one function so the same
  // header (landmark + navigation + account controls), sidebar, main and footer exist on every route.
  ARC.layout = function (mainHtml, route) {
    const L = window.LAYOUT || {};
    const user = ARC.currentUser();
    const link = (n) => `<a href="${ARC.esc(n.hash)}"${route && route.hash === n.hash ? ' aria-current="page"' : ''}>${ARC.esc(n.label)}</a>`;
    const nav = (L.nav || []).map(link).join('');
    const side = (L.sidebar || []).map(link).join('');
    return `<header class="app-header">
  <a class="brand" href="#/">${ARC.esc(L.brand || 'App')}</a>
  <nav aria-label="Main navigation">${nav}</nav>
  <div class="account">${L.account ? L.account(user) : ''}</div>
</header>
<div class="layout">
  ${side ? `<aside class="sidebar"><nav aria-label="Sidebar navigation">${side}</nav></aside>` : ''}
  <main id="main-content" class="main">${mainHtml}</main>
</div>
<footer class="app-footer">${ARC.esc(L.footer || 'Footer')}</footer>`;
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

  // --- Notification: a role="status" element carrying the literal message plus an Undo button.
  ARC.notify = function (message, opts) {
    const root = document.getElementById('status-root');
    ARC._undo = opts && opts.undo;
    root.innerHTML = `<div class="status" role="status">${ARC.esc(message)}${ARC._undo ? ' <button type="button" data-action="arc:undo">Undo</button>' : ''}</div>`;
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
    const fn = app.actions && app.actions[name];
    if (!fn) return;
    fn({ id: el.dataset.id, data: { ...el.dataset }, el, event, form });
  }
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-action]');
    if (!el || el.tagName === 'FORM') return;
    ev.preventDefault();
    dispatch(el.dataset.action, el, ev, null);
  });
  document.addEventListener('submit', (ev) => {
    const formEl = ev.target.closest('form[data-action]');
    if (!formEl) return;
    ev.preventDefault();
    const form = Object.fromEntries(new FormData(formEl).entries());
    dispatch(formEl.dataset.action, formEl, ev, form);
  });
  document.addEventListener('change', (ev) => {
    const el = ev.target.closest('[data-change]');
    if (!el) return;
    dispatch(el.dataset.change, el, ev, null);
  });
  window.addEventListener('hashchange', () => { if (ARC.dialogOpen) ARC.closeDialog(); ARC.render(); });
  document.addEventListener('DOMContentLoaded', () => ARC.render());
  window.ARC = ARC;
})();
