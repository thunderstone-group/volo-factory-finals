// Scenario executor: runs requirement scenarios planned by scenarios.py in Chromium, a fresh
// browser context per scenario. Diagnostic only; it never reads evaluator tests.
// Protocol (newline-delimited JSON): first output line {"ready": true, browser, playwright} or
// {"ready": false, "unavailable": "module"|"browser", reason}; then one result line per input line
// {"cmd": "run", "base": "http://127.0.0.1:PORT", "scenario": {...}}; {"cmd": "exit"} closes.
'use strict';
const readline = require('node:readline');

const ACTION_MS = Number(process.env.SCENARIO_ACTION_MS || 2500);
const EXPECT_MS = Number(process.env.SCENARIO_EXPECT_MS || 2500);
const HEADING_MS = 1500;
const OP_HARD_MS = 20000;
const CONTROL_ROLES = ['button', 'link', 'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'checkbox',
  'radio', 'switch', 'option', 'treeitem', 'combobox'];
const ENTRY_FIRST = ['link', 'button'];
const ENTRY_MORE = ['heading', 'row', 'cell', 'gridcell', 'option', 'treeitem', 'article', 'menuitem', 'tab', 'listitem'];
const FIELD_ROLES = ['textbox', 'searchbox', 'combobox', 'spinbutton'];
const TEXT_ROLES = ['heading', 'link', 'button', 'cell', 'gridcell', 'option', 'tab', 'menuitem', 'status', 'alert', 'img'];
const CONTAINER_ROLES = ['region', 'list', 'form', 'dialog', 'alertdialog', 'group', 'navigation', 'complementary',
  'tabpanel', 'table', 'grid', 'listbox', 'menu', 'toolbar', 'article', 'main', 'search'];
// Roles whose accessible name does not come from their content: a note card "named by its title" is an
// article that contains the title, so these are also matched by the text inside them.
const BY_CONTENT = new Set(['article', 'listitem', 'row', 'group', 'region', 'cell', 'gridcell', 'list', 'dialog',
  'alertdialog', 'form', 'complementary', 'navigation', 'tabpanel', 'figure', 'note', 'status', 'alert', 'log', 'main',
  'toolbar', 'table', 'grid', 'tree', 'menu', 'listbox']);

function loadPlaywright() {
  for (const name of ['playwright', '@playwright/test', 'playwright-core']) {
    try {
      const mod = require(name);
      if (mod && mod.chromium) {
        let version = '';
        try { version = require(name + '/package.json').version; } catch {}
        return {chromium: mod.chromium, version};
      }
    } catch {}
  }
  return null;
}

const clip = (value, n = 160) => { const s = String(value == null ? '' : value).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const q = (s) => '`' + clip(s, 80) + '`';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function union(root, roles, name, exact) {
  const list = roles.map(role => (name === undefined ? root.getByRole(role) : root.getByRole(role, {name, exact})));
  return list.reduce((a, b) => a.or(b));
}

// The locator ladder for a target: an ordered list of [label, locator] rungs.
function ladder(root, target) {
  const n = target.name;
  const roles = target.roles || [];
  const rungs = [];
  if (!n && roles.length) return [['role', union(root, roles, undefined)]];
  if (target.kind === 'tag') {
    const tagged = root.locator(target.tag);
    rungs.push(['tag', n ? tagged.filter({hasText: n}) : tagged]);
    return rungs;
  }
  if (target.kind === 'any') {
    rungs.push(['role+name', union(root, [...CONTROL_ROLES, ...TEXT_ROLES.filter(r => !CONTROL_ROLES.includes(r))], n, true)],
      ['text', root.getByText(n, {exact: true})], ['label', root.getByLabel(n, {exact: true})],
      ['text substring', root.getByText(n)]);
    return rungs;
  }
  if (target.kind === 'field') {
    const r = roles.length ? roles : FIELD_ROLES;
    rungs.push(['role+name', union(root, r, n, true)], ['label', root.getByLabel(n, {exact: true})],
      ['placeholder', root.getByPlaceholder(n, {exact: true})], ['role+name substring', union(root, r, n, false)],
      ['label substring', root.getByLabel(n)], ['placeholder substring', root.getByPlaceholder(n)]);
  } else if (target.kind === 'entry' && !roles.length) {
    rungs.push(['link/button', union(root, ENTRY_FIRST, n, true)], ['entry role', union(root, ENTRY_MORE, n, true)],
      ['text', root.getByText(n, {exact: true})], ['link/button substring', union(root, ENTRY_FIRST, n, false)],
      ['text substring', root.getByText(n)]);
  } else if (target.kind === 'text' && !roles.length) {
    rungs.push(['text', root.getByText(n, {exact: true})], ['role+name', union(root, TEXT_ROLES, n, true)],
      ['text substring', root.getByText(n)], ['role+name substring', union(root, TEXT_ROLES, n, false)]);
  } else {
    const r = roles.length ? roles : CONTROL_ROLES;
    rungs.push(['role+name', union(root, r, n, true)]);
    const content = r.filter(role => BY_CONTENT.has(role));
    if (content.length) {
      const all = union(root, content, undefined);
      rungs.push(['role+text', all.filter({has: root.getByText(n, {exact: true})})]);
    }
    rungs.push(['role+name substring', union(root, r, n, false)]);
    if (content.length) rungs.push(['role+text substring', union(root, content, undefined).filter({hasText: n})]);
    if (target.kind !== 'structure') {
      rungs.push(['label', root.getByLabel(n, {exact: true})], ['placeholder', root.getByPlaceholder(n, {exact: true})],
        ['text', root.getByText(n, {exact: true})]);
    }
  }
  return rungs;
}

function exactRungs(root, target) {
  return ladder(root, target).filter(([label]) => !label.includes('substring'));
}

function describeTarget(target) {
  if (target.kind === 'tag') return `<${target.tag}> element${target.name ? ` containing ${q(target.name)}` : ''}`;
  const roles = target.roles && target.roles.length ? target.roles.join(' or ') :
    ({field: 'field', entry: 'entry', text: 'text', control: 'control', structure: 'element', any: 'element'})[target.kind] || 'element';
  if (!target.name) return `${roles}${target.scope && target.scope.type === 'named' ? ` in ${q(target.scope.name)}` : ''}`;
  let scope = '';
  if (target.scope && target.scope.type === 'named') scope = ` in ${q(target.scope.name)}`;
  if (target.scope && target.scope.type === 'landmark') scope = ' in the navigation';
  if (target.scope && target.scope.type === 'role') scope = ` in the ${target.scope.roles.join(' or ')}`;
  return `${roles} named ${q(target.name)}${scope}`;
}

// Scope roots: [{root, label}] plus whether an empty result may fall back to the whole page.
async function scopeRoots(page, scope) {
  if (!scope) return {roots: [{root: page, label: 'page'}], missing: null};
  if (scope.type === 'landmark') {
    // "in the navigation bar": navigation landmarks first (document order), then the banner around them.
    const roots = [];
    for (const [role, label] of [['navigation', 'navigation landmark'], ['banner', 'banner']]) {
      const marks = page.getByRole(role).filter({visible: true});
      const count = Math.min(await marks.count(), 6);
      for (let i = 0; i < count; i++) roots.push({root: marks.nth(i), label});
    }
    roots.push({root: page, label: 'page'});
    return {roots, missing: null};
  }
  if (scope.type === 'role') {
    // "in the sidebar", "in the suggestions listbox": visible containers of that role first, then the page.
    const roots = [];
    const marks = union(page, scope.roles, undefined, false).filter({visible: true});
    const count = Math.min(await marks.count(), 6);
    for (let i = 0; i < count; i++) roots.push({root: marks.nth(i), label: scope.roles[0]});
    if (scope.strict && !roots.length) return {roots: [], missing: `no visible ${scope.roles.join(' or ')}`};
    if (!scope.strict) roots.push({root: page, label: 'page'});
    return {roots, missing: null};
  }
  const label = q(scope.name);
  const given = scope.roles || [];
  const roles = [...given, ...CONTAINER_ROLES.filter(r => !given.includes(r))];
  let containers = union(page, roles, scope.name, true).filter({visible: true});
  let count = await containers.count();
  let roots = [];
  const content = given.filter(role => BY_CONTENT.has(role) && role !== 'region');
  if (!count && content.length) {
    // An article "named" by the title it contains.
    containers = union(page, content, undefined).filter({has: page.getByText(scope.name, {exact: true})}).filter({visible: true});
    count = await containers.count();
  }
  if (count) {
    for (let i = 0; i < Math.min(count, 4); i++) roots.push({root: containers.nth(i), label});
  } else {
    // A section titled by a heading: the heading's own wrapper, or, when that wrapper also holds the next
    // section, the elements between this heading and the next heading of the same or a higher level.
    const heading = page.getByRole('heading', {name: scope.name, exact: true}).filter({visible: true}).first();
    if (await heading.count()) {
      const shared = await heading.evaluate(h => {
        const level = Number((h.getAttribute('aria-level') || h.tagName.slice(1)) || 6);
        return [...h.parentElement.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]')].some(o => o !== h &&
          Number((o.getAttribute('aria-level') || o.tagName.slice(1)) || 6) <= level);
      }).catch(() => true);
      roots.push(shared ? {root: page, label, section: await heading.elementHandle()} : {root: heading.locator('xpath=..'), label});
    }
  }
  if (!roots.length) {
    if (scope.strict) return {roots: [], missing: `no region, list, form or dialog named ${q(scope.name)}`};
    return {roots: [{root: page, label: 'page'}], missing: null};
  }
  if (!scope.strict) roots.push({root: page, label: 'page'});
  return {roots, missing: null};
}

// Visible matches of a locator inside a root: {count, pick(i)}; a section root keeps only the elements that
// follow its heading and precede the next heading of the same or a higher level.
async function within(root, loc) {
  const visible = loc.filter({visible: true});
  if (!root.section) {
    const count = await visible.count();
    return {count, pick: i => visible.nth(i)};
  }
  const flags = await visible.evaluateAll((els, h) => {
    const level = Number((h.getAttribute('aria-level') || h.tagName.slice(1)) || 6);
    const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]')];
    const next = headings.find(o => (h.compareDocumentPosition(o) & Node.DOCUMENT_POSITION_FOLLOWING) &&
      Number((o.getAttribute('aria-level') || o.tagName.slice(1)) || 6) <= level);
    return els.map(el => !!(h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) &&
      (!next || !!(el.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING)) && el !== h);
  }, root.section);
  const indexes = flags.map((f, i) => (f ? i : -1)).filter(i => i >= 0);
  return {count: indexes.length, pick: i => visible.nth(indexes[i])};
}

// First rung with visible matches, searched root by root: {count, pick, rung, root, missing}.
async function locate(page, target) {
  const {roots, missing} = await scopeRoots(page, target.scope);
  if (missing) return {count: 0, missing};
  for (const root of roots) {
    for (const [rung, loc] of ladder(root.root, target)) {
      const found = await within(root, loc);
      if (found.count) return {count: found.count, pick: found.pick, rung, root: root.label};
    }
  }
  return {count: 0};
}

async function screen(page) {
  try {
    return await page.evaluate(() => {
      const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
      const txt = el => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
      const all = sel => [...document.querySelectorAll(sel)].filter(vis).map(txt).filter(Boolean);
      const main = document.querySelector('main, [role="main"]');
      const mainHeading = main ? [...main.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]')].filter(vis).map(txt)[0] || '' : '';
      const dialog = [...document.querySelectorAll('dialog[open], [role="dialog"], [role="alertdialog"]')].filter(vis)[0];
      let dialogName = '';
      if (dialog) {
        const labelled = dialog.getAttribute('aria-labelledby');
        dialogName = dialog.getAttribute('aria-label') || (labelled && document.getElementById(labelled) ? txt(document.getElementById(labelled)) : '') || txt(dialog).slice(0, 40);
      }
      return {url: location.href, hash: location.hash, path: location.pathname,
        h1: all('h1, [role="heading"][aria-level="1"]').slice(0, 3), h2: all('h2, [role="heading"][aria-level="2"]').slice(0, 4),
        mainHeading, dialog: dialog ? dialogName || 'unnamed' : ''};
    });
  } catch (e) {
    return {url: page.url(), hash: '', path: '', h1: [], h2: [], mainHeading: '', dialog: '', error: clip(e.message, 80)};
  }
}

function where(s) {
  const at = s.hash || s.path || s.url || '?';
  const h1 = s.h1 && s.h1.length ? s.h1.map(q).join(', ') : 'none';
  let text = `screen ${at} has h1 ${h1}`;
  if (s.h2 && s.h2.length) text += ` (h2: ${s.h2.map(q).join(', ')})`;
  if (s.dialog) text += `, open dialog ${q(s.dialog)}`;
  return text;
}

function verb(op) {
  return ({click: 'activating', hover: 'hovering', focus: 'focusing', fill: 'filling', check: 'checking', select: 'selecting in',
    goto: 'opening', press: 'pressing', wait: 'waiting'})[op.op] || op.op;
}

function afterText(last) {
  if (!last) return 'On first load';
  if (last.op === 'goto') return 'After opening the application URL';
  if (!last.target) return `After ${verb(last)} ${last.key || ''}`.trim();
  return `After ${verb(last)} ${q(last.target.name)} (${last.src})`;
}

async function hard(promise, ms, what) {
  let timer;
  const guard = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${what} exceeded ${ms} ms`)), ms); });
  try { return await Promise.race([promise, guard]); } finally { clearTimeout(timer); }
}

// Wait until a target is visible; returns the locate() result (count 0 when it never appeared).
async function waitFor(page, target, ms) {
  const deadline = Date.now() + ms;
  let found;
  for (;;) {
    found = await locate(page, target);
    if (found.count || Date.now() >= deadline) return found;
    await sleep(120);
  }
}

async function elementRole(locator) {
  try {
    return await locator.evaluate(el => {
      const role = el.getAttribute('role');
      if (role) return role.split(/\s+/)[0];
      if (el.tagName === 'A' && el.hasAttribute('href')) return 'link';
      if (el.tagName === 'BUTTON' || (el.tagName === 'INPUT' && /^(button|submit|reset)$/i.test(el.type))) return 'button';
      if (el.tagName === 'SELECT') return 'select';
      return el.tagName.toLowerCase();
    });
  } catch { return ''; }
}

async function revealIn(page, scope) {
  if (!scope || scope.type !== 'named') return;
  try {
    const {roots} = await scopeRoots(page, scope);
    if (roots.length && roots[0].label !== 'page' && !roots[0].section) await roots[0].root.first().hover({timeout: 1000});
  } catch {}
}

// Controls a row reveals on hover stay visible while the pointer rests there; park it before counting.
async function park(page) {
  try { await page.mouse.move(1, 1); await sleep(60); } catch {}
}

async function act(page, op, ctx) {
  const target = op.target;
  if (op.unique && !(target.scope && target.scope.type === 'named')) await park(page);
  await revealIn(page, target.scope);
  const found = await waitFor(page, target, ACTION_MS);
  if (!found.count) {
    const s = await screen(page);
    const why = found.missing ? found.missing : `found no ${describeTarget(target)}`;
    return {ok: false, observation: `${afterText(ctx.last)}, ${where(s)}; ${why} to ${op.op === 'fill' ? 'fill' : op.op}.`};
  }
  let chosen = found;
  if (op.unique && found.count > 1) {
    await sleep(300);
    chosen = await locate(page, target);
    if (chosen.count > 1) {
      const s = await screen(page);
      return {ok: false, observation: `${afterText(ctx.last)}, ${where(s)}; expected exactly one ${describeTarget(target)} but found ${chosen.count} (${chosen.rung}).`};
    }
    if (!chosen.count) chosen = found;
  }
  const element = chosen.pick(0);
  const detail = `${chosen.rung}${chosen.root && chosen.root !== 'page' ? ' in ' + chosen.root : ''}, ${chosen.count} match${chosen.count > 1 ? 'es' : ''}`;
  const before = page.url();
  const role = op.op === 'click' ? await elementRole(element) : '';
  try {
    if (op.op === 'click') {
      const card = target.kind === 'structure' && (target.roles || []).some(r => BY_CONTENT.has(r));
      await element[op.double ? 'dblclick' : 'click'](card ? {timeout: ACTION_MS, position: {x: 8, y: 8}} : {timeout: ACTION_MS});
    }
    else if (op.op === 'hover') await element.hover({timeout: ACTION_MS});
    else if (op.op === 'focus') { await element.focus({timeout: ACTION_MS}); await sleep(120); }
    else if (op.op === 'fill') await element.fill(op.value, {timeout: ACTION_MS});
    else if (op.op === 'check') {
      try { await (op.checked ? element.check({timeout: ACTION_MS}) : element.uncheck({timeout: ACTION_MS})); }
      catch (e) { if (/not a checkbox|radio/i.test(e.message)) await element.click({timeout: ACTION_MS}); else throw e; }
    } else if (op.op === 'select') {
      const tag = await element.evaluate(el => el.tagName);
      if (tag === 'SELECT') {
        try { await element.selectOption({label: op.option}, {timeout: ACTION_MS}); }
        catch { await element.selectOption(op.option, {timeout: ACTION_MS}); }
      } else {
        await element.click({timeout: ACTION_MS});
        await page.getByRole('option', {name: op.option, exact: true}).filter({visible: true}).first().click({timeout: ACTION_MS});
      }
    }
  } catch (e) {
    const s = await screen(page);
    const message = clip(String(e.message).split('\n').filter(l => l.trim() && !/^\s*(Call log|=+)/.test(l))[0] || e.message, 140);
    return {ok: false, observation: `${afterText(ctx.last)}, ${where(s)}; ${op.op} on ${describeTarget(target)} failed: ${message}.`};
  }
  await sleep(60);
  const moved = page.url() !== before;
  if (moved) await page.waitForLoadState('domcontentloaded', {timeout: 5000}).catch(() => {});
  if (op.op === 'click' && op.entity && moved && !ctx.skipHeading.has(target.name) &&
      (role === 'link' || (role === 'button' && /\d/.test(target.name)))) {
    ctx.headingChecks.push(await headingInvariant(page, op, ctx));
  }
  return {ok: true, detail};
}

async function headingInvariant(page, op, ctx) {
  const name = op.target.name.replace(/\s+/g, ' ').trim().toLowerCase();
  const deadline = Date.now() + HEADING_MS;
  let s;
  for (;;) {
    s = await screen(page);
    const titles = [...(s.h1 || []), s.mainHeading].filter(Boolean).map(t => t.toLowerCase());
    if (titles.some(t => t.includes(name))) return {name: op.target.name, ok: true, src: op.src};
    if (Date.now() >= deadline) break;
    await sleep(120);
  }
  const shown = s.h1 && s.h1.length ? s.h1.map(q).join(', ') : (s.mainHeading ? q(s.mainHeading) : 'no h1');
  return {name: op.target.name, ok: false, src: op.src,
    observation: `After activating the link ${q(op.target.name)} (${op.src}), screen ${s.hash || s.path} shows ${shown}; the main heading does not contain ${q(op.target.name)}.`};
}

async function checkAttrs(locator, op) {
  const attrs = op.attrs || {};
  const states = op.states || {};
  for (const [key, value] of Object.entries(attrs)) {
    const own = await locator.getAttribute(key);
    if (String(own) === String(value)) continue;
    if (key === 'title' && await locator.locator(`[title="${String(value).replace(/"/g, '\\"')}"]`).count()) continue;
    return `${key}=${own}`;
  }
  for (const [prop, value] of Object.entries(op.style || {})) {
    const actual = await locator.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p).trim(), prop);
    if (actual.replace(/\s+/g, '') !== String(value).replace(/\s+/g, '')) return `${prop}: ${actual}`;
  }
  for (const [key, value] of Object.entries(states)) {
    let actual;
    if (key === 'checked') actual = await locator.isChecked().catch(() => null);
    else if (key === 'disabled') actual = await locator.isDisabled().catch(() => null);
    else actual = (await locator.getAttribute('aria-' + key)) === 'true';
    if (actual !== value) return `${key}=${actual}`;
  }
  return null;
}

async function expectOnce(page, op) {
  const target = op.target;
  if (op.count === 'none' && (op.attrs || op.states || op.style)) {
    // "has no `Pinned` title": no matching element carries those values (the element itself may stay).
    const found = await locate(page, target);
    for (let i = 0; i < Math.min(found.count || 0, 8); i++) {
      if (!(await checkAttrs(found.pick(i), op))) return {ok: false, count: 1, rung: found.rung, root: found.root, attr: 'present'};
    }
    return {ok: true, detail: found.count ? 'no match carries the values' : 'absent'};
  }
  if (op.count === 'none') {
    const {roots, missing} = await scopeRoots(page, target.scope);
    if (missing) return {ok: true, detail: missing};
    for (const root of roots.slice(0, 1).concat(roots.length > 1 ? [roots[roots.length - 1]] : [])) {
      for (const [rung, loc] of exactRungs(root.root, target)) {
        const count = (await within(root, loc)).count;
        if (count) return {ok: false, count, rung, root: root.label};
      }
    }
    return {ok: true, detail: 'absent'};
  }
  const found = await locate(page, target);
  if (!found.count) return {ok: false, count: 0, missing: found.missing};
  if (op.count === 'one' && found.count !== 1) return {ok: false, count: found.count, rung: found.rung, root: found.root};
  if (op.attrs || op.states || op.style) {
    let mismatch = null;
    for (let i = 0; i < Math.min(found.count, 5); i++) {
      mismatch = await checkAttrs(found.pick(i), op);
      if (!mismatch) return {ok: true, detail: `${found.rung}, ${found.count} match(es)`};
    }
    return {ok: false, count: found.count, rung: found.rung, attr: mismatch};
  }
  return {ok: true, detail: `${found.rung}${found.root && found.root !== 'page' ? ' in ' + found.root : ''}, ${found.count} match${found.count > 1 ? 'es' : ''}`};
}

async function expectOp(page, op, ctx) {
  if (op.count === 'one' && !(op.target.scope && op.target.scope.type === 'named')) await park(page);
  const deadline = Date.now() + EXPECT_MS;
  let result;
  for (;;) {
    result = await expectOnce(page, op);
    if (result.ok || Date.now() >= deadline) break;
    await sleep(120);
  }
  if (result.ok) return {ok: true, detail: result.detail};
  const s = await screen(page);
  const target = op.target;
  let want;
  const values = Object.entries({...(op.attrs || {}), ...(op.states || {}), ...(op.style || {})}).map(([k, v]) => `${k}=${v}`).join(', ');
  if (op.count === 'none' && values) want = `expected no ${describeTarget(target)} with ${values}, but one has them`;
  else if (op.count === 'none') want = `expected no ${describeTarget(target)}, found ${result.count} (${result.rung}${result.root && result.root !== 'page' ? ' in ' + result.root : ''})`;
  else if (result.missing) want = `expected ${describeTarget(target)}, but there is ${result.missing}`;
  else if (result.attr) want = `expected ${describeTarget(target)} with ${Object.entries({...(op.attrs || {}), ...(op.states || {}), ...(op.style || {})}).map(([k, v]) => `${k}=${v}`).join(', ')}, found ${result.count} with ${result.attr}`;
  else if (op.count === 'one' && result.count) want = `expected exactly one ${describeTarget(target)}, found ${result.count} (${result.rung})`;
  else {
    const partial = await locate(page, {...target, scope: target.scope && target.scope.strict ? target.scope : undefined});
    want = `expected ${op.count === 'one' ? 'exactly one' : 'a visible'} ${describeTarget(target)}, found 0` +
      (partial.count ? ` (${partial.count} elsewhere via ${partial.rung})` : '');
  }
  return {ok: false, observation: `${afterText(ctx.last)}, ${where(s)}; ${want}.`};
}

async function runOp(page, op, ctx, base) {
  if (op.op === 'goto') {
    try {
      const response = await page.goto(new URL(op.path || '/', base).href, {waitUntil: 'load', timeout: 15000});
      if (response && response.status() >= 400) return {ok: false, observation: `Opening ${op.path || '/'} returned HTTP ${response.status()}.`};
      return {ok: true, detail: 'loaded'};
    } catch (e) {
      return {ok: false, observation: `Opening the application URL failed: ${clip(e.message, 140)}.`};
    }
  }
  if (op.op === 'wait') { await sleep(op.ms || 300); return {ok: true, detail: `${op.ms || 300} ms`}; }
  if (op.op === 'press') {
    await page.keyboard.press(op.key);
    await sleep(60);
    return {ok: true, detail: op.key};
  }
  if (op.op === 'expect') return expectOp(page, op, ctx);
  return act(page, op, ctx);
}

async function runScenario(browser, base, scenario) {
  const started = Date.now();
  const context = await browser.newContext({viewport: {width: 1280, height: 720}, timezoneId: 'UTC'});
  const page = await context.newPage();
  page.setDefaultTimeout(ACTION_MS);
  const ctx = {last: null, headingChecks: [], index: -1, skipHeading: new Set(scenario.skip_heading || [])};
  const pageErrors = [];
  const dialogs = [];
  page.on('pageerror', e => pageErrors.push({step: ctx.index, message: clip(String(e && e.message || e).split('\n')[0], 240),
    after: ctx.last && ctx.last.target ? ctx.last.target.name : (ctx.last ? ctx.last.op : '')}));
  page.on('dialog', d => { dialogs.push({step: ctx.index, type: d.type(), message: clip(d.message(), 120)}); d.dismiss().catch(() => {}); });
  const steps = [];
  let status = 'pass';
  let observation = '';
  try {
    for (let i = 0; i < scenario.ops.length; i++) {
      const op = scenario.ops[i];
      ctx.index = i;
      const t0 = Date.now();
      let result;
      try { result = await hard(runOp(page, op, ctx, base), OP_HARD_MS, `step ${i + 1}`); }
      catch (e) { result = {ok: false, observation: `${afterText(ctx.last)}, the step did not finish: ${clip(e.message, 140)}.`}; }
      steps.push({phase: op.phase, src: op.src, op: op.op, text: op.text || '', result: result.ok ? 'ok' : 'fail',
        ms: Date.now() - t0, detail: result.ok ? result.detail || '' : result.observation});
      if (!result.ok) {
        status = 'fail';
        const setup = op.phase === 'given' ? `Setup step from ${op.src} failed. ` : '';
        observation = setup + result.observation;
        const err = pageErrors.find(e => e.step <= i);
        if (err) observation += ` Page error: ${err.message}`;
        break;
      }
      if (op.op !== 'expect' && op.op !== 'wait') ctx.last = op;
    }
    if (status === 'pass') observation = `All ${scenario.ops.filter(o => o.op === 'expect').length} expectations held.`;
  } catch (e) {
    status = 'error';
    observation = `Executor error: ${clip(e.message, 200)}`;
  } finally {
    await context.close().catch(() => {});
  }
  return {id: scenario.id, status, observation, steps, heading_checks: ctx.headingChecks, page_errors: pageErrors,
    dialogs, seconds: (Date.now() - started) / 1000};
}

async function main() {
  const pw = loadPlaywright();
  if (!pw) { console.log(JSON.stringify({ready: false, unavailable: 'module', reason: 'playwright is not installed'})); return; }
  let browser;
  try { browser = await pw.chromium.launch({timeout: 30000}); }
  catch (e) { console.log(JSON.stringify({ready: false, unavailable: 'browser', reason: clip(e.message, 400)})); return; }
  console.log(JSON.stringify({ready: true, browser: browser.version(), playwright: pw.version}));
  const lines = readline.createInterface({input: process.stdin, terminal: false});
  try {
    for await (const line of lines) {
      if (!line.trim()) continue;
      let message;
      try { message = JSON.parse(line); } catch { console.log(JSON.stringify({error: 'bad input line'})); continue; }
      if (message.cmd === 'exit') break;
      if (message.cmd !== 'run') { console.log(JSON.stringify({error: 'unknown command'})); continue; }
      const address = new URL(message.base);
      if (address.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(address.hostname)) {
        console.log(JSON.stringify({id: message.scenario.id, status: 'error', observation: 'only a local application URL is accepted'}));
        continue;
      }
      let result;
      try { result = await runScenario(browser, message.base, message.scenario); }
      catch (e) { result = {id: message.scenario.id, status: 'error', observation: `Executor error: ${clip(e.message, 200)}`, steps: []}; }
      console.log(JSON.stringify(result));
    }
  } finally {
    await browser.close().catch(() => {});
  }
}

main().catch(e => { console.log(JSON.stringify({ready: false, unavailable: 'executor', reason: clip(e.message, 400)})); process.exitCode = 1; });
