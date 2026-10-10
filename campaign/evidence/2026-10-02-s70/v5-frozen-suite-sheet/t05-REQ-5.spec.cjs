const { test, expect } = require('@playwright/test');
const fs = require('fs');

/* ------------------------------------------------------------------ *
 * Shared seed data used by the scenarios of REQ-5.
 * The seeded worksheet range is `A1:C6` with headers `Region/Sales/Status`
 * and rows `East/1200/Open`, `North/800/Closed`, `South/700/Open`.
 * ------------------------------------------------------------------ */

const SHEET = [
  'Region\tSales\tStatus',
  'East\t1200\tOpen',
  'North\t800\tClosed',
  'South\t700\tOpen',
].join('\n');

const SHEET_DATED = [
  'Region\tSales\tStatus\tDate',
  'East\t1200\tOpen\t2024-03-02',
  'North\t800\tClosed\t2024-01-15',
  'South\t700\tOpen\t2024-02-20',
].join('\n');

const SHEET_NOTES = [
  'Region\tSales\tStatus\tNotes',
  'East\t1200\tOpen\tok',
  'North\t800\tClosed\t',
  'South\t700\tOpen\tok',
].join('\n');

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

async function openQ3Sales(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Q3 Sales', exact: true }).click();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
}

function cell(page, coord) {
  return page.getByRole('gridcell', { name: coord, exact: true });
}

async function pasteBlock(page, coord, text) {
  await cell(page, coord).click();
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
  await page.keyboard.press('Control+V');
}

async function setCell(page, coord, value) {
  await cell(page, coord).click();
  const bar = page.getByLabel('Formula bar', { exact: true });
  await bar.fill(value);
  await bar.press('Enter');
}

async function selectRange(page, from, to) {
  await cell(page, from).hover();
  await page.mouse.down();
  await cell(page, to).hover();
  await page.mouse.up();
}

async function openDataMenu(page) {
  await page.getByRole('button', { name: 'Data', exact: true }).click();
}

async function pickOption(page, name) {
  const option = page.getByRole('option', { name, exact: true });
  await option.click();
}

async function sortRange(page, { by, order, header }) {
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: 'Sort range', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Sort range', exact: true });
  await expect(dialog).toBeVisible();
  const headerBox = dialog.getByLabel('Data has header row', { exact: true });
  if (header) {
    await headerBox.check();
  } else {
    await headerBox.uncheck();
  }
  await dialog.getByRole('combobox', { name: 'Sort by', exact: true }).click();
  await pickOption(page, by);
  await dialog.getByRole('combobox', { name: 'Order', exact: true }).click();
  await pickOption(page, order);
  await dialog.getByRole('button', { name: 'Sort', exact: true }).click();
}

async function createFilter(page) {
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: 'Create filter', exact: true }).click();
}

async function clearFilter(page) {
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: 'Clear filter', exact: true }).click();
}

async function filterDialog(page, header) {
  await page.getByRole('button', { name: `Filter ${header}`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: `Filter ${header}`, exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function applyCondition(page, header, condition, value) {
  const dialog = await filterDialog(page, header);
  await dialog.getByRole('combobox', { name: 'Condition', exact: true }).click();
  await pickOption(page, condition);
  if (value !== undefined) {
    await dialog.getByLabel('Value', { exact: true }).fill(value);
  }
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
}

async function openValidationDialog(page) {
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: 'Data validation', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function saveDropdownRule(page, from, to, allowed) {
  await selectRange(page, from, to);
  const dialog = await openValidationDialog(page);
  await dialog.getByRole('combobox', { name: 'Rule type', exact: true }).click();
  await pickOption(page, 'Dropdown');
  await dialog.getByLabel('Allowed values', { exact: true }).fill(allowed);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
}

async function saveNumberRule(page, from, to, min, max) {
  await selectRange(page, from, to);
  const dialog = await openValidationDialog(page);
  await dialog.getByRole('combobox', { name: 'Rule type', exact: true }).click();
  await pickOption(page, 'Number range');
  await dialog.getByLabel('Minimum', { exact: true }).fill(String(min));
  await dialog.getByLabel('Maximum', { exact: true }).fill(String(max));
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
}

async function createPivot(page, from, to, range) {
  await selectRange(page, from, to);
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: 'Create pivot table', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create pivot table', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(`Source range: ${range}`, { exact: true })).toBeVisible();
  await dialog.getByRole('radio', { name: 'New worksheet', exact: true }).check();
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();
}

function pivotEditor(page) {
  return page.getByRole('region', { name: 'Pivot table editor', exact: true });
}

async function configurePivot(page, fields) {
  const editor = pivotEditor(page);
  await expect(editor).toBeVisible();
  for (const label of ['Rows', 'Columns', 'Values', 'Summarize by']) {
    const value = fields[label];
    if (value !== undefined) {
      await editor.getByRole('combobox', { name: label, exact: true }).click();
      await pickOption(page, value);
    }
  }
  await editor.getByRole('button', { name: 'Apply', exact: true }).click();
}

/* ================================================================== *
 * REQ-5-1-1  Sort a Data Range by a Specified Column
 * ================================================================== */

test('REQ-5-1-1: REQ-5-1-1 -the requested workflow Sales the requested workflow,the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await pasteBlock(page, 'A1', SHEET);

  await selectRange(page, 'A1', 'C4');
  await sortRange(page, { by: 'Sales', order: 'Ascending', header: true });

  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('Sales');
  await expect(cell(page, 'C1')).toHaveText('Status');
  await expect(cell(page, 'A2')).toHaveText('South');
  await expect(cell(page, 'B2')).toHaveText('700');
  await expect(cell(page, 'C2')).toHaveText('Open');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'B3')).toHaveText('800');
  await expect(cell(page, 'A4')).toHaveText('East');
  await expect(cell(page, 'B4')).toHaveText('1200');

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('South');
  await expect(cell(page, 'B2')).toHaveText('700');
  await expect(cell(page, 'A4')).toHaveText('East');
  await expect(cell(page, 'B4')).toHaveText('1200');
});

test('REQ-5-1-1#2: REQ-5-1-1 -the requested workflow ISO the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await pasteBlock(page, 'A1', SHEET_DATED);

  await selectRange(page, 'A1', 'D4');
  await sortRange(page, { by: 'Date', order: 'Ascending', header: true });

  await expect(cell(page, 'A2')).toHaveText('North');
  await expect(cell(page, 'D2')).toHaveText('2024-01-15');
  await expect(cell(page, 'A3')).toHaveText('South');
  await expect(cell(page, 'D3')).toHaveText('2024-02-20');
  await expect(cell(page, 'A4')).toHaveText('East');
  await expect(cell(page, 'D4')).toHaveText('2024-03-02');

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('North');
  await expect(cell(page, 'D2')).toHaveText('2024-01-15');
  await expect(cell(page, 'D4')).toHaveText('2024-03-02');
});

test('REQ-5-1-1#3: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await pasteBlock(page, 'A1', SHEET);

  await selectRange(page, 'A1', 'C4');
  await sortRange(page, { by: 'Sales', order: 'Descending', header: true });

  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'B3')).toHaveText('800');
  await expect(cell(page, 'A4')).toHaveText('South');
  await expect(cell(page, 'B4')).toHaveText('700');

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'A4')).toHaveText('South');
});

test('REQ-5-1-1#4: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await pasteBlock(page, 'A1', SHEET);

  await selectRange(page, 'A1', 'C4');
  await sortRange(page, { by: 'Region', order: 'Ascending', header: false });

  // the first row was not declared a header, so it takes part in the sorting
  await expect(cell(page, 'A1')).toHaveText('East');
  await expect(cell(page, 'B1')).toHaveText('1200');
  await expect(cell(page, 'A2')).toHaveText('North');
  await expect(cell(page, 'B2')).toHaveText('800');
  await expect(cell(page, 'A3')).toHaveText('Region');
  await expect(cell(page, 'B3')).toHaveText('Sales');
  await expect(cell(page, 'A4')).toHaveText('South');
  await expect(cell(page, 'B4')).toHaveText('700');

  await page.reload();
  await expect(cell(page, 'A3')).toHaveText('Region');
  await expect(cell(page, 'A4')).toHaveText('South');
});

test('REQ-5-1-1#5: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await pasteBlock(page, 'A1', [
    'Region\tSales\tStatus',
    'East\t1200\tOpen',
    'North\t800\tClosed',
    'South\t700\tOpen',
    'West\t800\tOpen',
  ].join('\n'));

  await selectRange(page, 'A1', 'C5');
  await sortRange(page, { by: 'Sales', order: 'Ascending', header: true });

  // equal sort keys (800) keep their original relative order: North before West
  await expect(cell(page, 'A2')).toHaveText('South');
  await expect(cell(page, 'B2')).toHaveText('700');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'B3')).toHaveText('800');
  await expect(cell(page, 'A4')).toHaveText('West');
  await expect(cell(page, 'B4')).toHaveText('800');
  await expect(cell(page, 'A5')).toHaveText('East');
  await expect(cell(page, 'B5')).toHaveText('1200');

  await page.reload();
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'A4')).toHaveText('West');
});

test('REQ-5-1-1#6: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await pasteBlock(page, 'A1', SHEET);
  await setCell(page, 'G1', 'Keep');

  await selectRange(page, 'A1', 'C4');
  await sortRange(page, { by: 'Sales', order: 'Descending', header: true });

  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1200');
  // data outside the selection remains unchanged
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'G1')).toHaveText('Keep');

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'A4')).toHaveText('South');
  await expect(cell(page, 'G1')).toHaveText('Keep');
});

/* ================================================================== *
 * REQ-5-1-2  Filter Rows by Value or Condition
 * ================================================================== */

test('REQ-5-1-2: REQ-5-1-2 -the requested workflow Region the requested workflow Sales the requested workflow,the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await pasteBlock(page, 'A1', SHEET);

  await selectRange(page, 'A1', 'C4');
  await createFilter(page);

  const dialog = await filterDialog(page, 'Region');
  await dialog.getByRole('checkbox', { name: 'North', exact: true }).uncheck();
  await dialog.getByRole('checkbox', { name: 'South', exact: true }).uncheck();
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();

  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'A3')).toBeHidden();
  await expect(cell(page, 'A4')).toBeHidden();

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'A3')).toBeHidden();
  await expect(cell(page, 'A4')).toBeHidden();

  await clearFilter(page);
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'A4')).toHaveText('South');
});

test('REQ-5-1-2#2: REQ-5-1-2 -the requested workflow, the requested workflow,the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await pasteBlock(page, 'A1', SHEET);

  await selectRange(page, 'A1', 'C4');
  await createFilter(page);
  await applyCondition(page, 'Status', 'Text contains', 'Open');

  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'A4')).toHaveText('South');
  await expect(cell(page, 'A3')).toBeHidden();

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'A3')).toBeHidden();

  await clearFilter(page);
  await expect(cell(page, 'A3')).toHaveText('North');
});

test('REQ-5-1-2#3: REQ-5-1-2 -CSV the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await pasteBlock(page, 'A1', SHEET);

  await selectRange(page, 'A1', 'C4');
  await createFilter(page);
  await applyCondition(page, 'Sales', 'Greater than', '1000');

  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'A3')).toBeHidden();
  await expect(cell(page, 'A4')).toBeHidden();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export CSV', exact: true }).click(),
  ]);
  expect(download.suggestedFilename().endsWith('.csv')).toBe(true);
  const csv = fs.readFileSync(await download.path(), 'utf8');
  // the export still includes the hidden rows of the filtered range
  expect(csv).toContain('Region');
  expect(csv).toContain('East');
  expect(csv).toContain('1200');
  expect(csv).toContain('North');
  expect(csv).toContain('800');
  expect(csv).toContain('South');
  expect(csv).toContain('700');

  await clearFilter(page);
  await expect(cell(page, 'A3')).toHaveText('North');
});

test('REQ-5-1-2#4: REQ-5-1-2 -the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await pasteBlock(page, 'A1', SHEET_NOTES);

  await selectRange(page, 'A1', 'D4');
  await createFilter(page);
  await applyCondition(page, 'Notes', 'Is empty', undefined);

  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'A2')).toBeHidden();
  await expect(cell(page, 'A4')).toBeHidden();

  await page.reload();
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'A2')).toBeHidden();

  await clearFilter(page);
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'A4')).toHaveText('South');
});

test('REQ-5-1-2#5: REQ-5-1-2 -the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await pasteBlock(page, 'A1', SHEET_NOTES);

  await selectRange(page, 'A1', 'D4');
  await createFilter(page);
  await applyCondition(page, 'Notes', 'Is not empty', undefined);

  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'A4')).toHaveText('South');
  await expect(cell(page, 'A3')).toBeHidden();

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'A3')).toBeHidden();

  // Clear filter restores all source records in their original order
  await clearFilter(page);
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'A4')).toHaveText('South');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'B3')).toHaveText('800');
  await expect(cell(page, 'B4')).toHaveText('700');

  await page.reload();
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'A4')).toHaveText('South');
});

/* ================================================================== *
 * REQ-5-2-1  Set Dropdown or Numeric Validation for a Range
 * ================================================================== */

test('REQ-5-2-1: REQ-5-2-1 -the requested workflow A1:A2 the requested workflow,the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await pasteBlock(page, 'A1', SHEET);

  await saveDropdownRule(page, 'A1', 'A2', ' Region , East , West ');

  const dropdown = page.getByRole('button', { name: 'Open dropdown for A2', exact: true });
  await expect(dropdown).toBeVisible();
  await dropdown.click();
  await expect(page.getByRole('option', { name: 'Region', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'East', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'West', exact: true })).toBeVisible();
  await pickOption(page, 'West');

  await expect(cell(page, 'A2')).toHaveText('West');

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('West');
  await expect(page.getByRole('button', { name: 'Open dropdown for A2', exact: true })).toBeVisible();
});

test('REQ-5-2-1#2: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await pasteBlock(page, 'A1', SHEET);

  await saveDropdownRule(page, 'D1', 'D2', 'East, West');

  await page.getByRole('button', { name: 'Open dropdown for D1', exact: true }).click();
  await pickOption(page, 'East');
  await expect(cell(page, 'D1')).toHaveText('East');

  await setCell(page, 'D1', 'North');
  await expect(page.getByText('Please select one of the following values:', { exact: false })).toBeVisible();
  await expect(cell(page, 'D1')).toHaveText('East');

  await page.reload();
  await expect(cell(page, 'D1')).toHaveText('East');
});

test('REQ-5-2-1#3: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await pasteBlock(page, 'A1', SHEET);

  await saveNumberRule(page, 'B2', 'B4', 0, 100);

  await setCell(page, 'B3', '101');
  await expect(page.getByText('Please enter a number from 0 to 100', { exact: true })).toBeVisible();
  await expect(cell(page, 'B3')).toHaveText('800');

  // the boundary value is accepted (inclusive rule)
  await setCell(page, 'B3', '100');
  await expect(cell(page, 'B3')).toHaveText('100');

  await page.reload();
  await expect(cell(page, 'B3')).toHaveText('100');
});

test('REQ-5-2-1#4: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await pasteBlock(page, 'A1', SHEET);

  await saveNumberRule(page, 'B2', 'B4', 0, 100);

  // one invalid target rejects the whole bulk operation
  await pasteBlock(page, 'B2', ['50', '200', '75'].join('\n'));

  await expect(page.getByText('Please enter a number from 0 to 100', { exact: true })).toBeVisible();
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'B3')).toHaveText('800');
  await expect(cell(page, 'B4')).toHaveText('700');

  await page.reload();
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'B3')).toHaveText('800');
  await expect(cell(page, 'B4')).toHaveText('700');
});

test('REQ-5-2-1#5: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await pasteBlock(page, 'A1', SHEET);
  await saveDropdownRule(page, 'D1', 'D2', 'East, West');

  // reopen the existing rule: it is prefilled and offers "Delete rule"
  await selectRange(page, 'D1', 'D2');
  const dialog = await openValidationDialog(page);
  await expect(dialog.getByLabel('Allowed values', { exact: true })).toHaveValue('East, West');
  await dialog.getByRole('button', { name: 'Delete rule', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Open dropdown for D1', exact: true })).toBeHidden();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Open dropdown for D1', exact: true })).toBeHidden();
});

test('REQ-5-2-1#6: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await pasteBlock(page, 'A1', SHEET);
  await saveDropdownRule(page, 'D1', 'D2', 'East, West');

  // saving a modification makes the new parameters effective immediately
  await selectRange(page, 'D1', 'D2');
  const dialog = await openValidationDialog(page);
  await dialog.getByLabel('Allowed values', { exact: true }).fill('North, South');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();

  await page.getByRole('button', { name: 'Open dropdown for D1', exact: true }).click();
  await expect(page.getByRole('option', { name: 'North', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'South', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'East', exact: true })).toBeHidden();
  await pickOption(page, 'North');
  await expect(cell(page, 'D1')).toHaveText('North');

  await page.reload();
  await expect(cell(page, 'D1')).toHaveText('North');
  await expect(page.getByRole('button', { name: 'Open dropdown for D1', exact: true })).toBeVisible();
});

/* ================================================================== *
 * REQ-5-3-1  Create and Refresh a Basic Pivot Table
 * ================================================================== */

test('REQ-5-3-1: REQ-5-3-1 -the requested workflow Pivot1 the requested workflow Region the requested workflow Sales,the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await pasteBlock(page, 'A1', SHEET);

  await createPivot(page, 'A1', 'C4', 'A1:C4');
  await expect(page.getByRole('tab', { name: 'Pivot1', exact: true })).toHaveAttribute('aria-selected', 'true');

  await configurePivot(page, { Rows: 'Region', Values: 'Sales', 'Summarize by': 'SUM' });

  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('SUM of Sales');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'B3')).toHaveText('800');
  await expect(cell(page, 'A4')).toHaveText('South');
  await expect(cell(page, 'B4')).toHaveText('700');
  await expect(cell(page, 'A5')).toHaveText('Grand Total');
  await expect(cell(page, 'B5')).toHaveText('2700');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('SUM of Sales');
  await expect(cell(page, 'B5')).toHaveText('2700');
});

test('REQ-5-3-1#2: REQ-5-3-1 -the requested workflow,the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await pasteBlock(page, 'A1', SHEET);

  await createPivot(page, 'A1', 'C4', 'A1:C4');
  await configurePivot(page, {
    Rows: 'Region',
    Columns: 'Status',
    Values: 'Sales',
    'Summarize by': 'SUM',
  });

  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('Open');
  await expect(cell(page, 'C1')).toHaveText('Closed');
  await expect(cell(page, 'D1')).toHaveText('Grand Total');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'C3')).toHaveText('800');
  await expect(cell(page, 'A4')).toHaveText('South');
  await expect(cell(page, 'B4')).toHaveText('700');
  await expect(cell(page, 'A5')).toHaveText('Grand Total');
  await expect(cell(page, 'D5')).toHaveText('2700');

  await page.reload();
  await expect(cell(page, 'B1')).toHaveText('Open');
  await expect(cell(page, 'D1')).toHaveText('Grand Total');
  await expect(cell(page, 'D5')).toHaveText('2700');
});

test('REQ-5-3-1#3: REQ-5-3-1 -the requested workflow COUNT the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await pasteBlock(page, 'A1', SHEET);

  await createPivot(page, 'A1', 'C4', 'A1:C4');
  await configurePivot(page, { Rows: 'Region', Values: 'Sales', 'Summarize by': 'COUNT' });

  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('COUNT of Sales');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'B3')).toHaveText('1');
  await expect(cell(page, 'A4')).toHaveText('South');
  await expect(cell(page, 'B4')).toHaveText('1');
  await expect(cell(page, 'A5')).toHaveText('Grand Total');
  await expect(cell(page, 'B5')).toHaveText('3');

  await page.reload();
  await expect(cell(page, 'B1')).toHaveText('COUNT of Sales');
  await expect(cell(page, 'B5')).toHaveText('3');
});

test('REQ-5-3-1#4: REQ-5-3-1 -AVERAGE the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await pasteBlock(page, 'A1', SHEET);

  await createPivot(page, 'A1', 'C4', 'A1:C4');
  await configurePivot(page, { Rows: 'Region', Values: 'Sales', 'Summarize by': 'AVERAGE' });

  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('AVERAGE of Sales');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'B3')).toHaveText('800');
  await expect(cell(page, 'A4')).toHaveText('South');
  await expect(cell(page, 'B4')).toHaveText('700');
  await expect(cell(page, 'A5')).toHaveText('Grand Total');
  await expect(cell(page, 'B5')).toHaveText('900');

  await page.reload();
  await expect(cell(page, 'B1')).toHaveText('AVERAGE of Sales');
  await expect(cell(page, 'B5')).toHaveText('900');
});

test('REQ-5-3-1#5: REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await pasteBlock(page, 'A1', SHEET);

  await createPivot(page, 'A1', 'C4', 'A1:C4');
  await configurePivot(page, { Rows: 'Region', Values: 'Sales', 'Summarize by': 'SUM' });
  await expect(cell(page, 'B2')).toHaveText('1200');

  // change the source data; the old result stays until refresh
  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await setCell(page, 'B2', '2000');
  await page.getByRole('tab', { name: 'Pivot5', exact: true }).click();
  await expect(cell(page, 'B2')).toHaveText('1200');

  await page.getByRole('button', { name: 'Refresh pivot table', exact: true }).click();
  await expect(cell(page, 'B2')).toHaveText('2000');
  await expect(cell(page, 'B5')).toHaveText('3500');

  await page.reload();
  await expect(cell(page, 'B2')).toHaveText('2000');
  await expect(cell(page, 'B5')).toHaveText('3500');
});

test('REQ-5-3-1#6: REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await pasteBlock(page, 'A1', SHEET);

  await createPivot(page, 'A1', 'C4', 'A1:C4');
  await configurePivot(page, { Rows: 'Region', Values: 'Sales', 'Summarize by': 'SUM' });
  await expect(cell(page, 'B2')).toHaveText('1200');

  // delete the source header used by the pivot
  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await page.getByRole('columnheader', { name: 'B', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete column', exact: true }).click();

  await page.getByRole('tab', { name: 'Pivot6', exact: true }).click();
  await page.getByRole('button', { name: 'Refresh pivot table', exact: true }).click();
  await expect(page.getByText('Pivot field is no longer available. Select a new field.', { exact: true })).toBeVisible();
  // the last successful result is preserved
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1200');

  // restore the source worksheet for the following scenarios
  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await page.getByRole('columnheader', { name: 'B', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 column left', exact: true }).click();
  await setCell(page, 'B1', 'Sales');
  await setCell(page, 'B2', '1200');
  await setCell(page, 'B3', '800');
  await setCell(page, 'B4', '700');
  await expect(cell(page, 'B1')).toHaveText('Sales');
  await expect(cell(page, 'B2')).toHaveText('1200');
});

test('REQ-5-3-1#7: REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await pasteBlock(page, 'A1', SHEET);

  await createPivot(page, 'A1', 'C4', 'A1:C4');
  await configurePivot(page, { Rows: 'Region', Values: 'Sales', 'Summarize by': 'SUM' });
  await expect(cell(page, 'B1')).toHaveText('SUM of Sales');
  await expect(cell(page, 'B2')).toHaveText('1200');

  // SUM over a value field with no parseable numbers
  const editor = pivotEditor(page);
  await editor.getByRole('combobox', { name: 'Values', exact: true }).click();
  await pickOption(page, 'Status');
  await editor.getByRole('button', { name: 'Apply', exact: true }).click();

  await expect(page.getByText('Value field requires numeric values', { exact: true })).toBeVisible();
  // the old result is preserved
  await expect(cell(page, 'B1')).toHaveText('SUM of Sales');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'B5')).toHaveText('2700');
});

test('REQ-5-3-1#8: REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await pasteBlock(page, 'A1', SHEET);

  await createPivot(page, 'A1', 'C4', 'A1:C4');
  // COUNT does not fail because of nonnumeric content
  await configurePivot(page, { Rows: 'Region', Values: 'Status', 'Summarize by': 'COUNT' });

  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('COUNT of Status');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'B3')).toHaveText('1');
  await expect(cell(page, 'A4')).toHaveText('South');
  await expect(cell(page, 'B4')).toHaveText('1');
  await expect(cell(page, 'A5')).toHaveText('Grand Total');
  await expect(cell(page, 'B5')).toHaveText('3');

  await page.reload();
  await expect(cell(page, 'B1')).toHaveText('COUNT of Status');
  await expect(cell(page, 'B5')).toHaveText('3');
});

test('REQ-5-3-1#9: REQ-5-3-1 -the requested workflow COUNT the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await pasteBlock(page, 'A1', SHEET);

  await createPivot(page, 'A1', 'C4', 'A1:C4');
  await configurePivot(page, {
    Rows: 'Region',
    Columns: 'Status',
    Values: 'Sales',
    'Summarize by': 'COUNT',
  });

  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('Open');
  await expect(cell(page, 'C1')).toHaveText('Closed');
  await expect(cell(page, 'D1')).toHaveText('Grand Total');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1');
  // no record with a non-empty value field for this combination
  await expect(cell(page, 'C2')).toHaveText('0');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'B3')).toHaveText('0');
  await expect(cell(page, 'C3')).toHaveText('1');
  await expect(cell(page, 'A4')).toHaveText('South');
  await expect(cell(page, 'B4')).toHaveText('1');
  await expect(cell(page, 'A5')).toHaveText('Grand Total');
  await expect(cell(page, 'D5')).toHaveText('3');

  await page.reload();
  await expect(cell(page, 'B1')).toHaveText('Open');
  await expect(cell(page, 'C2')).toHaveText('0');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

