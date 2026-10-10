const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const worksheetGrid = (page) =>
  page.getByRole('grid', { name: 'Worksheet grid', exact: true });

const cell = (page, coord) =>
  worksheetGrid(page).getByRole('gridcell', { name: coord, exact: true });

async function gotoHome(page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Import CSV', exact: true })).toBeVisible();
}

async function importCsv(page, stem, csv) {
  await gotoHome(page);
  await page.getByRole('button', { name: 'Import CSV', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import CSV', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('CSV file', { exact: true }).setInputFiles({
    name: `${stem}.csv`,
    mimeType: 'text/csv',
    buffer: Buffer.from(csv, 'utf8'),
  });
  await dialog.getByRole('button', { name: 'Confirm import', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(worksheetGrid(page)).toBeVisible();
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
  return await downloadPromise;
}

async function readDownload(download) {
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

test('REQ-1-3-1 -the requested workflow UTF-8 CSV,the requested workflow', async ({ page }) => {
  const stem = `utf8-${u()}`;
  const csv = '名称,项目,数量,备注\n苹果,Apple,3,好吃\n香蕉,Banana,,甜\n橙子,Orange,7,甜\n';
  await importCsv(page, stem, csv);

  await expect(cell(page, 'A1')).toHaveText('名称');
  await expect(cell(page, 'B1')).toHaveText('项目');
  await expect(cell(page, 'C1')).toHaveText('数量');
  await expect(cell(page, 'D1')).toHaveText('备注');
  await expect(cell(page, 'A2')).toHaveText('苹果');
  await expect(cell(page, 'B2')).toHaveText('Apple');
  await expect(cell(page, 'C2')).toHaveText('3');
  await expect(cell(page, 'D2')).toHaveText('好吃');
  await expect(cell(page, 'A3')).toHaveText('香蕉');
  await expect(cell(page, 'B3')).toHaveText('Banana');
  await expect(cell(page, 'C3')).toHaveText(/^\s*$/);
  await expect(cell(page, 'D3')).toHaveText('甜');
  await expect(cell(page, 'A4')).toHaveText('橙子');
  await expect(cell(page, 'B4')).toHaveText('Orange');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('名称');
  await expect(cell(page, 'A3')).toHaveText('香蕉');
  await expect(cell(page, 'C3')).toHaveText(/^\s*$/);

  await gotoHome(page);
  await expect(page.getByRole('link', { name: stem, exact: true })).toBeVisible();
});

test('REQ-1-3-1 -the requested workflow CSV the requested workflow,the requested workflow', async ({ page }) => {
  const stem = `quoted-${u()}`;
  const csv = 'name,comment,amount\nAlice,"Hello, world",1\nBob,"Say ""hi""",2\nCarol,"Line1\nLine2",3\n';
  await importCsv(page, stem, csv);

  await expect(cell(page, 'A1')).toHaveText('name');
  await expect(cell(page, 'A2')).toHaveText('Alice');
  await expect(cell(page, 'B2')).toHaveText('Hello, world');
  await expect(cell(page, 'C2')).toHaveText('1');
  await expect(cell(page, 'B3')).toHaveText('Say "hi"');
  await expect(cell(page, 'A4')).toHaveText('Carol');
  await expect(cell(page, 'B4')).toHaveText(/Line1\s+Line2/);
  await expect(cell(page, 'C4')).toHaveText('3');

  await page.reload();
  await expect(cell(page, 'B2')).toHaveText('Hello, world');
  await expect(cell(page, 'B3')).toHaveText('Say "hi"');

  await gotoHome(page);
  await expect(page.getByRole('link', { name: stem, exact: true })).toBeVisible();
});

test('REQ-1-3-1 -the requested workflow CSV,the requested workflow', async ({ page }) => {
  const stem = `invalid-${u()}`;
  await gotoHome(page);
  await page.getByRole('button', { name: 'Import CSV', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import CSV', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('CSV file', { exact: true }).setInputFiles({
    name: `${stem}.csv`,
    mimeType: 'text/csv',
    buffer: Buffer.from('"unterminated,5\nx,y\n', 'utf8'),
  });
  await dialog.getByRole('button', { name: 'Confirm import', exact: true }).click();
  await expect(page.getByText('Invalid CSV file format. Import failed.', { exact: true })).toBeVisible();
  await expect(worksheetGrid(page)).toHaveCount(0);
  await gotoHome(page);
  await expect(page.getByRole('link', { name: 'Q3 Sales', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: stem, exact: true })).toHaveCount(0);
});

test('REQ-1-3-1 -the requested workflow CSV,the requested workflow', async ({ page }) => {
  const stem = `reopen-${u()}`;
  const csv = 'City,Amount\nEast,1200\nNorth,800\n';
  await importCsv(page, stem, csv);

  await expect(cell(page, 'A1')).toHaveText('City');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B3')).toHaveText('800');

  await gotoHome(page);
  const link = page.getByRole('link', { name: stem, exact: true });
  await expect(link).toBeVisible();
  await link.click();
  await expect(worksheetGrid(page)).toBeVisible();
  await expect(cell(page, 'A1')).toHaveText('City');
  await expect(cell(page, 'B2')).toHaveText('1200');

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'A1')).toHaveText('City');
});

test('REQ-1-3-2 -the requested workflow,the requested workflow', async ({ page }) => {
  const stem = `export-${u()}`;
  const csv = 'h1,h2\n10,20\n30,40\n';
  await importCsv(page, stem, csv);

  await setCell(page, 'C1', '=A2+B2');
  await setCell(page, 'D1', '=A3+B3');
  await setCell(page, 'C2', 'x');
  await setCell(page, 'D2', 'y');
  await setCell(page, 'C3', 'x');
  await setCell(page, 'D3', 'y');

  await cell(page, 'C1').click();
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A2+B2');
  await expect(cell(page, 'C1')).toHaveText('30');

  const download = await exportCsv(page);
  expect(download.suggestedFilename()).toMatch(/\.csv$/i);
  const text = (await readDownload(download)).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const firstLine = text.split('\n')[0];
  expect(firstLine).toContain('h1');
  expect(firstLine).toContain('h2');
  expect(firstLine).toContain('30');
  expect(firstLine).toContain('70');
  expect(text).not.toContain('=A2+B2');
  expect(text).not.toContain('=A3+B3');

  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'C1')).toHaveText('30');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A2+B2');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'C1')).toHaveText('30');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A2+B2');
});

test('REQ-1-3-2 -the requested workflow', async ({ page }) => {
  const stem = `escape-${u()}`;
  const csv = 'name,note,x\nAlice,"Hello, world",\nBob,"Say ""hi""",2\nCarol,"Line1\nLine2",3\n';
  await importCsv(page, stem, csv);

  const download = await exportCsv(page);
  expect(download.suggestedFilename()).toMatch(/\.csv$/i);
  const text = (await readDownload(download)).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  expect(text).toContain('"Hello, world"');
  expect(text).toMatch(/"Hello, world"(,""|,)/);
  expect(text).toContain('"Say ""hi"""');
  expect(text).toContain('"Line1\nLine2"');

  await expect(cell(page, 'B2')).toHaveText('Hello, world');
  await expect(cell(page, 'B3')).toHaveText('Say "hi"');

  await page.reload();
  await expect(cell(page, 'B2')).toHaveText('Hello, world');
  await expect(cell(page, 'B3')).toHaveText('Say "hi"');
  await expect(cell(page, 'A1')).toHaveText('name');
});

test('REQ-1-3-2 -the requested workflow', async ({ page }) => {
  const stem = `state-${u()}`;
  await importCsv(page, stem, 'A,B\n1,2\n3,4\n');

  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Create filter', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Filter A', exact: true })).toBeVisible();

  await setCell(page, 'C1', '=A2+B2');
  await cell(page, 'C1').click();
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A2+B2');
  await expect(cell(page, 'C1')).toHaveText('3');

  const download = await exportCsv(page);
  const text = (await readDownload(download)).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const firstLine = text.split('\n')[0];
  expect(firstLine).toContain('A');
  expect(firstLine).toContain('B');
  expect(firstLine).toContain('3');
  expect(text).not.toContain('=A2+B2');

  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: 'Filter A', exact: true })).toBeVisible();
  await expect(cell(page, 'C1')).toHaveText('3');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A2+B2');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: 'Filter A', exact: true })).toBeVisible();
  await expect(cell(page, 'C1')).toHaveText('3');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A2+B2');
});

test('REQ-1-3-2 -the requested workflow Sheet1 the requested workflow', async ({ page }) => {
  const stem = `sheet1-${u()}`;
  await importCsv(page, stem, 'City,Amount\nEast,1200\n');

  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await setCell(page, 'A1', 'OTHER');

  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');

  const download = await exportCsv(page);
  expect(download.suggestedFilename()).toMatch(/\.csv$/i);
  const text = (await readDownload(download)).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  expect(text).toContain('City');
  expect(text).toContain('Amount');
  expect(text).toContain('East');
  expect(text).toContain('1200');
  expect(text).not.toContain('OTHER');

  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

