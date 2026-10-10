test('probe validation entry paths', async ({ page }) => {
  test.setTimeout(40000);
  await createWorkbook(page);
  await setCells(page, [['B1', 'Score'], ['B2', '50']]);
  await expect(cell(page, 'B2')).toHaveText('50');
  await addNumberRule(page, 'B2', 'B2', 0, 100);
  await cell(page, 'B2').dblclick();
  const ed = page.getByRole('textbox', { name: 'Edit B2', exact: true });
  await ed.fill('101');
  await ed.press('Enter');
  await page.waitForTimeout(400);
  const body = await page.locator('body').innerText();
  console.log('S1 grid-editor 101 => B2 =', JSON.stringify(await cell(page, 'B2').innerText()), '| msg:', (body.match(/Please[^\n]*/) || ['none'])[0]);
  await setCell(page, 'B2', '102');
  await page.waitForTimeout(400);
  const body2 = await page.locator('body').innerText();
  console.log('S2 formula-bar 102 => B2 =', JSON.stringify(await cell(page, 'B2').innerText()), '| msg:', (body2.match(/Please[^\n]*/) || ['none'])[0]);
});
