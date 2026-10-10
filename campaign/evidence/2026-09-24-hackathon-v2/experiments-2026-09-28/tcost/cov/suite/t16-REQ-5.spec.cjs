const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function createWorkbookWithData(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Import CSV', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import CSV', exact: true });
  const name = `pivot-${u()}.csv`;
  const csv = [
    'Region,Sales,Status',
    'East,1200,Open',
    'North,800,Closed',
    'South,700,Open',
  ].join('\n') + '\n';
  await dialog.getByLabel('CSV file', { exact: true }).setInputFiles({
    name,
    mimeType: 'text/csv',
    buffer: Buffer.from(csv, 'utf8'),
  });
  await dialog.getByRole('button', { name: 'Confirm import', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await expect(page.getByRole('gridcell', { name: 'A1', exact: true })).toHaveText('Region');
}

async function selectRange(page, start, end) {
  const startLoc = page.getByRole('gridcell', { name: start, exact: true });
  const endLoc = page.getByRole('gridcell', { name: end, exact: true });
  await startLoc.click();
  const startBox = await startLoc.boundingBox();
  const endBox = await endLoc.boundingBox();
  if (!startBox || !endBox) {
    throw new Error(`Could not locate grid cells for range ${start}:${end}`);
  }
  await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(endBox.x + endBox.width / 2, endBox.y + endBox.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect(endLoc).toHaveAttribute('aria-selected', 'true');
}

async function selectCombobox(page, scope, label, optionName) {
  await scope.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: optionName, exact: true }).click();
}

async function createPivot(page, { rows, columns, values, summarize }) {
  await selectRange(page, 'A1', 'C6');
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Create pivot table', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create pivot table', exact: true });
  await expect(dialog.getByText('Source range: A1:C6', { exact: true })).toBeVisible();
  await dialog.getByRole('radio', { name: 'New worksheet', exact: true }).click();
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();

  const pivotTab = page.getByRole('tab', { name: 'Pivot1', exact: true });
  await expect(pivotTab).toBeVisible();
  if ((await pivotTab.getAttribute('aria-selected')) !== 'true') {
    await pivotTab.click();
  }

  const editor = page.getByRole('region', { name: 'Pivot table editor', exact: true });
  await expect(editor).toBeVisible();
  await selectCombobox(page, editor, 'Rows', rows);
  if (columns) {
    await selectCombobox(page, editor, 'Columns', columns);
  }
  await selectCombobox(page, editor, 'Values', values);
  await selectCombobox(page, editor, 'Summarize by', summarize);
  await editor.getByRole('button', { name: 'Apply', exact: true }).click();
}

async function expectCell(page, coordinate, value) {
  await expect(page.getByRole('gridcell', { name: coordinate, exact: true })).toHaveText(value);
}

async function fillCell(page, coordinate, value) {
  await page.getByRole('gridcell', { name: coordinate, exact: true }).click();
  await page.getByLabel('Formula bar', { exact: true }).fill(value);
  await page.getByLabel('Formula bar', { exact: true }).press('Enter');
  await expect(page.getByRole('gridcell', { name: coordinate, exact: true })).toHaveText(value);
}

test('REQ-5-3-1 -the requested workflow Pivot1 the requested workflow Region the requested workflow Sales,the requested workflow', async ({ page }) => {
  await createWorkbookWithData(page);
  await createPivot(page, { rows: 'Region', values: 'Sales', summarize: 'SUM' });

  await expectCell(page, 'A1', 'Region');
  await expectCell(page, 'B1', 'SUM of Sales');
  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'B2', '1200');
  await expectCell(page, 'A3', 'North');
  await expectCell(page, 'B3', '800');
  await expectCell(page, 'A4', 'South');
  await expectCell(page, 'B4', '700');
  await expectCell(page, 'A5', 'Grand Total');
  await expectCell(page, 'B5', '2700');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Pivot1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expectCell(page, 'A1', 'Region');
  await expectCell(page, 'B1', 'SUM of Sales');
  await expectCell(page, 'B2', '1200');
  await expectCell(page, 'B5', '2700');
});

test('REQ-5-3-1 -the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbookWithData(page);
  await createPivot(page, { rows: 'Region', columns: 'Status', values: 'Sales', summarize: 'SUM' });

  await expectCell(page, 'A1', 'Region');
  await expectCell(page, 'B1', 'Open');
  await expectCell(page, 'C1', 'Closed');
  await expectCell(page, 'D1', 'Grand Total');
  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'B2', '1200');
  await expectCell(page, 'D2', '1200');
  await expectCell(page, 'A3', 'North');
  await expectCell(page, 'C3', '800');
  await expectCell(page, 'D3', '800');
  await expectCell(page, 'A4', 'South');
  await expectCell(page, 'B4', '700');
  await expectCell(page, 'D4', '700');
  await expectCell(page, 'A5', 'Grand Total');
  await expectCell(page, 'B5', '1900');
  await expectCell(page, 'C5', '800');
  await expectCell(page, 'D5', '2700');
});

test('REQ-5-3-1 -the requested workflow COUNT the requested workflow', async ({ page }) => {
  await createWorkbookWithData(page);
  await createPivot(page, { rows: 'Region', columns: 'Status', values: 'Status', summarize: 'COUNT' });

  await expectCell(page, 'A1', 'Region');
  await expectCell(page, 'B1', 'Open');
  await expectCell(page, 'C1', 'Closed');
  await expectCell(page, 'D1', 'Grand Total');
  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'B2', '1');
  await expectCell(page, 'C2', '0');
  await expectCell(page, 'D2', '1');
  await expectCell(page, 'A3', 'North');
  await expectCell(page, 'B3', '0');
  await expectCell(page, 'C3', '1');
  await expectCell(page, 'D3', '1');
  await expectCell(page, 'A4', 'South');
  await expectCell(page, 'B4', '1');
  await expectCell(page, 'C4', '0');
  await expectCell(page, 'D4', '1');
  await expectCell(page, 'A5', 'Grand Total');
  await expectCell(page, 'B5', '2');
  await expectCell(page, 'C5', '1');
  await expectCell(page, 'D5', '3');
});

test('REQ-5-3-1 -AVERAGE the requested workflow', async ({ page }) => {
  await createWorkbookWithData(page);
  await createPivot(page, { rows: 'Region', values: 'Sales', summarize: 'AVERAGE' });

  await expectCell(page, 'A1', 'Region');
  await expectCell(page, 'B1', 'AVERAGE of Sales');
  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'B2', '1200');
  await expectCell(page, 'A3', 'North');
  await expectCell(page, 'B3', '800');
  await expectCell(page, 'A4', 'South');
  await expectCell(page, 'B4', '700');
  await expectCell(page, 'A5', 'Grand Total');
  await expectCell(page, 'B5', '900');
});

// REQ-5-3-1#5
test('REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await createWorkbookWithData(page);
  await createPivot(page, { rows: 'Region', values: 'Sales', summarize: 'SUM' });
  await expectCell(page, 'B5', '2700');

  const editor = page.getByRole('region', { name: 'Pivot table editor', exact: true });
  await selectCombobox(page, editor, 'Values', 'Status');
  await selectCombobox(page, editor, 'Summarize by', 'SUM');
  await editor.getByRole('button', { name: 'Apply', exact: true }).click();

  await expect(page.getByText('Value field requires numeric values', { exact: true })).toBeVisible();
  await expectCell(page, 'B2', '1200');
  await expectCell(page, 'B5', '2700');

  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await expectCell(page, 'A1', 'Region');
  await expectCell(page, 'B2', '1200');
});

// REQ-5-3-1#6
test('REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await createWorkbookWithData(page);
  await createPivot(page, { rows: 'Region', values: 'Sales', summarize: 'SUM' });
  await expectCell(page, 'B5', '2700');

  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await fillCell(page, 'B2', '1500');

  await page.getByRole('tab', { name: 'Pivot1', exact: true }).click();
  await expectCell(page, 'B5', '2700');
  await page.getByRole('button', { name: 'Refresh pivot table', exact: true }).click();
  await expectCell(page, 'B2', '1500');
  await expectCell(page, 'B5', '3000');

  await page.reload();
  await expectCell(page, 'B2', '1500');
  await expectCell(page, 'B5', '3000');
});

// REQ-5-3-1#7
test('REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await createWorkbookWithData(page);
  await createPivot(page, { rows: 'Region', values: 'Sales', summarize: 'SUM' });
  await expectCell(page, 'B5', '2700');

  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await page.getByRole('columnheader', { name: 'A', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete column', exact: true }).click();

  await page.getByRole('tab', { name: 'Pivot1', exact: true }).click();
  await page.getByRole('button', { name: 'Refresh pivot table', exact: true }).click();

  await expect(page.getByText('Pivot field is no longer available. Select a new field.', { exact: true })).toBeVisible();
  await expectCell(page, 'B5', '2700');
});

// REQ-5-3-1#8
test('REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await createWorkbookWithData(page);
  await createPivot(page, { rows: 'Region', values: 'Sales', summarize: 'SUM' });
  await expectCell(page, 'B5', '2700');

  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await page.getByRole('rowheader', { name: '4', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 row below', exact: true }).click();
  await fillCell(page, 'A5', 'West');
  await fillCell(page, 'B5', '1000');
  await fillCell(page, 'C5', 'Open');

  await page.getByRole('tab', { name: 'Pivot1', exact: true }).click();
  await expectCell(page, 'B5', '2700');
  await page.getByRole('button', { name: 'Refresh pivot table', exact: true }).click();

  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'B2', '1200');
  await expectCell(page, 'A5', 'West');
  await expectCell(page, 'B5', '1000');
  await expectCell(page, 'A6', 'Grand Total');
  await expectCell(page, 'B6', '3700');
});

// REQ-5-3-1#9
test('REQ-5-3-1 -the requested workflow COUNT the requested workflow', async ({ page }) => {
  await createWorkbookWithData(page);
  await createPivot(page, { rows: 'Region', values: 'Status', summarize: 'COUNT' });

  await expectCell(page, 'A1', 'Region');
  await expectCell(page, 'B1', 'COUNT of Status');
  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'B2', '1');
  await expectCell(page, 'A3', 'North');
  await expectCell(page, 'B3', '1');
  await expectCell(page, 'A4', 'South');
  await expectCell(page, 'B4', '1');
  await expectCell(page, 'A5', 'Grand Total');
  await expectCell(page, 'B5', '3');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

