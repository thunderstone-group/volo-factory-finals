'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

process.on('uncaughtException', (e) => console.error('uncaught', e));
process.on('unhandledRejection', (e) => console.error('unhandled', e));

const DIST = path.resolve(__dirname, '..', 'frontend', 'dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };

const SEED = {
  session: null,
  users: [{ id: 'u1', name: 'BookStack User', email: 'bookstack_user@example.com', password: 'Password123!' }],
  shelves: [
    { id: 'shelf_4_1', name: 'Shelf 4.1', description: 'Seeded shelf for REQ-4.1', tags: ['seed'], books: [] },
    { id: 'shelf_4_2_1', name: 'Shelf 4.2.1', description: 'Seeded shelf for REQ-4.2.1', tags: ['seed'], books: [] },
    { id: 'shelf_4_3_1', name: 'Shelf 4.3.1', description: 'Seeded shelf for REQ-4.3.1', tags: [], books: [] },
    { id: 'shelf_4_3_2', name: 'Shelf 4.3.2', description: 'Seeded shelf for REQ-4.3.2', tags: [], books: [] },
    { id: 'shelf_4_4_1', name: 'Shelf 4.4.1', description: 'Seeded deletable shelf for REQ-4.4.1', tags: [], books: [] },
    { id: 'shelf_4_4_2', name: 'Shelf 4.4.2', description: 'Seeded deletable shelf for REQ-4.4.2', tags: [], books: [] },
    { id: 'shelf_4_5_1', name: 'Shelf 4.5.1', description: 'Initial description for Shelf 4.5.1', tags: ['edit', 'shelf'], books: [] },
    { id: 'shelf_4_5_2', name: 'Shelf 4.5.2', description: 'Initial description for Shelf 4.5.2', tags: ['edit', 'shelf'], books: [] },
    { id: 'shelf_5_2_2', name: 'Shelf 5.2.2', description: 'Seeded shelf containing Book 5.2.2', tags: [], books: ['book_5_2_2'] },
    { id: 'shelf_5_6_1', name: 'Shelf 5.6.1', description: 'Seeded shelf for REQ-5.6.1', tags: [], books: [] },
    { id: 'shelf_7_1', name: 'Shelf 7.1', description: 'Seeded shelf for REQ-7.1', tags: [], books: [] },
    { id: 'shelf_7_2', name: 'Shelf 7.2', description: 'Seeded shelf for REQ-7.2', tags: [], books: [] }
  ],
  books: [
    { id: 'book_5_1', name: 'Book 5.1', description: 'Seeded book for REQ-5.1', tags: ['seed'], shelfIds: [], chapters: [], pages: [] },
    { id: 'book_5_2_1', name: 'Book 5.2.1', description: 'Seeded book for REQ-5.2.1', tags: [], shelfIds: [], chapters: [], pages: [] },
    { id: 'book_5_2_2', name: 'Book 5.2.2', description: 'Seeded book for REQ-5.2.2', tags: [], shelfIds: ['shelf_5_2_2'], chapters: [], pages: [] },
    { id: 'book_5_4_1', name: 'Book 5.4.1', description: 'Initial description for Book 5.4.1', tags: ['edit', 'book'], shelfIds: [], chapters: [], pages: [] },
    { id: 'book_5_4_2', name: 'Book 5.4.2', description: 'Initial description for Book 5.4.2', tags: ['edit', 'book'], shelfIds: [], chapters: [], pages: [] },
    { id: 'book_5_5_1', name: 'Book 5.5.1', description: 'Seeded deletable book for REQ-5.5.1', tags: [], shelfIds: [], chapters: [], pages: [] },
    { id: 'book_5_5_2', name: 'Book 5.5.2', description: 'Seeded deletable book for REQ-5.5.2', tags: [], shelfIds: [], chapters: [], pages: [] },
    { id: 'book_6_1_1', name: 'Book 6.1.1', description: 'Seeded book for REQ-6.1.1', tags: [], shelfIds: [], chapters: [], pages: [] },
    { id: 'book_6_1_2', name: 'Book 6.1.2', description: 'Seeded book for REQ-6.1.2', tags: [], shelfIds: [], chapters: [], pages: [] },
    { id: 'book_6_1_3', name: 'Book 6.1.3', description: 'Seeded book with draft for REQ-6.1.3', tags: [], shelfIds: [], chapters: [], pages: ['page_draft_6_1_3'] },
    { id: 'book_6_2_1', name: 'Book 6.2.1', description: 'Seeded book for REQ-6.2.1', tags: [], shelfIds: [], chapters: [], pages: [] },
    { id: 'book_6_3_1', name: 'Book 6.3.1', description: 'Seeded book for REQ-6.3.1', tags: [], shelfIds: [], chapters: [], pages: ['page_6_3_1'] },
    { id: 'book_6_3_2', name: 'Book 6.3.2', description: 'Seeded book for REQ-6.3.2', tags: [], shelfIds: [], chapters: [], pages: ['page_6_3_2'] },
    { id: 'book_8_1', name: 'Book 8.1', description: 'Seeded book for REQ-8.1', tags: [], shelfIds: [], chapters: [], pages: [] },
    { id: 'book_8_2', name: 'Book 8.2', description: 'Seeded book for REQ-8.2', tags: [], shelfIds: [], chapters: [], pages: [] },
    { id: 'book_9_1', name: 'Book 9.1', description: 'Seeded book for REQ-9.1', tags: [], shelfIds: [], chapters: [], pages: ['page_9_1'] }
  ],
  pages: [
    { id: 'page_6_3_1', bookId: 'book_6_3_1', chapterId: null, title: 'Page 6.3.1', content: 'Content for Page 6.3.1 in Book 6.3.1.', draft: false, updatedAt: Date.now() },
    { id: 'page_6_3_2', bookId: 'book_6_3_2', chapterId: null, title: 'Page 6.3.2', content: 'Content for Page 6.3.2 in Book 6.3.2.', draft: false, updatedAt: Date.now() },
    { id: 'page_draft_6_1_3', bookId: 'book_6_1_3', chapterId: null, title: 'Draft 6.1.3', content: 'Seeded draft content for REQ-6.1.3.', draft: true, updatedAt: Date.now() },
    { id: 'page_9_1', bookId: 'book_9_1', chapterId: null, title: 'Page 9.1', content: 'Seeded page content for Book 9.1.', draft: false, updatedAt: Date.now() }
  ],
  chapters: [],
  favorites: [],
  recentlyViewed: []
};

let STATE = JSON.parse(JSON.stringify(SEED));

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => { chunks.push(c); if (chunks.reduce((n, b) => n + b.length, 0) > 8e6) req.destroy(); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : null); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

async function api(req, res, url) {
  if (url.pathname === '/api/health') return json(res, 200, { code: 200, message: 'Backend Ready' });
  if (url.pathname === '/api/state') {
    if (req.method === 'GET') return json(res, 200, STATE || {});
    if (req.method === 'PUT') { STATE = await readBody(req); return json(res, 200, { ok: true }); }
  }
  return json(res, 404, { error: 'not found' });
}

function serveStatic(res, pathname) {
  let file = path.normalize(path.join(DIST, decodeURIComponent(pathname)));
  if (!file.startsWith(DIST)) return json(res, 403, { error: 'forbidden' });
  if (pathname === '/' || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  fs.createReadStream(file).on('error', () => { res.end(); }).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    return serveStatic(res, url.pathname);
  } catch (e) {
    console.error('handler', e);
    if (!res.headersSent) json(res, 500, { error: 'internal' }); else res.end();
  }
});
server.listen(Number(process.env.PORT) || 3000, () => console.log('listening', server.address().port));
