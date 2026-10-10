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

// REQ-3-2-1 Copy, Cut, and Paste Cell Ranges

test('REQ-3-2-1 S1: 复制 A1:B2 到 D1:E2，并调整相对引用、保留绝对引用', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [['A1', '1'], ['B1', '2'], ['A2', '3'], ['B2', '=A1+$B$1'], ['G1', 'Keep']]);
  await expectCells(page, { B2: '3' });

  await dragSelect(page, 'A1', 'B2');
  await ctrl(page, 'c');
  await cell(page, 'D1').click();
  await ctrl(page, 'v');

  const afterCopy = { D1: '1', E1: '2', D2: '3', E2: '3', A1: '1', B1: '2', A2: '3', B2: '3', G1: 'Keep' };
  await expectCells(page, afterCopy);
  await expectFormula(page, 'E2', '=D1+$B$1');
  await expectFormula(page, 'B2', '=A1+$B$1');

  await reload(page);
  await expectCells(page, afterCopy);
  await expectFormula(page, 'E2', '=D1+$B$1');
});

test('REQ-3-2-1 S2: 剪切 A1:B2 到 D1:E2，目标完整写入后清空源区域', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [['A1', 'A'], ['B1', 'B'], ['A2', 'C'], ['B2', 'D'], ['G1', 'Keep']]);

  await dragSelect(page, 'A1', 'B2');
  await ctrl(page, 'x');
  // Cutting alone does not clear the source; it is cleared only once the target is written.
  await expectCells(page, { A1: 'A', B1: 'B', A2: 'C', B2: 'D' });
  await cell(page, 'D1').click();
  await ctrl(page, 'v');

  const moved = { D1: 'A', E1: 'B', D2: 'C', E2: 'D', A1: '', B1: '', A2: '', B2: '', G1: 'Keep' };
  await expectCells(page, moved);
  await reload(page);
  await expectCells(page, moved);
});

test('REQ-3-2-1 S3: 剪切目标违反校验时保留完整源区域和原目标值', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [
    ['A1', 'Item'], ['B1', 'Qty'], ['A2', 'Pen'], ['B2', '4'],
    ['D1', '10'], ['E1', '20'], ['D2', '30'], ['E2', '40'],
  ]);
  await dragSelect(page, 'D1', 'E2');
  await saveValidation(page, 'Number range', { Minimum: '0', Maximum: '100' });

  await dragSelect(page, 'A1', 'B2');
  await ctrl(page, 'x');
  await cell(page, 'D1').click();
  await ctrl(page, 'v');

  await expect(page.getByText('Please enter a number from 0 to 100')).toBeVisible();
  const unchanged = { A1: 'Item', B1: 'Qty', A2: 'Pen', B2: '4', D1: '10', E1: '20', D2: '30', E2: '40' };
  await expectCells(page, unchanged);
  await reload(page);
  await expectCells(page, unchanged);
});

test('REQ-3-2-1 S4: 复制单个单元格到新位置并保留源值', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [['A2', 'Pen'], ['B2', '4']]);

  await cell(page, 'A2').click();
  await ctrl(page, 'c');
  await cell(page, 'D4').click();
  await ctrl(page, 'v');

  const afterCopy = { D4: 'Pen', A2: 'Pen', B2: '4', E4: '', D5: '' };
  await expectCells(page, afterCopy);
  await reload(page);
  await expectCells(page, afterCopy);
});
