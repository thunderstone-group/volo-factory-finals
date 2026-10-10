const { test, expect } = require('@playwright/test');

function unique() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function grid(page) {
  return page.getByRole('grid', { name: 'Worksheet grid', exact: true });
}

function cell(page, coord) {
  return grid(page).getByRole('gridcell', { name: coord, exact: true });
}

async function createBlankWorkbook(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(grid(page)).toBeVisible();
}

async function selectCell(page, coord) {
  await cell(page, coord).click();
}

async function enterValue(page, coord, value) {
  await selectCell(page, coord);
  const formulaBar = page.getByLabel('Formula bar', { exact: true });
  await formulaBar.fill(String(value));
  await formulaBar.press('Enter');
}

async function enterValueInline(page, coord, value) {
  await cell(page, coord).dblclick();
  const editor = page.getByLabel(`Edit ${coord}`, { exact: true });
  await editor.fill(String(value));
  await editor.press('Enter');
}

async function chooseComboboxOption(page, scope, comboLabel, optionName) {
  const combo = scope.getByRole('combobox', { name: comboLabel, exact: true });
  const tagName = await combo.evaluate((el) => el.tagName);
  if (tagName === 'SELECT') {
    await combo.selectOption({ label: optionName });
  } else {
    await combo.click();
    await page.getByRole('option', { name: optionName, exact: true }).click();
  }
}

async function addDropdownRuleAtA1(page) {
  await selectCell(page, 'A1');
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Data validation', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await chooseComboboxOption(page, dialog, 'Rule type', 'Dropdown');
  await dialog.getByLabel('Allowed values', { exact: true }).fill('Keep, Other');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open dropdown for A1', exact: true })).toBeVisible();
}

async function insertRowAbove(page, rowNumber) {
  await page.getByRole('rowheader', { name: String(rowNumber), exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 row above', exact: true }).click();
}

async function insertColumnLeft(page, colLetter) {
  await page.getByRole('columnheader', { name: colLetter, exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 column left', exact: true }).click();
}

async function expectKeepAt(page, coord) {
  await expect(cell(page, coord)).toContainText('Keep');
  await expect(page.getByRole('button', { name: `Open dropdown for ${coord}`, exact: true })).toBeVisible();
}

async function expectNoKeepAt(page, coord) {
  await expect(page.getByRole('button', { name: `Open dropdown for ${coord}`, exact: true })).toHaveCount(0);
  const target = cell(page, coord);
  if ((await target.count()) > 0) {
    await expect(target).not.toContainText('Keep');
  }
}

test('REQ-3-2-2: Undo and redo one modification', async ({ page }) => {
  const value = 'value-' + unique();

  await createBlankWorkbook(page);
  await enterValue(page, 'A1', value);
  await expect(cell(page, 'A1')).toHaveText(value);

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(cell(page, 'A1')).toHaveText('');

  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(cell(page, 'A1')).toHaveText(value);

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText(value);
});

test('REQ-3-2-2#2: A new modification clears the redo branch', async ({ page }) => {
  const oldValue = 'old-' + unique();
  const newValue = 'new-' + unique();

  await createBlankWorkbook(page);
  await enterValue(page, 'A1', oldValue);
  await expect(cell(page, 'A1')).toHaveText(oldValue);

  const redoButton = page.getByRole('button', { name: 'Redo', exact: true });
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(cell(page, 'A1')).toHaveText('');
  await expect(redoButton).toBeEnabled();

  await enterValueInline(page, 'A1', newValue);
  await expect(cell(page, 'A1')).toHaveText(newValue);
  await cell(page, 'A1').click();
  await expect(redoButton).toBeDisabled();
  await page.keyboard.press('Control+y');
  await expect(cell(page, 'A1')).toHaveText(newValue);

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText(newValue);
});

test('REQ-3-2-2#3: Undo and redo a source-value edit with dependent formulas', async ({ page }) => {
  await createBlankWorkbook(page);
  await enterValue(page, 'A1', 2);
  await enterValue(page, 'B1', '=A1*2');
  await expect(cell(page, 'B1')).toHaveText('4');

  await enterValue(page, 'A1', 3);
  await expect(cell(page, 'A1')).toHaveText('3');
  await expect(cell(page, 'B1')).toHaveText('6');

  await cell(page, 'A1').click();
  await page.keyboard.press('Control+z');
  await expect(cell(page, 'A1')).toHaveText('2');
  await expect(cell(page, 'B1')).toHaveText('4');

  await selectCell(page, 'B1');
  const formulaBar = page.getByLabel('Formula bar', { exact: true });
  await expect(formulaBar).toHaveValue('=A1*2');

  await cell(page, 'A1').click();
  await page.keyboard.press('Control+y');
  await expect(cell(page, 'A1')).toHaveText('3');
  await expect(cell(page, 'B1')).toHaveText('6');

  await selectCell(page, 'B1');
  await expect(formulaBar).toHaveValue('=A1*2');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('3');
  await expect(cell(page, 'B1')).toHaveText('6');
  await selectCell(page, 'B1');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A1*2');
});

test('REQ-3-2-2#4: Undo and redo row/column changes with validation', async ({ page }) => {
  await createBlankWorkbook(page);
  await enterValue(page, 'A1', 'Keep');
  await addDropdownRuleAtA1(page);
  await expectKeepAt(page, 'A1');

  await insertRowAbove(page, 1);
  await insertColumnLeft(page, 'A');

  await expectKeepAt(page, 'B2');
  await expectNoKeepAt(page, 'A1');
  await expectNoKeepAt(page, 'A2');

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expectKeepAt(page, 'A2');
  await expectNoKeepAt(page, 'A1');
  await expectNoKeepAt(page, 'B2');

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expectKeepAt(page, 'A1');
  await expectNoKeepAt(page, 'A2');
  await expectNoKeepAt(page, 'B2');

  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expectKeepAt(page, 'A2');
  await expectNoKeepAt(page, 'A1');
  await expectNoKeepAt(page, 'B2');

  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expectKeepAt(page, 'B2');
  await expectNoKeepAt(page, 'A1');
  await expectNoKeepAt(page, 'A2');

  await page.reload();
  await expectKeepAt(page, 'B2');
  await expectNoKeepAt(page, 'A1');
  await expectNoKeepAt(page, 'A2');
});
