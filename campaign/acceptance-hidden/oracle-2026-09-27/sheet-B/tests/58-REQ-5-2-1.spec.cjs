const { test, expect } = require('@playwright/test');

// <helpers> ------------------------------------------------------------------
// Shared helpers (the same block is repeated in every sheet-B spec file).
// Every test builds its own data in a brand-new workbook ("New blank workbook" -> "Create"),
// so the never-reset app instance and the seeded "Q3 Sales" workbook stay untouched.
const fs = require('fs');

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const grid = (page) => page.getByRole('grid', { name: 'Worksheet grid', exact: true });
const cell = (page, ref) => page.getByRole('gridcell', { name: ref, exact: true });
const formulaBar = (page) => page.getByRole('textbox', { name: 'Formula bar', exact: true });
const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const tab = (page, name) => page.getByRole('tab', { name, exact: true });
const dropdownButton = (page, ref) => button(page, `Open dropdown for ${ref}`);

async function openNewWorkbook(page) {
  await page.goto('/');
  await button(page, 'New blank workbook').click();
  await button(page, 'Create').click();
  await expect(grid(page)).toBeVisible();
}

async function reload(page) {
  await page.reload();
  await expect(grid(page)).toBeVisible();
}

// Commit one value or formula through the labelled "Formula bar" (select cell, type, Enter).
async function enter(page, ref, value) {
  await cell(page, ref).click();
  await formulaBar(page).fill(value);
  await formulaBar(page).press('Enter');
}

async function enterAll(page, entries) {
  for (const [ref, value] of entries) await enter(page, ref, value);
}

// Commit one value or formula through the grid's inline editor (double-click, "Edit <cell>", Enter).
async function enterInGrid(page, ref, value) {
  await cell(page, ref).dblclick();
  const editor = page.getByRole('textbox', { name: `Edit ${ref}`, exact: true });
  await editor.fill(value);
  await editor.press('Enter');
}

// Exact displayed text of plain cells ('' = empty cell).
async function expectCells(page, expected) {
  for (const [ref, text] of Object.entries(expected)) await expect(cell(page, ref)).toHaveText(text);
}

// Formula bar shows the original submitted expression of the selected cell.
async function expectFormula(page, ref, formula) {
  await cell(page, ref).click();
  await expect(formulaBar(page)).toHaveValue(formula);
}

// For a cell that also hosts a dropdown button: the grid shows the value. The button's own content
// (empty, icon or glyph) is not part of the requirement, so the check does not depend on it.
async function expectDropdownValue(page, ref, value) {
  await expect(cell(page, ref)).toContainText(value);
}

// Drag from one corner cell to the diagonally opposite cell (Playwright dragTo: press on the
// first cell, move onto the second one, release; both are scrolled into view when needed).
async function dragSelect(page, from, to) {
  await cell(page, from).dragTo(cell(page, to));
}

// Ctrl+<key> exactly as the official Linux runner delivers it. Linux Chromium turns Ctrl+C/X/V/Z/Y
// into editing commands (copy/cut/paste events); macOS Chromium does not, so on macOS the same
// command is attached explicitly to the Control-modified key event.
const SHORTCUTS = { c: ['KeyC', 67, 'copy'], x: ['KeyX', 88, 'cut'], v: ['KeyV', 86, 'paste'], z: ['KeyZ', 90, 'undo'], y: ['KeyY', 89, 'redo'] };
async function ctrl(page, key) {
  if (process.platform !== 'darwin') return page.keyboard.press(`Control+${key}`);
  const [code, keyCode, command] = SHORTCUTS[key];
  const cdp = await page.context().newCDPSession(page);
  await page.keyboard.down('Control');
  await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', modifiers: 2, key, code, windowsVirtualKeyCode: keyCode, commands: [command] });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: 2, key, code, windowsVirtualKeyCode: keyCode });
  await page.keyboard.up('Control');
  await cdp.detach();
}

// Put external tab/newline text on the clipboard, then Ctrl+V into the selected cell.
async function pasteText(page, text) {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
  await ctrl(page, 'v');
}

async function dataMenu(page, item) {
  await button(page, 'Data').click();
  await page.getByRole('menuitem', { name: item, exact: true }).click();
}

// Pick an option in a named combo box: open it, then click the option by its ARIA role and visible name.
async function choose(scope, label, option) {
  const page = typeof scope.page === 'function' ? scope.page() : scope;
  await scope.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

// Data > Data validation for the current selection; fields = { 'Allowed values': ... } or { Minimum, Maximum }.
async function saveValidation(page, ruleType, fields) {
  await dataMenu(page, 'Data validation');
  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await choose(dialog, 'Rule type', ruleType);
  for (const [label, value] of Object.entries(fields)) await dialog.getByRole('textbox', { name: label, exact: true }).fill(value);
  await button(dialog, 'Save').click();
  await expect(dialog).toBeHidden();
}

async function sortRange(page, from, to, by, order) {
  await dragSelect(page, from, to);
  await dataMenu(page, 'Sort range');
  const dialog = page.getByRole('dialog', { name: 'Sort range', exact: true });
  await choose(dialog, 'Sort by', by);
  await choose(dialog, 'Order', order);
  await dialog.getByRole('checkbox', { name: 'Data has header row', exact: true }).check();
  await button(dialog, 'Sort').click();
}

async function createFilter(page, from, to) {
  await dragSelect(page, from, to);
  await dataMenu(page, 'Create filter');
}

async function filterValues(page, header, values) {
  await button(page, `Filter ${header}`).click();
  const dialog = page.getByRole('dialog', { name: `Filter ${header}`, exact: true });
  await button(dialog, 'Clear selection').click();
  for (const value of values) await dialog.getByRole('checkbox', { name: value, exact: true }).check();
  await button(dialog, 'Apply').click();
}

async function filterCondition(page, header, condition, value) {
  await button(page, `Filter ${header}`).click();
  const dialog = page.getByRole('dialog', { name: `Filter ${header}`, exact: true });
  await choose(dialog, 'Condition', condition);
  if (value !== undefined) await dialog.getByRole('textbox', { name: 'Value', exact: true }).fill(value);
  await button(dialog, 'Apply').click();
}

async function expectHiddenRows(page, refs) {
  for (const ref of refs) await expect(cell(page, ref)).toBeHidden();
}

// Select the source, Data > Create pivot table > New worksheet > Create, then show Pivot1.
async function createPivot(page, from, to) {
  await dragSelect(page, from, to);
  await dataMenu(page, 'Create pivot table');
  const dialog = page.getByRole('dialog', { name: 'Create pivot table', exact: true });
  await dialog.getByRole('radio', { name: 'New worksheet', exact: true }).check();
  await button(dialog, 'Create').click();
  await tab(page, 'Pivot1').click();
}

async function applyPivot(page, { rows, columns, values, summarize }) {
  const editor = page.getByRole('region', { name: 'Pivot table editor', exact: true });
  await choose(editor, 'Rows', rows);
  if (columns) await choose(editor, 'Columns', columns);
  await choose(editor, 'Values', values);
  await choose(editor, 'Summarize by', summarize);
  await button(editor, 'Apply').click();
}
// </helpers> -----------------------------------------------------------------

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
