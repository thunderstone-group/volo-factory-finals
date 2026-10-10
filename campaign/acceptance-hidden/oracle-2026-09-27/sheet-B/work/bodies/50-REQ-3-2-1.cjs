// REQ-3-2-1 Copy, Cut, and Paste Cell Ranges

test('REQ-3-2-1 S1: 复制 A1:B2 到 D1:E2，并调整相对引用、保留绝对引用', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [['A1', '1'], ['B1', '2'], ['A2', '3'], ['B2', '=A1+$B$1'], ['G1', 'Keep']]);
  await expectCells(page, { B2: '3' });

  await dragSelect(page, 'A1', 'B2');
  await ctrl(page, 'c');
  await cell(page, 'D1').click();
  await ctrl(page, 'v');

  const afterCopy = { D1: '1', E1: '2', D2: '3', E2: '3', A1: '1', B1: '2', A2: '3', B2: '3', G1: 'Keep' };
  await expectCells(page, afterCopy);
  await expectFormula(page, 'E2', '=D1+$B$1');
  await expectFormula(page, 'B2', '=A1+$B$1');

  await reload(page);
  await expectCells(page, afterCopy);
  await expectFormula(page, 'E2', '=D1+$B$1');
});

test('REQ-3-2-1 S2: 剪切 A1:B2 到 D1:E2，目标完整写入后清空源区域', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [['A1', 'A'], ['B1', 'B'], ['A2', 'C'], ['B2', 'D'], ['G1', 'Keep']]);

  await dragSelect(page, 'A1', 'B2');
  await ctrl(page, 'x');
  // Cutting alone does not clear the source; it is cleared only once the target is written.
  await expectCells(page, { A1: 'A', B1: 'B', A2: 'C', B2: 'D' });
  await cell(page, 'D1').click();
  await ctrl(page, 'v');

  const moved = { D1: 'A', E1: 'B', D2: 'C', E2: 'D', A1: '', B1: '', A2: '', B2: '', G1: 'Keep' };
  await expectCells(page, moved);
  await reload(page);
  await expectCells(page, moved);
});

test('REQ-3-2-1 S3: 剪切目标违反校验时保留完整源区域和原目标值', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [
    ['A1', 'Item'], ['B1', 'Qty'], ['A2', 'Pen'], ['B2', '4'],
    ['D1', '10'], ['E1', '20'], ['D2', '30'], ['E2', '40'],
  ]);
  await dragSelect(page, 'D1', 'E2');
  await saveValidation(page, 'Number range', { Minimum: '0', Maximum: '100' });

  await dragSelect(page, 'A1', 'B2');
  await ctrl(page, 'x');
  await cell(page, 'D1').click();
  await ctrl(page, 'v');

  await expect(page.getByText('Please enter a number from 0 to 100')).toBeVisible();
  const unchanged = { A1: 'Item', B1: 'Qty', A2: 'Pen', B2: '4', D1: '10', E1: '20', D2: '30', E2: '40' };
  await expectCells(page, unchanged);
  await reload(page);
  await expectCells(page, unchanged);
});

test('REQ-3-2-1 S4: 复制单个单元格到新位置并保留源值', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [['A2', 'Pen'], ['B2', '4']]);

  await cell(page, 'A2').click();
  await ctrl(page, 'c');
  await cell(page, 'D4').click();
  await ctrl(page, 'v');

  const afterCopy = { D4: 'Pen', A2: 'Pen', B2: '4', E4: '', D5: '' };
  await expectCells(page, afterCopy);
  await reload(page);
  await expectCells(page, afterCopy);
});
