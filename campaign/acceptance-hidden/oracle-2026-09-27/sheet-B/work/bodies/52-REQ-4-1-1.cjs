// REQ-4-1-1 Calculate Basic Expressions and Aggregate Functions

test('REQ-4-1-1 S1: 计算带括号的引用表达式，并持久化原公式和结果', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [['A1', '3'], ['B1', '4']]);
  await enter(page, 'C1', '=(A1+B1)*2');
  await expectCells(page, { C1: '14' });
  await expectFormula(page, 'C1', '=(A1+B1)*2');

  await reload(page);
  await expectCells(page, { A1: '3', B1: '4', C1: '14' });
  await expectFormula(page, 'C1', '=(A1+B1)*2');
});

test('REQ-4-1-1 S2: 聚合函数忽略空单元格且函数名不区分大小写', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [['B2', '2'], ['B4', '4'], ['B6', '6']]);
  const formulas = {
    D2: '=sum(B2:B10)',
    D3: '=AVERAGE(B2:B10)',
    D4: '=COUNT(B2:B10)',
    D5: '=MIN(B2:B10)',
    D6: '=MAX(B2:B10)',
  };
  for (const [ref, formula] of Object.entries(formulas)) await enterInGrid(page, ref, formula);
  await expectCells(page, { D2: '12', D3: '4', D4: '3', D5: '2', D6: '6' });
});

test('REQ-4-1-1 S3: 计算数字常量、减法和除法并遵循运算优先级', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [['A1', '=10-6/2'], ['A2', '=9-3-2'], ['A3', '=20/4/5'], ['A4', '=7.5-2.5/5']]);
  await expectCells(page, { A1: '7', A2: '4', A3: '1', A4: '7' });
  await expectFormula(page, 'A1', '=10-6/2');
  await expectFormula(page, 'A4', '=7.5-2.5/5');
});

test('REQ-4-1-1 S4: 计算带括号的混合算术表达式并保持结果', async ({ page }) => {
  await openNewWorkbook(page);
  await enter(page, 'A1', '=(2+3)*4-10/(1+1)');
  await expectCells(page, { A1: '15' });
  await expectFormula(page, 'A1', '=(2+3)*4-10/(1+1)');

  await reload(page);
  await expectCells(page, { A1: '15' });
  await expectFormula(page, 'A1', '=(2+3)*4-10/(1+1)');
});

test('REQ-4-1-1 S5: 计算多个依赖单元格并在刷新后继续显示结果', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [['A1', '2'], ['B1', '3'], ['C1', '=A1+B1'], ['D1', '=C1*2']]);
  await expectCells(page, { C1: '5', D1: '10' });

  await reload(page);
  await expectCells(page, { A1: '2', B1: '3', C1: '5', D1: '10' });
  await expectFormula(page, 'C1', '=A1+B1');
  await expectFormula(page, 'D1', '=C1*2');
});
