'use strict';
// Backend scaffold. Mechanics it satisfies: `npm run start` listens on PORT, serves ../frontend/dist
// with `/` -> index.html, answers GET /api/health with exactly {"code":200,"message":"Backend Ready"}
// only once the seed is in place, keeps the shared records in memory, never lets a handler kill the process.
// Extend or adapt the routes to the required behavior; the request boundary below handles expected failures.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const DIST = path.resolve(__dirname, '..', 'frontend', 'dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };

// The shared records every browser session reads (GET /api/state) and writes (PUT /api/state). A fresh
// process starts from the frontend's seed.js; `session` and `ui` belong to each browser, never here.
function loadSeed() {
  for (const file of [path.join(DIST, 'seed.js'), path.resolve(__dirname, '..', 'frontend', 'public', 'seed.js')]) {
    try {
      const sandbox = { window: {} };
      vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { timeout: 2000 });
      const seed = sandbox.window.SEED;
      if (seed && typeof seed === 'object' && !Array.isArray(seed)) {
        const shared = JSON.parse(JSON.stringify(seed));
        delete shared.session; delete shared.ui;
        return shared;
      }
    } catch (e) { console.error('seed', file, e.message); }
  }
  return null;
}
let STATE = loadSeed();

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
    if (req.method === 'PUT') {
      const body = await readBody(req);
      if (!body || typeof body !== 'object' || Array.isArray(body)) return json(res, 400, { error: 'state must be an object' });
      STATE = body;
      return json(res, 200, { ok: true });
    }
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
