// REQ-4-2-2 Display and Fix Formula Errors

test('REQ-4-2-2 S1: 显示并持久化五类公式错误，且不阻断无关单元格编辑', async ({ page }) => {
  await openNewWorkbook(page);
  await enter(page, 'A1', 'Keep');
  const formulas = { B1: '=1/0', B2: '=A0', B3: '=UNSUPPORTED(1)', B4: '=1+', B5: '=B5' };
  const errors = { B1: '#DIV/0!', B2: '#REF!', B3: '#NAME?', B4: '#ERROR!', B5: '#REF!' };
  for (const [ref, formula] of Object.entries(formulas)) await enterInGrid(page, ref, formula);
  await expectCells(page, errors);

  await enter(page, 'A1', 'Edited');
  await expectCells(page, { A1: 'Edited' });

  await reload(page);
  await expectCells(page, { ...errors, A1: 'Edited' });
  for (const [ref, formula] of Object.entries(formulas)) await expectFormula(page, ref, formula);
});

test('REQ-4-2-2 S2: 用有效公式修复除零错误，并持久化新公式和结果', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [['A1', '2'], ['B1', '=1/0']]);
  await expectCells(page, { B1: '#DIV/0!' });

  await enter(page, 'B1', '=A1*3');
  await expectCells(page, { B1: '6' });
  await expectFormula(page, 'B1', '=A1*3');

  await reload(page);
  await expectCells(page, { B1: '6' });
  await expectFormula(page, 'B1', '=A1*3');
});

test('REQ-4-2-2 S3: 间接循环引用中的所有公式显示并持久化引用错误', async ({ page }) => {
  await openNewWorkbook(page);
  const formulas = { A1: '=B1', B1: '=C1', C1: '=A1' };
  await enterAll(page, Object.entries(formulas));
  const errors = { A1: '#REF!', B1: '#REF!', C1: '#REF!' };
  await expectCells(page, errors);

  await reload(page);
  await expectCells(page, errors);
  for (const [ref, formula] of Object.entries(formulas)) await expectFormula(page, ref, formula);
});

test('REQ-4-2-2 S4: 未知函数和不完整表达式都显示错误并保留公式原文', async ({ page }) => {
  await openNewWorkbook(page);
  const formulas = { A1: '=NOPE(2)', A2: '=(1+2', A3: '=3*' };
  await enterAll(page, Object.entries(formulas));
  await expectCells(page, { A1: '#NAME?', A2: '#ERROR!', A3: '#ERROR!' });
  for (const [ref, formula] of Object.entries(formulas)) await expectFormula(page, ref, formula);
});

test('REQ-4-2-2 S5: 自引用错误可被有效公式覆盖并保持新结果', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [['A1', '4'], ['B1', '=B1']]);
  await expectCells(page, { B1: '#REF!' });

  await enter(page, 'B1', '=A1*5');
  await expectCells(page, { B1: '20' });
  await expectFormula(page, 'B1', '=A1*5');

  await reload(page);
  await expectCells(page, { B1: '20' });
  await expectFormula(page, 'B1', '=A1*5');
});
