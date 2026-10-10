// REQ-1-3-2 Export the Current Worksheet as CSV

test('REQ-1-3-2 S1: 导出活动工作表的计算结果与特殊文本，且刷新后原数据不变', async ({ page }) => {
  const name = `export-source-${uniq()}`;
  const csv = 'Region,Description,Quantity,Empty column,Formula result\n'
    + 'East China,"contains,comma",2,,\n'
    + 'North China,"华北""报价""\n第二行",3,,\n';
  await importCsv(page, `${name}.csv`, csv);
  await expect(cell(page, 'A2')).toHaveText('East China');
  await setCell(page, 'E2', '=C2*2');
  await setCell(page, 'E3', '=C3+2');
  await expectCells(page, { E2: '4', E3: '5' });
  await expectFormula(page, 'E2', '=C2*2');

  const rows = await exportCsv(page);
  expect(rows).toEqual([
    ['Region', 'Description', 'Quantity', 'Empty column', 'Formula result'],
    ['East China', 'contains,comma', '2', '', '4'],
    ['North China', '华北"报价"\n第二行', '3', '', '5'],
  ]);

  // Export changes nothing: active sheet, grid values and formula bar stay as they were.
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(formulaBar(page)).toHaveValue('=C2*2');
  await expectCells(page, { B2: 'contains,comma', E2: '4', E3: '5' });

  await page.reload();
  await expectCells(page, { A2: 'East China', B2: 'contains,comma', C2: '2', E2: '4', E3: '5' });
  await expect(cell(page, 'B3')).toHaveText('华北"报价" 第二行', { useInnerText: true });
  await expectFormula(page, 'E2', '=C2*2');
});

test('REQ-1-3-2 S2: 导出公式结果不会改写原公式或活动工作表', async ({ page }) => {
  await createWorkbook(page);
  await setCells(page, [['A1', '2'], ['B1', '3'], ['C1', '=A1+B1'], ['D1', '=C1*2']]);
  await expectCells(page, { C1: '5', D1: '10' });
  await expectFormula(page, 'C1', '=A1+B1');

  expect(await exportCsv(page)).toEqual([['2', '3', '5', '10']]);

  await expect(formulaBar(page)).toHaveValue('=A1+B1');
  await expectCells(page, { A1: '2', B1: '3', C1: '5', D1: '10' });
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');

  await page.reload();
  await expectCells(page, { C1: '5', D1: '10' });
  await expectFormula(page, 'C1', '=A1+B1');
  await expectFormula(page, 'D1', '=C1*2');
});

test('REQ-1-3-2 S3: 导出当前活动的第二个工作表内容', async ({ page }) => {
  await createWorkbook(page);
  await setCell(page, 'A1', 'Sheet1 only');
  await expect(cell(page, 'A1')).toHaveText('Sheet1 only');
  await addWorksheet(page, 'Sheet2');
  await setCells(page, [['A1', 'Item'], ['B1', 'Qty'], ['A2', 'Pen'], ['B2', '4']]);
  await expectCells(page, { A1: 'Item', B2: '4' });

  expect(await exportCsv(page)).toEqual([['Item', 'Qty'], ['Pen', '4']]);

  await expect(tab(page, 'Sheet2')).toHaveAttribute('aria-selected', 'true');
  await expectCells(page, { A1: 'Item', A2: 'Pen' });
  await page.reload();
  await expect(tab(page, 'Sheet2')).toHaveAttribute('aria-selected', 'true');
  await expectCells(page, { A1: 'Item', A2: 'Pen' });
});

test('REQ-1-3-2 S4: 切回 Sheet1 后导出仍只包含当前工作表内容', async ({ page }) => {
  await createWorkbook(page);
  await setCells(page, [['A1', 'Region'], ['B1', 'Sales'], ['A2', 'East'], ['B2', '1200'], ['A3', 'North'], ['B3', '800']]);
  await expect(cell(page, 'B3')).toHaveText('800');
  await addWorksheet(page, 'Sheet2');
  await setCells(page, [['A1', 'Item'], ['B1', 'Qty'], ['A2', 'Pen'], ['B2', '4'], ['C3', 'Extra']]);
  await expect(cell(page, 'C3')).toHaveText('Extra');

  await switchTo(page, 'Sheet1');
  await expect(cell(page, 'A2')).toHaveText('East');
  expect(await exportCsv(page)).toEqual([['Region', 'Sales'], ['East', '1200'], ['North', '800']]);

  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await page.reload();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expectCells(page, { A1: 'Region', A2: 'East', B3: '800' });
});
