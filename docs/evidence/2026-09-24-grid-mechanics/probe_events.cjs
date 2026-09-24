const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const base = process.argv[2];
  await p.goto(base + '/');
  await p.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await p.getByRole('button', { name: 'Create', exact: true }).click();
  const grid = p.getByRole('grid', { name: 'Worksheet grid', exact: true });
  await grid.waitFor();
  await p.evaluate(() => { window.__ev = []; for (const t of ['mousedown','mouseup','click','dblclick']) document.addEventListener(t, (e) => window.__ev.push(t + ':' + e.detail + ':' + (e.target.isConnected ? 'on' : 'off')), true); });
  await grid.getByRole('gridcell', { name: 'B2', exact: true }).click();
  console.log('single click events:', await p.evaluate(() => window.__ev.join(' ')));
  await p.evaluate(() => { window.__ev = []; });
  await grid.getByRole('gridcell', { name: 'A1', exact: true }).dblclick();
  console.log('dblclick events:', await p.evaluate(() => window.__ev.join(' ')));
  await b.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
