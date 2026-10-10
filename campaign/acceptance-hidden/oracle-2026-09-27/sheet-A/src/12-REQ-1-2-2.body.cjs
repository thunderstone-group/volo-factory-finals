// REQ-1-2-2 Rename a Workbook (works on its own new workbook; the shared seed is never renamed)

test('REQ-1-2-2 S1: 保存有效工作簿名，并在首页和重新打开后保持一致', async ({ page }) => {
  const id = uniq();
  const first = `Budget ${id}`;
  const second = `Forecast ${id}`;
  await createWorkbook(page);
  const box = page.getByRole('textbox', { name: 'Workbook name', exact: true });

  await btn(page, 'Rename workbook').click();
  await box.fill(first);
  await btn(page, 'Save').click();
  await expect(heading(page, first)).toBeVisible();

  // The text box is prefilled with the last saved name.
  await btn(page, 'Rename workbook').click();
  await expect(box).toHaveValue(first);
  await box.fill(second);
  await btn(page, 'Save').click();
  await expect(heading(page, second)).toBeVisible();

  await page.goto('/');
  await expect(link(page, second)).toBeVisible();
  await expect(link(page, first)).toHaveCount(0);
  await link(page, second).click();
  await expect(heading(page, second)).toBeVisible();
  await page.reload();
  await expect(heading(page, second)).toBeVisible();
});

test('REQ-1-2-2 S2: 纯空格名称被拒绝，重新打开后仍保留原名称', async ({ page }) => {
  const original = `Keep ${uniq()}`;
  await createWorkbook(page, original);
  await expect(heading(page, original)).toBeVisible();

  await btn(page, 'Rename workbook').click();
  await page.getByRole('textbox', { name: 'Workbook name', exact: true }).fill('   ');
  await btn(page, 'Save').click();
  await expect(message(page, 'Workbook name cannot be empty')).toBeVisible();

  await page.goto('/');
  await expect(link(page, original)).toBeVisible();
  await link(page, original).click();
  await expect(heading(page, original)).toBeVisible();
  await page.reload();
  await expect(heading(page, original)).toBeVisible();
});
