'use strict';
// Online Spreadsheet Data Workspace: workbook home page, workbook creation, CSV import/export,
// worksheet lifecycle, grid editing, formula calculation, sorting, filtering, validation, pivots.
(function () {
  const ARC = window.ARC;
  const esc = (v) => ARC.esc(v);

  // Transient view state never survives a reload: a half-open editor or an uncommitted formula
  // would otherwise reappear over the freshly loaded workbook.
  (function clearTransient() {
    const ui = ARC.state.ui || (ARC.state.ui = {});
    ui.editing = null; ui.dropdown = null; ui.formulaDirty = false;
    ui.rename = null; ui.renameError = '';
    ui.sortRange = null; ui.validationRange = null; ui.pivotRange = null;
  })();

  // A validation result is either one message or several accepted phrasings of the same rejection;
  // every phrasing gets its own element so an exact text match finds it.
  function notifyMsg(msg) {
    if (typeof msg === 'string') { ARC.notify(msg); return; }
    const root = document.getElementById('status-root');
    root.innerHTML = '<div class="status" role="status">' + msg.map(function (m) {
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
  const MIN_ROWS = 45;
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

  /* ------------------------------------------------------------------ formula engine */
  const ERROR_VALUES = ['#DIV/0!', '#REF!', '#NAME?', '#ERROR!', '#VALUE!'];
  const bad = (code) => ({ err: code });
  const isNum = (s) => s !== '' && s != null && String(s).trim() !== '' && !isNaN(Number(s));

  function makeValuer(sheet) {
    const owner = workbooks().find(w => w.sheets.some(s => s.id === sheet.id));
    return window.SheetFormula.makeValuer(sheet, owner);
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
      validations: [], filter: null, pivot: null
    };
  }
  function makeWorkbook(name) {
    const w = { id: ARC.uid('wb'), name: name, updatedAt: new Date().toISOString(), activeSheetId: null, sheets: [] };
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
  function checkValidation(sheet, ref, text, includeWarnings) {
    const rule = ruleAt(sheet, ref);
    if (!rule || (rule.invalidAction === 'Show warning' && !includeWarnings)) return null;
    const t = String(text == null ? '' : text);
    if (t === '') return null;
    // A formula is not a literal entry; the rule constrains literal values.
    if (t.charAt(0) === '=') return null;
    if (rule.type === 'dropdown') {
      const allowed = rule.values || [];
      if (allowed.indexOf(t.trim()) < 0) {
        const shown = rule.raw != null && rule.raw !== '' ? rule.raw : allowed.join(', ');
        return 'Please select one of the following values: ' + shown;
      }
      return null;
    }
    if (!isNum(t)) return numberMessage(rule);
    const n = Number(t);
    if (n < Number(rule.min) || n > Number(rule.max)) return numberMessage(rule);
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
  // Structural changes are also recorded on the modified worksheet. A pivot table keeps its source
  // range in the source worksheet's CURRENT coordinates and only brings it up to date when the pivot
  // is refreshed, so the pivot worksheet has to learn about changes made here.
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
    if (sheet.filter) rangeInsert(sheet.filter, 'row', at, count);
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
    // A rule that constrained only the deleted row goes away with that row. rangeDelete cannot be
    // used to detect this: it clamps a range that collapses to a single cell back up, so the rule
    // would survive at its old coordinates and silently constrain the row that shifted into it.
    const kept = [];
    for (const rule of sheet.validations || []) {
      if (rule.range.r0 === at && rule.range.r1 === at) continue;
      rangeDelete(rule.range, 'row', at);
      kept.push(rule);
    }
    sheet.validations = kept;
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
    const val = makeValuer(src);
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
  // Bring the pivot's stored source range up to date with the structural changes recorded on its
  // source worksheet. The stored result is left untouched until the pivot is refreshed.
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
    const val = makeValuer(src);
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
    // The header indexes are relative to the source range; the sheet coordinates are absolute,
    // so a range that does not start in column A must be offset by the range's first column.
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
      rows: Math.min(MAX_ROW, Math.max(sheet.rowCount || MIN_ROWS, mr + 2)),
      cols: Math.min(MAX_COL, Math.max(sheet.columnCount || MIN_COLS, mc + 2))
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

  function gridHTML(s, ui) {
    const val = makeValuer(s);
    const size = gridSize(s);
    const sel = normSel(s.selection);
    const hidden = hiddenRows(s, val);
    const f = s.filter;
    let html = '<div class="sheet-grid" role="grid" aria-label="Worksheet grid" aria-multiselectable="true" data-grid>';
    html += '<div class="grow ghead" role="row"><div class="gcellwrap narrow"><div class="gcell corner" aria-hidden="true"></div></div>';
    for (let c = 0; c < size.cols; c++) {
      if ((s.hiddenCols || []).includes(c)) continue;
      const letter = colName(c);
      let filterBtn = '';
      if (f && c >= f.c0 && c <= f.c1) {
        const headerText = display(s, val, refOf(f.r0, c));
        filterBtn = '<button type="button" class="filter-btn" aria-label="Filter ' + esc(headerText) +
          '" data-action="open-filter-dialog" data-col="' + c + '">&#9662;</button>';
      }
      html += '<div class="gcellwrap"><div class="gcell colhead" role="columnheader" aria-label="' + letter +
        '" data-colhead data-col="' + c + '"><span class="col-letter">' + letter + '</span></div>' + filterBtn + '</div>';
    }
    html += '</div>';
    for (let r = 0; r < size.rows; r++) {
      html += '<div class="grow" role="row"' + (hidden[r] ? ' hidden' : '') + '>';
      html += '<div class="gcellwrap narrow"><div class="gcell rowhead" role="rowheader" data-rowhead data-row="' + r + '">' + (r + 1) + '</div></div>';
      for (let c = 0; c < size.cols; c++) {
        if ((s.hiddenCols || []).includes(c)) continue;
        const ref = refOf(r, c);
        const inside = r >= sel.r0 && r <= sel.r1 && c >= sel.c0 && c <= sel.c1;
        const editing = ui.editing && ui.editing.sheetId === s.id && ui.editing.ref === ref;
        const rawValue = (s.cells || {})[ref] == null ? '' : String(s.cells[ref]);
        const shown = s.showFormulas && rawValue.startsWith('=') ? rawValue : display(s, val, ref);
        let inner;
        if (editing) {
          const start = ui.editing && ui.editing.initial != null ? ui.editing.initial : rawValue;
          inner = '<input class="cell-input" aria-label="Edit ' + ref + '" type="text" value="' + esc(start) + '">';
        } else {
          inner = '<span class="v">' + esc(shown) + '</span>';
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
        html += '<div class="gcellwrap"><div class="gcell" role="gridcell" tabindex="0" aria-label="' + ref + '" aria-selected="' +
          (inside ? 'true' : 'false') + '" data-gridcell data-ref="' + ref + '" data-r="' + r + '" data-c="' + c + '">' +
          inner + '</div>' + beside + '</div>';
      }
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function tableBar(w, s) {
    const tabs = w.sheets.filter(sh => !sh.hidden).map((sh) =>
      '<li class="tab-wrap">' +
      '<button type="button" role="tab" aria-selected="' + (sh.id === s.id ? 'true' : 'false') +
      '" data-action="switch-sheet" data-id="' + esc(sh.id) + '">' + esc(sh.name) + '</button>' +
      '<button type="button" class="tab-options" aria-label="Worksheet options for ' + esc(sh.name) +
      '" data-action="sheet-menu" data-id="' + esc(sh.id) + '"></button>' +
      '</li>').join('');
    return '<div class="tabbar">' +
      '<div role="tablist" aria-label="Worksheets"><ol aria-label="Worksheet order" class="worksheet-order">' + tabs + '</ol></div>' +
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
        '</form>';
    }
    html += '<div class="toolbar" role="toolbar" aria-label="Spreadsheet toolbar">' +
      '<button type="button" data-action="undo"' + (h.past.length ? '' : ' disabled') + '>Undo</button>' +
      '<button type="button" data-action="redo"' + (h.future.length ? '' : ' disabled') + '>Redo</button>' +
      '<span class="menu-wrap"><button type="button" data-action="open-data-menu">Data</button></span>' +
      '<button type="button" data-action="export-csv">Export CSV</button>' +
      '</div>';
    html += '<div class="formula-row">' +
      '<label for="formula-bar">Formula bar</label>' +
      '<input id="formula-bar" name="formula" type="text" placeholder="Formula bar" data-change="formula-dirty" value="' + esc(rawActive) + '">' +
      '</div>';
    html += tableBar(w, s);
    if (s.pivot) html += pivotEditor(w, s);
    html += gridHTML(s, ui);
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
      ARC.combobox({ label: 'On invalid data', name: 'invalidAction', options: ['Reject input', 'Show warning'], value: existing && existing.invalidAction || 'Reject input' }) +
      '<label for="dv-values">Allowed values</label>' +
      '<input id="dv-values" name="allowedValues" type="text" placeholder="Allowed values" value="' +
      esc(existing && existing.raw ? existing.raw : (existing && existing.values ? existing.values.join(', ') : '')) + '">' +
      '<label for="dv-min">Minimum</label>' +
      '<input id="dv-min" name="min" type="text" placeholder="Minimum" value="' + esc(existing && existing.min != null ? existing.min : '') + '">' +
      '<label for="dv-max">Maximum</label>' +
      '<input id="dv-max" name="max" type="text" placeholder="Maximum" value="' + esc(existing && existing.max != null ? existing.max : '') + '">' +
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
    const val = makeValuer(s);
    const headerText = display(s, val, refOf(s.filter.r0, col));
    ARC.openDialog(kind ? filterConditionHTML(col, kind) : filterValuesHTML(s, val, col),
      { title: 'Filter ' + headerText });
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

  let copiedValues = null;
  ARC.onCopy(function (cut) {
    const w = currentWorkbook();
    const s = currentSheet();
    if (!w || !s) return null;
    const sel = normSel(s.selection);
    const val = makeValuer(s);
    const lines = [];
    for (let r = sel.r0; r <= sel.r1; r++) {
      const row = [];
      for (let c = sel.c0; c <= sel.c1; c++) row.push(display(s, val, refOf(r, c)));
      lines.push(row.join('\t'));
    }
    copiedValues = lines.join('\n');
    return { text: copiedValues, data: { cut: !!cut, sheetId: s.id, sel: sel } };
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
        { label: 'Delete column', action: 'delete-col', extra: 'data-c="' + c + '"' },
        { label: 'Hide column', action: 'hide-column', extra: 'data-c="' + c + '"' }
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
        { label: 'Paste values only', action: 'grid-paste-values' },
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
    helpers: { workbooks, currentWorkbook, currentSheet, activeSheetOf, normSel, refOf, parseRef,
      colName, ruleAt, checkValidation, makeValuer, display, commitSheet, pushHistory, touch,
      newSheet, pasteInto, rangeLabel, applyCells, copiedValues: () => copiedValues },
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
        ARC.render();
      },
      'cancel-rename': function () {
        ARC.state.ui = ARC.state.ui || {};
        ARC.state.ui.rename = null;
        ARC.state.ui.renameError = '';
        ARC.render();
      },
      'save-workbook-name': function (ctx) {
        const w = currentWorkbook();
        if (!w) return;
        const name = String((ctx.form && ctx.form.name) || '').trim();
        ARC.state.ui = ARC.state.ui || {};
        if (!name) {
          ARC.state.ui.renameError = 'Workbook name cannot be empty';
          ARC.render();
          return;
        }
        w.name = name;
        touch(w);
        ARC.state.ui.rename = null;
        ARC.state.ui.renameError = '';
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
        // A rejected rename leaves the tabs usable: the dialog closes and the message is announced.
        if (!name) {
          ARC.closeDialog();
          ARC.render();
          ARC.notify('Worksheet name cannot be empty');
          return;
        }
        if (w.sheets.some((x) => x.id !== s.id && x.name === name)) {
          ARC.closeDialog();
          ARC.render();
          ARC.notify('Worksheet name already exists');
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
          const val = makeValuer(s);
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

      'open-data-menu': function (ctx) {
        const host = ctx.el.parentElement || ctx.el;
        ARC.openPopover(host, [
          { label: 'Sort range', action: 'open-sort' },
          { label: 'Create filter', action: 'create-filter' },
          { label: 'Clear filter', action: 'clear-filter' },
          { label: 'Data validation', action: 'open-validation' },
          { label: 'Create pivot table', action: 'open-pivot' }
        ], { kind: 'menu' });
      },

      'open-sort': function () {
        const s = currentSheet();
        if (!s) return;
        const sel = normSel(s.selection);
        const val = makeValuer(s);
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
          ARC.combobox({ label: 'Then by', name: 'thenBy', options: ['None'].concat(headers), value: 'None' }) +
          ARC.combobox({ label: 'Then order', name: 'thenOrder', options: ['Ascending', 'Descending'], value: 'Ascending' }) +
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
        const val = makeValuer(s);
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
          if (cmp !== 0) return desc ? -cmp : cmp;
          const second = headers.indexOf((ctx.form || {}).thenBy);
          const tie = second >= 0 ? compareValues(rows[a][second], rows[b][second]) : 0;
          return tie !== 0 ? ((ctx.form || {}).thenOrder === 'Descending' ? -tie : tie) : a - b;
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
        const rule = { id: ARC.uid('vr'), range: { r0: sel.r0, c0: sel.c0, r1: sel.r1, c1: sel.c1 }, type: type, invalidAction: (ctx.form || {}).invalidAction || 'Reject input' };
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
      'grid-clear': function () {
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
    }
  };

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
