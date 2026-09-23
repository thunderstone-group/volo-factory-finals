'use strict';
(function(){
  const st = () => window.ARC.state;
  const save = () => window.ARC.save();
  const esc = (s) => window.ARC.esc(s);
  const uid = (p) => window.ARC.uid(p);
  const nav = (h) => window.ARC.navigate(h);
  const notify = (m) => window.ARC.notify(m);
  const openDialog = (html, opts) => window.ARC.openDialog(html, opts);
  const closeDialog = () => window.ARC.closeDialog();
  const currentUser = () => window.ARC.currentUser();

  function findShelf(id){ return (st().shelves||[]).find(s=>s.id===id); }
  function findBook(id){ return (st().books||[]).find(b=>b.id===id); }
  function findPage(id){ return (st().pages||[]).find(p=>p.id===id); }
  function findChapter(id){ return (st().chapters||[]).find(c=>c.id===id); }

  function getTitle(type,id){
    if(type==='shelf') return (findShelf(id)||{}).name;
    if(type==='book') return (findBook(id)||{}).name;
    if(type==='page') return (findPage(id)||{}).title;
    if(type==='chapter') return (findChapter(id)||{}).name;
    return '';
  }

  function parseTags(v){ return String(v||'').split(',').map(t=>t.trim()).filter(Boolean); }
  function now(){ return Date.now(); }

  function routeQuery(){
    const raw = location.hash || '#/';
    const i = raw.indexOf('?');
    return i===-1 ? {} : Object.fromEntries(new URLSearchParams(raw.slice(i+1)));
  }

  function entityButton(type,id,title){
    return `<article class="card"><button type="button" data-action="view-entity" data-type="${esc(type)}" data-id="${esc(id)}">${esc(title)}</button></article>`;
  }

  function favoriteButton(type,id){
    const fav = (st().favorites||[]).some(f=>f.type===type && f.id===id);
    return `<button type="button" data-action="toggle-favorite" data-type="${esc(type)}" data-id="${esc(id)}" aria-pressed="${fav?'true':'false'}">${fav?'Unfavorite':'Favorite'}</button>`;
  }

  function addRecentlyViewed(type,id,title){
    if(!id) return;
    let rv = st().recentlyViewed = st().recentlyViewed || [];
    rv = rv.filter(x=>!(x.type===type && x.id===id));
    rv.unshift({type,id,title,at:now()});
    if(rv.length>10) rv.length=10;
    st().recentlyViewed = rv;
    save();
  }

  function tagReveal(name, value){
    return `<button type="button" data-action="toggle-tags">${esc(name)}</button>
<div class="tags-reveal" hidden>
  <input type="text" name="tags" placeholder="tag1, tag2" value="${esc(value||'')}">
</div>`;
  }

  function shelfForm(route, shelf){
    const edit = !!shelf;
    const title = edit ? 'Edit Shelf' : 'Create Shelf';
    const formName = edit ? 'Edit shelf form' : 'Create shelf form';
    const action = edit ? 'save-shelf' : 'create-shelf';
    const cancelHash = edit ? `#/shelves/${esc(shelf.id)}` : '#/shelves';
    return `<h1>${esc(title)}</h1>
<form data-action="${action}"${edit?` data-id="${esc(shelf.id)}"`:''} aria-label="${esc(formName)}">
  <label for="shelf-name">Name</label>
  <input id="shelf-name" name="name" type="text" placeholder="Name" value="${esc(edit?shelf.name:'')}" required>
  <label for="shelf-description">Description</label>
  <textarea id="shelf-description" name="description" placeholder="Description">${esc(edit?shelf.description:'')}</textarea>
  ${tagReveal('Shelf Tags', edit?(shelf.tags||[]).join(', '):'')}
  <button type="submit">Save Shelf</button>
  <button type="button" data-action="cancel-nav" data-hash="${cancelHash}">Cancel</button>
</form>`;
  }

  function bookForm(route, book){
    const edit = !!book;
    const formName = edit ? 'Edit book form' : 'Create book form';
    const action = edit ? 'save-book' : 'create-book';
    const cancelHash = edit ? `#/books/${esc(book.id)}` : '#/books';
    const q = routeQuery();
    const shelfId = (!edit && q.shelfId) ? q.shelfId : '';
    return `<h1>${esc(edit?'Edit Book':'Create New Book')}</h1>
<form data-action="${action}"${edit?` data-id="${esc(book.id)}"`:''}${shelfId?` data-shelf-id="${esc(shelfId)}"`:''} aria-label="${esc(formName)}">
  <label for="book-name">Name</label>
  <input id="book-name" name="name" type="text" placeholder="Name" value="${esc(edit?book.name:'')}" required>
  <label for="book-description">Description</label>
  <textarea id="book-description" name="description" placeholder="Description">${esc(edit?book.description:'')}</textarea>
  ${tagReveal('Book Tags', edit?(book.tags||[]).join(', '):'')}
  <button type="submit">Save Book</button>
  <button type="button" data-action="cancel-nav" data-hash="${cancelHash}">Cancel</button>
</form>`;
  }

  function pageEdit(route){
    const id = route.params[0];
    const page = findPage(id);
    let bookId;
    if(page) bookId = page.bookId;
    else if(route.name==='books') bookId = route.params[0];
    else { const q=routeQuery(); bookId = q.bookId; }
    return `<h1>${esc(page?'Edit Page':'New Page')}</h1>
<form data-action="save-page"${page?` data-id="${esc(page.id)}"`:''} data-book-id="${esc(bookId)}" aria-label="Page form">
  <label for="page-title">Page title</label>
  <input id="page-title" name="title" type="text" placeholder="Page title" value="${esc(page?page.title:'')}" required>
  <label for="page-content">Write your page content here...</label>
  <textarea id="page-content" name="content" placeholder="Write your page content here...">${esc(page?page.content:'')}</textarea>
  <button type="submit" name="mode" value="page">Save Page</button>
  <button type="submit" name="mode" value="draft">Save Draft</button>
  ${page&&page.draft?`<button type="button" data-action="delete-draft" data-id="${esc(page.id)}">Delete Draft</button>`:''}
  <button type="button" data-action="cancel-nav" data-hash="#/books/${esc(bookId)}">Cancel</button>
</form>`;
  }

  function chapterForm(route){
    const bookId = route.params[0];
    return `<h1>New Chapter</h1>
<form data-action="create-chapter" data-book-id="${esc(bookId)}" aria-label="Create chapter form">
  <label for="chapter-name">Name</label>
  <input id="chapter-name" name="name" type="text" placeholder="Name" required>
  <label for="chapter-description">Description</label>
  <textarea id="chapter-description" name="description" placeholder="Description"></textarea>
  <button type="submit">Save Chapter</button>
  <button type="button" data-action="cancel-nav" data-hash="#/books/${esc(bookId)}">Cancel</button>
</form>`;
  }

  function homeScreen(route){
    const u = currentUser();
    const search = `<input type="text" aria-label="Search" data-change="home-search" value="${esc(st().homeSearch||'')}" placeholder="Search">`;
    const updated = (st().pages||[]).filter(p=>!p.draft).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)).slice(0,5);
    const updatedSection = `<section aria-label="Recently Updated Pages" class="dashboard-section"><h2>Recently Updated Pages</h2>${updated.length?updated.map(p=>entityButton('page',p.id,p.title)).join(''):'<p>No recently updated pages.</p>'}</section>`;
    if(!u) return `<h1>BookStack</h1>${search}${updatedSection}`;
    const drafts = (st().pages||[]).filter(p=>p.draft).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
    const recent = (st().recentlyViewed||[]).slice(0,10);
    const favs = (st().favorites||[]).slice(0,4);
    return `<h1>BookStack</h1>
${search}
<section aria-label="My Recent Drafts" class="dashboard-section"><h2>My Recent Drafts</h2>${drafts.length?drafts.map(p=>entityButton('page',p.id,p.title)).join(''):'<p>No drafts.</p>'}</section>
<section aria-label="My Recently Viewed" class="dashboard-section"><h2>My Recently Viewed</h2>${recent.length?recent.map(x=>entityButton(x.type,x.id,x.title)).join(''):'<p>No recently viewed items.</p>'}</section>
<section aria-label="My Most Viewed Favorites" class="dashboard-section"><h2>My Most Viewed Favorites</h2>${favs.length?favs.map(x=>entityButton(x.type,x.id,getTitle(x.type,x.id))).join(''):'<p>No favorites.</p>'}</section>
${updatedSection}`;
  }

  function loginScreen(route){
    return `<h1>Login</h1>
<form data-action="login" aria-label="Login form">
  <label for="login-email">Email address</label>
  <input id="login-email" name="email" type="email" placeholder="Email address" required>
  <label for="login-password">Password</label>
  <input id="login-password" name="password" type="password" placeholder="Password" required>
  <label><input type="checkbox" name="remember" value="1"> Remember Me</label>
  <button type="submit">Login</button>
</form>`;
  }

  function shelvesList(route){
    const q = (st().shelfQuery||'').toLowerCase();
    const list = (st().shelves||[]).filter(s=>!q||s.name.toLowerCase().includes(q)).map(s=>`
<article class="card" data-id="${esc(s.id)}">
  <h3><a href="#/shelves/${esc(s.id)}">${esc(s.name)}</a></h3>
  <p>${esc(s.description||'')}</p>
</article>`).join('');
    return `<h1>Shelves</h1>
<button type="button" data-action="new-shelf">New Shelf</button>
<section aria-label="Shelf list"><h2>Shelf list</h2>${list}</section>`;
  }

  function shelfDetails(route){
    const id = route.params[0];
    const shelf = findShelf(id);
    if(!shelf) return `<h1>Shelf not found</h1>`;
    addRecentlyViewed('shelf', shelf.id, shelf.name);
    const books = (shelf.books||[]).map(bid=>findBook(bid)).filter(Boolean).map(b=>`
<article class="card" data-id="${esc(b.id)}">
  <h3><a href="#/books/${esc(b.id)}">${esc(b.name)}</a></h3>
</article>`).join('');
    return `<h1>${esc(shelf.name)}</h1>
<p>${esc(shelf.description||'')}</p>
<div class="actions">
  <button type="button" data-action="new-book-for-shelf" data-id="${esc(shelf.id)}">New Book</button>
  <button type="button" data-action="edit-shelf" data-id="${esc(shelf.id)}">Edit</button>
  <button type="button" data-action="delete-shelf" data-id="${esc(shelf.id)}">Delete</button>
  ${favoriteButton('shelf', shelf.id)}
</div>
<section aria-label="Books in shelf"><h2>Books</h2>${books||'<p>No books.</p>'}</section>`;
  }

  function booksList(route){
    const q = (st().bookQuery||'').toLowerCase();
    const list = (st().books||[]).filter(b=>!q||b.name.toLowerCase().includes(q)).map(b=>`
<article class="card" data-id="${esc(b.id)}">
  <h3><a href="#/books/${esc(b.id)}">${esc(b.name)}</a></h3>
</article>`).join('');
    return `<h1>Books</h1>
<button type="button" data-action="new-book">Create New Book</button>
<section aria-label="Book list"><h2>Book list</h2>${list}</section>`;
  }

  function bookDetails(route){
    const id = route.params[0];
    const book = findBook(id);
    if(!book) return `<h1>Book not found</h1>`;
    addRecentlyViewed('book', book.id, book.name);
    const shelves = (book.shelfIds||[]).map(sid=>findShelf(sid)).filter(Boolean).map(s=>`<a href="#/shelves/${esc(s.id)}">${esc(s.name)}</a>`).join(', ');
    const pages = (st().pages||[]).filter(p=>p.bookId===id && !p.draft && !p.chapterId).map(p=>pageCard(p)).join('');
    const drafts = (st().pages||[]).filter(p=>p.bookId===id && p.draft).map(p=>pageCard(p,true)).join('');
    const chapters = (st().chapters||[]).filter(c=>c.bookId===id).map(c=>chapterCard(c)).join('');
    return `<h1>${esc(book.name)}</h1>
<p>${esc(book.description||'')}</p>
${shelves?`<p>Shelves: ${shelves}</p>`:''}
<div class="actions">
  <button type="button" data-action="new-page" data-id="${esc(id)}">New Page</button>
  <button type="button" data-action="new-chapter" data-id="${esc(id)}">New Chapter</button>
  <button type="button" data-action="edit-book" data-id="${esc(id)}">Edit</button>
  <button type="button" data-action="delete-book" data-id="${esc(id)}">Delete</button>
  ${favoriteButton('book', id)}
</div>
<section aria-label="Chapters"><h2>Chapters</h2>${chapters||'<p>No chapters.</p>'}</section>
<section aria-label="Pages"><h2>Pages</h2>${pages||'<p>No pages.</p>'}</section>
${drafts?`<section aria-label="Drafts"><h2>Drafts</h2>${drafts}</section>`:''}`;
  }

  function pageCard(page, draft){
    return `<article class="card" data-id="${esc(page.id)}">
  <h3><a href="${draft?`#/pages/${esc(page.id)}/edit`:`#/pages/${esc(page.id)}`}">${esc(page.title)}</a></h3>
</article>`;
  }

  function chapterCard(chapter){
    return `<article class="card" data-id="${esc(chapter.id)}">
  <h3><a href="#/chapters/${esc(chapter.id)}">${esc(chapter.name)}</a></h3>
</article>`;
  }

  function pageRead(route){
    const id = route.params[0];
    const page = findPage(id);
    if(!page) return `<h1>Page not found</h1>`;
    addRecentlyViewed('page', page.id, page.title);
    const book = findBook(page.bookId);
    return `<h1>${esc(page.title)}</h1>
<p><a href="#/books/${esc(book.id)}">${esc(book.name)}</a></p>
<div class="content">${esc(page.content).replace(/\n/g,'<br>')}</div>
<div class="actions">
  <button type="button" data-action="edit-page" data-id="${esc(id)}">Edit</button>
  ${favoriteButton('page', id)}
</div>`;
  }

  function chapterView(route){
    const id = route.params[0];
    const chapter = findChapter(id);
    if(!chapter) return `<h1>Chapter not found</h1>`;
    addRecentlyViewed('chapter', chapter.id, chapter.name);
    const book = findBook(chapter.bookId);
    const pages = (st().pages||[]).filter(p=>p.chapterId===id && !p.draft).map(p=>pageCard(p)).join('');
    return `<h1>${esc(chapter.name)}</h1>
<p>${esc(chapter.description||'')}</p>
<p><a href="#/books/${esc(book.id)}">${esc(book.name)}</a></p>
<div class="actions">${favoriteButton('chapter', id)}</div>
<section aria-label="Pages"><h2>Pages</h2>${pages||'<p>No pages.</p>'}</section>`;
  }

  function favoritesScreen(route){
    const favs = (st().favorites||[]);
    return `<h1>Favorites</h1>${favs.length?favs.map(x=>entityButton(x.type,x.id,getTitle(x.type,x.id))).join(''):'<p>No favorites.</p>'}`;
  }

  window.LAYOUT = {
    brand: 'BookStack',
    nav: [
      { label: 'Home', hash: '#/' },
      { label: 'Shelves', hash: '#/shelves' },
      { label: 'Books', hash: '#/books' },
      { label: 'Favorites', hash: '#/favorites' }
    ],
    sidebar: [
      { label: 'Home', hash: '#/' },
      { label: 'Shelves', hash: '#/shelves' },
      { label: 'Books', hash: '#/books' },
      { label: 'Favorites', hash: '#/favorites' }
    ],
    footer: 'Footer',
    account(u){
      if(u) return `<span>${esc(u.name)}</span> <button type="button" data-action="logout">Sign Out</button>`;
      return `<a href="#/login">Login</a>`;
    }
  };

  window.APP = {
    screens: {
      home: homeScreen,
      login: loginScreen,
      shelves(route){
        if(route.params[0]==='new') return shelfForm(route);
        if(route.params[1]==='edit') return shelfForm(route, findShelf(route.params[0]));
        return shelvesList(route);
      },
      books(route){
        if(route.params[0]==='new') return bookForm(route);
        if(route.params[1]==='edit') return bookForm(route, findBook(route.params[0]));
        if(route.params[1]==='pages' && route.params[2]==='new') return pageEdit(route);
        if(route.params[1]==='chapters' && route.params[2]==='new') return chapterForm(route);
        return bookDetails(route);
      },
      pages(route){
        if(route.params[1]==='edit') return pageEdit(route);
        return pageRead(route);
      },
      chapters: chapterView,
      favorites: favoritesScreen
    },
    screen(route){
      const fn = this.screens[route.name] || this.screens.home;
      return fn.call(this, route);
    },
    actions: {
      login({form}){
        const u = (st().users||[]).find(x=>x.email===form.email && x.password===form.password);
        if(!u){ notify('Invalid email or password'); return; }
        st().session = u.id; save(); nav('#/');
      },
      logout(){ st().session = null; save(); nav('#/'); },
      'home-search'({el}){ st().homeSearch = el.value; save(); window.ARC.render(); },
      'cancel-nav'({el}){ nav(el.dataset.hash); },
      'new-shelf'(){ nav('#/shelves/new'); },
      'new-book'(){ nav('#/books/new'); },
      'new-book-for-shelf'({id}){ nav(`#/books/new?shelfId=${encodeURIComponent(id)}`); },
      'new-page'({id}){ nav(`#/books/${encodeURIComponent(id)}/pages/new`); },
      'new-chapter'({id}){ nav(`#/books/${encodeURIComponent(id)}/chapters/new`); },
      'edit-shelf'({id}){ nav(`#/shelves/${encodeURIComponent(id)}/edit`); },
      'edit-book'({id}){ nav(`#/books/${encodeURIComponent(id)}/edit`); },
      'edit-page'({id}){ nav(`#/pages/${encodeURIComponent(id)}/edit`); },
      'view-entity'({el}){
        const type = el.dataset.type, id = el.dataset.id;
        if(type==='shelf') nav(`#/shelves/${encodeURIComponent(id)}`);
        else if(type==='book') nav(`#/books/${encodeURIComponent(id)}`);
        else if(type==='page') nav(`#/pages/${encodeURIComponent(id)}`);
        else if(type==='chapter') nav(`#/chapters/${encodeURIComponent(id)}`);
      },
      'toggle-tags'({el}){
        const reveal = el.nextElementSibling;
        if(reveal && reveal.classList.contains('tags-reveal')) reveal.hidden = !reveal.hidden;
      },
      'create-shelf'({form}){
        const shelf = { id: uid('shelf'), name: form.name, description: form.description||'', tags: parseTags(form.tags), books: [] };
        st().shelves.push(shelf); save(); nav('#/shelves');
      },
      'save-shelf'({el,form}){
        const shelf = findShelf(el.dataset.id);
        shelf.name = form.name; shelf.description = form.description||''; shelf.tags = parseTags(form.tags);
        save(); nav(`#/shelves/${encodeURIComponent(shelf.id)}`);
      },
      'delete-shelf'({id}){
        const shelf = findShelf(id);
        openDialog(`<p>Are you sure you want to delete "${esc(shelf.name)}"?</p>
<button type="button" data-action="confirm-delete-shelf" data-id="${esc(id)}">Confirm Delete</button>
<button type="button" data-action="arc:close">Cancel</button>`, {title:'Confirm Delete'});
      },
      'confirm-delete-shelf'({id}){
        st().shelves = (st().shelves||[]).filter(s=>s.id!==id);
        (st().books||[]).forEach(b=>{ b.shelfIds = (b.shelfIds||[]).filter(sid=>sid!==id); });
        save(); closeDialog(); nav('#/shelves');
      },
      'create-book'({el,form}){
        const book = { id: uid('book'), name: form.name, description: form.description||'', tags: parseTags(form.tags), shelfIds: [], chapters: [], pages: [] };
        const shelfId = el.dataset.shelfId;
        if(shelfId){
          const shelf = findShelf(shelfId);
          if(shelf){ book.shelfIds.push(shelfId); (shelf.books=shelf.books||[]).push(book.id); }
        }
        st().books.push(book); save(); nav(`#/books/${encodeURIComponent(book.id)}`);
      },
      'save-book'({el,form}){
        const book = findBook(el.dataset.id);
        book.name = form.name; book.description = form.description||''; book.tags = parseTags(form.tags);
        save(); nav(`#/books/${encodeURIComponent(book.id)}`);
      },
      'delete-book'({id}){
        const book = findBook(id);
        openDialog(`<p>Are you sure you want to delete "${esc(book.name)}"?</p>
<button type="button" data-action="confirm-delete-book" data-id="${esc(id)}">Confirm Delete</button>
<button type="button" data-action="arc:close">Cancel</button>`, {title:'Confirm Delete'});
      },
      'confirm-delete-book'({id}){
        st().books = (st().books||[]).filter(b=>b.id!==id);
        (st().shelves||[]).forEach(s=>{ s.books = (s.books||[]).filter(bid=>bid!==id); });
        save(); closeDialog(); nav('#/books');
      },
      'save-page'({el,form}){
        const bookId = el.dataset.bookId;
        const isDraft = form.mode === 'draft';
        let page;
        if(el.dataset.id){
          page = findPage(el.dataset.id);
          page.title = form.title; page.content = form.content||''; page.draft = isDraft; page.updatedAt = now();
        } else {
          page = { id: uid('page'), bookId, chapterId: null, title: form.title, content: form.content||'', draft: isDraft, updatedAt: now() };
          st().pages.push(page);
          const book = findBook(bookId); if(book){ (book.pages=book.pages||[]).push(page.id); }
        }
        save();
        if(isDraft) nav('#/'); else nav(`#/books/${encodeURIComponent(bookId)}`);
      },
      'delete-draft'({id}){
        const page = findPage(id);
        openDialog(`<p>Are you sure you want to delete the draft "${esc(page.title)}"?</p>
<button type="button" data-action="confirm-delete-draft" data-id="${esc(id)}">Confirm Delete</button>
<button type="button" data-action="arc:close">Cancel</button>`, {title:'Confirm Delete'});
      },
      'confirm-delete-draft'({id}){
        const page = findPage(id);
        const bookId = page.bookId;
        st().pages = (st().pages||[]).filter(p=>p.id!==id);
        const book = findBook(bookId); if(book){ book.pages = (book.pages||[]).filter(pid=>pid!==id); }
        save(); closeDialog(); nav(`#/books/${encodeURIComponent(bookId)}`);
      },
      'create-chapter'({el,form}){
        const bookId = el.dataset.bookId;
        const chapter = { id: uid('chapter'), bookId, name: form.name, description: form.description||'', pages: [] };
        st().chapters.push(chapter);
        const book = findBook(bookId); if(book){ (book.chapters=book.chapters||[]).push(chapter.id); }
        save(); nav(`#/books/${encodeURIComponent(bookId)}`);
      },
      'toggle-favorite'({el}){
        const type = el.dataset.type, id = el.dataset.id;
        const arr = st().favorites = st().favorites || [];
        const idx = arr.findIndex(f=>f.type===type && f.id===id);
        if(idx>=0) arr.splice(idx,1); else arr.push({type,id});
        save(); window.ARC.render();
      }
    }
  };
})();
