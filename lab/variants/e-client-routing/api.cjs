const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const DOC_TYPES = ['居民身份证','护照','港澳居民来往内地通行证','台湾居民来往大陆通行证','外国人永久居留身份证'];
const DISCOUNT_TYPES = ['成人','儿童','学生','残疾军人','其他优惠类型'];

function loadDb() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { accounts: [], sessions: {} };
  }
}

function saveDb(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function respondJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function cookieHeader(token) {
  return 'session=' + token + '; Path=/; HttpOnly; SameSite=Lax';
}

function parseCookies(req) {
  const out = {};
  const header = req.headers.cookie;
  if (header) {
    header.split(';').forEach((p) => {
      const idx = p.indexOf('=');
      if (idx > -1) out[p.slice(0, idx).trim()] = p.slice(idx + 1).trim();
    });
  }
  return out;
}

function hashPassword(salt, password) {
  return crypto.createHash('sha256').update(salt + password).digest('hex');
}

function validateRegistration(p) {
  const username = (p.username || '').trim();
  if (!username) return '用户名不能为空';
  if (!/^[A-Za-z0-9_-]{3,32}$/.test(username)) return '用户名格式不正确，需3-32位字母、数字、连字符或下划线';

  const password = p.password || '';
  if (!password) return '登录密码不能为空';
  if (password.length < 12 || password.length > 128) return '登录密码需为12-128位';
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return '登录密码需包含大写字母、小写字母、数字和特殊字符';
  }
  if (p.confirmPassword !== password) return '确认密码必须与登录密码一致';

  if (!p.documentType || !DOC_TYPES.includes(p.documentType)) return '请选择有效的证件类型';
  if (!p.discountType || !DISCOUNT_TYPES.includes(p.discountType)) return '请选择有效的优惠（待）类型';

  const name = (p.name || '').trim();
  if (name.replace(/\s/g, '').length < 2 || name.length > 100) return '姓名需为2-100个非空白字符';

  const docNum = (p.documentNumber || '').trim();
  if (!docNum) return '证件号码不能为空';
  if (!/^[A-Za-z0-9-]{6,30}$/.test(docNum)) return '证件号码格式不正确';

  const email = (p.email || '').trim();
  if (email) {
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '邮箱格式不正确';
  }

  if (!p.countryCode) return '请选择国家/地区代码';
  const mobile = (p.mobileNumber || '').trim();
  if (!mobile) return '手机号不能为空';
  if (!/^[0-9]{6,15}$/.test(mobile)) return '手机号格式不正确';

  if (p.agreeTerms !== 'on' && p.agreeTerms !== true) return '请先同意服务条款和隐私政策';
  return null;
}

module.exports = async function (req, res) {
  const url = (req.url || '').split('?')[0];
  if (!url.startsWith('/api/')) return false;

  try {
    if (url === '/api/session' && req.method === 'GET') {
      const cookies = parseCookies(req);
      const db = loadDb();
      const token = cookies.session;
      const username = token && db.sessions[token];
      respondJson(res, 200, username ? { ok: true, username } : { ok: false, username: null });
      return true;
    }

    if (url === '/api/register' && req.method === 'POST') {
      const body = await readBody(req);
      let payload = {};
      try { payload = JSON.parse(body); } catch (e) { payload = {}; }

      const error = validateRegistration(payload);
      if (error) {
        respondJson(res, 400, { error });
        return true;
      }

      const db = loadDb();
      const username = payload.username.trim();
      const email = (payload.email || '').trim();
      if (db.accounts.some((a) => a.username === username)) {
        respondJson(res, 400, { error: '用户名已存在' });
        return true;
      }
      if (email && db.accounts.some((a) => (a.email || '').toLowerCase() === email.toLowerCase())) {
        respondJson(res, 400, { error: '邮箱已存在' });
        return true;
      }

      const salt = crypto.randomBytes(16).toString('hex');
      const account = {
        id: 'acc_' + crypto.randomBytes(8).toString('hex'),
        username,
        email,
        name: payload.name.trim(),
        documentType: payload.documentType,
        documentNumber: payload.documentNumber,
        discountType: payload.discountType,
        countryCode: payload.countryCode,
        mobileNumber: payload.mobileNumber,
        salt,
        passwordHash: hashPassword(salt, payload.password),
      };
      db.accounts.push(account);

      const token = crypto.randomBytes(32).toString('hex');
      db.sessions[token] = username;
      saveDb(db);
      res.setHeader('Set-Cookie', cookieHeader(token));
      respondJson(res, 200, { ok: true, username });
      return true;
    }

    if (url === '/api/login' && req.method === 'POST') {
      const body = await readBody(req);
      let payload = {};
      try { payload = JSON.parse(body); } catch (e) { payload = {}; }

      const identifier = (payload.identifier || '').trim();
      const password = payload.password || '';
      const db = loadDb();
      const account = db.accounts.find((a) =>
        a.username === identifier || ((a.email || '').toLowerCase() === identifier.toLowerCase())
      );

      let ok = false;
      if (account && password) {
        if (hashPassword(account.salt, password) === account.passwordHash) ok = true;
      }

      if (ok) {
        const token = crypto.randomBytes(32).toString('hex');
        db.sessions[token] = account.username;
        saveDb(db);
        res.setHeader('Set-Cookie', cookieHeader(token));
        respondJson(res, 200, { ok: true, username: account.username });
      } else {
        respondJson(res, 401, { error: '无效凭据' });
      }
      return true;
    }

    if (url === '/api/logout' && req.method === 'POST') {
      const cookies = parseCookies(req);
      const token = cookies.session;
      if (token) {
        const db = loadDb();
        delete db.sessions[token];
        saveDb(db);
      }
      res.setHeader('Set-Cookie', 'session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
      respondJson(res, 200, { ok: true });
      return true;
    }

    respondJson(res, 404, { error: 'not found' });
    return true;
  } catch (e) {
    respondJson(res, 500, { error: '服务器错误' });
    return true;
  }
};
