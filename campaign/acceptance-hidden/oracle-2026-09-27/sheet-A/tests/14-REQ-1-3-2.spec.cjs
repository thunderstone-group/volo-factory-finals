// Generated from src/prelude.cjs + src/14-REQ-1-3-2.body.cjs by build.sh
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

// REQ-1-3-2 Export the Current Worksheet as CSV

test('REQ-1-3-2 S1: 导出活动工作表的计算结果与特殊文本，且刷新后原数据不变', async ({ page }) => {
  const name = `export-source-${uniq()}`;
  const csv = 'Region,Description,Quantity,Empty column,Formula result\n'
    + 'East China,"contains,comma",2,,\n'
    + 'North China,"华北""报价""\n第二行",3,,\n';
  await importCsv(page, `${name}.csv`, csv);
  await expect(cell(page, 'A2')).toHaveText('East China');
  await setCell(page, 'E2', '=C2*2');
  await setCell(page, 'E3', '=C3+2');
  await expectCells(page, { E2: '4', E3: '5' });
  await expectFormula(page, 'E2', '=C2*2');

  const rows = await exportCsv(page);
  expect(rows).toEqual([
    ['Region', 'Description', 'Quantity', 'Empty column', 'Formula result'],
    ['East China', 'contains,comma', '2', '', '4'],
    ['North China', '华北"报价"\n第二行', '3', '', '5'],
  ]);

  // Export changes nothing: active sheet, grid values and formula bar stay as they were.
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(formulaBar(page)).toHaveValue('=C2*2');
  await expectCells(page, { B2: 'contains,comma', E2: '4', E3: '5' });

  await page.reload();
  await expectCells(page, { A2: 'East China', B2: 'contains,comma', C2: '2', E2: '4', E3: '5' });
  await expect(cell(page, 'B3')).toHaveText('华北"报价" 第二行', { useInnerText: true });
  await expectFormula(page, 'E2', '=C2*2');
});

test('REQ-1-3-2 S2: 导出公式结果不会改写原公式或活动工作表', async ({ page }) => {
  await createWorkbook(page);
  await setCells(page, [['A1', '2'], ['B1', '3'], ['C1', '=A1+B1'], ['D1', '=C1*2']]);
  await expectCells(page, { C1: '5', D1: '10' });
  await expectFormula(page, 'C1', '=A1+B1');

  expect(await exportCsv(page)).toEqual([['2', '3', '5', '10']]);

  await expect(formulaBar(page)).toHaveValue('=A1+B1');
  await expectCells(page, { A1: '2', B1: '3', C1: '5', D1: '10' });
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');

  await page.reload();
  await expectCells(page, { C1: '5', D1: '10' });
  await expectFormula(page, 'C1', '=A1+B1');
  await expectFormula(page, 'D1', '=C1*2');
});

test('REQ-1-3-2 S3: 导出当前活动的第二个工作表内容', async ({ page }) => {
  await createWorkbook(page);
  await setCell(page, 'A1', 'Sheet1 only');
  await expect(cell(page, 'A1')).toHaveText('Sheet1 only');
  await addWorksheet(page, 'Sheet2');
  await setCells(page, [['A1', 'Item'], ['B1', 'Qty'], ['A2', 'Pen'], ['B2', '4']]);
  await expectCells(page, { A1: 'Item', B2: '4' });

  expect(await exportCsv(page)).toEqual([['Item', 'Qty'], ['Pen', '4']]);

  await expect(tab(page, 'Sheet2')).toHaveAttribute('aria-selected', 'true');
  await expectCells(page, { A1: 'Item', A2: 'Pen' });
  await page.reload();
  await expect(tab(page, 'Sheet2')).toHaveAttribute('aria-selected', 'true');
  await expectCells(page, { A1: 'Item', A2: 'Pen' });
});

test('REQ-1-3-2 S4: 切回 Sheet1 后导出仍只包含当前工作表内容', async ({ page }) => {
  await createWorkbook(page);
  await setCells(page, [['A1', 'Region'], ['B1', 'Sales'], ['A2', 'East'], ['B2', '1200'], ['A3', 'North'], ['B3', '800']]);
  await expect(cell(page, 'B3')).toHaveText('800');
  await addWorksheet(page, 'Sheet2');
  await setCells(page, [['A1', 'Item'], ['B1', 'Qty'], ['A2', 'Pen'], ['B2', '4'], ['C3', 'Extra']]);
  await expect(cell(page, 'C3')).toHaveText('Extra');

  await switchTo(page, 'Sheet1');
  await expect(cell(page, 'A2')).toHaveText('East');
  expect(await exportCsv(page)).toEqual([['Region', 'Sales'], ['East', '1200'], ['North', '800']]);

  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await page.reload();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expectCells(page, { A1: 'Region', A2: 'East', B3: '800' });
});
