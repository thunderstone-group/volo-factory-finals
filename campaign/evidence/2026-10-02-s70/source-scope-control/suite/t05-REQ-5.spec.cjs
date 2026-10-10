const { test, expect } = require('@playwright/test');
const fs = require('fs');

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const grid = (page) => page.getByRole('grid', { name: 'Worksheet grid' });
const cell = (page, coord) => grid(page).getByRole('gridcell', { name: coord, exact: true });
const formulaBar = (page) => page.getByRole('textbox', { name: 'Formula bar', exact: true });
const errorText = (page, text) => page.getByText(text, { exact: true }).first();

// the seeded worksheet: headers Region/Sales/Status plus the three seeded rows
const SEED = {
  headers: ['Region', 'Sales', 'Status'],
  rows: [
    ['East', '1200', 'Open'],
    ['North', '800', 'Closed'],
    ['South', '700', 'Open'],
  ],
};

async function openQ3(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Q3 Sales', exact: true }).click();
  await expect(grid(page)).toBeVisible();
}

async function expectSeedSheet(page) {
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('Sales');
  await expect(cell(page, 'C1')).toHaveText('Status');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'C2')).toHaveText('Open');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'B3')).toHaveText('800');
  await expect(cell(page, 'C3')).toHaveText('Closed');
  await expect(cell(page, 'A4')).toHaveText('South');
  await expect(cell(page, 'B4')).toHaveText('700');
  await expect(cell(page, 'C4')).toHaveText('Open');
}

// select a single cell, or drag from one corner of a rectangle to the opposite one
async function selectRange(page, from, to) {
  if (from === to) {
    await cell(page, from).click();
    return;
  }
  const a = await cell(page, from).boundingBox();
  const b = await cell(page, to).boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
  await page.mouse.up();
}

async function openDataMenu(page) {
  await page.getByRole('button', { name: 'Data', exact: true }).click();
}

async function dataCommand(page, name) {
  await openDataMenu(page);
  await page.getByRole('menuitem', { name, exact: true }).click();
}

async function pickOption(page, combobox, option) {
  await combobox.click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

async function sortRange(page, from, to, sortBy, order) {
  await selectRange(page, from, to);
  await dataCommand(page, 'Sort range');
  const dialog = page.getByRole('dialog', { name: 'Sort range' });
  await expect(dialog).toBeVisible();
  await pickOption(page, dialog.getByRole('combobox', { name: 'Sort by', exact: true }), sortBy);
  await pickOption(page, dialog.getByRole('combobox', { name: 'Order', exact: true }), order);
  await dialog.getByRole('checkbox', { name: 'Data has header row', exact: true }).check();
  await dialog.getByRole('button', { name: 'Sort', exact: true }).click();
  await expect(dialog).toBeHidden();
}

async function restoreSourceOrder(page) {
  await sortRange(page, 'A1', 'C4', 'Region', 'Ascending');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'A4')).toHaveText('South');
}

// commit a value into a cell through the "Formula bar"
async function enterCell(page, coord, value) {
  await cell(page, coord).click();
  const bar = formulaBar(page);
  await bar.fill(value);
  await bar.press('Enter');
}

// commit a value into a cell through the inline editor of a double-clicked cell
async function editCellInline(page, coord, value) {
  await cell(page, coord).dblclick();
  const editor = page.getByRole('textbox', { name: `Edit ${coord}`, exact: true });
  await expect(editor).toBeVisible();
  await editor.fill(value);
  await editor.press('Enter');
}

async function createFilter(page, from, to) {
  await selectRange(page, from, to);
  await dataCommand(page, 'Create filter');
  await expect(page.getByRole('button', { name: 'Filter Region', exact: true })).toBeVisible();
}

async function clearFilter(page) {
  await dataCommand(page, 'Clear filter');
}

async function openValidationDialog(page, from, to) {
  await selectRange(page, from, to);
  await dataCommand(page, 'Data validation');
  const dialog = page.getByRole('dialog', { name: 'Data validation' });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function setDropdownRule(page, from, to, allowedValues) {
  const dialog = await openValidationDialog(page, from, to);
  await pickOption(page, dialog.getByRole('combobox', { name: 'Rule type', exact: true }), 'Dropdown');
  await dialog.getByRole('textbox', { name: 'Allowed values', exact: true }).fill(allowedValues);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();
}

async function setNumberRule(page, from, to, min, max) {
  const dialog = await openValidationDialog(page, from, to);
  await pickOption(page, dialog.getByRole('combobox', { name: 'Rule type', exact: true }), 'Number range');
  await dialog.getByRole('textbox', { name: 'Minimum', exact: true }).fill(min);
  await dialog.getByRole('textbox', { name: 'Maximum', exact: true }).fill(max);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();
}

async function deleteRule(page, from, to) {
  const dialog = await openValidationDialog(page, from, to);
  await dialog.getByRole('button', { name: 'Delete rule', exact: true }).click();
  await expect(dialog).toBeHidden();
}

async function createPivot(page, from, to) {
  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await selectRange(page, from, to);
  await dataCommand(page, 'Create pivot table');
  const dialog = page.getByRole('dialog', { name: 'Create pivot table' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(`Source range: ${from}:${to}`);
  await dialog.getByRole('radio', { name: 'New worksheet', exact: true }).check();
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(dialog).toBeHidden();
  const pivotTab = page.getByRole('tab').last();
  await pivotTab.click();
  const editor = page.getByRole('region', { name: 'Pivot table editor' });
  await expect(editor).toBeVisible();
  return { editor, pivotTab };
}

async function configurePivot(page, editor, fields) {
  const { rows, columns, values, summarizeBy } = fields;
  if (rows) await pickOption(page, editor.getByRole('combobox', { name: 'Rows', exact: true }), rows);
  if (columns) await pickOption(page, editor.getByRole('combobox', { name: 'Columns', exact: true }), columns);
  if (values) await pickOption(page, editor.getByRole('combobox', { name: 'Values', exact: true }), values);
  if (summarizeBy) await pickOption(page, editor.getByRole('combobox', { name: 'Summarize by', exact: true }), summarizeBy);
  await editor.getByRole('button', { name: 'Apply', exact: true }).click();
}

// ---------------------------------------------------------------------------
// REQ-5-1-1  Sort a data range by a specified column
// ---------------------------------------------------------------------------

test('REQ-5-1-1: REQ-5-1-1 -the requested workflow Sales the requested workflow,the requested workflow', async ({ page }) => {
  await openQ3(page);
  await expectSeedSheet(page);

  await sortRange(page, 'A1', 'C4', 'Sales', 'Ascending');

  // the declared header row does not participate in the sorting
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('Sales');
  await expect(cell(page, 'C1')).toHaveText('Status');
  // numeric comparison of the Sales column
  await expect(cell(page, 'A2')).toHaveText('South');
  await expect(cell(page, 'B2')).toHaveText('700');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'B3')).toHaveText('800');
  await expect(cell(page, 'A4')).toHaveText('East');
  await expect(cell(page, 'B4')).toHaveText('1200');

  // formula bar is consistent with the new position
  await cell(page, 'B2').click();
  await expect(formulaBar(page)).toHaveValue('700');

  // the order persists after refresh
  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('South');
  await expect(cell(page, 'B2')).toHaveText('700');
  await expect(cell(page, 'A4')).toHaveText('East');
  await expect(cell(page, 'B4')).toHaveText('1200');

  await restoreSourceOrder(page);
});

test('REQ-5-1-1#2: REQ-5-1-1 -the requested workflow ISO the requested workflow', async ({ page }) => {
  await openQ3(page);
  await expect(cell(page, 'B2')).toHaveText('1200');

  // a small extra block used only to exercise date-text comparison
  await enterCell(page, 'E1', 'Phase');
  await enterCell(page, 'F1', 'Due');
  await enterCell(page, 'E2', 'Beta');
  await enterCell(page, 'F2', '2024-06-01');
  await enterCell(page, 'E3', 'Alpha');
  await enterCell(page, 'F3', '2022-12-31');
  await enterCell(page, 'E4', 'Gamma');
  await enterCell(page, 'F4', '2023-01-15');

  await sortRange(page, 'E1', 'F4', 'Due', 'Ascending');

  await expect(cell(page, 'E1')).toHaveText('Phase');
  await expect(cell(page, 'E2')).toHaveText('Alpha');
  await expect(cell(page, 'E3')).toHaveText('Gamma');
  await expect(cell(page, 'E4')).toHaveText('Beta');

  await page.reload();
  await expect(cell(page, 'E2')).toHaveText('Alpha');
  await expect(cell(page, 'E3')).toHaveText('Gamma');
  await expect(cell(page, 'E4')).toHaveText('Beta');
});

test('REQ-5-1-1#3: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  await openQ3(page);
  await restoreSourceOrder(page);

  await sortRange(page, 'A1', 'C4', 'Region', 'Descending');

  // text comparison with the "Descending" order
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'A2')).toHaveText('South');
  await expect(cell(page, 'B2')).toHaveText('700');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'B3')).toHaveText('800');
  await expect(cell(page, 'A4')).toHaveText('East');
  await expect(cell(page, 'B4')).toHaveText('1200');

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('South');
  await expect(cell(page, 'A4')).toHaveText('East');

  await restoreSourceOrder(page);
});

test('REQ-5-1-1#4: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  await openQ3(page);

  // start from a scrambled order so that a no-op implementation cannot pass
  await sortRange(page, 'A1', 'C4', 'Region', 'Descending');
  await expect(cell(page, 'A2')).toHaveText('South');

  await sortRange(page, 'A1', 'C4', 'Sales', 'Descending');

  // whole records move together by row, numbers compared as numbers
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'C2')).toHaveText('Open');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'B3')).toHaveText('800');
  await expect(cell(page, 'C3')).toHaveText('Closed');
  await expect(cell(page, 'A4')).toHaveText('South');
  await expect(cell(page, 'B4')).toHaveText('700');
  await expect(cell(page, 'C4')).toHaveText('Open');

  await restoreSourceOrder(page);
});

test('REQ-5-1-1#5: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  await openQ3(page);
  await restoreSourceOrder(page);

  // rows below the selected rectangle are outside the selection
  await sortRange(page, 'A1', 'C3', 'Sales', 'Ascending');

  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'A2')).toHaveText('North');
  await expect(cell(page, 'B2')).toHaveText('800');
  await expect(cell(page, 'A3')).toHaveText('East');
  await expect(cell(page, 'B3')).toHaveText('1200');
  // data outside the selection is unchanged
  await expect(cell(page, 'A4')).toHaveText('South');
  await expect(cell(page, 'B4')).toHaveText('700');

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('North');
  await expect(cell(page, 'A4')).toHaveText('South');

  await sortRange(page, 'A1', 'C3', 'Region', 'Ascending');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'A3')).toHaveText('North');
  await restoreSourceOrder(page);
});

test('REQ-5-1-1#6: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  await openQ3(page);
  await restoreSourceOrder(page);

  // Status has two equal sort keys ("Open"); their original relative order is kept
  await sortRange(page, 'A1', 'C4', 'Status', 'Ascending');

  await expect(cell(page, 'A2')).toHaveText('North');
  await expect(cell(page, 'C2')).toHaveText('Closed');
  await expect(cell(page, 'A3')).toHaveText('East');
  await expect(cell(page, 'C3')).toHaveText('Open');
  await expect(cell(page, 'A4')).toHaveText('South');
  await expect(cell(page, 'C4')).toHaveText('Open');

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('North');
  await expect(cell(page, 'A3')).toHaveText('East');
  await expect(cell(page, 'A4')).toHaveText('South');

  await restoreSourceOrder(page);
});

// ---------------------------------------------------------------------------
// REQ-5-1-2  Filter rows by value or condition
// ---------------------------------------------------------------------------

test('REQ-5-1-2: REQ-5-1-2 -the requested workflow Region the requested workflow Sales the requested workflow,the requested workflow', async ({ page }) => {
  await openQ3(page);
  await createFilter(page, 'A1', 'C4');

  await page.getByRole('button', { name: 'Filter Sales', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Filter Sales' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Clear selection', exact: true }).click();
  await dialog.getByRole('checkbox', { name: '1200', exact: true }).check();
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(dialog).toBeHidden();

  await expect(grid(page).getByText('East', { exact: true })).toBeVisible();
  await expect(grid(page).getByText('North', { exact: true })).toBeHidden();
  await expect(grid(page).getByText('South', { exact: true })).toBeHidden();

  await page.reload();
  await expect(grid(page).getByText('East', { exact: true })).toBeVisible();
  await expect(grid(page).getByText('North', { exact: true })).toBeHidden();
  await expect(grid(page).getByText('South', { exact: true })).toBeHidden();

  await clearFilter(page);
  await expect(grid(page).getByText('East', { exact: true })).toBeVisible();
  await expect(grid(page).getByText('North', { exact: true })).toBeVisible();
  await expect(grid(page).getByText('South', { exact: true })).toBeVisible();
});

test('REQ-5-1-2#2: REQ-5-1-2 -the requested workflow, the requested workflow,the requested workflow', async ({ page }) => {
  await openQ3(page);
  await createFilter(page, 'A1', 'C4');

  await page.getByRole('button', { name: 'Filter Region', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Filter Region' });
  await expect(dialog).toBeVisible();
  await pickOption(page, dialog.getByRole('combobox', { name: 'Condition', exact: true }), 'Text contains');
  await dialog.getByRole('textbox', { name: 'Value', exact: true }).fill('th');
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(dialog).toBeHidden();

  await expect(grid(page).getByText('North', { exact: true })).toBeVisible();
  await expect(grid(page).getByText('South', { exact: true })).toBeVisible();
  await expect(grid(page).getByText('East', { exact: true })).toBeHidden();

  await page.reload();
  await expect(grid(page).getByText('North', { exact: true })).toBeVisible();
  await expect(grid(page).getByText('South', { exact: true })).toBeVisible();
  await expect(grid(page).getByText('East', { exact: true })).toBeHidden();

  await clearFilter(page);
  await expect(grid(page).getByText('East', { exact: true })).toBeVisible();
});

test('REQ-5-1-2#3: REQ-5-1-2 -CSV the requested workflow', async ({ page }) => {
  await openQ3(page);
  await createFilter(page, 'A1', 'C4');

  await page.getByRole('button', { name: 'Filter Sales', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Filter Sales' });
  await expect(dialog).toBeVisible();
  await pickOption(page, dialog.getByRole('combobox', { name: 'Condition', exact: true }), 'Greater than');
  await dialog.getByRole('textbox', { name: 'Value', exact: true }).fill('800');
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(dialog).toBeHidden();

  await expect(grid(page).getByText('East', { exact: true })).toBeVisible();
  await expect(grid(page).getByText('North', { exact: true })).toBeHidden();
  await expect(grid(page).getByText('South', { exact: true })).toBeHidden();

  // CSV export still includes the hidden rows within the filtered range
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export CSV', exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
  const content = fs.readFileSync(await download.path(), 'utf8');
  expect(content).toContain('North,800,Closed');
  expect(content).toContain('South,700,Open');

  // exporting does not change the filter view
  await expect(grid(page).getByText('North', { exact: true })).toBeHidden();
  await expect(grid(page).getByText('South', { exact: true })).toBeHidden();

  await clearFilter(page);
  await expect(grid(page).getByText('North', { exact: true })).toBeVisible();
});

test('REQ-5-1-2#4: REQ-5-1-2 -the requested workflow', async ({ page }) => {
  await openQ3(page);
  await createFilter(page, 'A1', 'C4');

  await page.getByRole('button', { name: 'Filter Region', exact: true }).click();
  const regionDialog = page.getByRole('dialog', { name: 'Filter Region' });
  await expect(regionDialog).toBeVisible();
  await pickOption(page, regionDialog.getByRole('combobox', { name: 'Condition', exact: true }), 'Text contains');
  await regionDialog.getByRole('textbox', { name: 'Value', exact: true }).fill('th');
  await regionDialog.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(regionDialog).toBeHidden();

  await page.getByRole('button', { name: 'Filter Status', exact: true }).click();
  const statusDialog = page.getByRole('dialog', { name: 'Filter Status' });
  await expect(statusDialog).toBeVisible();
  await pickOption(page, statusDialog.getByRole('combobox', { name: 'Condition', exact: true }), 'Text contains');
  await statusDialog.getByRole('textbox', { name: 'Value', exact: true }).fill('Closed');
  await statusDialog.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(statusDialog).toBeHidden();

  // the two column conditions are combined with AND
  await expect(grid(page).getByText('North', { exact: true })).toBeVisible();
  await expect(grid(page).getByText('South', { exact: true })).toBeHidden();
  await expect(grid(page).getByText('East', { exact: true })).toBeHidden();

  await page.reload();
  await expect(grid(page).getByText('North', { exact: true })).toBeVisible();
  await expect(grid(page).getByText('South', { exact: true })).toBeHidden();
  await expect(grid(page).getByText('East', { exact: true })).toBeHidden();

  await clearFilter(page);
  await expect(grid(page).getByText('East', { exact: true })).toBeVisible();
});

test('REQ-5-1-2#5: REQ-5-1-2 -the requested workflow', async ({ page }) => {
  await openQ3(page);
  await createFilter(page, 'A1', 'C4');

  // "Is not empty" needs no "Value" entry
  await page.getByRole('button', { name: 'Filter Region', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Filter Region' });
  await expect(dialog).toBeVisible();
  await pickOption(page, dialog.getByRole('combobox', { name: 'Condition', exact: true }), 'Is not empty');
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(dialog).toBeHidden();

  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'A4')).toHaveText('South');

  // clearing the filter restores every record with its original value and order
  await clearFilter(page);
  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'B3')).toHaveText('800');
  await expect(cell(page, 'A4')).toHaveText('South');
  await expect(cell(page, 'B4')).toHaveText('700');
});

// ---------------------------------------------------------------------------
// REQ-5-2-1  Set dropdown or numeric validation for a range
// ---------------------------------------------------------------------------

test('REQ-5-2-1: REQ-5-2-1 -the requested workflow A1:A2 the requested workflow,the requested workflow', async ({ page }) => {
  await openQ3(page);
  await expectSeedSheet(page);

  await setDropdownRule(page, 'A2', 'A2', ' East , North , South ');

  // the constrained cell provides the dropdown button
  const dropdownButton = page.getByRole('button', { name: 'Open dropdown for A2', exact: true });
  await expect(dropdownButton).toBeVisible();
  await dropdownButton.click();
  // allowed values are trimmed of leading and trailing spaces
  await expect(page.getByRole('option', { name: 'East', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'North', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'South', exact: true })).toBeVisible();
  await page.getByRole('option', { name: 'North', exact: true }).click();
  await expect(cell(page, 'A2')).toHaveText('North');

  // restore the seeded value through the same control
  await dropdownButton.click();
  await page.getByRole('option', { name: 'East', exact: true }).click();
  await expect(cell(page, 'A2')).toHaveText('East');

  await deleteRule(page, 'A2', 'A2');
  await expect(page.getByRole('button', { name: 'Open dropdown for A2', exact: true })).toBeHidden();
});

test('REQ-5-2-1#2: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await openQ3(page);
  await expectSeedSheet(page);

  await setDropdownRule(page, 'A2', 'A2', 'East,North,South');

  // an invalid value written through the formula bar is rejected
  await cell(page, 'A2').click();
  await formulaBar(page).fill('West');
  await formulaBar(page).press('Enter');
  await expect(errorText(page, 'Please select one of the following values: East,North,South')).toBeVisible();
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(formulaBar(page)).toHaveValue('East');

  // the rule is still active after refresh
  await page.reload();
  await cell(page, 'A2').click();
  await formulaBar(page).fill('West');
  await formulaBar(page).press('Enter');
  await expect(errorText(page, 'Please select one of the following values: East,North,South')).toBeVisible();
  await expect(cell(page, 'A2')).toHaveText('East');

  await deleteRule(page, 'A2', 'A2');
});

test('REQ-5-2-1#3: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await openQ3(page);
  await expectSeedSheet(page);

  await setNumberRule(page, 'B2', 'B4', '0', '100');

  // 101 in B3 is rejected through the inline cell editor
  await editCellInline(page, 'B3', '101');
  await expect(errorText(page, 'Please enter a number from 0 to 100')).toBeVisible();
  await expect(cell(page, 'B3')).toHaveText('800');

  // the persisted rule is still active after refresh
  await page.reload();
  await enterCell(page, 'B3', '101');
  await expect(errorText(page, 'Please enter a number from 0 to 100')).toBeVisible();
  await expect(cell(page, 'B3')).toHaveText('800');

  await deleteRule(page, 'B2', 'B4');
});

test('REQ-5-2-1#4: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await openQ3(page);
  await expect(cell(page, 'B2')).toHaveText('1200');

  await setNumberRule(page, 'B2', 'B2', '1000', '2000');

  await enterCell(page, 'B2', '999');
  await expect(errorText(page, 'Please enter a number between 1000 and 2000')).toBeVisible();
  await expect(cell(page, 'B2')).toHaveText('1200');

  // a value inside the inclusive limits is accepted
  await enterCell(page, 'B2', '1500');
  await expect(cell(page, 'B2')).toHaveText('1500');

  // restore the seeded value (also inside the limits)
  await enterCell(page, 'B2', '1200');
  await expect(cell(page, 'B2')).toHaveText('1200');

  await deleteRule(page, 'B2', 'B2');
});

test('REQ-5-2-1#5: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await openQ3(page);
  await expectSeedSheet(page);

  await setDropdownRule(page, 'A1', 'A2', 'East,North,South');

  // a bulk paste with any invalid target is rejected as a whole
  await page.evaluate((t) => navigator.clipboard.writeText(t), 'West\tNorth\nEast\tQty');
  await cell(page, 'A1').click();
  await page.keyboard.press('Control+V');

  await expect(errorText(page, 'Please select one of the following values: East,North,South')).toBeVisible();
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('Sales');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1200');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('Sales');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1200');

  await deleteRule(page, 'A1', 'A2');
});

test('REQ-5-2-1#6: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await openQ3(page);
  await expect(cell(page, 'B2')).toHaveText('1200');

  await setNumberRule(page, 'D1', 'D2', '0', '100');

  // reopening an existing rule shows the saved parameters and the delete command
  let dialog = await openValidationDialog(page, 'D1', 'D2');
  await expect(dialog).toContainText('Number range');
  await expect(dialog.getByRole('textbox', { name: 'Minimum', exact: true })).toHaveValue('0');
  await expect(dialog.getByRole('textbox', { name: 'Maximum', exact: true })).toHaveValue('100');
  await expect(dialog.getByRole('button', { name: 'Delete rule', exact: true })).toBeVisible();

  // saving a modification makes the new limits effective immediately
  await dialog.getByRole('textbox', { name: 'Maximum', exact: true }).fill('50');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();

  await enterCell(page, 'D1', '60');
  await expect(errorText(page, 'Please enter a number between 0 and 50')).toBeVisible();
  await expect(cell(page, 'D1')).not.toHaveText('60');
  await expect(cell(page, 'B2')).toHaveText('1200');

  // deleting the rule removes the constraint without changing existing cell values
  await deleteRule(page, 'D1', 'D2');
  dialog = await openValidationDialog(page, 'D1', 'D2');
  await expect(dialog.getByRole('button', { name: 'Delete rule', exact: true })).toBeHidden();
  await expect(cell(page, 'B2')).toHaveText('1200');
});

// ---------------------------------------------------------------------------
// REQ-5-3-1  Create and refresh a basic pivot table
// ---------------------------------------------------------------------------

test('REQ-5-3-1: REQ-5-3-1 -the requested workflow Pivot1 the requested workflow Region the requested workflow Sales,the requested workflow', async ({ page }) => {
  await openQ3(page);
  await expectSeedSheet(page);

  const { editor } = await createPivot(page, 'A1', 'C4');
  const pivotName = (await page.getByRole('tab').last().innerText()).trim();
  expect(pivotName).toMatch(/^Pivot\d+/);
  await expect(page.getByRole('tab').last()).toHaveAttribute('aria-selected', 'true');

  await configurePivot(page, editor, { rows: 'Region', values: 'Sales', summarizeBy: 'SUM' });

  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('SUM of Sales');
  // row groups ordered by first appearance, Grand Total as the final row
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
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'B5')).toHaveText('2700');
});

test('REQ-5-3-1#2: REQ-5-3-1 -the requested workflow,the requested workflow', async ({ page }) => {
  await openQ3(page);
  await expectSeedSheet(page);

  const { editor } = await createPivot(page, 'A1', 'C4');

  await configurePivot(page, editor, {
    rows: 'Region',
    columns: 'Status',
    values: 'Sales',
    summarizeBy: 'COUNT',
  });

  await expect(cell(page, 'A1')).toHaveText('Region');
  // column-field values from B1 onward in order of first appearance, Grand Total last
  await expect(cell(page, 'B1')).toHaveText('Open');
  await expect(cell(page, 'C1')).toHaveText('Closed');
  await expect(cell(page, 'D1')).toHaveText('Grand Total');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1');
  await expect(cell(page, 'C2')).toHaveText('0');
  await expect(cell(page, 'D2')).toHaveText('1');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'B3')).toHaveText('0');
  await expect(cell(page, 'C3')).toHaveText('1');
  await expect(cell(page, 'D3')).toHaveText('1');
  await expect(cell(page, 'A4')).toHaveText('South');
  await expect(cell(page, 'B4')).toHaveText('1');
  await expect(cell(page, 'C4')).toHaveText('0');
  await expect(cell(page, 'D4')).toHaveText('1');
  await expect(cell(page, 'A5')).toHaveText('Grand Total');
  await expect(cell(page, 'B5')).toHaveText('2');
  await expect(cell(page, 'C5')).toHaveText('1');
  await expect(cell(page, 'D5')).toHaveText('3');

  await page.reload();
  await expect(cell(page, 'B1')).toHaveText('Open');
  await expect(cell(page, 'D5')).toHaveText('3');
});

test('REQ-5-3-1#3: REQ-5-3-1 -the requested workflow COUNT the requested workflow', async ({ page }) => {
  await openQ3(page);
  await expectSeedSheet(page);

  const { editor, pivotTab } = await createPivot(page, 'A1', 'C4');

  await configurePivot(page, editor, { rows: 'Region', values: 'Sales', summarizeBy: 'COUNT' });
  await expect(cell(page, 'B1')).toHaveText('COUNT of Sales');
  await expect(cell(page, 'B2')).toHaveText('1');
  await expect(cell(page, 'B3')).toHaveText('1');
  await expect(cell(page, 'B4')).toHaveText('1');
  await expect(cell(page, 'A5')).toHaveText('Grand Total');
  await expect(cell(page, 'B5')).toHaveText('3');

  await page.reload();
  await expect(cell(page, 'B1')).toHaveText('COUNT of Sales');
  await expect(cell(page, 'B5')).toHaveText('3');
});

test('REQ-5-3-1#4: REQ-5-3-1 -AVERAGE the requested workflow', async ({ page }) => {
  await openQ3(page);
  await expectSeedSheet(page);

  const { editor } = await createPivot(page, 'A1', 'C4');

  await configurePivot(page, editor, { rows: 'Region', values: 'Sales', summarizeBy: 'AVERAGE' });

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

  // the source worksheet still holds the original values
  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'A4')).toHaveText('South');
  await expect(cell(page, 'B4')).toHaveText('700');
});

test('REQ-5-3-1#5: REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await openQ3(page);
  await expectSeedSheet(page);

  const { editor, pivotTab } = await createPivot(page, 'A1', 'C4');

  await configurePivot(page, editor, { rows: 'Region', values: 'Sales', summarizeBy: 'SUM' });
  await expect(cell(page, 'B1')).toHaveText('SUM of Sales');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'B5')).toHaveText('2700');

  // changing a source value leaves the existing result untouched until refresh
  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await enterCell(page, 'B2', '1500');
  await pivotTab.click();
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'B5')).toHaveText('2700');

  await page.getByRole('button', { name: 'Refresh pivot table', exact: true }).click();
  await expect(cell(page, 'B2')).toHaveText('1500');
  await expect(cell(page, 'B5')).toHaveText('3000');

  // restore the seeded source value and refresh again
  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await enterCell(page, 'B2', '1200');
  await pivotTab.click();
  await page.getByRole('button', { name: 'Refresh pivot table', exact: true }).click();
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'B5')).toHaveText('2700');
});

test('REQ-5-3-1#6: REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await openQ3(page);
  await expectSeedSheet(page);

  const { editor, pivotTab } = await createPivot(page, 'A1', 'C4');

  await configurePivot(page, editor, {
    rows: 'Region',
    columns: 'Status',
    values: 'Sales',
    summarizeBy: 'COUNT',
  });
  await expect(cell(page, 'D5')).toHaveText('3');

  // remove the "Status" header column from the source worksheet
  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await page.getByRole('columnheader', { name: 'C', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete column', exact: true }).click();

  await pivotTab.click();
  await page.getByRole('button', { name: 'Refresh pivot table', exact: true }).click();
  await expect(errorText(page, 'Pivot field is no longer available. Select a new field.')).toBeVisible();
  // the last successful result is preserved
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'D5')).toHaveText('3');

  // restore the source column
  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await page.getByRole('columnheader', { name: 'C', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 column left', exact: true }).click();
  await enterCell(page, 'C1', 'Status');
  await enterCell(page, 'C2', 'Open');
  await enterCell(page, 'C3', 'Closed');
  await enterCell(page, 'C4', 'Open');
  await expectSeedSheet(page);
});

test('REQ-5-3-1#7: REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await openQ3(page);
  await expectSeedSheet(page);

  const { editor, pivotTab } = await createPivot(page, 'A1', 'C4');

  await configurePivot(page, editor, { rows: 'Region', values: 'Sales', summarizeBy: 'SUM' });
  await expect(cell(page, 'B5')).toHaveText('2700');

  // insert a row above row 2 and add a new record
  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await page.getByRole('rowheader', { name: '2', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 row above', exact: true }).click();
  await enterCell(page, 'A2', 'West');
  await enterCell(page, 'B2', '500');
  await enterCell(page, 'C2', 'Open');

  // the old summary remains until the pivot table is refreshed
  await pivotTab.click();
  await expect(cell(page, 'B5')).toHaveText('2700');
  await page.getByRole('button', { name: 'Refresh pivot table', exact: true }).click();
  await expect(cell(page, 'A2')).toHaveText('West');
  await expect(cell(page, 'B2')).toHaveText('500');
  await expect(cell(page, 'A5')).toHaveText('Grand Total');
  await expect(cell(page, 'B5')).toHaveText('3200');

  // restore the source worksheet
  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await page.getByRole('rowheader', { name: '2', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete row', exact: true }).click();
  await expectSeedSheet(page);
});

test('REQ-5-3-1#8: REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await openQ3(page);
  await expectSeedSheet(page);

  const { editor } = await createPivot(page, 'A1', 'C4');

  // COUNT works on a value field that holds no numbers
  await configurePivot(page, editor, { rows: 'Region', values: 'Status', summarizeBy: 'COUNT' });

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
});

test('REQ-5-3-1#9: REQ-5-3-1 -the requested workflow COUNT the requested workflow', async ({ page }) => {
  await openQ3(page);
  await expectSeedSheet(page);

  const { editor, pivotTab } = await createPivot(page, 'A1', 'C4');

  await configurePivot(page, editor, { rows: 'Region', columns: 'Status', values: 'Sales', summarizeBy: 'COUNT' });
  await expect(cell(page, 'A5')).toHaveText('Grand Total');
  await expect(cell(page, 'D5')).toHaveText('3');

  // leave the editor, then reopen the workbook from the application entry point
  await page.goto('/');
  await page.getByRole('link', { name: 'Q3 Sales', exact: true }).click();
  await expect(grid(page)).toBeVisible();
  await expect(pivotTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('region', { name: 'Pivot table editor' })).toBeVisible();

  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('Open');
  await expect(cell(page, 'C1')).toHaveText('Closed');
  await expect(cell(page, 'D1')).toHaveText('Grand Total');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'D2')).toHaveText('1');
  await expect(cell(page, 'A5')).toHaveText('Grand Total');
  await expect(cell(page, 'D5')).toHaveText('3');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

