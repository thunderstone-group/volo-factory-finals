const { test, expect } = require('@playwright/test');

function gridCell(page, col, row) {
  return page.getByRole('gridcell', { name: `${col}${row}`, exact: true });
}

async function openWorkbook(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Q3 Sales', exact: true }).click();
  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  if (await page.getByRole('button', { name: 'Filter Region', exact: true }).count()) {
    await clearFilter(page);
    await expect(gridCell(page, 'A', 2)).toBeVisible();
  }
}

async function openDataMenu(page) {
  await page.getByRole('button', { name: 'Data', exact: true }).click();
}

async function clearFilter(page) {
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: 'Clear filter', exact: true }).click();
}

async function createFilter(page) {
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: 'Create filter', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Filter Region', exact: true })).toBeVisible();
}

async function applyValueFilter(page, header, values) {
  await page.getByRole('button', { name: `Filter ${header}`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: `Filter ${header}`, exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Clear selection', exact: true }).click();
  for (const value of values) {
    await dialog.getByRole('checkbox', { name: value, exact: true }).click();
  }
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
}

async function applyConditionFilter(page, header, condition, value) {
  await page.getByRole('button', { name: `Filter ${header}`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: `Filter ${header}`, exact: true });
  await expect(dialog).toBeVisible();
  const conditionCombo = dialog.getByRole('combobox', { name: 'Condition', exact: true });
  await conditionCombo.click();
  await page.getByRole('option', { name: condition, exact: true }).click();
  if (value !== undefined) {
    await dialog.getByLabel('Value', { exact: true }).fill(value);
  }
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
}

async function expectAllDataRowsVisible(page) {
  await expect(gridCell(page, 'A', 2)).toBeVisible();
  await expect(gridCell(page, 'A', 3)).toBeVisible();
  await expect(gridCell(page, 'A', 4)).toBeVisible();
}

async function reloadEditor(page) {
  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
}

test('REQ-5-1-2: REQ-5-1-2 -the requested workflow Region the requested workflow Sales the requested workflow,the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await createFilter(page);

  await applyValueFilter(page, 'Region', ['East', 'South']);
  await expect(gridCell(page, 'A', 2)).toBeVisible();
  await expect(gridCell(page, 'A', 4)).toBeVisible();
  await expect(gridCell(page, 'A', 3)).not.toBeVisible();

  await applyConditionFilter(page, 'Sales', 'Greater than', '1000');
  await expect(gridCell(page, 'A', 2)).toBeVisible();
  await expect(gridCell(page, 'A', 3)).not.toBeVisible();
  await expect(gridCell(page, 'A', 4)).not.toBeVisible();

  await clearFilter(page);
  await expectAllDataRowsVisible(page);
});

test('REQ-5-1-2#2: REQ-5-1-2 -the requested workflow, the requested workflow,the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await createFilter(page);

  await applyConditionFilter(page, 'Status', 'Text contains', 'Open');
  await expect(gridCell(page, 'A', 2)).toBeVisible();
  await expect(gridCell(page, 'A', 4)).toBeVisible();
  await expect(gridCell(page, 'A', 3)).not.toBeVisible();

  await clearFilter(page);
  await expectAllDataRowsVisible(page);
});

test('REQ-5-1-2#3: REQ-5-1-2 -CSV the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await createFilter(page);

  await applyValueFilter(page, 'Region', ['North']);
  await expect(gridCell(page, 'A', 3)).toBeVisible();
  await expect(gridCell(page, 'A', 2)).not.toBeVisible();
  await expect(gridCell(page, 'A', 4)).not.toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.csv$/);

  const chunks = [];
  for await (const chunk of download.createReadStream()) {
    chunks.push(Buffer.from(chunk));
  }
  const csv = Buffer.concat(chunks).toString('utf8').replace(/\r\n/g, '\n');
  expect(csv).toContain('Region,Sales,Status');
  expect(csv).toContain('East,1200,Open');
  expect(csv).toContain('North,800,Closed');
  expect(csv).toContain('South,700,Open');
  expect(csv.indexOf('East,1200,Open')).toBeLessThan(csv.indexOf('North,800,Closed'));
  expect(csv.indexOf('North,800,Closed')).toBeLessThan(csv.indexOf('South,700,Open'));

  await expect(gridCell(page, 'A', 3)).toBeVisible();
  await expect(gridCell(page, 'A', 2)).not.toBeVisible();
  await expect(gridCell(page, 'A', 4)).not.toBeVisible();

  await reloadEditor(page);
  await expect(page.getByRole('button', { name: 'Filter Region', exact: true })).toBeVisible();
  await expect(gridCell(page, 'A', 3)).toBeVisible();
  await expect(gridCell(page, 'A', 2)).not.toBeVisible();
  await expect(gridCell(page, 'A', 4)).not.toBeVisible();

  await clearFilter(page);
  await expectAllDataRowsVisible(page);
});

test('REQ-5-1-2#4: REQ-5-1-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await createFilter(page);

  await applyValueFilter(page, 'Region', ['East']);
  await expect(gridCell(page, 'A', 2)).toBeVisible();
  await expect(gridCell(page, 'A', 3)).not.toBeVisible();
  await expect(gridCell(page, 'A', 4)).not.toBeVisible();

  await reloadEditor(page);
  await expect(page.getByRole('button', { name: 'Filter Region', exact: true })).toBeVisible();
  await expect(gridCell(page, 'A', 2)).toBeVisible();
  await expect(gridCell(page, 'A', 3)).not.toBeVisible();
  await expect(gridCell(page, 'A', 4)).not.toBeVisible();

  await clearFilter(page);
  await expectAllDataRowsVisible(page);
});

test('REQ-5-1-2#5: REQ-5-1-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await createFilter(page);

  await applyValueFilter(page, 'Region', ['North']);
  await expect(gridCell(page, 'A', 3)).toBeVisible();
  await expect(gridCell(page, 'A', 2)).not.toBeVisible();
  await expect(gridCell(page, 'A', 4)).not.toBeVisible();

  await clearFilter(page);
  await expectAllDataRowsVisible(page);
  await expect(gridCell(page, 'A', 2)).toHaveText('East');
  await expect(gridCell(page, 'A', 3)).toHaveText('North');
  await expect(gridCell(page, 'A', 4)).toHaveText('South');

  await reloadEditor(page);
  await expectAllDataRowsVisible(page);
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

