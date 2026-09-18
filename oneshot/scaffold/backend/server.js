'use strict';
// Backend scaffold. Mechanics it satisfies: `npm run start` listens on PORT, serves ../frontend/dist
// with `/` -> index.html, answers GET /api/health with exactly {"code":200,"message":"Backend Ready"}
// only once the seed is in place, keeps shared data in memory, never lets a handler kill the process.
// Add domain routes inside `api()`; keep everything else.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

process.on('uncaughtException', (e) => console.error('uncaught', e));
process.on('unhandledRejection', (e) => console.error('unhandled', e));

const DIST = path.resolve(__dirname, '..', 'frontend', 'dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };

// Shared in-memory state. The frontend seeds itself from seed.js and writes through here; a fresh
// process starts from the frontend's seed again (reseed on startup).
let STATE = null;

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
  // Domain routes go here, e.g. if (url.pathname === '/api/items' && req.method === 'GET') ...
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
