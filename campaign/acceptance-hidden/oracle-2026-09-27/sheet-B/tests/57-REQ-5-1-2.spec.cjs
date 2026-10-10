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

// REQ-5-1-2 Filter Rows by Value or Condition

test('REQ-5-1-2 S1: 组合 Region 值与 Sales 数值条件，刷新后保持并可无损清除', async ({ page }) => {
  await openNewWorkbook(page);
  const source = {
    A1: 'Region', B1: 'Sales', C1: 'Status',
    A2: 'East', B2: '1200', C2: 'Open',
    A3: 'East', B3: '900', C3: 'Closed',
    A4: 'North', B4: '2000', C4: 'Open',
    A5: 'East', B5: '1500', C5: 'Closed',
    A6: 'South', B6: '700', C6: 'Open',
  };
  await enterAll(page, Object.entries(source));

  await createFilter(page, 'A1', 'C6');
  await filterValues(page, 'Region', ['East']);
  await filterCondition(page, 'Sales', 'Greater than', '1000');

  const filtered = async () => {
    await expect(cell(page, 'A1')).toContainText('Region');
    await expectCells(page, { A2: 'East', B2: '1200', A5: 'East', B5: '1500' });
    await expectHiddenRows(page, ['A3', 'A4', 'A6']);
  };
  await filtered();
  await reload(page);
  await filtered();

  await dataMenu(page, 'Clear filter');
  const { A1, B1, C1, ...records } = source;
  await expectCells(page, records);
});

test('REQ-5-1-2 S2: 组合文本包含、日期比较和为空条件，并支持非空条件', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [
    ['A1', 'Name'], ['B1', 'Date'], ['C1', 'Note'],
    ['A2', 'Alpha One'], ['B2', '2024-01-10'],
    ['A3', 'Beta Two'], ['B3', '2024-01-05'],
    ['A4', 'Alpha Three'], ['B4', '2023-12-01'], ['C4', 'Done'],
    ['A5', 'Alpha Four'], ['B5', '2024-03-01'],
    ['A6', 'Gamma Five'], ['B6', '2023-11-11'], ['C6', 'Done'],
  ]);
  await createFilter(page, 'A1', 'C6');

  await filterCondition(page, 'Name', 'Text contains', 'Alpha');
  await expectHiddenRows(page, ['A3', 'A6']);
  await filterCondition(page, 'Date', 'Before', '2024-02-01');
  await expectHiddenRows(page, ['A3', 'A5', 'A6']);
  await filterCondition(page, 'Note', 'Is empty');
  await expectCells(page, { A2: 'Alpha One', B2: '2024-01-10' });
  await expectHiddenRows(page, ['A3', 'A4', 'A5', 'A6']);

  await filterCondition(page, 'Note', 'Is not empty');
  await expectCells(page, { A4: 'Alpha Three', B4: '2023-12-01', C4: 'Done' });
  await expectHiddenRows(page, ['A2', 'A3', 'A5', 'A6']);
});

test('REQ-5-1-2 S3: CSV 导出包含被筛选隐藏的已保存行', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [
    ['A1', 'Region'], ['B1', 'Sales'],
    ['A2', 'East'], ['B2', '100'],
    ['A3', 'West'], ['B3', '200'],
    ['A4', 'North'], ['B4', '300'],
  ]);
  await createFilter(page, 'A1', 'B4');
  await filterCondition(page, 'Sales', 'Greater than', '150');
  await expectHiddenRows(page, ['A2']);

  const [download] = await Promise.all([page.waitForEvent('download'), button(page, 'Export CSV').click()]);
  expect(download.suggestedFilename().endsWith('.csv')).toBe(true);
  const csv = fs.readFileSync(await download.path(), 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '');
  expect(csv).toBe('Region,Sales\nEast,100\nWest,200\nNorth,300');

  // Export does not change the filter view.
  await expectCells(page, { A3: 'West', B3: '200', A4: 'North', B4: '300' });
  await expectHiddenRows(page, ['A2']);
});

test('REQ-5-1-2 S4: 清除筛选后再次应用不同条件仍保留已保存行', async ({ page }) => {
  await openNewWorkbook(page);
  const records = { A2: 'Pen', B2: '4', A3: 'Book', B3: '12', A4: 'Lamp', B4: '7', A5: 'Desk', B5: '20' };
  await enterAll(page, [['A1', 'Item'], ['B1', 'Qty'], ...Object.entries(records)]);

  await createFilter(page, 'A1', 'B5');
  await filterCondition(page, 'Qty', 'Greater than', '10');
  await expectCells(page, { A3: 'Book', A5: 'Desk' });
  await expectHiddenRows(page, ['A2', 'A4']);

  await dataMenu(page, 'Clear filter');
  await expectCells(page, records);

  await createFilter(page, 'A1', 'B5');
  await filterCondition(page, 'Item', 'Text contains', 'e');
  await expectCells(page, { A2: 'Pen', B2: '4', A5: 'Desk', B5: '20' });
  await expectHiddenRows(page, ['A3', 'A4']);

  await dataMenu(page, 'Clear filter');
  await expectCells(page, records);
});

test('REQ-5-1-2 S5: 筛选到空结果后刷新仍保持空结果状态', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [
    ['A1', 'Name'], ['B1', 'Score'],
    ['A2', 'Ann'], ['B2', '10'],
    ['A3', 'Ben'], ['B3', '20'],
    ['A4', 'Cal'], ['B4', '30'],
  ]);
  await createFilter(page, 'A1', 'B4');
  await filterCondition(page, 'Score', 'Greater than', '100');

  const empty = async () => {
    await expect(button(page, 'Filter Score')).toBeVisible();
    await expect(cell(page, 'A1')).toContainText('Name');
    await expectHiddenRows(page, ['A2', 'A3', 'A4']);
  };
  await empty();
  await reload(page);
  await empty();
});
