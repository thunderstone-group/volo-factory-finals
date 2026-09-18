'use strict';
// Your application: replace this file. LAYOUT feeds ARC.layout (every screen renders through it);
// APP.screen(route) returns the main-content HTML for the current route; APP.actions handle
// data-action controls and call ARC.render() after changing ARC.state.
window.LAYOUT = {
  brand: 'App',
  nav: [{ label: 'Home', hash: '#/' }, { label: 'Items', hash: '#/items' }],
  sidebar: [{ label: 'Items', hash: '#/items' }],  // rendered as buttons inside <aside>
  footer: 'Footer',
  account: (user) => user
    ? `<span>${ARC.esc(user.name)}</span><button type="button" data-action="logout">Sign Out</button>`
    : `<a href="#/login">Log in</a>`
};

window.APP = {
  screens: {
    home() {
      return `<h1>Home</h1><p>Welcome.</p>`;
    },
    items() {
      const q = (ARC.state.query || '').toLowerCase();
      // Every repeated record is an <article>: suites scope a row's actions with getByRole('article').
      const rows = ARC.state.items.filter((it) => !q || it.title.toLowerCase().includes(q)).map((it) => `<article class="row">
  <h3>${ARC.esc(it.title)}</h3><p>${ARC.esc(it.body)}</p>
  ${ARC.rowActions([{ label: 'Edit', action: 'edit-item' }, { label: 'Delete', action: 'delete-item' }], it.id)}
</article>`).join('');
      // A search field is a plain text input labelled exactly (role textbox, never type="search").
      return `<h1>Items</h1><input type="text" aria-label="Search" data-change="search-items"><button type="button" data-action="new-item">New Item</button>${rows}`;
    },
    login() {
      return `<h1>Log in</h1><form data-action="login">
  <label for="email">Email</label><input id="email" name="email" type="email">
  <label for="password">Password</label><input id="password" name="password" type="password">
  <button type="submit">Log in</button></form>`;
    }
  },
  screen(route) {
    const fn = this.screens[route.name] || this.screens.home;
    return fn.call(this, route);
  },
  actions: {
    login({ form }) {
      const u = ARC.state.users.find((x) => x.email === form.email && x.password === form.password);
      if (!u) { ARC.notify('Invalid email or password'); return; }
      ARC.state.session = u.id; ARC.save(); ARC.navigate('#/');
    },
    logout() { ARC.state.session = null; ARC.save(); ARC.navigate('#/'); },
    'new-item'() {
      ARC.openDialog(`<h2>New Item</h2><form data-action="create-item">
  <label for="title">Title</label><input id="title" name="title">
  <button type="submit">Save</button> <button type="button" data-action="arc:close">Cancel</button></form>`, { title: 'New Item' });
    },
    'create-item'({ form }) {
      ARC.state.items.unshift({ id: ARC.uid('i'), title: form.title, body: '' });
      ARC.save(); ARC.closeDialog(); ARC.render(); ARC.notify('Item created');
    },
    'delete-item'({ id }) {
      const idx = ARC.state.items.findIndex((x) => x.id === id);
      const [removed] = ARC.state.items.splice(idx, 1);
      ARC.save(); ARC.render();
      ARC.notify('Item deleted', { undo: () => { ARC.state.items.splice(idx, 0, removed); ARC.save(); ARC.render(); } });
    },
    'edit-item'({ id }) {
      const it = ARC.state.items.find((x) => x.id === id);
      ARC.openDialog(`<h2>Edit Item</h2><form data-action="save-item" data-id="${ARC.esc(id)}">
  <label for="title">Title</label><input id="title" name="title" value="${ARC.esc(it.title)}">
  <button type="submit">Save</button> <button type="button" data-action="arc:close">Cancel</button></form>`, { title: 'Edit Item' });
    },
    'search-items'({ el }) { ARC.state.query = el.value; ARC.render(); },
    'save-item'({ el, form }) {
      const it = ARC.state.items.find((x) => x.id === el.dataset.id);
      it.title = form.title; ARC.save(); ARC.closeDialog(); ARC.render(); ARC.notify('Item saved');
    }
  }
};
