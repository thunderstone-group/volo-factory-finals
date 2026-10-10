// REQ-4-2-1 Recalculate Dependent Formulas After Source Data Changes

test('REQ-4-2-1 S1: 源值变化后按顺序重算多级依赖，且不影响其他工作表', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [['A1', '10'], ['B1', '=A1*2'], ['C1', '=B1+5']]);
  await expectCells(page, { B1: '20', C1: '25' });

  await button(page, 'Add worksheet').click();
  await expect(tab(page, 'Sheet2')).toHaveAttribute('aria-selected', 'true');
  await enterAll(page, [['A1', 'Other'], ['B1', '=1+1']]);
  await expectCells(page, { A1: 'Other', B1: '2' });

  await tab(page, 'Sheet1').click();
  await expectCells(page, { A1: '10', B1: '20', C1: '25' });
  await enter(page, 'A1', '20');
  await expectCells(page, { A1: '20', B1: '40', C1: '45' });

  await tab(page, 'Sheet2').click();
  await expectCells(page, { A1: 'Other', B1: '2' });
  await expectFormula(page, 'B1', '=1+1');

  await reload(page);
  await tab(page, 'Sheet1').click();
  await expectCells(page, { A1: '20', B1: '40', C1: '45' });
});

test('REQ-4-2-1 S2: 批量粘贴源值后重算直接和间接依赖', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [['A1', '1'], ['A2', '2'], ['B1', '=A1+A2'], ['C1', '=B1*10']]);
  await expectCells(page, { B1: '3', C1: '30' });

  await cell(page, 'A1').click();
  await pasteText(page, '5\n6');

  const after = { A1: '5', A2: '6', B1: '11', C1: '110' };
  await expectCells(page, after);
  await expectFormula(page, 'B1', '=A1+A2');
  await reload(page);
  await expectCells(page, after);
});

test('REQ-4-2-1 S3: 移动值覆盖公式源单元格后重算直接和间接依赖', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [['A1', '2'], ['B1', '3'], ['C1', '=B1*2'], ['D1', '=C1+1']]);
  await expectCells(page, { C1: '6', D1: '7' });

  await cell(page, 'A1').click();
  await ctrl(page, 'x');
  await cell(page, 'B1').click();
  await ctrl(page, 'v');

  const after = { A1: '', B1: '2', C1: '4', D1: '5' };
  await expectCells(page, after);
  await expectFormula(page, 'C1', '=B1*2');
  await expectFormula(page, 'D1', '=C1+1');

  await reload(page);
  await expectCells(page, after);
  await expectFormula(page, 'C1', '=B1*2');
  await expectFormula(page, 'D1', '=C1+1');
});
