// REQ-3-1-3 Select a Rectangular Cell Range

test('REQ-3-1-3 S1: 拖拽选择精确的矩形区域', async ({ page }) => {
  await createWorkbook(page);
  // Data in A1:B3 plus adjacent data to the right (column C) and below (row 4).
  await setCells(page, [
    ['A1', 'Region'], ['B1', 'Sales'], ['C1', 'Status'],
    ['A2', 'East'], ['B2', '1200'], ['C2', 'Open'],
    ['A3', 'North'], ['B3', '800'], ['C3', 'Closed'],
    ['A4', 'South'], ['B4', '500'],
  ]);
  await expect(cell(page, 'B4')).toHaveText('500');

  await selectRange(page, 'A1', 'B3');
  await expect(grid(page)).toHaveAttribute('aria-multiselectable', 'true');
  await expectSelection(page, ['A1', 'A2', 'A3', 'B1', 'B2', 'B3'], ['C1', 'C2', 'C3', 'A4', 'B4', 'C4']);

  // A range operation reports exactly the dragged rectangle, not the adjacent data region.
  await dataMenu(page, 'Create pivot table');
  const dlg = dialog(page, 'Create pivot table');
  await expect(dlg.getByText('Source range: A1:B3', { exact: true })).toBeVisible();
});

test('REQ-3-1-3 S2: 刷新后恢复完整选区，新的单元格选择会替换该选区', async ({ page }) => {
  await createWorkbook(page);
  await selectRange(page, 'B2', 'C4');
  const rectangle = ['B2', 'B3', 'B4', 'C2', 'C3', 'C4'];
  const around = ['A1', 'B1', 'D2', 'A3', 'D4', 'B5', 'C5'];
  await expectSelection(page, rectangle, around);

  await page.reload();
  await expectSelection(page, rectangle, around);

  await cell(page, 'D1').click();
  await expectSelection(page, ['D1'], ['B2', 'C3', 'C4', 'A1']);
  await page.reload();
  await expectSelection(page, ['D1'], ['B2', 'C3', 'C4', 'A1']);
});
