// REQ-2-1-1 Add a Worksheet

test('REQ-2-1-1 S1: 新增并持久化 Sheet2，且不修改现有工作表数据', async ({ page }) => {
  await createWorkbook(page);
  await setCell(page, 'A1', 'Existing data');
  await expect(cell(page, 'A1')).toHaveText('Existing data');

  await btn(page, 'Add worksheet').click();
  await expect(tab(page, 'Sheet2')).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page, 'Sheet1')).not.toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('gridcell', { selected: true })).toHaveCount(1);
  await expectCells(page, { A1: '', B1: '' });
  const x1 = (await tab(page, 'Sheet1').boundingBox()).x;
  const x2 = (await tab(page, 'Sheet2').boundingBox()).x;
  expect(x1).toBeLessThan(x2);

  await page.reload();
  await expect(tab(page, 'Sheet2')).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(2);
  await switchTo(page, 'Sheet1');
  await expect(cell(page, 'A1')).toHaveText('Existing data');
});

test('REQ-2-1-1 S2: 新增工作表使用第一个未占用的 SheetN 名称', async ({ page }) => {
  await createWorkbook(page);
  await renameSheet(page, 'Sheet1', 'Summary');
  await expect(tab(page, 'Summary')).toBeVisible();
  await expect(tab(page, 'Sheet1')).toHaveCount(0);

  // Sheet1 is free again, so it is the first unused SheetN name; then Sheet2.
  await addWorksheet(page, 'Sheet1');
  await addWorksheet(page, 'Sheet2');
  await expect(page.getByRole('tab')).toHaveCount(3);

  await page.reload();
  await expect(tab(page, 'Summary')).toBeVisible();
  await expect(tab(page, 'Sheet1')).toBeVisible();
  await expect(tab(page, 'Sheet2')).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(3);
});
