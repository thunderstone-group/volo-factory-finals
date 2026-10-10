const { test, expect } = require('@playwright/test');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Helpers (all locators come from the requirement text only)
// ---------------------------------------------------------------------------

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const workbookLink = (page, name) => page.getByRole('link', { name, exact: true });
const worksheetTab = (page, name) => page.getByRole('tab', { name, exact: true });
const grid = (page) => page.getByRole('grid', { name: 'Worksheet grid', exact: true });
const cell = (page, ref) => page.getByRole('gridcell', { name: ref, exact: true });
const formulaBar = (page) => page.getByLabel('Formula bar', { exact: true });
const lastUpdatedText = (page) => page.getByText(/Last updated:/).first();

async function openWorkbook(page, name) {
  await page.goto('/');
  await expect(workbookLink(page, name)).toBeVisible();
  await workbookLink(page, name).click();
  await expect(grid(page)).toBeVisible();
}

// Create a workbook through the documented "Import CSV" flow; the workbook name
// is the file name with the final .csv extension removed.
async function importCsv(page, fileName, csvText) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Import CSV', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import CSV', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('CSV file', { exact: true }).setInputFiles({
    name: fileName,
    mimeType: 'text/csv',
    buffer: Buffer.from(csvText, 'utf8'),
  });
  await dialog.getByRole('button', { name: 'Confirm import', exact: true }).click();
  await expect(grid(page)).toBeVisible();
}

async function selectCell(page, ref) {
  const c = cell(page, ref);
  await c.click();
  await expect(c).toHaveAttribute('aria-selected', 'true');
}

// Enter a value through the visible, labelled "Formula bar" control and commit it.
async function typeViaFormulaBar(page, ref, value) {
  await selectCell(page, ref);
  await formulaBar(page).fill(value);
  await formulaBar(page).press('Enter');
}

async function exportCsv(page) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export CSV', exact: true }).click(),
  ]);
  return download;
}

async function downloadText(download) {
  const filePath = await download.path();
  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

// ---------------------------------------------------------------------------
// REQ-1-1-1: View and Open a Workbook
// ---------------------------------------------------------------------------

test('REQ-1-1-1: REQ-1-1-1 -the requested workflow,the requested workflow page entry the requested workflow', async ({ page }) => {
  await page.goto('/');

  // The home page record shows "Last updated: <value>" and a link named by the workbook.
  const homeLink = workbookLink(page, 'Q3 Sales');
  await expect(homeLink).toBeVisible();
  const homeUpdated = lastUpdatedText(page);
  await expect(homeUpdated).toBeVisible();
  const homeUpdatedValue = (await homeUpdated.textContent()).trim();

  await homeLink.click();

  // The editor displays the same workbook name and the same "Last updated" value.
  await expect(page.getByText('Q3 Sales', { exact: true })).toBeVisible();
  const editorUpdated = lastUpdatedText(page);
  await expect(editorUpdated).toBeVisible();
  expect((await editorUpdated.textContent()).trim()).toBe(homeUpdatedValue);

  // Worksheet tabs and order / active worksheet.
  await expect(worksheetTab(page, 'Sheet1')).toBeVisible();
  await expect(worksheetTab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab')).toHaveCount(1);

  // Active worksheet grid, row/column structure, grid values, formula bar content.
  const sheetGrid = grid(page);
  await expect(sheetGrid).toBeVisible();
  await expect(sheetGrid).toHaveAttribute('aria-multiselectable', 'true');
  await expect(page.getByRole('rowheader', { name: '1', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'A', exact: true })).toBeVisible();
  const a1 = cell(page, 'A1');
  await expect(a1).toHaveAttribute('aria-selected', 'true');
  await expect(a1).toHaveText('Region');
  await expect(formulaBar(page)).toHaveValue('Region');

  const editorUrl = page.url();

  // Refresh keeps the same workbook state.
  await page.reload();
  await expect(page.getByText('Q3 Sales', { exact: true })).toBeVisible();
  await expect(worksheetTab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Region');

  // The exact editor entry is directly accessible without going through the home page.
  await page.goto('/');
  await page.goto(editorUrl);
  await expect(page.getByText('Q3 Sales', { exact: true })).toBeVisible();
  await expect(worksheetTab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(formulaBar(page)).toHaveValue('Region');
});

test('REQ-1-1-1#2: REQ-1-1-1 -the requested workflow', async ({ page }) => {
  const tag = u();
  const otherName = `Other${tag}`;
  await importCsv(page, `${otherName}.csv`, 'Zebra,77\nYak,88\n');
  await expect(cell(page, 'A1')).toHaveText('Zebra');
  const otherUrl = page.url();

  // Open the seeded workbook from the home page.
  await openWorkbook(page, 'Q3 Sales');
  await expect(page.getByText('Q3 Sales', { exact: true })).toBeVisible();
  await expect(worksheetTab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(formulaBar(page)).toHaveValue('Region');
  // Data from another workbook must not appear in the current grid.
  await expect(page.getByText('Zebra', { exact: true })).toHaveCount(0);
  const editorUrl = page.url();

  await page.reload();
  await expect(page.getByText('Q3 Sales', { exact: true })).toBeVisible();
  await expect(cell(page, 'A1')).toHaveText('Region');

  // Reopen the visible destination from the application entry point.
  await page.goto('/');
  await workbookLink(page, 'Q3 Sales').click();
  await expect(page.getByText('Q3 Sales', { exact: true })).toBeVisible();
  await expect(worksheetTab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Region');

  // The exact editor entry identifies the same workbook after refresh / direct visit.
  await page.goto(editorUrl);
  await expect(page.getByText('Q3 Sales', { exact: true })).toBeVisible();
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(formulaBar(page)).toHaveValue('Region');

  // A directly visited other workbook state restores that other workbook, not Q3 Sales.
  await page.goto(otherUrl);
  await expect(cell(page, 'A1')).toHaveText('Zebra');
});

// ---------------------------------------------------------------------------
// REQ-1-2-1: Create a Blank Workbook
// ---------------------------------------------------------------------------

test('REQ-1-2-1: REQ-1-2-1 -the requested workflow,the requested workflow Sheet1 the requested workflow A1 the requested workflow', async ({ page }) => {
  const blankName = `Blank${u()}`;

  await page.goto('/');
  const newBlank = page.getByRole('button', { name: 'New blank workbook', exact: true });
  await expect(newBlank).toBeVisible();
  await newBlank.click();

  const createButton = page.getByRole('button', { name: 'Create', exact: true });
  await expect(createButton).toBeVisible();

  // The creation page may offer a workbook name field; if it does, use it so the
  // created record can be reopened from the home page by name.
  const nameBox = page.getByLabel('Workbook name', { exact: true });
  let createdName = null;
  if (await nameBox.count() > 0) {
    await nameBox.fill(blankName);
    createdName = blankName;
  }

  await createButton.click();

  // Editor opens with only a blank worksheet named Sheet1, Sheet1 active, A1 selected.
  await expect(worksheetTab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab')).toHaveCount(1);
  await expect(grid(page)).toBeVisible();
  const a1 = cell(page, 'A1');
  await expect(a1).toHaveAttribute('aria-selected', 'true');
  await expect(formulaBar(page)).toHaveValue('');
  const editorUrl = page.url();

  // Refreshing produces the same state.
  await page.reload();
  await expect(worksheetTab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab')).toHaveCount(1);
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(formulaBar(page)).toHaveValue('');

  // Returning to the home page and reopening produces the same state.
  await page.goto('/');
  if (createdName) {
    await expect(workbookLink(page, createdName)).toBeVisible();
    await workbookLink(page, createdName).click();
  } else {
    await page.goto(editorUrl);
  }
  await expect(worksheetTab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab')).toHaveCount(1);
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(formulaBar(page)).toHaveValue('');
});

// ---------------------------------------------------------------------------
// REQ-1-2-2: Rename a Workbook
// ---------------------------------------------------------------------------

test('REQ-1-2-2: REQ-1-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  const tag = u();
  const original = `Rename${tag}`;
  const renamed = `Renamed${tag}`;

  await importCsv(page, `${original}.csv`, 'Alpha,1\nBeta,2\n');
  await expect(page.getByText(original, { exact: true })).toBeVisible();

  const renameButton = page.getByRole('button', { name: 'Rename workbook', exact: true });
  await expect(renameButton).toBeVisible();
  await renameButton.click();

  const nameBox = page.getByLabel('Workbook name', { exact: true });
  await expect(nameBox).toBeVisible();
  await expect(nameBox).toHaveValue(original);

  // Leading and trailing spaces are trimmed.
  await nameBox.fill(`  ${renamed}  `);
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText(renamed, { exact: true })).toBeVisible();

  // The home-page link displays the new name.
  await page.goto('/');
  const link = workbookLink(page, renamed);
  await expect(link).toBeVisible();

  // Reopening shows the most recently saved name.
  await link.click();
  await expect(page.getByText(renamed, { exact: true })).toBeVisible();
  await expect(cell(page, 'A1')).toHaveText('Alpha');
  await page.reload();
  await expect(page.getByText(renamed, { exact: true })).toBeVisible();
  await expect(cell(page, 'A1')).toHaveText('Alpha');
});

test('REQ-1-2-2#2: REQ-1-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await openWorkbook(page, 'Q3 Sales');
  await expect(page.getByText('Q3 Sales', { exact: true })).toBeVisible();

  const renameButton = page.getByRole('button', { name: 'Rename workbook', exact: true });
  await expect(renameButton).toBeVisible();
  await renameButton.click();

  const nameBox = page.getByLabel('Workbook name', { exact: true });
  await expect(nameBox).toBeVisible();
  await expect(nameBox).toHaveValue('Q3 Sales');

  // An empty (all spaces) name is rejected; the original name remains displayed.
  await nameBox.fill('   ');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Workbook name cannot be empty', { exact: true })).toBeVisible();
  await expect(page.getByText('Q3 Sales', { exact: true })).toBeVisible();

  // The seeded workbook is unchanged after refresh / reopening.
  await page.goto('/');
  await expect(workbookLink(page, 'Q3 Sales')).toBeVisible();
  await workbookLink(page, 'Q3 Sales').click();
  await expect(worksheetTab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Region');
});

// ---------------------------------------------------------------------------
// REQ-1-3-1: Import CSV to Create a Workbook
// ---------------------------------------------------------------------------

test('REQ-1-3-1: REQ-1-3-1 -the requested workflow UTF-8 CSV,the requested workflow', async ({ page }) => {
  const tag = u();
  const workbookName = `销售${tag}`;
  const csv = '地区,数量\n东区,1200\n北区,800\n';

  await importCsv(page, `${workbookName}.csv`, csv);

  // Sheet1 opens with the complete imported rows/columns and original text.
  await expect(worksheetTab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('地区');
  await expect(cell(page, 'B1')).toHaveText('数量');
  await expect(cell(page, 'A2')).toHaveText('东区');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'A3')).toHaveText('北区');
  await expect(cell(page, 'B3')).toHaveText('800');

  // After refresh the grid content and row/column order remain unchanged.
  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('地区');
  await expect(cell(page, 'B1')).toHaveText('数量');
  await expect(cell(page, 'A2')).toHaveText('东区');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'A3')).toHaveText('北区');

  // Reopening from the home page shows the same content (name = file name without .csv).
  await page.goto('/');
  await expect(workbookLink(page, workbookName)).toBeVisible();
  await workbookLink(page, workbookName).click();
  await expect(cell(page, 'A1')).toHaveText('地区');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'B3')).toHaveText('800');
});

test('REQ-1-3-1#2: REQ-1-3-1 -the requested workflow CSV the requested workflow,the requested workflow', async ({ page }) => {
  const tag = u();
  const workbookName = `Quoted${tag}`;
  const csv = 'Name,Note\n"Smith, John","He said ""hi"""\n"Multi","line1\nline2"\n';

  await importCsv(page, `${workbookName}.csv`, csv);

  // Commas inside double quotes, escaped double quotes and line breaks inside fields.
  await expect(cell(page, 'A1')).toHaveText('Name');
  await expect(cell(page, 'A2')).toHaveText('Smith, John');
  await expect(cell(page, 'B2')).toHaveText('He said "hi"');
  const b3 = cell(page, 'B3');
  await expect(b3).toContainText('line1');
  await expect(b3).toContainText('line2');

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('Smith, John');
  await expect(cell(page, 'B2')).toHaveText('He said "hi"');
  await expect(cell(page, 'B3')).toContainText('line1');
  await expect(cell(page, 'B3')).toContainText('line2');
});

test('REQ-1-3-1#3: REQ-1-3-1 -the requested workflow CSV,the requested workflow', async ({ page }) => {
  const tag = u();
  const workbookName = `Broken${tag}`;
  // A field that begins with a double quote but has no closing double quote.
  const csv = 'Region,Sales\n"East,1200\nNorth,800\n';

  await page.goto('/');
  await page.getByRole('button', { name: 'Import CSV', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import CSV', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('CSV file', { exact: true }).setInputFiles({
    name: `${workbookName}.csv`,
    mimeType: 'text/csv',
    buffer: Buffer.from(csv, 'utf8'),
  });
  await dialog.getByRole('button', { name: 'Confirm import', exact: true }).click();

  await expect(page.getByText('Invalid CSV file format. Import failed.', { exact: true })).toBeVisible();

  // No workbook link with that name may appear on the home page; the seed stays intact.
  await page.goto('/');
  await expect(workbookLink(page, workbookName)).toHaveCount(0);
  await expect(workbookLink(page, 'Q3 Sales')).toBeVisible();
  await expect(workbookLink(page, 'Q3 Sales')).toHaveCount(1);
});

test('REQ-1-3-1#4: REQ-1-3-1 -the requested workflow CSV,the requested workflow', async ({ page }) => {
  const tag = u();
  const workbookName = `Table${tag}`;
  // Empty fields must be preserved, numeric text stays text, order stays as in the file.
  const csv = 'h1,h2,h3\nx,,z\n,2,\n';

  await importCsv(page, `${workbookName}.csv`, csv);

  // The first row remains ordinary data.
  await expect(cell(page, 'A1')).toHaveText('h1');
  await expect(cell(page, 'B1')).toHaveText('h2');
  await expect(cell(page, 'C1')).toHaveText('h3');
  await expect(cell(page, 'A2')).toHaveText('x');
  await expect(cell(page, 'B2')).toHaveText('');
  await expect(cell(page, 'C2')).toHaveText('z');
  await expect(cell(page, 'A3')).toHaveText('');
  await expect(cell(page, 'B3')).toHaveText('2');
  await expect(cell(page, 'C3')).toHaveText('');

  // After refresh grid content and row/column order remain unchanged.
  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('h1');
  await expect(cell(page, 'B2')).toHaveText('');
  await expect(cell(page, 'C2')).toHaveText('z');
  await expect(cell(page, 'B3')).toHaveText('2');
  await expect(cell(page, 'A3')).toHaveText('');

  // Reopening from the home page keeps the same content.
  await page.goto('/');
  await expect(workbookLink(page, workbookName)).toBeVisible();
  await workbookLink(page, workbookName).click();
  await expect(cell(page, 'A1')).toHaveText('h1');
  await expect(cell(page, 'C2')).toHaveText('z');
});

// ---------------------------------------------------------------------------
// REQ-1-3-2: Export the Current Worksheet as CSV
// ---------------------------------------------------------------------------

test('REQ-1-3-2: REQ-1-3-2 -the requested workflow,the requested workflow', async ({ page }) => {
  const tag = u();
  const workbookName = `Export${tag}`;
  const csv = 'Item,Qty,Note\nPen,4,"red, blue"\nPencil,2,"He said ""ok"""\nRuler,,green\n';

  await importCsv(page, `${workbookName}.csv`, csv);
  await expect(grid(page)).toBeVisible();

  const download = await exportCsv(page);
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
  const text = await downloadText(download);

  // Order, empty cells within the used range and escaping are preserved.
  expect(text).toContain('Item,Qty,Note');
  expect(text).toContain('Pen,4,"red, blue"');
  expect(text).toContain('"He said ""ok"""');
  expect(text).toContain('Ruler,,green');
});

test('REQ-1-3-2#2: REQ-1-3-2 -the requested workflow', async ({ page }) => {
  const tag = u();
  const workbookName = `Formula${tag}`;

  await importCsv(page, `${workbookName}.csv`, 'a,b\n1,2\n');

  await typeViaFormulaBar(page, 'C1', '=A2+B2');
  await selectCell(page, 'C1');
  await expect(cell(page, 'C1')).toHaveText('3');
  await expect(formulaBar(page)).toHaveValue('=A2+B2');

  const download = await exportCsv(page);
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
  const text = await downloadText(download);

  // Formula cells export the calculated result, not the formula expression.
  expect(text).not.toContain('=A2+B2');
  expect(text).toContain('3');

  // Before and after export the grid values and formula bar content remain unchanged.
  await expect(worksheetTab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'C1')).toHaveText('3');
  await selectCell(page, 'C1');
  await expect(formulaBar(page)).toHaveValue('=A2+B2');

  await page.reload();
  await selectCell(page, 'C1');
  await expect(cell(page, 'C1')).toHaveText('3');
  await expect(formulaBar(page)).toHaveValue('=A2+B2');
});

test('REQ-1-3-2#3: REQ-1-3-2 -the requested workflow', async ({ page }) => {
  const tag = u();
  const workbookName = `Multi${tag}`;

  await importCsv(page, `${workbookName}.csv`, 'OnlySheet1,1\n');
  await expect(cell(page, 'A1')).toHaveText('OnlySheet1');

  // Add a second worksheet and put data on it.
  const addWorksheet = page.getByRole('button', { name: 'Add worksheet', exact: true });
  await expect(addWorksheet).toBeVisible();
  await addWorksheet.click();
  await expect(worksheetTab(page, 'Sheet2')).toHaveAttribute('aria-selected', 'true');
  await typeViaFormulaBar(page, 'A1', 'SecondSheet');
  await selectCell(page, 'A1');
  await expect(cell(page, 'A1')).toHaveText('SecondSheet');

  const download = await exportCsv(page);
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
  const text = await downloadText(download);

  // Export reads only the current active worksheet.
  expect(text).toContain('SecondSheet');
  expect(text).not.toContain('OnlySheet1');

  // Workbook content is not changed by the export.
  await worksheetTab(page, 'Sheet1').click();
  await expect(cell(page, 'A1')).toHaveText('OnlySheet1');
  await worksheetTab(page, 'Sheet2').click();
  await expect(cell(page, 'A1')).toHaveText('SecondSheet');
});

test('REQ-1-3-2#4: REQ-1-3-2 -the requested workflow Sheet1 the requested workflow', async ({ page }) => {
  await openWorkbook(page, 'Q3 Sales');

  await expect(worksheetTab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await selectCell(page, 'A1');
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(formulaBar(page)).toHaveValue('Region');

  const download = await exportCsv(page);
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
  const text = await downloadText(download);
  expect(text).toContain('Region');

  // Active worksheet, grid values and formula bar content are unchanged by the export.
  await expect(worksheetTab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(formulaBar(page)).toHaveValue('Region');

  // The same state remains after refresh.
  await page.reload();
  await expect(worksheetTab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Region');
  await selectCell(page, 'A1');
  await expect(formulaBar(page)).toHaveValue('Region');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

