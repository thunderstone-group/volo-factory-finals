// Deterministic browser observations from requirement declarations, never an acceptance score.
'use strict';
const fs = require('node:fs');
function scanSemantics(data) {

  const {contracts} = data; const win = window;
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
    for (const dialog of win.document.querySelectorAll('[role="dialog"]')) {
      if (!active(dialog)) continue;
      const seen = new Map();
      for (const button of dialog.querySelectorAll('button')) {
        if (!active(button) || button.closest('[role="dialog"]') !== dialog) continue;
        const name = nameOf(button);
        if (!/^(close|save|cancel|done)$/i.test(name)) continue;
        const key = name.toLowerCase(); seen.set(key, (seen.get(key) || 0) + 1);
      }
      for (const [name, count] of seen) if (count > 1)
        issue(`Dialog "${nameOf(dialog)}" contains ${count} active "${name}" buttons. Keep one completion action in the editor; nested field choosers must not duplicate it.`);
    }
    if (contracts.recordEditors.length === 1) {
      for (const popup of win.document.querySelectorAll('[data-popover]')) {
        if (!active(popup)) continue;
        const fields = Array.from(popup.querySelectorAll('input[type="checkbox"]'));
        if (fields.length && popup.closest('article, [role="article"]') && !popup.closest('[role="dialog"]'))
          issue(`Record field chooser (${fields.map(nameOf).slice(0, 5).join(', ')}) is outside the declared record editor "${contracts.recordEditors[0]}". Reuse that named entity editor for field editing and preserve the checkbox elements until explicit completion.`);
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
          errors.add(`The requirement describes a "${name}" list on the homepage; its heading is absent on the initial page. Make the described list and its navigation available, including after returning from a content view.`);
      }
    }
    (await page.evaluate(scanSemantics, {contracts})).forEach(e => errors.add(e));
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
  const end=Date.now()+16000;const queue=['#/'];const seen=new Set();const done=new Set();
  while(queue.length && seen.size<12 && Date.now()<end){
    const hash=queue.shift();if(seen.has(hash))continue;seen.add(hash);
    await page.evaluate(h=>{location.hash=h},hash);await page.waitForTimeout(30);
    for(let step=0;step<18 && Date.now()<end;step++){
      const links=await page.locator('a[href^="#/"], [data-hash^="#/"]').evaluateAll(es=>es.map(e=>e.getAttribute('href')||e.getAttribute('data-hash')));
      for(const h of links)if(h && !seen.has(h) && !queue.includes(h) && queue.length<100)queue.push(h);
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
        await c.el.click({timeout:700});await page.waitForTimeout(20);
        if(before!==null && await c.el.evaluate(e=>e.isConnected)){
          const after=await c.el.isChecked();
          if(after===before)errors.add('Checkbox "'+c.name+'" did not change state on native activation. Do not preventDefault its click or undo the checked state.');
        }
        if (c.meta.inRecord && contracts.recordEditors.length === 1) {
          const editor = page.getByRole('dialog').first();
          if (await editor.isVisible() && await editor.getByRole('checkbox').count()) {
            const actual = await label(await editor.elementHandle());
            if (actual.toLowerCase() !== contracts.recordEditors[0].toLowerCase())
              errors.add(`Record field editing opened dialog "${actual}" instead of the declared editor "${contracts.recordEditors[0]}". Reuse the named entity editor for these fields.`);
          }
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
