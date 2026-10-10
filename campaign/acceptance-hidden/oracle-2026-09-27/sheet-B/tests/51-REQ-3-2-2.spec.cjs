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
