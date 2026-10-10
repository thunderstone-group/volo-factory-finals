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

// REQ-5-3-1 Create and Refresh a Basic Pivot Table

test('REQ-5-3-1 S1: 在 Pivot1 按 Region 汇总 Sales，并保持源表不变', async ({ page }) => {
  await openNewWorkbook(page);
  const source = {
    A1: 'Region', B1: 'Sales',
    A2: 'East', B2: '1200',
    A3: 'North', B3: '800',
    A4: 'East', B4: '600',
    A5: 'South', B5: '1000',
    A6: 'North', B6: '700',
  };
  await enterAll(page, Object.entries(source));

  await dragSelect(page, 'A1', 'B6');
  await dataMenu(page, 'Create pivot table');
  const dialog = page.getByRole('dialog', { name: 'Create pivot table', exact: true });
  await expect(dialog.getByText('Source range: A1:B6', { exact: true })).toBeVisible();
  await dialog.getByRole('radio', { name: 'New worksheet', exact: true }).check();
  await button(dialog, 'Create').click();
  await tab(page, 'Pivot1').click();
  await applyPivot(page, { rows: 'Region', values: 'Sales', summarize: 'SUM' });

  const result = {
    A1: 'Region', B1: 'SUM of Sales',
    A2: 'East', B2: '1800',
    A3: 'North', B3: '1500',
    A4: 'South', B4: '1000',
    A5: 'Grand Total', B5: '4300',
  };
  await expectCells(page, result);

  await tab(page, 'Sheet1').click();
  await expectCells(page, source);

  await reload(page);
  await tab(page, 'Pivot1').click();
  await expectCells(page, result);
});

test('REQ-5-3-1 S2: 刷新已有透视表后覆盖旧汇总，并持久化新结果', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [
    ['A1', 'Region'], ['B1', 'Sales'],
    ['A2', 'East'], ['B2', '1200'],
    ['A3', 'North'], ['B3', '800'],
    ['A4', 'East'], ['B4', '600'],
  ]);
  await createPivot(page, 'A1', 'B4');
  await applyPivot(page, { rows: 'Region', values: 'Sales', summarize: 'SUM' });
  await expectCells(page, { A2: 'East', B2: '1800', A3: 'North', B3: '800', A4: 'Grand Total', B4: '2600' });

  await tab(page, 'Sheet1').click();
  await enter(page, 'B2', '1500');
  await expectCells(page, { B2: '1500' });

  await tab(page, 'Pivot1').click();
  await button(page, 'Refresh pivot table').click();
  const refreshed = { A1: 'Region', B1: 'SUM of Sales', A2: 'East', B2: '2100', A3: 'North', B3: '800', A4: 'Grand Total', B4: '2900' };
  await expectCells(page, refreshed);

  await tab(page, 'Sheet1').click();
  await expectCells(page, { A2: 'East', B2: '1500', A3: 'North', B3: '800', A4: 'East', B4: '600' });

  await reload(page);
  await tab(page, 'Pivot1').click();
  await expectCells(page, refreshed);
});

test('REQ-5-3-1 S3: 使用行列字段和 COUNT 生成二维汇总并持久化', async ({ page }) => {
  await openNewWorkbook(page);
  // Seed layout (Region/Sales/Status, first three records from the requirement seed) plus two records.
  await enterAll(page, [
    ['A1', 'Region'], ['B1', 'Sales'], ['C1', 'Status'],
    ['A2', 'East'], ['B2', '1200'], ['C2', 'Open'],
    ['A3', 'North'], ['B3', '800'], ['C3', 'Closed'],
    ['A4', 'South'], ['B4', '700'], ['C4', 'Open'],
    ['A5', 'East'], ['B5', '900'], ['C5', 'Closed'],
    ['A6', 'East'], ['B6', '500'], ['C6', 'Open'],
  ]);
  await createPivot(page, 'A1', 'C6');
  await applyPivot(page, { rows: 'Region', columns: 'Status', values: 'Sales', summarize: 'COUNT' });

  const result = {
    A1: 'Region', B1: 'Open', C1: 'Closed', D1: 'Grand Total',
    A2: 'East', B2: '2', C2: '1', D2: '3',
    A3: 'North', B3: '0', C3: '1', D3: '1',
    A4: 'South', B4: '1', C4: '0', D4: '1',
    A5: 'Grand Total', B5: '3', C5: '2', D5: '5',
  };
  await expectCells(page, result);
  await reload(page);
  await tab(page, 'Pivot1').click();
  await expectCells(page, result);
});

test('REQ-5-3-1 S4: AVERAGE 忽略非数值记录并保持源数据不变', async ({ page }) => {
  await openNewWorkbook(page);
  const source = {
    A1: 'Region', B1: 'Sales',
    A2: 'East', B2: '100',
    A3: 'West', B3: '300',
    A4: 'East', B4: 'pending',
    A5: 'East', B5: '200',
  };
  await enterAll(page, Object.entries(source));
  await createPivot(page, 'A1', 'B5');
  await applyPivot(page, { rows: 'Region', values: 'Sales', summarize: 'AVERAGE' });

  await expectCells(page, {
    A1: 'Region', B1: 'AVERAGE of Sales',
    A2: 'East', B2: '150',
    A3: 'West', B3: '300',
    A4: 'Grand Total', B4: '200',
  });
  await tab(page, 'Sheet1').click();
  await expectCells(page, source);
});

test('REQ-5-3-1 S5: 无效数值聚合显示错误并保留上一次成功结果', async ({ page }) => {
  await openNewWorkbook(page);
  const source = {
    A1: 'Region', B1: 'Sales', C1: 'Owner',
    A2: 'East', B2: '100', C2: 'Ann',
    A3: 'West', B3: '200', C3: 'Ben',
    A4: 'East', B4: '300', C4: 'Cal',
  };
  await enterAll(page, Object.entries(source));
  await createPivot(page, 'A1', 'C4');
  await applyPivot(page, { rows: 'Region', values: 'Sales', summarize: 'SUM' });
  const lastGood = { A1: 'Region', B1: 'SUM of Sales', A2: 'East', B2: '400', A3: 'West', B3: '200', A4: 'Grand Total', B4: '600' };
  await expectCells(page, lastGood);

  await applyPivot(page, { rows: 'Region', values: 'Owner', summarize: 'SUM' });
  await expect(page.getByText('Value field requires numeric values')).toBeVisible();
  await expectCells(page, lastGood);

  await tab(page, 'Sheet1').click();
  await expectCells(page, source);
});

test('REQ-5-3-1 S6: 刷新透视表时汇总被筛选隐藏的源记录', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [
    ['A1', 'Region'], ['B1', 'Sales'],
    ['A2', 'East'], ['B2', '100'],
    ['A3', 'West'], ['B3', '200'],
    ['A4', 'East'], ['B4', '300'],
    ['A5', 'North'], ['B5', '400'],
  ]);
  await createPivot(page, 'A1', 'B5');
  await applyPivot(page, { rows: 'Region', values: 'Sales', summarize: 'SUM' });
  await expectCells(page, { A2: 'East', B2: '400', A3: 'West', B3: '200', A4: 'North', B4: '400', A5: 'Grand Total', B5: '1000' });

  await tab(page, 'Sheet1').click();
  await createFilter(page, 'A1', 'B5');
  await filterValues(page, 'Region', ['East']);
  await expectHiddenRows(page, ['A3', 'A5']);
  await enter(page, 'B2', '150');
  await expectCells(page, { B2: '150' });

  await tab(page, 'Pivot1').click();
  await button(page, 'Refresh pivot table').click();
  await expectCells(page, {
    A1: 'Region', B1: 'SUM of Sales',
    A2: 'East', B2: '450',
    A3: 'West', B3: '200',
    A4: 'North', B4: '400',
    A5: 'Grand Total', B5: '1050',
  });
});

test('REQ-5-3-1 S7: 源区域插入行列后刷新会使用调整后的完整范围', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [
    ['A1', 'Region'], ['B1', 'Sales'],
    ['A2', 'East'], ['B2', '100'],
    ['A3', 'North'], ['B3', '200'],
    ['A4', 'East'], ['B4', '300'],
  ]);
  await createPivot(page, 'A1', 'B4');
  await applyPivot(page, { rows: 'Region', values: 'Sales', summarize: 'SUM' });
  await expectCells(page, { A2: 'East', B2: '400', A3: 'North', B3: '200', A4: 'Grand Total', B4: '600' });
  const refreshed = { A1: 'Region', B1: 'SUM of Sales', A2: 'East', B2: '450', A3: 'North', B3: '200', A4: 'Grand Total', B4: '650' };

  await tab(page, 'Sheet1').click();
  await page.getByRole('rowheader', { name: '3', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 row above', exact: true }).click();
  await enterAll(page, [['A3', 'East'], ['B3', '50']]);
  await expectCells(page, { A4: 'North', B4: '200', A5: 'East', B5: '300' });
  await tab(page, 'Pivot1').click();
  await button(page, 'Refresh pivot table').click();
  await expectCells(page, refreshed);

  await tab(page, 'Sheet1').click();
  await page.getByRole('columnheader', { name: 'B', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 column left', exact: true }).click();
  await expectCells(page, { A1: 'Region', B1: '', C1: 'Sales', A3: 'East', C3: '50' });
  await tab(page, 'Pivot1').click();
  await button(page, 'Refresh pivot table').click();
  await expectCells(page, refreshed);

  await reload(page);
  await tab(page, 'Pivot1').click();
  await expectCells(page, refreshed);
});

test('REQ-5-3-1 S8: 删除已选源字段后刷新显示错误并保留上次结果', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [
    ['A1', 'Region'], ['B1', 'Sales'],
    ['A2', 'East'], ['B2', '100'],
    ['A3', 'North'], ['B3', '200'],
    ['A4', 'East'], ['B4', '300'],
  ]);
  await createPivot(page, 'A1', 'B4');
  await applyPivot(page, { rows: 'Region', values: 'Sales', summarize: 'SUM' });
  const lastGood = { A1: 'Region', B1: 'SUM of Sales', A2: 'East', B2: '400', A3: 'North', B3: '200', A4: 'Grand Total', B4: '600' };
  await expectCells(page, lastGood);

  await tab(page, 'Sheet1').click();
  await page.getByRole('columnheader', { name: 'B', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete column', exact: true }).click();
  await expectCells(page, { A1: 'Region', A2: 'East', A3: 'North', A4: 'East', B1: '', B2: '' });

  await tab(page, 'Pivot1').click();
  await button(page, 'Refresh pivot table').click();
  await expect(page.getByText('Pivot field is no longer available. Select a new field.')).toBeVisible();
  await expectCells(page, lastGood);

  await tab(page, 'Sheet1').click();
  await expectCells(page, { A1: 'Region', A2: 'East', A3: 'North', A4: 'East' });
  await reload(page);
  await tab(page, 'Pivot1').click();
  await expectCells(page, lastGood);
});

test('REQ-5-3-1 S9: 按状态字段生成 COUNT 透视表并在刷新后保持', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [
    ['A1', 'Region'], ['B1', 'Sales'], ['C1', 'Status'],
    ['A2', 'East'], ['B2', '1200'], ['C2', 'Open'],
    ['A3', 'North'], ['B3', '800'], ['C3', 'Closed'],
    ['A4', 'South'], ['B4', '700'], ['C4', 'Open'],
  ]);
  await createPivot(page, 'A1', 'C4');
  await applyPivot(page, { rows: 'Status', values: 'Sales', summarize: 'COUNT' });

  const result = {
    A1: 'Status', B1: 'COUNT of Sales',
    A2: 'Open', B2: '2',
    A3: 'Closed', B3: '1',
    A4: 'Grand Total', B4: '3',
  };
  await expectCells(page, result);
  await reload(page);
  await tab(page, 'Pivot1').click();
  await expectCells(page, result);
});
