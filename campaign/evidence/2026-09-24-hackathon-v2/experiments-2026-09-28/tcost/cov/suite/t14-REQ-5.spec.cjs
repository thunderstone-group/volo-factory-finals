const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const os = require('os');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function cell(page, coord) {
  return page
    .getByRole('grid', { name: 'Worksheet grid', exact: true })
    .getByRole('gridcell', { name: coord, exact: true });
}

async function selectRange(page, start, end) {
  const grid = page.getByRole('grid', { name: 'Worksheet grid', exact: true });
  const startCell = grid.getByRole('gridcell', { name: start, exact: true });
  const endCell = grid.getByRole('gridcell', { name: end, exact: true });
  await expect(startCell).toBeVisible();
  await expect(endCell).toBeVisible();
  const startBox = await startCell.boundingBox();
  const endBox = await endCell.boundingBox();
  if (!startBox || !endBox) throw new Error('Cell bounding box unavailable');
  await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(endBox.x + endBox.width / 2, endBox.y + endBox.height / 2, { steps: 10 });
  await page.mouse.up();
}

async function openDataMenu(page) {
  await page.getByRole('button', { name: 'Data', exact: true }).click();
}

async function clickMenuItem(page, name) {
  await page.getByRole('menuitem', { name, exact: true }).click();
}

async function clearExistingFilter(page) {
  const filterRegionButton = page.getByRole('button', { name: 'Filter Region', exact: true });
  try {
    await filterRegionButton.waitFor({ state: 'visible', timeout: 1000 });
  } catch {
    return;
  }
  await openDataMenu(page);
  await clickMenuItem(page, 'Clear filter');
  await expect(filterRegionButton).toBeHidden();
}

async function openSeedWorkbook(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Q3 Sales', exact: true }).click();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await clearExistingFilter(page);
}

async function createFilter(page, start = 'A1', end = 'C6') {
  await selectRange(page, start, end);
  await openDataMenu(page);
  await clickMenuItem(page, 'Create filter');
  await expect(page.getByRole('button', { name: 'Filter Region', exact: true })).toBeVisible();
}

async function applyValueFilter(page, header, values) {
  const dialogName = `Filter ${header}`;
  await page.getByRole('button', { name: dialogName, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: dialogName, exact: true });
  await dialog.getByRole('button', { name: 'Clear selection', exact: true }).click();
  for (const value of values) {
    await dialog.getByRole('checkbox', { name: value, exact: true }).check();
  }
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(dialog).toBeHidden();
}

async function applyConditionFilter(page, header, condition, value) {
  const dialogName = `Filter ${header}`;
  await page.getByRole('button', { name: dialogName, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: dialogName, exact: true });
  await dialog.getByRole('combobox', { name: 'Condition', exact: true }).click();
  await dialog.getByRole('option', { name: condition, exact: true }).click();
  if (value !== undefined) {
    await dialog.getByRole('textbox', { name: 'Value', exact: true }).fill(value);
  }
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(dialog).toBeHidden();
}

async function clearFilter(page) {
  await openDataMenu(page);
  await clickMenuItem(page, 'Clear filter');
}

async function importCsvWorkbook(page, name, content) {
  const filePath = path.join(os.tmpdir(), `${name}.csv`);
  await fs.promises.writeFile(filePath, content, 'utf8');
  await page.goto('/');
  await page.getByRole('button', { name: 'Import CSV', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import CSV', exact: true });
  await dialog.getByLabel('CSV file', { exact: true }).setInputFiles(filePath);
  await dialog.getByRole('button', { name: 'Confirm import', exact: true }).click();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await fs.promises.unlink(filePath).catch(() => {});
}

async function selectComboOption(page, container, label, optionName) {
  const combo = container.getByRole('combobox', { name: label, exact: true });
  await combo.click();
  await page.getByRole('option', { name: optionName, exact: true }).click();
}

test('REQ-5-1-2: REQ-5-1-2 -the requested workflow Region the requested workflow Sales the requested workflow,the requested workflow', async ({ page }) => {
  await openSeedWorkbook(page);
  await createFilter(page);
  await applyValueFilter(page, 'Region', ['East']);
  await expect(cell(page, 'B2')).toBeVisible();
  await expect(cell(page, 'B3')).toBeHidden();
  await expect(cell(page, 'B4')).toBeHidden();

  await applyConditionFilter(page, 'Sales', 'Greater than', '1000');
  await expect(cell(page, 'B2')).toBeVisible();
  await expect(cell(page, 'B3')).toBeHidden();
  await expect(cell(page, 'B4')).toBeHidden();

  await page.reload();
  await expect(cell(page, 'A1')).toBeVisible();
  await expect(cell(page, 'B2')).toBeVisible();
  await expect(cell(page, 'B3')).toBeHidden();
  await expect(cell(page, 'B4')).toBeHidden();
});

test('REQ-5-1-2#2: REQ-5-1-2 -the requested workflow, the requested workflow,the requested workflow', async ({ page }) => {
  await openSeedWorkbook(page);
  await createFilter(page);

  await applyConditionFilter(page, 'Status', 'Text contains', 'Open');
  await expect(cell(page, 'B2')).toBeVisible();
  await expect(cell(page, 'B3')).toBeHidden();
  await expect(cell(page, 'B4')).toBeVisible();

  await applyConditionFilter(page, 'Region', 'Is not empty');
  await expect(cell(page, 'B2')).toBeVisible();
  await expect(cell(page, 'B3')).toBeHidden();
  await expect(cell(page, 'B4')).toBeVisible();

  await applyConditionFilter(page, 'Sales', 'Is empty');
  await expect(cell(page, 'B2')).toBeHidden();
  await expect(cell(page, 'B3')).toBeHidden();
  await expect(cell(page, 'B4')).toBeHidden();

  await clearFilter(page);
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'B3')).toHaveText('800');
  await expect(cell(page, 'B4')).toHaveText('700');

  await page.reload();
  await expect(cell(page, 'A1')).toBeVisible();
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'B3')).toHaveText('800');
  await expect(cell(page, 'B4')).toHaveText('700');
});

test('REQ-5-1-2#3: REQ-5-1-2 -CSV the requested workflow', async ({ page }) => {
  await openSeedWorkbook(page);
  await createFilter(page);
  await applyValueFilter(page, 'Region', ['East']);
  await expect(cell(page, 'B2')).toBeVisible();
  await expect(cell(page, 'B3')).toBeHidden();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
  const filePath = await download.path();
  const csv = fs.readFileSync(filePath, 'utf8');
  expect(csv).toContain('North');
  expect(csv).toContain('South');

  await expect(cell(page, 'B2')).toBeVisible();
  await expect(cell(page, 'B3')).toBeHidden();

  await page.reload();
  await expect(cell(page, 'A1')).toBeVisible();
  await expect(cell(page, 'B2')).toBeVisible();
  await expect(cell(page, 'B3')).toBeHidden();
});

test('REQ-5-1-2#4: REQ-5-1-2 -the requested workflow', async ({ page }) => {
  const name = 'Dates-' + u();
  await importCsvWorkbook(
    page,
    name,
    'Region,Date,Sales,Status\nEast,2024-01-15,1200,Open\nNorth,2024-02-01,800,Closed\nSouth,2024-03-10,700,Open\n'
  );

  await createFilter(page, 'A1', 'D4');
  await applyConditionFilter(page, 'Date', 'Before', '2024-03-01');

  await expect(cell(page, 'B2')).toHaveText('2024-01-15');
  await expect(cell(page, 'B3')).toHaveText('2024-02-01');
  await expect(cell(page, 'B4')).toBeHidden();

  await page.reload();
  await expect(cell(page, 'A1')).toBeVisible();
  await expect(cell(page, 'B2')).toHaveText('2024-01-15');
  await expect(cell(page, 'B3')).toHaveText('2024-02-01');
  await expect(cell(page, 'B4')).toBeHidden();
});

test('REQ-5-1-2#5: REQ-5-1-2 -the requested workflow', async ({ page }) => {
  await openSeedWorkbook(page);
  await createFilter(page, 'A1', 'C4');
  await applyValueFilter(page, 'Region', ['East']);
  await expect(cell(page, 'B2')).toBeVisible();
  await expect(cell(page, 'B3')).toBeHidden();

  await openDataMenu(page);
  await clickMenuItem(page, 'Create pivot table');
  const dialog = page.getByRole('dialog', { name: 'Create pivot table', exact: true });
  await expect(dialog.getByText('Source range: A1:C4', { exact: true })).toBeVisible();
  await dialog.getByRole('radio', { name: 'New worksheet', exact: true }).check();
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();

  const pivotTab = page.getByRole('tab', { name: 'Pivot1', exact: true });
  await expect(pivotTab).toHaveAttribute('aria-selected', 'true');

  const editor = page.getByRole('region', { name: 'Pivot table editor', exact: true });
  await expect(editor).toBeVisible();
  await selectComboOption(page, editor, 'Rows', 'Region');
  await selectComboOption(page, editor, 'Values', 'Sales');
  await selectComboOption(page, editor, 'Summarize by', 'SUM');
  await editor.getByRole('button', { name: 'Apply', exact: true }).click();

  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'A4')).toHaveText('South');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Pivot1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A3')).toHaveText('North');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

