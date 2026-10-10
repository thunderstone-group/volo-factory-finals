// REQ-2-2-1 Insert and Delete Rows (row-number menu opened by right-clicking the row header)

async function rowMenu(page, row, command) {
  await page.getByRole('rowheader', { name: String(row), exact: true }).click({ button: 'right' });
  await menuItem(page, command).click();
}

const SALES_ROWS = [
  ['A1', 'Region'], ['B1', 'Sales'],
  ['A2', 'East'], ['B2', '1200'],
  ['A3', 'North'], ['B3', '800'],
];

test('REQ-2-2-1 S1: 在第 3 行上方插入空白行，整行数据下移且刷新后保持', async ({ page }) => {
  await createWorkbook(page);
  await setCells(page, SALES_ROWS);
  await expect(cell(page, 'B3')).toHaveText('800');

  await rowMenu(page, 3, 'Insert 1 row above');
  const expected = { A1: 'Region', B1: 'Sales', A2: 'East', B2: '1200', A3: '', B3: '', A4: 'North', B4: '800', A5: '' };
  await expectCells(page, expected);
  await page.reload();
  await expectCells(page, expected);
});

test('REQ-2-2-1 S2: 删除第 3 行后后续数据上移，重新打开后顺序保持', async ({ page }) => {
  const name = `Rows ${uniq()}`;
  await createWorkbook(page, name);
  await setCells(page, [['A1', 'Name'], ['A2', 'Alpha'], ['A3', 'Remove me'], ['A4', 'Beta'], ['B4', '20']]);
  await expect(cell(page, 'B4')).toHaveText('20');

  await rowMenu(page, 3, 'Delete row');
  const expected = { A1: 'Name', A2: 'Alpha', A3: 'Beta', B3: '20', A4: '', B4: '' };
  await expectCells(page, expected);
  await expect(page.getByRole('gridcell').filter({ hasText: 'Remove me' })).toHaveCount(0);

  await reopenFromHome(page, name);
  await expectCells(page, expected);
  await expect(page.getByRole('gridcell').filter({ hasText: 'Remove me' })).toHaveCount(0);
});

test('REQ-2-2-1 S3: 在目标行下方插入空白行并保持其他数据', async ({ page }) => {
  await createWorkbook(page);
  await setCells(page, SALES_ROWS);
  await expect(cell(page, 'B3')).toHaveText('800');

  await rowMenu(page, 2, 'Insert 1 row below');
  const expected = { A1: 'Region', B1: 'Sales', A2: 'East', B2: '1200', A3: '', B3: '', A4: 'North', B4: '800', A5: '' };
  await expectCells(page, expected);
  await page.reload();
  await expectCells(page, expected);
});

test('REQ-2-2-1 S4: 插入行后调整公式引用并保持计算结果', async ({ page }) => {
  await createWorkbook(page);
  await setCells(page, [['A1', 'Qty'], ['A2', '10'], ['A3', '20'], ['A4', '=A2+A3']]);
  await expect(cell(page, 'A4')).toHaveText('30');

  await rowMenu(page, 3, 'Insert 1 row above');
  await expectCells(page, { A2: '10', A3: '', A4: '20', A5: '30' });
  await expectFormula(page, 'A5', '=A2+A4');

  await page.reload();
  await expectCells(page, { A2: '10', A3: '', A4: '20', A5: '30' });
  await expectFormula(page, 'A5', '=A2+A4');
});

test('REQ-2-2-1 S5: 插入行时校验规则随原单元格下移', async ({ page }) => {
  await createWorkbook(page);
  await setCells(page, [['B1', 'Score'], ['B2', '50']]);
  await expect(cell(page, 'B2')).toHaveText('50');
  await addNumberRule(page, 'B2', 'B2', 0, 100);

  await rowMenu(page, 2, 'Insert 1 row above');
  await expectCells(page, { B1: 'Score', B2: '', B3: '50' });

  // The new blank row has no rule; the rule moved to B3 together with its value.
  await setCell(page, 'B2', '101');
  await expect(cell(page, 'B2')).toHaveText('101');
  await setCell(page, 'B3', '101');
  await expect(message(page, 'Please enter a number from 0 to 100')).toBeVisible();
  await expect(cell(page, 'B3')).toHaveText('50');

  await page.reload();
  await expectCells(page, { B1: 'Score', B2: '101', B3: '50' });
});
