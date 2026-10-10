// Generated from src/prelude.cjs + src/19-REQ-2-2-1.body.cjs by build.sh
const { test, expect } = require('@playwright/test');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Shared helpers (the same block is repeated in every sheet-A spec file).
// Locators follow the requirement text: role + exact accessible name.
// ---------------------------------------------------------------------------
const uniq = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 46656).toString(36)}`;

const grid = (page) => page.getByRole('grid', { name: 'Worksheet grid', exact: true });
const cell = (page, ref) => page.getByRole('gridcell', { name: ref, exact: true });
const formulaBar = (page) => page.getByRole('textbox', { name: 'Formula bar', exact: true });
const tab = (page, name) => page.getByRole('tab', { name, exact: true });
const btn = (scope, name) => scope.getByRole('button', { name, exact: true });
const menuItem = (page, name) => page.getByRole('menuitem', { name, exact: true });
const dialog = (page, name) => page.getByRole('dialog', { name, exact: true });
const link = (page, name) => page.getByRole('link', { name, exact: true });
const heading = (page, name) => page.getByRole('heading', { name, exact: true });
const message = (page, text) => page.getByText(text, { exact: true });

// Home page -> "New blank workbook" -> creation page -> "Create" -> editor.
// With a name, the new workbook is renamed so it can be reopened from the home page by its link.
async function createWorkbook(page, name) {
  await page.goto('/');
  await btn(page, 'New blank workbook').click();
  await btn(page, 'Create').click();
  await expect(cell(page, 'A1')).toBeVisible();
  if (name) await renameWorkbook(page, name);
}

async function renameWorkbook(page, name) {
  await btn(page, 'Rename workbook').click();
  const box = page.getByRole('textbox', { name: 'Workbook name', exact: true });
  await box.fill(name);
  await btn(page, 'Save').click();
  await expect(box).toBeHidden();
}

// "Reopen": back to the application entry point, then click the workbook link.
async function reopenFromHome(page, name) {
  await page.goto('/');
  await link(page, name).click();
  await expect(cell(page, 'A1')).toBeVisible();
}

// Select a cell, type into the labelled formula bar, commit with Enter.
async function setCell(page, ref, value) {
  await cell(page, ref).click();
  const bar = formulaBar(page);
  await bar.fill(value);
  await bar.press('Enter');
}

async function setCells(page, pairs) {
  for (const [ref, value] of pairs) await setCell(page, ref, value);
}

// Double-click a grid cell, type into the inline editor "Edit <ref>", commit with Enter.
async function editInGrid(page, ref, value) {
  await cell(page, ref).dblclick();
  const editor = page.getByRole('textbox', { name: `Edit ${ref}`, exact: true });
  await editor.fill(value);
  await editor.press('Enter');
  await expect(editor).toBeHidden();
}

async function expectCells(page, expected) {
  for (const [ref, value] of Object.entries(expected)) await expect(cell(page, ref)).toHaveText(value);
}

async function expectFormula(page, ref, value) {
  await cell(page, ref).click();
  await expect(formulaBar(page)).toHaveValue(value);
}

// Drag from one corner cell to the diagonally opposite cell (mouse down on the first cell, move over the grid,
// mouse up on the second; Playwright scrolls each end into view before pressing / releasing).
async function selectRange(page, from, to) {
  if (from === to) {
    await cell(page, from).click();
    return;
  }
  await cell(page, from).dragTo(cell(page, to), { steps: 5 });
}

// Every cell in `inside` is selected, every cell in `outside` is explicitly not selected,
// and nothing else in the grid is selected.
async function expectSelection(page, inside, outside) {
  for (const ref of inside) await expect(cell(page, ref)).toHaveAttribute('aria-selected', 'true');
  for (const ref of outside) await expect(cell(page, ref)).toHaveAttribute('aria-selected', 'false');
  await expect(page.getByRole('gridcell', { selected: true })).toHaveCount(inside.length);
}

async function addWorksheet(page, expectedName) {
  await btn(page, 'Add worksheet').click();
  await expect(tab(page, expectedName)).toHaveAttribute('aria-selected', 'true');
}

async function switchTo(page, name) {
  await tab(page, name).click();
  await expect(tab(page, name)).toHaveAttribute('aria-selected', 'true');
}

async function sheetMenu(page, sheet, command) {
  await btn(page, `Worksheet options for ${sheet}`).click();
  await menuItem(page, command).click();
}

async function renameSheet(page, from, to) {
  await sheetMenu(page, from, 'Rename');
  const dlg = dialog(page, 'Rename worksheet');
  await dlg.getByRole('textbox', { name: 'Worksheet name', exact: true }).fill(to);
  await btn(dlg, 'Save').click();
}

async function dataMenu(page, command) {
  await btn(page, 'Data').click();
  await menuItem(page, command).click();
}

// Named combo box: a native <select> is driven with selectOption, a custom combo box by clicking the option.
async function choose(page, scope, label, option) {
  const combo = scope.getByRole('combobox', { name: label, exact: true });
  if (await combo.evaluate((el) => el.tagName === 'SELECT')) {
    await combo.selectOption({ label: option });
  } else {
    await combo.click();
    await page.getByRole('option', { name: option, exact: true }).click();
  }
}

async function addNumberRule(page, from, to, min, max) {
  await selectRange(page, from, to);
  await dataMenu(page, 'Data validation');
  const dlg = dialog(page, 'Data validation');
  await choose(page, dlg, 'Rule type', 'Number range');
  await dlg.getByRole('textbox', { name: 'Minimum', exact: true }).fill(String(min));
  await dlg.getByRole('textbox', { name: 'Maximum', exact: true }).fill(String(max));
  await btn(dlg, 'Save').click();
  await expect(dlg).toBeHidden();
}

async function addDropdownRule(page, from, to, allowed) {
  await selectRange(page, from, to);
  await dataMenu(page, 'Data validation');
  const dlg = dialog(page, 'Data validation');
  await choose(page, dlg, 'Rule type', 'Dropdown');
  await dlg.getByRole('textbox', { name: 'Allowed values', exact: true }).fill(allowed);
  await btn(dlg, 'Save').click();
  await expect(dlg).toBeHidden();
}

// Select the source range, create the pivot on a new worksheet (Pivot1) and apply the field layout.
async function createPivot(page, from, to, fields) {
  await selectRange(page, from, to);
  await dataMenu(page, 'Create pivot table');
  const dlg = dialog(page, 'Create pivot table');
  await expect(dlg.getByText(`Source range: ${from}:${to}`, { exact: true })).toBeVisible();
  await dlg.getByRole('radio', { name: 'New worksheet', exact: true }).check();
  await btn(dlg, 'Create').click();
  await expect(dlg).toBeHidden();
  await tab(page, 'Pivot1').click();
  const editor = page.getByRole('region', { name: 'Pivot table editor', exact: true });
  await choose(page, editor, 'Rows', fields.rows);
  if (fields.columns) await choose(page, editor, 'Columns', fields.columns);
  await choose(page, editor, 'Values', fields.values);
  await choose(page, editor, 'Summarize by', fields.summarize);
  await btn(editor, 'Apply').click();
}

// External clipboard content, as a test would provide it.
async function putOnClipboard(page, text) {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
}

// Ctrl+V as the Linux runner sends it. On macOS Chromium, Control+V is not bound to the paste command and pages
// often expect the Meta key there, so when no page handler consumed Control+V we also press Meta+V, which Playwright
// maps to the native paste command: the page then gets the same real paste it would get from Control+V on Linux.
async function pressCtrlV(page) {
  if (process.platform !== 'darwin') {
    await page.keyboard.press('Control+V');
    return;
  }
  await page.evaluate(() => {
    window.__oracleCtrlV = 'unseen';
    window.__oracleCtrlVListener = (e) => {
      if (e.ctrlKey && e.code === 'KeyV') window.__oracleCtrlV = e.defaultPrevented ? 'prevented' : 'open';
    };
    window.addEventListener('keydown', window.__oracleCtrlVListener);
  });
  await page.keyboard.press('Control+V');
  const seen = await page.evaluate(() => {
    window.removeEventListener('keydown', window.__oracleCtrlVListener);
    return window.__oracleCtrlV;
  });
  if (seen === 'open') await page.keyboard.press('Meta+V');
}

// Home page -> "Import CSV" dialog -> "CSV file" -> "Confirm import".
async function importCsv(page, fileName, content) {
  await page.goto('/');
  await btn(page, 'Import CSV').click();
  const dlg = dialog(page, 'Import CSV');
  await expect(dlg).toBeVisible();
  await dlg.getByLabel('CSV file', { exact: true }).setInputFiles({
    name: fileName,
    mimeType: 'text/csv',
    buffer: Buffer.from(content, 'utf8'),
  });
  await btn(dlg, 'Confirm import').click();
}

// RFC 4180 reader: accepts CRLF or LF row ends, quoted fields, doubled quotes; a final row end adds no row.
function parseCsv(input) {
  const text = input.replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') quoted = false; else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; } else if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.map((r) => r.map((v) => v.replace(/\r\n/g, '\n')));
}

// Toolbar "Export CSV": a browser download whose suggested name ends with .csv; returns the parsed rows.
async function exportCsv(page) {
  const downloading = page.waitForEvent('download');
  await btn(page, 'Export CSV').click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
  return parseCsv(fs.readFileSync(await download.path(), 'utf8'));
}
// ---------------------------------------------------------------------------

// REQ-2-2-1 Insert and Delete Rows (row-number menu opened by right-clicking the row header)

async function rowMenu(page, row, command) {
  await page.getByRole('rowheader', { name: String(row), exact: true }).click({ button: 'right' });
  await menuItem(page, command).click();
}

const SALES_ROWS = [
  ['A1', 'Region'], ['B1', 'Sales'],
  ['A2', 'East'], ['B2', '1200'],
  ['A3', 'North'], ['B3', '800'],
];

test('REQ-2-2-1 S1: 在第 3 行上方插入空白行，整行数据下移且刷新后保持', async ({ page }) => {
  await createWorkbook(page);
  await setCells(page, SALES_ROWS);
  await expect(cell(page, 'B3')).toHaveText('800');

  await rowMenu(page, 3, 'Insert 1 row above');
  const expected = { A1: 'Region', B1: 'Sales', A2: 'East', B2: '1200', A3: '', B3: '', A4: 'North', B4: '800', A5: '' };
  await expectCells(page, expected);
  await page.reload();
  await expectCells(page, expected);
});

test('REQ-2-2-1 S2: 删除第 3 行后后续数据上移，重新打开后顺序保持', async ({ page }) => {
  const name = `Rows ${uniq()}`;
  await createWorkbook(page, name);
  await setCells(page, [['A1', 'Name'], ['A2', 'Alpha'], ['A3', 'Remove me'], ['A4', 'Beta'], ['B4', '20']]);
  await expect(cell(page, 'B4')).toHaveText('20');

  await rowMenu(page, 3, 'Delete row');
  const expected = { A1: 'Name', A2: 'Alpha', A3: 'Beta', B3: '20', A4: '', B4: '' };
  await expectCells(page, expected);
  await expect(page.getByRole('gridcell').filter({ hasText: 'Remove me' })).toHaveCount(0);

  await reopenFromHome(page, name);
  await expectCells(page, expected);
  await expect(page.getByRole('gridcell').filter({ hasText: 'Remove me' })).toHaveCount(0);
});

test('REQ-2-2-1 S3: 在目标行下方插入空白行并保持其他数据', async ({ page }) => {
  await createWorkbook(page);
  await setCells(page, SALES_ROWS);
  await expect(cell(page, 'B3')).toHaveText('800');

  await rowMenu(page, 2, 'Insert 1 row below');
  const expected = { A1: 'Region', B1: 'Sales', A2: 'East', B2: '1200', A3: '', B3: '', A4: 'North', B4: '800', A5: '' };
  await expectCells(page, expected);
  await page.reload();
  await expectCells(page, expected);
});

test('REQ-2-2-1 S4: 插入行后调整公式引用并保持计算结果', async ({ page }) => {
  await createWorkbook(page);
  await setCells(page, [['A1', 'Qty'], ['A2', '10'], ['A3', '20'], ['A4', '=A2+A3']]);
  await expect(cell(page, 'A4')).toHaveText('30');

  await rowMenu(page, 3, 'Insert 1 row above');
  await expectCells(page, { A2: '10', A3: '', A4: '20', A5: '30' });
  await expectFormula(page, 'A5', '=A2+A4');

  await page.reload();
  await expectCells(page, { A2: '10', A3: '', A4: '20', A5: '30' });
  await expectFormula(page, 'A5', '=A2+A4');
});

test('REQ-2-2-1 S5: 插入行时校验规则随原单元格下移', async ({ page }) => {
  await createWorkbook(page);
  await setCells(page, [['B1', 'Score'], ['B2', '50']]);
  await expect(cell(page, 'B2')).toHaveText('50');
  await addNumberRule(page, 'B2', 'B2', 0, 100);

  await rowMenu(page, 2, 'Insert 1 row above');
  await expectCells(page, { B1: 'Score', B2: '', B3: '50' });

  // The new blank row has no rule; the rule moved to B3 together with its value.
  await setCell(page, 'B2', '101');
  await expect(cell(page, 'B2')).toHaveText('101');
  await setCell(page, 'B3', '101');
  await expect(message(page, 'Please enter a number from 0 to 100')).toBeVisible();
  await expect(cell(page, 'B3')).toHaveText('50');

  await page.reload();
  await expectCells(page, { B1: 'Score', B2: '101', B3: '50' });
});
