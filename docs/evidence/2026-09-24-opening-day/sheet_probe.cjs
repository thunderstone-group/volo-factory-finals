// Time the steps a Sheet test must pass through, with the platform's 10 s action budget.
const { chromium } = require('playwright');
(async () => {
  const base = process.argv[2];
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ baseURL: base })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  const t0 = Date.now();
  const step = async (label, fn) => {
    const s = Date.now();
    try { await fn(); console.log(`ok   ${label} ${Date.now() - s} ms`); }
    catch (e) { console.log(`FAIL ${label} ${Date.now() - s} ms: ${e.message.split('\n').slice(0, 3).join(' | ')}`); }
  };
  page.setDefaultTimeout(8000);
  await step('goto /', () => page.goto('/'));
  await step('home link list visible', async () => { const n = await page.getByRole('link').count(); console.log('   links', n); });
  await step('click New blank workbook', () => page.getByRole('button', { name: 'New blank workbook', exact: true }).click());
  await step('click Create', () => page.getByRole('button', { name: 'Create', exact: true }).click());
  await step('grid visible', () => page.getByRole('grid', { name: 'Worksheet grid' }).waitFor());
  await step('gridcell A1', () => page.getByRole('gridcell', { name: 'A1', exact: true }).click());
  await step('formula bar fill 2 + Enter', async () => { const fb = page.getByRole('textbox', { name: 'Formula bar' }); await fb.fill('2'); await fb.press('Enter'); });
  await step('B1 via formula bar', async () => { await page.getByRole('gridcell', { name: 'B1', exact: true }).click(); const fb = page.getByRole('textbox', { name: 'Formula bar' }); await fb.fill('=A1*2'); await fb.press('Enter'); });
  await step('B1 shows 4', async () => { const t = await page.getByRole('gridcell', { name: 'B1', exact: true }).innerText(); console.log('   B1 text', JSON.stringify(t)); });
  await step('dblclick C1 edit', async () => { await page.getByRole('gridcell', { name: 'C1', exact: true }).dblclick(); await page.getByRole('textbox', { name: 'Edit C1' }).fill('hello'); await page.keyboard.press('Enter'); });
  await step('reload', () => page.reload());
  await step('A1 after reload', async () => { console.log('   A1', JSON.stringify(await page.getByRole('gridcell', { name: 'A1', exact: true }).innerText())); });
  console.log('total', Date.now() - t0, 'ms; url', page.url());
  console.log('gridcells', await page.getByRole('gridcell').count());
  console.log('errors', JSON.stringify(errors.slice(0, 5)));
  await browser.close();
})().catch((e) => { console.error('ERR', e.message.split('\n')[0]); process.exit(1); });
