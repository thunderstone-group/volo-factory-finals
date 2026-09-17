/* One initialization/navigation contract, shared by Node and the browser. */
(function () {
  'use strict';
  function writeBootstrap(response, data) {
    if (data && typeof data.then === 'function') throw new TypeError('Prepare initial state before writing bootstrap');
    const json = JSON.stringify(data);
    if (json === undefined) throw new TypeError('Initial application state is required');
    response.writeHead(200, {'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store'});
    response.end('globalThis.__VOLO_INITIAL__=' + json.replace(/</g, '\\u003c') + ';');
  }
  function create({root, render, initial = globalThis.__VOLO_INITIAL__}) {
    if (initial === undefined) throw new Error('Load /api/bootstrap.js before application code');
    if (!(root instanceof HTMLElement)) throw new TypeError('A navigation root is required');
    let state = initial;
    function renderCurrent() {
      const route = location.pathname + location.search + location.hash;
      const content = render(route, state, api);
      if (content && typeof content.then === 'function') throw new Error('Render synchronously from prepared state; await mutations before update');
      if (!(content instanceof Node)) throw new TypeError('Render must return a DOM node or DocumentFragment');
      root.replaceChildren(content); root.dataset.route = route;
    }
    function go(route) {
      const url = new URL(route, location.href);
      if (url.origin !== location.origin) throw new Error('Navigation must remain inside this application');
      history.pushState(null, '', url.pathname + url.search + url.hash); renderCurrent();
    }
    function link(name, route) {
      if (typeof name !== 'string' || !name.trim()) throw new TypeError('A link name is required');
      const node = document.createElement('a'); node.textContent = name; node.setAttribute('aria-label', name); node.href = route;
      node.addEventListener('click', event => {
        if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault(); go(route);
      });
      return node;
    }
    function update(next) { if (next === undefined) throw new TypeError('Updated state required'); state = next; renderCurrent(); }
    window.addEventListener('popstate', renderCurrent);
    const api = Object.freeze({go, link, update, get state() { return state; }});
    renderCurrent();
    return api;
  }
  if (typeof module === 'object' && module.exports) module.exports = Object.freeze({writeBootstrap});
  else Object.defineProperty(globalThis, 'VoloNavigation', {value: Object.freeze({create})});
})();
