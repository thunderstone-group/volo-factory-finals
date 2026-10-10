// REQ-5-1-2 Filter Rows by Value or Condition

test('REQ-5-1-2 S1: 组合 Region 值与 Sales 数值条件，刷新后保持并可无损清除', async ({ page }) => {
  await openNewWorkbook(page);
  const source = {
    A1: 'Region', B1: 'Sales', C1: 'Status',
    A2: 'East', B2: '1200', C2: 'Open',
    A3: 'East', B3: '900', C3: 'Closed',
    A4: 'North', B4: '2000', C4: 'Open',
    A5: 'East', B5: '1500', C5: 'Closed',
    A6: 'South', B6: '700', C6: 'Open',
  };
  await enterAll(page, Object.entries(source));

  await createFilter(page, 'A1', 'C6');
  await filterValues(page, 'Region', ['East']);
  await filterCondition(page, 'Sales', 'Greater than', '1000');

  const filtered = async () => {
    await expect(cell(page, 'A1')).toContainText('Region');
    await expectCells(page, { A2: 'East', B2: '1200', A5: 'East', B5: '1500' });
    await expectHiddenRows(page, ['A3', 'A4', 'A6']);
  };
  await filtered();
  await reload(page);
  await filtered();

  await dataMenu(page, 'Clear filter');
  const { A1, B1, C1, ...records } = source;
  await expectCells(page, records);
});

test('REQ-5-1-2 S2: 组合文本包含、日期比较和为空条件，并支持非空条件', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [
    ['A1', 'Name'], ['B1', 'Date'], ['C1', 'Note'],
    ['A2', 'Alpha One'], ['B2', '2024-01-10'],
    ['A3', 'Beta Two'], ['B3', '2024-01-05'],
    ['A4', 'Alpha Three'], ['B4', '2023-12-01'], ['C4', 'Done'],
    ['A5', 'Alpha Four'], ['B5', '2024-03-01'],
    ['A6', 'Gamma Five'], ['B6', '2023-11-11'], ['C6', 'Done'],
  ]);
  await createFilter(page, 'A1', 'C6');

  await filterCondition(page, 'Name', 'Text contains', 'Alpha');
  await expectHiddenRows(page, ['A3', 'A6']);
  await filterCondition(page, 'Date', 'Before', '2024-02-01');
  await expectHiddenRows(page, ['A3', 'A5', 'A6']);
  await filterCondition(page, 'Note', 'Is empty');
  await expectCells(page, { A2: 'Alpha One', B2: '2024-01-10' });
  await expectHiddenRows(page, ['A3', 'A4', 'A5', 'A6']);

  await filterCondition(page, 'Note', 'Is not empty');
  await expectCells(page, { A4: 'Alpha Three', B4: '2023-12-01', C4: 'Done' });
  await expectHiddenRows(page, ['A2', 'A3', 'A5', 'A6']);
});

test('REQ-5-1-2 S3: CSV 导出包含被筛选隐藏的已保存行', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [
    ['A1', 'Region'], ['B1', 'Sales'],
    ['A2', 'East'], ['B2', '100'],
    ['A3', 'West'], ['B3', '200'],
    ['A4', 'North'], ['B4', '300'],
  ]);
  await createFilter(page, 'A1', 'B4');
  await filterCondition(page, 'Sales', 'Greater than', '150');
  await expectHiddenRows(page, ['A2']);

  const [download] = await Promise.all([page.waitForEvent('download'), button(page, 'Export CSV').click()]);
  expect(download.suggestedFilename().endsWith('.csv')).toBe(true);
  const csv = fs.readFileSync(await download.path(), 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '');
  expect(csv).toBe('Region,Sales\nEast,100\nWest,200\nNorth,300');

  // Export does not change the filter view.
  await expectCells(page, { A3: 'West', B3: '200', A4: 'North', B4: '300' });
  await expectHiddenRows(page, ['A2']);
});

test('REQ-5-1-2 S4: 清除筛选后再次应用不同条件仍保留已保存行', async ({ page }) => {
  await openNewWorkbook(page);
  const records = { A2: 'Pen', B2: '4', A3: 'Book', B3: '12', A4: 'Lamp', B4: '7', A5: 'Desk', B5: '20' };
  await enterAll(page, [['A1', 'Item'], ['B1', 'Qty'], ...Object.entries(records)]);

  await createFilter(page, 'A1', 'B5');
  await filterCondition(page, 'Qty', 'Greater than', '10');
  await expectCells(page, { A3: 'Book', A5: 'Desk' });
  await expectHiddenRows(page, ['A2', 'A4']);

  await dataMenu(page, 'Clear filter');
  await expectCells(page, records);

  await createFilter(page, 'A1', 'B5');
  await filterCondition(page, 'Item', 'Text contains', 'e');
  await expectCells(page, { A2: 'Pen', B2: '4', A5: 'Desk', B5: '20' });
  await expectHiddenRows(page, ['A3', 'A4']);

  await dataMenu(page, 'Clear filter');
  await expectCells(page, records);
});

test('REQ-5-1-2 S5: 筛选到空结果后刷新仍保持空结果状态', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [
    ['A1', 'Name'], ['B1', 'Score'],
    ['A2', 'Ann'], ['B2', '10'],
    ['A3', 'Ben'], ['B3', '20'],
    ['A4', 'Cal'], ['B4', '30'],
  ]);
  await createFilter(page, 'A1', 'B4');
  await filterCondition(page, 'Score', 'Greater than', '100');

  const empty = async () => {
    await expect(button(page, 'Filter Score')).toBeVisible();
    await expect(cell(page, 'A1')).toContainText('Name');
    await expectHiddenRows(page, ['A2', 'A3', 'A4']);
  };
  await empty();
  await reload(page);
  await empty();
});
