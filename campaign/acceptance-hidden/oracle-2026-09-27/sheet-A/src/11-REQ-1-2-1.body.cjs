// REQ-1-2-1 Create a Blank Workbook

test('REQ-1-2-1 S1: 创建空白工作簿，并在刷新后保留 Sheet1 与 A1 选中状态', async ({ page }) => {
  await page.goto('/');
  await btn(page, 'New blank workbook').click();
  await btn(page, 'Create').click();

  const expectBlankSheet1 = async () => {
    await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab')).toHaveCount(1);
    await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('gridcell', { selected: true })).toHaveCount(1);
    await expectCells(page, { A1: '', B1: '', A2: '', C3: '' });
    await expect(formulaBar(page)).toHaveValue('');
  };
  await expectBlankSheet1();
  await page.reload();
  await expectBlankSheet1();
});
