// REQ-2-2-2 Insert and Delete Columns (column-header menu opened by right-clicking the column header)

async function columnMenu(page, column, command) {
  await page.getByRole('columnheader', { name: column, exact: true }).click({ button: 'right' });
  await menuItem(page, command).click();
}

test('REQ-2-2-2 S1: 在 B 列左侧插入空白列，整列数据右移且刷新后保持', async ({ page }) => {
  await createWorkbook(page);
  await setCells(page, [['A1', 'Alpha'], ['B1', 'Beta'], ['C1', 'Gamma'], ['A2', '1'], ['B2', '2'], ['C2', '3']]);
  await expect(cell(page, 'C2')).toHaveText('3');

  await columnMenu(page, 'B', 'Insert 1 column left');
  const expected = { A1: 'Alpha', B1: '', C1: 'Beta', D1: 'Gamma', A2: '1', B2: '', C2: '2', D2: '3', E1: '' };
  await expectCells(page, expected);
  await page.reload();
  await expectCells(page, expected);
});

test('REQ-2-2-2 S2: 删除公式直接引用的 B 列后显示引用错误，重新打开后保持', async ({ page }) => {
  const name = `Columns ${uniq()}`;
  await createWorkbook(page, name);
  await setCells(page, [['A1', 'Unit price'], ['B1', 'Quantity'], ['C1', 'Total'], ['A2', '10'], ['B2', '2'], ['C2', '=A2*B2']]);
  await expect(cell(page, 'C2')).toHaveText('20');

  await columnMenu(page, 'B', 'Delete column');
  const expected = { A1: 'Unit price', A2: '10', B1: 'Total', B2: '#REF!', C1: '', C2: '' };
  await expectCells(page, expected);

  await reopenFromHome(page, name);
  await expectCells(page, expected);
});

test('REQ-2-2-2 S3: 在目标列右侧插入空白列并保持其他数据', async ({ page }) => {
  await createWorkbook(page);
  await setCells(page, [['A1', 'Alpha'], ['B1', 'Beta'], ['C1', 'Gamma'], ['A2', '1'], ['B2', '2'], ['C2', '3']]);
  await expect(cell(page, 'C2')).toHaveText('3');

  await columnMenu(page, 'B', 'Insert 1 column right');
  const expected = { A1: 'Alpha', B1: 'Beta', C1: '', D1: 'Gamma', A2: '1', B2: '2', C2: '', D2: '3', E1: '' };
  await expectCells(page, expected);
  await page.reload();
  await expectCells(page, expected);
});

test('REQ-2-2-2 S4: 插入列后调整公式引用并保持计算结果', async ({ page }) => {
  await createWorkbook(page);
  await setCells(page, [['A1', '10'], ['B1', '20'], ['C1', '=A1+B1']]);
  await expect(cell(page, 'C1')).toHaveText('30');

  await columnMenu(page, 'B', 'Insert 1 column left');
  await expectCells(page, { A1: '10', B1: '', C1: '20', D1: '30' });
  await expectFormula(page, 'D1', '=A1+C1');

  await page.reload();
  await expectCells(page, { A1: '10', B1: '', C1: '20', D1: '30' });
  await expectFormula(page, 'D1', '=A1+C1');
});

test('REQ-2-2-2 S5: 插入列时校验规则随原单元格右移', async ({ page }) => {
  await createWorkbook(page);
  await setCells(page, [['B1', 'Score'], ['B2', '50']]);
  await expect(cell(page, 'B2')).toHaveText('50');
  await addNumberRule(page, 'B2', 'B2', 0, 100);

  await columnMenu(page, 'B', 'Insert 1 column left');
  await expectCells(page, { B1: '', B2: '', C1: 'Score', C2: '50' });

  // The new blank column has no rule; the rule moved to C2 together with its value.
  await setCell(page, 'B2', '101');
  await expect(cell(page, 'B2')).toHaveText('101');
  await setCell(page, 'C2', '101');
  await expect(message(page, 'Please enter a number from 0 to 100')).toBeVisible();
  await expect(cell(page, 'C2')).toHaveText('50');

  await page.reload();
  await expectCells(page, { B2: '101', C1: 'Score', C2: '50' });
});
