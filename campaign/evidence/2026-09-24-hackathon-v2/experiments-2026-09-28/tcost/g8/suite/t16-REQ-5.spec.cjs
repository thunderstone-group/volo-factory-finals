const { test, expect } = require('@playwright/test');

async function openQ3Sales(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Q3 Sales', exact: true }).click();
  const sheet1Tab = page.getByRole('tab', { name: 'Sheet1', exact: true });
  await expect(sheet1Tab).toBeVisible();
  if ((await sheet1Tab.getAttribute('aria-selected')) !== 'true') {
    await sheet1Tab.click();
  }
  await expect(sheet1Tab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(page.getByRole('gridcell', { name: 'A1', exact: true })).toHaveText('Region');
}

async function createBlankWorkbook(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
}

async function createWorkbookWithSalesData(page) {
  await createBlankWorkbook(page);
  await page.getByRole('gridcell', { name: 'A1', exact: true }).click();
  const data = [
    'Region\tSales\tStatus',
    'East\t1200\tOpen',
    'North\t800\tClosed',
    'South\t700\tOpen',
  ].join('\n');
  await page.evaluate((text) => navigator.clipboard.writeText(text), data);
  await page.keyboard.press('ControlOrMeta+V');
  await expect(page.getByRole('gridcell', { name: 'A2', exact: true })).toHaveText('East');
  await expect(page.getByRole('gridcell', { name: 'B2', exact: true })).toHaveText('1200');
  await expect(page.getByRole('gridcell', { name: 'C3', exact: true })).toHaveText('Closed');
}

async function selectRange(page, start, end) {
  const startCell = page.getByRole('gridcell', { name: start, exact: true });
  const endCell = page.getByRole('gridcell', { name: end, exact: true });
  await startCell.scrollIntoViewIfNeeded();
  await endCell.scrollIntoViewIfNeeded();
  let sb = await startCell.boundingBox();
  if (!sb) {
    await startCell.scrollIntoViewIfNeeded();
    sb = await startCell.boundingBox();
  }
  let eb = await endCell.boundingBox();
  if (!eb) {
    await endCell.scrollIntoViewIfNeeded();
    eb = await endCell.boundingBox();
  }
  if (!sb || !eb) {
    throw new Error(`Could not locate grid cells ${start} and ${end}`);
  }
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.mouse.down();
  await page.mouse.move(eb.x + eb.width / 2, eb.y + eb.height / 2, { steps: 8 });
  await page.mouse.up();
}

async function openDataMenu(page) {
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Create pivot table', exact: true })).toBeVisible();
}

async function selectCombobox(page, container, label, option) {
  const combo = container.getByRole('combobox', { name: label, exact: true });
  try {
    await combo.selectOption({ label: option });
  } catch (error) {
    await combo.click();
    await page.getByRole('option', { name: option, exact: true }).click();
  }
}

async function createPivot(page, { rows, columns, values, summarize } = {}) {
  await selectRange(page, 'A1', 'C6');
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: 'Create pivot table', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create pivot table', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Source range: A1:C6');
  await dialog.getByRole('radio', { name: 'New worksheet', exact: true }).click();
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();
  const editor = page.getByRole('region', { name: 'Pivot table editor', exact: true });
  await expect(editor).toBeVisible();
  if (rows) await selectCombobox(page, editor, 'Rows', rows);
  if (columns) await selectCombobox(page, editor, 'Columns', columns);
  if (values) await selectCombobox(page, editor, 'Values', values);
  if (summarize) await selectCombobox(page, editor, 'Summarize by', summarize);
  await editor.getByRole('button', { name: 'Apply', exact: true }).click();
}

async function activeTabName(page) {
  const tab = page.getByRole('tab', { selected: true });
  await expect(tab).toBeVisible();
  return (await tab.textContent()).trim();
}

async function switchToTab(page, name) {
  await page.getByRole('tab', { name, exact: true }).click();
  await expect(page.getByRole('tab', { name, exact: true })).toHaveAttribute('aria-selected', 'true');
}

async function expectCell(page, coord, text) {
  const grid = page.getByRole('grid', { name: 'Worksheet grid', exact: true });
  await expect(grid.getByRole('gridcell', { name: coord, exact: true })).toHaveText(text);
}

async function editCell(page, coord, value) {
  const cell = page.getByRole('gridcell', { name: coord, exact: true });
  await cell.dblclick();
  const input = page.getByLabel(`Edit ${coord}`, { exact: true });
  await input.fill(value);
  await input.press('Enter');
}

async function deleteColumnHeader(page, header) {
  await page.getByRole('columnheader', { name: header, exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete column', exact: true }).click();
}

async function refreshPivot(page) {
  await page.getByRole('button', { name: 'Refresh pivot table', exact: true }).click();
}

test('REQ-5-3-1: REQ-5-3-1 -the requested workflow Pivot1 the requested workflow Region the requested workflow Sales,the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await createPivot(page, { rows: 'Region', values: 'Sales', summarize: 'SUM' });
  await expect(page.getByRole('tab', { name: 'Pivot1', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Pivot1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expectCell(page, 'A1', 'Region');
  await expectCell(page, 'B1', 'SUM of Sales');
  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'B2', '1200');
  await expectCell(page, 'A5', 'Grand Total');
  await expectCell(page, 'B5', '2700');
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Pivot1', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Pivot1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'B1', 'SUM of Sales');
  await expectCell(page, 'B5', '2700');
});

test('REQ-5-3-1#2: REQ-5-3-1 -the requested workflow,the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await createPivot(page, { rows: 'Region', columns: 'Status', values: 'Sales', summarize: 'SUM' });
  await expectCell(page, 'A1', 'Region');
  await expectCell(page, 'B1', 'Open');
  await expectCell(page, 'C1', 'Closed');
  await expectCell(page, 'D1', 'Grand Total');
  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'B2', '1200');
  await expectCell(page, 'C3', '800');
  await expectCell(page, 'A5', 'Grand Total');
  await expectCell(page, 'B5', '1900');
  await expectCell(page, 'C5', '800');
  await expectCell(page, 'D5', '2700');
});

test('REQ-5-3-1#3: REQ-5-3-1 -the requested workflow COUNT the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
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

test('REQ-5-3-1#4: REQ-5-3-1 -AVERAGE the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await createPivot(page, { rows: 'Region', values: 'Sales', summarize: 'AVERAGE' });
  await expectCell(page, 'A1', 'Region');
  await expectCell(page, 'B1', 'AVERAGE of Sales');
  await expectCell(page, 'B2', '1200');
  await expectCell(page, 'B3', '800');
  await expectCell(page, 'B4', '700');
  await expectCell(page, 'B5', '900');
});

test('REQ-5-3-1#5: REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await createWorkbookWithSalesData(page);
  await createPivot(page, { rows: 'Region', values: 'Sales', summarize: 'SUM' });
  const pivotTab = await activeTabName(page);
  await expectCell(page, 'B5', '2700');
  await switchToTab(page, 'Sheet1');
  await editCell(page, 'B2', '1500');
  await expectCell(page, 'B2', '1500');
  await switchToTab(page, pivotTab);
  await expectCell(page, 'B2', '1200');
  await refreshPivot(page);
  await expectCell(page, 'B2', '1500');
  await expectCell(page, 'B5', '3000');
});

test('REQ-5-3-1#6: REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await createWorkbookWithSalesData(page);
  await createPivot(page, { rows: 'Region', values: 'Sales', summarize: 'SUM' });
  const pivotTab = await activeTabName(page);
  await expectCell(page, 'B2', '1200');
  await switchToTab(page, 'Sheet1');
  await deleteColumnHeader(page, 'A');
  await switchToTab(page, pivotTab);
  await refreshPivot(page);
  await expect(page.getByText('Pivot field is no longer available. Select a new field.', { exact: true })).toBeVisible();
  await expectCell(page, 'B2', '1200');
  await expectCell(page, 'B5', '2700');
});

test('REQ-5-3-1#7: REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await createPivot(page, { rows: 'Region', values: 'Status', summarize: 'SUM' });
  await expect(page.getByText('Value field requires numeric values', { exact: true })).toBeVisible();
});

test('REQ-5-3-1#8: REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await createPivot(page, { rows: 'Region', values: 'Sales', summarize: 'SUM' });
  const pivotTab = await activeTabName(page);
  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'B2', '1200');
  await switchToTab(page, 'Sheet1');
  await expectCell(page, 'A1', 'Region');
  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'B2', '1200');
  await expectCell(page, 'C2', 'Open');
  await expectCell(page, 'A3', 'North');
  await expectCell(page, 'B3', '800');
  await expectCell(page, 'C3', 'Closed');
  await expectCell(page, 'A4', 'South');
  await expectCell(page, 'B4', '700');
  await expectCell(page, 'C4', 'Open');
  await switchToTab(page, pivotTab);
  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'B2', '1200');
});

test('REQ-5-3-1#9: REQ-5-3-1 -the requested workflow COUNT the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await createPivot(page, { rows: 'Region', columns: 'Status', values: 'Sales', summarize: 'COUNT' });
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

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

