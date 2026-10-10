const { test, expect } = require('@playwright/test');
const fs = require('fs');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const grid = (page) => page.getByRole('grid', { name: 'Worksheet grid', exact: true });
const cell = (page, coord) => page.getByRole('gridcell', { name: coord, exact: true });
const bar = (page) => page.getByLabel('Formula bar', { exact: true });
const tab = (page, name) => page.getByRole('tab', { name, exact: true });

// Creates a blank workbook through the documented home-page flow.
async function createBlankWorkbook(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(grid(page)).toBeVisible();
}

// Opens the "Import CSV" dialog, attaches a file and confirms the import.
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
}

async function importCsvSuccess(page, baseName, content) {
  await importCsv(page, baseName + '.csv', content);
  await expect(grid(page)).toBeVisible();
}

// Types a value into the selected cell through the "Formula bar" and commits with Enter.
async function setCell(page, coord, value) {
  await cell(page, coord).click();
  await bar(page).fill(value);
  await bar(page).press('Enter');
}

async function exportCsv(page) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export CSV', exact: true }).click(),
  ]);
  const filePath = await download.path();
  if (!filePath) throw new Error('export did not produce a downloaded file');
  return { download, text: fs.readFileSync(filePath, 'utf8') };
}

test('REQ-1-1-1: REQ-1-1-1 -the requested workflow,the requested workflow page entry the requested workflow', async ({ page }) => {
  await page.goto('/');
  const workbookLink = page.getByRole('link', { name: 'Q3 Sales', exact: true });
  await expect(workbookLink).toBeVisible();
  await expect(page.getByText(/Last updated:/).first()).toBeVisible();

  await workbookLink.click();
  await expect(grid(page)).toBeVisible();
  await expect(page.getByText('Q3 Sales', { exact: false }).first()).toBeVisible();
  await expect(page.getByText(/Last updated:/).first()).toBeVisible();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(grid(page)).toHaveAttribute('aria-multiselectable', 'true');
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(bar(page)).toHaveValue('Region');

  const editorUrl = page.url();

  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(page.getByText('Q3 Sales', { exact: false }).first()).toBeVisible();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(bar(page)).toHaveValue('Region');

  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Q3 Sales', exact: true })).toBeVisible();
  await page.goto(editorUrl);
  await expect(grid(page)).toBeVisible();
  await expect(page.getByText('Q3 Sales', { exact: false }).first()).toBeVisible();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(bar(page)).toHaveValue('Region');
});

test('REQ-1-1-1#2: REQ-1-1-1 -the requested workflow', async ({ page }) => {
  // Build a second workbook with its own marker so isolation from Q3 Sales can be observed.
  const marker = 'marker-' + u();
  await createBlankWorkbook(page);
  await setCell(page, 'A1', marker);
  await expect(cell(page, 'A1')).toHaveText(marker);

  await page.goto('/');
  await page.getByRole('link', { name: 'Q3 Sales', exact: true }).click();
  await expect(grid(page)).toBeVisible();
  await expect(page.getByText(marker, { exact: true })).toHaveCount(0);
  await expect(cell(page, 'A1')).toHaveText('Region');

  await setCell(page, 'A2', 'East');
  await setCell(page, 'B2', '1200');
  await setCell(page, 'A3', 'North');
  await setCell(page, 'B3', '800');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'B3')).toHaveText('800');

  const editorUrl = page.url();

  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(page.getByText('Q3 Sales', { exact: false }).first()).toBeVisible();
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'B3')).toHaveText('800');

  await page.goto('/');
  await page.goto(editorUrl);
  await expect(grid(page)).toBeVisible();
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B3')).toHaveText('800');
});

test('REQ-1-2-1: REQ-1-2-1 -the requested workflow,the requested workflow Sheet1 the requested workflow A1 the requested workflow', async ({ page }) => {
  await page.goto('/');
  const linksBefore = (await page.getByRole('link').allTextContents()).map((t) => t.trim());

  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(grid(page)).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(1);
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('');
  await expect(bar(page)).toHaveValue('');

  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('');
  await expect(bar(page)).toHaveValue('');

  await page.goto('/');
  const linksAfter = (await page.getByRole('link').allTextContents()).map((t) => t.trim());
  const createdNames = linksAfter.filter((name) => !linksBefore.includes(name));
  expect(createdNames.length).toBeGreaterThan(0);
  await page.getByRole('link', { name: createdNames[0], exact: true }).click();
  await expect(grid(page)).toBeVisible();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('');
  await expect(bar(page)).toHaveValue('');
});

test('REQ-1-2-2: REQ-1-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);

  const newName = 'Sales ' + u();
  await page.getByRole('button', { name: 'Rename workbook', exact: true }).click();
  const nameBox = page.getByLabel('Workbook name', { exact: true });
  await expect(nameBox).toBeVisible();
  expect((await nameBox.inputValue()).trim().length).toBeGreaterThan(0);

  await nameBox.fill(newName);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(nameBox).toHaveCount(0);
  await expect(page.getByText(newName, { exact: false }).first()).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('link', { name: newName, exact: true })).toBeVisible();

  await page.getByRole('link', { name: newName, exact: true }).click();
  await expect(grid(page)).toBeVisible();
  await expect(page.getByText(newName, { exact: false }).first()).toBeVisible();

  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(page.getByText(newName, { exact: false }).first()).toBeVisible();
});

test('REQ-1-2-2#2: REQ-1-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);

  await page.getByRole('button', { name: 'Rename workbook', exact: true }).click();
  const nameBox = page.getByLabel('Workbook name', { exact: true });
  await expect(nameBox).toBeVisible();
  const originalName = (await nameBox.inputValue()).trim();
  expect(originalName.length).toBeGreaterThan(0);
  await expect(page.getByText(originalName, { exact: false }).first()).toBeVisible();

  await nameBox.fill('');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Workbook name cannot be empty', { exact: true })).toBeVisible();
  await expect(page.getByText(originalName, { exact: false }).first()).toBeVisible();

  await nameBox.fill('   ');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Workbook name cannot be empty', { exact: true })).toBeVisible();
  await expect(page.getByText(originalName, { exact: false }).first()).toBeVisible();

  const newName = 'Q3 Renamed ' + u();
  await nameBox.fill(newName);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(nameBox).toHaveCount(0);
  await expect(page.getByText(newName, { exact: false }).first()).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('link', { name: newName, exact: true })).toBeVisible();

  await page.getByRole('link', { name: newName, exact: true }).click();
  await expect(grid(page)).toBeVisible();
  await expect(page.getByText(newName, { exact: false }).first()).toBeVisible();

  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(page.getByText(newName, { exact: false }).first()).toBeVisible();
});

test('REQ-1-3-1: REQ-1-3-1 -the requested workflow UTF-8 CSV,the requested workflow', async ({ page }) => {
  const workbookName = 'Import ' + u();
  const content = 'Region,City,Amount\n华东,上海,1200\nEast,North,800\n';

  await importCsvSuccess(page, workbookName, content);

  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText(workbookName, { exact: false }).first()).toBeVisible();
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('City');
  await expect(cell(page, 'C1')).toHaveText('Amount');
  await expect(cell(page, 'A2')).toHaveText('华东');
  await expect(cell(page, 'B2')).toHaveText('上海');
  await expect(cell(page, 'C2')).toHaveText('1200');
  await expect(cell(page, 'A3')).toHaveText('East');
  await expect(cell(page, 'B3')).toHaveText('North');
  await expect(cell(page, 'C3')).toHaveText('800');

  // The first row remains ordinary data.
  await cell(page, 'A1').click();
  await expect(bar(page)).toHaveValue('Region');

  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'C1')).toHaveText('Amount');
  await expect(cell(page, 'A2')).toHaveText('华东');
  await expect(cell(page, 'B2')).toHaveText('上海');
  await expect(cell(page, 'A3')).toHaveText('East');
  await expect(cell(page, 'C3')).toHaveText('800');

  await page.goto('/');
  await page.getByRole('link', { name: workbookName, exact: true }).click();
  await expect(grid(page)).toBeVisible();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'A2')).toHaveText('华东');
  await expect(cell(page, 'B3')).toHaveText('North');
  await expect(cell(page, 'C3')).toHaveText('800');
});

test('REQ-1-3-1#2: REQ-1-3-1 -the requested workflow CSV the requested workflow,the requested workflow', async ({ page }) => {
  const workbookName = 'Quoted ' + u();
  const content = 'Name,Note,Qty\n"A, B","He said ""hi""",3\nC,,4\nD,"line1\nline2",5\n';

  await importCsvSuccess(page, workbookName, content);

  await expect(cell(page, 'A1')).toHaveText('Name');
  await expect(cell(page, 'A2')).toHaveText('A, B');
  await expect(cell(page, 'B2')).toHaveText('He said "hi"');
  await expect(cell(page, 'C2')).toHaveText('3');
  await expect(cell(page, 'A3')).toHaveText('C');
  await expect(cell(page, 'B3')).toHaveText('');
  await expect(cell(page, 'C3')).toHaveText('4');
  await expect(cell(page, 'A4')).toHaveText('D');
  await expect(cell(page, 'B4')).toHaveText(/line1\s*line2/);
  await expect(cell(page, 'C4')).toHaveText('5');

  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(cell(page, 'A2')).toHaveText('A, B');
  await expect(cell(page, 'B2')).toHaveText('He said "hi"');
  await expect(cell(page, 'B3')).toHaveText('');
  await expect(cell(page, 'B4')).toHaveText(/line1\s*line2/);
  await expect(cell(page, 'C4')).toHaveText('5');
});

test('REQ-1-3-1#3: REQ-1-3-1 -the requested workflow CSV,the requested workflow', async ({ page }) => {
  const workbookName = 'Broken ' + u();
  const content = 'Region,Value\n"East,1200\n';

  await importCsv(page, workbookName + '.csv', content);

  await expect(page.getByText('Invalid CSV file format. Import failed.', { exact: true })).toBeVisible();
  await expect(grid(page)).toHaveCount(0);

  await page.goto('/');
  await expect(page.getByRole('link', { name: workbookName, exact: true })).toHaveCount(0);
});

test('REQ-1-3-1#4: REQ-1-3-1 -the requested workflow CSV,the requested workflow', async ({ page }) => {
  const workbookName = 'Partial ' + u();
  const content = 'Region,Value\nEast,1200\nNorth,"800\n';

  await importCsv(page, workbookName + '.csv', content);

  await expect(page.getByText('Invalid CSV file format. Import failed.', { exact: true })).toBeVisible();
  await expect(grid(page)).toHaveCount(0);

  await page.goto('/');
  await expect(page.getByRole('link', { name: workbookName, exact: true })).toHaveCount(0);
});

test('REQ-1-3-2: REQ-1-3-2 -the requested workflow,the requested workflow', async ({ page }) => {
  const workbookName = 'Export ' + u();
  await importCsvSuccess(page, workbookName, 'Item,Qty\nPen,4\n');
  await expect(cell(page, 'A1')).toHaveText('Item');

  await setCell(page, 'B3', '=B2*2');
  await expect(cell(page, 'B3')).toHaveText('8');
  await expect(bar(page)).toHaveValue('=B2*2');

  const { download, text } = await exportCsv(page);
  expect(download.suggestedFilename()).toMatch(/\.csv$/i);
  const lines = text.trim().split(/\r?\n/);
  expect(lines[0]).toBe('Item,Qty');
  expect(lines[1]).toBe('Pen,4');
  expect(lines[2]).toContain('8');
  expect(text).not.toContain('=B2*2');

  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Item');
  await expect(cell(page, 'B2')).toHaveText('4');
  await expect(cell(page, 'B3')).toHaveText('8');
  await expect(bar(page)).toHaveValue('=B2*2');

  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Item');
  await expect(cell(page, 'B3')).toHaveText('8');
  await cell(page, 'B3').click();
  await expect(bar(page)).toHaveValue('=B2*2');
});

test('REQ-1-3-2#2: REQ-1-3-2 -the requested workflow', async ({ page }) => {
  const workbookName = 'Escaped ' + u();
  const content = 'Name,Note,Qty\nPen,"He said ""hi""",4\nInk,,5\nPad,"line1\nline2",6\n';
  await importCsvSuccess(page, workbookName, content);

  const { download, text } = await exportCsv(page);
  expect(download.suggestedFilename()).toMatch(/\.csv$/i);
  expect(text).toContain('Name,Note,Qty');
  expect(text).toContain('"He said ""hi"""');
  expect(text).toContain('Ink,,5');
  expect(text).toMatch(/"line1\r?\nline2"/);

  const penIndex = text.indexOf('Pen');
  const inkIndex = text.indexOf('Ink');
  const padIndex = text.indexOf('Pad');
  expect(penIndex).toBeGreaterThan(-1);
  expect(inkIndex).toBeGreaterThan(penIndex);
  expect(padIndex).toBeGreaterThan(inkIndex);

  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Name');
  await expect(cell(page, 'B2')).toHaveText('He said "hi"');
  await expect(cell(page, 'B3')).toHaveText('');

  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A2')).toHaveText('Pen');
  await expect(cell(page, 'C4')).toHaveText('6');
});

test('REQ-1-3-2#3: REQ-1-3-2 -the requested workflow', async ({ page }) => {
  const workbookName = 'Active ' + u();
  await importCsvSuccess(page, workbookName, 'Item,Qty\nPen,4\n');
  await expect(cell(page, 'A1')).toHaveText('Item');

  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
  await expect(tab(page, 'Sheet2')).toHaveAttribute('aria-selected', 'true');
  await setCell(page, 'A1', 'SecondSheetOnly');
  await expect(cell(page, 'A1')).toHaveText('SecondSheetOnly');

  await tab(page, 'Sheet1').click();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await cell(page, 'A1').click();
  await expect(cell(page, 'A1')).toHaveText('Item');

  const { download, text } = await exportCsv(page);
  expect(download.suggestedFilename()).toMatch(/\.csv$/i);
  expect(text).toContain('Item');
  expect(text).toContain('Pen');
  expect(text).not.toContain('SecondSheetOnly');

  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Item');
  await expect(bar(page)).toHaveValue('Item');

  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Item');

  await tab(page, 'Sheet2').click();
  await expect(cell(page, 'A1')).toHaveText('SecondSheetOnly');
});

test('REQ-1-3-2#4: REQ-1-3-2 -the requested workflow Sheet1 the requested workflow', async ({ page }) => {
  const workbookName = 'Utf8 ' + u();
  await importCsvSuccess(page, workbookName, '地区,金额\n华东,1200\n华北,800\n');

  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('地区');
  await cell(page, 'A1').click();
  await expect(bar(page)).toHaveValue('地区');

  const { download, text } = await exportCsv(page);
  expect(download.suggestedFilename()).toMatch(/\.csv$/i);
  expect(text).toContain('地区,金额');
  expect(text).toContain('华东,1200');
  expect(text).toContain('华北,800');

  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('地区');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(bar(page)).toHaveValue('地区');

  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('地区');
  await expect(cell(page, 'A2')).toHaveText('华东');
  await expect(cell(page, 'B3')).toHaveText('800');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

