const { test, expect } = require('@playwright/test');
const fs = require('fs');

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const grid = (page) => page.getByRole('grid', { name: 'Worksheet grid', exact: true });
const cell = (page, coord) => page.getByRole('gridcell', { name: coord, exact: true });
const formulaBar = (page) => page.getByLabel('Formula bar', { exact: true });
const tab = (page, name) => page.getByRole('tab', { name, exact: true });
const renameBtn = (page) => page.getByRole('button', { name: 'Rename workbook', exact: true });
const nameBox = (page) => page.getByLabel('Workbook name', { exact: true });

const normalizeCsv = (text) => text.replace(/\r\n/g, '\n').replace(/\n+$/, '');

// Commit a value in a cell through the "Formula bar" text box (Enter commits).
async function setCellViaFormulaBar(page, coord, value) {
  await cell(page, coord).click();
  await formulaBar(page).click();
  await formulaBar(page).fill(value);
  await formulaBar(page).press('Enter');
}

// Commit a value in a cell through the inline editor opened by double-clicking.
async function setCellViaInlineEditor(page, coord, value) {
  await cell(page, coord).dblclick();
  const editor = page.getByRole('textbox', { name: `Edit ${coord}`, exact: true });
  await editor.fill(value);
  await editor.press('Enter');
}

// Create a blank workbook from the home page and wait for its editor.
async function createBlankWorkbook(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(grid(page)).toBeVisible();
}

// Give the currently open workbook a unique name so it can be reopened unambiguously.
async function renameWorkbook(page, newName) {
  await renameBtn(page).click();
  await nameBox(page).fill(newName);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(newName, { exact: true }).first()).toBeVisible();
}

// Import CSV text through the "Import CSV" dialog on the home page.
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
}

// Export the current active worksheet and return the suggested filename and text.
async function exportCsv(page) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export CSV', exact: true }).click(),
  ]);
  const file = await download.path();
  return { name: download.suggestedFilename(), text: fs.readFileSync(file, 'utf8') };
}

test('REQ-1-1-1: REQ-1-1-1 -the requested workflow,the requested workflow page entry the requested workflow', async ({ page }) => {
  await page.goto('/');
  const seeded = page.getByRole('link', { name: 'Q3 Sales', exact: true });
  await expect(seeded).toBeVisible();
  await seeded.click();

  await expect(grid(page)).toBeVisible();
  await expect(tab(page, 'Sheet1')).toBeVisible();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toContainText('Region');
  await cell(page, 'A1').click();
  await expect(formulaBar(page)).toHaveValue('Region');

  await setCellViaFormulaBar(page, 'A2', 'East');
  await setCellViaFormulaBar(page, 'B2', '1200');
  await setCellViaFormulaBar(page, 'A3', 'North');
  await setCellViaFormulaBar(page, 'B3', '800');
  await expect(cell(page, 'A2')).toContainText('East');
  await expect(cell(page, 'B3')).toContainText('800');

  // The current editor page entry stays directly accessible and identifies the same workbook.
  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(page.getByText('Q3 Sales', { exact: true }).first()).toBeVisible();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toContainText('Region');
  await expect(cell(page, 'A2')).toContainText('East');
  await expect(cell(page, 'B2')).toContainText('1200');
  await expect(cell(page, 'A3')).toContainText('North');
  await expect(cell(page, 'B3')).toContainText('800');
});

test('REQ-1-1-1#2: REQ-1-1-1 -the requested workflow', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Q3 Sales', exact: true }).click();
  await expect(grid(page)).toBeVisible();
  await expect(cell(page, 'A1')).toContainText('Region');

  await setCellViaInlineEditor(page, 'A2', 'East');
  await setCellViaInlineEditor(page, 'B2', '1200');
  await setCellViaInlineEditor(page, 'A3', 'North');
  await setCellViaInlineEditor(page, 'B3', '800');
  await cell(page, 'B2').click();
  await expect(formulaBar(page)).toHaveValue('1200');

  await page.reload();
  await expect(cell(page, 'A1')).toContainText('Region');
  await expect(cell(page, 'B2')).toContainText('1200');

  await page.goto('/');
  await page.getByRole('link', { name: 'Q3 Sales', exact: true }).click();
  await expect(grid(page)).toBeVisible();
  await expect(cell(page, 'A3')).toContainText('North');
  await expect(cell(page, 'B3')).toContainText('800');
});

test('REQ-1-2-1: REQ-1-2-1 -the requested workflow,the requested workflow Sheet1 the requested workflow A1 the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  const name = `Blank ${uid()}`;
  await renameWorkbook(page, name);

  await expect(tab(page, 'Sheet1')).toBeVisible();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveCount(0);
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(formulaBar(page)).toHaveValue('');

  await page.reload();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveCount(0);
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(formulaBar(page)).toHaveValue('');

  await page.goto('/');
  const link = page.getByRole('link', { name, exact: true });
  await expect(link).toBeVisible();
  await link.click();
  await expect(grid(page)).toBeVisible();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveCount(0);
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(formulaBar(page)).toHaveValue('');
});

test('REQ-1-2-2: REQ-1-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);

  await renameBtn(page).click();
  const box = nameBox(page);
  const original = await box.inputValue();
  expect(original.trim().length).toBeGreaterThan(0);
  const newName = `Renamed ${uid()}`;
  await box.fill(`   ${newName}   `);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(newName, { exact: true }).first()).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('link', { name: newName, exact: true })).toBeVisible();

  await page.getByRole('link', { name: newName, exact: true }).click();
  await expect(grid(page)).toBeVisible();
  await expect(page.getByText(newName, { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText(newName, { exact: true }).first()).toBeVisible();

  await renameBtn(page).click();
  await expect(nameBox(page)).toHaveValue(newName);
});

test('REQ-1-2-2#2: REQ-1-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);

  await renameBtn(page).click();
  const original = await nameBox(page).inputValue();
  await page.reload();
  await expect(grid(page)).toBeVisible();

  await renameBtn(page).click();
  const box = nameBox(page);
  await expect(box).toHaveValue(original);

  await box.fill('');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Workbook name cannot be empty', { exact: true })).toBeVisible();

  await box.fill('   ');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Workbook name cannot be empty', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText(original, { exact: true }).first()).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('link', { name: original, exact: true }).first()).toBeVisible();
});

test('REQ-1-3-1: REQ-1-3-1 -the requested workflow UTF-8 CSV,the requested workflow', async ({ page }) => {
  const base = `utf8-${uid()}`;
  const csv = '城市,Name,Qty\n北京,Pen,4\n上海,Pencil,10\n';
  await importCsv(page, `${base}.csv`, csv);

  await expect(grid(page)).toBeVisible();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toContainText('城市');
  await expect(cell(page, 'B1')).toContainText('Name');
  await expect(cell(page, 'C1')).toContainText('Qty');
  await expect(cell(page, 'A2')).toContainText('北京');
  await expect(cell(page, 'C2')).toContainText('4');
  await expect(cell(page, 'A3')).toContainText('上海');
  await expect(cell(page, 'C3')).toContainText('10');
  await expect(page.getByText(base, { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(cell(page, 'A1')).toContainText('城市');
  await expect(cell(page, 'A3')).toContainText('上海');
  await expect(cell(page, 'C3')).toContainText('10');

  await page.goto('/');
  await expect(page.getByRole('link', { name: base, exact: true })).toBeVisible();
  await page.getByRole('link', { name: base, exact: true }).click();
  await expect(grid(page)).toBeVisible();
  await expect(cell(page, 'A2')).toContainText('北京');
  await expect(cell(page, 'C1')).toContainText('Qty');
});

test('REQ-1-3-1#2: REQ-1-3-1 -the requested workflow CSV the requested workflow,the requested workflow', async ({ page }) => {
  const base = `quoted-${uid()}`;
  const csv = 'Region,Amount\n"East, North",1200\n"He said ""hi""",800\nSouth,,700\n';
  await importCsv(page, `${base}.csv`, csv);

  await expect(grid(page)).toBeVisible();
  await expect(cell(page, 'A1')).toContainText('Region');
  await expect(cell(page, 'B1')).toContainText('Amount');
  await expect(cell(page, 'A2')).toContainText('East, North');
  await expect(cell(page, 'B2')).toContainText('1200');
  await expect(cell(page, 'A3')).toContainText('He said "hi"');
  await expect(cell(page, 'B3')).toContainText('800');
  await expect(cell(page, 'A4')).toContainText('South');
  await expect(cell(page, 'C4')).toContainText('700');
  await cell(page, 'B4').click();
  await expect(formulaBar(page)).toHaveValue('');

  await page.reload();
  await expect(cell(page, 'A2')).toContainText('East, North');
  await expect(cell(page, 'A3')).toContainText('He said "hi"');
  await expect(cell(page, 'C4')).toContainText('700');
});

test('REQ-1-3-1#3: REQ-1-3-1 -the requested workflow CSV,the requested workflow', async ({ page }) => {
  const base = `invalid-${uid()}`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Import CSV', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import CSV', exact: true });
  await dialog.getByLabel('CSV file', { exact: true }).setInputFiles({
    name: `${base}.csv`,
    mimeType: 'text/csv',
    buffer: Buffer.from('Region,Amount\n"East,1200\n', 'utf8'),
  });
  await dialog.getByRole('button', { name: 'Confirm import', exact: true }).click();

  await expect(page.getByText('Invalid CSV file format. Import failed.', { exact: true })).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('link', { name: base, exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Q3 Sales', exact: true })).toBeVisible();
});

test('REQ-1-3-1#4: REQ-1-3-1 -the requested workflow CSV,the requested workflow', async ({ page }) => {
  const base = `empty-${uid()}`;
  const csv = 'Region,Jan,Feb\nEast,,100\nNorth,200,\n';
  await importCsv(page, `${base}.csv`, csv);

  await expect(grid(page)).toBeVisible();
  await expect(cell(page, 'A1')).toContainText('Region');
  await expect(cell(page, 'B1')).toContainText('Jan');
  await expect(cell(page, 'C1')).toContainText('Feb');
  await expect(cell(page, 'A2')).toContainText('East');
  await expect(cell(page, 'C2')).toContainText('100');
  await expect(cell(page, 'A3')).toContainText('North');
  await expect(cell(page, 'B3')).toContainText('200');

  await cell(page, 'B2').click();
  await expect(formulaBar(page)).toHaveValue('');
  await cell(page, 'C3').click();
  await expect(formulaBar(page)).toHaveValue('');

  await page.reload();
  await expect(cell(page, 'A2')).toContainText('East');
  await expect(cell(page, 'B3')).toContainText('200');
  await cell(page, 'B2').click();
  await expect(formulaBar(page)).toHaveValue('');
  await cell(page, 'C3').click();
  await expect(formulaBar(page)).toHaveValue('');
});

test('REQ-1-3-2: REQ-1-3-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCellViaFormulaBar(page, 'A1', 'Item');
  await setCellViaFormulaBar(page, 'B1', 'Qty');
  await setCellViaFormulaBar(page, 'C1', 'Note');
  await setCellViaFormulaBar(page, 'A2', 'Pen');
  await setCellViaFormulaBar(page, 'C2', '4');
  await setCellViaFormulaBar(page, 'A3', 'Book');
  await setCellViaFormulaBar(page, 'B3', '3');
  await setCellViaFormulaBar(page, 'C3', '5');

  await cell(page, 'A1').click();
  await expect(formulaBar(page)).toHaveValue('Item');

  const { name, text } = await exportCsv(page);
  expect(name.endsWith('.csv')).toBe(true);
  expect(normalizeCsv(text)).toBe('Item,Qty,Note\nPen,,4\nBook,3,5');

  await expect(formulaBar(page)).toHaveValue('Item');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');

  await page.reload();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A2')).toContainText('Pen');
  await expect(cell(page, 'B3')).toContainText('3');
  await cell(page, 'A1').click();
  await expect(formulaBar(page)).toHaveValue('Item');
});

test('REQ-1-3-2#2: REQ-1-3-2 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCellViaInlineEditor(page, 'A1', 'East, North');
  await setCellViaInlineEditor(page, 'B1', 'He said "hi"');
  await setCellViaInlineEditor(page, 'A2', 'plain');
  await setCellViaInlineEditor(page, 'B2', '1200');

  const { name, text } = await exportCsv(page);
  expect(name.endsWith('.csv')).toBe(true);
  expect(normalizeCsv(text)).toBe('"East, North","He said ""hi"""\nplain,1200');

  await expect(cell(page, 'A1')).toContainText('East, North');
  await expect(cell(page, 'B1')).toContainText('He said "hi"');
  await cell(page, 'A1').click();
  await expect(formulaBar(page)).toHaveValue('East, North');

  await page.reload();
  await expect(cell(page, 'A1')).toContainText('East, North');
});

test('REQ-1-3-2#3: REQ-1-3-2 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCellViaFormulaBar(page, 'A1', '2');
  await setCellViaFormulaBar(page, 'B1', '3');
  await setCellViaFormulaBar(page, 'C1', '=A1+B1');
  await expect(cell(page, 'C1')).toContainText('5');
  await cell(page, 'C1').click();
  await expect(formulaBar(page)).toHaveValue('=A1+B1');

  const { name, text } = await exportCsv(page);
  expect(name.endsWith('.csv')).toBe(true);
  expect(normalizeCsv(text)).toBe('2,3,5');

  await expect(cell(page, 'C1')).toContainText('5');
  await expect(formulaBar(page)).toHaveValue('=A1+B1');

  await page.reload();
  await expect(cell(page, 'C1')).toContainText('5');
  await cell(page, 'C1').click();
  await expect(formulaBar(page)).toHaveValue('=A1+B1');
});

test('REQ-1-3-2#4: REQ-1-3-2 -the requested workflow Sheet1 the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCellViaFormulaBar(page, 'A1', 'One');

  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
  await expect(tab(page, 'Sheet2')).toHaveAttribute('aria-selected', 'true');
  await setCellViaFormulaBar(page, 'A1', 'Two');
  await expect(cell(page, 'A1')).toContainText('Two');

  const { name, text } = await exportCsv(page);
  expect(name.endsWith('.csv')).toBe(true);
  expect(normalizeCsv(text)).toBe('Two');

  await expect(tab(page, 'Sheet2')).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'false');
  await expect(cell(page, 'A1')).toContainText('Two');
  await cell(page, 'A1').click();
  await expect(formulaBar(page)).toHaveValue('Two');

  await page.reload();
  await expect(tab(page, 'Sheet2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toContainText('Two');
  await expect(tab(page, 'Sheet1')).toBeVisible();
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

