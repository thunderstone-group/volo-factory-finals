const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function grid(page) {
  return page.getByRole('grid', { name: 'Worksheet grid', exact: true });
}

function cell(page, coord) {
  return grid(page).getByRole('gridcell', { name: coord, exact: true });
}

async function openWorkbook(page, name) {
  await page.goto('/');
  await page.getByRole('link', { name, exact: true }).click();
  await expect(grid(page)).toBeVisible();
}

async function createBlankWorkbook(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(grid(page)).toBeVisible();
}

async function renameWorkbookTo(page, newName) {
  await page.getByRole('button', { name: 'Rename workbook', exact: true }).click();
  const input = page.getByLabel('Workbook name', { exact: true });
  await input.fill(newName);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(newName, { exact: true }).first()).toBeVisible();
}

async function enterCellValue(page, coord, value) {
  await cell(page, coord).click();
  const formulaBar = page.getByLabel('Formula bar', { exact: true });
  await formulaBar.fill(value);
  await formulaBar.press('Enter');
}

async function importCsv(page, fileName, csvText) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Import CSV', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import CSV', exact: true });
  await dialog.getByLabel('CSV file', { exact: true }).setInputFiles({
    name: fileName,
    mimeType: 'text/csv',
    buffer: Buffer.from(csvText, 'utf8'),
  });
  await dialog.getByRole('button', { name: 'Confirm import', exact: true }).click();
  await expect(grid(page)).toBeVisible();
}

async function readDownload(download) {
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function exportCsv(page) {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
  return readDownload(download);
}

test('REQ-1-1-1: REQ-1-1-1 -the requested workflow,the requested workflow page entry the requested workflow', async ({ page }) => {
  await openWorkbook(page, 'Q3 Sales');

  await expect(page.getByText('Q3 Sales', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(grid(page)).toHaveAttribute('aria-multiselectable', 'true');
  await expect(cell(page, 'A1')).toHaveText('Region');

  const url = page.url();
  await page.goto('/');
  await page.goto(url);

  await expect(grid(page)).toBeVisible();
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('REQ-1-1-1#2: REQ-1-1-1 -the requested workflow', async ({ page }) => {
  const other = 'other-' + u();
  await createBlankWorkbook(page);
  await enterCellValue(page, 'A1', other);
  await expect(cell(page, 'A1')).toHaveText(other);

  await openWorkbook(page, 'Q3 Sales');

  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('Region');
});

test('REQ-1-2-1: REQ-1-2-1 -the requested workflow,the requested workflow Sheet1 the requested workflow A1 the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);

  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: /^Sheet\d+$/ })).toHaveCount(1);
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A2')).toHaveAttribute('aria-selected', 'false');
  await expect(cell(page, 'A1')).toHaveText('');

  await page.reload();

  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A2')).toHaveAttribute('aria-selected', 'false');
});

test('REQ-1-2-2: REQ-1-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  const newName = 'renamed-' + u();
  await createBlankWorkbook(page);
  await renameWorkbookTo(page, newName);

  await page.reload();
  await expect(page.getByText(newName, { exact: true }).first()).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('link', { name: newName, exact: true })).toBeVisible();
});

test('REQ-1-2-2#2: REQ-1-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  const original = 'keep-' + u();
  await createBlankWorkbook(page);
  await renameWorkbookTo(page, original);

  await page.reload();
  await expect(page.getByText(original, { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Rename workbook', exact: true }).click();
  const input = page.getByLabel('Workbook name', { exact: true });
  await input.fill('   ');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText('Workbook name cannot be empty', { exact: true })).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('link', { name: original, exact: true })).toBeVisible();
});

test('REQ-1-3-1: REQ-1-3-1 -the requested workflow UTF-8 CSV,the requested workflow', async ({ page }) => {
  const base = 'utf8-' + u();
  const csv = ['名称,note,数量', '苹果,apple,3', '香蕉,banana,5'].join('\n');
  await importCsv(page, base + '.csv', csv);

  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('名称');
  await expect(cell(page, 'B1')).toHaveText('note');
  await expect(cell(page, 'C1')).toHaveText('数量');
  await expect(cell(page, 'A2')).toHaveText('苹果');
  await expect(cell(page, 'B2')).toHaveText('apple');
  await expect(cell(page, 'C2')).toHaveText('3');

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('苹果');

  await page.goto('/');
  await expect(page.getByRole('link', { name: base, exact: true })).toBeVisible();
});

test('REQ-1-3-1#2: REQ-1-3-1 -the requested workflow CSV the requested workflow,the requested workflow', async ({ page }) => {
  const base = 'quoted-' + u();
  const csv = [
    'name,note,text,empty',
    '"Smith, John","He said ""Hi""","Line1\nLine2",x',
    ',,,',
  ].join('\n');
  await importCsv(page, base + '.csv', csv);

  await expect(cell(page, 'A2')).toHaveText('Smith, John');
  await expect(cell(page, 'B2')).toHaveText('He said "Hi"');
  await expect(cell(page, 'C2')).toContainText('Line1');
  await expect(cell(page, 'C2')).toContainText('Line2');
  await expect(cell(page, 'D2')).toHaveText('x');
  await expect(cell(page, 'A3')).toHaveText('');

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('Smith, John');

  await page.goto('/');
  await expect(page.getByRole('link', { name: base, exact: true })).toBeVisible();
});

test('REQ-1-3-1#3: REQ-1-3-1 -the requested workflow CSV,the requested workflow', async ({ page }) => {
  const base = 'bad-' + u();

  await page.goto('/');
  await page.getByRole('button', { name: 'Import CSV', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import CSV', exact: true });
  await dialog.getByLabel('CSV file', { exact: true }).setInputFiles({
    name: base + '.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('"unterminated\n', 'utf8'),
  });
  await dialog.getByRole('button', { name: 'Confirm import', exact: true }).click();

  await expect(page.getByText('Invalid CSV file format. Import failed.', { exact: true })).toBeVisible();
  await expect(grid(page)).toHaveCount(0);

  await page.goto('/');
  await expect(page.getByRole('link', { name: base, exact: true })).toHaveCount(0);
});

test('REQ-1-3-1#4: REQ-1-3-1 -the requested workflow CSV,the requested workflow', async ({ page }) => {
  const base = 'empty-' + u();
  const csv = [
    'Region,Sales,Notes',
    'East,1200,',
    ',800,"North"',
    'South,,Open',
  ].join('\n');
  await importCsv(page, base + '.csv', csv);

  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'C2')).toHaveText('');
  await expect(cell(page, 'A3')).toHaveText('');
  await expect(cell(page, 'B3')).toHaveText('800');
  await expect(cell(page, 'C3')).toHaveText('North');
  await expect(cell(page, 'A4')).toHaveText('South');
  await expect(cell(page, 'B4')).toHaveText('');
  await expect(cell(page, 'C4')).toHaveText('Open');

  await page.reload();
  await expect(cell(page, 'A3')).toHaveText('');

  await page.goto('/');
  await expect(page.getByRole('link', { name: base, exact: true })).toBeVisible();
});

test('REQ-1-3-2: REQ-1-3-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await enterCellValue(page, 'A1', 'East');
  await enterCellValue(page, 'B1', '1200');
  await enterCellValue(page, 'A2', 'North');
  await enterCellValue(page, 'B2', '800');

  await expect(cell(page, 'A1')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('800');

  const text = await exportCsv(page);
  expect(text).toContain('East,1200');
  expect(text).toContain('North,800');

  await expect(cell(page, 'A1')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('800');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('East');
});

test('REQ-1-3-2#2: REQ-1-3-2 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await enterCellValue(page, 'A1', '2');
  await enterCellValue(page, 'A2', '3');
  await enterCellValue(page, 'A3', '=SUM(A1:A2)');

  await expect(cell(page, 'A3')).toHaveText('5');
  await cell(page, 'A3').click();
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=SUM(A1:A2)');

  const text = await exportCsv(page);
  expect(text).toContain('5');
  expect(text).not.toContain('=SUM');

  await page.reload();
  await cell(page, 'A3').click();
  await expect(cell(page, 'A3')).toHaveText('5');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=SUM(A1:A2)');
});

test('REQ-1-3-2#3: REQ-1-3-2 -the requested workflow', async ({ page }) => {
  const base = 'exp-special-' + u();
  const csv = [
    'name,note',
    '"Smith, John","He said ""Hi"""',
  ].join('\n');
  await importCsv(page, base + '.csv', csv);

  const text = await exportCsv(page);
  expect(text).toContain('"Smith, John"');
  expect(text).toContain('He said ""Hi""');

  await expect(cell(page, 'A1')).toHaveText('name');
});

test('REQ-1-3-2#4: REQ-1-3-2 -the requested workflow Sheet1 the requested workflow', async ({ page }) => {
  const base = 'exp-sheet1-' + u();
  const csv = ['Alpha,Beta', 'foo,bar'].join('\n');
  await importCsv(page, base + '.csv', csv);

  await expect(cell(page, 'A1')).toHaveText('Alpha');
  await expect(cell(page, 'A2')).toHaveText('foo');

  const text = await exportCsv(page);
  expect(text).toContain('Alpha,Beta');
  expect(text).toContain('foo,bar');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('Alpha');
  await expect(cell(page, 'A2')).toHaveText('foo');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

