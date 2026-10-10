// REQ-3-1-1 Edit a Cell Through the Grid or Formula Bar

test('REQ-3-1-1 S1: 通过公式栏提交单元格值，依赖公式重算并持久化', async ({ page }) => {
  await createWorkbook(page);
  await setCells(page, [['A1', '2'], ['B1', '=A1*2'], ['C1', '=B1+1']]);
  await expectCells(page, { A1: '2', B1: '4', C1: '5' });

  await cell(page, 'A1').click();
  await expect(formulaBar(page)).toHaveValue('2');
  await formulaBar(page).fill('3');
  await formulaBar(page).press('Enter');

  await expectCells(page, { A1: '3', B1: '6', C1: '7' });
  await expectFormula(page, 'A1', '3');
  await expectFormula(page, 'B1', '=A1*2');

  await page.reload();
  await expectCells(page, { A1: '3', B1: '6', C1: '7' });
  await expectFormula(page, 'B1', '=A1*2');
  await expectFormula(page, 'A1', '3');
});

test('REQ-3-1-1 S2: Escape 取消网格内未提交编辑，刷新后保留原值', async ({ page }) => {
  await createWorkbook(page);
  await setCell(page, 'A1', 'Saved value');
  await expect(cell(page, 'A1')).toHaveText('Saved value');

  await cell(page, 'A1').dblclick();
  const editor = page.getByRole('textbox', { name: 'Edit A1', exact: true });
  await expect(editor).toBeVisible();
  await editor.fill('Unsaved value');
  await editor.press('Escape');

  await expect(editor).toBeHidden();
  await expect(cell(page, 'A1')).toHaveText('Saved value');
  await expect(formulaBar(page)).toHaveValue('Saved value');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('Saved value');
  await expectFormula(page, 'A1', 'Saved value');
  await expect(page.getByRole('gridcell').filter({ hasText: 'Unsaved value' })).toHaveCount(0);
});

test('REQ-3-1-1 S3: 通过网格提交文本、数字、布尔值、日期文本和公式', async ({ page }) => {
  await createWorkbook(page);
  await editInGrid(page, 'A1', 'Hello');
  await editInGrid(page, 'A2', '42');
  await editInGrid(page, 'A3', 'TRUE');
  await editInGrid(page, 'A4', '2026-09-27');
  await editInGrid(page, 'A5', '=A2*2');

  const expected = { A1: 'Hello', A2: '42', A3: 'TRUE', A4: '2026-09-27', A5: '84' };
  await expectCells(page, expected);
  await expectFormula(page, 'A1', 'Hello');
  await expectFormula(page, 'A2', '42');
  await expectFormula(page, 'A3', 'TRUE');
  await expectFormula(page, 'A4', '2026-09-27');
  await expectFormula(page, 'A5', '=A2*2');

  await page.reload();
  await expectCells(page, expected);
  await expectFormula(page, 'A5', '=A2*2');
  await expectFormula(page, 'A4', '2026-09-27');
});

test('REQ-3-1-1 S4: 在更深的单元格位置提交公式并在刷新后保持', async ({ page }) => {
  await createWorkbook(page);
  await setCells(page, [['B3', '7'], ['D8', '5']]);
  await expectCells(page, { B3: '7', D8: '5' });
  await editInGrid(page, 'F12', '=B3*D8');

  await expect(cell(page, 'F12')).toHaveText('35');
  await expectFormula(page, 'F12', '=B3*D8');

  await page.reload();
  await expect(cell(page, 'F12')).toHaveText('35');
  await expectFormula(page, 'F12', '=B3*D8');
});
