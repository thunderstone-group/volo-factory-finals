const { test, expect } = require('@playwright/test');
const f = require('./fixtures.cjs');

function u(prefix) {
  return `${prefix || 'v'}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function cell(page, coord) {
  return page.getByRole('gridcell', { name: coord, exact: true });
}

function formulaBar(page) {
  return page.getByLabel('Formula bar', { exact: true });
}

function dropdownButton(page, coord) {
  return page.getByRole('button', { name: `Open dropdown for ${coord}`, exact: true });
}

async function enterValues(page, values) {
  for (const [coord, value] of Object.entries(values)) {
    await f.enterCell(page, coord, value);
  }
}

async function assertDropdownAt(page, coord) {
  await cell(page, coord).click();
  await expect(cell(page, coord)).toContainText('Keep');
  await expect(dropdownButton(page, coord)).toBeVisible();
}

async function createDropdownRule(page, allowedValues) {
  await f.dataCommand(page, 'Data validation');
  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await f.chooseOption(dialog, 'Rule type', 'Dropdown');
  await dialog.getByLabel('Allowed values', { exact: true }).fill(allowedValues);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();
}

test('REQ-3-1-1: Edit a cell and preserve it after refresh', async ({ page }) => {
  await page.goto('/');
  await f.createWorkbook(page);
  await enterValues(page, { A1: '2', B1: '=A1*2' });
  await expect(cell(page, 'B1')).toHaveText('4');

  await cell(page, 'A1').click();
  const fb = formulaBar(page);
  await fb.click();
  await fb.fill('3');
  await fb.press('Enter');

  await expect(cell(page, 'A1')).toHaveText('3');
  await cell(page, 'A1').click();
  await expect(fb).toHaveValue('3');
  await cell(page, 'B1').click();
  await expect(fb).toHaveValue('=A1*2');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('3');
  await expect(cell(page, 'B1')).toHaveText('6');
  await cell(page, 'B1').click();
  await expect(fb).toHaveValue('=A1*2');
});

test('REQ-3-1-1#2: Cancel an uncommitted edit', async ({ page }) => {
  await page.goto('/');
  await f.createWorkbook(page);
  await f.enterCell(page, 'A1', 'Saved value');
  await expect(cell(page, 'A1')).toHaveText('Saved value');

  await cell(page, 'A1').dblclick();
  const editor = page.getByLabel('Edit A1', { exact: true });
  await editor.fill('Unsaved value');
  await editor.press('Escape');

  await expect(editor).toBeHidden();
  await expect(cell(page, 'A1')).toHaveText('Saved value');
  await cell(page, 'A1').click();
  await expect(formulaBar(page)).toHaveValue('Saved value');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('Saved value');
  await cell(page, 'A1').click();
  await expect(formulaBar(page)).toHaveValue('Saved value');
  await expect(page.getByText('Unsaved value')).toHaveCount(0);
});

test('REQ-3-1-2: Paste multi-row, multi-column data', async ({ page }) => {
  await page.goto('/');
  await f.createWorkbook(page);
  await enterValues(page, { A1: 'Outside', E4: 'Keep' });
  await f.setClipboardText(page, 'Alpha\t\t3\nBeta\tTwo\t4');

  await cell(page, 'B2').click();
  await f.pasteSelection(page);

  await expect(cell(page, 'B2')).toHaveText('Alpha');
  await expect(cell(page, 'C2')).toHaveText('');
  await expect(cell(page, 'D2')).toHaveText('3');
  await expect(cell(page, 'B3')).toHaveText('Beta');
  await expect(cell(page, 'C3')).toHaveText('Two');
  await expect(cell(page, 'D3')).toHaveText('4');
  await expect(cell(page, 'A1')).toHaveText('Outside');
  await expect(cell(page, 'E4')).toHaveText('Keep');

  await page.reload();
  await expect(cell(page, 'B2')).toHaveText('Alpha');
  await expect(cell(page, 'C2')).toHaveText('');
  await expect(cell(page, 'D2')).toHaveText('3');
  await expect(cell(page, 'B3')).toHaveText('Beta');
  await expect(cell(page, 'C3')).toHaveText('Two');
  await expect(cell(page, 'D3')).toHaveText('4');
  await expect(cell(page, 'A1')).toHaveText('Outside');
  await expect(cell(page, 'E4')).toHaveText('Keep');
});

test('REQ-3-1-3: Select an exact rectangular range', async ({ page }) => {
  await page.goto('/');
  await f.createWorkbook(page);
  await enterValues(page, {
    A1: 'R1C1', B1: 'R1C2',
    A2: 'R2C1', B2: 'R2C2',
    A3: 'R3C1', B3: 'R3C2',
    C1: 'Outside', A4: 'Outside'
  });

  await f.selectRange(page, 'A1', 'B3');

  for (const coord of ['A1', 'B1', 'A2', 'B2', 'A3', 'B3']) {
    await expect(cell(page, coord)).toHaveAttribute('aria-selected', 'true');
  }
  for (const coord of ['C1', 'A4', 'C2', 'B4']) {
    await expect(cell(page, coord)).toHaveAttribute('aria-selected', 'false');
  }

  await f.dataCommand(page, 'Create pivot table');
  const dialog = page.getByRole('dialog', { name: 'Create pivot table', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Source range: A1:B3')).toBeVisible();

  await page.reload();
  for (const coord of ['A1', 'B1', 'A2', 'B2', 'A3', 'B3']) {
    await expect(cell(page, coord)).toHaveAttribute('aria-selected', 'true');
  }
  for (const coord of ['C1', 'A4', 'C2', 'B4']) {
    await expect(cell(page, coord)).toHaveAttribute('aria-selected', 'false');
  }

  await cell(page, 'C1').click();
  await expect(cell(page, 'C1')).toHaveAttribute('aria-selected', 'true');
  for (const coord of ['A1', 'B1', 'A2', 'B2', 'A3', 'B3']) {
    await expect(cell(page, coord)).toHaveAttribute('aria-selected', 'false');
  }

  await page.reload();
  await expect(cell(page, 'C1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'false');
});

test('REQ-3-2-1: Copy a range to a new location', async ({ page }) => {
  await page.goto('/');
  await f.createWorkbook(page);
  await enterValues(page, { A1: '1', B1: '2', A2: '3', B2: '=A1+$B$1', G1: 'Keep' });
  await expect(cell(page, 'B2')).toHaveText('3');

  await f.selectRange(page, 'A1', 'B2');
  await f.copySelection(page);
  await cell(page, 'D1').click();
  await f.pasteSelection(page);

  await expect(cell(page, 'D1')).toHaveText('1');
  await expect(cell(page, 'E1')).toHaveText('2');
  await expect(cell(page, 'D2')).toHaveText('3');
  await expect(cell(page, 'E2')).toHaveText('3');
  await expect(cell(page, 'A1')).toHaveText('1');
  await expect(cell(page, 'B1')).toHaveText('2');
  await expect(cell(page, 'A2')).toHaveText('3');
  await expect(cell(page, 'B2')).toHaveText('3');
  await expect(cell(page, 'G1')).toHaveText('Keep');

  await cell(page, 'B2').click();
  await expect(formulaBar(page)).toHaveValue('=A1+$B$1');
  await cell(page, 'E2').click();
  await expect(formulaBar(page)).toHaveValue('=D1+$B$1');

  await page.reload();
  await expect(cell(page, 'D1')).toHaveText('1');
  await expect(cell(page, 'E1')).toHaveText('2');
  await expect(cell(page, 'D2')).toHaveText('3');
  await expect(cell(page, 'E2')).toHaveText('3');
  await expect(cell(page, 'A1')).toHaveText('1');
  await expect(cell(page, 'B1')).toHaveText('2');
  await expect(cell(page, 'A2')).toHaveText('3');
  await expect(cell(page, 'B2')).toHaveText('3');
  await expect(cell(page, 'G1')).toHaveText('Keep');

  await cell(page, 'B2').click();
  await expect(formulaBar(page)).toHaveValue('=A1+$B$1');
  await cell(page, 'E2').click();
  await expect(formulaBar(page)).toHaveValue('=D1+$B$1');
});

test('REQ-3-2-1#2: Cut and move a range', async ({ page }) => {
  await page.goto('/');
  await f.createWorkbook(page);
  await enterValues(page, { A1: 'A', B1: 'B', A2: 'C', B2: 'D', G1: 'Keep' });

  await f.selectRange(page, 'A1', 'B2');
  await f.cutSelection(page);
  await cell(page, 'D1').click();
  await f.pasteSelection(page);

  await expect(cell(page, 'D1')).toHaveText('A');
  await expect(cell(page, 'E1')).toHaveText('B');
  await expect(cell(page, 'D2')).toHaveText('C');
  await expect(cell(page, 'E2')).toHaveText('D');
  await expect(cell(page, 'A1')).toHaveText('');
  await expect(cell(page, 'B1')).toHaveText('');
  await expect(cell(page, 'A2')).toHaveText('');
  await expect(cell(page, 'B2')).toHaveText('');
  await expect(cell(page, 'G1')).toHaveText('Keep');

  await page.reload();
  await expect(cell(page, 'D1')).toHaveText('A');
  await expect(cell(page, 'E1')).toHaveText('B');
  await expect(cell(page, 'D2')).toHaveText('C');
  await expect(cell(page, 'E2')).toHaveText('D');
  await expect(cell(page, 'A1')).toHaveText('');
  await expect(cell(page, 'B1')).toHaveText('');
  await expect(cell(page, 'A2')).toHaveText('');
  await expect(cell(page, 'B2')).toHaveText('');
  await expect(cell(page, 'G1')).toHaveText('Keep');
});

test('REQ-3-2-2: Undo and redo one modification', async ({ page }) => {
  await page.goto('/');
  await f.createWorkbook(page);
  const unique = u('val');
  await f.enterCell(page, 'A1', unique);
  await expect(cell(page, 'A1')).toHaveText(unique);

  await f.undo(page);
  await expect(cell(page, 'A1')).toHaveText('');

  await f.redo(page);
  await expect(cell(page, 'A1')).toHaveText(unique);

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText(unique);
});

test('REQ-3-2-2#2: A new modification clears the redo branch', async ({ page }) => {
  await page.goto('/');
  await f.createWorkbook(page);
  const oldBranch = u('old');
  const newBranch = u('new');

  await f.enterCell(page, 'A1', oldBranch);
  await expect(cell(page, 'A1')).toHaveText(oldBranch);

  await f.undo(page);
  await expect(cell(page, 'A1')).toHaveText('');

  const redoButton = page.getByRole('button', { name: 'Redo', exact: true });
  await expect(redoButton).toBeEnabled();

  await f.enterCell(page, 'A1', newBranch);
  await expect(cell(page, 'A1')).toHaveText(newBranch);
  await expect(redoButton).toBeDisabled();

  await cell(page, 'A1').click();
  await page.keyboard.press('Control+Y');
  await expect(cell(page, 'A1')).toHaveText(newBranch);

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText(newBranch);
});

test('REQ-3-2-2#3: Undo and redo a source-value edit with dependent formulas', async ({ page }) => {
  await page.goto('/');
  await f.createWorkbook(page);
  await enterValues(page, { A1: '2', B1: '=A1*2' });
  await expect(cell(page, 'B1')).toHaveText('4');

  await f.enterCell(page, 'A1', '3');
  await expect(cell(page, 'A1')).toHaveText('3');
  await expect(cell(page, 'B1')).toHaveText('6');

  await f.undo(page);
  await expect(cell(page, 'A1')).toHaveText('2');
  await expect(cell(page, 'B1')).toHaveText('4');
  await cell(page, 'B1').click();
  await expect(formulaBar(page)).toHaveValue('=A1*2');

  await f.redo(page);
  await expect(cell(page, 'A1')).toHaveText('3');
  await expect(cell(page, 'B1')).toHaveText('6');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('3');
  await expect(cell(page, 'B1')).toHaveText('6');
  await cell(page, 'B1').click();
  await expect(formulaBar(page)).toHaveValue('=A1*2');
});

test('REQ-3-2-2#4: Undo and redo row/column changes with validation', async ({ page }) => {
  await page.goto('/');
  await f.createWorkbook(page);
  await f.enterCell(page, 'A1', 'Keep');
  await createDropdownRule(page, 'Keep, Another');
  await assertDropdownAt(page, 'A1');

  await f.insertRowAbove(page, 1);
  await f.insertColumnLeft(page, 'A');
  await assertDropdownAt(page, 'B2');
  await expect(cell(page, 'A1')).toHaveText('');
  await expect(dropdownButton(page, 'A1')).not.toBeVisible();

  await f.undo(page);
  await assertDropdownAt(page, 'A2');
  await expect(cell(page, 'B2')).toHaveText('');
  await expect(dropdownButton(page, 'B2')).not.toBeVisible();

  await f.undo(page);
  await assertDropdownAt(page, 'A1');
  await expect(cell(page, 'A2')).toHaveText('');
  await expect(dropdownButton(page, 'A2')).not.toBeVisible();

  await f.redo(page);
  await assertDropdownAt(page, 'A2');
  await expect(cell(page, 'A1')).toHaveText('');
  await expect(dropdownButton(page, 'A1')).not.toBeVisible();

  await f.redo(page);
  await assertDropdownAt(page, 'B2');
  await expect(cell(page, 'A2')).toHaveText('');
  await expect(dropdownButton(page, 'A2')).not.toBeVisible();

  await page.reload();
  await assertDropdownAt(page, 'B2');
});
