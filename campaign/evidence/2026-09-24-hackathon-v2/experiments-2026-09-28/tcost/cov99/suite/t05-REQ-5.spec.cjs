const { test, expect } = require('@playwright/test');
const fs = require('fs');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const BASE_CSV = 'Region,Sales,Status\nEast,1200,Open\nNorth,800,Closed\nSouth,700,Open\n';
const DATE_CSV = 'Region,Sales,Status,Date\nEast,1200,Open,2023-01-15\nNorth,800,Closed,2023-02-20\nSouth,700,Open,2023-01-01\n';

async function importWorkbook(page, csv) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Import CSV', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import CSV', exact: true });
  const fileName = 'wb' + u() + '.csv';
  await dialog.getByLabel('CSV file', { exact: true }).setInputFiles({
    name: fileName,
    mimeType: 'text/csv',
    buffer: Buffer.from(csv, 'utf8'),
  });
  await dialog.getByRole('button', { name: 'Confirm import', exact: true }).click();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
}

function cell(coord) {
  return page.getByRole('gridcell', { name: coord, exact: true });
}

async function selectRange(start, end) {
  const startCell = cell(start);
  const endCell = cell(end);
  const sb = await startCell.boundingBox();
  const eb = await endCell.boundingBox();
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.mouse.down();
  await page.mouse.move(eb.x + eb.width / 2, eb.y + eb.height / 2, { steps: 10 });
  await page.mouse.up();
}

async function enterCell(page, coord, value) {
  await cell(coord).click();
  const bar = page.getByLabel('Formula bar', { exact: true });
  await bar.fill(value);
  await bar.press('Enter');
}

async function openDataMenu(page) {
  await page.getByRole('button', { name: 'Data', exact: true }).click();
}

async function selectOption(container, label, optionName) {
  const combo = container.getByLabel(label, { exact: true });
  const isSelect = await combo.evaluate((el) => el.tagName === 'SELECT');
  if (isSelect) {
    await combo.selectOption({ label: optionName });
  } else {
    await combo.click();
    const opt = page.getByRole('option', { name: optionName, exact: true });
    await expect(opt).toBeVisible();
    await opt.click();
  }
}

async function sortRange(page, { sortBy, order = 'Ascending', hasHeader = true }) {
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: 'Sort range', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Sort range', exact: true });
  await selectOption(dialog, 'Sort by', sortBy);
  await selectOption(dialog, 'Order', order);
  const headerCheckbox = dialog.getByRole('checkbox', { name: 'Data has header row', exact: true });
  if (hasHeader) {
    await headerCheckbox.check();
  } else {
    await headerCheckbox.uncheck();
  }
  await dialog.getByRole('button', { name: 'Sort', exact: true }).click();
}

async function createFilter(page, start = 'A1', end = 'C4') {
  await selectRange(start, end);
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: 'Create filter', exact: true }).click();
}

async function applyValueFilter(page, header, values) {
  await page.getByRole('button', { name: `Filter ${header}`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: `Filter ${header}`, exact: true });
  await dialog.getByRole('button', { name: 'Clear selection', exact: true }).click();
  for (const v of values) {
    await dialog.getByRole('checkbox', { name: v, exact: true }).check();
  }
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
}

async function applyConditionFilter(page, header, condition, value) {
  await page.getByRole('button', { name: `Filter ${header}`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: `Filter ${header}`, exact: true });
  await selectOption(dialog, 'Condition', condition);
  if (value !== undefined) {
    await dialog.getByLabel('Value', { exact: true }).fill(value);
  }
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
}

async function clearFilter(page) {
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: 'Clear filter', exact: true }).click();
}

async function setDropdownValidation(page, allowed) {
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: 'Data validation', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await selectOption(dialog, 'Rule type', 'Dropdown');
  await dialog.getByLabel('Allowed values', { exact: true }).fill(allowed);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
}

async function setNumberValidation(page, min, max) {
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: 'Data validation', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await selectOption(dialog, 'Rule type', 'Number range');
  await dialog.getByLabel('Minimum', { exact: true }).fill(String(min));
  await dialog.getByLabel('Maximum', { exact: true }).fill(String(max));
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
}

async function goToSheet(page, name) {
  await page.getByRole('tab', { name, exact: true }).click();
}

async function createPivot(page, { rows, columns, values, summarizeBy }) {
  await selectRange('A1', 'C4');
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: 'Create pivot table', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create pivot table', exact: true });
  await expect(dialog.getByText('Source range: A1:C4', { exact: true })).toBeVisible();
  await dialog.getByRole('radio', { name: 'New worksheet', exact: true }).check();
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();
  const editor = page.getByRole('region', { name: 'Pivot table editor', exact: true });
  await expect(editor).toBeVisible();
  await selectOption(editor, 'Rows', rows);
  if (columns) {
    await selectOption(editor, 'Columns', columns);
  }
  await selectOption(editor, 'Values', values);
  await selectOption(editor, 'Summarize by', summarizeBy);
  await editor.getByRole('button', { name: 'Apply', exact: true }).click();
  const pivotTab = page.getByRole('tab', { name: 'Pivot1', exact: true });
  await expect(pivotTab).toBeVisible();
  await pivotTab.click();
}

async function insertRowAbove(page, rowNumber) {
  await page.getByRole('rowheader', { name: String(rowNumber), exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 row above', exact: true }).click();
}

async function deleteColumn(page, letter) {
  await page.getByRole('columnheader', { name: letter, exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete column', exact: true }).click();
}

test('REQ-5-1-1: REQ-5-1-1 -the requested workflow Sales the requested workflow,the requested workflow', async ({ page }) => {
  await importWorkbook(page, BASE_CSV);
  await selectRange('A1', 'C4');
  await sortRange(page, { sortBy: 'Sales', order: 'Ascending', hasHeader: true });
  await expect(cell('A1')).toHaveText('Region');
  await expect(cell('A2')).toHaveText('South');
  await expect(cell('A3')).toHaveText('North');
  await expect(cell('A4')).toHaveText('East');
  await expect(cell('B2')).toHaveText('700');
  await expect(cell('B3')).toHaveText('800');
  await expect(cell('B4')).toHaveText('1200');
  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(cell('A2')).toHaveText('South');
  await expect(cell('A3')).toHaveText('North');
  await expect(cell('A4')).toHaveText('East');
});

test('REQ-5-1-1#2: REQ-5-1-1 -the requested workflow ISO the requested workflow', async ({ page }) => {
  await importWorkbook(page, DATE_CSV);
  await selectRange('A1', 'D4');
  await sortRange(page, { sortBy: 'Date', order: 'Ascending', hasHeader: true });
  await expect(cell('A2')).toHaveText('South');
  await expect(cell('A3')).toHaveText('East');
  await expect(cell('A4')).toHaveText('North');
  await expect(cell('D2')).toHaveText('2023-01-01');
  await expect(cell('D3')).toHaveText('2023-01-15');
  await expect(cell('D4')).toHaveText('2023-02-20');
  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(cell('A2')).toHaveText('South');
  await expect(cell('A3')).toHaveText('East');
  await expect(cell('A4')).toHaveText('North');
});

test('REQ-5-1-1#3: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  await importWorkbook(page, BASE_CSV);
  await selectRange('A1', 'C4');
  await sortRange(page, { sortBy: 'Status', order: 'Ascending', hasHeader: false });
  await expect(cell('A1')).toHaveText('North');
  await expect(cell('A2')).toHaveText('East');
  await expect(cell('A3')).toHaveText('South');
  await expect(cell('A4')).toHaveText('Region');
  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(cell('A1')).toHaveText('North');
  await expect(cell('A2')).toHaveText('East');
  await expect(cell('A3')).toHaveText('South');
  await expect(cell('A4')).toHaveText('Region');
});

test('REQ-5-1-1#4: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  await importWorkbook(page, BASE_CSV);
  await enterCell(page, 'D1', '=A2');
  await enterCell(page, 'D4', 'outside');
  await selectRange('A1', 'C4');
  await sortRange(page, { sortBy: 'Sales', order: 'Descending', hasHeader: true });
  await expect(cell('A2')).toHaveText('East');
  await expect(cell('A3')).toHaveText('North');
  await expect(cell('A4')).toHaveText('South');
  await expect(cell('D1')).toHaveText('East');
  await cell('D1').click();
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A2');
  await expect(cell('D4')).toHaveText('outside');
  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await cell('D1').click();
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A2');
  await expect(cell('D4')).toHaveText('outside');
});

test('REQ-5-1-1#5: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  await importWorkbook(page, BASE_CSV);
  await selectRange('B2', 'B4');
  await setNumberValidation(page, 0, 100);
  await selectRange('A1', 'C4');
  await sortRange(page, { sortBy: 'Region', order: 'Descending', hasHeader: true });
  await expect(cell('A2')).toHaveText('South');
  await expect(cell('A3')).toHaveText('North');
  await expect(cell('A4')).toHaveText('East');
  await enterCell(page, 'B3', '101');
  await expect(page.getByText('Please enter a number from 0 to 100', { exact: true })).toBeVisible();
  await expect(cell('B3')).toHaveText('800');
});

test('REQ-5-1-1#6: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  await importWorkbook(page, BASE_CSV);
  await selectRange('A1', 'C4');
  await sortRange(page, { sortBy: 'Sales', order: 'Ascending', hasHeader: true });
  await expect(cell('A2')).toHaveText('South');
  await createFilter(page);
  await applyValueFilter(page, 'Region', ['East']);
  await expect(cell('A4')).toBeVisible();
  await expect(cell('A4')).toHaveText('East');
  await expect(cell('A2')).not.toBeVisible();
  await expect(cell('A3')).not.toBeVisible();
  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(cell('A4')).toHaveText('East');
  await expect(cell('A2')).not.toBeVisible();
});

test('REQ-5-1-2: REQ-5-1-2 -the requested workflow Region the requested workflow Sales the requested workflow,the requested workflow', async ({ page }) => {
  await importWorkbook(page, BASE_CSV);
  await createFilter(page);
  await applyValueFilter(page, 'Region', ['East']);
  await applyConditionFilter(page, 'Sales', 'Greater than', '1000');
  await expect(cell('A2')).toHaveText('East');
  await expect(cell('A3')).not.toBeVisible();
  await expect(cell('A4')).not.toBeVisible();
  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(cell('A2')).toHaveText('East');
  await expect(cell('A3')).not.toBeVisible();
});

test('REQ-5-1-2#2: REQ-5-1-2 -the requested workflow, the requested workflow,the requested workflow', async ({ page }) => {
  await importWorkbook(page, BASE_CSV);
  await createFilter(page);
  await applyConditionFilter(page, 'Status', 'Text contains', 'pen');
  await expect(cell('A2')).toHaveText('East');
  await expect(cell('A3')).not.toBeVisible();
  await expect(cell('A4')).toHaveText('South');
  await clearFilter(page);
  await expect(cell('A2')).toHaveText('East');
  await expect(cell('A3')).toHaveText('North');
  await expect(cell('A4')).toHaveText('South');
  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(cell('A2')).toHaveText('East');
  await expect(cell('A3')).toHaveText('North');
  await expect(cell('A4')).toHaveText('South');
});

test('REQ-5-1-2#3: REQ-5-1-2 -CSV the requested workflow', async ({ page }) => {
  await importWorkbook(page, BASE_CSV);
  await createFilter(page);
  await applyValueFilter(page, 'Region', ['East', 'South']);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
  const content = fs.readFileSync(await download.path(), 'utf8');
  expect(content).toContain('Region,Sales,Status');
  expect(content).toContain('North,800,Closed');
  await selectRange('A1', 'C4');
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: 'Create pivot table', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create pivot table', exact: true });
  await dialog.getByRole('radio', { name: 'New worksheet', exact: true }).check();
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();
  const editor = page.getByRole('region', { name: 'Pivot table editor', exact: true });
  await selectOption(editor, 'Rows', 'Region');
  await selectOption(editor, 'Values', 'Sales');
  await selectOption(editor, 'Summarize by', 'SUM');
  await editor.getByRole('button', { name: 'Apply', exact: true }).click();
  const pivotTab = page.getByRole('tab', { name: 'Pivot1', exact: true });
  await expect(pivotTab).toBeVisible();
  await pivotTab.click();
  await expect(cell('A2')).toHaveText('East');
  await expect(cell('A3')).toHaveText('North');
  await expect(cell('A4')).toHaveText('South');
});

test('REQ-5-1-2#4: REQ-5-1-2 -the requested workflow', async ({ page }) => {
  await importWorkbook(page, BASE_CSV);
  await createFilter(page);
  await applyConditionFilter(page, 'Sales', 'Greater than', '750');
  await applyConditionFilter(page, 'Status', 'Text contains', 'pen');
  await expect(cell('A2')).toHaveText('East');
  await expect(cell('A3')).not.toBeVisible();
  await expect(cell('A4')).not.toBeVisible();
  await clearFilter(page);
  await expect(cell('A2')).toHaveText('East');
  await expect(cell('A3')).toHaveText('North');
  await expect(cell('A4')).toHaveText('South');
});

test('REQ-5-1-2#5: REQ-5-1-2 -the requested workflow', async ({ page }) => {
  await importWorkbook(page, DATE_CSV);
  await createFilter(page, 'A1', 'D4');
  await applyConditionFilter(page, 'Date', 'Before', '2023-02-01');
  await expect(cell('A2')).toHaveText('East');
  await expect(cell('A3')).not.toBeVisible();
  await expect(cell('A4')).toHaveText('South');
  await applyConditionFilter(page, 'Date', 'Is empty');
  await expect(cell('A2')).not.toBeVisible();
  await expect(cell('A3')).not.toBeVisible();
  await expect(cell('A4')).not.toBeVisible();
  await applyConditionFilter(page, 'Date', 'Is not empty');
  await expect(cell('A2')).toHaveText('East');
  await expect(cell('A3')).toHaveText('North');
  await expect(cell('A4')).toHaveText('South');
  await clearFilter(page);
  await expect(cell('A2')).toHaveText('East');
});

test('REQ-5-2-1: REQ-5-2-1 -the requested workflow A1:A2 the requested workflow,the requested workflow', async ({ page }) => {
  await importWorkbook(page, BASE_CSV);
  await selectRange('A1', 'A2');
  await setDropdownValidation(page, 'East, North, South');
  await enterCell(page, 'A2', 'West');
  await expect(page.getByText('Please select one of the following values: East, North, South', { exact: true })).toBeVisible();
  await expect(cell('A2')).toHaveText('East');
  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(cell('A2')).toHaveText('East');
  await page.getByRole('button', { name: 'Open dropdown for A2', exact: true }).click();
  await expect(page.getByRole('option', { name: 'East', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'North', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'South', exact: true })).toBeVisible();
});

test('REQ-5-2-1#2: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await importWorkbook(page, BASE_CSV);
  await selectRange('B2', 'B4');
  await setNumberValidation(page, 0, 100);
  await enterCell(page, 'B3', '101');
  await expect(page.getByText('Please enter a number from 0 to 100', { exact: true })).toBeVisible();
  await expect(cell('B3')).toHaveText('800');
  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await enterCell(page, 'B3', '101');
  await expect(page.getByText('Please enter a number from 0 to 100', { exact: true })).toBeVisible();
  await expect(cell('B3')).toHaveText('800');
});

test('REQ-5-2-1#3: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await importWorkbook(page, BASE_CSV);
  await selectRange('B2', 'B4');
  await setNumberValidation(page, 0, 100);
  const pasteText = '50\t60\n150\t160';
  await page.evaluate((t) => navigator.clipboard.writeText(t), pasteText);
  await cell('B2').click();
  await page.keyboard.press('Control+V');
  await expect(page.getByText('Please enter a number from 0 to 100', { exact: true })).toBeVisible();
  await expect(cell('B2')).toHaveText('1200');
  await expect(cell('B3')).toHaveText('800');
  await expect(cell('B4')).toHaveText('700');
  await expect(cell('C2')).toBeEmpty();
  await expect(cell('C3')).toBeEmpty();
});

test('REQ-5-2-1#4: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await importWorkbook(page, BASE_CSV);
  await selectRange('B2', 'B4');
  await setNumberValidation(page, 0, 100);
  await cell('B3').dblclick();
  const edit = page.getByLabel('Edit B3', { exact: true });
  await edit.fill('150');
  await edit.press('Enter');
  await expect(page.getByText('Please enter a number from 0 to 100', { exact: true })).toBeVisible();
  await expect(cell('B3')).toHaveText('800');
});

test('REQ-5-2-1#5: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await importWorkbook(page, BASE_CSV);
  await selectRange('A2', 'A4');
  await setDropdownValidation(page, 'East, North, South');
  await selectRange('A2', 'A4');
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: 'Data validation', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await expect(dialog.getByLabel('Rule type', { exact: true })).toContainText('Dropdown');
  await expect(dialog.getByLabel('Allowed values', { exact: true })).toHaveValue('East, North, South');
  await dialog.getByRole('button', { name: 'Delete rule', exact: true }).click();
  await enterCell(page, 'A2', 'West');
  await expect(cell('A2')).toHaveText('West');
});

test('REQ-5-2-1#6: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await importWorkbook(page, BASE_CSV);
  await selectRange('B2', 'B4');
  await setNumberValidation(page, 0, 100);
  await selectRange('B2', 'B4');
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: 'Data validation', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await dialog.getByLabel('Minimum', { exact: true }).fill('0');
  await dialog.getByLabel('Maximum', { exact: true }).fill('200');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await enterCell(page, 'B3', '150');
  await expect(cell('B3')).toHaveText('150');
  await expect(cell('B2')).toHaveText('1200');
  await expect(cell('B4')).toHaveText('700');
});

test('REQ-5-3-1: REQ-5-3-1 -the requested workflow Pivot1 the requested workflow Region the requested workflow Sales,the requested workflow', async ({ page }) => {
  await importWorkbook(page, BASE_CSV);
  await createPivot(page, { rows: 'Region', values: 'Sales', summarizeBy: 'SUM' });
  await expect(cell('A1')).toHaveText('Region');
  await expect(cell('B1')).toHaveText('SUM of Sales');
  await expect(cell('A2')).toHaveText('East');
  await expect(cell('B2')).toHaveText('1200');
  await expect(cell('A3')).toHaveText('North');
  await expect(cell('B3')).toHaveText('800');
  await expect(cell('A4')).toHaveText('South');
  await expect(cell('B4')).toHaveText('700');
  await expect(cell('A5')).toHaveText('Grand Total');
  await expect(cell('B5')).toHaveText('2700');
  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await goToSheet(page, 'Pivot1');
  await expect(cell('A2')).toHaveText('East');
  await expect(cell('B2')).toHaveText('1200');
  await expect(cell('B5')).toHaveText('2700');
});

test('REQ-5-3-1#2: REQ-5-3-1 -the requested workflow,the requested workflow', async ({ page }) => {
  await importWorkbook(page, BASE_CSV);
  await createPivot(page, { rows: 'Region', columns: 'Status', values: 'Sales', summarizeBy: 'SUM' });
  await expect(cell('A1')).toHaveText('Region');
  await expect(cell('B1')).toHaveText('Open');
  await expect(cell('C1')).toHaveText('Closed');
  await expect(cell('D1')).toHaveText('Grand Total');
  await expect(cell('A2')).toHaveText('East');
  await expect(cell('B2')).toHaveText('1200');
  await expect(cell('C2')).toBeEmpty();
  await expect(cell('D2')).toHaveText('1200');
  await expect(cell('A3')).toHaveText('North');
  await expect(cell('B3')).toBeEmpty();
  await expect(cell('C3')).toHaveText('800');
  await expect(cell('D3')).toHaveText('800');
  await expect(cell('A4')).toHaveText('South');
  await expect(cell('B4')).toHaveText('700');
  await expect(cell('C4')).toBeEmpty();
  await expect(cell('D4')).toHaveText('700');
  await expect(cell('A5')).toHaveText('Grand Total');
  await expect(cell('B5')).toHaveText('1900');
  await expect(cell('C5')).toHaveText('800');
  await expect(cell('D5')).toHaveText('2700');
});

test('REQ-5-3-1#3: REQ-5-3-1 -the requested workflow COUNT the requested workflow', async ({ page }) => {
  await importWorkbook(page, BASE_CSV);
  await createPivot(page, { rows: 'Region', values: 'Status', summarizeBy: 'COUNT' });
  await expect(cell('A1')).toHaveText('Region');
  await expect(cell('B1')).toHaveText('COUNT of Status');
  await expect(cell('A2')).toHaveText('East');
  await expect(cell('B2')).toHaveText('1');
  await expect(cell('A3')).toHaveText('North');
  await expect(cell('B3')).toHaveText('1');
  await expect(cell('A4')).toHaveText('South');
  await expect(cell('B4')).toHaveText('1');
  await expect(cell('A5')).toHaveText('Grand Total');
  await expect(cell('B5')).toHaveText('3');
});

test('REQ-5-3-1#4: REQ-5-3-1 -AVERAGE the requested workflow', async ({ page }) => {
  await importWorkbook(page, BASE_CSV);
  await createPivot(page, { rows: 'Region', values: 'Sales', summarizeBy: 'AVERAGE' });
  await expect(cell('A1')).toHaveText('Region');
  await expect(cell('B1')).toHaveText('AVERAGE of Sales');
  await expect(cell('A2')).toHaveText('East');
  await expect(cell('B2')).toHaveText('1200');
  await expect(cell('A3')).toHaveText('North');
  await expect(cell('B3')).toHaveText('800');
  await expect(cell('A4')).toHaveText('South');
  await expect(cell('B4')).toHaveText('700');
  await expect(cell('A5')).toHaveText('Grand Total');
  await expect(cell('B5')).toHaveText('900');
});

test('REQ-5-3-1#5: REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await importWorkbook(page, BASE_CSV);
  await createPivot(page, { rows: 'Region', values: 'Sales', summarizeBy: 'SUM' });
  await goToSheet(page, 'Sheet1');
  await enterCell(page, 'B2', '1500');
  await goToSheet(page, 'Pivot1');
  await expect(cell('B2')).toHaveText('1200');
  await page.getByRole('button', { name: 'Refresh pivot table', exact: true }).click();
  await expect(cell('B2')).toHaveText('1500');
  await expect(cell('B5')).toHaveText('3000');
});

test('REQ-5-3-1#6: REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await importWorkbook(page, BASE_CSV);
  await createPivot(page, { rows: 'Region', values: 'Sales', summarizeBy: 'SUM' });
  await goToSheet(page, 'Sheet1');
  await deleteColumn(page, 'B');
  await goToSheet(page, 'Pivot1');
  await page.getByRole('button', { name: 'Refresh pivot table', exact: true }).click();
  await expect(page.getByText('Pivot field is no longer available. Select a new field.', { exact: true })).toBeVisible();
  await expect(cell('B2')).toHaveText('1200');
});

test('REQ-5-3-1#7: REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await importWorkbook(page, BASE_CSV);
  await createPivot(page, { rows: 'Region', values: 'Sales', summarizeBy: 'SUM' });
  const editor = page.getByRole('region', { name: 'Pivot table editor', exact: true });
  await selectOption(editor, 'Values', 'Status');
  await editor.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByText('Value field requires numeric values', { exact: true })).toBeVisible();
  await expect(cell('B2')).toHaveText('1200');
});

test('REQ-5-3-1#8: REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await importWorkbook(page, BASE_CSV);
  await createPivot(page, { rows: 'Region', values: 'Sales', summarizeBy: 'SUM' });
  await goToSheet(page, 'Sheet1');
  await insertRowAbove(page, 2);
  await enterCell(page, 'A2', 'East');
  await enterCell(page, 'B2', '500');
  await enterCell(page, 'C2', 'Open');
  await goToSheet(page, 'Pivot1');
  await expect(cell('B2')).toHaveText('1200');
  await page.getByRole('button', { name: 'Refresh pivot table', exact: true }).click();
  await expect(cell('B2')).toHaveText('1700');
  await expect(cell('B5')).toHaveText('3200');
});

test('REQ-5-3-1#9: REQ-5-3-1 -the requested workflow COUNT the requested workflow', async ({ page }) => {
  await importWorkbook(page, BASE_CSV);
  await createPivot(page, { rows: 'Region', columns: 'Status', values: 'Sales', summarizeBy: 'COUNT' });
  await expect(cell('A1')).toHaveText('Region');
  await expect(cell('B1')).toHaveText('Open');
  await expect(cell('C1')).toHaveText('Closed');
  await expect(cell('D1')).toHaveText('Grand Total');
  await expect(cell('A2')).toHaveText('East');
  await expect(cell('B2')).toHaveText('1');
  await expect(cell('C2')).toHaveText('0');
  await expect(cell('D2')).toHaveText('1');
  await expect(cell('A3')).toHaveText('North');
  await expect(cell('B3')).toHaveText('0');
  await expect(cell('C3')).toHaveText('1');
  await expect(cell('D3')).toHaveText('1');
  await expect(cell('A4')).toHaveText('South');
  await expect(cell('B4')).toHaveText('1');
  await expect(cell('C4')).toHaveText('0');
  await expect(cell('D4')).toHaveText('1');
  await expect(cell('A5')).toHaveText('Grand Total');
  await expect(cell('B5')).toHaveText('2');
  await expect(cell('C5')).toHaveText('1');
  await expect(cell('D5')).toHaveText('3');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

