// REQ-2-1-3 Rename a Worksheet

test('REQ-2-1-3 S1: 保存唯一工作表名称，并在刷新后保持', async ({ page }) => {
  await createWorkbook(page);
  await setCell(page, 'A1', 'Sheet data');
  await expect(cell(page, 'A1')).toHaveText('Sheet data');

  await sheetMenu(page, 'Sheet1', 'Rename');
  const dlg = dialog(page, 'Rename worksheet');
  const nameBox = dlg.getByRole('textbox', { name: 'Worksheet name', exact: true });
  await expect(nameBox).toHaveValue('Sheet1');
  await nameBox.fill('Revenue');
  await btn(dlg, 'Save').click();
  await expect(dlg).toBeHidden();
  await expect(tab(page, 'Revenue')).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page, 'Sheet1')).toHaveCount(0);
  await expect(btn(page, 'Worksheet options for Revenue')).toBeVisible();

  await page.reload();
  await expect(tab(page, 'Revenue')).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page, 'Sheet1')).toHaveCount(0);
  await expect(cell(page, 'A1')).toHaveText('Sheet data');
});

test('REQ-2-1-3 S2: 重复工作表名称被拒绝，原名称保持不变', async ({ page }) => {
  await createWorkbook(page);
  await addWorksheet(page, 'Sheet2');

  await sheetMenu(page, 'Sheet2', 'Rename');
  const dlg = dialog(page, 'Rename worksheet');
  await dlg.getByRole('textbox', { name: 'Worksheet name', exact: true }).fill('Sheet1');
  await btn(dlg, 'Save').click();
  await expect(message(page, 'Worksheet name already exists')).toBeVisible();

  await page.reload();
  await expect(tab(page, 'Sheet2')).toBeVisible();
  await expect(tab(page, 'Sheet1')).toHaveCount(1);
  await expect(page.getByRole('tab')).toHaveCount(2);
});

test('REQ-2-1-3 S3: 空工作表名称被拒绝，刷新后仍保留原名称', async ({ page }) => {
  await createWorkbook(page);

  await sheetMenu(page, 'Sheet1', 'Rename');
  const dlg = dialog(page, 'Rename worksheet');
  await dlg.getByRole('textbox', { name: 'Worksheet name', exact: true }).fill('   ');
  await btn(dlg, 'Save').click();
  await expect(message(page, 'Worksheet name cannot be empty')).toBeVisible();

  await page.reload();
  await expect(tab(page, 'Sheet1')).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(1);
});
