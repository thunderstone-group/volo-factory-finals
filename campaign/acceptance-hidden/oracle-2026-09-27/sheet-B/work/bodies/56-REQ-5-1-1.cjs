// REQ-5-1-1 Sort a Data Range by a Specified Column

test('REQ-5-1-1 S1: 按 Sales 稳定降序排列完整记录，并保持范围外数据', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [
    ['A1', 'Region'], ['B1', 'Sales'], ['C1', 'Status'],
    ['A2', 'East'], ['B2', '1200'], ['C2', 'Open'],
    ['A3', 'North'], ['B3', '800'], ['C3', 'Closed'],
    ['A4', 'South'], ['B4', '1200'], ['C4', 'Pending'],
    ['A5', 'West'], ['B5', '500'], ['C5', 'Open'],
    ['E1', 'Outside'],
  ]);

  await sortRange(page, 'A1', 'C5', 'Sales', 'Descending');

  const sorted = {
    A1: 'Region', B1: 'Sales', C1: 'Status',
    A2: 'East', B2: '1200', C2: 'Open',
    A3: 'South', B3: '1200', C3: 'Pending',
    A4: 'North', B4: '800', C4: 'Closed',
    A5: 'West', B5: '500', C5: 'Open',
    E1: 'Outside',
  };
  await expectCells(page, sorted);
  await reload(page);
  await expectCells(page, sorted);
});

test('REQ-5-1-1 S2: 按文本升序和 ISO 日期降序排列完整记录', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [
    ['A1', 'Name'], ['B1', 'Joined'], ['C1', 'Score'],
    ['A2', 'Delta'], ['B2', '2024-02-10'], ['C2', '4'],
    ['A3', 'Alpha'], ['B3', '2023-11-05'], ['C3', '2'],
    ['A4', 'Charlie'], ['B4', '2024-07-01'], ['C4', '3'],
    ['A5', 'Bravo'], ['B5', '2022-12-31'], ['C5', '1'],
  ]);

  await sortRange(page, 'A1', 'C5', 'Name', 'Ascending');
  await expectCells(page, {
    A1: 'Name', B1: 'Joined', C1: 'Score',
    A2: 'Alpha', B2: '2023-11-05', C2: '2',
    A3: 'Bravo', B3: '2022-12-31', C3: '1',
    A4: 'Charlie', B4: '2024-07-01', C4: '3',
    A5: 'Delta', B5: '2024-02-10', C5: '4',
  });

  await sortRange(page, 'A1', 'C5', 'Joined', 'Descending');
  const byDate = {
    A1: 'Name', B1: 'Joined', C1: 'Score',
    A2: 'Charlie', B2: '2024-07-01', C2: '3',
    A3: 'Delta', B3: '2024-02-10', C3: '4',
    A4: 'Alpha', B4: '2023-11-05', C4: '2',
    A5: 'Bravo', B5: '2022-12-31', C5: '1',
  };
  await expectCells(page, byDate);
  await reload(page);
  await expectCells(page, byDate);
});

test('REQ-5-1-1 S3: 排序完整记录后公式与数值校验继续作用于对应列', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [
    ['A1', 'Item'], ['B1', 'Score'], ['C1', 'Double'],
    ['A2', 'Alpha'], ['B2', '3'], ['C2', '=B2*2'],
    ['A3', 'Bravo'], ['B3', '1'], ['C3', '=B3*2'],
    ['A4', 'Charlie'], ['B4', '2'], ['C4', '=B4*2'],
  ]);
  await dragSelect(page, 'B2', 'B4');
  await saveValidation(page, 'Number range', { Minimum: '0', Maximum: '10' });

  await sortRange(page, 'A1', 'C4', 'Score', 'Ascending');
  const sorted = {
    A2: 'Bravo', B2: '1', C2: '2',
    A3: 'Charlie', B3: '2', C3: '4',
    A4: 'Alpha', B4: '3', C4: '6',
  };
  await expectCells(page, sorted);
  await expectFormula(page, 'C2', '=B2*2');
  await expectFormula(page, 'C4', '=B4*2');

  await enter(page, 'B2', '11');
  await expect(page.getByText('Please enter a number between 0 and 10')).toBeVisible();
  await expectCells(page, { B2: '1', C2: '2' });

  await reload(page);
  await expectCells(page, sorted);
});

test('REQ-5-1-1 S4: 排序后已有筛选条件继续控制对应数据行', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [
    ['A1', 'Item'], ['B1', 'Score'],
    ['A2', 'Alpha'], ['B2', '3'],
    ['A3', 'Bravo'], ['B3', '1'],
    ['A4', 'Charlie'], ['B4', '2'],
  ]);
  await createFilter(page, 'A1', 'B4');
  await filterCondition(page, 'Score', 'Greater than', '1');
  await expectHiddenRows(page, ['A3']);
  await expectCells(page, { A2: 'Alpha', A4: 'Charlie' });

  await sortRange(page, 'A1', 'B4', 'Score', 'Ascending');

  // Hidden Bravo moves to row 2; visible Charlie and Alpha move to rows 3 and 4.
  const check = async () => {
    await expect(button(page, 'Filter Score')).toBeVisible();
    await expectHiddenRows(page, ['A2']);
    await expectCells(page, { A3: 'Charlie', B3: '2', A4: 'Alpha', B4: '3' });
  };
  await check();
  await reload(page);
  await check();
});

test('REQ-5-1-1 S5: 对重复数值排序时保持同值记录的相对顺序', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [
    ['A1', 'Name'], ['B1', 'Points'],
    ['A2', 'P1'], ['B2', '5'],
    ['A3', 'P2'], ['B3', '3'],
    ['A4', 'P3'], ['B4', '5'],
    ['A5', 'P4'], ['B5', '3'],
    ['A6', 'P5'], ['B6', '1'],
  ]);

  await sortRange(page, 'A1', 'B6', 'Points', 'Ascending');

  await expectCells(page, {
    A1: 'Name', B1: 'Points',
    A2: 'P5', B2: '1',
    A3: 'P2', B3: '3',
    A4: 'P4', B4: '3',
    A5: 'P1', B5: '5',
    A6: 'P3', B6: '5',
  });
});

test('REQ-5-1-1 S6: 按日期降序排序后保留表头和范围外单元格', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [
    ['A1', 'Event'], ['B1', 'Date'],
    ['A2', 'Review'], ['B2', '2024-01-15'],
    ['A3', 'Launch'], ['B3', '2024-05-01'],
    ['A4', 'Kickoff'], ['B4', '2023-12-20'],
    ['C2', 'Note'], ['A5', 'Tail'], ['D1', 'Outside'],
  ]);

  await sortRange(page, 'A1', 'B4', 'Date', 'Descending');

  await expectCells(page, {
    A1: 'Event', B1: 'Date',
    A2: 'Launch', B2: '2024-05-01',
    A3: 'Review', B3: '2024-01-15',
    A4: 'Kickoff', B4: '2023-12-20',
    C2: 'Note', A5: 'Tail', D1: 'Outside',
  });
});
