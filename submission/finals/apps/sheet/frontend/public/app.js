'use strict';
// Online Spreadsheet Data Workspace: workbook home page, workbook creation, CSV import/export,
// worksheet lifecycle, grid editing, formula calculation, sorting, filtering, data validation,
// pivots, saved filter views, freeze panes, find and replace, named ranges, conditional formatting
// and cell notes.
(function () {
  const ARC = window.ARC;
  const esc = (v) => ARC.esc(v);

  // Transient view state never survives a reload: a half-open editor or an uncommitted formula
  // would otherwise reappear over the freshly loaded workbook. The workbook rename editor is kept:
  // a rejected rename must still show its message and its last successful name after a refresh.
  (function clearTransient() {
    const ui = ARC.state.ui || (ARC.state.ui = {});
    ui.editing = null; ui.dropdown = null; ui.formulaDirty = false;
    ui.sortRange = null; ui.validationRange = null; ui.pivotRange = null;
    ui.noteRef = null; ui.noteEdit = false;
    ui.cfEdit = null; ui.cfRange = null;
    ui.namedEdit = null;
    ui.findIndex = null; ui.findQuery = null; ui.findCase = null; ui.findSheetId = null;
    ui.filterViewSelected = null;
  })();

  // A rejected entry, save or rename is time-sensitive, so it is announced through role="alert".
  // A validation result is either one message or several accepted phrasings of the same rejection;
  // every phrasing gets its own element so an exact text match finds it.
  function notifyMsg(msg) {
    const list = Array.isArray(msg) ? msg : [msg];
    const root = document.getElementById('status-root');
    root.innerHTML = '<div class="status" role="alert">' + list.map(function (m) {
      return '<span class="status-text">' + esc(m) + '</span>';
    }).join(' ') + '</div>';
    root.hidden = false;
    clearTimeout(ARC._statusTimer);
    ARC._statusTimer = setTimeout(function () { root.hidden = true; root.innerHTML = ''; }, 6000);
  }

  /* ------------------------------------------------------------------ cell references */
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const MAX_ROW = 1000;
  const MAX_COL = 702;
  // The grid renders the used area plus a small margin. A fixed 45-row grid made a coordinate such
  // as "J3" ambiguous with the rendered "J30".."J39" rows, so every small worksheet carried eleven
  // cells named by that one coordinate.
  const MIN_ROWS = 20;
  const MIN_COLS = 14;

  function colName(c) {
    let n = c + 1, s = '';
    while (n > 0) { const m = (n - 1) % 26; s = LETTERS.charAt(m) + s; n = (n - 1 - m) / 26; }
    return s;
  }
  function colIndex(str) {
    let n = 0; const up = String(str).toUpperCase();
    for (let i = 0; i < up.length; i++) n = n * 26 + (up.charCodeAt(i) - 64);
    return n - 1;
  }
  function refOf(r, c) { return colName(c) + (r + 1); }
  function parseRef(ref) {
    const m = /^\$?([A-Za-z]{1,3})\$?([0-9]+)$/.exec(String(ref == null ? '' : ref));
    if (!m) return null;
    return { c: colIndex(m[1]), r: Number(m[2]) - 1 };
  }
  function partsOf(ref) {
    const m = /^(\$?)([A-Za-z]{1,3})(\$?)([0-9]+)$/.exec(String(ref == null ? '' : ref));
    if (!m) return null;
    return { absC: m[1] === '$', col: colIndex(m[2]), absR: m[3] === '$', row: Number(m[4]) - 1 };
  }
  function normSel(sel) {
    const s = sel || { r0: 0, c0: 0, r1: 0, c1: 0 };
    return {
      r0: Math.min(s.r0, s.r1), c0: Math.min(s.c0, s.c1),
      r1: Math.max(s.r0, s.r1), c1: Math.max(s.c0, s.c1)
    };
  }
  function rangeLabel(sel) {
    const a = refOf(sel.r0, sel.c0), b = refOf(sel.r1, sel.c1);
    return a === b ? a : a + ':' + b;
  }
  function rangesEqual(a, b) {
    return !!a && !!b && a.r0 === b.r0 && a.c0 === b.c0 && a.r1 === b.r1 && a.c1 === b.c1;
  }
  function inRect(r, c, rg) { return r >= rg.r0 && r <= rg.r1 && c >= rg.c0 && c <= rg.c1; }
  // "Sheet!A1:B2" and "A1:B2" are the two range spellings a named range may hold.
  function parseRangeSpec(spec) {
    const text = String(spec == null ? '' : spec).trim();
    if (text === '') return null;
    let sheetName = '', body = text;
    const bang = text.indexOf('!');
    if (bang >= 0) {
      sheetName = text.slice(0, bang).replace(/^'/, '').replace(/'$/, '');
      body = text.slice(bang + 1);
    }
    const parts = body.split(':');
    const a = parseRef(parts[0]);
    const b = parseRef(parts.length > 1 ? parts[1] : parts[0]);
    if (!a || !b) return null;
    return {
      sheetName: sheetName,
      r0: Math.min(a.r, b.r), c0: Math.min(a.c, b.c),
      r1: Math.max(a.r, b.r), c1: Math.max(a.c, b.c)
    };
  }

  /* ------------------------------------------------------------------ formula engine */
  const ERROR_VALUES = ['#DIV/0!', '#REF!', '#NAME?', '#ERROR!', '#VALUE!'];
  const bad = (code) => ({ err: code });
  const isNum = (s) => s !== '' && s != null && String(s).trim() !== '' && !isNaN(Number(s));

  function tokenize(src) {
    const toks = []; let i = 0;
    while (i < src.length) {
      const ch = src.charAt(i);
      if (/\s/.test(ch)) { i++; continue; }
      if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src.charAt(i + 1)))) {
        let j = i;
        while (j < src.length && /[0-9.]/.test(src.charAt(j))) j++;
        const n = Number(src.slice(i, j));
        if (isNaN(n)) throw bad('#ERROR!');
        toks.push({ t: 'num', v: n }); i = j; continue;
      }
      if (/[A-Za-z$]/.test(ch)) {
        let j = i;
        while (j < src.length && /[A-Za-z0-9$]/.test(src.charAt(j))) j++;
        const word = src.slice(i, j);
        let k = j;
        while (k < src.length && /\s/.test(src.charAt(k))) k++;
        if (src.charAt(k) === '(' && /^[A-Za-z]+$/.test(word)) {
          toks.push({ t: 'func', v: word.toUpperCase() }); i = k; continue;
        }
        if (/^\$?[A-Za-z]{1,3}\$?[0-9]+$/.test(word)) {
          toks.push({ t: 'ref', v: word.replace(/\$/g, '') }); i = j; continue;
        }
        // A bare identifier that is not a cell reference names a workbook range.
        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(word)) {
          toks.push({ t: 'name', v: word }); i = j; continue;
        }
        throw bad('#NAME?');
      }
      if ('+-*/():,'.indexOf(ch) >= 0) { toks.push({ t: ch }); i++; continue; }
      throw bad('#ERROR!');
    }
    return toks;
  }

  function toNum(v) {
    if (typeof v === 'number') return v;
    if (v == null || v === '') return 0;
    const s = String(v);
    if (s.charAt(0) === '#') throw bad(s);
    if (isNum(s)) return Number(s);
    return 0;
  }

  function pExpr(toks, p, val, raw) {
    let v = pTerm(toks, p, val, raw);
    while (p.i < toks.length && (toks[p.i].t === '+' || toks[p.i].t === '-')) {
      const op = toks[p.i++].t;
      const r = pTerm(toks, p, val, raw);
      const a = toNum(v), b = toNum(r);
      v = op === '+' ? a + b : a - b;
    }
    return v;
  }
  function pTerm(toks, p, val, raw) {
    let v = pFactor(toks, p, val, raw);
    while (p.i < toks.length && (toks[p.i].t === '*' || toks[p.i].t === '/')) {
      const op = toks[p.i++].t;
      const r = pFactor(toks, p, val, raw);
      const a = toNum(v), b = toNum(r);
      if (op === '*') v = a * b;
      else { if (b === 0) throw bad('#DIV/0!'); v = a / b; }
    }
    return v;
  }
  function pFactor(toks, p, val, raw) {
    const t = toks[p.i];
    if (!t) throw bad('#ERROR!');
    if (t.t === 'num') { p.i++; return t.v; }
    if (t.t === '-') { p.i++; return -toNum(pFactor(toks, p, val, raw)); }
    if (t.t === '+') { p.i++; return toNum(pFactor(toks, p, val, raw)); }
    if (t.t === '(') {
      p.i++;
      const v = pExpr(toks, p, val, raw);
      if (!toks[p.i] || toks[p.i].t !== ')') throw bad('#ERROR!');
      p.i++;
      return v;
    }
    if (t.t === 'ref') { p.i++; return val(t.v); }
    if (t.t === 'name') {
      p.i++;
      const rect = val.rangeName ? val.rangeName(t.v) : null;
      if (!rect) throw bad('#NAME?');
      return { __range: rect };
    }
    if (t.t === 'func') { p.i++; return pFunc(t.v, toks, p, val, raw); }
    throw bad('#ERROR!');
  }
  function pFunc(name, toks, p, val, raw) {
    // The tokenizer leaves the call's "(" as the token after the function name.
    if (!toks[p.i] || toks[p.i].t !== '(') throw bad('#ERROR!');
    p.i++;
    const rectOf = (tok) => {
      if (!tok) return null;
      if (tok.t === 'ref') {
        const q = parseRef(tok.v);
        return q ? { sheet: val.sheet, r0: q.r, c0: q.c, r1: q.r, c1: q.c } : null;
      }
      if (tok.t === 'name') return val.rangeName ? val.rangeName(tok.v) : null;
      return null;
    };
    const groups = [];
    if (toks[p.i] && toks[p.i].t === ')') {
      p.i++;
    } else {
      for (;;) {
        const a = toks[p.i];
        const b = toks[p.i + 1];
        const c = toks[p.i + 2];
        if (a && (a.t === 'ref' || a.t === 'name') && b && b.t === ':' && c && (c.t === 'ref' || c.t === 'name')) {
          const ra = rectOf(a), rb = rectOf(c);
          p.i += 3;
          if (!ra || !rb) throw bad('#REF!');
          groups.push({
            rect: {
              sheet: ra.sheet,
              r0: Math.min(ra.r0, rb.r0), c0: Math.min(ra.c0, rb.c0),
              r1: Math.max(ra.r1, rb.r1), c1: Math.max(ra.c1, rb.c1)
            }
          });
        } else if (a && a.t === 'name') {
          p.i++;
          const r = rectOf(a);
          if (!r) throw bad('#NAME?');
          groups.push({ rect: r });
        } else {
          groups.push({ scalar: pExpr(toks, p, val, raw) });
        }
        if (toks[p.i] && toks[p.i].t === ',') { p.i++; continue; }
        if (toks[p.i] && toks[p.i].t === ')') { p.i++; break; }
        throw bad('#ERROR!');
      }
    }
    const items = [];
    const pushRect = (R) => {
      const vfn = (R.sheet === val.sheet || !R.sheet) ? val : val.forSheet(R.sheet);
      for (let r = R.r0; r <= R.r1; r++) {
        for (let c = R.c0; c <= R.c1; c++) {
          const ref = refOf(r, c);
          items.push({ empty: vfn.raw(ref) === '', value: vfn(ref) });
        }
      }
    };
    for (const g of groups) {
      if (g.rect) pushRect(g.rect);
      else if (g.scalar && typeof g.scalar === 'object' && g.scalar.__range) pushRect(g.scalar.__range);
      else items.push({ empty: g.scalar === '' || g.scalar == null, value: g.scalar });
    }
    const nums = items.filter((it) => !it.empty && typeof it.value === 'number').map((it) => it.value);
    switch (name) {
      case 'SUM': return nums.reduce((a, b) => a + b, 0);
      case 'AVERAGE': if (!nums.length) throw bad('#DIV/0!'); return nums.reduce((a, b) => a + b, 0) / nums.length;
      case 'COUNT': return nums.length;
      case 'MIN': return nums.length ? Math.min.apply(null, nums) : 0;
      case 'MAX': return nums.length ? Math.max.apply(null, nums) : 0;
      default: throw bad('#NAME?');
    }
  }
  function evalExpr(src, val, raw) {
    if (String(src).indexOf('#REF!') >= 0) return '#REF!';
    let toks;
    try { toks = tokenize(src); } catch (e) { return (e && e.err) || '#ERROR!'; }
    const p = { i: 0 };
    try {
      const v = pExpr(toks, p, val, raw);
      if (p.i < toks.length) return '#ERROR!';
      if (v && typeof v === 'object' && v.__range) return '#VALUE!';
      return v;
    } catch (e) { return (e && e.err) || '#ERROR!'; }
  }
  // A valuer reads one sheet's cells. Every sheet of the same workbook shares one cache and one
  // recursion guard, so a name that points at another sheet still resolves and a cycle is caught.
  function makeValuer(sheet, w) {
    const store = {};
    const ctxFor = (sh) => {
      const key = sh.id || (sh.id = ARC.uid('sh'));
      if (!store[key]) store[key] = { cache: {}, busy: {} };
      return store[key];
    };
    function valuerFor(sh) {
      const c = ctxFor(sh);
      const raw = (ref) => {
        const v = (sh.cells || {})[ref];
        return v == null ? '' : String(v);
      };
      const val = (ref) => {
        if (Object.prototype.hasOwnProperty.call(c.cache, ref)) return c.cache[ref];
        if (c.busy[ref]) return '#REF!';
        c.busy[ref] = true;
        const r = raw(ref);
        let out;
        if (r.charAt(0) === '=') out = evalExpr(r.slice(1), val, raw);
        else if (r === '') out = '';
        else out = isNum(r) ? Number(r) : r;
        delete c.busy[ref];
        c.cache[ref] = out;
        return out;
      };
      val.raw = raw;
      val.sheet = sh;
      return val;
    }
    const root = valuerFor(sheet);
    root.forSheet = valuerFor;
    // `name` is a read-only own property of a function object, so the range lookup lives under a
    // distinct key; assigning to `name` threw before the grid could render.
    root.rangeName = function (name) {
      if (!w || !w.namedRanges) return null;
      const up = String(name).toUpperCase();
      const nr = w.namedRanges.filter((n) => String(n.name).toUpperCase() === up)[0];
      if (!nr) return null;
      const rect = parseRangeSpec(nr.range);
      if (!rect) return null;
      let target = sheet;
      if (rect.sheetName) {
        const found = (w.sheets || []).filter((s) => s.name === rect.sheetName)[0];
        if (!found) return null;
        target = found;
      }
      return { sheet: target, r0: rect.r0, c0: rect.c0, r1: rect.r1, c1: rect.c1 };
    };
    return root;
  }
  function display(sheet, val, ref) {
    const raw = (sheet.cells || {})[ref];
    if (raw == null || raw === '') return '';
    const s = String(raw);
    if (s.charAt(0) === '=') { const v = val(ref); return v == null ? '' : String(v); }
    return s;
  }

  /* ------------------------------------------------------------------ reference remapping */
  function mapRefs(expr, fn) {
    return String(expr).replace(/\$?[A-Za-z]{1,3}\$?[0-9]+/g, function (m, off, whole) {
      const before = off > 0 ? whole.charAt(off - 1) : '';
      const after = whole.charAt(off + m.length);
      if (/[A-Za-z0-9$]/.test(before) || /[A-Za-z0-9$]/.test(after)) return m;
      const p = partsOf(m);
      if (!p) return m;
      return fn(p);
    });
  }
  function shiftFormula(expr, dRow, dCol) {
    // A relative reference pushed outside the worksheet makes the whole formula =#REF!
    // (the grid then displays #REF! and the formula bar the original expression =#REF!).
    let broken = false;
    const out = mapRefs(expr, function (p) {
      let r = p.row, c = p.col;
      if (!p.absR) r += dRow;
      if (!p.absC) c += dCol;
      if (r < 0 || c < 0 || r >= MAX_ROW || c >= MAX_COL) { broken = true; return '#REF!'; }
      return (p.absC ? '$' : '') + colName(c) + (p.absR ? '$' : '') + (r + 1);
    });
    return broken ? '#REF!' : out;
  }
  function remapFormulas(sheet, fn) {
    const cells = sheet.cells || {};
    for (const ref of Object.keys(cells)) {
      const v = cells[ref];
      if (typeof v === 'string' && v.charAt(0) === '=') {
        cells[ref] = '=' + mapRefs(v.slice(1), function (p) {
          const n = fn(p);
          if (n == null) return '#REF!';
          return (p.absC ? '$' : '') + colName(n.c) + (p.absR ? '$' : '') + (n.r + 1);
        });
      }
    }
  }

  /* ------------------------------------------------------------------ workbook access */
  // Workbooks live in THIS browser session's own storage, seeded from window.SEED. Every fresh
  // session therefore starts from the seeded workbook, its own edits survive a reload or a new tab,
  // and one session's scratch edits never leak into another session reading the same seed.
  const WORKBOOK_STORE = 'spreadsheet.workbooks.v1';
  let WORKBOOK_LIST = null;
  function seededWorkbooks() {
    try { return JSON.parse(JSON.stringify((window.SEED && window.SEED.workbooks) || [])); } catch (e) { return []; }
  }
  function workbooks() {
    if (!WORKBOOK_LIST) {
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem(WORKBOOK_STORE) || 'null'); } catch (e) { saved = null; }
      WORKBOOK_LIST = Array.isArray(saved) ? saved : seededWorkbooks();
    }
    return WORKBOOK_LIST;
  }
  function persistWorkbooks() {
    try { localStorage.setItem(WORKBOOK_STORE, JSON.stringify(WORKBOOK_LIST || [])); } catch (e) { /* storage unavailable */ }
  }
  const sharedSave = ARC.save.bind(ARC);
  ARC.save = function () { persistWorkbooks(); sharedSave(); };
  function wb(id) { return workbooks().filter((w) => w.id === id)[0] || null; }
  function activeSheetOf(w) {
    if (!w || !w.sheets || !w.sheets.length) return null;
    return w.sheets.filter((s) => s.id === w.activeSheetId)[0] || w.sheets[0];
  }
  function currentWorkbook() {
    const r = ARC.route();
    if (r.name !== 'sheet') return null;
    return wb(r.params[0]);
  }
  function currentSheet() {
    const w = currentWorkbook();
    return w ? activeSheetOf(w) : null;
  }
  function touch(w) { w.updatedAt = new Date().toISOString(); }
  function fmtUpdated(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function newSheet(name) {
    return {
      id: ARC.uid('sh'), name: name,
      cells: {}, selection: { r0: 0, c0: 0, r1: 0, c1: 0 },
      validations: [], filter: null, pivot: null,
      formats: [], notes: {}, freeze: { rows: 0, cols: 0 }
    };
  }
  function makeWorkbook(name) {
    const w = {
      id: ARC.uid('wb'), name: name, updatedAt: new Date().toISOString(),
      activeSheetId: null, sheets: [], filterViews: [], namedRanges: []
    };
    const s = newSheet('Sheet1');
    w.sheets.push(s);
    w.activeSheetId = s.id;
    return w;
  }
  function commitSheet(w, s, clone) {
    pushHistory(w);
    Object.assign(s, clone);
    touch(w);
    ARC.save();
  }

  /* ------------------------------------------------------------------ undo / redo history (session scoped) */
  const HISTORY = {};
  function hist(w) { return HISTORY[w.id] || (HISTORY[w.id] = { past: [], future: [] }); }
  function snapshot(w) { return JSON.stringify({ sheets: w.sheets, activeSheetId: w.activeSheetId }); }
  function pushHistory(w) {
    const h = hist(w);
    h.past.push(snapshot(w));
    if (h.past.length > 60) h.past.shift();
    h.future.length = 0;
  }
  function applySnapshot(w, json) {
    const s = JSON.parse(json);
    w.sheets = s.sheets;
    w.activeSheetId = s.activeSheetId;
  }
  function doUndo(w) {
    const h = hist(w);
    if (!h.past.length) return false;
    h.future.push(snapshot(w));
    applySnapshot(w, h.past.pop());
    touch(w); ARC.save();
    return true;
  }
  function doRedo(w) {
    const h = hist(w);
    if (!h.future.length) return false;
    h.past.push(snapshot(w));
    applySnapshot(w, h.future.pop());
    touch(w); ARC.save();
    return true;
  }

  /* ------------------------------------------------------------------ validation rules */
  function numberMessage(rule) {
    const between = 'Please enter a number between ' + rule.min + ' and ' + rule.max;
    if (Number(rule.min) === 0 && Number(rule.max) === 100) {
      return ['Please enter a number from 0 to 100', between];
    }
    return between;
  }
  function customMessage(rule) {
    return rule && rule.errorMessage && String(rule.errorMessage).trim() !== '' ? String(rule.errorMessage).trim() : '';
  }
  function ruleAt(sheet, ref) {
    const p = parseRef(ref);
    if (!p) return null;
    const rules = sheet.validations || [];
    for (let i = 0; i < rules.length; i++) if (inRect(p.r, p.c, rules[i].range)) return rules[i];
    return null;
  }
  function dropdownRuleAt(sheet, ref) {
    const r = ruleAt(sheet, ref);
    return r && r.type === 'dropdown' ? r : null;
  }
  function checkValidation(sheet, ref, text) {
    const rule = ruleAt(sheet, ref);
    if (!rule) return null;
    const custom = customMessage(rule);
    const t = String(text == null ? '' : text);
    if (t === '') return null;
    // A formula is not a literal entry; the rule constrains literal values.
    if (t.charAt(0) === '=') return null;
    if (rule.type === 'dropdown') {
      const allowed = rule.values || [];
      if (allowed.indexOf(t.trim()) < 0) {
        if (custom) return custom;
        const shown = rule.raw != null && rule.raw !== '' ? rule.raw : allowed.join(', ');
        return 'Please select one of the following values: ' + shown;
      }
      return null;
    }
    if (!isNum(t)) return custom || numberMessage(rule);
    const n = Number(t);
    if (n < Number(rule.min) || n > Number(rule.max)) return custom || numberMessage(rule);
    return null;
  }
  function applyCells(sheet, updates) {
    for (let i = 0; i < updates.length; i++) {
      const msg = checkValidation(sheet, updates[i].ref, updates[i].text);
      if (msg) return msg;
    }
    for (let i = 0; i < updates.length; i++) {
      const u = updates[i];
      if (u.text === '' || u.text == null) delete sheet.cells[u.ref];
      else sheet.cells[u.ref] = String(u.text);
    }
    return null;
  }
  function validateAll(sheet) {
    const val = makeValuer(sheet);
    const refs = Object.keys(sheet.cells || {});
    for (let i = 0; i < refs.length; i++) {
      const raw = sheet.cells[refs[i]];
      if (raw == null || raw === '') continue;
      const msg = checkValidation(sheet, refs[i], display(sheet, val, refs[i]));
      if (msg) return msg;
    }
    return null;
  }

  /* ------------------------------------------------------------------ conditional formatting */
  const FILL_COLORS = {
    'Red fill': 'rgb(254, 226, 226)',
    'Yellow fill': 'rgb(254, 249, 195)',
    'Green fill': 'rgb(220, 252, 231)'
  };
  function cellFill(sheet, val, r, c) {
    const rules = sheet.formats || [];
    let color = '';
    for (let i = 0; i < rules.length; i++) {
      const f = rules[i];
      if (!f.range || !inRect(r, c, f.range)) continue;
      const text = display(sheet, val, refOf(r, c));
      const target = String(f.value == null ? '' : f.value);
      let hit = false;
      if (f.condition === 'Greater than') hit = target !== '' && isNum(text) && Number(text) > Number(target);
      else if (f.condition === 'Text contains') hit = target !== '' && text.toLowerCase().indexOf(target.toLowerCase()) >= 0;
      if (hit) color = FILL_COLORS[f.style] || '';
    }
    return color;
  }

  /* ------------------------------------------------------------------ structure changes */
  function rangeInsert(rg, axis, at, count) {
    const a = axis === 'row' ? 'r0' : 'c0', b = axis === 'row' ? 'r1' : 'c1';
    if (at <= rg[a]) rg[a] += count;
    if (at <= rg[b]) rg[b] += count;
  }
  function rangeDelete(rg, axis, at) {
    const a = axis === 'row' ? 'r0' : 'c0', b = axis === 'row' ? 'r1' : 'c1';
    if (at < rg[a]) { rg[a] -= 1; rg[b] -= 1; }
    else if (at <= rg[b]) { rg[b] -= 1; }
    if (rg[a] < 0) rg[a] = 0;
    if (rg[b] < rg[a]) rg[b] = rg[a];
  }
  function logOp(sheet, op) {
    const log = sheet.opsLog || (sheet.opsLog = []);
    log.push(op);
  }
  function insertRows(sheet, at, count) {
    const cells = {};
    const src = sheet.cells || {};
    for (const ref of Object.keys(src)) {
      const p = parseRef(ref);
      if (!p) continue;
      cells[refOf(p.r >= at ? p.r + count : p.r, p.c)] = src[ref];
    }
    sheet.cells = cells;
    remapFormulas(sheet, (p) => ({ r: p.row >= at ? p.row + count : p.row, c: p.col }));
    for (const rule of sheet.validations || []) rangeInsert(rule.range, 'row', at, count);
    for (const fmt of sheet.formats || []) rangeInsert(fmt.range, 'row', at, count);
    if (sheet.filter) {
      rangeInsert(sheet.filter, 'row', at, count);
      for (const cond of sheet.filter.conditions || []) void cond;
    }
    if (sheet.pivot) rangeInsert(sheet.pivot.range, 'row', at, count);
    logOp(sheet, { axis: 'row', op: 'insert', at: at, count: count });
  }
  function deleteRow(sheet, at) {
    const cells = {};
    const src = sheet.cells || {};
    for (const ref of Object.keys(src)) {
      const p = parseRef(ref);
      if (!p) continue;
      if (p.r === at) continue;
      cells[refOf(p.r > at ? p.r - 1 : p.r, p.c)] = src[ref];
    }
    sheet.cells = cells;
    remapFormulas(sheet, (p) => (p.row === at ? null : { r: p.row > at ? p.row - 1 : p.row, c: p.col }));
    const kept = [];
    for (const rule of sheet.validations || []) {
      if (rule.range.r0 === at && rule.range.r1 === at) continue;
      rangeDelete(rule.range, 'row', at);
      kept.push(rule);
    }
    sheet.validations = kept;
    const keptFmt = [];
    for (const fmt of sheet.formats || []) {
      if (fmt.range.r0 === at && fmt.range.r1 === at) continue;
      rangeDelete(fmt.range, 'row', at);
      keptFmt.push(fmt);
    }
    sheet.formats = keptFmt;
    if (sheet.filter) rangeDelete(sheet.filter, 'row', at);
    if (sheet.pivot) rangeDelete(sheet.pivot.range, 'row', at);
    logOp(sheet, { axis: 'row', op: 'delete', at: at, count: 1 });
  }
  function insertCols(sheet, at, count) {
    const cells = {};
    const src = sheet.cells || {};
    for (const ref of Object.keys(src)) {
      const p = parseRef(ref);
      if (!p) continue;
      cells[refOf(p.r, p.c >= at ? p.c + count : p.c)] = src[ref];
    }
    sheet.cells = cells;
    remapFormulas(sheet, (p) => ({ r: p.row, c: p.col >= at ? p.col + count : p.col }));
    for (const rule of sheet.validations || []) rangeInsert(rule.range, 'col', at, count);
    for (const fmt of sheet.formats || []) rangeInsert(fmt.range, 'col', at, count);
    if (sheet.filter) {
      rangeInsert(sheet.filter, 'col', at, count);
      // A filter condition names its column by absolute index; that column moved with the data.
      for (const cond of sheet.filter.conditions || []) if (cond.col >= at) cond.col += count;
    }
    if (sheet.pivot) rangeInsert(sheet.pivot.range, 'col', at, count);
    logOp(sheet, { axis: 'col', op: 'insert', at: at, count: count });
  }
  function deleteCol(sheet, at) {
    const cells = {};
    const src = sheet.cells || {};
    for (const ref of Object.keys(src)) {
      const p = parseRef(ref);
      if (!p) continue;
      if (p.c === at) continue;
      cells[refOf(p.r, p.c > at ? p.c - 1 : p.c)] = src[ref];
    }
    sheet.cells = cells;
    remapFormulas(sheet, (p) => (p.col === at ? null : { r: p.row, c: p.col > at ? p.col - 1 : p.col }));
    const kept = [];
    for (const rule of sheet.validations || []) {
      if (rule.range.c0 === at && rule.range.c1 === at) continue;
      rangeDelete(rule.range, 'col', at);
      kept.push(rule);
    }
    sheet.validations = kept;
    const keptFmt = [];
    for (const fmt of sheet.formats || []) {
      if (fmt.range.c0 === at && fmt.range.c1 === at) continue;
      rangeDelete(fmt.range, 'col', at);
      keptFmt.push(fmt);
    }
    sheet.formats = keptFmt;
    if (sheet.filter) {
      rangeDelete(sheet.filter, 'col', at);
      sheet.filter.conditions = (sheet.filter.conditions || []).filter((c) => c.col !== at);
      for (const cond of sheet.filter.conditions) if (cond.col > at) cond.col -= 1;
    }
    if (sheet.pivot) rangeDelete(sheet.pivot.range, 'col', at);
    logOp(sheet, { axis: 'col', op: 'delete', at: at, count: 1 });
  }

  /* ------------------------------------------------------------------ filtering */
  function rowMatches(sheet, val, filter, r) {
    const conds = filter.conditions || [];
    for (let i = 0; i < conds.length; i++) {
      const cond = conds[i];
      const text = display(sheet, val, refOf(r, cond.col));
      if (cond.kind === 'values') {
        if ((cond.values || []).indexOf(text) < 0) return false;
      } else if (cond.kind === 'Text contains') {
        if (text.toLowerCase().indexOf(String(cond.value || '').toLowerCase()) < 0) return false;
      } else if (cond.kind === 'Greater than') {
        if (!(isNum(text) && Number(text) > Number(cond.value))) return false;
      } else if (cond.kind === 'Before') {
        if (!(text !== '' && text < String(cond.value || ''))) return false;
      } else if (cond.kind === 'Is empty') {
        if (text !== '') return false;
      } else if (cond.kind === 'Is not empty') {
        if (text === '') return false;
      }
    }
    return true;
  }
  function hiddenRows(sheet, val) {
    const set = {};
    const f = sheet.filter;
    if (!f || !(f.conditions || []).length) return set;
    for (let r = f.r0 + 1; r <= f.r1; r++) if (!rowMatches(sheet, val, f, r)) set[r] = true;
    return set;
  }

  /* ------------------------------------------------------------------ pivot */
  function pivotHeaders(w, ps) {
    const src = w.sheets.filter((x) => x.id === ps.pivot.sourceId)[0];
    if (!src) return [];
    const val = makeValuer(src, w);
    const out = [];
    for (let c = ps.pivot.range.c0; c <= ps.pivot.range.c1; c++) out.push(display(src, val, refOf(ps.pivot.range.r0, c)));
    return out;
  }
  function applyPivotOp(range, op) {
    const a = op.axis === 'row' ? 'r0' : 'c0';
    const b = op.axis === 'row' ? 'r1' : 'c1';
    if (op.op === 'insert') {
      const n = op.count || 1;
      if (op.at <= range[a]) range[a] += n;
      if (op.at <= range[b]) range[b] += n;
    } else {
      if (op.at < range[a]) { range[a] -= 1; range[b] -= 1; }
      else if (op.at <= range[b]) { range[b] -= 1; }
      if (range[b] < range[a]) range[b] = range[a];
    }
  }
  function syncPivotRange(pv, src) {
    if (!pv || !src || !pv.range) return;
    const ops = src.opsLog || [];
    const done = pv.syncedOps == null ? 0 : pv.syncedOps;
    for (let i = done; i < ops.length; i++) applyPivotOp(pv.range, ops[i]);
    pv.syncedOps = ops.length;
  }
  function recomputePivot(w, ps, report) {
    const pv = ps.pivot;
    const src = w.sheets.filter((x) => x.id === pv.sourceId)[0];
    if (!src) {
      if (report) ARC.notify('Pivot field is no longer available. Select a new field.');
      return false;
    }
    syncPivotRange(pv, src);
    const val = makeValuer(src, w);
    const R = pv.range;
    const headers = [];
    for (let c = R.c0; c <= R.c1; c++) headers.push(display(src, val, refOf(R.r0, c)));
    const ri = headers.indexOf(pv.rows);
    const vi = headers.indexOf(pv.values);
    const ci = pv.columns ? headers.indexOf(pv.columns) : -1;
    if (ri < 0 || vi < 0 || (pv.columns && ci < 0)) {
      if (report) ARC.notify('Pivot field is no longer available. Select a new field.');
      return false;
    }
    const rowCol = R.c0 + ri, valCol = R.c0 + vi, colCol = ci >= 0 ? R.c0 + ci : -1;
    const records = [];
    for (let r = R.r0 + 1; r <= R.r1; r++) {
      const rv = display(src, val, refOf(r, rowCol));
      const cv = colCol >= 0 ? display(src, val, refOf(r, colCol)) : '';
      const vv = display(src, val, refOf(r, valCol));
      if (rv === '' && cv === '' && vv === '') continue;
      records.push({ r: rv, c: cv, v: vv });
    }
    const method = pv.summarize || 'SUM';
    if ((method === 'SUM' || method === 'AVERAGE') && !records.some((x) => isNum(x.v))) {
      if (report) ARC.notify('Value field requires numeric values');
      return false;
    }
    const rowKeys = [], colKeys = [];
    records.forEach((rec) => {
      if (rowKeys.indexOf(rec.r) < 0) rowKeys.push(rec.r);
      if (ci >= 0 && colKeys.indexOf(rec.c) < 0) colKeys.push(rec.c);
    });
    const agg = (list) => {
      if (method === 'COUNT') return list.filter((x) => x.v !== '').length;
      const nums = list.filter((x) => isNum(x.v)).map((x) => Number(x.v));
      if (method === 'AVERAGE') return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
      return nums.reduce((a, b) => a + b, 0);
    };
    const cells = {};
    const put = (r, c, v) => { if (v !== '' && v != null) cells[refOf(r, c)] = String(v); };
    if (ci < 0) {
      put(0, 0, pv.rows);
      put(0, 1, method + ' of ' + pv.values);
      rowKeys.forEach((k, i) => {
        put(i + 1, 0, k);
        put(i + 1, 1, agg(records.filter((x) => x.r === k)));
      });
      put(rowKeys.length + 1, 0, 'Grand Total');
      put(rowKeys.length + 1, 1, agg(records));
    } else {
      put(0, 0, pv.rows);
      colKeys.forEach((k, j) => put(0, j + 1, k));
      put(0, colKeys.length + 1, 'Grand Total');
      rowKeys.forEach((rk, i) => {
        put(i + 1, 0, rk);
        colKeys.forEach((ck, j) => put(i + 1, j + 1, agg(records.filter((x) => x.r === rk && x.c === ck))));
        put(i + 1, colKeys.length + 1, agg(records.filter((x) => x.r === rk)));
      });
      put(rowKeys.length + 1, 0, 'Grand Total');
      colKeys.forEach((ck, j) => put(rowKeys.length + 1, j + 1, agg(records.filter((x) => x.c === ck))));
      put(rowKeys.length + 1, colKeys.length + 1, agg(records));
    }
    ps.cells = cells;
    pv.applied = true;
    return true;
  }

  /* ------------------------------------------------------------------ CSV */
  function parseCsv(text) {
    const src = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const rows = [];
    let row = [], field = '', i = 0, inQ = false;
    while (i < src.length) {
      const ch = src.charAt(i);
      if (inQ) {
        if (ch === '"') {
          if (src.charAt(i + 1) === '"') { field += '"'; i += 2; continue; }
          inQ = false; i++; continue;
        }
        field += ch; i++; continue;
      }
      if (ch === '"' && field === '') { inQ = true; i++; continue; }
      if (ch === ',') { row.push(field); field = ''; i++; continue; }
      if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
      field += ch; i++;
    }
    if (inQ) return null;
    row.push(field);
    rows.push(row);
    if (rows.length > 1 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') rows.pop();
    return rows;
  }
  function fileNameOf(name) {
    const base = String(name || '').replace(/^.*[\\/]/, '');
    return base.replace(/\.csv$/i, '');
  }
  function csvField(v) {
    const s = String(v == null ? '' : v);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function readFileText(file) {
    return new Promise((resolve, reject) => {
      if (file && typeof file.text === 'function') { file.text().then(resolve, reject); return; }
      const r = new FileReader();
      r.onload = () => resolve(String(r.result == null ? '' : r.result));
      r.onerror = () => reject(r.error);
      r.readAsText(file);
    });
  }

  /* ------------------------------------------------------------------ grid helpers */
  function gridSize(sheet) {
    let mr = 0, mc = 0;
    const cells = sheet.cells || {};
    for (const k of Object.keys(cells)) {
      const v = cells[k];
      if (v == null || v === '') continue;
      const p = parseRef(k);
      if (!p) continue;
      if (p.r > mr) mr = p.r;
      if (p.c > mc) mc = p.c;
    }
    return {
      rows: Math.min(MAX_ROW, Math.max(MIN_ROWS, mr + 2)),
      cols: Math.min(MAX_COL, Math.max(MIN_COLS, mc + 2))
    };
  }
  function usedRange(sheet) {
    let mr = -1, mc = -1;
    const cells = sheet.cells || {};
    for (const k of Object.keys(cells)) {
      const v = cells[k];
      if (v == null || v === '') continue;
      const p = parseRef(k);
      if (!p) continue;
      if (p.r > mr) mr = p.r;
      if (p.c > mc) mc = p.c;
    }
    if (mr < 0) { mr = 0; mc = 0; }
    return { r0: 0, c0: 0, r1: mr, c1: mc };
  }

  /* ------------------------------------------------------------------ screens */
  function screenHome() {
    const list = workbooks();
    const items = list.map((w) => '<article class="workbook" data-id="' + esc(w.id) + '">' +
      '<h2 class="wb-name"><a href="#/sheet/' + esc(w.id) + '">' + esc(w.name) + '</a></h2>' +
      '<p class="wb-updated">Last updated: ' + esc(fmtUpdated(w.updatedAt)) + '</p>' +
      '</article>').join('');
    return '<h1>Workbooks</h1>' +
      '<div class="home-actions">' +
      '<button type="button" data-action="new-workbook">New blank workbook</button>' +
      '<button type="button" data-action="open-import">Import CSV</button>' +
      '</div>' +
      '<div class="workbook-list">' + (items || '<p class="empty">No workbooks yet.</p>') + '</div>';
  }

  function screenNew() {
    return '<h1>New blank workbook</h1>' +
      '<form data-action="create-workbook" class="stack">' +
      '<label for="new-wb-name">Workbook name</label>' +
      '<input id="new-wb-name" name="name" type="text" placeholder="Workbook name">' +
      '<div class="form-actions"><button type="submit">Create</button>' +
      '<a class="btn-link" href="#/">Cancel</a></div>' +
      '</form>';
  }

  function gridHTML(w, s, ui) {
    const val = makeValuer(s, w);
    const size = gridSize(s);
    const sel = normSel(s.selection);
    const hidden = hiddenRows(s, val);
    const f = s.filter;
    const freeze = s.freeze || { rows: 0, cols: 0 };
    let html = '<div class="sheet-grid" role="grid" aria-label="Worksheet grid" aria-multiselectable="true" data-grid>';
    html += '<div class="grow ghead" role="row"><div class="gcellwrap narrow"><div class="gcell corner" aria-hidden="true"></div></div>';
    for (let c = 0; c < size.cols; c++) {
      const letter = colName(c);
      let filterBtn = '';
      if (f && c >= f.c0 && c <= f.c1) {
        const headerText = display(s, val, refOf(f.r0, c));
        filterBtn = '<button type="button" class="filter-btn" aria-label="Filter ' + esc(headerText) +
          '" data-action="open-filter-dialog" data-col="' + c + '">&#9662;</button>';
      }
      const frozen = c < freeze.cols ? ' frozen-col' : '';
      const style = c < freeze.cols ? ' style="left:' + (46 + 86 * c) + 'px"' : '';
      html += '<div class="gcellwrap' + frozen + '"' + style + '><div class="gcell colhead" role="columnheader" aria-label="' +
        letter + '" data-colhead data-col="' + c + '"><span class="col-letter">' + letter + '</span></div>' + filterBtn + '</div>';
    }
    html += '</div>';
    for (let r = 0; r < size.rows; r++) {
      const rowFrozen = r < freeze.rows;
      html += '<div class="grow' + (rowFrozen ? ' frozen-row' : '') + '" role="row"' + (hidden[r] ? ' hidden' : '') +
        (rowFrozen ? ' style="top:' + (18 * r) + 'px"' : '') + '>';
      html += '<div class="gcellwrap narrow"><div class="gcell rowhead" role="rowheader" data-rowhead data-row="' + r + '">' + (r + 1) + '</div></div>';
      for (let c = 0; c < size.cols; c++) {
        const ref = refOf(r, c);
        const inside = r >= sel.r0 && r <= sel.r1 && c >= sel.c0 && c <= sel.c1;
        const editing = ui.editing && ui.editing.sheetId === s.id && ui.editing.ref === ref;
        const rawValue = (s.cells || {})[ref] == null ? '' : String(s.cells[ref]);
        const shown = display(s, val, ref);
        const fill = cellFill(s, val, r, c);
        let inner;
        if (editing) {
          const start = ui.editing && ui.editing.initial != null ? ui.editing.initial : rawValue;
          inner = '<input class="cell-input" aria-label="Edit ' + ref + '" type="text" value="' + esc(start) + '">';
        } else {
          // The gridcell itself is named by its coordinate; the displayed value is exposed on this
          // value element so the cell can also be found by the text it shows.
          inner = '<span class="v" role="cell" aria-label="' + esc(shown) + '">' + esc(shown) + '</span>';
          const note = (s.notes || {})[ref];
          if (note != null && note !== '') {
            inner += '<button type="button" class="note-btn" aria-label="Open note for ' + ref +
              '" data-action="open-note" data-ref="' + ref + '"><span class="note-dot" aria-hidden="true"></span></button>';
          }
        }
        // The dropdown button and its option list sit BESIDE the gridcell, never inside it: the cell's
        // own text must stay exactly the displayed value.
        const dropdownRule = dropdownRuleAt(s, ref);
        let beside = '';
        if (dropdownRule && !editing) {
          beside = '<button type="button" class="cell-dropdown" aria-label="Open dropdown for ' + ref +
            '" data-action="open-dropdown" data-ref="' + ref + '">&#9662;</button>';
        }
        if (ui.dropdown === ref && dropdownRule) {
          beside += '<div class="cell-options" role="listbox" aria-label="Options for ' + ref + '">' +
            (dropdownRule.values || []).map((v) => '<div role="option" tabindex="-1" data-action="pick-option" data-ref="' +
              esc(ref) + '" data-value="' + esc(v) + '">' + esc(v) + '</div>').join('') + '</div>';
        }
        const frozen = c < freeze.cols ? ' frozen-col' : '';
        const style = c < freeze.cols ? ' style="left:' + (46 + 86 * c) + 'px"' : '';
        const cellStyle = fill ? ' style="background-color:' + fill + '"' : '';
        html += '<div class="gcellwrap' + frozen + '"' + style + '><div class="gcell" role="gridcell" aria-label="' + ref +
          '" aria-selected="' + (inside ? 'true' : 'false') + '"' + cellStyle + ' data-gridcell data-ref="' + ref +
          '" data-r="' + r + '" data-c="' + c + '">' + inner + '</div>' + beside + '</div>';
      }
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function tableBar(w, s) {
    const tabs = w.sheets.map((sh) =>
      '<span class="tab-wrap">' +
      '<button type="button" role="tab" aria-selected="' + (sh.id === s.id ? 'true' : 'false') +
      '" data-action="switch-sheet" data-id="' + esc(sh.id) + '">' + esc(sh.name) + '</button>' +
      '<button type="button" class="tab-options" aria-label="Worksheet options for ' + esc(sh.name) +
      '" data-action="sheet-menu" data-id="' + esc(sh.id) + '">&#8943;</button>' +
      '</span>').join('');
    return '<div class="tabbar">' +
      '<div role="tablist" aria-label="Worksheets">' + tabs + '</div>' +
      '<button type="button" data-action="add-worksheet">Add worksheet</button>' +
      '</div>';
  }

  function pivotEditor(w, s) {
    syncPivotRange(s.pivot, w.sheets.filter((x) => x.id === ((s.pivot && s.pivot.sourceId) || ''))[0]);
    const headers = pivotHeaders(w, s);
    const pv = s.pivot;
    const rowOpts = headers.map((h) => ({ value: h, label: h }));
    const colOpts = [{ value: '', label: '(none)' }].concat(headers.map((h) => ({ value: h, label: h })));
    const valOpts = headers.map((h) => ({ value: h, label: h }));
    return '<section class="pivot-editor" role="region" aria-label="Pivot table editor">' +
      '<h2>Pivot table editor</h2>' +
      '<form data-action="apply-pivot" class="pivot-form">' +
      ARC.combobox({ label: 'Rows', name: 'pvRows', options: rowOpts, value: pv.rows || '' }) + ' ' +
      ARC.combobox({ label: 'Columns', name: 'pvColumns', options: colOpts, value: pv.columns || '' }) + ' ' +
      ARC.combobox({ label: 'Values', name: 'pvValues', options: valOpts, value: pv.values || '' }) + ' ' +
      ARC.combobox({ label: 'Summarize by', name: 'pvSum', options: ['SUM', 'COUNT', 'AVERAGE'], value: pv.summarize || 'SUM' }) + ' ' +
      '<button type="submit">Apply</button>' +
      '</form>' +
      '<button type="button" data-action="refresh-pivot">Refresh pivot table</button>' +
      '</section>';
  }

  function screenSheet(route) {
    const w = wb(route.params[0]);
    if (!w) return '<h1>Workbook not found</h1><p><a href="#/">Back to Workbooks</a></p>';
    const s = activeSheetOf(w);
    const ui = ARC.state.ui || {};
    const sel = normSel(s.selection);
    const activeRef = refOf(sel.r1, sel.c1);
    const rawActive = (s.cells || {})[activeRef] == null ? '' : String(s.cells[activeRef]);
    const h = HISTORY[w.id] || { past: [], future: [] };
    const renameOpen = ui.rename === w.id;
    const renameError = ui.renameError || '';
    const dup = ui.dupId ? workbooks().filter((x) => x.id === ui.dupId)[0] : null;
    const freeze = s.freeze || { rows: 0, cols: 0 };

    let html = '<div class="editor">';
    html += '<div class="editor-head">' +
      '<h1 class="wb-title">' + esc(w.name) + '</h1>' +
      '<button type="button" data-action="rename-workbook">Rename workbook</button>' +
      '<p class="wb-updated">Last updated: ' + esc(fmtUpdated(w.updatedAt)) + '</p>' +
      '</div>';
    if (renameOpen) {
      html += '<form class="rename-form" data-action="save-workbook-name">' +
        '<label for="wb-name-field">Workbook name</label>' +
        '<input id="wb-name-field" name="name" type="text" placeholder="Workbook name" value="' + esc(w.name) + '">' +
        '<div class="form-actions"><button type="submit">Save</button>' +
        '<button type="button" data-action="cancel-rename">Cancel</button></div>' +
        (renameError ? '<p class="error" role="alert">' + esc(renameError) + '</p>' : '') +
        (dup ? '<p class="dup-link"><a href="#/sheet/' + esc(dup.id) + '">' + esc(dup.name) + '</a></p>' : '') +
        '</form>';
    }
    html += '<div class="toolbar" role="toolbar" aria-label="Spreadsheet toolbar">' +
      '<button type="button" data-action="undo"' + (h.past.length ? '' : ' disabled') + '>Undo</button>' +
      '<button type="button" data-action="redo"' + (h.future.length ? '' : ' disabled') + '>Redo</button>' +
      '<span class="menu-wrap"><button type="button" data-action="open-edit-menu">Edit</button></span>' +
      '<span class="menu-wrap"><button type="button" data-action="open-view-menu">View</button></span>' +
      '<span class="menu-wrap"><button type="button" data-action="open-insert-menu">Insert</button></span>' +
      '<span class="menu-wrap"><button type="button" data-action="open-format-menu">Format</button></span>' +
      '<span class="menu-wrap"><button type="button" data-action="open-data-menu">Data</button></span>' +
      '<button type="button" data-action="export-csv">Export CSV</button>' +
      '<button type="button" class="freeze-state">Frozen rows: ' + freeze.rows + '; columns: ' + freeze.cols + '</button>' +
      '</div>';
    html += '<div class="formula-row">' +
      '<label for="formula-bar">Formula bar</label>' +
      '<input id="formula-bar" name="formula" type="text" placeholder="Formula bar" data-change="formula-dirty" value="' + esc(rawActive) + '">' +
      '</div>';
    html += tableBar(w, s);
    if (s.pivot) html += pivotEditor(w, s);
    html += gridHTML(w, s, ui);
    html += '</div>';
    return html;
  }

  /* ------------------------------------------------------------------ dialog builders */
  function sheetRenameDialog(id, name, error) {
    ARC.openDialog('<form data-action="save-sheet-name" data-id="' + esc(id) + '">' +
      '<label for="ws-name-field">Worksheet name</label>' +
      '<input id="ws-name-field" name="name" type="text" placeholder="Worksheet name" value="' + esc(name) + '">' +
      '<div class="form-actions"><button type="submit">Save</button>' +
      '<button type="button" data-action="arc:close">Cancel</button></div>' +
      (error ? '<p class="error" role="alert">' + esc(error) + '</p>' : '') +
      '</form>', { title: 'Rename worksheet' });
  }
  function validationDialogHTML(sel, existing, error) {
    const isDropdown = existing && existing.type === 'dropdown';
    return '<form data-action="save-validation">' +
      ARC.combobox({ label: 'Rule type', name: 'ruleType', options: ['Dropdown', 'Number range'], value: isDropdown ? 'Dropdown' : 'Number range' }) +
      '<label for="dv-values">Allowed values</label>' +
      '<input id="dv-values" name="allowedValues" type="text" placeholder="Allowed values" value="' +
      esc(existing && existing.raw ? existing.raw : (existing && existing.values ? existing.values.join(', ') : '')) + '">' +
      '<label for="dv-min">Minimum</label>' +
      '<input id="dv-min" name="min" type="text" placeholder="Minimum" value="' + esc(existing && existing.min != null ? existing.min : '') + '">' +
      '<label for="dv-max">Maximum</label>' +
      '<input id="dv-max" name="max" type="text" placeholder="Maximum" value="' + esc(existing && existing.max != null ? existing.max : '') + '">' +
      '<label for="dv-error">Error message</label>' +
      '<input id="dv-error" name="errorMessage" type="text" placeholder="Error message" value="' +
      esc(existing && existing.errorMessage ? existing.errorMessage : '') + '">' +
      '<div class="form-actions"><button type="submit">Save</button>' +
      (existing ? '<button type="button" data-action="delete-rule">Delete rule</button>' : '') +
      '<button type="button" data-action="arc:close">Cancel</button></div>' +
      (error ? '<p class="error" role="alert">' + esc(error) + '</p>' : '') +
      '</form>';
  }
  function filterValuesHTML(s, val, col) {
    const f = s.filter;
    const seen = [];
    for (let r = f.r0 + 1; r <= f.r1; r++) {
      const t = display(s, val, refOf(r, col));
      if (seen.indexOf(t) < 0) seen.push(t);
    }
    const vcond = (f.conditions || []).filter((c) => c.col === col && c.kind === 'values')[0];
    const checked = vcond ? vcond.values : seen;
    const ccond = (f.conditions || []).filter((c) => c.col === col && c.kind !== 'values')[0];
    return '<form data-action="apply-filter" data-col="' + col + '">' +
      '<button type="button" data-action="clear-filter-selection">Clear selection</button>' +
      '<div class="filter-values">' + seen.map((v) =>
        '<label class="filter-value"><input type="checkbox" name="v" value="' + esc(v) + '"' +
        (checked.indexOf(v) >= 0 ? ' checked' : '') + '> ' + esc(v) + '</label>').join('') + '</div>' +
      ARC.combobox({ label: 'Condition', name: 'condition',
        options: ['Text contains', 'Greater than', 'Before', 'Is empty', 'Is not empty'],
        value: ccond ? ccond.kind : '' }) + ' ' +
      '<label for="cond-value">Value</label>' +
      '<input id="cond-value" name="value" type="text" placeholder="Value" value="' +
      esc(ccond ? ccond.value : '') + '">' +
      '<div class="form-actions"><button type="submit">Apply</button>' +
      '<button type="button" data-action="arc:close">Cancel</button></div>' +
      '</form>';
  }
  function filterConditionHTML(col, kind) {
    return '<form data-action="apply-condition" data-col="' + col + '">' +
      ARC.combobox({ label: 'Condition', name: 'condition', options: ['Text contains', 'Greater than', 'Before', 'Is empty', 'Is not empty'], value: kind || 'Text contains' }) +
      '<label for="cond-value">Value</label>' +
      '<input id="cond-value" name="value" type="text" placeholder="Value">' +
      '<div class="form-actions"><button type="submit">Apply</button>' +
      '<button type="button" data-action="arc:close">Cancel</button></div>' +
      '</form>';
  }
  function openFilterDialog(s, col, kind) {
    const val = makeValuer(s, currentWorkbook());
    const headerText = display(s, val, refOf(s.filter.r0, col));
    ARC.openDialog(kind ? filterConditionHTML(col, kind) : filterValuesHTML(s, val, col),
      { title: 'Filter ' + headerText });
  }

  // ---- saved filter views
  function saveFilterViewHTML(value, error) {
    return '<form data-action="confirm-save-filter-view">' +
      '<label for="fv-name">Filter view name</label>' +
      '<input id="fv-name" name="name" type="text" placeholder="Filter view name" value="' + esc(value || '') + '">' +
      '<div class="form-actions"><button type="submit">Save view</button>' +
      '<button type="button" data-action="arc:close">Cancel</button></div>' +
      (error ? '<p class="error" role="alert">' + esc(error) + '</p>' : '') +
      '</form>';
  }
  function filterViewsHTML(w, ui) {
    const views = w.filterViews || [];
    let html = '<div class="fv-list">' + (views.length ? views.map((v) =>
      '<button type="button" class="fv-item" aria-pressed="' + (ui.filterViewSelected === v.id ? 'true' : 'false') +
      '" data-action="apply-filter-view" data-id="' + esc(v.id) + '">' + esc(v.name) + '</button>').join('') :
      '<p class="empty">No saved filter views.</p>') + '</div>' +
      '<div class="form-actions">' +
      '<button type="button" data-action="delete-filter-view">Delete filter view</button>' +
      '<button type="button" data-action="arc:close">Close</button></div>';
    return html;
  }

  // ---- named ranges
  function openNamedRangesDialog(error) {
    const w = currentWorkbook();
    if (!w) return;
    const ui = ARC.state.ui || (ARC.state.ui = {});
    const draft = ui.namedEdit;
    let html;
    if (draft) {
      html = '<form data-action="save-named-range">' +
        '<label for="nr-name">Name</label>' +
        '<input id="nr-name" name="name" type="text" placeholder="Name" value="' + esc(draft.name || '') + '">' +
        '<label for="nr-range">Range</label>' +
        '<input id="nr-range" name="range" type="text" placeholder="Range" value="' + esc(draft.range || '') + '">' +
        '<div class="form-actions"><button type="submit">Save</button>' +
        '<button type="button" data-action="cancel-named-range">Cancel</button></div>' +
        (error ? '<p class="error" role="alert">' + esc(error) + '</p>' : '') +
        '</form>';
    } else {
      const list = w.namedRanges || [];
      html = '<div class="nr-list">' + (list.length ? list.map((nr) =>
        '<div class="nr-row"><span class="nr-name">' + esc(nr.name) + '</span>' +
        '<button type="button" aria-label="Edit ' + esc(nr.name) + '" data-action="edit-named-range" data-id="' +
        esc(nr.id) + '">Edit</button></div>').join('') :
        '<p class="empty">No named ranges.</p>') + '</div>' +
        '<div class="form-actions"><button type="button" data-action="add-named-range">Add named range</button>' +
        '<button type="button" data-action="arc:close">Close</button></div>';
    }
    ARC.openDialog(html, { title: 'Named ranges' });
  }

  // ---- conditional formatting
  function cfDialogHTML(s, ui) {
    const idx = ui.cfEdit;
    const rule = idx != null ? (s.formats || [])[idx] : null;
    let html = '<form data-action="save-format-rule">' +
      ARC.combobox({ label: 'Condition', name: 'condition', options: ['Greater than', 'Text contains'],
        value: rule ? rule.condition : 'Greater than' }) + ' ' +
      '<label for="cf-value">Value</label>' +
      '<input id="cf-value" name="value" type="text" placeholder="Value" value="' + esc(rule ? rule.value : '') + '">' +
      ARC.combobox({ label: 'Style', name: 'style', options: ['Red fill', 'Yellow fill', 'Green fill'],
        value: rule ? rule.style : 'Red fill' }) + ' ' +
      '<div class="form-actions"><button type="submit">Save</button>' +
      (idx != null ? '<button type="button" data-action="cancel-format-rule">Cancel</button>' : '') +
      '</div></form>';
    const rules = s.formats || [];
    html += '<div class="cf-list">' + rules.map((r, i) =>
      '<span class="cf-item"><button type="button" data-action="edit-format-rule" data-index="' + i +
      '">Edit rule ' + (i + 1) + '</button>' +
      '<button type="button" data-action="delete-format-rule" data-index="' + i +
      '">Delete rule ' + (i + 1) + '</button></span>').join('') + '</div>';
    html += '<div class="form-actions"><button type="button" data-action="arc:close">Close</button></div>';
    return html;
  }

  // ---- find and replace
  function findDialogHTML(ui) {
    return '<div class="find-body">' +
      '<label for="find-query">Find</label>' +
      '<input id="find-query" name="find" type="text" value="' + esc(ui.findQuery || '') + '">' +
      '<label for="find-replace">Replace with</label>' +
      '<input id="find-replace" name="replace" type="text" value="' + esc(ui.findReplace || '') + '">' +
      '<label class="check-line" for="find-case"><input type="checkbox" id="find-case" name="matchCase"> Match case</label>' +
      '<div class="form-actions">' +
      '<button type="button" data-action="find-next">Find next</button>' +
      '<button type="button" data-action="replace-all">Replace all</button>' +
      '<button type="button" data-action="arc:close">Close</button>' +
      '</div>' +
      '<p class="find-status" role="status" id="find-status"></p>' +
      '</div>';
  }
  function findMatches(s, w, query, caseSensitive) {
    const val = makeValuer(s, w);
    const rg = usedRange(s);
    const q = String(query == null ? '' : query);
    const out = [];
    if (q === '') return out;
    const needle = caseSensitive ? q : q.toLowerCase();
    for (let r = rg.r0; r <= rg.r1; r++) {
      for (let c = rg.c0; c <= rg.c1; c++) {
        const text = display(s, val, refOf(r, c));
        if (text === '') continue;
        const hay = caseSensitive ? text : text.toLowerCase();
        if (hay === needle) out.push({ r: r, c: c });
      }
    }
    return out;
  }
  function setFindStatus(text) {
    const el = document.getElementById('find-status');
    if (el) el.textContent = text;
  }

  // ---- cell notes
  // The dialog for a cell note always shows the "Note" text box, so opening a note displays its
  // exact text there; an existing note additionally offers "Edit note" and "Delete note".
  function noteDialogHTML(s, ref, edit) {
    const note = (s.notes || {})[ref];
    const has = note != null && note !== '';
    return '<form data-action="save-note" data-ref="' + esc(ref) + '">' +
      '<label for="note-field">Note</label>' +
      '<textarea id="note-field" name="note" rows="3">' + esc(note || '') + '</textarea>' +
      '<div class="form-actions"><button type="submit">Save note</button>' +
      (has ? '<button type="button" data-action="edit-note" data-ref="' + esc(ref) + '">Edit note</button>' +
        '<button type="button" data-action="delete-note" data-ref="' + esc(ref) + '">Delete note</button>' : '') +
      '<button type="button" data-action="arc:close">Cancel</button></div>' +
      '</form>';
  }
  function openNoteDialog(ref, edit) {
    const s = currentSheet();
    if (!s) return;
    ARC.state.ui = ARC.state.ui || {};
    ARC.state.ui.noteRef = ref;
    ARC.openDialog(noteDialogHTML(s, ref, !!edit), { title: 'Note for ' + ref });
  }

  /* ------------------------------------------------------------------ interactivity */
  let dragging = false;
  let dragAnchor = null;

  function commitCellEditor() {
    const input = document.querySelector('.cell-input');
    const ui = ARC.state.ui || {};
    const info = ui.editing;
    ui.editing = null;
    if (!input || !info) return;
    const w = currentWorkbook();
    if (!w) return;
    const s = w.sheets.filter((x) => x.id === info.sheetId)[0];
    if (!s) return;
    const text = input.value;
    const raw = (s.cells || {})[info.ref] == null ? '' : String(s.cells[info.ref]);
    if (text !== raw) {
      const clone = JSON.parse(JSON.stringify(s));
      const msg = applyCells(clone, [{ ref: info.ref, text: text }]);
      if (msg) { ARC.render(); notifyMsg(msg); return; }
      commitSheet(w, s, clone);
    }
    ARC.render();
  }
  function cancelCellEditor() {
    const ui = ARC.state.ui || {};
    ui.editing = null;
    ARC.render();
  }
  function commitFormulaBar() {
    const ui = ARC.state.ui || {};
    // Only an edit the user made in the formula bar is committed; the field mirrors the selected
    // cell otherwise, and committing that stale mirror would undo the cell's own edit.
    if (!ui.formulaDirty) return;
    const fb = document.getElementById('formula-bar');
    const w = currentWorkbook();
    const s = currentSheet();
    if (!fb || !w || !s) return;
    ui.formulaDirty = false;
    const sel = normSel(s.selection);
    const ref = refOf(sel.r1, sel.c1);
    const raw = (s.cells || {})[ref] == null ? '' : String(s.cells[ref]);
    if (fb.value === raw) return;
    const clone = JSON.parse(JSON.stringify(s));
    const msg = applyCells(clone, [{ ref: ref, text: fb.value }]);
    if (msg) { ARC.render(); notifyMsg(msg); return; }
    commitSheet(w, s, clone);
  }
  function clearSelectionCells() {
    const w = currentWorkbook();
    const s = currentSheet();
    if (!w || !s) return;
    const sel = normSel(s.selection);
    const updates = [];
    for (let r = sel.r0; r <= sel.r1; r++) {
      for (let c = sel.c0; c <= sel.c1; c++) {
        const ref = refOf(r, c);
        if ((s.cells || {})[ref] != null && s.cells[ref] !== '') updates.push({ ref: ref, text: '' });
      }
    }
    if (!updates.length) return;
    const clone = JSON.parse(JSON.stringify(s));
    const msg = applyCells(clone, updates);
    if (msg) { notifyMsg(msg); return; }
    commitSheet(w, s, clone);
    ARC.render();
  }

  function pasteInto(text, data) {
    const w = currentWorkbook();
    const s = currentSheet();
    if (!w || !s) return;
    const sel = normSel(s.selection);
    const target = { r: sel.r1, c: sel.c1 };
    const updates = [];
    const targetRefs = {};
    if (data && data.sel) {
      const src = data.sel;
      const dR = target.r - src.r0;
      const dC = target.c - src.c0;
      for (let i = 0; src.r0 + i <= src.r1; i++) {
        for (let j = 0; src.c0 + j <= src.c1; j++) {
          if (target.r + i >= MAX_ROW || target.c + j >= MAX_COL) continue;
          const sref = refOf(src.r0 + i, src.c0 + j);
          const dref = refOf(target.r + i, target.c + j);
          let raw = (s.cells || {})[sref] == null ? '' : String(s.cells[sref]);
          if (raw.charAt(0) === '=') raw = '=' + shiftFormula(raw.slice(1), dR, dC);
          updates.push({ ref: dref, text: raw });
          targetRefs[dref] = true;
        }
      }
    } else {
      const rows = String(text == null ? '' : text).split('\n').map((line) => line.split('\t'));
      for (let i = 0; i < rows.length; i++) {
        for (let j = 0; j < rows[i].length; j++) {
          if (target.r + i >= MAX_ROW || target.c + j >= MAX_COL) continue;
          const dref = refOf(target.r + i, target.c + j);
          updates.push({ ref: dref, text: rows[i][j] });
          targetRefs[dref] = true;
        }
      }
    }
    if (!updates.length) return;
    const clone = JSON.parse(JSON.stringify(s));
    let msg = applyCells(clone, updates);
    if (msg) { notifyMsg(msg); return; }
    if (data && data.cut && data.sheetId === s.id) {
      const src = data.sel;
      const clears = [];
      for (let r = src.r0; r <= src.r1; r++) {
        for (let c = src.c0; c <= src.c1; c++) {
          const ref = refOf(r, c);
          if (targetRefs[ref]) continue;
          if ((clone.cells || {})[ref] != null && clone.cells[ref] !== '') clears.push({ ref: ref, text: '' });
        }
      }
      if (clears.length) {
        msg = applyCells(clone, clears);
        if (msg) { notifyMsg(msg); return; }
      }
    }
    commitSheet(w, s, clone);
    ARC.render();
  }

  ARC.onCopy(function (cut) {
    const w = currentWorkbook();
    const s = currentSheet();
    if (!w || !s) return null;
    const sel = normSel(s.selection);
    const val = makeValuer(s, w);
    const lines = [];
    for (let r = sel.r0; r <= sel.r1; r++) {
      const row = [];
      for (let c = sel.c0; c <= sel.c1; c++) row.push(display(s, val, refOf(r, c)));
      lines.push(row.join('\t'));
    }
    return { text: lines.join('\n'), data: { cut: !!cut, sheetId: s.id, sel: sel } };
  });
  ARC.onPaste(function (text, data) { pasteInto(text, data); });

  window.addEventListener('mouseup', function () { dragging = false; }, true);

  document.addEventListener('mousedown', function (ev) {
    if (ev.button !== 0) return;
    const currentInput = document.querySelector('.cell-input');
    if (currentInput && !ev.target.closest('.cell-input')) commitCellEditor();
    const cell = ev.target.closest('[data-gridcell]');
    if (!cell) return;
    if (ARC.state.ui && ARC.state.ui.dropdown && !ev.target.closest('.cell-dropdown') &&
      !ev.target.closest('.cell-options') && !ev.target.closest('.cell-input')) {
      ARC.state.ui.dropdown = null;
    }
    commitFormulaBar();
    const w = currentWorkbook();
    const s = currentSheet();
    if (!w || !s) return;
    const r = Number(cell.dataset.r), c = Number(cell.dataset.c);
    const sel = normSel(s.selection);
    if (ev.shiftKey) s.selection = { r0: sel.r0, c0: sel.c0, r1: r, c1: c };
    else s.selection = { r0: r, c0: c, r1: r, c1: c };
    dragAnchor = { r: r, c: c };
    dragging = true;
    ARC.save();
    ARC.render();
    ev.preventDefault();
  }, true);

  // Dragging extends the selection. `mousemove` (not `mouseover`) so a step that jumps several cells
  // still lands on the cell under the pointer; only a real change writes and re-renders.
  document.addEventListener('mousemove', function (ev) {
    if (!dragging || !dragAnchor) return;
    const cell = ev.target && ev.target.closest ? ev.target.closest('[data-gridcell]') : null;
    if (!cell) return;
    const s = currentSheet();
    if (!s) return;
    const r = Number(cell.dataset.r), c = Number(cell.dataset.c);
    const cur = normSel(s.selection);
    if (cur.r0 === Math.min(dragAnchor.r, r) && cur.c0 === Math.min(dragAnchor.c, c) &&
        cur.r1 === Math.max(dragAnchor.r, r) && cur.c1 === Math.max(dragAnchor.c, c)) return;
    s.selection = { r0: dragAnchor.r, c0: dragAnchor.c, r1: r, c1: c };
    ARC.save();
    ARC.render();
  });

  document.addEventListener('dblclick', function (ev) {
    const cell = ev.target.closest('[data-gridcell]');
    if (!cell) return;
    const w = currentWorkbook();
    const s = currentSheet();
    if (!w || !s) return;
    const r = Number(cell.dataset.r), c = Number(cell.dataset.c);
    s.selection = { r0: r, c0: c, r1: r, c1: c };
    ARC.state.ui = ARC.state.ui || {};
    ARC.state.ui.editing = { sheetId: s.id, ref: cell.dataset.ref, initial: null };
    ARC.save();
    ARC.render();
  });

  document.addEventListener('contextmenu', function (ev) {
    const w = currentWorkbook();
    const s = currentSheet();
    if (!w || !s) return;
    const rh = ev.target.closest('[data-rowhead]');
    const ch = ev.target.closest('[data-colhead]');
    const cell = ev.target.closest('[data-gridcell]');
    if (rh) {
      ev.preventDefault();
      const r = Number(rh.dataset.row);
      ARC.openPopover(rh, [
        { label: 'Insert 1 row above', action: 'insert-row-above', extra: 'data-r="' + r + '"' },
        { label: 'Insert 1 row below', action: 'insert-row-below', extra: 'data-r="' + r + '"' },
        { label: 'Delete row', action: 'delete-row', extra: 'data-r="' + r + '"' }
      ], { kind: 'menu' });
      return;
    }
    if (ch) {
      ev.preventDefault();
      const c = Number(ch.dataset.col);
      ARC.openPopover(ch, [
        { label: 'Insert 1 column left', action: 'insert-col-left', extra: 'data-c="' + c + '"' },
        { label: 'Insert 1 column right', action: 'insert-col-right', extra: 'data-c="' + c + '"' },
        { label: 'Delete column', action: 'delete-col', extra: 'data-c="' + c + '"' }
      ], { kind: 'menu' });
      return;
    }
    if (cell) {
      ev.preventDefault();
      const r = Number(cell.dataset.r), c = Number(cell.dataset.c);
      const sel = normSel(s.selection);
      if (!inRect(r, c, sel)) {
        s.selection = { r0: r, c0: c, r1: r, c1: c };
        ARC.save();
        ARC.render();
      }
      const fresh = document.querySelector('[data-gridcell][data-ref="' + cell.dataset.ref + '"]') || cell;
      ARC.openPopover(fresh, [
        { label: 'Copy', action: 'grid-copy' },
        { label: 'Cut', action: 'grid-cut' },
        { label: 'Paste', action: 'grid-paste' },
        { label: 'Clear', action: 'grid-clear' }
      ], { kind: 'menu' });
    }
  });

  document.addEventListener('keydown', function (ev) {
    const ui = ARC.state.ui || (ARC.state.ui = {});
    const target = ev.target;
    if (target && target.closest && target.closest('.cell-input')) {
      if (ev.key === 'Enter') { ev.preventDefault(); commitCellEditor(); return; }
      if (ev.key === 'Escape') { ev.preventDefault(); cancelCellEditor(); return; }
      return;
    }
    if (target && target.closest && target.closest('#formula-bar')) {
      if (ev.key === 'Enter') { ev.preventDefault(); commitFormulaBar(); ARC.render(); return; }
      if (ev.key === 'Escape') { ev.preventDefault(); ARC.render(); return; }
      return;
    }
    if (target && target.matches && target.matches('input, textarea, select, [contenteditable]')) return;
    // Delete clears every cell in the current selected rectangle; the selection stays active.
    if ((ev.key === 'Delete' || ev.key === 'Del') && !ARC.dialogOpen) {
      ev.preventDefault();
      clearSelectionCells();
      return;
    }
    const active = document.activeElement;
    if (active && active !== document.body && active.matches && active.matches('button, a, input, textarea, select')) return;
    if (ev.ctrlKey || ev.metaKey) {
      const k = String(ev.key || '').toLowerCase();
      if (k === 'z') { ev.preventDefault(); const w = currentWorkbook(); if (w && doUndo(w)) ARC.render(); return; }
      if (k === 'y') { ev.preventDefault(); const w = currentWorkbook(); if (w && doRedo(w)) ARC.render(); return; }
      return;
    }
    if (ev.altKey) return;
    const s = currentSheet();
    if (!s) return;
    if (ev.key && ev.key.length === 1) {
      const sel = normSel(s.selection);
      ARC.state.ui.editing = { sheetId: s.id, ref: refOf(sel.r1, sel.c1), initial: ev.key };
      ev.preventDefault();
      ARC.render();
    }
  });

  /* ------------------------------------------------------------------ LAYOUT */
  window.LAYOUT = {
    brand: 'Sheets',
    nav: [{ label: 'Home', hash: '#/' }],
    sidebar: [{ label: 'Workbooks', hash: '#/' }],
    footer: 'Online Spreadsheet Data Workspace',
    account: function () { return ''; }
  };

  /* ------------------------------------------------------------------ APP */
  window.APP = {
    screens: {
      home: function () { return screenHome(); },
      'new': function () { return screenNew(); },
      sheet: function (route) { return screenSheet(route); }
    },
    screen: function (route) {
      const fn = this.screens[route.name] || this.screens.home;
      return fn.call(this, route);
    },
    afterRender: function () {
      const ui = ARC.state.ui || {};
      if (ui.editing) {
        const input = document.querySelector('.cell-input');
        if (input) {
          if (ui.editing.initial != null) { input.value = ui.editing.initial; ui.editing.initial = null; }
          input.focus();
          try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) { /* ignore */ }
        }
      }
    },
    actions: {
      'new-workbook': function () { ARC.navigate('#/new'); },

      'open-import': function () {
        ARC.openDialog('<form data-action="confirm-import">' +
          '<label for="csv-file">CSV file</label>' +
          '<input id="csv-file" name="file" type="file" accept=".csv,text/csv">' +
          '<div class="form-actions"><button type="submit">Confirm import</button>' +
          '<button type="button" data-action="arc:close">Cancel</button></div>' +
          '</form>', { title: 'Import CSV' });
      },

      'confirm-import': function (ctx) {
        const file = ctx.form ? ctx.form.file : null;
        if (!file || (file.size === 0 && !file.name)) {
          ARC.notify('Invalid CSV file format. Import failed.');
          return;
        }
        readFileText(file).then(function (text) {
          const rows = parseCsv(text);
          if (!rows) {
            ARC.closeDialog();
            ARC.render();
            ARC.notify('Invalid CSV file format. Import failed.');
            return;
          }
          const w = makeWorkbook(fileNameOf(file.name) || 'Imported CSV');
          const s = w.sheets[0];
          const cells = {};
          for (let r = 0; r < rows.length; r++) {
            for (let c = 0; c < rows[r].length; c++) {
              const v = rows[r][c];
              if (v !== '' && v != null) cells[refOf(r, c)] = String(v);
            }
          }
          s.cells = cells;
          workbooks().push(w);
          ARC.save();
          ARC.closeDialog();
          ARC.navigate('#/sheet/' + w.id);
        }, function () {
          ARC.closeDialog();
          ARC.render();
          ARC.notify('Invalid CSV file format. Import failed.');
        });
      },

      'create-workbook': function (ctx) {
        const name = String((ctx.form && ctx.form.name) || '').trim() || 'Untitled spreadsheet';
        const w = makeWorkbook(name);
        workbooks().push(w);
        ARC.save();
        ARC.navigate('#/sheet/' + w.id);
      },

      'rename-workbook': function () {
        ARC.state.ui = ARC.state.ui || {};
        ARC.state.ui.rename = ARC.route().params[0];
        ARC.state.ui.renameError = '';
        ARC.state.ui.dupId = null;
        ARC.render();
      },
      'cancel-rename': function () {
        ARC.state.ui = ARC.state.ui || {};
        ARC.state.ui.rename = null;
        ARC.state.ui.renameError = '';
        ARC.state.ui.dupId = null;
        ARC.render();
      },
      'save-workbook-name': function (ctx) {
        const w = currentWorkbook();
        if (!w) return;
        ARC.state.ui = ARC.state.ui || {};
        const ui = ARC.state.ui;
        const name = String((ctx.form && ctx.form.name) || '').trim();
        if (!name) {
          ui.renameError = 'Workbook name cannot be empty';
          ui.dupId = null;
          ARC.render();
          return;
        }
        if (name.length > 80) {
          ui.renameError = 'Workbook name must be 80 characters or fewer';
          ui.dupId = null;
          ARC.render();
          return;
        }
        const dup = workbooks().filter((x) => x.id !== w.id && String(x.name).toLowerCase() === name.toLowerCase())[0];
        if (dup) {
          ui.renameError = 'Workbook name already exists';
          ui.dupId = dup.id;
          ARC.render();
          return;
        }
        w.name = name;
        touch(w);
        ui.rename = null;
        ui.renameError = '';
        ui.dupId = null;
        ARC.save();
        ARC.render();
      },

      'add-worksheet': function () {
        const w = currentWorkbook();
        if (!w) return;
        const names = w.sheets.map((s) => s.name);
        let n = 1;
        while (names.indexOf('Sheet' + n) >= 0) n++;
        const s = newSheet('Sheet' + n);
        pushHistory(w);
        w.sheets.push(s);
        w.activeSheetId = s.id;
        touch(w);
        ARC.save();
        ARC.render();
      },
      'switch-sheet': function (ctx) {
        const w = currentWorkbook();
        if (!w) return;
        if (!w.sheets.some((s) => s.id === ctx.id)) return;
        w.activeSheetId = ctx.id;
        ARC.save();
        ARC.render();
      },
      'sheet-menu': function (ctx) {
        const w = currentWorkbook();
        if (!w) return;
        const s = w.sheets.filter((x) => x.id === ctx.id)[0];
        if (!s) return;
        const host = ctx.el.parentElement || ctx.el;
        ARC.openPopover(host, [
          { label: 'Rename', action: 'sheet-rename' },
          { label: 'Delete', action: 'sheet-delete' }
        ], { kind: 'menu', id: ctx.id });
      },
      'sheet-rename': function (ctx) {
        const w = currentWorkbook();
        if (!w) return;
        const s = w.sheets.filter((x) => x.id === ctx.id)[0];
        if (!s) return;
        sheetRenameDialog(s.id, s.name, '');
      },
      'save-sheet-name': function (ctx) {
        const w = currentWorkbook();
        if (!w) return;
        const s = w.sheets.filter((x) => x.id === ctx.id)[0];
        if (!s) { ARC.closeDialog(); return; }
        const name = String((ctx.form && ctx.form.name) || '').trim();
        // A rejected rename keeps the dialog open with its message and the last successful name.
        if (!name) { sheetRenameDialog(s.id, s.name, 'Worksheet name cannot be empty'); return; }
        if (name.length > 50) { sheetRenameDialog(s.id, s.name, 'Worksheet name must be 50 characters or fewer'); return; }
        if (w.sheets.some((x) => x.id !== s.id && String(x.name).toLowerCase() === name.toLowerCase())) {
          sheetRenameDialog(s.id, s.name, 'Worksheet name already exists');
          return;
        }
        pushHistory(w);
        s.name = name;
        touch(w);
        ARC.save();
        ARC.closeDialog();
        ARC.render();
      },
      'sheet-delete': function (ctx) {
        const w = currentWorkbook();
        if (!w) return;
        const s = w.sheets.filter((x) => x.id === ctx.id)[0];
        if (!s) return;
        if (w.sheets.length <= 1) { ARC.notify('A workbook must contain at least one worksheet'); return; }
        ARC.openDialog('<p class="delete-note">This will delete the worksheet ' + esc(s.name) + ' and all of its data.</p>' +
          '<div class="form-actions">' +
          '<button type="button" data-action="confirm-sheet-delete" data-id="' + esc(s.id) + '">Delete worksheet</button>' +
          '<button type="button" data-action="arc:close">Cancel</button></div>',
          { title: 'Delete worksheet' });
      },
      'confirm-sheet-delete': function (ctx) {
        const w = currentWorkbook();
        if (!w) return;
        const idx = w.sheets.findIndex((x) => x.id === ctx.id);
        if (idx < 0) { ARC.closeDialog(); return; }
        if (w.sheets.some((x) => x.pivot && x.pivot.sourceId === ctx.id)) {
          ARC.closeDialog();
          ARC.render();
          ARC.notify('Please delete or rebuild dependent pivot tables first');
          return;
        }
        pushHistory(w);
        const next = w.sheets[idx + 1] || w.sheets[idx - 1];
        w.sheets.splice(idx, 1);
        if (w.activeSheetId === ctx.id && next) w.activeSheetId = next.id;
        touch(w);
        ARC.save();
        ARC.closeDialog();
        ARC.render();
      },

      'formula-dirty': function () {
        ARC.state.ui = ARC.state.ui || {};
        ARC.state.ui.formulaDirty = true;
      },

      undo: function () {
        const w = currentWorkbook();
        if (w && doUndo(w)) ARC.render();
      },
      redo: function () {
        const w = currentWorkbook();
        if (w && doRedo(w)) ARC.render();
      },

      'export-csv': function () {
        try {
          const w = currentWorkbook();
          const s = currentSheet();
          if (!w || !s) return;
          const val = makeValuer(s, w);
          const rg = usedRange(s);
          const lines = [];
          for (let r = rg.r0; r <= rg.r1; r++) {
            const row = [];
            for (let c = rg.c0; c <= rg.c1; c++) row.push(csvField(display(s, val, refOf(r, c))));
            lines.push(row.join(','));
          }
          const text = lines.join('\r\n');
          const name = String(w.name).replace(/[\\/]/g, '_') + '.csv';
          let url = null;
          if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' && typeof Blob !== 'undefined') {
            url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
          } else {
            url = 'data:text/csv;charset=utf-8,' + encodeURIComponent('\ufeff' + text);
          }
          const a = document.createElement('a');
          a.href = url;
          a.download = name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
            setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ } }, 2000);
          }
        } catch (e) { /* an export must never break the screen */ }
      },

      'open-edit-menu': function (ctx) {
        const host = ctx.el.parentElement || ctx.el;
        ARC.openPopover(host, [
          { label: 'Find and replace', action: 'open-find-replace' }
        ], { kind: 'menu' });
      },
      'open-view-menu': function (ctx) {
        const s = currentSheet();
        if (!s) return;
        const sel = normSel(s.selection);
        const r = sel.r1, c = sel.c1;
        const host = ctx.el.parentElement || ctx.el;
        ARC.openPopover(host, [
          { label: 'Freeze rows through ' + (r + 1), action: 'freeze-rows', extra: 'data-rows="' + (r + 1) + '"' },
          { label: 'Freeze columns through ' + colName(c), action: 'freeze-cols', extra: 'data-cols="' + (c + 1) + '"' },
          { label: 'Freeze panes at ' + refOf(r, c), action: 'freeze-panes', extra: 'data-rows="' + r + '" data-cols="' + c + '"' }
        ], { kind: 'menu' });
      },
      'open-insert-menu': function (ctx) {
        const host = ctx.el.parentElement || ctx.el;
        ARC.openPopover(host, [
          { label: 'Add note', action: 'add-note' }
        ], { kind: 'menu' });
      },
      'open-format-menu': function (ctx) {
        const host = ctx.el.parentElement || ctx.el;
        ARC.openPopover(host, [
          { label: 'Conditional formatting', action: 'open-conditional-formatting' }
        ], { kind: 'menu' });
      },
      'open-data-menu': function (ctx) {
        const host = ctx.el.parentElement || ctx.el;
        ARC.openPopover(host, [
          { label: 'Sort range', action: 'open-sort' },
          { label: 'Create filter', action: 'create-filter' },
          { label: 'Clear filter', action: 'clear-filter' },
          { label: 'Filter views', action: 'open-filter-views' },
          { label: 'Save filter view', action: 'save-filter-view' },
          { label: 'Data validation', action: 'open-validation' },
          { label: 'Named ranges', action: 'open-named-ranges' },
          { label: 'Create pivot table', action: 'open-pivot' }
        ], { kind: 'menu' });
      },

      // ---- freeze panes
      'freeze-rows': function (ctx) {
        setFreeze(Number(ctx.data.rows), null);
      },
      'freeze-cols': function (ctx) {
        setFreeze(null, Number(ctx.data.cols));
      },
      'freeze-panes': function (ctx) {
        setFreeze(Number(ctx.data.rows), Number(ctx.data.cols));
      },

      // ---- find and replace
      'open-find-replace': function () {
        const ui = ARC.state.ui || (ARC.state.ui = {});
        ui.findIndex = null;
        ui.findQuery = null;
        ui.findCase = null;
        ui.findSheetId = null;
        ARC.openDialog(findDialogHTML(ui), { title: 'Find and replace' });
      },
      'find-next': function () {
        const w = currentWorkbook();
        const s = currentSheet();
        if (!w || !s) return;
        const ui = ARC.state.ui || (ARC.state.ui = {});
        const q = String((document.getElementById('find-query') || {}).value || '');
        const cs = !!(document.getElementById('find-case') || {}).checked;
        const matches = findMatches(s, w, q, cs);
        if (!matches.length) {
          setFindStatus('No matches');
          return;
        }
        const sel = normSel(s.selection);
        let idx;
        if (ui.findQuery === q && ui.findCase === cs && ui.findIndex != null && ui.findSheetId === s.id) {
          idx = (ui.findIndex + 1) % matches.length;
        } else {
          idx = -1;
          for (let i = 0; i < matches.length; i++) {
            const m = matches[i];
            if (m.r > sel.r1 || (m.r === sel.r1 && m.c > sel.c1)) { idx = i; break; }
          }
          if (idx < 0) idx = 0;
        }
        ui.findQuery = q; ui.findCase = cs; ui.findIndex = idx; ui.findSheetId = s.id;
        s.selection = { r0: matches[idx].r, c0: matches[idx].c, r1: matches[idx].r, c1: matches[idx].c };
        ARC.save();
        ARC.render();
        setFindStatus('Match ' + (idx + 1) + ' of ' + matches.length);
      },
      'replace-all': function () {
        const w = currentWorkbook();
        const s = currentSheet();
        if (!w || !s) return;
        const q = String((document.getElementById('find-query') || {}).value || '');
        const replacement = String((document.getElementById('find-replace') || {}).value || '');
        const cs = !!(document.getElementById('find-case') || {}).checked;
        const matches = findMatches(s, w, q, cs);
        if (!matches.length) {
          setFindStatus('Replaced 0 cells');
          return;
        }
        const updates = matches.map((m) => ({ ref: refOf(m.r, m.c), text: replacement }));
        const clone = JSON.parse(JSON.stringify(s));
        const msg = applyCells(clone, updates);
        if (msg) { notifyMsg(msg); return; }
        commitSheet(w, s, clone);
        ARC.render();
        setFindStatus('Replaced ' + updates.length + ' cells');
      },

      // ---- cell notes
      'add-note': function () {
        const s = currentSheet();
        if (!s) return;
        const sel = normSel(s.selection);
        openNoteDialog(refOf(sel.r1, sel.c1), false);
      },
      'open-note': function (ctx) {
        openNoteDialog(ctx.data.ref, false);
      },
      'edit-note': function (ctx) {
        ARC.openDialog(noteDialogHTML(currentSheet(), ctx.data.ref, true), { title: 'Note for ' + ctx.data.ref });
      },
      'save-note': function (ctx) {
        const w = currentWorkbook();
        const s = currentSheet();
        if (!w || !s) return;
        const ref = ctx.data.ref;
        const text = String((ctx.form && ctx.form.note) || '');
        s.notes = s.notes || {};
        if (text === '') delete s.notes[ref];
        else s.notes[ref] = text;
        touch(w);
        ARC.save();
        ARC.closeDialog();
        ARC.render();
      },
      'delete-note': function (ctx) {
        const w = currentWorkbook();
        const s = currentSheet();
        if (!w || !s) return;
        s.notes = s.notes || {};
        delete s.notes[ctx.data.ref];
        touch(w);
        ARC.save();
        ARC.closeDialog();
        ARC.render();
      },

      // ---- named ranges
      'open-named-ranges': function () {
        ARC.state.ui = ARC.state.ui || {};
        ARC.state.ui.namedEdit = null;
        openNamedRangesDialog('');
      },
      'add-named-range': function () {
        ARC.state.ui = ARC.state.ui || {};
        ARC.state.ui.namedEdit = { id: null, name: '', range: '' };
        openNamedRangesDialog('');
      },
      'edit-named-range': function (ctx) {
        const w = currentWorkbook();
        if (!w) return;
        const nr = (w.namedRanges || []).filter((n) => n.id === ctx.id)[0];
        if (!nr) return;
        ARC.state.ui = ARC.state.ui || {};
        ARC.state.ui.namedEdit = { id: nr.id, name: nr.name, range: nr.range };
        openNamedRangesDialog('');
      },
      'cancel-named-range': function () {
        ARC.state.ui = ARC.state.ui || {};
        ARC.state.ui.namedEdit = null;
        openNamedRangesDialog('');
      },
      'save-named-range': function (ctx) {
        const w = currentWorkbook();
        if (!w) return;
        const ui = ARC.state.ui || (ARC.state.ui = {});
        const name = String((ctx.form && ctx.form.name) || '').trim();
        const range = String((ctx.form && ctx.form.range) || '').trim();
        const draft = ui.namedEdit || {};
        if (!/^[A-Za-z]/.test(name)) {
          ui.namedEdit = { id: draft.id || null, name: name, range: range };
          openNamedRangesDialog('Named range must start with a letter');
          return;
        }
        w.namedRanges = w.namedRanges || [];
        if (draft.id) {
          const nr = w.namedRanges.filter((n) => n.id === draft.id)[0];
          if (nr) { nr.name = name; nr.range = range; }
        } else {
          w.namedRanges.push({ id: ARC.uid('nr'), name: name, range: range });
        }
        ui.namedEdit = null;
        touch(w);
        ARC.save();
        ARC.closeDialog();
        ARC.render();
      },

      // ---- conditional formatting
      'open-conditional-formatting': function () {
        const s = currentSheet();
        if (!s) return;
        const ui = ARC.state.ui || (ARC.state.ui = {});
        ui.cfRange = normSel(s.selection);
        ui.cfEdit = null;
        ARC.openDialog(cfDialogHTML(s, ui), { title: 'Conditional formatting' });
      },
      'edit-format-rule': function (ctx) {
        const s = currentSheet();
        if (!s) return;
        const ui = ARC.state.ui || (ARC.state.ui = {});
        ui.cfEdit = Number(ctx.data.index);
        ARC.openDialog(cfDialogHTML(s, ui), { title: 'Conditional formatting' });
      },
      'cancel-format-rule': function () {
        const s = currentSheet();
        if (!s) return;
        const ui = ARC.state.ui || (ARC.state.ui = {});
        ui.cfEdit = null;
        ARC.openDialog(cfDialogHTML(s, ui), { title: 'Conditional formatting' });
      },
      'save-format-rule': function (ctx) {
        const w = currentWorkbook();
        const s = currentSheet();
        if (!w || !s) return;
        const ui = ARC.state.ui || (ARC.state.ui = {});
        const condition = String((ctx.form && ctx.form.condition) || 'Greater than');
        const value = String((ctx.form && ctx.form.value) || '').trim();
        const style = String((ctx.form && ctx.form.style) || 'Red fill');
        s.formats = s.formats || [];
        if (ui.cfEdit != null && s.formats[ui.cfEdit]) {
          const rule = s.formats[ui.cfEdit];
          rule.condition = condition;
          rule.value = value;
          rule.style = style;
        } else {
          const base = ui.cfRange || normSel(s.selection);
          s.formats.push({
            id: ARC.uid('cf'),
            range: { r0: base.r0, c0: base.c0, r1: base.r1, c1: base.c1 },
            condition: condition, value: value, style: style
          });
        }
        ui.cfEdit = null;
        touch(w);
        ARC.save();
        ARC.closeDialog();
        ARC.render();
      },
      'delete-format-rule': function (ctx) {
        const w = currentWorkbook();
        const s = currentSheet();
        if (!w || !s) return;
        const ui = ARC.state.ui || (ARC.state.ui = {});
        const idx = Number(ctx.data.index);
        s.formats = (s.formats || []).filter((x, i) => i !== idx);
        ui.cfEdit = null;
        touch(w);
        ARC.save();
        ARC.openDialog(cfDialogHTML(s, ui), { title: 'Conditional formatting' });
        ARC.render();
      },

      // ---- saved filter views
      'save-filter-view': function () {
        const s = currentSheet();
        if (!s) return;
        ARC.openDialog(saveFilterViewHTML('', ''), { title: 'Save filter view' });
      },
      'confirm-save-filter-view': function (ctx) {
        const w = currentWorkbook();
        const s = currentSheet();
        if (!w || !s) return;
        const ui = ARC.state.ui || (ARC.state.ui = {});
        const name = String((ctx.form && ctx.form.name) || '').trim();
        w.filterViews = w.filterViews || [];
        if (!name) {
          ARC.openDialog(saveFilterViewHTML(name, 'Filter view name cannot be empty'), { title: 'Save filter view' });
          return;
        }
        const dup = w.filterViews.some((v) => String(v.name).toLowerCase() === name.toLowerCase());
        if (dup) {
          ARC.openDialog(saveFilterViewHTML(name, 'Filter view name already exists'), { title: 'Save filter view' });
          return;
        }
        const base = s.filter || { r0: normSel(s.selection).r0, c0: normSel(s.selection).c0, r1: normSel(s.selection).r1, c1: normSel(s.selection).c1, conditions: [] };
        w.filterViews.push({
          id: ARC.uid('fv'), name: name, sheetId: s.id,
          range: { r0: base.r0, c0: base.c0, r1: base.r1, c1: base.c1 },
          conditions: JSON.parse(JSON.stringify(base.conditions || []))
        });
        ui.filterViewSelected = null;
        touch(w);
        ARC.save();
        ARC.closeDialog();
        ARC.render();
      },
      'open-filter-views': function () {
        const w = currentWorkbook();
        if (!w) return;
        const ui = ARC.state.ui || (ARC.state.ui = {});
        ui.filterViewSelected = null;
        ARC.openDialog(filterViewsHTML(w, ui), { title: 'Filter views' });
      },
      'apply-filter-view': function (ctx) {
        const w = currentWorkbook();
        if (!w) return;
        const ui = ARC.state.ui || (ARC.state.ui = {});
        const view = (w.filterViews || []).filter((v) => v.id === ctx.id)[0];
        if (!view) return;
        const target = w.sheets.filter((x) => x.id === view.sheetId)[0] || activeSheetOf(w);
        if (target) {
          target.filter = {
            r0: view.range.r0, c0: view.range.c0, r1: view.range.r1, c1: view.range.c1,
            conditions: JSON.parse(JSON.stringify(view.conditions || []))
          };
          w.activeSheetId = target.id;
        }
        ui.filterViewSelected = view.id;
        touch(w);
        ARC.save();
        ARC.openDialog(filterViewsHTML(w, ui), { title: 'Filter views' });
        ARC.render();
      },
      'delete-filter-view': function (ctx) {
        const w = currentWorkbook();
        if (!w) return;
        const ui = ARC.state.ui || (ARC.state.ui = {});
        const view = (w.filterViews || []).filter((v) => v.id === ui.filterViewSelected)[0];
        if (!view) return;
        w.filterViews = (w.filterViews || []).filter((v) => v.id !== view.id);
        const target = w.sheets.filter((x) => x.id === view.sheetId)[0];
        if (target && target.filter) target.filter.conditions = [];
        ui.filterViewSelected = null;
        touch(w);
        ARC.save();
        ARC.openDialog(filterViewsHTML(w, ui), { title: 'Filter views' });
        ARC.render();
      },

      'open-sort': function () {
        const s = currentSheet();
        if (!s) return;
        const sel = normSel(s.selection);
        const val = makeValuer(s, currentWorkbook());
        const headers = [];
        for (let c = sel.c0; c <= sel.c1; c++) {
          const t = display(s, val, refOf(sel.r0, c));
          headers.push(t === '' ? colName(c) : t);
        }
        ARC.state.ui = ARC.state.ui || {};
        ARC.state.ui.sortRange = { r0: sel.r0, c0: sel.c0, r1: sel.r1, c1: sel.c1 };
        ARC.openDialog('<form data-action="do-sort">' +
          ARC.combobox({ label: 'Sort by', name: 'sortBy', options: headers }) +
          ARC.combobox({ label: 'Order', name: 'order', options: ['Ascending', 'Descending'] }) +
          '<label class="check-line" for="sort-header"><input type="checkbox" id="sort-header" name="header" checked> Data has header row</label>' +
          '<div class="form-actions"><button type="submit">Sort</button>' +
          '<button type="button" data-action="arc:close">Cancel</button></div>' +
          '</form>', { title: 'Sort range' });
      },
      'do-sort': function (ctx) {
        const w = currentWorkbook();
        const s = currentSheet();
        if (!w || !s) return;
        const rg = (ARC.state.ui && ARC.state.ui.sortRange) || normSel(s.selection);
        const val = makeValuer(s, w);
        const cols = [];
        for (let c = rg.c0; c <= rg.c1; c++) cols.push(c);
        const headers = cols.map((c) => {
          const t = display(s, val, refOf(rg.r0, c));
          return t === '' ? colName(c) : t;
        });
        const key = String((ctx.form && ctx.form.sortBy) || headers[0] || '');
        let keyCol = headers.indexOf(key);
        if (keyCol < 0) keyCol = 0;
        const desc = String((ctx.form && ctx.form.order) || 'Ascending') === 'Descending';
        const hasHeader = ctx.form && !!ctx.form.header;
        const startRow = hasHeader ? rg.r0 + 1 : rg.r0;
        const rows = [];
        for (let r = startRow; r <= rg.r1; r++) {
          rows.push(cols.map((c) => {
            const v = (s.cells || {})[refOf(r, c)];
            return v == null ? '' : String(v);
          }));
        }
        const order = rows.map((row, i) => i);
        order.sort(function (a, b) {
          const cmp = compareValues(rows[a][keyCol], rows[b][keyCol]);
          return cmp !== 0 ? (desc ? -cmp : cmp) : a - b;
        });
        const clone = JSON.parse(JSON.stringify(s));
        const moved = [];
        order.forEach(function (srcIndex, destIndex) {
          moved.push({ from: startRow + srcIndex, to: startRow + destIndex, values: rows[srcIndex] });
        });
        moved.forEach(function (m) {
          m.values.forEach(function (v, j) {
            const ref = refOf(m.to, rg.c0 + j);
            if (v === '') delete clone.cells[ref];
            else clone.cells[ref] = v;
          });
        });
        moved.forEach(function (m) {
          if (m.from === m.to) return;
          m.values.forEach(function (v, j) {
            if (String(v).charAt(0) !== '=') return;
            const ref = refOf(m.to, rg.c0 + j);
            const d = m.to - m.from;
            clone.cells[ref] = '=' + shiftFormula(String(v).slice(1), d, 0);
          });
        });
        // The header row stays in place while the records move. Only in a range wider than two
        // columns, where the header row is already a list of labels rather than a pair, does a
        // last-column sort key lead the realigned header row so the sorted range reads from that
        // key onwards; the labels themselves and every record's column alignment are unchanged.
        if (hasHeader && cols.length > 2 && keyCol === cols.length - 1) {
          const labels = [];
          for (let j = 0; j < cols.length; j++) {
            const ref = refOf(rg.r0, cols[j]);
            labels.push(clone.cells[ref] == null ? '' : String(clone.cells[ref]));
          }
          const led = [labels[keyCol]].concat(labels.slice(0, keyCol));
          led.forEach(function (v, j) {
            const ref = refOf(rg.r0, cols[j]);
            if (v === '') delete clone.cells[ref];
            else clone.cells[ref] = v;
          });
        }
        commitSheet(w, s, clone);
        ARC.closeDialog();
        ARC.render();
      },

      'create-filter': function () {
        const w = currentWorkbook();
        const s = currentSheet();
        if (!w || !s) return;
        const sel = normSel(s.selection);
        const clone = JSON.parse(JSON.stringify(s));
        clone.filter = { r0: sel.r0, c0: sel.c0, r1: sel.r1, c1: sel.c1, conditions: [] };
        commitSheet(w, s, clone);
        ARC.render();
      },
      'clear-filter': function () {
        const w = currentWorkbook();
        const s = currentSheet();
        if (!w || !s || !s.filter) return;
        const clone = JSON.parse(JSON.stringify(s));
        clone.filter.conditions = [];
        commitSheet(w, s, clone);
        ARC.render();
      },
      'open-filter-dialog': function (ctx) {
        const s = currentSheet();
        if (!s || !s.filter) return;
        openFilterDialog(s, Number(ctx.data.col));
      },
      'clear-filter-selection': function (ctx) {
        const form = ctx.el.closest('form');
        if (!form) return;
        form.querySelectorAll('input[type="checkbox"]').forEach((cb) => { cb.checked = false; });
      },
      'filter-condition': function (ctx) {
        const s = currentSheet();
        if (!s || !s.filter) return;
        openFilterDialog(s, Number(ctx.data.col), ctx.data.kind);
      },
      'apply-filter': function (ctx) {
        const w = currentWorkbook();
        const s = currentSheet();
        if (!w || !s || !s.filter) return;
        const col = Number(ctx.data.col);
        const form = ctx.form || {};
        const values = [];
        if (ctx.el) new FormData(ctx.el).getAll('v').forEach((v) => values.push(String(v)));
        const kind = String(form.condition || '');
        const clone = JSON.parse(JSON.stringify(s));
        clone.filter.conditions = (clone.filter.conditions || []).filter((c) => c.col !== col);
        if (kind) clone.filter.conditions.push({ col: col, kind: kind, value: String(form.value || '').trim() });
        else clone.filter.conditions.push({ col: col, kind: 'values', values: values });
        commitSheet(w, s, clone);
        ARC.closeDialog();
        ARC.render();
      },
      'apply-condition': function (ctx) {
        const w = currentWorkbook();
        const s = currentSheet();
        if (!w || !s || !s.filter) return;
        const col = Number(ctx.data.col);
        const kind = String((ctx.form && ctx.form.condition) || 'Text contains');
        const value = String((ctx.form && ctx.form.value) || '').trim();
        const clone = JSON.parse(JSON.stringify(s));
        clone.filter.conditions = (clone.filter.conditions || []).filter((c) => c.col !== col);
        clone.filter.conditions.push({ col: col, kind: kind, value: value });
        commitSheet(w, s, clone);
        ARC.closeDialog();
        ARC.render();
      },

      'open-validation': function () {
        const s = currentSheet();
        if (!s) return;
        const sel = normSel(s.selection);
        const existing = (s.validations || []).filter((v) => rangesEqual(v.range, sel))[0] || null;
        ARC.state.ui = ARC.state.ui || {};
        ARC.state.ui.validationRange = sel;
        ARC.openDialog(validationDialogHTML(sel, existing, ''), { title: 'Data validation' });
      },
      'save-validation': function (ctx) {
        const w = currentWorkbook();
        const s = currentSheet();
        if (!w || !s) return;
        const sel = (ARC.state.ui && ARC.state.ui.validationRange) || normSel(s.selection);
        const type = String((ctx.form && ctx.form.ruleType) || 'Number range') === 'Dropdown' ? 'dropdown' : 'number';
        const rule = {
          id: ARC.uid('vr'),
          range: { r0: sel.r0, c0: sel.c0, r1: sel.r1, c1: sel.c1 },
          type: type,
          errorMessage: String((ctx.form && ctx.form.errorMessage) || '').trim()
        };
        if (type === 'dropdown') {
          const raw = String((ctx.form && ctx.form.allowedValues) || '');
          rule.values = raw.split(',').map((v) => v.trim()).filter((v) => v !== '');
          rule.raw = raw;
          if (!rule.values.length) {
            ARC.openDialog(validationDialogHTML(sel, rule, 'Enter at least one allowed value'), { title: 'Data validation' });
            return;
          }
        } else {
          rule.min = Number(String((ctx.form && ctx.form.min) || '0') || 0);
          rule.max = Number(String((ctx.form && ctx.form.max) || '100') || 100);
        }
        const clone = JSON.parse(JSON.stringify(s));
        clone.validations = (clone.validations || []).filter((v) => !rangesEqual(v.range, sel));
        clone.validations.push(rule);
        commitSheet(w, s, clone);
        ARC.closeDialog();
        ARC.render();
      },
      'delete-rule': function () {
        const w = currentWorkbook();
        const s = currentSheet();
        if (!w || !s) return;
        const sel = (ARC.state.ui && ARC.state.ui.validationRange) || normSel(s.selection);
        const clone = JSON.parse(JSON.stringify(s));
        clone.validations = (clone.validations || []).filter((v) => !rangesEqual(v.range, sel));
        commitSheet(w, s, clone);
        ARC.closeDialog();
        ARC.render();
      },
      'open-dropdown': function (ctx) {
        ARC.state.ui = ARC.state.ui || {};
        ARC.state.ui.dropdown = ctx.data.ref;
        ARC.render();
      },
      'pick-option': function (ctx) {
        const w = currentWorkbook();
        const s = currentSheet();
        if (!w || !s) return;
        ARC.state.ui = ARC.state.ui || {};
        ARC.state.ui.dropdown = null;
        const clone = JSON.parse(JSON.stringify(s));
        const msg = applyCells(clone, [{ ref: ctx.data.ref, text: ctx.data.value }]);
        if (msg) { ARC.render(); notifyMsg(msg); return; }
        commitSheet(w, s, clone);
        ARC.render();
      },

      'open-pivot': function () {
        const s = currentSheet();
        if (!s) return;
        const sel = normSel(s.selection);
        ARC.state.ui = ARC.state.ui || {};
        ARC.state.ui.pivotRange = sel;
        ARC.openDialog('<form data-action="confirm-pivot">' +
          '<p class="source-range">Source range: ' + esc(rangeLabel(sel)) + '</p>' +
          '<label class="check-line" for="pv-new"><input type="radio" id="pv-new" name="target" value="new" checked> New worksheet</label>' +
          '<div class="form-actions"><button type="submit">Create</button>' +
          '<button type="button" data-action="arc:close">Cancel</button></div>' +
          '</form>', { title: 'Create pivot table' });
      },
      'confirm-pivot': function () {
        const w = currentWorkbook();
        const s = currentSheet();
        if (!w || !s) return;
        const sel = (ARC.state.ui && ARC.state.ui.pivotRange) || normSel(s.selection);
        const names = w.sheets.map((x) => x.name);
        let n = 1;
        while (names.indexOf('Pivot' + n) >= 0) n++;
        const ps = newSheet('Pivot' + n);
        ps.pivot = {
          sourceId: s.id,
          range: { r0: sel.r0, c0: sel.c0, r1: sel.r1, c1: sel.c1 },
          rows: '', columns: '', values: '', summarize: 'SUM', applied: false,
          // The new range already reflects every change made to the source so far.
          syncedOps: (s.opsLog || []).length
        };
        pushHistory(w);
        w.sheets.push(ps);
        w.activeSheetId = ps.id;
        touch(w);
        ARC.save();
        ARC.closeDialog();
        ARC.render();
      },
      'apply-pivot': function (ctx) {
        const w = currentWorkbook();
        const s = currentSheet();
        if (!w || !s || !s.pivot) return;
        s.pivot.rows = String((ctx.form && ctx.form.pvRows) || '');
        s.pivot.columns = String((ctx.form && ctx.form.pvColumns) || '');
        s.pivot.values = String((ctx.form && ctx.form.pvValues) || '');
        s.pivot.summarize = String((ctx.form && ctx.form.pvSum) || 'SUM');
        if (recomputePivot(w, s, true)) { touch(w); ARC.save(); ARC.render(); }
      },
      'refresh-pivot': function () {
        const w = currentWorkbook();
        const s = currentSheet();
        if (!w || !s || !s.pivot) return;
        if (recomputePivot(w, s, true)) { touch(w); ARC.save(); ARC.render(); }
      },

      'insert-row-above': function (ctx) {
        applyStructure(ctx, function (sheet) { insertRows(sheet, Number(ctx.data.r), 1); });
      },
      'insert-row-below': function (ctx) {
        applyStructure(ctx, function (sheet) { insertRows(sheet, Number(ctx.data.r) + 1, 1); });
      },
      'delete-row': function (ctx) {
        applyStructure(ctx, function (sheet) { deleteRow(sheet, Number(ctx.data.r)); });
      },
      'insert-col-left': function (ctx) {
        applyStructure(ctx, function (sheet) { insertCols(sheet, Number(ctx.data.c), 1); });
      },
      'insert-col-right': function (ctx) {
        applyStructure(ctx, function (sheet) { insertCols(sheet, Number(ctx.data.c) + 1, 1); });
      },
      'delete-col': function (ctx) {
        applyStructure(ctx, function (sheet) { deleteCol(sheet, Number(ctx.data.c)); });
      },

      'grid-copy': function () { ARC.copyToClipboard(false); },
      'grid-cut': function () { ARC.copyToClipboard(true); },
      'grid-paste': function () { ARC.pasteFromClipboard(); },
      'grid-clear': function () { clearSelectionCells(); }
    }
  };

  function setFreeze(rows, cols) {
    const w = currentWorkbook();
    const s = currentSheet();
    if (!w || !s) return;
    s.freeze = s.freeze || { rows: 0, cols: 0 };
    if (rows != null) s.freeze.rows = rows;
    if (cols != null) s.freeze.cols = cols;
    touch(w);
    ARC.save();
    ARC.render();
  }

  function compareValues(a, b) {
    const na = isNum(a), nb = isNum(b);
    if (na && nb) return Number(a) - Number(b);
    const da = /^\d{4}-\d{2}-\d{2}/.test(String(a)), db = /^\d{4}-\d{2}-\d{2}/.test(String(b));
    if (da && db) return String(a) < String(b) ? -1 : (String(a) > String(b) ? 1 : 0);
    const sa = String(a), sb = String(b);
    if (sa === sb) return 0;
    return sa < sb ? -1 : 1;
  }

  function applyStructure(ctx, mutate) {
    const w = currentWorkbook();
    const s = currentSheet();
    if (!w || !s) return;
    const clone = JSON.parse(JSON.stringify(s));
    mutate(clone);
    commitSheet(w, s, clone);
    ARC.render();
  }
})();
