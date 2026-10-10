// REQ-3-2-2 Undo and Redo Recent Operations

test('REQ-3-2-2 S1: 撤销单元格修改后重做，并在刷新后保留重做结果', async ({ page }) => {
  const value = `Redo ${uid()}`;
  await openNewWorkbook(page);
  await enter(page, 'A1', value);
  await expectCells(page, { A1: value });

  await button(page, 'Undo').click();
  await expectCells(page, { A1: '' });
  await button(page, 'Redo').click();
  await expectCells(page, { A1: value });

  await reload(page);
  await expectCells(page, { A1: value });
});

test('REQ-3-2-2 S2: 撤销后提交新修改会清除原重做分支', async ({ page }) => {
  const id = uid();
  const oldValue = `Old branch ${id}`;
  const newValue = `New branch ${id}`;
  await openNewWorkbook(page);
  await enter(page, 'A1', oldValue);
  await expectCells(page, { A1: oldValue });
  await button(page, 'Undo').click();
  await expectCells(page, { A1: '' });
  await expect(button(page, 'Redo')).toBeEnabled();

  await enter(page, 'A1', newValue);
  await expectCells(page, { A1: newValue });
  await expect(button(page, 'Redo')).toBeDisabled();

  await cell(page, 'A1').click();
  await ctrl(page, 'y');
  await page.waitForTimeout(200); // let a (wrong) redo land before the negative check
  await expectCells(page, { A1: newValue });

  await reload(page);
  await expectCells(page, { A1: newValue });
});

test('REQ-3-2-2 S3: 撤销和重做源值编辑会同步恢复依赖公式结果', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [['A1', '2'], ['B1', '=A1*2']]);
  await expectCells(page, { B1: '4' });
  await enter(page, 'A1', '3');
  await expectCells(page, { A1: '3', B1: '6' });

  await button(page, 'Undo').click();
  await expectCells(page, { A1: '2', B1: '4' });
  await expectFormula(page, 'B1', '=A1*2');

  await button(page, 'Redo').click();
  await expectCells(page, { A1: '3', B1: '6' });

  await reload(page);
  await expectCells(page, { A1: '3', B1: '6' });
  await expectFormula(page, 'B1', '=A1*2');
});

test('REQ-3-2-2 S4: 撤销并重做批量粘贴会恢复整个矩形', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [['A1', 'Outside'], ['B2', 'Old']]);

  await cell(page, 'B2').click();
  await pasteText(page, 'P1\tP2\nP3\tP4');
  const pasted = { B2: 'P1', C2: 'P2', B3: 'P3', C3: 'P4', A1: 'Outside' };
  await expectCells(page, pasted);

  await button(page, 'Undo').click();
  await expectCells(page, { B2: 'Old', C2: '', B3: '', C3: '', A1: 'Outside' });

  await button(page, 'Redo').click();
  await expectCells(page, pasted);

  await reload(page);
  await expectCells(page, pasted);
});

test('REQ-3-2-2 S5: 撤销并重做区域移动会同时恢复源区域和目标区域', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [['A1', 'M1'], ['B1', 'M2'], ['A2', 'M3'], ['B2', 'M4'], ['D1', 'Target']]);
  const original = { A1: 'M1', B1: 'M2', A2: 'M3', B2: 'M4', D1: 'Target', E1: '', D2: '', E2: '' };
  const moved = { A1: '', B1: '', A2: '', B2: '', D1: 'M1', E1: 'M2', D2: 'M3', E2: 'M4' };

  await dragSelect(page, 'A1', 'B2');
  await ctrl(page, 'x');
  await cell(page, 'D1').click();
  await ctrl(page, 'v');
  await expectCells(page, moved);

  await button(page, 'Undo').click();
  await expectCells(page, original);

  await button(page, 'Redo').click();
  await expectCells(page, moved);

  await reload(page);
  await expectCells(page, moved);
});

test('REQ-3-2-2 S6: 连续撤销和重做行列结构修改会恢复数据与校验入口', async ({ page }) => {
  await openNewWorkbook(page);
  await enter(page, 'A1', 'Keep');
  await cell(page, 'A1').click();
  await saveValidation(page, 'Dropdown', { 'Allowed values': 'Keep, Drop' });

  // The value and its dropdown entry point sit together in exactly one cell.
  const keepAt = async (ref, gone) => {
    await expectDropdownValue(page, ref, 'Keep');
    await expect(dropdownButton(page, ref)).toBeVisible();
    await expect(dropdownButton(page, gone)).toHaveCount(0);
    await expect(cell(page, gone)).toHaveText('');
  };
  await expect(dropdownButton(page, 'A1')).toBeVisible();

  await page.getByRole('rowheader', { name: '1', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 row above', exact: true }).click();
  await keepAt('A2', 'A1');
  await page.getByRole('columnheader', { name: 'A', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 column left', exact: true }).click();
  await keepAt('B2', 'A2');

  await button(page, 'Undo').click();
  await keepAt('A2', 'B2');
  await button(page, 'Undo').click();
  await keepAt('A1', 'A2');
  await button(page, 'Redo').click();
  await keepAt('A2', 'A1');
  await button(page, 'Redo').click();
  await keepAt('B2', 'A2');

  await reload(page);
  await keepAt('B2', 'A1');
});

test('REQ-3-2-2 S7: 在一个工作簿撤销不会修改另一个工作簿', async ({ page }) => {
  const id = uid();
  await openNewWorkbook(page);
  await enter(page, 'A1', `First ${id}`);
  await expectCells(page, { A1: `First ${id}` });
  const firstWorkbook = page.url();

  await openNewWorkbook(page);
  await enter(page, 'A1', `Second ${id}`);
  await expectCells(page, { A1: `Second ${id}` });
  await button(page, 'Undo').click();
  await expectCells(page, { A1: '' });

  // Reopen the first workbook at its own editor address.
  await page.goto(firstWorkbook);
  await expect(grid(page)).toBeVisible();
  await expectCells(page, { A1: `First ${id}` });
});
