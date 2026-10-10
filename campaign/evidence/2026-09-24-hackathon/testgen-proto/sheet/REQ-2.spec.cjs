const { test, expect } = require('@playwright/test');
const f = require('./fixtures.cjs');

function u() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function cell(page, coord) {
  return page.getByRole('gridcell', { name: coord, exact: true });
}

const BLANK = /^\s*$/;

async function createPivotTable(page, start, end, { rows, columns, values, summarizeBy } = {}) {
  await f.selectRange(page, start, end);
  await f.dataCommand(page, 'Create pivot table');
  const dialog = page.getByRole('dialog', { name: 'Create pivot table', exact: true });
  await dialog.getByRole('radio', { name: 'New worksheet', exact: true }).check();
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();
  const region = page.getByRole('region', { name: 'Pivot table editor', exact: true });
  if (rows) await f.chooseOption(region, 'Rows', rows);
  if (columns) await f.chooseOption(region, 'Columns', columns);
  if (values) await f.chooseOption(region, 'Values', values);
  if (summarizeBy) await f.chooseOption(region, 'Summarize by', summarizeBy);
  await region.getByRole('button', { name: 'Apply', exact: true }).click();
}

test('REQ-2-1-1: Add a worksheet and preserve it after refresh', async ({ page }) => {
  await f.createWorkbook(page);
  await f.enterCell(page, 'A1', 'Existing data');
  await f.addWorksheet(page);

  const sheet2 = page.getByRole('tab', { name: 'Sheet2', exact: true });
  await expect(sheet2).toBeVisible();
  await expect(sheet2).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');

  await f.switchToSheet(page, 'Sheet1');
  await expect(cell(page, 'A1')).toHaveText('Existing data');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toBeVisible();
  await f.switchToSheet(page, 'Sheet1');
  await expect(cell(page, 'A1')).toHaveText('Existing data');
});

test('REQ-2-1-2: Keep worksheet data independent when switching', async ({ page }) => {
  await f.createWorkbook(page);
  await f.enterCell(page, 'A1', 'Sheet1 data');
  await f.addWorksheet(page);
  await f.enterCell(page, 'A1', 'Sheet2 data');

  await f.switchToSheet(page, 'Sheet1');
  await expect(cell(page, 'A1')).toHaveText('Sheet1 data');

  await f.switchToSheet(page, 'Sheet2');
  await expect(cell(page, 'A1')).toHaveText('Sheet2 data');

  await f.switchToSheet(page, 'Sheet1');
  await expect(cell(page, 'A1')).toHaveText('Sheet1 data');
});

test('REQ-2-1-2#2: Keep Filter and Validation Entry Points Isolated When Switching', async ({ page }) => {
  await f.createWorkbook(page);
  await f.enterCell(page, 'A1', 'Region');
  await f.enterCell(page, 'A2', 'East');
  await f.createFilter(page, 'A1', 'A2');

  await f.selectRange(page, 'C2', 'C2');
  await f.dataCommand(page, 'Data validation');
  const validationDialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await f.chooseOption(validationDialog, 'Rule type', 'Dropdown');
  await validationDialog.getByLabel('Allowed values', { exact: true }).fill('Open, Closed');
  await validationDialog.getByRole('button', { name: 'Save', exact: true }).click();

  await f.addWorksheet(page);
  await f.enterCell(page, 'A1', 'Sheet2 data');

  await f.switchToSheet(page, 'Sheet1');
  await expect(page.getByRole('button', { name: 'Filter Region', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open dropdown for C2', exact: true })).toBeVisible();
  await expect(cell(page, 'A1')).toHaveText('Region');

  await f.switchToSheet(page, 'Sheet2');
  await expect(cell(page, 'A1')).toHaveText('Sheet2 data');
  await expect(page.getByRole('button', { name: 'Filter Region', exact: true })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Open dropdown for C2', exact: true })).not.toBeVisible();

  await f.switchToSheet(page, 'Sheet1');
  await expect(page.getByRole('button', { name: 'Filter Region', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open dropdown for C2', exact: true })).toBeVisible();

  await f.switchToSheet(page, 'Sheet2');
  await expect(page.getByRole('button', { name: 'Filter Region', exact: true })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Open dropdown for C2', exact: true })).not.toBeVisible();

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Sheet2 data');
  await expect(page.getByRole('button', { name: 'Filter Region', exact: true })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Open dropdown for C2', exact: true })).not.toBeVisible();
});

test('REQ-2-1-3: Save a unique worksheet name', async ({ page }) => {
  await f.createWorkbook(page);
  const newName = 'Custom' + u();

  await page.getByRole('button', { name: 'Worksheet options for Sheet1', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Rename worksheet', exact: true });
  await dialog.getByLabel('Worksheet name', { exact: true }).fill(newName);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByRole('tab', { name: newName, exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('tab', { name: newName, exact: true })).toBeVisible();
});

test('REQ-2-1-3#2: Reject a duplicate name', async ({ page }) => {
  await f.createWorkbook(page);
  await f.addWorksheet(page);

  await page.getByRole('button', { name: 'Worksheet options for Sheet2', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Rename worksheet', exact: true });
  await dialog.getByLabel('Worksheet name', { exact: true }).fill('Sheet1');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText('Worksheet name already exists', { exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveCount(1);

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toBeVisible();
});

test('REQ-2-1-3#3: Reject an empty worksheet name', async ({ page }) => {
  await f.createWorkbook(page);

  await page.getByRole('button', { name: 'Worksheet options for Sheet1', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Rename worksheet', exact: true });
  await dialog.getByLabel('Worksheet name', { exact: true }).fill('   ');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText('Worksheet name cannot be empty', { exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveCount(1);

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
});

test('REQ-2-1-4: Delete one of multiple worksheets', async ({ page }) => {
  await f.createWorkbook(page);
  await f.enterCell(page, 'A1', 'Existing data');
  await f.addWorksheet(page);
  await f.enterCell(page, 'A1', 'Delete me');

  await page.getByRole('button', { name: 'Worksheet options for Sheet2', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete worksheet', exact: true });
  await dialog.getByRole('button', { name: 'Delete worksheet', exact: true }).click();

  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveCount(0);
});

test('REQ-2-1-4#2: Preserve the last worksheet', async ({ page }) => {
  await f.createWorkbook(page);

  await page.getByRole('button', { name: 'Worksheet options for Sheet1', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();

  await expect(page.getByText('A workbook must contain at least one worksheet', { exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
});

test('REQ-2-1-4#3: Reject deletion of a pivot table source worksheet', async ({ page }) => {
  await f.createWorkbook(page);
  await f.enterCell(page, 'A1', 'Region');
  await f.enterCell(page, 'B1', 'Sales');
  await f.enterCell(page, 'A2', 'East');
  await f.enterCell(page, 'B2', '100');
  await f.enterCell(page, 'A3', 'North');
  await f.enterCell(page, 'B3', '200');

  await createPivotTable(page, 'A1', 'B3', { rows: 'Region', values: 'Sales', summarizeBy: 'SUM' });
  await f.switchToSheet(page, 'Sheet1');

  await page.getByRole('button', { name: 'Worksheet options for Sheet1', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete worksheet', exact: true });
  await dialog.getByRole('button', { name: 'Delete worksheet', exact: true }).click();

  await expect(page.getByText('Please delete or rebuild dependent pivot tables first', { exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B3')).toHaveText('200');

  await f.switchToSheet(page, 'Pivot1');
  await expect(cell(page, 'B1')).toHaveText('SUM of Sales');
  await expect(cell(page, 'B2')).toHaveText('100');
  await expect(cell(page, 'B3')).toHaveText('200');
  await expect(cell(page, 'B4')).toHaveText('300');
});

test('REQ-2-2-1: Insert a row into existing data', async ({ page }) => {
  await f.createWorkbook(page);
  await f.enterCell(page, 'A1', 'Item');
  await f.enterCell(page, 'B1', 'Amount');
  await f.enterCell(page, 'A2', 'Alpha');
  await f.enterCell(page, 'B2', '10');
  await f.enterCell(page, 'A3', 'Beta');
  await f.enterCell(page, 'B3', '20');

  await f.insertRowAbove(page, 3);

  await expect(cell(page, 'A3')).toHaveText(BLANK);
  await expect(cell(page, 'B3')).toHaveText(BLANK);
  await expect(cell(page, 'A4')).toHaveText('Beta');
  await expect(cell(page, 'B4')).toHaveText('20');
  await expect(cell(page, 'A2')).toHaveText('Alpha');
  await expect(cell(page, 'B2')).toHaveText('10');

  await page.reload();
  await expect(cell(page, 'A3')).toHaveText(BLANK);
  await expect(cell(page, 'A4')).toHaveText('Beta');
  await expect(cell(page, 'B4')).toHaveText('20');
});

test('REQ-2-2-1#2: Delete a row and reopen', async ({ page }) => {
  await f.createWorkbook(page);
  await f.enterCell(page, 'A2', 'Alpha');
  await f.enterCell(page, 'A3', 'Remove me');
  await f.enterCell(page, 'A4', 'Beta');

  await f.deleteRow(page, 3);

  await expect(cell(page, 'A3')).toHaveText('Beta');
  await expect(cell(page, 'A4')).toHaveText(BLANK);

  await page.reload();
  await expect(cell(page, 'A3')).toHaveText('Beta');
  await expect(cell(page, 'A4')).toHaveText(BLANK);
});

test('REQ-2-2-2: Insert a column beside existing data', async ({ page }) => {
  await f.createWorkbook(page);
  await f.enterCell(page, 'A1', 'Alpha');
  await f.enterCell(page, 'B1', 'Beta');
  await f.enterCell(page, 'C1', 'Gamma');

  await f.insertColumnLeft(page, 'B');

  await expect(cell(page, 'A1')).toHaveText('Alpha');
  await expect(cell(page, 'B1')).toHaveText(BLANK);
  await expect(cell(page, 'C1')).toHaveText('Beta');
  await expect(cell(page, 'D1')).toHaveText('Gamma');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('Alpha');
  await expect(cell(page, 'B1')).toHaveText(BLANK);
  await expect(cell(page, 'C1')).toHaveText('Beta');
  await expect(cell(page, 'D1')).toHaveText('Gamma');
});

test('REQ-2-2-2#2: Delete a column referenced by a formula', async ({ page }) => {
  await f.createWorkbook(page);
  await f.enterCell(page, 'A1', 'Unit price');
  await f.enterCell(page, 'B1', 'Quantity');
  await f.enterCell(page, 'C1', 'Total');
  await f.enterCell(page, 'A2', '10');
  await f.enterCell(page, 'B2', '2');
  await f.enterCell(page, 'C2', '=A2*B2');

  await expect(cell(page, 'C2')).toHaveText('20');

  await f.deleteColumn(page, 'B');

  await expect(cell(page, 'A1')).toHaveText('Unit price');
  await expect(cell(page, 'A2')).toHaveText('10');
  await expect(cell(page, 'B1')).toHaveText('Total');
  await expect(cell(page, 'B2')).toHaveText('#REF!');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('Unit price');
  await expect(cell(page, 'A2')).toHaveText('10');
  await expect(cell(page, 'B1')).toHaveText('Total');
  await expect(cell(page, 'B2')).toHaveText('#REF!');
});
