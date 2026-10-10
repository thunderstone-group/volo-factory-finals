test('probe seed', async ({ page }) => {
  test.setTimeout(40000);
  await page.goto('/');
  const links = await page.getByRole('link').allInnerTexts();
  console.log('V1 home links', JSON.stringify(links.map((s) => s.trim()).filter(Boolean).slice(0, 12)));
  await link(page, 'Q3 Sales').click();
  await expect(cell(page, 'A1')).toBeVisible();
  const tabs = await page.getByRole('tab').allInnerTexts();
  console.log('V2 tabs', JSON.stringify(tabs.map((s) => s.trim())));
  for (const t of tabs.map((s) => s.trim())) {
    await tab(page, t).click();
    await page.waitForTimeout(300);
    const rows = [];
    for (let r = 1; r <= 7; r++) {
      const vals = [];
      for (const c of ['A', 'B', 'C', 'D', 'E']) vals.push((await cell(page, `${c}${r}`).innerText().catch(() => '?')).trim());
      rows.push(vals.join('/'));
    }
    console.log(`V3 ${t}: ${rows.join(' | ')}`);
  }
});
