const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const grid = (page) => page.getByRole('grid', { name: 'Worksheet grid', exact: true });
const cell = (page, coord) =>
  grid(page).getByRole('gridcell', { name: coord, exact: true });
const rowHeader = (page, n) =>
  grid(page).getByRole('rowheader', { name: String(n), exact: true });
const columnHeader = (page, letter) =>
  grid(page).getByRole('columnheader', { name: letter, exact: true });
const tab = (page, name) => page.getByRole('tab', { name, exact: true });
const formulaBar = (page) => page.getByLabel('Formula bar', { exact: true });

async function expectEmptyCell(page, coord) {
  await expect(cell(page, coord)).toHaveText(/^\s*$/);
}

// Create a blank workbook through the documented home-page creation flow.
// (REQ-1-2-1: "New blank workbook" button -> "Create" button.)
async function newWorkbook(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(tab(page, 'Sheet1')).toBeVisible();
}

// REQ-2-1-1: the "Add worksheet" button in the tab bar.
async function addWorksheet(page) {
  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
}

// REQ-3-1-1: double-click a grid cell to get the inline "Edit <cell coordinate>" text box.
async function setCell(page, coord, value) {
  const c = cell(page, coord);
  await expect(c).toBeVisible();
  await c.dblclick();
  const editor = page.getByRole('textbox', { name: `Edit ${coord}`, exact: true });
  await expect(editor).toBeVisible();
  await editor.fill(value);
  await editor.press('Enter');
}

// REQ-3-1-1: the other documented entry point, the "Formula bar" text box.
async function setCellFromFormulaBar(page, coord, value) {
  await cell(page, coord).click();
  await formulaBar(page).fill(value);
  await formulaBar(page).press('Enter');
}

// REQ-2-1: "Worksheet options for <worksheet name>" button.
async function openSheetMenu(page, name) {
  await page
    .getByRole('button', { name: `Worksheet options for ${name}`, exact: true })
    .click();
}

// REQ-2-2: right-click a row number / column header.
async function openRowMenu(page, n) {
  await rowHeader(page, n).click({ button: 'right' });
}
async function openColumnMenu(page, letter) {
  await columnHeader(page, letter).click({ button: 'right' });
}

async function clickMenuItem(page, name) {
  await page.getByRole('menuitem', { name, exact: true }).click();
}

// REQ-3-1-3: drag from one corner of a rectangle to the diagonally opposite cell.
async function dragSelect(page, from, to) {
  const a = cell(page, from);
  const b = cell(page, to);
  await expect(a).toBeVisible();
  await expect(b).toBeVisible();
  const ab = await a.boundingBox();
  const bb = await b.boundingBox();
  await page.mouse.move(ab.x + ab.width / 2, ab.y + ab.height / 2);
  await page.mouse.down();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 8 });
  await page.mouse.up();
}

async function seedRowData(page) {
  await setCell(page, 'A1', 'Region');
  await setCell(page, 'B1', 'Sales');
  await setCell(page, 'A2', 'East');
  await setCell(page, 'B2', '1200');
  await setCell(page, 'A3', 'North');
  await setCell(page, 'B3', '800');
}

// ---------------------------------------------------------------------------
// REQ-2-1-1 : Add a Worksheet
// ---------------------------------------------------------------------------

test('REQ-2-1-1: REQ-2-1-1 -the requested workflow Sheet2,the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await setCell(page, 'A1', 'Item');
  await expect(cell(page, 'A1')).toHaveText('Item');

  await addWorksheet(page);

  // The new tab uses the first unused SheetN name, becomes active and is blank.
  await expect(tab(page, 'Sheet2')).toBeVisible();
  await expect(tab(page, 'Sheet2')).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'false');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expectEmptyCell(page, 'A1');

  // Existing worksheet and its data remain unchanged.
  await tab(page, 'Sheet1').click();
  await expect(cell(page, 'A1')).toHaveText('Item');

  // The new tab still exists after refresh.
  await page.reload();
  await expect(tab(page, 'Sheet2')).toBeVisible();
  await tab(page, 'Sheet2').click();
  await expectEmptyCell(page, 'A1');
});

test('REQ-2-1-1#2: REQ-2-1-1 -the requested workflow SheetN the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await setCell(page, 'A1', 'Item');

  await addWorksheet(page);
  await expect(tab(page, 'Sheet2')).toBeVisible();
  await expect(tab(page, 'Sheet2')).toHaveAttribute('aria-selected', 'true');

  await addWorksheet(page);
  await expect(tab(page, 'Sheet3')).toBeVisible();
  await expect(tab(page, 'Sheet3')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expectEmptyCell(page, 'A1');

  await page.reload();
  await expect(tab(page, 'Sheet1')).toBeVisible();
  await expect(tab(page, 'Sheet2')).toBeVisible();
  await expect(tab(page, 'Sheet3')).toBeVisible();
  await expect(tab(page, 'Sheet3')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
});

// ---------------------------------------------------------------------------
// REQ-2-1-2 : Switch Worksheets
// ---------------------------------------------------------------------------

test('REQ-2-1-2: REQ-2-1-2 -the requested workflow, the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await setCell(page, 'A1', 'Alpha');

  await addWorksheet(page);
  // A worksheet opened for the first time with no selection history selects A1.
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expectEmptyCell(page, 'A1');
  await setCell(page, 'A1', 'Beta');

  // Switching shows the target worksheet's own grid, not another worksheet's data.
  await tab(page, 'Sheet1').click();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Alpha');

  await tab(page, 'Sheet2').click();
  await expect(tab(page, 'Sheet2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Beta');

  await page.reload();
  await expect(tab(page, 'Sheet2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Beta');
});

test('REQ-2-1-2#2: REQ-2-1-2 -the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await setCellFromFormulaBar(page, 'A1', '2');
  await setCell(page, 'B1', '3');
  await setCell(page, 'C1', '=A1+B1');

  // Ordinary value / original formula of the selected cell in the formula bar.
  await cell(page, 'C1').click();
  await expect(formulaBar(page)).toHaveValue('=A1+B1');
  await expect(cell(page, 'C1')).toHaveText('5');

  await addWorksheet(page);
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(formulaBar(page)).toHaveValue('');

  await tab(page, 'Sheet1').click();
  await cell(page, 'A1').click();
  await expect(formulaBar(page)).toHaveValue('2');
  await cell(page, 'C1').click();
  await expect(formulaBar(page)).toHaveValue('=A1+B1');
  await expect(cell(page, 'C1')).toHaveText('5');
});

test('REQ-2-1-2#3: REQ-2-1-2 -the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await addWorksheet(page);
  await expect(tab(page, 'Sheet2')).toBeVisible();

  await tab(page, 'Sheet1').click();
  await cell(page, 'B2').click();
  await expect(cell(page, 'B2')).toHaveAttribute('aria-selected', 'true');

  await tab(page, 'Sheet2').click();
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');

  // Switching back restores the last confirmed selected cell of the source sheet.
  await tab(page, 'Sheet1').click();
  await expect(cell(page, 'B2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'false');

  await page.reload();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'B2')).toHaveAttribute('aria-selected', 'true');
});

test('REQ-2-1-2#4: REQ-2-1-2 -the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await setCell(page, 'A1', 'East');
  await setCell(page, 'B1', '1200');

  await addWorksheet(page);
  await setCell(page, 'A1', 'Other');

  // Switching must not modify the source worksheet.
  await tab(page, 'Sheet1').click();
  await expect(cell(page, 'A1')).toHaveText('East');
  await expect(cell(page, 'B1')).toHaveText('1200');

  await tab(page, 'Sheet2').click();
  await expect(cell(page, 'A1')).toHaveText('Other');
  await expectEmptyCell(page, 'B1');

  // Returning to it restores its most recent successful state.
  await tab(page, 'Sheet1').click();
  await expect(cell(page, 'A1')).toHaveText('East');
  await expect(cell(page, 'B1')).toHaveText('1200');
});

test('REQ-2-1-2#5: REQ-2-1-2 -the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await setCell(page, 'A1', 'First');
  await addWorksheet(page);
  await setCell(page, 'A1', 'Second');

  // Reopening the workbook directly displays the last active tab and its content.
  await page.reload();
  await expect(tab(page, 'Sheet2')).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'false');
  await expect(cell(page, 'A1')).toHaveText('Second');

  await tab(page, 'Sheet1').click();
  await expect(cell(page, 'A1')).toHaveText('First');
});

// ---------------------------------------------------------------------------
// REQ-2-1-3 : Rename a Worksheet
// ---------------------------------------------------------------------------

test('REQ-2-1-3: REQ-2-1-3 -the requested workflow,the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  const newName = 'Data' + u();

  await openSheetMenu(page, 'Sheet1');
  await clickMenuItem(page, 'Rename');

  const dialog = page.getByRole('dialog', { name: 'Rename worksheet', exact: true });
  await expect(dialog).toBeVisible();
  const nameBox = dialog.getByLabel('Worksheet name', { exact: true });
  await expect(nameBox).toHaveValue('Sheet1');
  await nameBox.fill(newName);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(tab(page, newName)).toBeVisible();
  await expect(tab(page, 'Sheet1')).toHaveCount(0);

  await page.reload();
  await expect(tab(page, newName)).toBeVisible();
  await expect(tab(page, 'Sheet1')).toHaveCount(0);
});

test('REQ-2-1-3#2: REQ-2-1-3 -the requested workflow,the requested workflow', async ({ page }) => {
  await newWorkbook(page);

  await openSheetMenu(page, 'Sheet1');
  await clickMenuItem(page, 'Rename');

  const dialog = page.getByRole('dialog', { name: 'Rename worksheet', exact: true });
  await expect(dialog).toBeVisible();
  const nameBox = dialog.getByLabel('Worksheet name', { exact: true });
  await nameBox.fill('   ');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(
    page.getByText('Worksheet name cannot be empty', { exact: true })
  ).toBeVisible();
  await expect(tab(page, 'Sheet1')).toBeVisible();
});

test('REQ-2-1-3#3: REQ-2-1-3 -the requested workflow,the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await addWorksheet(page);
  await expect(tab(page, 'Sheet2')).toBeVisible();

  await openSheetMenu(page, 'Sheet2');
  await clickMenuItem(page, 'Rename');

  const dialog = page.getByRole('dialog', { name: 'Rename worksheet', exact: true });
  await expect(dialog).toBeVisible();
  const nameBox = dialog.getByLabel('Worksheet name', { exact: true });
  await expect(nameBox).toHaveValue('Sheet2');
  await nameBox.fill('Sheet1');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(
    page.getByText('Worksheet name already exists', { exact: true })
  ).toBeVisible();
  await expect(tab(page, 'Sheet2')).toBeVisible();
  await expect(tab(page, 'Sheet1')).toHaveCount(1);
});

// ---------------------------------------------------------------------------
// REQ-2-1-4 : Delete a Worksheet
// ---------------------------------------------------------------------------

test('REQ-2-1-4: REQ-2-1-4 -the requested workflow,the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await addWorksheet(page);
  await expect(tab(page, 'Sheet2')).toBeVisible();

  await openSheetMenu(page, 'Sheet2');
  await clickMenuItem(page, 'Delete');

  const dialog = page.getByRole('dialog', { name: 'Delete worksheet', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Sheet2');
  await dialog.getByRole('button', { name: 'Delete worksheet', exact: true }).click();

  await expect(tab(page, 'Sheet2')).toHaveCount(0);
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
});

test('REQ-2-1-4#2: REQ-2-1-4 -the requested workflow,the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await setCell(page, 'A1', 'Keep');
  await addWorksheet(page);
  await setCell(page, 'A1', 'GoneData');
  await expect(cell(page, 'A1')).toHaveText('GoneData');

  await openSheetMenu(page, 'Sheet2');
  await clickMenuItem(page, 'Delete');
  const dialog = page.getByRole('dialog', { name: 'Delete worksheet', exact: true });
  await expect(dialog).toContainText('Sheet2');
  await dialog.getByRole('button', { name: 'Delete worksheet', exact: true }).click();

  // The target tab and its data no longer appear.
  await page.reload();
  await expect(tab(page, 'Sheet2')).toHaveCount(0);
  await expect(page.getByText('GoneData', { exact: true })).toHaveCount(0);
  await expect(cell(page, 'A1')).toHaveText('Keep');
});

test('REQ-2-1-4#3: REQ-2-1-4 -the requested workflow,the requested workflow', async ({ page }) => {
  await newWorkbook(page);

  await openSheetMenu(page, 'Sheet1');
  await clickMenuItem(page, 'Delete');

  await expect(
    page.getByText('A workbook must contain at least one worksheet', { exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('dialog', { name: 'Delete worksheet', exact: true })
  ).toHaveCount(0);
  await expect(tab(page, 'Sheet1')).toBeVisible();
  await expect(cell(page, 'A1')).toBeVisible();
});

test('REQ-2-1-4#4: REQ-2-1-4 -the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await setCell(page, 'A1', 'Region');
  await setCell(page, 'B1', 'Sales');
  await setCell(page, 'A2', 'East');
  await setCell(page, 'B2', '1200');

  // Build a pivot table whose source worksheet is Sheet1.
  await dragSelect(page, 'A1', 'B2');
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await clickMenuItem(page, 'Create pivot table');
  const create = page.getByRole('dialog', { name: 'Create pivot table', exact: true });
  await expect(create).toContainText('Source range: A1:B2');
  await create.getByRole('radio', { name: 'New worksheet', exact: true }).check();
  await create.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(tab(page, 'Pivot1')).toBeVisible();

  // Sheet1 is still a pivot table source worksheet: deletion must be rejected.
  await tab(page, 'Sheet1').click();
  await openSheetMenu(page, 'Sheet1');
  await clickMenuItem(page, 'Delete');
  const del = page.getByRole('dialog', { name: 'Delete worksheet', exact: true });
  await expect(del).toBeVisible();
  await del.getByRole('button', { name: 'Delete worksheet', exact: true }).click();

  await expect(
    page.getByText('Please delete or rebuild dependent pivot tables first', {
      exact: true,
    })
  ).toBeVisible();
  await expect(del).toHaveCount(0);
  await expect(tab(page, 'Sheet1')).toBeVisible();
  await expect(tab(page, 'Pivot1')).toBeVisible();
  await expect(cell(page, 'A2')).toHaveText('East');
});

// ---------------------------------------------------------------------------
// REQ-2-2-1 : Insert and Delete Rows
// ---------------------------------------------------------------------------

test('REQ-2-2-1: REQ-2-2-1 -the requested workflow 3 the requested workflow,the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await seedRowData(page);

  await openRowMenu(page, 3);
  await clickMenuItem(page, 'Insert 1 row above');

  await expectEmptyCell(page, 'A3');
  await expectEmptyCell(page, 'B3');
  await expect(cell(page, 'A4')).toHaveText('North');
  await expect(cell(page, 'B4')).toHaveText('800');
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1200');

  await page.reload();
  await expect(cell(page, 'A4')).toHaveText('North');
  await expect(cell(page, 'B4')).toHaveText('800');
  await expectEmptyCell(page, 'A3');
  await expect(cell(page, 'A2')).toHaveText('East');
});

test('REQ-2-2-1#2: REQ-2-2-1 -the requested workflow 3 the requested workflow,the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await seedRowData(page);

  await openRowMenu(page, 1);
  await clickMenuItem(page, 'Insert 1 row below');

  await expect(cell(page, 'A1')).toHaveText('Region');
  await expectEmptyCell(page, 'A2');
  await expectEmptyCell(page, 'B2');
  await expect(cell(page, 'A3')).toHaveText('East');
  await expect(cell(page, 'B3')).toHaveText('1200');
  await expect(cell(page, 'A4')).toHaveText('North');
  await expect(cell(page, 'B4')).toHaveText('800');

  await page.reload();
  await expectEmptyCell(page, 'A2');
  await expect(cell(page, 'A3')).toHaveText('East');
  await expect(cell(page, 'A4')).toHaveText('North');
  await expect(cell(page, 'B4')).toHaveText('800');
});

test('REQ-2-2-1#3: REQ-2-2-1 -the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await seedRowData(page);

  await openRowMenu(page, 2);
  await clickMenuItem(page, 'Delete row');

  await expect(cell(page, 'A2')).toHaveText('North');
  await expect(cell(page, 'B2')).toHaveText('800');
  await expectEmptyCell(page, 'A3');
  await expect(cell(page, 'A1')).toHaveText('Region');

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('North');
  await expect(cell(page, 'B2')).toHaveText('800');
  await expectEmptyCell(page, 'A3');
});

test('REQ-2-2-1#4: REQ-2-2-1 -the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await setCell(page, 'A1', '2');
  await setCell(page, 'A2', '3');
  await setCell(page, 'B1', '=A2');

  await cell(page, 'B1').click();
  await expect(formulaBar(page)).toHaveValue('=A2');
  await expect(cell(page, 'B1')).toHaveText('3');

  await openRowMenu(page, 2);
  await clickMenuItem(page, 'Insert 1 row above');

  // The formula reference shifted downwards together with the record.
  await expectEmptyCell(page, 'A2');
  await expect(cell(page, 'A3')).toHaveText('3');
  await cell(page, 'B1').click();
  await expect(formulaBar(page)).toHaveValue('=A3');
  await expect(cell(page, 'B1')).toHaveText('3');

  await page.reload();
  await cell(page, 'B1').click();
  await expect(formulaBar(page)).toHaveValue('=A3');
  await expect(cell(page, 'B1')).toHaveText('3');
});

test('REQ-2-2-1#5: REQ-2-2-1 -the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await setCell(page, 'A1', '10');
  await setCell(page, 'A2', '50');

  // A 0-to-100 numeric validation rule on A2 (REQ-5-2-1 flow).
  await cell(page, 'A2').click();
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await clickMenuItem(page, 'Data validation');
  const rule = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await expect(rule).toBeVisible();
  await rule.getByLabel('Rule type', { exact: true }).click();
  await page.getByRole('option', { name: 'Number range', exact: true }).click();
  await rule.getByLabel('Minimum', { exact: true }).fill('0');
  await rule.getByLabel('Maximum', { exact: true }).fill('100');
  await rule.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(rule).toHaveCount(0);

  // The rule and the record shift downwards together.
  await openRowMenu(page, 2);
  await clickMenuItem(page, 'Insert 1 row above');
  await expect(cell(page, 'A3')).toHaveText('50');

  // 101 is out of range for the moved 0-to-100 rule.
  const c = cell(page, 'A3');
  await c.dblclick();
  const editor = page.getByRole('textbox', { name: 'Edit A3', exact: true });
  await expect(editor).toBeVisible();
  await editor.fill('101');
  await editor.press('Enter');

  await expect(
    page.getByText('Please enter a number from 0 to 100', { exact: true })
  ).toBeVisible();
  await expect(cell(page, 'A3')).toHaveText('50');
});

// ---------------------------------------------------------------------------
// REQ-2-2-2 : Insert and Delete Columns
// ---------------------------------------------------------------------------

test('REQ-2-2-2: REQ-2-2-2 -the requested workflow B the requested workflow,the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await setCell(page, 'A1', 'Region');
  await setCell(page, 'B1', 'Sales');

  await openColumnMenu(page, 'B');
  await clickMenuItem(page, 'Insert 1 column left');

  await expectEmptyCell(page, 'B1');
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'C1')).toHaveText('Sales');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expectEmptyCell(page, 'B1');
  await expect(cell(page, 'C1')).toHaveText('Sales');
});

test('REQ-2-2-2#2: REQ-2-2-2 -the requested workflow B the requested workflow,the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await setCell(page, 'A1', 'Region');
  await setCell(page, 'B1', 'Sales');
  await setCell(page, 'C1', 'Status');

  await openColumnMenu(page, 'A');
  await clickMenuItem(page, 'Insert 1 column right');

  await expect(cell(page, 'A1')).toHaveText('Region');
  await expectEmptyCell(page, 'B1');
  await expect(cell(page, 'C1')).toHaveText('Sales');
  await expect(cell(page, 'D1')).toHaveText('Status');

  await page.reload();
  await expectEmptyCell(page, 'B1');
  await expect(cell(page, 'C1')).toHaveText('Sales');
  await expect(cell(page, 'D1')).toHaveText('Status');
});

test('REQ-2-2-2#3: REQ-2-2-2 -the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await setCell(page, 'A1', 'Region');
  await setCell(page, 'B1', 'Sales');
  await setCell(page, 'C1', 'Status');

  await openColumnMenu(page, 'B');
  await clickMenuItem(page, 'Delete column');

  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('Status');
  await expectEmptyCell(page, 'C1');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('Status');
  await expectEmptyCell(page, 'C1');
});

test('REQ-2-2-2#4: REQ-2-2-2 -the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await setCell(page, 'A1', '2');
  await setCell(page, 'B1', '3');
  await setCell(page, 'C1', '=A1+B1');

  await cell(page, 'C1').click();
  await expect(formulaBar(page)).toHaveValue('=A1+B1');
  await expect(cell(page, 'C1')).toHaveText('5');

  await openColumnMenu(page, 'A');
  await clickMenuItem(page, 'Insert 1 column left');

  await expectEmptyCell(page, 'A1');
  await expect(cell(page, 'B1')).toHaveText('2');
  await expect(cell(page, 'C1')).toHaveText('3');
  await cell(page, 'D1').click();
  await expect(formulaBar(page)).toHaveValue('=B1+C1');
  await expect(cell(page, 'D1')).toHaveText('5');

  await page.reload();
  await cell(page, 'D1').click();
  await expect(formulaBar(page)).toHaveValue('=B1+C1');
  await expect(cell(page, 'D1')).toHaveText('5');
});

test('REQ-2-2-2#5: REQ-2-2-2 -the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await setCell(page, 'A1', '2');
  await setCell(page, 'C1', '=A1');

  await cell(page, 'C1').click();
  await expect(cell(page, 'C1')).toHaveText('2');

  await openColumnMenu(page, 'A');
  await clickMenuItem(page, 'Delete column');

  // The direct reference to the deleted column can no longer be preserved.
  await expect(cell(page, 'B1')).toHaveText('#REF!');
  await cell(page, 'B1').click();
  await expect(formulaBar(page)).toHaveValue(/#REF!/);

  await page.reload();
  await expect(cell(page, 'B1')).toHaveText('#REF!');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

