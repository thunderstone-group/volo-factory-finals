const { test, expect } = require('@playwright/test');

test.setTimeout(15000);

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function grid(page) {
  return page.getByRole('grid', { name: 'Worksheet grid', exact: true });
}

function cell(page, coordinate) {
  return grid(page).getByRole('gridcell', { name: coordinate, exact: true });
}

function tab(page, name) {
  return page.getByRole('tab', { name, exact: true });
}

function formulaBar(page) {
  return page.getByLabel('Formula bar', { exact: true });
}

async function expectCellText(page, coordinate, text) {
  await expect(cell(page, coordinate)).toHaveText(text);
}

async function createBlankWorkbook(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(grid(page)).toBeVisible();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
}

async function setCell(page, coordinate, value) {
  await cell(page, coordinate).click();
  const fb = formulaBar(page);
  await fb.fill(value);
  await fb.press('Enter');
}

async function importCsv(page, fileName, content) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Import CSV', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import CSV', exact: true });
  await dialog.getByLabel('CSV file', { exact: true }).setInputFiles({
    name: fileName,
    mimeType: 'text/csv',
    buffer: Buffer.from(content, 'utf8'),
  });
  await dialog.getByRole('button', { name: 'Confirm import', exact: true }).click();
  await expect(grid(page)).toBeVisible();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
}

async function exportCsv(page) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export CSV', exact: true }).click(),
  ]);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return {
    filename: download.suggestedFilename(),
    text: Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/, ''),
  };
}

test('REQ-1-1-1: REQ-1-1-1 -the requested workflow,the requested workflow page entry the requested workflow', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/Last updated:/).first()).toBeVisible();
  await page.getByRole('link', { name: 'Q3 Sales', exact: true }).click();

  await expect(grid(page)).toBeVisible();
  await expect(grid(page)).toHaveAttribute('aria-multiselectable', 'true');
  await expect(page.getByText('Q3 Sales', { exact: true }).first()).toBeVisible();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expectCellText(page, 'A1', 'Region');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(formulaBar(page)).toHaveValue('Region');
  await expect(page.getByText(/Last updated:/).first()).toBeVisible();

  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expectCellText(page, 'A1', 'Region');
  await expect(formulaBar(page)).toHaveValue('Region');
});

test('REQ-1-1-1#2: REQ-1-1-1 -the requested workflow', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Q3 Sales', exact: true }).click();
  await expect(grid(page)).toBeVisible();

  const editorUrl = page.url();
  await page.goto('/');
  await page.goto(editorUrl);

  await expect(grid(page)).toBeVisible();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expectCellText(page, 'A1', 'Region');
  await expect(formulaBar(page)).toHaveValue('Region');
});

test('REQ-1-2-1: REQ-1-2-1 -the requested workflow,the requested workflow Sheet1 the requested workflow A1 the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);

  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab')).toHaveCount(1);
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(formulaBar(page)).toHaveValue('');

  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(formulaBar(page)).toHaveValue('');
});

test('REQ-1-2-2: REQ-1-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  const name = `Renamed ${u()}`;
  await createBlankWorkbook(page);

  await page.getByRole('button', { name: 'Rename workbook', exact: true }).click();
  await page.getByLabel('Workbook name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('link', { name, exact: true })).toBeVisible();
  await page.getByRole('link', { name, exact: true }).click();
  await expect(grid(page)).toBeVisible();
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
});

test('REQ-1-2-2#2: REQ-1-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  const original = `Keep ${u()}`;
  await createBlankWorkbook(page);

  await page.getByRole('button', { name: 'Rename workbook', exact: true }).click();
  await page.getByLabel('Workbook name', { exact: true }).fill(original);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(original, { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Rename workbook', exact: true }).click();
  await page.getByLabel('Workbook name', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText('Workbook name cannot be empty', { exact: true })).toBeVisible();
  await expect(page.getByText(original, { exact: true }).first()).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('link', { name: original, exact: true })).toBeVisible();
});

test('REQ-1-3-1: REQ-1-3-1 -the requested workflow UTF-8 CSV,the requested workflow', async ({ page }) => {
  const fileName = `utf8-${u()}.csv`;
  const workbookName = fileName.replace(/\.csv$/i, '');
  const csv = '名称,数量,备注\n苹果,3,新鲜\nBanana,,\n中文,5,OK\n';

  await importCsv(page, fileName, csv);

  await expectCellText(page, 'A1', '名称');
  await expectCellText(page, 'B1', '数量');
  await expectCellText(page, 'C1', '备注');
  await expectCellText(page, 'A2', '苹果');
  await expectCellText(page, 'B2', '3');
  await expectCellText(page, 'C2', '新鲜');
  await expectCellText(page, 'A3', 'Banana');
  await expect(cell(page, 'B3')).toHaveText('');
  await expect(cell(page, 'C3')).toHaveText('');
  await expectCellText(page, 'A4', '中文');
  await expectCellText(page, 'B4', '5');
  await expectCellText(page, 'C4', 'OK');

  await page.reload();
  await expectCellText(page, 'A1', '名称');
  await expectCellText(page, 'A2', '苹果');
  await expectCellText(page, 'A4', '中文');

  await page.goto('/');
  await expect(page.getByRole('link', { name: workbookName, exact: true })).toBeVisible();
  await page.getByRole('link', { name: workbookName, exact: true }).click();
  await expect(grid(page)).toBeVisible();
  await expectCellText(page, 'A4', '中文');
});

test('REQ-1-3-1#2: REQ-1-3-1 -the requested workflow CSV the requested workflow,the requested workflow', async ({ page }) => {
  const fileName = `quoted-${u()}.csv`;
  const workbookName = fileName.replace(/\.csv$/i, '');
  const csv = 'Name,Note\n"Smith, John","line1\nline2"\n';

  await importCsv(page, fileName, csv);

  await expectCellText(page, 'A1', 'Name');
  await expectCellText(page, 'B1', 'Note');
  await expectCellText(page, 'A2', 'Smith, John');
  await cell(page, 'B2').click();
  await expect(formulaBar(page)).toHaveValue('line1\nline2');

  await page.reload();
  await expectCellText(page, 'A2', 'Smith, John');
  await cell(page, 'B2').click();
  await expect(formulaBar(page)).toHaveValue('line1\nline2');

  await page.goto('/');
  await expect(page.getByRole('link', { name: workbookName, exact: true })).toBeVisible();
});

test('REQ-1-3-1#3: REQ-1-3-1 -the requested workflow CSV,the requested workflow', async ({ page }) => {
  const fileName = `escaped-${u()}.csv`;
  const workbookName = fileName.replace(/\.csv$/i, '');
  const csv = 'Title,Value\n"He said ""hi""",5\n';

  await importCsv(page, fileName, csv);

  await expectCellText(page, 'A1', 'Title');
  await expectCellText(page, 'B1', 'Value');
  await expectCellText(page, 'A2', 'He said "hi"');
  await expectCellText(page, 'B2', '5');

  await page.reload();
  await expectCellText(page, 'A2', 'He said "hi"');

  await page.goto('/');
  await expect(page.getByRole('link', { name: workbookName, exact: true })).toBeVisible();
});

test('REQ-1-3-1#4: REQ-1-3-1 -the requested workflow CSV,the requested workflow', async ({ page }) => {
  const fileName = `bad-${u()}.csv`;
  const workbookName = fileName.replace(/\.csv$/i, '');

  await page.goto('/');
  await page.getByRole('button', { name: 'Import CSV', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import CSV', exact: true });
  await dialog.getByLabel('CSV file', { exact: true }).setInputFiles({
    name: fileName,
    mimeType: 'text/csv',
    buffer: Buffer.from('"unterminated,1\n', 'utf8'),
  });
  await dialog.getByRole('button', { name: 'Confirm import', exact: true }).click();

  await expect(page.getByText('Invalid CSV file format. Import failed.', { exact: true })).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('link', { name: workbookName, exact: true })).toHaveCount(0);
});

test('REQ-1-3-2: REQ-1-3-2 -the requested workflow,the requested workflow', async ({ page }) => {
  const fileName = `export-escape-${u()}.csv`;
  const csv = 'Name,Note,Qty\n"Smith, John","line1\nline2",\n';

  await importCsv(page, fileName, csv);

  const { filename, text } = await exportCsv(page);
  expect(filename.endsWith('.csv')).toBeTruthy();
  expect(text.replace(/\r\n/g, '\n')).toBe('Name,Note,Qty\n"Smith, John","line1\nline2",\n');
});

test('REQ-1-3-2#2: REQ-1-3-2 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);

  await setCell(page, 'A1', '2');
  await setCell(page, 'B1', '3');
  await setCell(page, 'C1', '=A1+B1');

  await expectCellText(page, 'C1', '5');
  await cell(page, 'C1').click();
  await expect(formulaBar(page)).toHaveValue('=A1+B1');

  const { filename, text } = await exportCsv(page);
  expect(filename.endsWith('.csv')).toBeTruthy();
  expect(text.replace(/\r\n/g, '\n')).toBe('2,3,5\n');
});

test('REQ-1-3-2#3: REQ-1-3-2 -the requested workflow', async ({ page }) => {
  const fileName = `export-state-${u()}.csv`;
  const csv = 'Alpha,Beta\n1,2\n';

  await importCsv(page, fileName, csv);

  await cell(page, 'A1').click();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expectCellText(page, 'A1', 'Alpha');
  await expect(formulaBar(page)).toHaveValue('Alpha');

  const { filename, text } = await exportCsv(page);
  expect(filename.endsWith('.csv')).toBeTruthy();
  expect(text.replace(/\r\n/g, '\n')).toBe('Alpha,Beta\n1,2\n');

  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expectCellText(page, 'A1', 'Alpha');
  await expect(formulaBar(page)).toHaveValue('Alpha');

  await page.reload();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expectCellText(page, 'A1', 'Alpha');
  await expect(formulaBar(page)).toHaveValue('Alpha');
});

test('REQ-1-3-2#4: REQ-1-3-2 -the requested workflow Sheet1 the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);

  await setCell(page, 'A1', 'Sheet1Data');
  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
  await expect(tab(page, 'Sheet2')).toHaveAttribute('aria-selected', 'true');

  await setCell(page, 'A1', 'Sheet2Data');
  await tab(page, 'Sheet1').click();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');

  const sheet1 = await exportCsv(page);
  expect(sheet1.filename.endsWith('.csv')).toBeTruthy();
  expect(sheet1.text.replace(/\r\n/g, '\n').trim()).toBe('Sheet1Data');

  await tab(page, 'Sheet2').click();
  await expect(tab(page, 'Sheet2')).toHaveAttribute('aria-selected', 'true');

  const sheet2 = await exportCsv(page);
  expect(sheet2.filename.endsWith('.csv')).toBeTruthy();
  expect(sheet2.text.replace(/\r\n/g, '\n').trim()).toBe('Sheet2Data');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

