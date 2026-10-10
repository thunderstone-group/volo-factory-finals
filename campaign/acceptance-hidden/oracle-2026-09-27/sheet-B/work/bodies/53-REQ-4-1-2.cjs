// REQ-4-1-2 Copy Formulas and Adjust Relative References

test('REQ-4-1-2 S1: 向下复制公式时调整相对引用并保留绝对引用', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [['A1', '1'], ['B1', '2'], ['A2', '10'], ['C1', '=A1+$B$1']]);
  await expectCells(page, { C1: '3' });

  await cell(page, 'C1').click();
  await ctrl(page, 'c');
  await cell(page, 'C2').click();
  await ctrl(page, 'v');

  await expectCells(page, { C1: '3', C2: '12' });
  await expectFormula(page, 'C2', '=A2+$B$1');
  await expectFormula(page, 'C1', '=A1+$B$1');

  await reload(page);
  await expectCells(page, { C1: '3', C2: '12' });
  await expectFormula(page, 'C1', '=A1+$B$1');
  await expectFormula(page, 'C2', '=A2+$B$1');
});

test('REQ-4-1-2 S2: 复制公式产生无效偏移引用时显示并持久化引用错误', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [['A1', '5'], ['B2', '=A1']]);
  await expectCells(page, { B2: '5' });

  // One row up: the relative reference A1 would become row 0, outside the worksheet.
  await cell(page, 'B2').click();
  await ctrl(page, 'c');
  await cell(page, 'B1').click();
  await ctrl(page, 'v');

  await expectCells(page, { B1: '#REF!', B2: '5' });
  await expectFormula(page, 'B1', '=#REF!');
  await expectFormula(page, 'B2', '=A1');

  await reload(page);
  await expectCells(page, { B1: '#REF!', B2: '5' });
  await expectFormula(page, 'B1', '=#REF!');
});
