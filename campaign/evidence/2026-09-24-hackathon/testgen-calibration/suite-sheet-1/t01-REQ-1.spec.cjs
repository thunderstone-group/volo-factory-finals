const { test, expect } = require('@playwright/test');
const fs = require('fs');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function grid(page) {
  return page.getByRole('grid', { name: 'Worksheet grid', exact: true });
}

function cell(page, coord) {
  return grid(page).getByRole('gridcell', { name: coord, exact: true });
}

function formulaBar(page) {
  return page.getByLabel('Formula bar', { exact: true });
}

async function createBlankWorkbook(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(grid(page)).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
}

async function renameWorkbook(page, newName) {
  await page.getByRole('button', { name: 'Rename workbook', exact: true }).click();
  const input = page.getByLabel('Workbook name', { exact: true });
  await expect(input).toBeVisible();
  await input.fill(newName);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(newName, { exact: true }).first()).toBeVisible();
}

async function addWorksheet(page, expectedName) {
  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
  const tab = page.getByRole('tab', { name: expectedName, exact: true });
  await expect(tab).toBeVisible();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

async function setCell(page, coord, value) {
  const target = cell(page, coord);
  await target.click();
  const bar = formulaBar(page);
  await bar.click();
  await bar.fill(value);
  await bar.press('Enter');
  if (!value.startsWith('=')) {
    await expect(target).toHaveText(value);
  }
}

async function importCsv(page, baseName, csvText) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Import CSV', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import CSV', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('CSV file', { exact: true }).setInputFiles({
    name: `${baseName}.csv`,
    mimeType: 'text/csv',
    buffer: Buffer.from(csvText, 'utf8'),
  });
  await dialog.getByRole('button', { name: 'Confirm import', exact: true }).click();
  await expect(grid(page)).toBeVisible();
}

test('REQ-1-1-1: Open a workbook', async ({ page }) => {
  const workbookName = `Open ${u()}`;
  await createBlankWorkbook(page);
  await renameWorkbook(page, workbookName);
  await setCell(page, 'A1', 'Sheet1 data');
  await addWorksheet(page, 'Sheet2');
  await setCell(page, 'A1', 'Sheet2 active data');

  await page.goto('/');
  const homeLink = page.getByRole('link', { name: workbookName, exact: true });
  await expect(homeLink).toBeVisible();
  await expect(page.getByText(/Last updated:/).first()).toBeVisible();

  await homeLink.click();
  await expect(grid(page)).toBeVisible();
  await expect(page.getByText(workbookName, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Last updated:/).first()).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Sheet2 active data');

  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await expect(cell(page, 'A1')).toHaveText('Sheet1 data');

  await page.getByRole('tab', { name: 'Sheet2', exact: true }).click();
  const editorUrl = page.url();
  await page.reload();
  await expect(page).toHaveURL(editorUrl);
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Sheet2 active data');

  await page.goto(editorUrl);
  await expect(page).toHaveURL(editorUrl);
  await expect(grid(page)).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Sheet2 active data');
  await expect(page.getByText(workbookName, { exact: true }).first()).toBeVisible();
});

test('REQ-1-2-1: Create and reopen a blank workbook', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();

  await expect(grid(page)).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab')).toHaveCount(1);
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');

  const editorUrl = page.url();
  await page.reload();
  await expect(page).toHaveURL(editorUrl);
  await expect(grid(page)).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');

  await page.goto(editorUrl);
  await expect(page).toHaveURL(editorUrl);
  await expect(grid(page)).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
});

test('REQ-1-2-2: Save a valid new name', async ({ page }) => {
  const newName = `Renamed ${u()}`;
  await createBlankWorkbook(page);
  await setCell(page, 'A1', 'Existing data');
  await renameWorkbook(page, newName);

  await expect(page.getByText(newName, { exact: true }).first()).toBeVisible();

  await page.goto('/');
  const link = page.getByRole('link', { name: newName, exact: true });
  await expect(link).toBeVisible();
  await link.click();

  await expect(grid(page)).toBeVisible();
  await expect(page.getByText(newName, { exact: true }).first()).toBeVisible();
  await expect(cell(page, 'A1')).toHaveText('Existing data');
});

test('REQ-1-2-2#2: Reject an empty name', async ({ page }) => {
  const originalName = `Original ${u()}`;
  await createBlankWorkbook(page);
  await renameWorkbook(page, originalName);

  await page.getByRole('button', { name: 'Rename workbook', exact: true }).click();
  const input = page.getByLabel('Workbook name', { exact: true });
  await expect(input).toBeVisible();
  await input.fill('   ');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText('Workbook name cannot be empty', { exact: true })).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('link', { name: originalName, exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('link', { name: originalName, exact: true })).toBeVisible();
  const linkTexts = await page.getByRole('link').allTextContents();
  expect(linkTexts.every((text) => text.trim().length > 0)).toBe(true);
});

test('REQ-1-3-1: Import a valid CSV', async ({ page }) => {
  const base = `imp-${u()}`;
  const csvText = 'Name,Empty,Note,Number\nAlice,,你好,42\n"Doe, Jane","He said ""hi""","line1\nline2",7\n';
  await importCsv(page, base, csvText);

  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Name');
  await expect(cell(page, 'B1')).toHaveText('Empty');
  await expect(cell(page, 'C1')).toHaveText('Note');
  await expect(cell(page, 'D1')).toHaveText('Number');
  await expect(cell(page, 'A2')).toHaveText('Alice');
  await expect(cell(page, 'B2')).toHaveText('');
  await expect(cell(page, 'C2')).toHaveText('你好');
  await expect(cell(page, 'D2')).toHaveText('42');
  await expect(cell(page, 'A3')).toHaveText('Doe, Jane');
  await expect(cell(page, 'B3')).toHaveText('He said "hi"');
  await expect(cell(page, 'C3')).toContainText('line1');
  await expect(cell(page, 'C3')).toContainText('line2');
  await expect(cell(page, 'D3')).toHaveText('7');

  await page.goto('/');
  const link = page.getByRole('link', { name: base, exact: true });
  await expect(link).toBeVisible();
  await link.click();

  await expect(grid(page)).toBeVisible();
  await expect(cell(page, 'B2')).toHaveText('');
  await expect(cell(page, 'C2')).toHaveText('你好');
  await expect(cell(page, 'A3')).toHaveText('Doe, Jane');
  await expect(cell(page, 'C3')).toContainText('line1');
  await expect(cell(page, 'C3')).toContainText('line2');
});

test('REQ-1-3-1#2: Reject an unparseable CSV', async ({ page }) => {
  const base = `bad-${u()}`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Import CSV', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import CSV', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('CSV file', { exact: true }).setInputFiles({
    name: `${base}.csv`,
    mimeType: 'text/csv',
    buffer: Buffer.from('"unclosed,value\n', 'utf8'),
  });
  await dialog.getByRole('button', { name: 'Confirm import', exact: true }).click();

  await expect(page.getByText('Invalid CSV file format. Import failed.', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: base, exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('link', { name: base, exact: true })).toHaveCount(0);
});

test('REQ-1-3-2: Export a worksheet containing formulas', async ({ page }) => {
  const base = `exp-${u()}`;
  const csvText = 'Region,Description,Quantity,Empty column,Formula result\nEast China,"contains,comma",2,,\nNorth China,"中文""引号\n换行",3,,\n';
  await importCsv(page, base, csvText);

  await setCell(page, 'E2', '=C2*2');
  await setCell(page, 'E3', '=C3+2');
  await expect(cell(page, 'E2')).toHaveText('4');
  await expect(cell(page, 'E3')).toHaveText('5');

  await cell(page, 'E2').click();
  await expect(formulaBar(page)).toHaveValue('=C2*2');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename().endsWith('.csv')).toBe(true);

  const filePath = await download.path();
  const csvTextOut = fs.readFileSync(filePath, 'utf8');
  const expected = 'Region,Description,Quantity,Empty column,Formula result\nEast China,"contains,comma",2,,4\nNorth China,"中文""引号\n换行",3,,5\n';
  const normalized = csvTextOut.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trimEnd();
  expect(normalized).toBe(expected.trimEnd());

  await expect(formulaBar(page)).toHaveValue('=C2*2');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B2')).toHaveText('contains,comma');
  await expect(cell(page, 'C2')).toHaveText('2');
  await expect(cell(page, 'E2')).toHaveText('4');
  await expect(cell(page, 'B3')).toContainText('中文"引号');
  await expect(cell(page, 'B3')).toContainText('换行');
  await expect(cell(page, 'E3')).toHaveText('5');
});
