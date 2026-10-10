const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:3421/');
  const link = page.getByRole('link', { name: 'Q3 Sales', exact: true });
  const n = await link.count();
  let out = `links=${n}`;
  if (n === 1) {
    await link.click();
    const cell = (r) => page.getByRole('gridcell', { name: r, exact: true });
    try {
      await cell('A1').waitFor({ timeout: 4000 });
      const vals = [];
      for (const r of ['A1','B1','C1','A2','B2','C2','A3','B3','C3','A4','B4','C4','A5','B5','C5','A6','B6','C6']) vals.push(((await cell(r).textContent()) || '').trim());
      out += ' grid=' + vals.join('|');
      out += ' tabs=' + (await page.getByRole('tab').allTextContents()).join(',');
    } catch (e) { out += ' nogrid'; }
  } else {
    out += ' home-links=' + (await page.getByRole('link').allTextContents()).slice(0, 8).join(',');
  }
  console.log(out);
  await browser.close();
})();
