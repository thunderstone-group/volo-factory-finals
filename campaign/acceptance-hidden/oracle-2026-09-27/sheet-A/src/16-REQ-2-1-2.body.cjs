// REQ-2-1-2 Switch Worksheets

test('REQ-2-1-2 S1: 切换工作表时恢复各自数据、选中单元格和公式栏', async ({ page }) => {
  await createWorkbook(page);
  await setCells(page, [['A1', 'East'], ['B1', '1200']]);
  await cell(page, 'B1').click();
  await expect(formulaBar(page)).toHaveValue('1200');
  await addWorksheet(page, 'Sheet2');
  await setCells(page, [['A2', 'North'], ['B2', '800']]);
  await cell(page, 'A2').click();
  await expect(formulaBar(page)).toHaveValue('North');

  const expectSheet1 = async () => {
    await expectCells(page, { A1: 'East', B1: '1200', A2: '', B2: '' });
    await expect(cell(page, 'B1')).toHaveAttribute('aria-selected', 'true');
    await expect(cell(page, 'A2')).toHaveAttribute('aria-selected', 'false');
    await expect(formulaBar(page)).toHaveValue('1200');
  };
  const expectSheet2 = async () => {
    await expectCells(page, { A2: 'North', B2: '800', A1: '', B1: '' });
    await expect(cell(page, 'A2')).toHaveAttribute('aria-selected', 'true');
    await expect(cell(page, 'B1')).toHaveAttribute('aria-selected', 'false');
    await expect(formulaBar(page)).toHaveValue('North');
  };
  await switchTo(page, 'Sheet1');
  await expectSheet1();
  await switchTo(page, 'Sheet2');
  await expectSheet2();

  // Reopening shows the last active tab and each sheet's last selected cell.
  await page.reload();
  await expect(tab(page, 'Sheet2')).toHaveAttribute('aria-selected', 'true');
  await expectSheet2();
  await switchTo(page, 'Sheet1');
  await expectSheet1();
});

test('REQ-2-1-2 S2: 切换工作表时恢复公式原文并隔离普通值', async ({ page }) => {
  await createWorkbook(page);
  await setCells(page, [['A1', '2'], ['B1', '3'], ['C1', '=A1+B1']]);
  await expect(cell(page, 'C1')).toHaveText('5');
  await cell(page, 'C1').click();
  await addWorksheet(page, 'Sheet2');
  await setCell(page, 'C1', 'Plain text');
  await cell(page, 'C1').click();
  await expect(formulaBar(page)).toHaveValue('Plain text');

  await switchTo(page, 'Sheet1');
  await expectCells(page, { A1: '2', B1: '3', C1: '5' });
  await expect(cell(page, 'C1')).toHaveAttribute('aria-selected', 'true');
  await expect(formulaBar(page)).toHaveValue('=A1+B1');

  await switchTo(page, 'Sheet2');
  await expectCells(page, { A1: '', B1: '', C1: 'Plain text' });
  await expect(formulaBar(page)).toHaveValue('Plain text');

  await page.reload();
  await expect(tab(page, 'Sheet2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'C1')).toHaveText('Plain text');
  await expect(formulaBar(page)).toHaveValue('Plain text');
  await switchTo(page, 'Sheet1');
  await expect(cell(page, 'C1')).toHaveText('5');
  await expect(formulaBar(page)).toHaveValue('=A1+B1');
});

test('REQ-2-1-2 S3: 切换工作表时筛选与校验入口保持隔离', async ({ page }) => {
  await createWorkbook(page);
  await setCells(page, [
    ['A1', 'Region'], ['B1', 'Sales'], ['C1', 'Status'],
    ['A2', 'East'], ['B2', '1200'], ['C2', 'Open'],
    ['A3', 'North'], ['B3', '800'], ['C3', 'Closed'],
  ]);
  await expect(cell(page, 'C3')).toHaveText('Closed');
  await selectRange(page, 'A1', 'C3');
  await dataMenu(page, 'Create filter');
  const filterRegion = btn(page, 'Filter Region');
  await expect(filterRegion).toBeVisible();
  await addDropdownRule(page, 'C2', 'C3', 'Open, Closed');
  const dropdownC2 = btn(page, 'Open dropdown for C2');
  await expect(dropdownC2).toBeVisible();

  await addWorksheet(page, 'Sheet2');
  await setCell(page, 'A1', 'Notes');
  await expect(cell(page, 'A1')).toHaveText('Notes');
  await expect(filterRegion).toHaveCount(0);
  await expect(dropdownC2).toHaveCount(0);

  await switchTo(page, 'Sheet1');
  await expectCells(page, { A2: 'East', B3: '800' });
  await expect(filterRegion).toBeVisible();
  await expect(dropdownC2).toBeVisible();

  await switchTo(page, 'Sheet2');
  await expectCells(page, { A1: 'Notes', A2: '' });
  await expect(filterRegion).toHaveCount(0);
  await expect(dropdownC2).toHaveCount(0);

  await page.reload();
  await expect(tab(page, 'Sheet2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Notes');
  await expect(filterRegion).toHaveCount(0);
  await expect(dropdownC2).toHaveCount(0);
});

test('REQ-2-1-2 S4: 在三张工作表之间切换时分别恢复各自选中单元格', async ({ page }) => {
  await createWorkbook(page);
  await setCell(page, 'B2', 'one');
  await cell(page, 'B2').click();
  await addWorksheet(page, 'Sheet2');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await setCell(page, 'C3', 'two');
  await cell(page, 'C3').click();
  await addWorksheet(page, 'Sheet3');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await setCell(page, 'D4', 'three');
  await cell(page, 'D4').click();

  const expectOn = async (sheet, ref, value, others) => {
    await switchTo(page, sheet);
    await expectSelection(page, [ref], others);
    await expect(formulaBar(page)).toHaveValue(value);
  };
  await expectOn('Sheet1', 'B2', 'one', ['A1', 'C3', 'D4']);
  await expectOn('Sheet2', 'C3', 'two', ['A1', 'B2', 'D4']);
  await expectOn('Sheet3', 'D4', 'three', ['A1', 'B2', 'C3']);
  await expectOn('Sheet1', 'B2', 'one', ['A1', 'C3', 'D4']);

  await page.reload();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expectSelection(page, ['B2'], ['A1']);
  await expectOn('Sheet3', 'D4', 'three', ['A1', 'B2']);
  await expectOn('Sheet2', 'C3', 'two', ['A1', 'D4']);
});

test('REQ-2-1-2 S5: 切换工作表时保持各自公式栏原文与计算结果', async ({ page }) => {
  await createWorkbook(page);
  await setCells(page, [['A1', '10'], ['B1', '=A1*2']]);
  await expect(cell(page, 'B1')).toHaveText('20');
  await cell(page, 'B1').click();
  await addWorksheet(page, 'Sheet2');
  await setCells(page, [['A1', '5'], ['B1', '=A1+100']]);
  await expect(cell(page, 'B1')).toHaveText('105');
  await cell(page, 'B1').click();

  const expectSheet = async (sheet, a1, b1, formula) => {
    await switchTo(page, sheet);
    await expectCells(page, { A1: a1, B1: b1 });
    await expect(cell(page, 'B1')).toHaveAttribute('aria-selected', 'true');
    await expect(formulaBar(page)).toHaveValue(formula);
  };
  await expectSheet('Sheet1', '10', '20', '=A1*2');
  await expectSheet('Sheet2', '5', '105', '=A1+100');
  await expectSheet('Sheet1', '10', '20', '=A1*2');
  await page.reload();
  await expectSheet('Sheet1', '10', '20', '=A1*2');
  await expectSheet('Sheet2', '5', '105', '=A1+100');
});
