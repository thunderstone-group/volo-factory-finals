const { test, expect } = require('@playwright/test');

async function createWorkbookFromClipboard(page, tsv, a1Value) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await page.evaluate((t) => navigator.clipboard.writeText(t), tsv);
  await page.getByRole('gridcell', { name: 'A1', exact: true }).click();
  await page.keyboard.press('Control+v');
  await expect(page.getByRole('gridcell', { name: 'A1', exact: true })).toHaveText(a1Value);
}

async function selectRange(page, start, end) {
  const startCell = page.getByRole('gridcell', { name: start, exact: true });
  const endCell = page.getByRole('gridcell', { name: end, exact: true });
  const startBox = await startCell.boundingBox();
  const endBox = await endCell.boundingBox();
  await page.mouse.move(startBox.x + 10, startBox.y + 10);
  await page.mouse.down();
  await page.mouse.move(endBox.x + endBox.width - 10, endBox.y + endBox.height - 10, { steps: 10 });
  await page.mouse.up();
}

async function chooseDataMenuItem(page, item) {
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByRole('menuitem', { name: item, exact: true }).click();
}

async function openSortRange(page) {
  await chooseDataMenuItem(page, 'Sort range');
  await expect(page.getByRole('dialog', { name: 'Sort range', exact: true })).toBeVisible();
}

async function sortRange(page, sortBy, order) {
  await page.getByLabel('Sort by', { exact: true }).click();
  await page.getByRole('option', { name: sortBy, exact: true }).click();
  await page.getByLabel('Order', { exact: true }).click();
  await page.getByRole('option', { name: order, exact: true }).click();
  await page.getByLabel('Data has header row', { exact: true }).check();
  await page.getByRole('button', { name: 'Sort', exact: true }).click();
}

async function setDropdownValidation(page, allowedValues) {
  await selectRange(page, 'C2', 'C4');
  await chooseDataMenuItem(page, 'Data validation');
  await expect(page.getByRole('dialog', { name: 'Data validation', exact: true })).toBeVisible();
  await page.getByLabel('Rule type', { exact: true }).click();
  await page.getByRole('option', { name: 'Dropdown', exact: true }).click();
  await page.getByLabel('Allowed values', { exact: true }).fill(allowedValues);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Data validation', exact: true })).toBeHidden();
}

async function createFilter(page) {
  await selectRange(page, 'A1', 'C6');
  await chooseDataMenuItem(page, 'Create filter');
  await expect(page.getByRole('button', { name: 'Filter Region', exact: true })).toBeVisible();
}

test('REQ-5-1-1: REQ-5-1-1 -the requested workflow Sales the requested workflow,the requested workflow', async ({ page }) => {
  const tsv = 'Region\tSales\tStatus\nEast\t1200\tOpen\nNorth\t800\tClosed\nSouth\t700\tOpen';
  await createWorkbookFromClipboard(page, tsv, 'Region');
  await selectRange(page, 'A1', 'C6');
  await openSortRange(page);
  await sortRange(page, 'Sales', 'Ascending');

  await expect(page.getByRole('gridcell', { name: 'A1', exact: true })).toHaveText('Region');
  await expect(page.getByRole('gridcell', { name: 'A2', exact: true })).toHaveText('South');
  await expect(page.getByRole('gridcell', { name: 'A3', exact: true })).toHaveText('North');
  await expect(page.getByRole('gridcell', { name: 'A4', exact: true })).toHaveText('East');
  await expect(page.getByRole('gridcell', { name: 'B2', exact: true })).toHaveText('700');

  await page.reload();
  await expect(page.getByRole('gridcell', { name: 'A2', exact: true })).toHaveText('South');
  await expect(page.getByRole('gridcell', { name: 'A4', exact: true })).toHaveText('East');
});

test('REQ-5-1-1#2: REQ-5-1-1 -the requested workflow ISO the requested workflow', async ({ page }) => {
  const tsv = 'Date\tValue\n2024-01-15\t1\n2023-12-31\t2\n2024-03-01\t3';
  await createWorkbookFromClipboard(page, tsv, 'Date');
  await selectRange(page, 'A1', 'B4');
  await openSortRange(page);
  await sortRange(page, 'Date', 'Ascending');

  await expect(page.getByRole('gridcell', { name: 'A2', exact: true })).toHaveText('2023-12-31');
  await expect(page.getByRole('gridcell', { name: 'A3', exact: true })).toHaveText('2024-01-15');
  await expect(page.getByRole('gridcell', { name: 'A4', exact: true })).toHaveText('2024-03-01');

  await page.reload();
  await expect(page.getByRole('gridcell', { name: 'A2', exact: true })).toHaveText('2023-12-31');
});

test('REQ-5-1-1#3: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  const tsv = 'Region\tSales\tStatus\nEast\t1200\tOpen\nNorth\t800\tClosed\nSouth\t700\tOpen';
  await createWorkbookFromClipboard(page, tsv, 'Region');
  await selectRange(page, 'A1', 'C6');
  await openSortRange(page);
  await sortRange(page, 'Status', 'Ascending');

  await expect(page.getByRole('gridcell', { name: 'A2', exact: true })).toHaveText('North');
  await expect(page.getByRole('gridcell', { name: 'A3', exact: true })).toHaveText('East');
  await expect(page.getByRole('gridcell', { name: 'A4', exact: true })).toHaveText('South');

  await page.reload();
  await expect(page.getByRole('gridcell', { name: 'A2', exact: true })).toHaveText('North');
});

test('REQ-5-1-1#4: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  const tsv = 'Region\tSales\tStatus\nEast\t1200\tOpen\nNorth\t800\tClosed\nSouth\t700\tOpen';
  await createWorkbookFromClipboard(page, tsv, 'Region');
  await selectRange(page, 'A1', 'C6');
  await openSortRange(page);
  await sortRange(page, 'Region', 'Descending');

  await expect(page.getByRole('gridcell', { name: 'A2', exact: true })).toHaveText('South');
  await expect(page.getByRole('gridcell', { name: 'A3', exact: true })).toHaveText('North');
  await expect(page.getByRole('gridcell', { name: 'A4', exact: true })).toHaveText('East');

  await page.reload();
  await expect(page.getByRole('gridcell', { name: 'A2', exact: true })).toHaveText('South');
});

test('REQ-5-1-1#5: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  const tsv = 'Name\tScore\tDouble\nAlice\t10\t=B2*2\nBob\t30\t=B3*2\nCarol\t20\t=B4*2';
  await createWorkbookFromClipboard(page, tsv, 'Name');

  await page.getByRole('gridcell', { name: 'D1', exact: true }).click();
  await page.keyboard.type('Outside');
  await page.keyboard.press('Enter');

  await selectRange(page, 'A1', 'C4');
  await openSortRange(page);
  await sortRange(page, 'Score', 'Descending');

  await expect(page.getByRole('gridcell', { name: 'A2', exact: true })).toHaveText('Bob');
  await expect(page.getByRole('gridcell', { name: 'A3', exact: true })).toHaveText('Carol');
  await expect(page.getByRole('gridcell', { name: 'A4', exact: true })).toHaveText('Alice');
  await expect(page.getByRole('gridcell', { name: 'D1', exact: true })).toHaveText('Outside');

  await page.getByRole('gridcell', { name: 'C2', exact: true }).click();
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=B2*2');
  await expect(page.getByRole('gridcell', { name: 'C2', exact: true })).toHaveText('60');

  await page.reload();
  await expect(page.getByRole('gridcell', { name: 'A2', exact: true })).toHaveText('Bob');
  await page.getByRole('gridcell', { name: 'C2', exact: true }).click();
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=B2*2');
  await expect(page.getByRole('gridcell', { name: 'C2', exact: true })).toHaveText('60');
});

test('REQ-5-1-1#6: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  const tsv = 'Region\tSales\tStatus\nEast\t1200\tOpen\nNorth\t800\tClosed\nSouth\t700\tOpen';
  await createWorkbookFromClipboard(page, tsv, 'Region');
  await setDropdownValidation(page, 'Open, Closed');
  await createFilter(page);

  await selectRange(page, 'A1', 'C6');
  await openSortRange(page);
  await sortRange(page, 'Sales', 'Ascending');

  await expect(page.getByRole('gridcell', { name: 'A2', exact: true })).toHaveText('South');
  await expect(page.getByRole('gridcell', { name: 'A4', exact: true })).toHaveText('East');
  await expect(page.getByRole('button', { name: 'Filter Status', exact: true })).toBeVisible();

  await page.getByRole('gridcell', { name: 'C2', exact: true }).click();
  await page.keyboard.type('Pending');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Please select one of the following values: Open, Closed', { exact: true })).toBeVisible();
  await expect(page.getByRole('gridcell', { name: 'C2', exact: true })).toHaveText('Open');

  await page.reload();
  await expect(page.getByRole('gridcell', { name: 'A2', exact: true })).toHaveText('South');
  await expect(page.getByRole('button', { name: 'Filter Status', exact: true })).toBeVisible();
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

