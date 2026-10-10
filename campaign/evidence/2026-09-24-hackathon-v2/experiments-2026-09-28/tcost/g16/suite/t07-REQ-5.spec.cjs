const { test, expect } = require('@playwright/test');

test.setTimeout(15000);

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const SEED_CSV = `Region,Sales,Status
East,1200,Open
North,800,Closed
South,700,Open
`;

const gridCell = (page, coord) =>
  page.getByRole('gridcell', { name: coord, exact: true });

async function importWorkbook(page) {
  await page.goto('/');
  const base = 'data' + u();

  await page.getByRole('button', { name: 'Import CSV', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import CSV', exact: true });
  await dialog.getByLabel('CSV file', { exact: true }).setInputFiles({
    name: `${base}.csv`,
    mimeType: 'text/csv',
    buffer: Buffer.from(SEED_CSV, 'utf8'),
  });
  await dialog.getByRole('button', { name: 'Confirm import', exact: true }).click();

  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(gridCell(page, 'A1')).toHaveText('Region');
  await expect(gridCell(page, 'C4')).toHaveText('Open');
}

async function selectRange(page) {
  const grid = page.getByRole('grid', { name: 'Worksheet grid', exact: true });
  const start = await grid.getByRole('gridcell', { name: 'A1', exact: true }).boundingBox();
  const end = await grid.getByRole('gridcell', { name: 'C4', exact: true }).boundingBox();
  if (!start || !end) throw new Error('Could not locate A1 or C4');

  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 10 });
  await page.mouse.up();
}

async function clickDataMenuItem(page, itemName) {
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByRole('menuitem', { name: itemName, exact: true }).click();
}

async function chooseOption(page, container, label, optionName) {
  const combo = container.getByRole('combobox', { name: label, exact: true });
  await combo.click();
  await container.getByRole('option', { name: optionName, exact: true }).click();
}

async function sortRange(page, column, order, hasHeader = true) {
  await selectRange(page);
  await clickDataMenuItem(page, 'Sort range');

  const dialog = page.getByRole('dialog', { name: 'Sort range', exact: true });
  await chooseOption(page, dialog, 'Sort by', column);
  await chooseOption(page, dialog, 'Order', order);

  const headerCheckbox = dialog.getByRole('checkbox', {
    name: 'Data has header row',
    exact: true,
  });
  if (hasHeader) {
    if (!(await headerCheckbox.isChecked())) await headerCheckbox.check();
  } else {
    if (await headerCheckbox.isChecked()) await headerCheckbox.uncheck();
  }

  await dialog.getByRole('button', { name: 'Sort', exact: true }).click();
  await expect(gridCell(page, 'A2')).toBeVisible();
}

async function createFilter(page) {
  await selectRange(page);
  await clickDataMenuItem(page, 'Create filter');
  await expect(page.getByRole('button', { name: 'Filter Region', exact: true })).toBeVisible();
}

async function applyValueFilter(page, header, values) {
  await page.getByRole('button', { name: `Filter ${header}`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: `Filter ${header}`, exact: true });
  await dialog.getByRole('button', { name: 'Clear selection', exact: true }).click();

  for (const value of values) {
    await dialog.getByRole('checkbox', { name: String(value), exact: true }).check();
  }

  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
}

async function applyConditionFilter(page, header, condition, value) {
  await page.getByRole('button', { name: `Filter ${header}`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: `Filter ${header}`, exact: true });
  await chooseOption(page, dialog, 'Condition', condition);

  if (value !== undefined) {
    await dialog.getByLabel('Value', { exact: true }).fill(value);
  }

  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
}

async function clearFilter(page) {
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Clear filter', exact: true }).click();
}

async function reloadToGrid(page) {
  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(gridCell(page, 'A1')).toHaveText('Region');
}

test('REQ-5-1-1: REQ-5-1-1 -the requested workflow Sales the requested workflow,the requested workflow', async ({ page }) => {
  await importWorkbook(page);
  await sortRange(page, 'Sales', 'Ascending', true);

  await expect(gridCell(page, 'A2')).toHaveText('South');
  await expect(gridCell(page, 'B2')).toHaveText('700');
  await expect(gridCell(page, 'C2')).toHaveText('Open');
  await expect(gridCell(page, 'A3')).toHaveText('North');
  await expect(gridCell(page, 'B3')).toHaveText('800');
  await expect(gridCell(page, 'C3')).toHaveText('Closed');
  await expect(gridCell(page, 'A4')).toHaveText('East');
  await expect(gridCell(page, 'B4')).toHaveText('1200');
  await expect(gridCell(page, 'C4')).toHaveText('Open');

  await reloadToGrid(page);
  await expect(gridCell(page, 'A2')).toHaveText('South');
  await expect(gridCell(page, 'A3')).toHaveText('North');
  await expect(gridCell(page, 'A4')).toHaveText('East');
});

test('REQ-5-1-1#2: REQ-5-1-1 -the requested workflow ISO the requested workflow', async ({ page }) => {
  await importWorkbook(page);
  await sortRange(page, 'Status', 'Ascending', true);

  await expect(gridCell(page, 'A2')).toHaveText('North');
  await expect(gridCell(page, 'A3')).toHaveText('East');
  await expect(gridCell(page, 'A4')).toHaveText('South');

  await reloadToGrid(page);
  await expect(gridCell(page, 'A2')).toHaveText('North');
  await expect(gridCell(page, 'A3')).toHaveText('East');
  await expect(gridCell(page, 'A4')).toHaveText('South');
});

test('REQ-5-1-1#3: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  await importWorkbook(page);
  await sortRange(page, 'Sales', 'Descending', true);

  await expect(gridCell(page, 'A2')).toHaveText('East');
  await expect(gridCell(page, 'A3')).toHaveText('North');
  await expect(gridCell(page, 'A4')).toHaveText('South');

  await reloadToGrid(page);
  await expect(gridCell(page, 'A2')).toHaveText('East');
  await expect(gridCell(page, 'A3')).toHaveText('North');
  await expect(gridCell(page, 'A4')).toHaveText('South');
});

test('REQ-5-1-1#4: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  await importWorkbook(page);
  await sortRange(page, 'Region', 'Ascending', true);

  await expect(gridCell(page, 'A2')).toHaveText('East');
  await expect(gridCell(page, 'A3')).toHaveText('North');
  await expect(gridCell(page, 'A4')).toHaveText('South');

  await reloadToGrid(page);
  await expect(gridCell(page, 'A2')).toHaveText('East');
  await expect(gridCell(page, 'A3')).toHaveText('North');
  await expect(gridCell(page, 'A4')).toHaveText('South');
});

test('REQ-5-1-1#5: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  await importWorkbook(page);
  await sortRange(page, 'Region', 'Descending', true);

  await expect(gridCell(page, 'A2')).toHaveText('South');
  await expect(gridCell(page, 'A3')).toHaveText('North');
  await expect(gridCell(page, 'A4')).toHaveText('East');

  await reloadToGrid(page);
  await expect(gridCell(page, 'A2')).toHaveText('South');
  await expect(gridCell(page, 'A3')).toHaveText('North');
  await expect(gridCell(page, 'A4')).toHaveText('East');
});

test('REQ-5-1-1#6: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  await importWorkbook(page);
  await sortRange(page, 'Status', 'Descending', true);

  await expect(gridCell(page, 'A2')).toHaveText('East');
  await expect(gridCell(page, 'A3')).toHaveText('South');
  await expect(gridCell(page, 'A4')).toHaveText('North');

  await reloadToGrid(page);
  await expect(gridCell(page, 'A2')).toHaveText('East');
  await expect(gridCell(page, 'A3')).toHaveText('South');
  await expect(gridCell(page, 'A4')).toHaveText('North');
});

test('REQ-5-1-2: REQ-5-1-2 -the requested workflow Region the requested workflow Sales the requested workflow,the requested workflow', async ({ page }) => {
  await importWorkbook(page);
  await createFilter(page);

  await applyValueFilter(page, 'Region', ['East']);
  await applyValueFilter(page, 'Sales', ['1200']);

  await expect(gridCell(page, 'A2')).toBeVisible();
  await expect(gridCell(page, 'A2')).toHaveText('East');
  await expect(gridCell(page, 'B2')).toHaveText('1200');
  await expect(gridCell(page, 'A3')).not.toBeVisible();
  await expect(gridCell(page, 'A4')).not.toBeVisible();

  await reloadToGrid(page);
  await expect(gridCell(page, 'A2')).toBeVisible();
  await expect(gridCell(page, 'A3')).not.toBeVisible();
  await expect(gridCell(page, 'A4')).not.toBeVisible();
});

test('REQ-5-1-2#2: REQ-5-1-2 -the requested workflow, the requested workflow,the requested workflow', async ({ page }) => {
  await importWorkbook(page);
  await createFilter(page);

  await applyConditionFilter(page, 'Region', 'Text contains', 'orth');

  await expect(gridCell(page, 'A3')).toBeVisible();
  await expect(gridCell(page, 'A3')).toHaveText('North');
  await expect(gridCell(page, 'A2')).not.toBeVisible();
  await expect(gridCell(page, 'A4')).not.toBeVisible();

  await reloadToGrid(page);
  await expect(gridCell(page, 'A3')).toBeVisible();
  await expect(gridCell(page, 'A2')).not.toBeVisible();
  await expect(gridCell(page, 'A4')).not.toBeVisible();
});

test('REQ-5-1-2#3: REQ-5-1-2 -CSV the requested workflow', async ({ page }) => {
  await importWorkbook(page);
  await createFilter(page);
  await applyValueFilter(page, 'Region', ['East']);

  await expect(gridCell(page, 'A2')).toBeVisible();
  await expect(gridCell(page, 'A3')).not.toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export CSV', exact: true }).click(),
  ]);

  expect(download.suggestedFilename()).toMatch(/\.csv$/);

  const stream = await download.createReadStream();
  let content = '';
  for await (const chunk of stream) {
    content += chunk.toString('utf8');
  }

  expect(content).toContain('Region,Sales,Status');
  expect(content).toContain('East,1200,Open');
  expect(content).toContain('North,800,Closed');
  expect(content).toContain('South,700,Open');

  await expect(gridCell(page, 'A2')).toBeVisible();
  await expect(gridCell(page, 'A3')).not.toBeVisible();
});

test('REQ-5-1-2#4: REQ-5-1-2 -the requested workflow', async ({ page }) => {
  await importWorkbook(page);
  await createFilter(page);

  await applyConditionFilter(page, 'Sales', 'Greater than', '1000');

  await expect(gridCell(page, 'A2')).toBeVisible();
  await expect(gridCell(page, 'A2')).toHaveText('East');
  await expect(gridCell(page, 'A3')).not.toBeVisible();
  await expect(gridCell(page, 'A4')).not.toBeVisible();

  await reloadToGrid(page);
  await expect(gridCell(page, 'A2')).toBeVisible();
  await expect(gridCell(page, 'A3')).not.toBeVisible();
  await expect(gridCell(page, 'A4')).not.toBeVisible();
});

test('REQ-5-1-2#5: REQ-5-1-2 -the requested workflow', async ({ page }) => {
  await importWorkbook(page);
  await createFilter(page);

  await applyValueFilter(page, 'Region', ['East']);
  await expect(gridCell(page, 'A3')).not.toBeVisible();

  await clearFilter(page);

  await expect(gridCell(page, 'A2')).toBeVisible();
  await expect(gridCell(page, 'A3')).toBeVisible();
  await expect(gridCell(page, 'A4')).toBeVisible();
  await expect(gridCell(page, 'A2')).toHaveText('East');
  await expect(gridCell(page, 'A3')).toHaveText('North');
  await expect(gridCell(page, 'A4')).toHaveText('South');

  await reloadToGrid(page);
  await expect(gridCell(page, 'A2')).toHaveText('East');
  await expect(gridCell(page, 'A3')).toHaveText('North');
  await expect(gridCell(page, 'A4')).toHaveText('South');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

