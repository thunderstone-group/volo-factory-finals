// Deterministic browser observations from requirement declarations, never an acceptance score.
'use strict';
const fs = require('node:fs');
function scanSemantics(data) {

  const {contracts, home} = data; const win = window;
  const semanticErrors = [];
  const issue = (message) => { if (!semanticErrors.includes(message) && semanticErrors.length < 12) semanticErrors.push(message); };
  const norm = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const nameOf = (el) => {
    if (el.getAttribute('aria-label')) return norm(el.getAttribute('aria-label'));
    if (el.getAttribute('aria-labelledby')) return norm(el.getAttribute('aria-labelledby').split(/\s+/).map(id => {
      const n = win.document.getElementById(id); return n ? n.textContent : '';
    }).join(' '));
    if (el.labels && el.labels.length) return norm(Array.from(el.labels).map(n => n.textContent).join(' '));
    const copy = el.cloneNode(true);
    copy.querySelectorAll('[aria-hidden="true"]').forEach(n => n.remove());
    return norm(copy.textContent || el.getAttribute('title') || (el.tagName === 'INPUT' ? el.value : ''));
  };
  const roleOf = (el) => {
    if (el.getAttribute('role')) return el.getAttribute('role').split(/\s+/)[0];
    const tag = el.tagName;
    if (tag === 'BUTTON') return 'button';
    if (/^H[1-6]$/.test(tag)) return 'heading';
    if (tag === 'FORM' && nameOf(el)) return 'form';
    if (tag === 'SECTION' && (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby'))) return 'region';
    if (tag === 'A' && el.hasAttribute('href')) return 'link';
    if (tag === 'TEXTAREA') return 'textbox';
    if (tag === 'INPUT') {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      if (['checkbox', 'radio'].includes(type)) return type;
      if (['button', 'submit', 'reset'].includes(type)) return 'button';
      if (type === 'search') return 'searchbox';
      if (['text', 'email', 'tel', 'url'].includes(type)) return 'textbox';
    }
    return '';
  };
  const active = (el) => {
    if (el.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const style = win.getComputedStyle(n);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
    }
    return true;
  };
  const scanSemantics = () => {
    for (const el of win.document.querySelectorAll('button[role]')) {
      if (!active(el)) continue;
      const name = nameOf(el); const expected = contracts.roles[name.toLowerCase()] || [];
      if (expected.includes('button') && !expected.includes(roleOf(el)))
        issue(`Required button "${name}" is rendered with role=${roleOf(el)}; preserve the explicitly required button role.`);
    }
    for (const contract of contracts.formReveals || []) {
      for (const form of win.document.querySelectorAll('form, [role="form"]')) {
        if (!active(form) || nameOf(form) !== contract.form) continue;
        const controls = Array.from(form.querySelectorAll('button, a, [role="button"]'));
        if (!controls.some(el => active(el) && nameOf(el) === contract.control))
          issue(`Form "${contract.form}" requires a separate "${contract.control}" control to reveal its "${contract.placeholder}" textbox. A label attached to an always-visible input does not implement that activation flow.`);
      }
    }
  };
  scanSemantics();
  return semanticErrors;
}

async function observe(page, url, contracts) {
  const errors = new Set(); const actions = []; const pageErrors=[];
  page.on('pageerror', e => pageErrors.push(String(e.message).slice(0,400)));
  const scan = async home => {
    if (home) {
      for (const [role, name] of contracts.home) {
        if (!(await page.getByRole(role, {name, exact: true}).all()).length)
          errors.add(`Opening the entry URL requires a visible ${role} named "${name}", but it is absent. Preserve the declared role and accessible name.`);
      }
      for (const name of contracts.homeLists || []) {
        if (!await page.getByText(name, {exact: true}).first().isVisible())
          errors.add(`The homepage scenario requires the "${name}" list without an authentication prerequisite, but it is absent for the current unauthenticated visitor. Render this public list without requiring login, including after returning from a content view; keep separately authenticated dashboard lists conditional.`);
      }
    }
    (await page.evaluate(scanSemantics, {contracts, home})).forEach(e => errors.add(e));
  };
  const label = async el => el.evaluate(e => {
    if(e.getAttribute('aria-label'))return e.getAttribute('aria-label');
    if(e.labels && e.labels.length)return Array.from(e.labels).map(x=>x.textContent).join(' ').trim();
    const copy=e.cloneNode(true);copy.querySelectorAll('[aria-hidden="true"]').forEach(x=>x.remove());
    return (copy.textContent || e.title || '').replace(/\s+/g,' ').trim();
  });
  await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 10000});await page.waitForTimeout(100);await scan(true);
  for(const input of (await page.locator('input[type="text"], input:not([type])').elementHandles()).slice(0,3)){
    if(await input.isVisible()){try{await input.focus();await page.waitForTimeout(30);await scan(false);}catch{}}
  }
  await page.reload({waitUntil: 'domcontentloaded', timeout: 10000});
  await page.waitForTimeout(100);
  // Visit named requirement records using only navigation destinations exposed by the app.
  // These focused observations cover controls the general walk may never reach.
  const navigation = await page.locator('nav a[href^="#/"], aside [data-hash^="#/"], nav [data-hash^="#/"]').evaluateAll(es =>
    [...new Set(es.map(el => el.getAttribute('href') || el.getAttribute('data-hash')))]);
  const focusDeadline = Date.now() + 8000;
  const namedEntry = name => page.getByRole('link', {name, exact:true}).or(page.getByRole('button', {name, exact:true})).first();
  const visitRecord = async name => {
    for (const hash of ['#/', ...navigation]) {
      if (Date.now() >= focusDeadline) return false;
      await page.goto(new URL(hash, url).href, {waitUntil:'domcontentloaded', timeout:1500});
      await page.waitForTimeout(40);
      const entry = namedEntry(name);
      if (!await entry.isVisible()) continue;
      await entry.click({timeout:500}); await page.waitForTimeout(60);
      actions.push({scope:'record-entry',name,action:'navigation'});
      return true;
    }
    return false;
  };
  const activateDisclosure = async contract => {
    const form = page.getByRole('form', {name:contract.form,exact:true});
    if (!await form.isVisible()) return;
    await scan(false);
    const reveal = form.getByRole('button', {name:contract.control,exact:true}).or(form.getByRole('link', {name:contract.control,exact:true})).first();
    if (!await reveal.isVisible()) return;
    let field = null;
    for (const input of await form.locator('input[type="text"], input:not([type]), textarea').elementHandles()) {
      if (!await input.isVisible() || !await input.isEditable()) continue;
      const meta = await input.evaluate(el => ({id:el.id,name:el.name,placeholder:el.getAttribute('placeholder')}));
      if (!meta.id && !meta.name && !meta.placeholder) continue;
      field = meta;
      await input.fill('Diagnostic edited value');
      break;
    }
    await reveal.click({timeout:500});await page.waitForTimeout(40);
    if (!await form.getByPlaceholder(contract.placeholder,{exact:true}).isVisible())
      errors.add(`Activating "${contract.control}" in "${contract.form}" leaves the "${contract.placeholder}" textbox hidden. Preserve the disclosure state across rendering instead of resetting the form on every render.`);
    if (field) {
      const value = await form.evaluate((root,meta) => {
        const input = Array.from(root.querySelectorAll('input,textarea')).find(el =>
          meta.id ? el.id===meta.id : meta.name ? el.name===meta.name : el.getAttribute('placeholder')===meta.placeholder);
        return input ? input.value : null;
      },field);
      if (value !== 'Diagnostic edited value')
        errors.add(`Typing into "${contract.form}" and then activating "${contract.control}" discards the entered field value. Preserve the current form inputs and edit state when a disclosure or render updates the UI.`);
    }
  };
  for (const contract of (contracts.formReveals || []).filter(c => c.record && c.entryAction).slice(0,3)) {
    if (!await visitRecord(contract.record)) continue;
    const edit = namedEntry(contract.entryAction);
    if (!await edit.isVisible()) continue;
    await edit.click({timeout:500});await page.waitForTimeout(50);await activateDisclosure(contract);
  }
  for (const contract of (contracts.formReveals || []).filter(c => c.entryAction && !c.record).slice(0,3)) {
    if (await visitRecord(contract.entryAction)) await activateDisclosure(contract);
  }
  for (const contract of (contracts.recordActions || []).slice(0,3)) {
    if (!await visitRecord(contract.record)) continue;
    const action = namedEntry(contract.action);
    if (!await action.isVisible())
      errors.add(`The requirement starts "${contract.action}" from record "${contract.record}", but that action is absent on its details page. Keep creation actions available in the declared entry context.`);
    else { await action.click({timeout:500});await page.waitForTimeout(50);await scan(false); }
  }
  for (const contract of (contracts.pressedTransitions || []).slice(0,3)) {
    if (!await visitRecord(contract.record)) continue;
    const before = page.getByRole('button', {name:contract.before,exact:true}).first();
    if (!await before.isVisible() || await before.getAttribute('aria-pressed') !== 'false') {
      errors.add(`Record "${contract.record}" requires an initially visible "${contract.before}" button with aria-pressed=false, but it is absent or has the wrong state. Do not hide the declared action behind an unstated login prerequisite.`);
      continue;
    }
    await before.click({timeout:500});await page.waitForTimeout(80);
    const after = page.getByRole('button', {name:contract.after,exact:true}).first();
    if (!await after.isVisible() || await after.getAttribute('aria-pressed') !== 'true')
      errors.add(`Activating "${contract.before}" on "${contract.record}" does not produce "${contract.after}" with aria-pressed=true as declared. Do not add an unstated login prerequisite or leave the visible toggle inert.`);
  }
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:10000});await page.waitForTimeout(50);
  const end=Date.now()+16000;const queue=['#/'];const seen=new Set();const done=new Set();
  while(queue.length && seen.size<12 && Date.now()<end){
    const hash=queue.shift();if(seen.has(hash))continue;seen.add(hash);
    await page.evaluate(h=>{location.hash=h},hash);await page.waitForTimeout(30);
    for(let step=0;step<18 && Date.now()<end;step++){
      const links=await page.locator('a[href^="#/"], [data-hash^="#/"]').evaluateAll(es=>es.map(e=>({hash:e.getAttribute('href')||e.getAttribute('data-hash'),name:(e.getAttribute('aria-label')||e.textContent||'').replace(/\s+/g,' ').trim()})));
      for (const link of links) {
        const h = link.hash;
        if (h && !seen.has(h) && !queue.includes(h) && queue.length < 100) queue.push(h);
      }
      let scope=page;let scopeName='page';
      const dialog=page.getByRole('dialog').first();
      if(await dialog.isVisible()){scope=dialog;scopeName='dialog';}
      else {const card=page.getByRole('article').first();if(await card.isVisible()){try{await card.hover({timeout:500});}catch{}}}
      const popup=scope.locator('[data-popover]').first();if(await popup.isVisible()){scope=popup;scopeName+='-popover';}
      const candidates=[];
      for(const el of await scope.locator('button, [role="button"], input[type="checkbox"]').elementHandles()){
        if(!await el.isVisible() || !await el.isEnabled())continue;
        const name=await label(el);const meta=await el.evaluate(e=>({action:e.getAttribute('data-action')||e.getAttribute('data-change')||'',type:e.type||'',id:e.getAttribute('data-id')||'',inRecord:!!e.closest('article, [role="article"]')}));
        const key=hash+'|'+scopeName+'|'+meta.action+'|'+name+'|'+meta.id;
        if(done.has(key))continue;
        let priority=0;if(contracts.home.some(([r,n])=>r==='button'&&n===name))priority+=100;
        if(/more|option|edit|label|tag/i.test(name))priority+=20;
        if(meta.inRecord)priority+=40;
        if(meta.type==='checkbox')priority+=30;
        if(/close|cancel|save|done/i.test(name))priority-=5;
        candidates.push({el,name,meta,key,priority});
      }
      candidates.sort((a,b)=>b.priority-a.priority);const c=candidates[0];if(!c)break;done.add(c.key);
      let before=null;
      if(c.meta.type==='checkbox')before=await c.el.isChecked();
      try{
        const delivery = await c.el.evaluate(el => {
          const state = window.__arcProbeDelivery || (window.__arcProbeDelivery = {calls: 0, wrapped: new WeakSet()});
          const actions = window.APP && window.APP.actions || {};
          for (const [name, original] of Object.entries(actions)) {
            if (typeof original !== 'function' || state.wrapped.has(original)) continue;
            const wrapped = function () {
              'use strict';
              state.calls++;
              return Reflect.apply(original, this, arguments);
            };
            state.wrapped.add(wrapped);
            actions[name] = wrapped;
          }
          state.before = document.body.innerHTML + JSON.stringify(window.ARC && window.ARC.state) + location.href;
          return {calls: state.calls, registered: typeof actions[el.getAttribute('data-action')] === 'function'};
        });
        await c.el.click({timeout:700});await page.waitForTimeout(20);
        for (const contract of contracts.formReveals || []) {
          if (c.name !== contract.control) continue;
          const form = page.getByRole('form', {name:contract.form,exact:true});
          if (await form.isVisible() && !await form.getByPlaceholder(contract.placeholder,{exact:true}).isVisible())
            errors.add(`Activating "${contract.control}" in "${contract.form}" leaves the "${contract.placeholder}" textbox hidden. Preserve the disclosure state across rendering instead of resetting the form on every render.`);
        }
        if (delivery.registered) {
          const reached = await page.evaluate(previous => {
            const state = window.__arcProbeDelivery;
            return state.calls > previous || state.before !== document.body.innerHTML + JSON.stringify(window.ARC && window.ARC.state) + location.href;
          }, delivery.calls);
          if (!reached) {
            await page.waitForTimeout(200);
            const stillBlocked = await page.evaluate(previous => {
              const state = window.__arcProbeDelivery;
              return state.calls === previous && state.before === document.body.innerHTML + JSON.stringify(window.ARC && window.ARC.state) + location.href;
            }, delivery.calls);
            if (stillBlocked) errors.add(`Clicking "${c.name}" (data-action ${c.meta.action}) reached neither its registered APP handler nor a UI/state change. Keep the scaffold's delegated events reachable; capture listeners must not stop these actions.`);
          }
        }
        if(before!==null && await c.el.evaluate(e=>e.isConnected)){
          const after=await c.el.isChecked();
          if(after===before)errors.add('Checkbox "'+c.name+'" did not change state on native activation. Do not preventDefault its click or undo the checked state.');
        }
        actions.push({scope:scopeName,name:c.name,action:c.meta.action});await scan(false);
      }catch(e){actions.push({scope:scopeName,name:c.name,observation:String(e.message).slice(0,160)});}
      const dest=await page.evaluate(()=>location.hash||'#/');if(!seen.has(dest)&&!queue.includes(dest))queue.push(dest);
      if(dest!==hash)break;
    }
  }
  return {executed: true, diagnostic_only: true, errors: [...errors].slice(0, 12),
    page_errors: [...new Set(pageErrors)].slice(0, 6), actions, screens: [...seen]};
}

async function main() {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  const address = new URL(input.url);
  if (address.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(address.hostname))
    throw new Error('The diagnostic accepts only a local application URL');
  let chromium;
  try { ({chromium} = require('playwright')); }
  catch { return {executed: false, unavailable: 'module', diagnostic_only: true}; }
  let browser;
  try { browser = await chromium.launch({timeout: 10000}); }
  catch (e) { return {executed: false, unavailable: 'browser', reason: String(e.message).slice(0, 600), diagnostic_only: true}; }
  try {
    const context = await browser.newContext({viewport: {width: 1280, height: 720}, timezoneId: 'UTC'});
    const page = await context.newPage();
    page.setDefaultTimeout(1000);
    const result = await observe(page, input.url, input.contracts);
    return {...result, browser: browser.version(), playwright: require('playwright/package.json').version};
  } finally { await browser.close(); }
}
main().then(result => console.log(JSON.stringify(result))).catch(e => {
  console.log(JSON.stringify({executed: false, diagnostic_only: true, unavailable: 'probe', reason: String(e.message).slice(0, 600)}));
});
