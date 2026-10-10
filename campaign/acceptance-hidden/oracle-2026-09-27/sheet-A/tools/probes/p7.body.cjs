test('probe pivot source delete', async ({ page }) => {
  test.setTimeout(40000);
  await createWorkbook(page);
  await setCells(page, [['A1', 'Region'], ['B1', 'Sales'], ['A2', 'East'], ['B2', '1200'], ['A3', 'North'], ['B3', '800']]);
  await createPivot(page, 'A1', 'B3', { rows: 'Region', values: 'Sales', summarize: 'SUM' });
  await expect(cell(page, 'B4')).toHaveText('2000');
  await tab(page, 'Sheet1').click();
  await page.evaluate(() => { window.__texts = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) { const t = (n.innerText || n.textContent || '').trim(); if (t) window.__texts.push(t.slice(0, 120)); } }).observe(document.body, { childList: true, subtree: true }); });
  await btn(page, 'Worksheet options for Sheet1').click();
  const items = await page.getByRole('menuitem').evaluateAll((els) => els.map((e) => `${e.textContent.trim()}${e.getAttribute('aria-disabled') === 'true' || e.disabled ? '(disabled)' : ''}`));
  console.log('T1 menu items', JSON.stringify(items));
  await menuItem(page, 'Delete').click();
  await page.waitForTimeout(1500);
  console.log('T2 added texts', JSON.stringify(await page.evaluate(() => window.__texts)));
  console.log('T3 tabs', JSON.stringify(await page.getByRole('tab').allInnerTexts()));
});
