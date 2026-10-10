const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function cell(page, coord) {
  return page
    .getByRole('grid', { name: 'Worksheet grid', exact: true })
    .getByRole('gridcell', { name: coord, exact: true });
}

async function importWorkbook(page, name, content) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Import CSV', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import CSV', exact: true });
  await dialog.getByLabel('CSV file', { exact: true }).setInputFiles({
    name: `${name}.csv`,
    mimeType: 'text/csv',
    buffer: Buffer.from(content, 'utf8'),
  });
  await dialog.getByRole('button', { name: 'Confirm import', exact: true }).click();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
}

async function setCell(page, coord, value) {
  await cell(page, coord).click();
  const formulaBar = page.getByLabel('Formula bar', { exact: true });
  await formulaBar.fill(value);
  await formulaBar.press('Enter');
}

async function exportCsv(page) {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  return downloadPromise;
}

function readStream(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    stream.on('error', reject);
  });
}

async function readDownload(download) {
  return readStream(await download.createReadStream());
}

function normalizeCsv(text) {
  return text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();
}

test('REQ-1-3-1: REQ-1-3-1 -the requested workflow UTF-8 CSV,the requested workflow', async ({ page }) => {
  const name = 'utf8' + u();
  await importWorkbook(page, name, 'Region,Sales,备注\nEast,1200,东区\nNorth,800,北区\n');

  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('Sales');
  await expect(cell(page, 'C1')).toHaveText('备注');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'C2')).toHaveText('东区');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'B3')).toHaveText('800');
  await expect(cell(page, 'C3')).toHaveText('北区');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'C2')).toHaveText('东区');

  await page.goto('/');
  await expect(page.getByRole('link', { name, exact: true })).toBeVisible();
});

test('REQ-1-3-1#2: REQ-1-3-1 -the requested workflow CSV the requested workflow,the requested workflow', async ({ page }) => {
  const name = 'quoted' + u();
  const content = [
    'Region,Notes,Amount',
    'East,"red, fresh",1200',
    'North,"said ""hi""',
    'next",800',
  ].join('\n');

  await importWorkbook(page, name, content);

  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('Notes');
  await expect(cell(page, 'C1')).toHaveText('Amount');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('red, fresh');
  await expect(cell(page, 'C2')).toHaveText('1200');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'B3')).toHaveText(/said "hi"\s+next/);
  await expect(cell(page, 'C3')).toHaveText('800');

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('red, fresh');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'B3')).toHaveText(/said "hi"\s+next/);
  await expect(cell(page, 'C3')).toHaveText('800');
});

test('REQ-1-3-1#3: REQ-1-3-1 -the requested workflow CSV,the requested workflow', async ({ page }) => {
  const name = 'empty' + u();
  await importWorkbook(page, name, 'Region,Sales,Status,Note\nEast,1200,Open,\nNorth,800,,urgent\n');

  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('Sales');
  await expect(cell(page, 'C1')).toHaveText('Status');
  await expect(cell(page, 'D1')).toHaveText('Note');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'C2')).toHaveText('Open');
  await expect(cell(page, 'D2')).toHaveText('');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'B3')).toHaveText('800');
  await expect(cell(page, 'C3')).toHaveText('');
  await expect(cell(page, 'D3')).toHaveText('urgent');

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'D2')).toHaveText('');
  await expect(cell(page, 'C3')).toHaveText('');
  await expect(cell(page, 'D3')).toHaveText('urgent');
});

test('REQ-1-3-1#4: REQ-1-3-1 -the requested workflow CSV,the requested workflow', async ({ page }) => {
  const name = 'bad' + u();

  await page.goto('/');
  await page.getByRole('button', { name: 'Import CSV', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import CSV', exact: true });
  await dialog.getByLabel('CSV file', { exact: true }).setInputFiles({
    name: `${name}.csv`,
    mimeType: 'text/csv',
    buffer: Buffer.from('Region,Sales\n"East,1200\n', 'utf8'),
  });
  await dialog.getByRole('button', { name: 'Confirm import', exact: true }).click();

  await expect(page.getByText('Invalid CSV file format. Import failed.', { exact: true })).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('link', { name, exact: true })).toHaveCount(0);
});

test('REQ-1-3-2: REQ-1-3-2 -the requested workflow,the requested workflow', async ({ page }) => {
  const name = 'exp1' + u();
  await importWorkbook(page, name, 'Region,Sales\nEast,1200\nNorth,800\n');

  const download = await exportCsv(page);
  expect(download.suggestedFilename().toLowerCase().endsWith('.csv')).toBe(true);

  const text = normalizeCsv(await readDownload(download));
  expect(text).toBe('Region,Sales\nEast,1200\nNorth,800');

  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'A2')).toHaveText('East');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'A2')).toHaveText('East');
});

test('REQ-1-3-2#2: REQ-1-3-2 -the requested workflow', async ({ page }) => {
  const name = 'exp2' + u();
  const content = [
    'Region,Notes,Amount',
    'East,"x,y",1200',
    'North,"say ""hi"" and',
    'next",800',
    'West,,',
  ].join('\n');

  await importWorkbook(page, name, content);

  const download = await exportCsv(page);
  const text = normalizeCsv(await readDownload(download));
  const expected = [
    'Region,Notes,Amount',
    'East,"x,y",1200',
    'North,"say ""hi"" and',
    'next",800',
    'West,,',
  ].join('\n');
  expect(text).toBe(expected);

  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B2')).toHaveText('x,y');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B2')).toHaveText('x,y');
});

test('REQ-1-3-2#3: REQ-1-3-2 -the requested workflow', async ({ page }) => {
  const name = 'exp3' + u();
  await importWorkbook(page, name, '2,3\n');
  await setCell(page, 'C1', '=A1+B1');
  await expect(cell(page, 'C1')).toHaveText('5');

  const download = await exportCsv(page);
  const text = normalizeCsv(await readDownload(download));
  expect(text).toBe('2,3,5');

  await cell(page, 'C1').click();
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A1+B1');

  await page.reload();
  await cell(page, 'C1').click();
  await expect(cell(page, 'C1')).toHaveText('5');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A1+B1');
});

test('REQ-1-3-2#4: REQ-1-3-2 -the requested workflow Sheet1 the requested workflow', async ({ page }) => {
  const name = 'exp4' + u();
  await importWorkbook(page, name, 'Region,Sales\nEast,1200\nNorth,800\n');

  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await setCell(page, 'A1', 'WRONG');

  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');

  const download = await exportCsv(page);
  const text = normalizeCsv(await readDownload(download));
  expect(text).toBe('Region,Sales\nEast,1200\nNorth,800');
  expect(text).not.toContain('WRONG');

  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Region');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Region');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

