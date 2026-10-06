// Read-only, bounded accessibility inventory. No requirements, model, or evaluator input.
'use strict';
const fs = require('node:fs');
const roles = new Set(['link', 'button', 'heading', 'textbox', 'searchbox', 'combobox', 'checkbox',
  'radio', 'switch', 'spinbutton', 'slider', 'tab', 'tabpanel', 'region', 'dialog', 'alertdialog',
  'form', 'list', 'listitem', 'navigation', 'menuitem', 'treeitem', 'table', 'grid', 'toolbar']);
const norm = s => String(s || '').replace(/\s+/g, ' ').trim();
const key = x => JSON.stringify([x.role, x.name]);
const unsafe = /(?:^|[\s/#?&=_-])(delete|remove|destroy|logout|signout|sign-out|unsubscribe|checkout|purchase|submit|save)(?:$|[\s/#?&=_-])/i;

function destination(raw, base) {
  if (!raw || raw === '#' || unsafe.test(raw)) return null;
  try {
    const u = new URL(raw, base), home = new URL(base);
    if (u.origin !== home.origin || !/^https?:$/.test(u.protocol)) return null;
    return u.pathname + u.search + (['#', '#/'].includes(u.hash) ? '' : u.hash);
  } catch { return null; }
}

async function snapshot(page, cdp) {
  const [{nodes}, {root}] = await Promise.all([
    cdp.send('Accessibility.getFullAXTree'), cdp.send('DOM.getDocument', {depth: -1, pierce: true})]);
  const dom = new Map(), parents = new Map();
  function walk(n, parent) {
    dom.set(n.backendNodeId, n);
    if (parent) parents.set(n.backendNodeId, parent);
    for (const c of n.children || []) walk(c, n);
    for (const c of n.shadowRoots || []) walk(c, n);
  }
  walk(root);
  const ax = new Map(nodes.map(n => [n.nodeId, n]));
  const textBelow = n => n.role?.value === 'StaticText' ? n.name?.value || '' :
    (n.childIds || []).map(id => textBelow(ax.get(id) || {})).join(' ');
  const items = new Map(), navigation = [];
  for (const n of nodes) {
    const role = n.role?.value;
    let name = norm(n.name?.value);
    if (!name && role === 'listitem') {
      let parent = ax.get(n.parentId);
      while (parent && parent.role?.value !== 'list') parent = ax.get(parent.parentId);
      if (norm(parent?.name?.value)) name = norm(textBelow(n));
    }
    if (n.ignored || !roles.has(role) || !name) continue;
    const item = {role, name};
    const scopes = [];
    for (let p = ax.get(n.parentId); p; p = ax.get(p.parentId))
      if (['form', 'region', 'list', 'group', 'toolbar', 'tabpanel'].includes(p.role?.value) && norm(p.name?.value))
        scopes.push(norm(p.name.value));
    for (let p = parents.get(n.backendDOMNodeId); p; p = parents.get(p.backendNodeId)) {
      if (!['ASIDE', 'SECTION', 'FIELDSET'].includes(p.nodeName)) continue;
      const title = (p.children || []).find(c => /^H[1-6]$/.test(c.nodeName) || c.nodeName === 'LEGEND');
      if (title) {
        const heading = nodes.find(c => c.backendDOMNodeId === title.backendNodeId && !c.ignored);
        if (norm(heading?.name?.value)) scopes.push(norm(heading.name.value));
      }
    }
    if (scopes.length) item.scopes = [...new Set(scopes)];
    items.set(key(item), item);
    const d = dom.get(n.backendDOMNodeId), attrs = {};
    for (let i = 0; i < (d?.attributes || []).length; i += 2) attrs[d.attributes[i]] = d.attributes[i + 1];
    if (role === 'combobox' && d?.nodeName === 'SELECT') {
      const text = node => node.nodeType === 3 ? node.nodeValue : (node.children || []).map(text).join(' ');
      const options = node => node.nodeName === 'OPTION' ? [norm(text(node))] : (node.children || []).flatMap(options);
      item.choices = options(d).filter(Boolean);
    } else if (role === 'combobox' && attrs['aria-haspopup'] === 'listbox' && d?.nodeName !== 'INPUT') {
      item.disclosure = true;
    }
    if (n.properties?.some(p => p.name === 'disabled' && p.value?.value)) continue;
    if (['link', 'button'].includes(role) && attrs['data-nav'] && attrs.type !== 'submit' &&
        !unsafe.test(name) && !unsafe.test(attrs['data-nav'])) {
      // data-nav declares local navigation even when the anchor has only href="#". Unlike data-action,
      // it is not a generic business action; server writes remain blocked and each path has a fresh context.
      navigation.push({...item, kind: 'nav', destination: attrs['data-nav']});
    } else if (role === 'link' && !('download' in attrs)) {
      const href = destination(attrs.href, page.url());
      if (href && !unsafe.test(name)) { item.href = href; navigation.push({...item, kind: 'url'}); }
    } else if (role === 'button') {
      // Only declarative destinations: arbitrary click handlers / nav ancestry do not prove read-only behavior.
      const href = destination(attrs['data-href'] || attrs['data-hash'], page.url());
      if (href && !unsafe.test(name)) { item.href = href; navigation.push({...item, kind: 'url'}); }
    } else if (role === 'tab' && attrs['aria-controls'] && attrs.type !== 'submit') {
      // An explicit tab-to-panel relationship is a navigation contract, unlike an ordinary action button.
      navigation.push({...item, kind: 'tab', panel: attrs['aria-controls']});
    }
  }
  // Several links can expose the same destination (for example repeated tags). URL navigation is still
  // deterministic then; conflicting destinations and ambiguous click handlers remain unobserved.
  const groups = new Map();
  for (const n of navigation) { const list = groups.get(key(n)) || []; list.push(n); groups.set(key(n), list); }
  return {items: [...items.values()].sort((a, b) => key(a).localeCompare(key(b), 'en')),
    navigation: [...groups.values()].filter(g => g.length === 1 ||
      g.every(n => n.kind === 'url' && n.href === g[0].href)).map(g => g[0])};
}

async function revealNavigation(page, cdp, snap, step) {
  if (!step.href) return null;
  // Inspect only navigation containers. Hovering a visible sibling can reveal a CSS submenu without
  // clicking arbitrary business actions. At most three candidates, each selected by an observed name.
  const candidates = await page.evaluate(({href, navigation}) => {
    const visible = e => !!e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
    const relative = e => { const u = new URL(e.getAttribute('href'), location.href); return u.pathname + u.search + u.hash; };
    const found = [];
    for (const target of document.querySelectorAll('nav a[href], [role="navigation"] a[href], [role="menubar"] a[href]')) {
      if (relative(target) !== href || visible(target)) continue;
      let parent = target.parentElement;
      for (let depth = 0; parent && depth < 3; depth++, parent = parent.parentElement) {
        const choices = [...parent.querySelectorAll('a[href]')].filter(visible);
        if (!choices.length || choices.length > 3) continue;
        for (const choice of choices) {
          const match = navigation.find(n => n.href === relative(choice));
          if (match && !found.some(n => n.name === match.name && n.role === match.role)) found.push(match);
        }
        if (found.length) break;
      }
    }
    return found.slice(0, 3);
  }, {href: step.href, navigation: snap.navigation});
  for (const candidate of candidates) {
    await page.getByRole(candidate.role, {name: candidate.name, exact: true}).hover({timeout: 500});
    await page.waitForTimeout(100);
    const revealed = await snapshot(page, cdp);
    const matches = revealed.navigation.filter(n => n.href === step.href && n.name === step.name);
    if (matches.length === 1) return {target: matches[0], via: candidate};
    await page.mouse.move(0, 0);
  }
  return null;
}

async function observeChoices(page, cdp, items, deadline) {
  // Opening an explicitly declared selector is UI disclosure, not choosing a value. Record options only
  // as relocation evidence; the at-rest inventory and navigation stay unchanged. The context ends next.
  for (const item of items.filter(i => i.disclosure).slice(0, 3)) {
    if (Date.now() + 800 >= deadline) break;
    try {
      const control = page.getByRole('combobox', {name: item.name, exact: true});
      await control.click({position: {x: 2, y: 2}, timeout: 500});
      await page.waitForTimeout(60);
      const {nodes} = await cdp.send('Accessibility.getFullAXTree');
      const byId = new Map(nodes.map(n => [n.nodeId, n]));
      const owned = node => {
        for (let p = byId.get(node.parentId); p; p = byId.get(p.parentId))
          if (p.role?.value === 'combobox') return norm(p.name?.value) === item.name;
        return false;
      };
      item.choices = [...new Set(nodes.filter(n => !n.ignored && n.role?.value === 'option' && owned(n))
        .map(n => norm(n.name?.value)).filter(Boolean))];
      await page.keyboard.press('Escape');
    } catch (e) { item.choices_unavailable = String(e.message).split('\n')[0].slice(0, 120); }
  }
}

async function run(input) {
  let pw;
  for (const name of ['playwright', '@playwright/test', 'playwright-core']) {
    try { pw = require(name); break; } catch {}
  }
  if (!pw) return {unavailable: 'Playwright runtime is not installed', screens: []};
  const browser = await pw.chromium.launch({timeout: 10000});
  const started = Date.now(), deadline = started + input.seconds * 1000;
  const screens = [], seen = new Set(['/']), queue = input.paths ? [...input.paths] : [[]];
  const blocked = new Set();
  let truncated = false;
  try {
    while (queue.length && screens.length < input.max_screens) {
      if (Date.now() >= deadline) { truncated = true; break; }
      const steps = queue.shift();
      const context = await browser.newContext({viewport: {width: 1280, height: 800}, locale: 'en-US',
        timezoneId: 'UTC', reducedMotion: 'reduce', serviceWorkers: 'block'});
      await context.route('**/*', route => {
        const req = route.request(), u = new URL(req.url());
        if (!['GET', 'HEAD'].includes(req.method()) || u.origin !== new URL(input.base).origin) {
          blocked.add(req.method() + ' ' + (u.origin === new URL(input.base).origin ? u.pathname : '[external]'));
          return route.abort();
        }
        return route.continue();
      });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', e => pageErrors.push(String(e.message).slice(0, 200)));
      page.setDefaultTimeout(900);
      page.setDefaultNavigationTimeout(2500);
      const cdp = await context.newCDPSession(page);
      const screen = {steps, status: 'ok', items: []};
      try {
        await page.goto(input.base + '/', {waitUntil: 'domcontentloaded'});
        await page.waitForTimeout(100);
        let snap = await snapshot(page, cdp);
        for (const step of steps) {
          if (Date.now() >= deadline) throw new Error('observation budget exhausted');
          // Re-resolve the exposed destination by name; route implementation may legitimately change.
          let matches = snap.navigation.filter(n => n.name === step.name && n.role === step.role);
          if (!matches.length && ['link', 'button'].includes(step.role))
            matches = snap.navigation.filter(n => n.name === step.name && ['link', 'button'].includes(n.role));
          if (!matches.length && step.href) {
            // The same exposed destination under a new name still reaches the old screen. The name change
            // remains an inventory difference on its parent; do not manufacture losses on every descendant.
            matches = snap.navigation.filter(n => n.href === step.href);
            if (matches.length > 1) matches = [matches.find(n => n.role === step.role) || matches[0]];
            if (matches.length === 1) (screen.renamed_steps ||= []).push({before: step, after: matches[0]});
          }
          if (!matches.length) {
            const reveal = await revealNavigation(page, cdp, snap, step);
            if (reveal) {
              matches = [reveal.target];
              (screen.relocations ||= []).push({before: step, via: reveal.via});
            }
          }
          if (matches.length !== 1) {
            const visible = snap.items.some(i => i.name === step.name &&
              (i.role === step.role || ['link', 'button'].includes(i.role) && ['link', 'button'].includes(step.role)));
            screen.status = visible ? 'unobserved' : 'missing-path';
            screen.failed_step = step; break;
          }
          const target = matches[0];
          if (target.kind === 'url') await page.goto(new URL(target.href, input.base).href, {waitUntil: 'domcontentloaded'});
          else await page.getByRole(target.role, {name: target.name, exact: true}).click();
          await page.mouse.move(0, 0);
          await page.waitForTimeout(100);
          snap = await snapshot(page, cdp);
        }
        screen.url = page.url().replace(input.base, '');
        if (screen.status === 'ok') {
          screen.items = snap.items;
          screen.navigation = snap.navigation;
          if (!input.paths && steps.length < input.depth) {
            for (const nav of snap.navigation) {
              const target = nav.kind === 'url' ? nav.href : screen.url + '|' + nav.kind + ':' + nav.name;
              if (seen.has(target) || target === screen.url) continue;
              seen.add(target);
              queue.push([...steps, nav]);
            }
          }
          await observeChoices(page, cdp, screen.items, deadline);
        }
      } catch (e) {
        // A navigation/render failure is observable; executor/budget failures must not invent losses.
        screen.status = Date.now() >= deadline ? 'unobserved' : 'navigation-error';
        screen.error = String(e.message).split('\n')[0].slice(0, 240).replaceAll(input.base, '[app]');
      } finally {
        if (pageErrors.length) screen.page_errors = [...new Set(pageErrors)];
        await context.close();
      }
      screens.push(screen);
    }
    truncated ||= queue.length > 0;
    return {screens, truncated, blocked_requests: [...blocked].sort(), seconds: (Date.now() - started) / 1000};
  } finally { await browser.close(); }
}

if (require.main === module) {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  run(input).then(r => process.stdout.write(JSON.stringify(r) + '\n')).catch(e => {
    process.stdout.write(JSON.stringify({unavailable: String(e.message).slice(0, 300), screens: []}) + '\n');
  });
}
module.exports = {destination};
