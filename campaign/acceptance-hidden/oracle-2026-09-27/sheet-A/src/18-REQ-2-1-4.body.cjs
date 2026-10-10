// REQ-2-1-4 Delete a Worksheet

const SALES_ROWS = [
  ['A1', 'Region'], ['B1', 'Sales'],
  ['A2', 'East'], ['B2', '1200'],
  ['A3', 'North'], ['B3', '800'],
];
const PIVOT_RESULT = {
  A1: 'Region', B1: 'SUM of Sales',
  A2: 'East', B2: '1200',
  A3: 'North', B3: '800',
  A4: 'Grand Total', B4: '2000',
};

// Opens the tab menu of the given sheet, chooses Delete and confirms in the "Delete worksheet" dialog.
async function deleteSheetConfirmed(page, sheet) {
  await tab(page, sheet).click();
  await sheetMenu(page, sheet, 'Delete');
  const dlg = dialog(page, 'Delete worksheet');
  await expect(dlg).toBeVisible();
  await expect(dlg).toContainText(sheet);
  await btn(dlg, 'Delete worksheet').click();
  return dlg;
}

test('REQ-2-1-4 S1: 删除多工作表中的当前工作表，并在刷新后保持删除状态', async ({ page }) => {
  await createWorkbook(page);
  await setCell(page, 'A1', 'Keep me');
  await expect(cell(page, 'A1')).toHaveText('Keep me');
  await addWorksheet(page, 'Sheet2');
  await setCell(page, 'A1', 'Delete me');
  await expect(cell(page, 'A1')).toHaveText('Delete me');

  const dlg = await deleteSheetConfirmed(page, 'Sheet2');
  await expect(dlg).toBeHidden();
  await expect(tab(page, 'Sheet2')).toHaveCount(0);
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Keep me');
  await expect(page.getByRole('gridcell').filter({ hasText: 'Delete me' })).toHaveCount(0);

  await page.reload();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Keep me');
  await expect(tab(page, 'Sheet2')).toHaveCount(0);
  await expect(page.getByRole('tab')).toHaveCount(1);
});

test('REQ-2-1-4 S2: 最后一个工作表不能删除，刷新后仍然存在', async ({ page }) => {
  await createWorkbook(page);
  await setCell(page, 'A1', 'Only sheet');
  await expect(cell(page, 'A1')).toHaveText('Only sheet');

  await sheetMenu(page, 'Sheet1', 'Delete');
  await expect(message(page, 'A workbook must contain at least one worksheet')).toBeVisible();
  await expect(dialog(page, 'Delete worksheet')).toHaveCount(0);
  await expect(tab(page, 'Sheet1')).toBeVisible();

  await page.reload();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab')).toHaveCount(1);
  await expect(cell(page, 'A1')).toHaveText('Only sheet');
});

test('REQ-2-1-4 S3: 透视表源工作表不能删除，源数据和透视结果均保持', async ({ page }) => {
  await createWorkbook(page);
  await setCells(page, SALES_ROWS);
  await expect(cell(page, 'B3')).toHaveText('800');
  await createPivot(page, 'A1', 'B3', { rows: 'Region', values: 'Sales', summarize: 'SUM' });
  await expectCells(page, PIVOT_RESULT);

  const dlg = await deleteSheetConfirmed(page, 'Sheet1');
  await expect(message(page, 'Please delete or rebuild dependent pivot tables first')).toBeVisible();
  await expect(dlg).toBeHidden();
  await expect(tab(page, 'Sheet1')).toBeVisible();
  await expect(tab(page, 'Pivot1')).toBeVisible();
  await switchTo(page, 'Sheet1');
  await expectCells(page, { A1: 'Region', A2: 'East', B2: '1200', A3: 'North', B3: '800' });
  await switchTo(page, 'Pivot1');
  await expectCells(page, PIVOT_RESULT);

  await page.reload();
  await expect(tab(page, 'Sheet1')).toBeVisible();
  await switchTo(page, 'Pivot1');
  await expectCells(page, PIVOT_RESULT);
  await switchTo(page, 'Sheet1');
  await expectCells(page, { A2: 'East', B3: '800' });
});

test('REQ-2-1-4 S4: 删除透视结果工作表会移除配置并允许随后删除原源表', async ({ page }) => {
  await createWorkbook(page);
  await setCells(page, SALES_ROWS);
  await expect(cell(page, 'B3')).toHaveText('800');
  await addWorksheet(page, 'Sheet2');
  await setCell(page, 'A1', 'Survivor');
  await expect(cell(page, 'A1')).toHaveText('Survivor');
  await switchTo(page, 'Sheet1');
  // The result layout is REQ-5-3-1's business; here the applied pivot only has to exist (a Grand Total is shown).
  await createPivot(page, 'A1', 'B3', { rows: 'Region', values: 'Sales', summarize: 'SUM' });
  await expect(page.getByText('Grand Total', { exact: true })).not.toHaveCount(0);

  const pivotDialog = await deleteSheetConfirmed(page, 'Pivot1');
  await expect(pivotDialog).toBeHidden();
  await expect(tab(page, 'Pivot1')).toHaveCount(0);

  const sourceDialog = await deleteSheetConfirmed(page, 'Sheet1');
  await expect(sourceDialog).toBeHidden();
  await expect(tab(page, 'Sheet1')).toHaveCount(0);
  await expect(message(page, 'Please delete or rebuild dependent pivot tables first')).toHaveCount(0);
  await expect(tab(page, 'Sheet2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Survivor');

  await page.reload();
  await expect(tab(page, 'Sheet2')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab')).toHaveCount(1);
  await expect(cell(page, 'A1')).toHaveText('Survivor');
});
