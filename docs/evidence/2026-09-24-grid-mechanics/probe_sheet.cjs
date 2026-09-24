// Mechanics probe for a spreadsheet-like app (local diagnosis only): entry paths, click delivery, clipboard.
const { chromium } = require('playwright');
const T = 4000;
async function step(name, fn, out) { try { out[name] = await fn(); } catch (e) { out[name] = 'ERR ' + e.message.split('\n')[0].slice(0, 120); } }
(async () => {
  const base = process.argv[2]; const out = {};
  const b = await chromium.launch();
  const ctx = await b.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage(); p.setDefaultTimeout(T);
  await p.goto(base + '/');
  await step('create', async () => { await p.getByRole('button', { name: 'New blank workbook', exact: true }).click(); await p.getByRole('button', { name: 'Create', exact: true }).click(); await p.getByRole('grid', { name: 'Worksheet grid', exact: true }).waitFor(); return 'ok'; }, out);
  const grid = p.getByRole('grid', { name: 'Worksheet grid', exact: true });
  const cell = (c) => grid.getByRole('gridcell', { name: c, exact: true });
  await p.evaluate(() => { window.__ev = []; for (const t of ['click', 'dblclick']) document.addEventListener(t, (e) => window.__ev.push(t), true); });
  await step('click_delivered', async () => { await cell('F6').click(); const ev = await p.evaluate(() => window.__ev.slice()); return ev.includes('click') ? 'yes' : 'NO'; }, out);
  await step('dblclick_editor', async () => { await cell('A1').dblclick(); const ed = p.getByLabel('Edit A1', { exact: true }); await ed.waitFor(); await ed.fill('Dbl'); await ed.press('Enter'); await p.waitForTimeout(200); return (await cell('A1').innerText()).trim() === 'Dbl' ? 'ok' : 'value=' + JSON.stringify(await cell('A1').innerText()); }, out);
  await step('type_to_edit', async () => { await cell('B1').click(); await p.keyboard.type('Typed'); await p.keyboard.press('Enter'); await p.waitForTimeout(200); return (await cell('B1').innerText()).trim() === 'Typed' ? 'ok' : 'value=' + JSON.stringify(await cell('B1').innerText()); }, out);
  await step('formula_bar', async () => { await cell('C1').click(); const bar = p.getByLabel('Formula bar', { exact: true }); await bar.fill('Bar'); await bar.press('Enter'); await p.waitForTimeout(200); return (await cell('C1').innerText()).trim() === 'Bar' ? 'ok' : 'value=' + JSON.stringify(await cell('C1').innerText()); }, out);
  await step('ctrl_v_external', async () => { await p.evaluate(() => navigator.clipboard.writeText('P1\tP2\nP3\tP4')); await cell('B3').click(); await p.keyboard.press('Control+V'); await p.waitForTimeout(300); const got = [await cell('B3').innerText(), await cell('C3').innerText(), await cell('B4').innerText(), await cell('C4').innerText()].map((s) => s.trim()); return got.join(',') === 'P1,P2,P3,P4' ? 'ok' : 'got ' + got.join(','); }, out);
  await step('menu_paste', async () => { await p.evaluate(() => navigator.clipboard.writeText('M1\tM2')); await cell('B6').click({ button: 'right' }); await p.getByRole('menuitem', { name: 'Paste', exact: true }).click(); await p.waitForTimeout(300); const got = [await cell('B6').innerText(), await cell('C6').innerText()].map((s) => s.trim()); return got.join(',') === 'M1,M2' ? 'ok' : 'got ' + got.join(','); }, out);
  await step('reload_keeps', async () => { await p.reload(); await grid.waitFor(); return (await cell('C1').innerText()).trim() === 'Bar' ? 'ok' : 'value=' + JSON.stringify(await cell('C1').innerText()); }, out);
  console.log(JSON.stringify(out));
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
