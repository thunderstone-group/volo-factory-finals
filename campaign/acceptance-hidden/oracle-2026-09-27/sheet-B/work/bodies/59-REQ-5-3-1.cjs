// REQ-5-3-1 Create and Refresh a Basic Pivot Table

test('REQ-5-3-1 S1: 在 Pivot1 按 Region 汇总 Sales，并保持源表不变', async ({ page }) => {
  await openNewWorkbook(page);
  const source = {
    A1: 'Region', B1: 'Sales',
    A2: 'East', B2: '1200',
    A3: 'North', B3: '800',
    A4: 'East', B4: '600',
    A5: 'South', B5: '1000',
    A6: 'North', B6: '700',
  };
  await enterAll(page, Object.entries(source));

  await dragSelect(page, 'A1', 'B6');
  await dataMenu(page, 'Create pivot table');
  const dialog = page.getByRole('dialog', { name: 'Create pivot table', exact: true });
  await expect(dialog.getByText('Source range: A1:B6', { exact: true })).toBeVisible();
  await dialog.getByRole('radio', { name: 'New worksheet', exact: true }).check();
  await button(dialog, 'Create').click();
  await tab(page, 'Pivot1').click();
  await applyPivot(page, { rows: 'Region', values: 'Sales', summarize: 'SUM' });

  const result = {
    A1: 'Region', B1: 'SUM of Sales',
    A2: 'East', B2: '1800',
    A3: 'North', B3: '1500',
    A4: 'South', B4: '1000',
    A5: 'Grand Total', B5: '4300',
  };
  await expectCells(page, result);

  await tab(page, 'Sheet1').click();
  await expectCells(page, source);

  await reload(page);
  await tab(page, 'Pivot1').click();
  await expectCells(page, result);
});

test('REQ-5-3-1 S2: 刷新已有透视表后覆盖旧汇总，并持久化新结果', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [
    ['A1', 'Region'], ['B1', 'Sales'],
    ['A2', 'East'], ['B2', '1200'],
    ['A3', 'North'], ['B3', '800'],
    ['A4', 'East'], ['B4', '600'],
  ]);
  await createPivot(page, 'A1', 'B4');
  await applyPivot(page, { rows: 'Region', values: 'Sales', summarize: 'SUM' });
  await expectCells(page, { A2: 'East', B2: '1800', A3: 'North', B3: '800', A4: 'Grand Total', B4: '2600' });

  await tab(page, 'Sheet1').click();
  await enter(page, 'B2', '1500');
  await expectCells(page, { B2: '1500' });

  await tab(page, 'Pivot1').click();
  await button(page, 'Refresh pivot table').click();
  const refreshed = { A1: 'Region', B1: 'SUM of Sales', A2: 'East', B2: '2100', A3: 'North', B3: '800', A4: 'Grand Total', B4: '2900' };
  await expectCells(page, refreshed);

  await tab(page, 'Sheet1').click();
  await expectCells(page, { A2: 'East', B2: '1500', A3: 'North', B3: '800', A4: 'East', B4: '600' });

  await reload(page);
  await tab(page, 'Pivot1').click();
  await expectCells(page, refreshed);
});

test('REQ-5-3-1 S3: 使用行列字段和 COUNT 生成二维汇总并持久化', async ({ page }) => {
  await openNewWorkbook(page);
  // Seed layout (Region/Sales/Status, first three records from the requirement seed) plus two records.
  await enterAll(page, [
    ['A1', 'Region'], ['B1', 'Sales'], ['C1', 'Status'],
    ['A2', 'East'], ['B2', '1200'], ['C2', 'Open'],
    ['A3', 'North'], ['B3', '800'], ['C3', 'Closed'],
    ['A4', 'South'], ['B4', '700'], ['C4', 'Open'],
    ['A5', 'East'], ['B5', '900'], ['C5', 'Closed'],
    ['A6', 'East'], ['B6', '500'], ['C6', 'Open'],
  ]);
  await createPivot(page, 'A1', 'C6');
  await applyPivot(page, { rows: 'Region', columns: 'Status', values: 'Sales', summarize: 'COUNT' });

  const result = {
    A1: 'Region', B1: 'Open', C1: 'Closed', D1: 'Grand Total',
    A2: 'East', B2: '2', C2: '1', D2: '3',
    A3: 'North', B3: '0', C3: '1', D3: '1',
    A4: 'South', B4: '1', C4: '0', D4: '1',
    A5: 'Grand Total', B5: '3', C5: '2', D5: '5',
  };
  await expectCells(page, result);
  await reload(page);
  await tab(page, 'Pivot1').click();
  await expectCells(page, result);
});

test('REQ-5-3-1 S4: AVERAGE 忽略非数值记录并保持源数据不变', async ({ page }) => {
  await openNewWorkbook(page);
  const source = {
    A1: 'Region', B1: 'Sales',
    A2: 'East', B2: '100',
    A3: 'West', B3: '300',
    A4: 'East', B4: 'pending',
    A5: 'East', B5: '200',
  };
  await enterAll(page, Object.entries(source));
  await createPivot(page, 'A1', 'B5');
  await applyPivot(page, { rows: 'Region', values: 'Sales', summarize: 'AVERAGE' });

  await expectCells(page, {
    A1: 'Region', B1: 'AVERAGE of Sales',
    A2: 'East', B2: '150',
    A3: 'West', B3: '300',
    A4: 'Grand Total', B4: '200',
  });
  await tab(page, 'Sheet1').click();
  await expectCells(page, source);
});

test('REQ-5-3-1 S5: 无效数值聚合显示错误并保留上一次成功结果', async ({ page }) => {
  await openNewWorkbook(page);
  const source = {
    A1: 'Region', B1: 'Sales', C1: 'Owner',
    A2: 'East', B2: '100', C2: 'Ann',
    A3: 'West', B3: '200', C3: 'Ben',
    A4: 'East', B4: '300', C4: 'Cal',
  };
  await enterAll(page, Object.entries(source));
  await createPivot(page, 'A1', 'C4');
  await applyPivot(page, { rows: 'Region', values: 'Sales', summarize: 'SUM' });
  const lastGood = { A1: 'Region', B1: 'SUM of Sales', A2: 'East', B2: '400', A3: 'West', B3: '200', A4: 'Grand Total', B4: '600' };
  await expectCells(page, lastGood);

  await applyPivot(page, { rows: 'Region', values: 'Owner', summarize: 'SUM' });
  await expect(page.getByText('Value field requires numeric values')).toBeVisible();
  await expectCells(page, lastGood);

  await tab(page, 'Sheet1').click();
  await expectCells(page, source);
});

test('REQ-5-3-1 S6: 刷新透视表时汇总被筛选隐藏的源记录', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [
    ['A1', 'Region'], ['B1', 'Sales'],
    ['A2', 'East'], ['B2', '100'],
    ['A3', 'West'], ['B3', '200'],
    ['A4', 'East'], ['B4', '300'],
    ['A5', 'North'], ['B5', '400'],
  ]);
  await createPivot(page, 'A1', 'B5');
  await applyPivot(page, { rows: 'Region', values: 'Sales', summarize: 'SUM' });
  await expectCells(page, { A2: 'East', B2: '400', A3: 'West', B3: '200', A4: 'North', B4: '400', A5: 'Grand Total', B5: '1000' });

  await tab(page, 'Sheet1').click();
  await createFilter(page, 'A1', 'B5');
  await filterValues(page, 'Region', ['East']);
  await expectHiddenRows(page, ['A3', 'A5']);
  await enter(page, 'B2', '150');
  await expectCells(page, { B2: '150' });

  await tab(page, 'Pivot1').click();
  await button(page, 'Refresh pivot table').click();
  await expectCells(page, {
    A1: 'Region', B1: 'SUM of Sales',
    A2: 'East', B2: '450',
    A3: 'West', B3: '200',
    A4: 'North', B4: '400',
    A5: 'Grand Total', B5: '1050',
  });
});

test('REQ-5-3-1 S7: 源区域插入行列后刷新会使用调整后的完整范围', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [
    ['A1', 'Region'], ['B1', 'Sales'],
    ['A2', 'East'], ['B2', '100'],
    ['A3', 'North'], ['B3', '200'],
    ['A4', 'East'], ['B4', '300'],
  ]);
  await createPivot(page, 'A1', 'B4');
  await applyPivot(page, { rows: 'Region', values: 'Sales', summarize: 'SUM' });
  await expectCells(page, { A2: 'East', B2: '400', A3: 'North', B3: '200', A4: 'Grand Total', B4: '600' });
  const refreshed = { A1: 'Region', B1: 'SUM of Sales', A2: 'East', B2: '450', A3: 'North', B3: '200', A4: 'Grand Total', B4: '650' };

  await tab(page, 'Sheet1').click();
  await page.getByRole('rowheader', { name: '3', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 row above', exact: true }).click();
  await enterAll(page, [['A3', 'East'], ['B3', '50']]);
  await expectCells(page, { A4: 'North', B4: '200', A5: 'East', B5: '300' });
  await tab(page, 'Pivot1').click();
  await button(page, 'Refresh pivot table').click();
  await expectCells(page, refreshed);

  await tab(page, 'Sheet1').click();
  await page.getByRole('columnheader', { name: 'B', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 column left', exact: true }).click();
  await expectCells(page, { A1: 'Region', B1: '', C1: 'Sales', A3: 'East', C3: '50' });
  await tab(page, 'Pivot1').click();
  await button(page, 'Refresh pivot table').click();
  await expectCells(page, refreshed);

  await reload(page);
  await tab(page, 'Pivot1').click();
  await expectCells(page, refreshed);
});

test('REQ-5-3-1 S8: 删除已选源字段后刷新显示错误并保留上次结果', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [
    ['A1', 'Region'], ['B1', 'Sales'],
    ['A2', 'East'], ['B2', '100'],
    ['A3', 'North'], ['B3', '200'],
    ['A4', 'East'], ['B4', '300'],
  ]);
  await createPivot(page, 'A1', 'B4');
  await applyPivot(page, { rows: 'Region', values: 'Sales', summarize: 'SUM' });
  const lastGood = { A1: 'Region', B1: 'SUM of Sales', A2: 'East', B2: '400', A3: 'North', B3: '200', A4: 'Grand Total', B4: '600' };
  await expectCells(page, lastGood);

  await tab(page, 'Sheet1').click();
  await page.getByRole('columnheader', { name: 'B', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete column', exact: true }).click();
  await expectCells(page, { A1: 'Region', A2: 'East', A3: 'North', A4: 'East', B1: '', B2: '' });

  await tab(page, 'Pivot1').click();
  await button(page, 'Refresh pivot table').click();
  await expect(page.getByText('Pivot field is no longer available. Select a new field.')).toBeVisible();
  await expectCells(page, lastGood);

  await tab(page, 'Sheet1').click();
  await expectCells(page, { A1: 'Region', A2: 'East', A3: 'North', A4: 'East' });
  await reload(page);
  await tab(page, 'Pivot1').click();
  await expectCells(page, lastGood);
});

test('REQ-5-3-1 S9: 按状态字段生成 COUNT 透视表并在刷新后保持', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [
    ['A1', 'Region'], ['B1', 'Sales'], ['C1', 'Status'],
    ['A2', 'East'], ['B2', '1200'], ['C2', 'Open'],
    ['A3', 'North'], ['B3', '800'], ['C3', 'Closed'],
    ['A4', 'South'], ['B4', '700'], ['C4', 'Open'],
  ]);
  await createPivot(page, 'A1', 'C4');
  await applyPivot(page, { rows: 'Status', values: 'Sales', summarize: 'COUNT' });

  const result = {
    A1: 'Status', B1: 'COUNT of Sales',
    A2: 'Open', B2: '2',
    A3: 'Closed', B3: '1',
    A4: 'Grand Total', B4: '3',
  };
  await expectCells(page, result);
  await reload(page);
  await tab(page, 'Pivot1').click();
  await expectCells(page, result);
});
