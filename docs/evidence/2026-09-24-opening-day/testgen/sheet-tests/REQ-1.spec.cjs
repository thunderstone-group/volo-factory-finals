const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const os = require('os');
const f = require('./fixtures.cjs');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const cell = (page, coord) => page.getByRole('gridcell', { name: coord, exact: true });

test('REQ-1-1-1: Open a workbook', async ({ page }) => {
  const wbName = `wb${u()}`;
  await f.createWorkbook(page, { name: wbName });
  await f.enterCell(page, 'A1', 'Saved value');
  await page.goto('/');

  const link = page.getByRole('link', { name: wbName, exact: true });
  await expect(link).toBeVisible();
  const lastUpdated = (await page.getByText(/Last updated:/).first().innerText()).trim();

  await link.click();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Saved value');
  await expect(page.getByText(lastUpdated).last()).toBeVisible();
  await expect(page.getByText(wbName).last()).toBeVisible();

  const editorUrl = page.url();
  await page.reload();
  expect(page.url()).toBe(editorUrl);
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(cell(page, 'A1')).toHaveText('Saved value');
  await expect(page.getByText(wbName).last()).toBeVisible();
});

test('REQ-1-2-1: Create and reopen a blank workbook', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();

  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');

  await page.goto('/');
  await expect(page.getByText(/Last updated:/).first()).toBeVisible();
});

test('REQ-1-2-2: Save a valid new name', async ({ page }) => {
  const originalName = `orig${u()}`;
  const newName = `ren${u()}`;

  await f.createWorkbook(page, { name: originalName });
  await f.enterCell(page, 'A1', 'Existing data');
  await f.renameWorkbook(page, newName);

  await expect(page.getByRole('textbox', { name: 'Workbook name', exact: true })).toBeHidden();
  await expect(page.getByText(newName).last()).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('link', { name: newName, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: originalName, exact: true })).toHaveCount(0);

  await page.getByRole('link', { name: newName, exact: true }).click();
  await expect(page.getByText(newName).last()).toBeVisible();
  await expect(cell(page, 'A1')).toHaveText('Existing data');
});

test('REQ-1-2-2#2: Reject an empty name', async ({ page }) => {
  const originalName = `keep${u()}`;

  await f.createWorkbook(page, { name: originalName });
  await page.getByRole('button', { name: 'Rename workbook', exact: true }).click();

  const input = page.getByRole('textbox', { name: 'Workbook name', exact: true });
  await expect(input).toHaveValue(originalName);
  await input.fill('   ');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText('Workbook name cannot be empty')).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('link', { name: originalName, exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('link', { name: originalName, exact: true })).toBeVisible();
});

test('REQ-1-3-1: Import a valid CSV', async ({ page }) => {
  const fileName = `imp${u()}.csv`;
  const workbookName = fileName.replace(/\.csv$/, '');
  const csv = [
    'East,中文,123',
    ',"contains,comma","line1\nline2"',
    '"say ""hi""",,7',
  ].join('\n');

  await page.goto('/');
  await f.importCsv(page, { content: csv, fileName });

  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');

  await expect(cell(page, 'A1')).toHaveText('East');
  await expect(cell(page, 'B1')).toHaveText('中文');
  await expect(cell(page, 'C1')).toHaveText('123');
  await expect(cell(page, 'A2')).toHaveText('');
  await expect(cell(page, 'B2')).toHaveText('contains,comma');
  await expect(cell(page, 'C2')).toHaveText('line1\nline2');
  await expect(cell(page, 'A3')).toHaveText('say "hi"');
  await expect(cell(page, 'B3')).toHaveText('');
  await expect(cell(page, 'C3')).toHaveText('7');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('contains,comma');
  await expect(cell(page, 'C2')).toHaveText('line1\nline2');

  await page.goto('/');
  await expect(page.getByRole('link', { name: workbookName, exact: true })).toBeVisible();
});

test('REQ-1-3-1#2: Reject an unparseable CSV', async ({ page }) => {
  const fileName = `bad${u()}.csv`;
  const workbookName = fileName.replace(/\.csv$/, '');

  await page.goto('/');
  await f.importCsv(page, { content: '"unclosed,value', fileName, waitForGrid: false });

  await expect(page.getByText('Invalid CSV file format. Import failed.')).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('link', { name: workbookName, exact: true })).toHaveCount(0);
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toHaveCount(0);
});

test('REQ-1-3-2: Export a worksheet containing formulas', async ({ page }) => {
  const baseName = `exp${u()}`;
  const fileName = `${baseName}.csv`;
  const csv = [
    'Region,Description,Quantity,Empty column,Formula result',
    'East China,"contains,comma",2,,0',
    'North China,"中文 ""引号""\n第二行",3,,0',
  ].join('\n');

  await page.goto('/');
  await f.importCsv(page, { content: csv, fileName });
  await f.enterCell(page, 'E2', '=C2*2');
  await f.enterCell(page, 'E3', '=C3+2');

  await expect(cell(page, 'E2')).toHaveText('4');
  await expect(cell(page, 'E3')).toHaveText('5');

  await cell(page, 'E2').click();
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=C2*2');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.csv$/);

  const dest = path.join(os.tmpdir(), `${u()}.csv`);
  await download.saveAs(dest);
  const csvText = fs.readFileSync(dest, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');

  expect(csvText).toContain('Region,Description,Quantity,Empty column,Formula result');
  expect(csvText).toContain('East China,"contains,comma",2,,4');
  expect(csvText).toContain('North China,"中文 ""引号""\n第二行",3,,5');

  await page.goto('/');
  await expect(page.getByRole('link', { name: baseName, exact: true })).toBeVisible();
  await page.getByRole('link', { name: baseName, exact: true }).click();

  await expect(cell(page, 'E2')).toHaveText('4');
  await expect(cell(page, 'E3')).toHaveText('5');
  await expect(cell(page, 'B3')).toContainText('第二行');
});
