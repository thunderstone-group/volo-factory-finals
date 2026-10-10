const { test, expect } = require('@playwright/test');
const fs = require('fs');

const WORKBOOK = 'Q3 Sales';
const SHEET1 = 'Sheet1';
const GRID_NAME = 'Worksheet grid';

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function grid(page) {
  return page.getByRole('grid', { name: GRID_NAME, exact: true });
}

function cell(page, coord) {
  return grid(page).getByRole('gridcell', { name: coord, exact: true });
}

function formulaBar(page) {
  return page.getByLabel('Formula bar', { exact: true });
}

async function gotoHome(page) {
  await page.goto('/');
}

async function openWorkbook(page, name) {
  await gotoHome(page);
  const link = page.getByRole('link', { name, exact: true });
  await expect(link).toBeVisible();
  await link.click();
}

async function openSeedWorkbook(page) {
  await openWorkbook(page, WORKBOOK);
  await expect(grid(page)).toBeVisible();
}

// Enters a value the way REQ-3-1-1 describes: select the cell, type in the
// "Formula bar" text box, commit with Enter.
async function setCellValue(page, coord, value) {
  await cell(page, coord).click();
  const bar = formulaBar(page);
  await bar.fill(value);
  await bar.press('Enter');
}

async function clearCell(page, coord) {
  await setCellValue(page, coord, '');
}

async function createBlankWorkbook(page) {
  await gotoHome(page);
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(grid(page)).toBeVisible();
}

async function importCsv(page, fileName, csvText) {
  await gotoHome(page);
  await page.getByRole('button', { name: 'Import CSV', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import CSV', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('CSV file', { exact: true }).setInputFiles({
    name: fileName,
    mimeType: 'text/csv',
    buffer: Buffer.from(csvText, 'utf8'),
  });
  await dialog.getByRole('button', { name: 'Confirm import', exact: true }).click();
}

async function exportCsv(page) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export CSV', exact: true }).click(),
  ]);
  const filePath = await download.path();
  return { download, text: fs.readFileSync(filePath, 'utf8') };
}

function parseCsv(input) {
  const text = input.replace(/^\ufeff/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

test('REQ-1-1-1: REQ-1-1-1 -the requested workflow,the requested workflow page entry the requested workflow', async ({ page }) => {
  await gotoHome(page);

  const link = page.getByRole('link', { name: WORKBOOK, exact: true });
  await expect(link).toBeVisible();
  await expect(page.getByText(/Last updated:/).first()).toBeVisible();

  await link.click();

  // The editor shows the same workbook: name, worksheet, structure and data.
  await expect(grid(page)).toBeVisible();
  await expect(grid(page)).toHaveAttribute('aria-multiselectable', 'true');
  await expect(page.getByText(WORKBOOK, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Last updated:/).first()).toBeVisible();

  const sheet1 = page.getByRole('tab', { name: SHEET1, exact: true });
  await expect(sheet1).toBeVisible();
  await expect(sheet1).toHaveAttribute('aria-selected', 'true');

  await expect(cell(page, 'A1')).toBeVisible();
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(formulaBar(page)).toHaveValue('Region');

  // Refreshing that exact workbook state keeps identifying the same workbook.
  await page.reload();
  await expect(page.getByText(WORKBOOK, { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('tab', { name: SHEET1, exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(formulaBar(page)).toHaveValue('Region');
});

test('REQ-1-1-1#2: REQ-1-1-1 -the requested workflow', async ({ page }) => {
  const marker = 'Other-' + u();

  // Build a second workbook with its own distinctive data.
  await createBlankWorkbook(page);
  await setCellValue(page, 'A1', marker);
  await expect(cell(page, 'A1')).toHaveText(marker);

  // Return to the home page and open the seeded workbook.
  await gotoHome(page);
  await page.getByRole('link', { name: WORKBOOK, exact: true }).click();
  await expect(grid(page)).toBeVisible();

  // Data from the other workbook must not appear in the current grid.
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(page.getByText(marker, { exact: true })).toHaveCount(0);

  // The same workbook state survives a refresh.
  await page.reload();
  await expect(page.getByText(WORKBOOK, { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('tab', { name: SHEET1, exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(page.getByText(marker, { exact: true })).toHaveCount(0);
});

test('REQ-1-2-1: REQ-1-2-1 -the requested workflow,the requested workflow Sheet1 the requested workflow A1 the requested workflow', async ({ page }) => {
  await gotoHome(page);

  const newBlank = page.getByRole('button', { name: 'New blank workbook', exact: true });
  await expect(newBlank).toBeVisible();
  await newBlank.click();

  const create = page.getByRole('button', { name: 'Create', exact: true });
  await expect(create).toBeVisible();
  await create.click();

  // Editor opens with only the blank Sheet1, active, A1 selected.
  await expect(grid(page)).toBeVisible();
  await expect(grid(page)).toHaveAttribute('aria-multiselectable', 'true');

  const sheet1 = page.getByRole('tab', { name: SHEET1, exact: true });
  await expect(sheet1).toBeVisible();
  await expect(sheet1).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveCount(0);

  await expect(cell(page, 'A1')).toBeVisible();
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('');

  // Refreshing keeps the identical blank state.
  await page.reload();
  await expect(page.getByRole('tab', { name: SHEET1, exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('');
});

test('REQ-1-2-2: REQ-1-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  const newName = 'Q3 Sales Renamed ' + u();

  await openSeedWorkbook(page);

  const rename = page.getByRole('button', { name: 'Rename workbook', exact: true });
  await expect(rename).toBeVisible();
  await rename.click();

  const nameBox = page.getByLabel('Workbook name', { exact: true });
  await expect(nameBox).toBeVisible();
  await expect(nameBox).toHaveValue(WORKBOOK);

  await nameBox.fill(newName);
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  // Editor title displays the new name.
  await expect(page.getByText(newName, { exact: true }).first()).toBeVisible();

  // Home page link displays the new name.
  await gotoHome(page);
  const renamedLink = page.getByRole('link', { name: newName, exact: true });
  await expect(renamedLink).toBeVisible();

  // Reopening shows the most recently saved name.
  await renamedLink.click();
  await expect(grid(page)).toBeVisible();
  await expect(page.getByText(newName, { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('tab', { name: SHEET1, exact: true })).toBeVisible();

  // Restore the seeded name through the documented flow for the later scenarios.
  await page.getByRole('button', { name: 'Rename workbook', exact: true }).click();
  const restoreBox = page.getByLabel('Workbook name', { exact: true });
  await expect(restoreBox).toHaveValue(newName);
  await restoreBox.fill(WORKBOOK);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(WORKBOOK, { exact: true }).first()).toBeVisible();

  await gotoHome(page);
  await expect(page.getByRole('link', { name: WORKBOOK, exact: true })).toBeVisible();
});

test('REQ-1-2-2#2: REQ-1-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await openSeedWorkbook(page);

  await page.getByRole('button', { name: 'Rename workbook', exact: true }).click();
  const nameBox = page.getByLabel('Workbook name', { exact: true });
  await expect(nameBox).toBeVisible();
  await expect(nameBox).toHaveValue(WORKBOOK);

  // Empty name after trimming is rejected with the stated message.
  await nameBox.fill('');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Workbook name cannot be empty', { exact: true })).toBeVisible();
  await expect(page.getByText(WORKBOOK, { exact: true }).first()).toBeVisible();

  // Whitespace only is also empty after trimming.
  await nameBox.fill('   ');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Workbook name cannot be empty', { exact: true })).toBeVisible();
  await expect(page.getByText(WORKBOOK, { exact: true }).first()).toBeVisible();

  // Saving the original name leaves the workbook name unchanged.
  await nameBox.fill(WORKBOOK);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(WORKBOOK, { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText(WORKBOOK, { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('tab', { name: SHEET1, exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Region');
});

test('REQ-1-3-1: REQ-1-3-1 -the requested workflow UTF-8 CSV,the requested workflow', async ({ page }) => {
  const base = 'sales_cn_' + u();
  const csv = '地区,销量,状态\n东区,1200,打开\n北区,800,关闭\n';

  await importCsv(page, base + '.csv', csv);

  // Sheet1 opens with the complete imported rows, columns and original text.
  await expect(grid(page)).toBeVisible();
  await expect(page.getByRole('tab', { name: SHEET1, exact: true })).toBeVisible();

  await expect(cell(page, 'A1')).toHaveText('地区');
  await expect(cell(page, 'B1')).toHaveText('销量');
  await expect(cell(page, 'C1')).toHaveText('状态');
  await expect(cell(page, 'A2')).toHaveText('东区');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'C2')).toHaveText('打开');
  await expect(cell(page, 'A3')).toHaveText('北区');
  await expect(cell(page, 'B3')).toHaveText('800');
  await expect(cell(page, 'C3')).toHaveText('关闭');

  // After refresh the content and row/column order remain unchanged.
  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('地区');
  await expect(cell(page, 'B1')).toHaveText('销量');
  await expect(cell(page, 'A2')).toHaveText('东区');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'A3')).toHaveText('北区');
  await expect(cell(page, 'C3')).toHaveText('关闭');

  // The workbook name is the file name without the final .csv extension.
  await gotoHome(page);
  const link = page.getByRole('link', { name: base, exact: true });
  await expect(link).toBeVisible();
  await link.click();
  await expect(grid(page)).toBeVisible();
  await expect(cell(page, 'A1')).toHaveText('地区');
});

test('REQ-1-3-1#2: REQ-1-3-1 -the requested workflow CSV the requested workflow,the requested workflow', async ({ page }) => {
  const base = 'quoted_' + u();
  const csv = 'Name,Note\n"Smith, John","He said ""hi"""\n';

  await importCsv(page, base + '.csv', csv);

  await expect(grid(page)).toBeVisible();
  await expect(cell(page, 'A1')).toHaveText('Name');
  await expect(cell(page, 'B1')).toHaveText('Note');
  await expect(cell(page, 'A2')).toHaveText('Smith, John');
  await expect(cell(page, 'B2')).toHaveText('He said "hi"');

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('Smith, John');
  await expect(cell(page, 'B2')).toHaveText('He said "hi"');

  await gotoHome(page);
  await expect(page.getByRole('link', { name: base, exact: true })).toBeVisible();
});

test('REQ-1-3-1#3: REQ-1-3-1 -the requested workflow CSV,the requested workflow', async ({ page }) => {
  const base = 'multiline_' + u();
  const csv = 'Label,Value,Extra\n"line1\nline2",7,\ndone,8,ok\n';

  await importCsv(page, base + '.csv', csv);

  await expect(grid(page)).toBeVisible();
  await expect(cell(page, 'A1')).toHaveText('Label');
  await expect(cell(page, 'B1')).toHaveText('Value');
  await expect(cell(page, 'C1')).toHaveText('Extra');
  await expect(cell(page, 'A2')).toContainText('line1');
  await expect(cell(page, 'A2')).toContainText('line2');
  await expect(cell(page, 'B2')).toHaveText('7');
  await expect(cell(page, 'C2')).toHaveText('');
  await expect(cell(page, 'A3')).toHaveText('done');
  await expect(cell(page, 'B3')).toHaveText('8');
  await expect(cell(page, 'C3')).toHaveText('ok');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('Label');
  await expect(cell(page, 'A2')).toContainText('line1');
  await expect(cell(page, 'C2')).toHaveText('');
  await expect(cell(page, 'A3')).toHaveText('done');
});

test('REQ-1-3-1#4: REQ-1-3-1 -the requested workflow CSV,the requested workflow', async ({ page }) => {
  const base = 'broken_' + u();
  const csv = 'Name,Note\nA,"unclosed\n';

  await importCsv(page, base + '.csv', csv);

  await expect(page.getByText('Invalid CSV file format. Import failed.', { exact: true })).toBeVisible();

  // No workbook with that name and no partial import result appears.
  await gotoHome(page);
  await expect(page.getByRole('link', { name: base, exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: WORKBOOK, exact: true })).toBeVisible();
  await expect(page.getByRole('grid', { name: GRID_NAME, exact: true })).toHaveCount(0);
});

test('REQ-1-3-2: REQ-1-3-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await openSeedWorkbook(page);

  await cell(page, 'A1').click();
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(formulaBar(page)).toHaveValue('Region');

  const { download, text } = await exportCsv(page);
  expect(download.suggestedFilename().endsWith('.csv')).toBe(true);
  const rows = parseCsv(text);
  expect(rows[0][0]).toBe('Region');

  // The interface state is unchanged by the export.
  await expect(page.getByRole('tab', { name: SHEET1, exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(formulaBar(page)).toHaveValue('Region');

  // The same state remains after refresh.
  await page.reload();
  await expect(page.getByRole('tab', { name: SHEET1, exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Region');
  await cell(page, 'A1').click();
  await expect(formulaBar(page)).toHaveValue('Region');
});

test('REQ-1-3-2#2: REQ-1-3-2 -the requested workflow', async ({ page }) => {
  await openSeedWorkbook(page);

  await setCellValue(page, 'C1', 'with,comma');
  await setCellValue(page, 'C2', 'say "hi"');
  await setCellValue(page, 'D2', 'plain');
  await expect(cell(page, 'C1')).toHaveText('with,comma');
  await expect(cell(page, 'C2')).toHaveText('say "hi"');

  const { download, text } = await exportCsv(page);
  expect(download.suggestedFilename().endsWith('.csv')).toBe(true);

  // Text containing commas and quotes round-trips through the exported CSV.
  const rows = parseCsv(text);
  expect(rows[0][2]).toBe('with,comma');
  expect(rows[1][2]).toBe('say "hi"');
  expect(rows[1][3]).toBe('plain');

  // Restore the seeded worksheet state.
  await clearCell(page, 'C1');
  await clearCell(page, 'C2');
  await clearCell(page, 'D2');
  await expect(cell(page, 'A1')).toHaveText('Region');
});

test('REQ-1-3-2#3: REQ-1-3-2 -the requested workflow', async ({ page }) => {
  await openSeedWorkbook(page);

  await setCellValue(page, 'C1', '5');
  await setCellValue(page, 'D1', '=C1*2');
  await cell(page, 'D1').click();
  await expect(cell(page, 'D1')).toHaveText('10');
  await expect(formulaBar(page)).toHaveValue('=C1*2');

  const { download, text } = await exportCsv(page);
  expect(download.suggestedFilename().endsWith('.csv')).toBe(true);

  // A formula cell exports its current calculated result, not the expression.
  const rows = parseCsv(text);
  expect(rows[0][2]).toBe('5');
  expect(rows[0][3]).toBe('10');
  expect(text).not.toContain('C1*2');

  // Restore the seeded worksheet state.
  await clearCell(page, 'C1');
  await clearCell(page, 'D1');
  await expect(cell(page, 'A1')).toHaveText('Region');
});

test('REQ-1-3-2#4: REQ-1-3-2 -the requested workflow Sheet1 the requested workflow', async ({ page }) => {
  await openSeedWorkbook(page);

  await setCellValue(page, 'C1', 'left');
  await setCellValue(page, 'E1', 'right');
  await expect(cell(page, 'C1')).toHaveText('left');
  await expect(cell(page, 'E1')).toHaveText('right');

  const { download, text } = await exportCsv(page);
  expect(download.suggestedFilename().endsWith('.csv')).toBe(true);

  // Empty cells inside the used range are preserved in row/column order.
  const rows = parseCsv(text);
  expect(rows[0]).toEqual(['Region', '', 'left', '', 'right']);

  // Active worksheet, grid values and formula bar content are unchanged.
  await expect(page.getByRole('tab', { name: SHEET1, exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Region');
  await cell(page, 'A1').click();
  await expect(formulaBar(page)).toHaveValue('Region');

  await page.reload();
  await expect(page.getByRole('tab', { name: SHEET1, exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'C1')).toHaveText('left');
  await expect(cell(page, 'E1')).toHaveText('right');

  // Restore the seeded worksheet state.
  await clearCell(page, 'C1');
  await clearCell(page, 'E1');
  await expect(cell(page, 'A1')).toHaveText('Region');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

