// REQ-5-2-1 Set Dropdown or Numeric Validation for a Range

test('REQ-5-2-1 S1: 为 A1:A2 创建下拉规则，选择值并持久化独立入口', async ({ page }) => {
  await openNewWorkbook(page);
  await dragSelect(page, 'A1', 'A2');
  await saveValidation(page, 'Dropdown', { 'Allowed values': 'Not Started, In Progress, Completed' });

  await dropdownButton(page, 'A1').click();
  await expect(page.getByRole('option', { name: 'Not Started', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Completed', exact: true })).toBeVisible();
  await page.getByRole('option', { name: 'In Progress', exact: true }).click();
  await expectDropdownValue(page, 'A1', 'In Progress');
  await expect(dropdownButton(page, 'A2')).toBeVisible();

  await reload(page);
  await expectDropdownValue(page, 'A1', 'In Progress');
  await expect(dropdownButton(page, 'A1')).toBeVisible();
  await expect(dropdownButton(page, 'A2')).toBeVisible();
});

test('REQ-5-2-1 S2: 数值范围拒绝越界输入并在刷新后继续接受包含边界', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [['B2', '50'], ['B3', '60'], ['B4', '70']]);
  await dragSelect(page, 'B2', 'B4');
  await saveValidation(page, 'Number range', { Minimum: '0', Maximum: '100' });

  await enter(page, 'B3', '101');
  await expect(page.getByText('Please enter a number from 0 to 100')).toBeVisible();
  await expectCells(page, { B3: '60' });

  await reload(page);
  await enter(page, 'B3', '101');
  await expect(page.getByText('Please enter a number from 0 to 100')).toBeVisible();
  await expectCells(page, { B3: '60' });

  await enter(page, 'B3', '100');
  await enter(page, 'B2', '0');
  await expectCells(page, { B2: '0', B3: '100', B4: '70' });
});

test('REQ-5-2-1 S3: 网格内编辑违反数值规则时保留原值', async ({ page }) => {
  await openNewWorkbook(page);
  await enter(page, 'A1', '5');
  await cell(page, 'A1').click();
  await saveValidation(page, 'Number range', { Minimum: '1', Maximum: '10' });

  await cell(page, 'A1').dblclick();
  const editor = page.getByRole('textbox', { name: 'Edit A1', exact: true });
  await editor.fill('11');
  await editor.press('Enter');

  await expect(page.getByText('Please enter a number between 1 and 10')).toBeVisible();
  await expectCells(page, { A1: '5' });
  await expect(formulaBar(page)).toHaveValue('5');

  await reload(page);
  await expectCells(page, { A1: '5' });
});

test('REQ-5-2-1 S4: 修改和删除校验规则不会自动改写现有单元格值', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [['B2', '50'], ['B3', '80']]);
  await dragSelect(page, 'B2', 'B3');
  await saveValidation(page, 'Number range', { Minimum: '0', Maximum: '100' });

  // Reopen the rule: prefilled parameters and a "Delete rule" button; tighten the maximum.
  await dragSelect(page, 'B2', 'B3');
  await dataMenu(page, 'Data validation');
  let dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await expect(dialog.getByRole('textbox', { name: 'Minimum', exact: true })).toHaveValue('0');
  await expect(dialog.getByRole('textbox', { name: 'Maximum', exact: true })).toHaveValue('100');
  await expect(button(dialog, 'Delete rule')).toBeVisible();
  await dialog.getByRole('textbox', { name: 'Maximum', exact: true }).fill('60');
  await button(dialog, 'Save').click();
  await expect(dialog).toBeHidden();
  await expectCells(page, { B2: '50', B3: '80' });

  await enter(page, 'B2', '70');
  await expect(page.getByText('Please enter a number between 0 and 60')).toBeVisible();
  await expectCells(page, { B2: '50' });

  // Delete the rule: values stay, constraint is gone.
  await dragSelect(page, 'B2', 'B3');
  await dataMenu(page, 'Data validation');
  dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await button(dialog, 'Delete rule').click();
  await expect(dialog).toBeHidden();
  await expectCells(page, { B2: '50', B3: '80' });

  await enter(page, 'B2', '70');
  await expectCells(page, { B2: '70', B3: '80' });
  await reload(page);
  await expectCells(page, { B2: '70', B3: '80' });
});

test('REQ-5-2-1 S5: 下拉规则拒绝未允许的值并在刷新后继续生效', async ({ page }) => {
  await openNewWorkbook(page);
  await enter(page, 'A1', 'Open');
  await cell(page, 'A1').click();
  await saveValidation(page, 'Dropdown', { 'Allowed values': 'Open, Closed' });

  await enter(page, 'A1', 'Pending');
  await expect(page.getByText('Please select one of the following values: Open, Closed')).toBeVisible();
  await expectDropdownValue(page, 'A1', 'Open');
  await expect(cell(page, 'A1')).not.toContainText('Pending');
  await expect(formulaBar(page)).toHaveValue('Open');

  await reload(page);
  await enter(page, 'A1', 'Pending');
  await expect(page.getByText('Please select one of the following values: Open, Closed')).toBeVisible();
  await expectDropdownValue(page, 'A1', 'Open');
  await expect(cell(page, 'A1')).not.toContainText('Pending');
});

test('REQ-5-2-1 S6: 下拉规则可在多个单元格上选择不同允许值', async ({ page }) => {
  await openNewWorkbook(page);
  await dragSelect(page, 'A1', 'A3');
  await saveValidation(page, 'Dropdown', { 'Allowed values': 'Red, Green, Blue' });

  const picks = { A1: 'Red', A2: 'Green', A3: 'Blue' };
  for (const [ref, value] of Object.entries(picks)) {
    await dropdownButton(page, ref).click();
    await page.getByRole('option', { name: value, exact: true }).click();
    await expectDropdownValue(page, ref, value);
  }
  for (const [ref, value] of Object.entries(picks)) await expectDropdownValue(page, ref, value);

  await reload(page);
  for (const [ref, value] of Object.entries(picks)) await expectDropdownValue(page, ref, value);
});
