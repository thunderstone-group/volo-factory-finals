const { test, expect } = require('@playwright/test');
const fs = require('fs');

test.use({ acceptDownloads: true });

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function worksheetGrid(page) {
  return page.getByRole('grid', { name: 'Worksheet grid', exact: true });
}

function cell(page, coord) {
  return worksheetGrid(page).getByRole('gridcell', { name: coord, exact: true });
}

async function openQ3Sales(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Q3 Sales', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
}

async function createBlankWorkbook(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
}

async function importCsv(page, fileName, content) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Import CSV', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import CSV', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('CSV file', { exact: true }).setInputFiles({
    name: fileName,
    mimeType: 'text/csv',
    buffer: Buffer.from(content, 'utf8'),
  });
  await dialog.getByRole('button', { name: 'Confirm import', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
}

async function setCell(page, coord, value) {
  await cell(page, coord).click();
  const formulaBar = page.getByLabel('Formula bar', { exact: true });
  await formulaBar.fill(value);
  await formulaBar.press('Enter');
}

async function downloadCsv(page) {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  return downloadPromise;
}

async function csvText(download) {
  const filePath = await download.path();
  if (!filePath) throw new Error('Download path unavailable');
  return fs.readFileSync(filePath, 'utf8')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n$/, '');
}

test('REQ-1-1-1 -the requested workflow,the requested workflow page entry the requested workflow', async ({ page }) => {
  await page.goto('/');
  const q3 = page.getByRole('link', { name: 'Q3 Sales', exact: true });
  await expect(q3).toBeVisible();
  await expect(page.getByText(/Last updated:/).first()).toBeVisible();
  await q3.click();

  await expect(page.getByText('Q3 Sales', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('rowheader', { name: '1', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'A', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  const grid = worksheetGrid(page);
  await expect(grid).toHaveAttribute('aria-multiselectable', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('Region');

  const url = page.url();
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Region');

  await page.goto('/');
  await page.goto(url);
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Region');
});

test('REQ-1-1-1 -the requested workflow', async ({ page, browser }) => {
  await openQ3Sales(page);
  const url = page.url();
  await expect(cell(page, 'A1')).toHaveText('Region');

  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await setCell(page, 'A1', 'OtherWorkbookData');
  await expect(cell(page, 'A1')).toHaveText('OtherWorkbookData');

  const context2 = await browser.newContext();
  const page2 = await context2.newPage();
  await page2.goto(url);
  await expect(page2.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  const q3grid = page2.getByRole('grid', { name: 'Worksheet grid', exact: true });
  await expect(q3grid.getByRole('gridcell', { name: 'A1', exact: true })).toHaveText('Region');
  await expect(q3grid.getByText('OtherWorkbookData', { exact: true })).toHaveCount(0);
  await context2.close();
});

test('REQ-1-2-1 -the requested workflow,the requested workflow Sheet1 the requested workflow A1 the requested workflow', async ({ page }) => {
  await page.goto('/');
  const before = await page.getByText(/Last updated:/).count();

  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();

  const sheet1 = page.getByRole('tab', { name: 'Sheet1', exact: true });
  await expect(sheet1).toBeVisible();
  await expect(sheet1).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab')).toHaveCount(1);
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');

  await page.goto('/');
  const after = await page.getByText(/Last updated:/).count();
  expect(after).toBeGreaterThan(before);
});

test('REQ-1-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await page.getByRole('button', { name: 'Rename workbook', exact: true }).click();
  const input = page.getByLabel('Workbook name', { exact: true });
  await expect(input).toBeVisible();
  const newName = 'Renamed ' + u();
  await input.fill(newName);
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText(newName, { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(newName, { exact: true }).first()).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('link', { name: newName, exact: true })).toBeVisible();
});

test('REQ-1-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await page.getByRole('button', { name: 'Rename workbook', exact: true }).click();
  const input = page.getByLabel('Workbook name', { exact: true });
  await expect(input).toBeVisible();
  await input.fill('   ');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Workbook name cannot be empty', { exact: true })).toBeVisible();
});

test('REQ-1-3-1 -the requested workflow UTF-8 CSV,the requested workflow', async ({ page }) => {
  const fileName = 'utf8-' + u() + '.csv';
  const workbookName = fileName.replace(/\.csv$/, '');
  const content = '名称,数量,备注\n苹果,3,"含,逗号"\nPen,2,English\n"含""引号""文本",,"第二行\n换行"\n';
  await importCsv(page, fileName, content);

  const grid = worksheetGrid(page);
  await expect(grid.getByRole('gridcell', { name: 'A1', exact: true })).toHaveText('名称');
  await expect(grid.getByRole('gridcell', { name: 'A2', exact: true })).toHaveText('苹果');
  await expect(grid.getByRole('gridcell', { name: 'B2', exact: true })).toHaveText('3');
  await expect(grid.getByRole('gridcell', { name: 'C2', exact: true })).toHaveText('含,逗号');
  await expect(grid.getByRole('gridcell', { name: 'A3', exact: true })).toHaveText('Pen');
  await expect(grid.getByRole('gridcell', { name: 'C3', exact: true })).toHaveText('English');
  await expect(grid.getByRole('gridcell', { name: 'A4', exact: true })).toHaveText('含"引号"文本');
  await expect(grid.getByRole('gridcell', { name: 'B4', exact: true })).toHaveText('');
  await expect(grid.getByRole('gridcell', { name: 'C4', exact: true })).toHaveText(/第二行[\s\S]*换行/);

  await page.reload();
  await expect(worksheetGrid(page).getByRole('gridcell', { name: 'A2', exact: true })).toHaveText('苹果');
  await page.goto('/');
  await expect(page.getByRole('link', { name: workbookName, exact: true })).toBeVisible();
});

test('REQ-1-3-1 -the requested workflow CSV the requested workflow,the requested workflow', async ({ page }) => {
  const fileName = 'invalid-' + u() + '.csv';
  const workbookName = fileName.replace(/\.csv$/, '');
  await page.goto('/');
  await page.getByRole('button', { name: 'Import CSV', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import CSV', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('CSV file', { exact: true }).setInputFiles({
    name: fileName,
    mimeType: 'text/csv',
    buffer: Buffer.from('"unclosed,value\n', 'utf8'),
  });
  await dialog.getByRole('button', { name: 'Confirm import', exact: true }).click();
  await expect(page.getByText('Invalid CSV file format. Import failed.', { exact: true })).toBeVisible();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toHaveCount(0);

  await page.goto('/');
  await expect(page.getByRole('link', { name: workbookName, exact: true })).toHaveCount(0);
});

test('REQ-1-3-1 -the requested workflow CSV,the requested workflow', async ({ page }) => {
  const fileName = 'escape-' + u() + '.csv';
  const workbookName = fileName.replace(/\.csv$/, '');
  const content = 'a,b,c,d\n1,,"x""y",3\n,5,,\n"line1\nline2",,,7\n';
  await importCsv(page, fileName, content);

  const grid = worksheetGrid(page);
  await expect(grid.getByRole('gridcell', { name: 'A2', exact: true })).toHaveText('1');
  await expect(grid.getByRole('gridcell', { name: 'B2', exact: true })).toHaveText('');
  await expect(grid.getByRole('gridcell', { name: 'C2', exact: true })).toHaveText('x"y');
  await expect(grid.getByRole('gridcell', { name: 'D2', exact: true })).toHaveText('3');
  await expect(grid.getByRole('gridcell', { name: 'A3', exact: true })).toHaveText('');
  await expect(grid.getByRole('gridcell', { name: 'B3', exact: true })).toHaveText('5');
  await expect(grid.getByRole('gridcell', { name: 'A4', exact: true })).toHaveText(/line1[\s\S]*line2/);
  await expect(grid.getByRole('gridcell', { name: 'D4', exact: true })).toHaveText('7');

  await page.reload();
  await expect(worksheetGrid(page).getByRole('gridcell', { name: 'C2', exact: true })).toHaveText('x"y');
  await page.goto('/');
  await expect(page.getByRole('link', { name: workbookName, exact: true })).toBeVisible();
});

test('REQ-1-3-1 -the requested workflow CSV,the requested workflow', async ({ page }) => {
  const fileName = 'simple-' + u() + '.csv';
  const workbookName = fileName.replace(/\.csv$/, '');
  await importCsv(page, fileName, 'English,Number\nPen,4\n');
  await expect(cell(page, 'A1')).toHaveText('English');
  await expect(cell(page, 'B1')).toHaveText('Number');
  await expect(cell(page, 'A2')).toHaveText('Pen');
  await expect(cell(page, 'B2')).toHaveText('4');

  await page.goto('/');
  await page.getByRole('link', { name: workbookName, exact: true }).click();
  await expect(cell(page, 'A2')).toHaveText('Pen');
  await page.reload();
  await expect(cell(page, 'B2')).toHaveText('4');
});

test('REQ-1-3-2 -the requested workflow,the requested workflow', async ({ page }) => {
  const fileName = 'export-' + u() + '.csv';
  const content = 'Name,Note,Qty\nPen,"has, comma",3\nNotebook,"line1\nline2",""\nDesk,"He said ""hi""",2\n';
  await importCsv(page, fileName, content);
  await setCell(page, 'C5', '=C2+C4');
  await expect(cell(page, 'C5')).toHaveText('5');
  await cell(page, 'C5').click();
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=C2+C4');

  const download = await downloadCsv(page);
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
  const text = await csvText(download);
  expect(text).toBe('Name,Note,Qty\nPen,"has, comma",3\nNotebook,"line1\nline2",\nDesk,"He said ""hi""",2\n,,5');

  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'C5')).toHaveText('5');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=C2+C4');

  await page.reload();
  await expect(cell(page, 'C5')).toHaveText('5');
});

test('REQ-1-3-2 -the requested workflow', async ({ page }) => {
  const fileName = 'active-' + u() + '.csv';
  await importCsv(page, fileName, 'Name\nSheet1Value\n');
  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await setCell(page, 'A1', 'SecondData');
  await expect(cell(page, 'A1')).toHaveText('SecondData');

  const download = await downloadCsv(page);
  const text = await csvText(download);
  expect(text).toBe('SecondData');

  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('SecondData');
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('SecondData');
});

test('REQ-1-3-2 -the requested workflow', async ({ page }) => {
  const fileName = 'filter-' + u() + '.csv';
  await importCsv(page, fileName, 'Region,Sales\nEast,1200\nNorth,800\n');

  const grid = worksheetGrid(page);
  await grid.getByRole('gridcell', { name: 'A1', exact: true }).hover();
  await page.mouse.down();
  await grid.getByRole('gridcell', { name: 'B3', exact: true }).hover();
  await page.mouse.up();

  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Create filter', exact: true }).click();
  await page.getByRole('button', { name: 'Filter Region', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Filter Region', exact: true });
  await dialog.getByRole('button', { name: 'Clear selection', exact: true }).click();
  await dialog.getByRole('checkbox', { name: 'East', exact: true }).check();
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();

  await expect(worksheetGrid(page).getByRole('gridcell', { name: 'A3', exact: true })).not.toBeVisible();

  const download = await downloadCsv(page);
  const text = await csvText(download);
  expect(text).toContain('North');

  await expect(page.getByRole('button', { name: 'Filter Region', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Filter Region', exact: true })).toBeVisible();
  await expect(worksheetGrid(page).getByRole('gridcell', { name: 'A3', exact: true })).not.toBeVisible();
});

test('REQ-1-3-2 -the requested workflow Sheet1 the requested workflow', async ({ page }) => {
  const fileName = 'simple-export-' + u() + '.csv';
  await importCsv(page, fileName, 'A,B\n1,2\n');
  await expect(cell(page, 'A1')).toHaveText('A');

  const download = await downloadCsv(page);
  const text = await csvText(download);
  expect(text).toBe('A,B\n1,2');
  expect(download.suggestedFilename()).toMatch(/\.csv$/);

  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.reload();
  await expect(cell(page, 'B2')).toHaveText('2');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

