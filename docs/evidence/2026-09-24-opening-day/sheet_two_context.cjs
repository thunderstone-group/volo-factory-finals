// A creates a workbook and enters A1=2; B (isolated) opens that workbook URL.
const { chromium } = require('playwright');
(async () => {
  const base = process.argv[2];
  const browser = await chromium.launch();
  const a = await (await browser.newContext({ baseURL: base })).newPage();
  a.setDefaultTimeout(5000);
  await a.goto('/');
  await a.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await a.getByRole('button', { name: 'Create', exact: true }).click();
  await a.getByRole('gridcell', { name: 'A1', exact: true }).click();
  const fb = a.getByRole('textbox', { name: 'Formula bar' });
  await fb.fill('2'); await fb.press('Enter');
  const url = a.url();
  const b = await (await browser.newContext({ baseURL: base })).newPage();
  b.setDefaultTimeout(5000);
  await b.goto(url);
  const grid = await b.getByRole('grid', { name: 'Worksheet grid' }).isVisible().catch(() => false);
  const a1 = grid ? await b.getByRole('gridcell', { name: 'A1', exact: true }).innerText().catch(() => null) : null;
  console.log(JSON.stringify({ url, otherSessionGrid: grid, otherSessionA1: a1, otherSessionTitle: (await b.locator('h1,h2').first().innerText().catch(() => null)) }));
  await browser.close();
})().catch((e) => { console.error('ERR', e.message.split('\n')[0]); process.exit(1); });
