'use strict';
// Backend scaffold. Mechanics it satisfies: `npm run start` listens on PORT, serves ../frontend/dist
// with `/` -> index.html, answers GET /api/health with exactly {"code":200,"message":"Backend Ready"}
// only once the seed is in place, keeps the shared records in memory, never lets a handler kill the process.
// Add domain routes inside `api()`; keep everything else.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

process.on('uncaughtException', (e) => console.error('uncaught', e));
process.on('unhandledRejection', (e) => console.error('unhandled', e));

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
// Browser credentials are separate from the shared application document. The
// cookie token never appears in the sessions page or the shared state response.
const SESSIONS = new Map();
function sessionFor(req) {
  const token = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('archub_session='));
  const session = token && SESSIONS.get(token.slice('archub_session='.length));
  if (!session || !session.active) return null;
  session.lastActive = new Date().toISOString();
  return session;
}
function deviceLabel(req) {
  const agent = req.headers['user-agent'] || '';
  const browser = /Firefox/.test(agent) ? 'Firefox' : /Chrome|Chromium/.test(agent) ? 'Chrome' : /Safari/.test(agent) ? 'Safari' : 'Browser';
  const os = /Windows/.test(agent) ? 'Windows' : /Android/.test(agent) ? 'Android' : /Mac/.test(agent) ? 'macOS' : /Linux/.test(agent) ? 'Linux' : 'this device';
  return browser + ' on ' + os;
}

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
  if (url.pathname === '/api/session') {
    if (req.method === 'POST') {
      const body = await readBody(req) || {};
      const login = String(body.login || '').trim();
      const user = (STATE.users || []).find(u => login.includes('@') ? u.email.toLowerCase() === login.toLowerCase() : u.name === login);
      if (!user || user.password !== body.password || user.available === false || user.disabled) return json(res, 401, { error: 'Invalid credentials' });
      const previous = sessionFor(req);
      if (previous) previous.active = false;
      const token = crypto.randomBytes(32).toString('hex');
      const session = { id: crypto.randomUUID(), userId: user.id, device: deviceLabel(req), lastActive: new Date().toISOString(), active: true };
      SESSIONS.set(token, session);
      res.setHeader('Set-Cookie', 'archub_session=' + token + '; HttpOnly; SameSite=Lax; Path=/');
      return json(res, 200, { userId: user.id });
    }
    const session = sessionFor(req);
    if (req.method === 'DELETE') {
      if (session) session.active = false;
      res.setHeader('Set-Cookie', 'archub_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
      return json(res, 200, { ok: true });
    }
    return session ? json(res, 200, { userId: session.userId }) : json(res, 401, { error: 'Sign in required' });
  }
  if (url.pathname === '/api/sessions' || url.pathname.startsWith('/api/sessions/')) {
    const current = sessionFor(req);
    if (!current) return json(res, 401, { error: 'Sign in required' });
    if (req.method === 'DELETE') {
      const target = [...SESSIONS.values()].find(s => s.id === url.pathname.split('/').pop() && s.userId === current.userId);
      if (!target || target === current) return json(res, 400, { error: 'Cannot revoke this session' });
      target.active = false;
      return json(res, 200, { ok: true });
    }
    return json(res, 200, [...SESSIONS.values()].filter(s => s.active && s.userId === current.userId).map(s => ({ id:s.id, device:s.device, lastActive:s.lastActive, current:s === current })));
  }
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
