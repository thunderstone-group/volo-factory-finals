const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function createImportedWorkbook(page) {
  const filename = `sort-${u()}.csv`;
  const csv = [
    'Region,Sales,Status',
    'East,1200,Open',
    'North,800,Closed',
    'South,700,Open',
  ].join('\n');

  await page.goto('/');
  await page.getByRole('button', { name: 'Import CSV', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import CSV', exact: true });
  await dialog.getByLabel('CSV file', { exact: true }).setInputFiles({
    name: filename,
    mimeType: 'text/csv',
    buffer: Buffer.from(csv, 'utf8'),
  });
  await dialog.getByRole('button', { name: 'Confirm import', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(page.getByRole('gridcell', { name: 'A1', exact: true })).toHaveText('Region');
}

async function selectRange(page, from, to) {
  const grid = page.getByRole('grid', { name: 'Worksheet grid', exact: true });
  const start = grid.getByRole('gridcell', { name: from, exact: true });
  const end = grid.getByRole('gridcell', { name: to, exact: true });

  await start.scrollIntoViewIfNeeded();
  await end.scrollIntoViewIfNeeded();
  await expect(start).toBeVisible();
  await expect(end).toBeVisible();

  const startBox = await start.boundingBox();
  const endBox = await end.boundingBox();
  if (!startBox || !endBox) throw new Error('Unable to locate grid cells for selection');

  await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(endBox.x + endBox.width / 2, endBox.y + endBox.height / 2, { steps: 5 });
  await page.mouse.up();

  await expect(start).toHaveAttribute('aria-selected', 'true');
  await expect(end).toHaveAttribute('aria-selected', 'true');
}

async function sortRange(page, sortBy, order) {
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Sort range', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Sort range', exact: true });
  await expect(dialog).toBeVisible();

  await dialog.getByRole('combobox', { name: 'Sort by', exact: true }).click();
  await page.getByRole('option', { name: sortBy, exact: true }).click();

  await dialog.getByRole('combobox', { name: 'Order', exact: true }).click();
  await page.getByRole('option', { name: order, exact: true }).click();

  await dialog.getByRole('checkbox', { name: 'Data has header row', exact: true }).check();
  await dialog.getByRole('button', { name: 'Sort', exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

async function expectCells(page, expected) {
  for (const [coord, value] of Object.entries(expected)) {
    await expect(page.getByRole('gridcell', { name: coord, exact: true })).toHaveText(value);
  }
}

test('REQ-5-1-1: REQ-5-1-1 -the requested workflow Sales the requested workflow,the requested workflow', async ({ page }) => {
  await createImportedWorkbook(page);
  await selectRange(page, 'A1', 'C4');
  await sortRange(page, 'Sales', 'Ascending');

  const expected = {
    A1: 'Region', B1: 'Sales', C1: 'Status',
    A2: 'South', B2: '700', C2: 'Open',
    A3: 'North', B3: '800', C3: 'Closed',
    A4: 'East', B4: '1200', C4: 'Open',
  };

  await expectCells(page, expected);
  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expectCells(page, expected);
});

test('REQ-5-1-1#2: REQ-5-1-1 -the requested workflow ISO the requested workflow', async ({ page }) => {
  await createImportedWorkbook(page);
  await selectRange(page, 'A1', 'C4');
  await sortRange(page, 'Sales', 'Descending');

  const expected = {
    A1: 'Region', B1: 'Sales', C1: 'Status',
    A2: 'East', B2: '1200', C2: 'Open',
    A3: 'North', B3: '800', C3: 'Closed',
    A4: 'South', B4: '700', C4: 'Open',
  };

  await expectCells(page, expected);
  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expectCells(page, expected);
});

test('REQ-5-1-1#3: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  await createImportedWorkbook(page);
  await selectRange(page, 'A1', 'C4');
  await sortRange(page, 'Status', 'Ascending');

  const expected = {
    A1: 'Region', B1: 'Sales', C1: 'Status',
    A2: 'North', B2: '800', C2: 'Closed',
    A3: 'East', B3: '1200', C3: 'Open',
    A4: 'South', B4: '700', C4: 'Open',
  };

  await expectCells(page, expected);
  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expectCells(page, expected);
});

test('REQ-5-1-1#4: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  await createImportedWorkbook(page);
  await selectRange(page, 'A1', 'C4');
  await sortRange(page, 'Region', 'Descending');

  const expected = {
    A1: 'Region', B1: 'Sales', C1: 'Status',
    A2: 'South', B2: '700', C2: 'Open',
    A3: 'North', B3: '800', C3: 'Closed',
    A4: 'East', B4: '1200', C4: 'Open',
  };

  await expectCells(page, expected);
  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expectCells(page, expected);
});

test('REQ-5-1-1#5: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  await createImportedWorkbook(page);
  await selectRange(page, 'A1', 'C4');
  await sortRange(page, 'Status', 'Descending');

  const expected = {
    A1: 'Region', B1: 'Sales', C1: 'Status',
    A2: 'East', B2: '1200', C2: 'Open',
    A3: 'South', B3: '700', C3: 'Open',
    A4: 'North', B4: '800', C4: 'Closed',
  };

  await expectCells(page, expected);
  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expectCells(page, expected);
});

test('REQ-5-1-1#6: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  await createImportedWorkbook(page);
  await selectRange(page, 'A1', 'C4');
  await sortRange(page, 'Region', 'Ascending');

  const expected = {
    A1: 'Region', B1: 'Sales', C1: 'Status',
    A2: 'East', B2: '1200', C2: 'Open',
    A3: 'North', B3: '800', C3: 'Closed',
    A4: 'South', B4: '700', C4: 'Open',
  };

  await expectCells(page, expected);
  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expectCells(page, expected);
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

