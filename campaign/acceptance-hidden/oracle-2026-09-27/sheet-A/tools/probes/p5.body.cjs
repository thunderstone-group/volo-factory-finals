test('probe screenshot', async ({ page }) => {
  test.setTimeout(40000);
  await createWorkbook(page);
  await setCells(page, [['A1', 'Region'], ['B1', 'Sales'], ['A2', 'East']]);
  await page.screenshot({ path: process.env.SHOT_PATH || 'shot.png' });
  const css = await page.evaluate(() => [...document.styleSheets].map((s) => s.href || 'inline').join(','));
  console.log('R1 stylesheets', css);
});
