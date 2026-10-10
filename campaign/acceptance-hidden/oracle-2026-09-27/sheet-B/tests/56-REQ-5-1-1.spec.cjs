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

// REQ-5-1-1 Sort a Data Range by a Specified Column

test('REQ-5-1-1 S1: 按 Sales 稳定降序排列完整记录，并保持范围外数据', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [
    ['A1', 'Region'], ['B1', 'Sales'], ['C1', 'Status'],
    ['A2', 'East'], ['B2', '1200'], ['C2', 'Open'],
    ['A3', 'North'], ['B3', '800'], ['C3', 'Closed'],
    ['A4', 'South'], ['B4', '1200'], ['C4', 'Pending'],
    ['A5', 'West'], ['B5', '500'], ['C5', 'Open'],
    ['E1', 'Outside'],
  ]);

  await sortRange(page, 'A1', 'C5', 'Sales', 'Descending');

  const sorted = {
    A1: 'Region', B1: 'Sales', C1: 'Status',
    A2: 'East', B2: '1200', C2: 'Open',
    A3: 'South', B3: '1200', C3: 'Pending',
    A4: 'North', B4: '800', C4: 'Closed',
    A5: 'West', B5: '500', C5: 'Open',
    E1: 'Outside',
  };
  await expectCells(page, sorted);
  await reload(page);
  await expectCells(page, sorted);
});

test('REQ-5-1-1 S2: 按文本升序和 ISO 日期降序排列完整记录', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [
    ['A1', 'Name'], ['B1', 'Joined'], ['C1', 'Score'],
    ['A2', 'Delta'], ['B2', '2024-02-10'], ['C2', '4'],
    ['A3', 'Alpha'], ['B3', '2023-11-05'], ['C3', '2'],
    ['A4', 'Charlie'], ['B4', '2024-07-01'], ['C4', '3'],
    ['A5', 'Bravo'], ['B5', '2022-12-31'], ['C5', '1'],
  ]);

  await sortRange(page, 'A1', 'C5', 'Name', 'Ascending');
  await expectCells(page, {
    A1: 'Name', B1: 'Joined', C1: 'Score',
    A2: 'Alpha', B2: '2023-11-05', C2: '2',
    A3: 'Bravo', B3: '2022-12-31', C3: '1',
    A4: 'Charlie', B4: '2024-07-01', C4: '3',
    A5: 'Delta', B5: '2024-02-10', C5: '4',
  });

  await sortRange(page, 'A1', 'C5', 'Joined', 'Descending');
  const byDate = {
    A1: 'Name', B1: 'Joined', C1: 'Score',
    A2: 'Charlie', B2: '2024-07-01', C2: '3',
    A3: 'Delta', B3: '2024-02-10', C3: '4',
    A4: 'Alpha', B4: '2023-11-05', C4: '2',
    A5: 'Bravo', B5: '2022-12-31', C5: '1',
  };
  await expectCells(page, byDate);
  await reload(page);
  await expectCells(page, byDate);
});

test('REQ-5-1-1 S3: 排序完整记录后公式与数值校验继续作用于对应列', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [
    ['A1', 'Item'], ['B1', 'Score'], ['C1', 'Double'],
    ['A2', 'Alpha'], ['B2', '3'], ['C2', '=B2*2'],
    ['A3', 'Bravo'], ['B3', '1'], ['C3', '=B3*2'],
    ['A4', 'Charlie'], ['B4', '2'], ['C4', '=B4*2'],
  ]);
  await dragSelect(page, 'B2', 'B4');
  await saveValidation(page, 'Number range', { Minimum: '0', Maximum: '10' });

  await sortRange(page, 'A1', 'C4', 'Score', 'Ascending');
  const sorted = {
    A2: 'Bravo', B2: '1', C2: '2',
    A3: 'Charlie', B3: '2', C3: '4',
    A4: 'Alpha', B4: '3', C4: '6',
  };
  await expectCells(page, sorted);
  await expectFormula(page, 'C2', '=B2*2');
  await expectFormula(page, 'C4', '=B4*2');

  await enter(page, 'B2', '11');
  await expect(page.getByText('Please enter a number between 0 and 10')).toBeVisible();
  await expectCells(page, { B2: '1', C2: '2' });

  await reload(page);
  await expectCells(page, sorted);
});

test('REQ-5-1-1 S4: 排序后已有筛选条件继续控制对应数据行', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [
    ['A1', 'Item'], ['B1', 'Score'],
    ['A2', 'Alpha'], ['B2', '3'],
    ['A3', 'Bravo'], ['B3', '1'],
    ['A4', 'Charlie'], ['B4', '2'],
  ]);
  await createFilter(page, 'A1', 'B4');
  await filterCondition(page, 'Score', 'Greater than', '1');
  await expectHiddenRows(page, ['A3']);
  await expectCells(page, { A2: 'Alpha', A4: 'Charlie' });

  await sortRange(page, 'A1', 'B4', 'Score', 'Ascending');

  // Hidden Bravo moves to row 2; visible Charlie and Alpha move to rows 3 and 4.
  const check = async () => {
    await expect(button(page, 'Filter Score')).toBeVisible();
    await expectHiddenRows(page, ['A2']);
    await expectCells(page, { A3: 'Charlie', B3: '2', A4: 'Alpha', B4: '3' });
  };
  await check();
  await reload(page);
  await check();
});

test('REQ-5-1-1 S5: 对重复数值排序时保持同值记录的相对顺序', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [
    ['A1', 'Name'], ['B1', 'Points'],
    ['A2', 'P1'], ['B2', '5'],
    ['A3', 'P2'], ['B3', '3'],
    ['A4', 'P3'], ['B4', '5'],
    ['A5', 'P4'], ['B5', '3'],
    ['A6', 'P5'], ['B6', '1'],
  ]);

  await sortRange(page, 'A1', 'B6', 'Points', 'Ascending');

  await expectCells(page, {
    A1: 'Name', B1: 'Points',
    A2: 'P5', B2: '1',
    A3: 'P2', B3: '3',
    A4: 'P4', B4: '3',
    A5: 'P1', B5: '5',
    A6: 'P3', B6: '5',
  });
});

test('REQ-5-1-1 S6: 按日期降序排序后保留表头和范围外单元格', async ({ page }) => {
  await openNewWorkbook(page);
  await enterAll(page, [
    ['A1', 'Event'], ['B1', 'Date'],
    ['A2', 'Review'], ['B2', '2024-01-15'],
    ['A3', 'Launch'], ['B3', '2024-05-01'],
    ['A4', 'Kickoff'], ['B4', '2023-12-20'],
    ['C2', 'Note'], ['A5', 'Tail'], ['D1', 'Outside'],
  ]);

  await sortRange(page, 'A1', 'B4', 'Date', 'Descending');

  await expectCells(page, {
    A1: 'Event', B1: 'Date',
    A2: 'Launch', B2: '2024-05-01',
    A3: 'Review', B3: '2024-01-15',
    A4: 'Kickoff', B4: '2023-12-20',
    C2: 'Note', A5: 'Tail', D1: 'Outside',
  });
});
