const { test, expect } = require('@playwright/test');
const fs = require('fs');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const GRID = 'Worksheet grid';
const SALES_TSV = 'Region\tSales\tStatus\nEast\t1200\tOpen\nNorth\t800\tClosed\nSouth\t700\tOpen';

function grid(page) {
  return page.getByRole('grid', { name: GRID, exact: true });
}

function cell(page, coord) {
  return grid(page).getByRole('gridcell', { name: coord, exact: true });
}

async function createWorkbook(page) {
  const name = 'W' + u();
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await grid(page).waitFor();
  await page.getByRole('button', { name: 'Rename workbook', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Rename workbook', exact: true });
  await dialog.getByLabel('Workbook name', { exact: true }).fill(name);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
}

async function clickCell(page, coord) {
  await cell(page, coord).click();
}

async function selectRange(page, start, end) {
  const s = cell(page, start);
  const e = cell(page, end);
  await s.scrollIntoViewIfNeeded();
  const sb = await s.boundingBox();
  if (!sb) throw new Error('No bounding box for ' + start);
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.mouse.down();
  await e.scrollIntoViewIfNeeded();
  const eb = await e.boundingBox();
  if (!eb) throw new Error('No bounding box for ' + end);
  await page.mouse.move(eb.x + eb.width / 2, eb.y + eb.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(cell(page, start)).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, end)).toHaveAttribute('aria-selected', 'true');
}

async function enterCellValue(page, coord, value) {
  await clickCell(page, coord);
  const bar = page.getByLabel('Formula bar', { exact: true });
  await bar.fill(value);
  await bar.press('Enter');
}

async function populateSalesData(page) {
  await page.evaluate((t) => navigator.clipboard.writeText(t), SALES_TSV);
  await clickCell(page, 'A1');
  await page.keyboard.press('ControlOrMeta+V');
  await expect(cell(page, 'A4')).toHaveText('South');
  await expect(cell(page, 'B4')).toHaveText('700');
}

async function openDataMenu(page, command) {
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByRole('menuitem', { name: command, exact: true }).click();
}

async function chooseOption(page, container, label, optionLabel) {
  const combo = container.getByLabel(label, { exact: true });
  const tag = await combo.evaluate((el) => el.tagName);
  if (tag === 'SELECT') {
    await combo.selectOption({ label: optionLabel });
  } else {
    await combo.click();
    await page.getByRole('option', { name: optionLabel, exact: true }).click();
  }
}

async function switchToSheet(page, name) {
  await page.getByRole('tab', { name, exact: true }).click();
  await expect(page.getByRole('tab', { name, exact: true })).toHaveAttribute('aria-selected', 'true');
}

async function expectFormulaBar(page, coord, value) {
  await clickCell(page, coord);
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue(value);
}

async function applyDropdownValidation(page, start, end, allowed) {
  await selectRange(page, start, end);
  await openDataMenu(page, 'Data validation');
  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await chooseOption(page, dialog, 'Rule type', 'Dropdown');
  await dialog.getByLabel('Allowed values', { exact: true }).fill(allowed);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
}

async function applyNumberValidation(page, start, end, min, max) {
  await selectRange(page, start, end);
  await openDataMenu(page, 'Data validation');
  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await chooseOption(page, dialog, 'Rule type', 'Number range');
  await dialog.getByLabel('Minimum', { exact: true }).fill(String(min));
  await dialog.getByLabel('Maximum', { exact: true }).fill(String(max));
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
}

async function createPivot(page, { rows = 'Region', cols = null, values = 'Sales', summarize = 'SUM' } = {}) {
  await selectRange(page, 'A1', 'C4');
  await openDataMenu(page, 'Create pivot table');
  const dialog = page.getByRole('dialog', { name: 'Create pivot table', exact: true });
  await expect(dialog.getByText('Source range: A1:C4', { exact: true })).toBeVisible();
  await dialog.getByRole('radio', { name: 'New worksheet', exact: true }).check();
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();
  const editor = page.getByRole('region', { name: 'Pivot table editor', exact: true });
  await expect(editor).toBeVisible();
  await chooseOption(page, editor, 'Rows', rows);
  if (cols) await chooseOption(page, editor, 'Columns', cols);
  await chooseOption(page, editor, 'Values', values);
  await chooseOption(page, editor, 'Summarize by', summarize);
  await editor.getByRole('button', { name: 'Apply', exact: true }).click();
}

test('REQ-5-1-1: REQ-5-1-1 -the requested workflow Sales the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await populateSalesData(page);
  await selectRange(page, 'A1', 'C4');
  await openDataMenu(page, 'Sort range');
  const dialog = page.getByRole('dialog', { name: 'Sort range', exact: true });
  await chooseOption(page, dialog, 'Sort by', 'Sales');
  await chooseOption(page, dialog, 'Order', 'Ascending');
  await dialog.getByRole('checkbox', { name: 'Data has header row', exact: true }).check();
  await dialog.getByRole('button', { name: 'Sort', exact: true }).click();
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
});

test('REQ-5-1-1#2: REQ-5-1-1 -the requested workflow ISO the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await populateSalesData(page);
  await selectRange(page, 'A1', 'C4');
  await openDataMenu(page, 'Sort range');
  const dialog = page.getByRole('dialog', { name: 'Sort range', exact: true });
  await chooseOption(page, dialog, 'Sort by', 'Sales');
  await chooseOption(page, dialog, 'Order', 'Descending');
  await dialog.getByRole('checkbox', { name: 'Data has header row', exact: true }).check();
  await dialog.getByRole('button', { name: 'Sort', exact: true }).click();
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

test('REQ-5-1-1#3: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await populateSalesData(page);
  await selectRange(page, 'A1', 'C4');
  await openDataMenu(page, 'Sort range');
  const dialog = page.getByRole('dialog', { name: 'Sort range', exact: true });
  await chooseOption(page, dialog, 'Sort by', 'Region');
  await chooseOption(page, dialog, 'Order', 'Descending');
  await dialog.getByRole('checkbox', { name: 'Data has header row', exact: true }).check();
  await dialog.getByRole('button', { name: 'Sort', exact: true }).click();
  await expect(cell(page, 'A2')).toHaveText('South');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'A4')).toHaveText('East');
  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('South');
  await expect(cell(page, 'A4')).toHaveText('East');
});

test('REQ-5-1-1#4: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await populateSalesData(page);
  await selectRange(page, 'A1', 'C4');
  await openDataMenu(page, 'Sort range');
  const dialog = page.getByRole('dialog', { name: 'Sort range', exact: true });
  await chooseOption(page, dialog, 'Sort by', 'Status');
  await chooseOption(page, dialog, 'Order', 'Ascending');
  await dialog.getByRole('checkbox', { name: 'Data has header row', exact: true }).check();
  await dialog.getByRole('button', { name: 'Sort', exact: true }).click();
  await expect(cell(page, 'A2')).toHaveText('North');
  await expect(cell(page, 'C2')).toHaveText('Closed');
  await expect(cell(page, 'A3')).toHaveText('East');
  await expect(cell(page, 'C3')).toHaveText('Open');
  await expect(cell(page, 'A4')).toHaveText('South');
  await expect(cell(page, 'C4')).toHaveText('Open');
  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('North');
  await expect(cell(page, 'A4')).toHaveText('South');
});

test('REQ-5-1-1#5: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  const tsv = 'Region\tSales\tStatus\tNote\nEast\t1200\tOpen\tx\nNorth\t800\tClosed\ty\nSouth\t700\tOpen\tz';
  await page.evaluate((t) => navigator.clipboard.writeText(t), tsv);
  await clickCell(page, 'A1');
  await page.keyboard.press('ControlOrMeta+V');
  await expect(cell(page, 'D4')).toHaveText('z');
  await selectRange(page, 'A1', 'C4');
  await openDataMenu(page, 'Sort range');
  const dialog = page.getByRole('dialog', { name: 'Sort range', exact: true });
  await chooseOption(page, dialog, 'Sort by', 'Sales');
  await chooseOption(page, dialog, 'Order', 'Ascending');
  await dialog.getByRole('checkbox', { name: 'Data has header row', exact: true }).check();
  await dialog.getByRole('button', { name: 'Sort', exact: true }).click();
  await expect(cell(page, 'A2')).toHaveText('South');
  await expect(cell(page, 'D2')).toHaveText('x');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'D3')).toHaveText('y');
  await expect(cell(page, 'A4')).toHaveText('East');
  await expect(cell(page, 'D4')).toHaveText('z');
  await page.reload();
  await expect(cell(page, 'D2')).toHaveText('x');
  await expect(cell(page, 'A4')).toHaveText('East');
});

test('REQ-5-1-1#6: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await populateSalesData(page);
  await selectRange(page, 'A1', 'C4');
  await openDataMenu(page, 'Sort range');
  const dialog = page.getByRole('dialog', { name: 'Sort range', exact: true });
  await chooseOption(page, dialog, 'Sort by', 'Region');
  await chooseOption(page, dialog, 'Order', 'Ascending');
  await dialog.getByRole('checkbox', { name: 'Data has header row', exact: true }).check();
  await dialog.getByRole('button', { name: 'Sort', exact: true }).click();
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'A4')).toHaveText('South');
  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'A4')).toHaveText('South');
});

test('REQ-5-1-2: REQ-5-1-2 -the requested workflow Region the requested workflow Sales the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await populateSalesData(page);
  await selectRange(page, 'A1', 'C4');
  await openDataMenu(page, 'Create filter');
  await page.getByRole('button', { name: 'Filter Region', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Filter Region', exact: true });
  await dialog.getByRole('button', { name: 'Clear selection', exact: true }).click();
  await dialog.getByRole('checkbox', { name: 'East', exact: true }).check();
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(cell(page, 'A2')).toBeVisible();
  await expect(cell(page, 'A3')).toBeHidden();
  await expect(cell(page, 'A4')).toBeHidden();
  await page.reload();
  await expect(cell(page, 'A2')).toBeVisible();
  await expect(cell(page, 'A3')).toBeHidden();
  await expect(cell(page, 'A4')).toBeHidden();
});

test('REQ-5-1-2#2: REQ-5-1-2 -the requested workflow, the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await populateSalesData(page);
  await selectRange(page, 'A1', 'C4');
  await openDataMenu(page, 'Create filter');
  await page.getByRole('button', { name: 'Filter Sales', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Filter Sales', exact: true });
  await chooseOption(page, dialog, 'Condition', 'Greater than');
  await dialog.getByLabel('Value', { exact: true }).fill('1000');
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(cell(page, 'A2')).toBeVisible();
  await expect(cell(page, 'A3')).toBeHidden();
  await expect(cell(page, 'A4')).toBeHidden();
  await page.reload();
  await expect(cell(page, 'A2')).toBeVisible();
  await expect(cell(page, 'A3')).toBeHidden();
  await expect(cell(page, 'A4')).toBeHidden();
});

test('REQ-5-1-2#3: REQ-5-1-2 -CSV the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await populateSalesData(page);
  await selectRange(page, 'A1', 'C4');
  await openDataMenu(page, 'Create filter');
  await page.getByRole('button', { name: 'Filter Region', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Filter Region', exact: true });
  await dialog.getByRole('button', { name: 'Clear selection', exact: true }).click();
  await dialog.getByRole('checkbox', { name: 'East', exact: true }).check();
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(cell(page, 'A2')).toBeVisible();
  await expect(cell(page, 'A3')).toBeHidden();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
  const path = await download.path();
  const csv = fs.readFileSync(path, 'utf8');
  expect(csv).toContain('Region');
  expect(csv).toContain('East');
  expect(csv).toContain('North');
  expect(csv).toContain('South');
  await expect(cell(page, 'A2')).toBeVisible();
  await expect(cell(page, 'A3')).toBeHidden();
  await expect(cell(page, 'A4')).toBeHidden();
});

test('REQ-5-1-2#4: REQ-5-1-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await populateSalesData(page);
  await selectRange(page, 'A1', 'C4');
  await openDataMenu(page, 'Create filter');
  await page.getByRole('button', { name: 'Filter Region', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Filter Region', exact: true });
  await dialog.getByRole('button', { name: 'Clear selection', exact: true }).click();
  await dialog.getByRole('checkbox', { name: 'East', exact: true }).check();
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(cell(page, 'A3')).toBeHidden();
  await openDataMenu(page, 'Clear filter');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'A4')).toHaveText('South');
  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'A4')).toHaveText('South');
});

test('REQ-5-1-2#5: REQ-5-1-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await populateSalesData(page);
  await selectRange(page, 'A1', 'C4');
  await openDataMenu(page, 'Create filter');
  await page.getByRole('button', { name: 'Filter Status', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Filter Status', exact: true });
  await chooseOption(page, dialog, 'Condition', 'Text contains');
  await dialog.getByLabel('Value', { exact: true }).fill('pen');
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(cell(page, 'A2')).toBeVisible();
  await expect(cell(page, 'A3')).toBeHidden();
  await expect(cell(page, 'A4')).toBeVisible();
  await page.reload();
  await expect(cell(page, 'A2')).toBeVisible();
  await expect(cell(page, 'A3')).toBeHidden();
  await expect(cell(page, 'A4')).toBeVisible();
});

test('REQ-5-2-1: REQ-5-2-1 -the requested workflow A1:A2 the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await populateSalesData(page);
  await applyDropdownValidation(page, 'A2', 'A3', 'East, North');
  await page.getByRole('button', { name: 'Open dropdown for A2', exact: true }).click();
  await expect(page.getByRole('option', { name: 'East', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'North', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await enterCellValue(page, 'A2', 'West');
  await expect(page.getByText('Please select one of the following values: East, North', { exact: true })).toBeVisible();
  await expect(cell(page, 'A2')).toHaveText('East');
  await expectFormulaBar(page, 'A2', 'East');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Open dropdown for A2', exact: true })).toBeVisible();
});

test('REQ-5-2-1#2: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await populateSalesData(page);
  await applyNumberValidation(page, 'D2', 'D3', '5', '10');
  await enterCellValue(page, 'D2', '11');
  await expect(page.getByText('Please enter a number between 5 and 10', { exact: true })).toBeVisible();
  await expect(cell(page, 'D2')).toHaveText('');
  await expectFormulaBar(page, 'D2', '');
  await enterCellValue(page, 'D2', '6');
  await expect(cell(page, 'D2')).toHaveText('6');
  await page.reload();
  await expect(cell(page, 'D2')).toHaveText('6');
});

test('REQ-5-2-1#3: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await populateSalesData(page);
  await applyNumberValidation(page, 'B2', 'B3', '0', '100');
  await enterCellValue(page, 'B3', '101');
  await expect(page.getByText('Please enter a number from 0 to 100', { exact: true })).toBeVisible();
  await expect(cell(page, 'B3')).toHaveText('800');
  await expectFormulaBar(page, 'B3', '800');
});

test('REQ-5-2-1#4: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await populateSalesData(page);
  await applyDropdownValidation(page, 'A2', 'A3', 'East, North');
  await page.evaluate(() => navigator.clipboard.writeText('West\t900'));
  await clickCell(page, 'A2');
  await page.keyboard.press('ControlOrMeta+V');
  await expect(page.getByText('Please select one of the following values: East, North', { exact: true })).toBeVisible();
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1200');
});

test('REQ-5-2-1#5: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await populateSalesData(page);
  await applyDropdownValidation(page, 'A2', 'A3', 'East, North');
  await selectRange(page, 'A2', 'A3');
  await openDataMenu(page, 'Data validation');
  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await expect(dialog.getByLabel('Allowed values', { exact: true })).toHaveValue('East, North');
  await dialog.getByRole('button', { name: 'Delete rule', exact: true }).click();
  await enterCellValue(page, 'A2', 'West');
  await expect(cell(page, 'A2')).toHaveText('West');
  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('West');
  await expect(page.getByRole('button', { name: 'Open dropdown for A2', exact: true })).toBeHidden();
});

test('REQ-5-2-1#6: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await populateSalesData(page);
  await applyNumberValidation(page, 'D2', 'D3', '0', '100');
  await selectRange(page, 'D2', 'D3');
  await openDataMenu(page, 'Data validation');
  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await dialog.getByLabel('Maximum', { exact: true }).fill('200');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await enterCellValue(page, 'D2', '150');
  await expect(cell(page, 'D2')).toHaveText('150');
  await enterCellValue(page, 'D2', '250');
  await expect(page.getByText('Please enter a number between 0 and 200', { exact: true })).toBeVisible();
  await expect(cell(page, 'D2')).toHaveText('150');
});

test('REQ-5-3-1: REQ-5-3-1 -the requested workflow Pivot1 the requested workflow Region the requested workflow Sales,the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await populateSalesData(page);
  await createPivot(page, { rows: 'Region', values: 'Sales', summarize: 'SUM' });
  await expect(page.getByRole('tab', { name: 'Pivot1', exact: true })).toHaveAttribute('aria-selected', 'true');
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
  await expect(cell(page, 'B5')).toHaveText('2700');
});

test('REQ-5-3-1#2: REQ-5-3-1 -the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await populateSalesData(page);
  await createPivot(page, { rows: 'Region', cols: 'Status', values: 'Sales', summarize: 'SUM' });
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('Open');
  await expect(cell(page, 'C1')).toHaveText('Closed');
  await expect(cell(page, 'D1')).toHaveText('Grand Total');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'D2')).toHaveText('1200');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'C3')).toHaveText('800');
  await expect(cell(page, 'D3')).toHaveText('800');
  await expect(cell(page, 'A4')).toHaveText('South');
  await expect(cell(page, 'B4')).toHaveText('700');
  await expect(cell(page, 'D4')).toHaveText('700');
  await expect(cell(page, 'B5')).toHaveText('1900');
  await expect(cell(page, 'C5')).toHaveText('800');
  await expect(cell(page, 'D5')).toHaveText('2700');
});

test('REQ-5-3-1#3: REQ-5-3-1 -the requested workflow COUNT the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await populateSalesData(page);
  await createPivot(page, { rows: 'Region', values: 'Sales', summarize: 'COUNT' });
  await expect(cell(page, 'B1')).toHaveText('COUNT of Sales');
  await expect(cell(page, 'B2')).toHaveText('1');
  await expect(cell(page, 'B3')).toHaveText('1');
  await expect(cell(page, 'B4')).toHaveText('1');
  await expect(cell(page, 'B5')).toHaveText('3');
});

test('REQ-5-3-1#4: REQ-5-3-1 -AVERAGE the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await populateSalesData(page);
  await createPivot(page, { rows: 'Region', values: 'Sales', summarize: 'AVERAGE' });
  await expect(cell(page, 'B1')).toHaveText('AVERAGE of Sales');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'B3')).toHaveText('800');
  await expect(cell(page, 'B4')).toHaveText('700');
  await expect(cell(page, 'B5')).toHaveText('900');
});

test('REQ-5-3-1#5: REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await populateSalesData(page);
  await createPivot(page, { rows: 'Region', values: 'Sales', summarize: 'SUM' });
  await expect(cell(page, 'B5')).toHaveText('2700');
  await switchToSheet(page, 'Sheet1');
  await enterCellValue(page, 'B2', '1500');
  await switchToSheet(page, 'Pivot1');
  await expect(cell(page, 'B5')).toHaveText('2700');
  await page.getByRole('button', { name: 'Refresh pivot table', exact: true }).click();
  await expect(cell(page, 'B5')).toHaveText('3000');
  await page.reload();
  await expect(cell(page, 'B5')).toHaveText('3000');
});

test('REQ-5-3-1#6: REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await populateSalesData(page);
  await createPivot(page, { rows: 'Region', values: 'Sales', summarize: 'SUM' });
  await expect(cell(page, 'B5')).toHaveText('2700');
  await switchToSheet(page, 'Sheet1');
  const header = page.getByRole('columnheader', { name: 'A', exact: true });
  await header.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete column', exact: true }).click();
  await switchToSheet(page, 'Pivot1');
  await page.getByRole('button', { name: 'Refresh pivot table', exact: true }).click();
  await expect(page.getByText('Pivot field is no longer available. Select a new field.', { exact: true })).toBeVisible();
  await expect(cell(page, 'B5')).toHaveText('2700');
});

test('REQ-5-3-1#7: REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await populateSalesData(page);
  await createPivot(page, { rows: 'Region', values: 'Status', summarize: 'SUM' });
  await expect(page.getByText('Value field requires numeric values', { exact: true })).toBeVisible();
  await switchToSheet(page, 'Sheet1');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1200');
});

test('REQ-5-3-1#8: REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await populateSalesData(page);
  await createPivot(page, { rows: 'Region', values: 'Status', summarize: 'COUNT' });
  await expect(cell(page, 'B1')).toHaveText('COUNT of Status');
  await expect(cell(page, 'B2')).toHaveText('1');
  await expect(cell(page, 'B3')).toHaveText('1');
  await expect(cell(page, 'B4')).toHaveText('1');
  await expect(cell(page, 'B5')).toHaveText('3');
});

test('REQ-5-3-1#9: REQ-5-3-1 -the requested workflow COUNT the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await populateSalesData(page);
  await createPivot(page, { rows: 'Region', cols: 'Status', values: 'Status', summarize: 'COUNT' });
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('Open');
  await expect(cell(page, 'C1')).toHaveText('Closed');
  await expect(cell(page, 'D1')).toHaveText('Grand Total');
  await expect(cell(page, 'B2')).toHaveText('1');
  await expect(cell(page, 'C2')).toHaveText('0');
  await expect(cell(page, 'D2')).toHaveText('1');
  await expect(cell(page, 'B3')).toHaveText('0');
  await expect(cell(page, 'C3')).toHaveText('1');
  await expect(cell(page, 'D3')).toHaveText('1');
  await expect(cell(page, 'B4')).toHaveText('1');
  await expect(cell(page, 'C4')).toHaveText('0');
  await expect(cell(page, 'D4')).toHaveText('1');
  await expect(cell(page, 'B5')).toHaveText('2');
  await expect(cell(page, 'C5')).toHaveText('1');
  await expect(cell(page, 'D5')).toHaveText('3');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

