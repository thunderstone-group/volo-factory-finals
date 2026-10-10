const { test, expect } = require('@playwright/test');

/* ------------------------------------------------------------------ helpers */

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const cell = (page, coord) => page.getByRole('gridcell', { name: coord, exact: true });
const formulaBar = (page) => page.getByLabel('Formula bar', { exact: true });
const grid = (page) => page.getByRole('grid', { name: 'Worksheet grid', exact: true });
const sheetTab = (page, name) => page.getByRole('tab', { name });
const dlg = (page, name) => page.getByRole('dialog', { name, exact: true });

// Create a blank workbook through the home page flow (Sheet1 only, A1 selected).
async function createWorkbook(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(grid(page)).toBeVisible();
  await expect(sheetTab(page, 'Sheet1')).toBeVisible();
}

async function addWorksheet(page) {
  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
}

// Type a value (or a formula) into a cell through the labelled formula bar.
async function enterValue(page, coord, value) {
  await cell(page, coord).click();
  await formulaBar(page).click();
  await formulaBar(page).fill(value);
  await page.keyboard.press('Enter');
}

async function selectCell(page, coord) {
  await cell(page, coord).click();
}

// Select a rectangular range by dragging from one corner to the opposite one.
async function selectRange(page, from, to) {
  const start = cell(page, from);
  const end = cell(page, to);
  const a = await start.boundingBox();
  const b = await end.boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(start).toHaveAttribute('aria-selected', 'true');
  await expect(end).toHaveAttribute('aria-selected', 'true');
}

async function worksheetMenu(page, sheetName, command) {
  await page.getByRole('button', { name: `Worksheet options for ${sheetName}`, exact: true }).click();
  await page.getByRole('menuitem', { name: command, exact: true }).click();
}

async function rowMenu(page, rowNumber, command) {
  await page.getByRole('rowheader', { name: String(rowNumber), exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: command, exact: true }).click();
}

async function columnMenu(page, letter, command) {
  await page.getByRole('columnheader', { name: letter, exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: command, exact: true }).click();
}

async function dataMenu(page, command) {
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByRole('menuitem', { name: command, exact: true }).click();
}

// Pick an option in a named combo box (native select or ARIA listbox).
async function choose(page, combo, optionName) {
  try {
    await combo.selectOption({ label: optionName }, { timeout: 1000 });
    return;
  } catch (err) {
    /* combo box is not a native <select> */
  }
  await combo.click();
  await page.getByRole('option', { name: optionName, exact: true }).click();
}

// Region / Sales data on Sheet1 of a fresh workbook.
async function seedSalesRows(page) {
  await enterValue(page, 'A1', 'Region');
  await enterValue(page, 'B1', 'Sales');
  await enterValue(page, 'A2', 'East');
  await enterValue(page, 'B2', '1200');
  await enterValue(page, 'A3', 'North');
  await enterValue(page, 'B3', '800');
}

// Fresh workbook whose Sheet1 holds the sales rows, plus a pivot table over A1:B3.
async function createPivotWorkbook(page, last) {
  await createWorkbook(page);
  await seedSalesRows(page);
  await selectRange(page, 'A1', last);
  await dataMenu(page, 'Create pivot table');
  const createDialog = dlg(page, 'Create pivot table');
  await expect(createDialog).toBeVisible();
  await createDialog.getByRole('radio', { name: 'New worksheet', exact: true }).check();
  await createDialog.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(sheetTab(page, 'Pivot1')).toBeVisible();
}

/* ------------------------------------------- REQ-2-1-1: Add a worksheet */

test('REQ-2-1-1: REQ-2-1-1 -the requested workflow Sheet2,the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await expect(sheetTab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');

  await enterValue(page, 'A1', 'East');
  await enterValue(page, 'B1', '1200');
  await expect(cell(page, 'A1')).toHaveText('East');

  await addWorksheet(page);

  await expect(sheetTab(page, 'Sheet2')).toBeVisible();
  await expect(sheetTab(page, 'Sheet2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('');
  await expect(cell(page, 'B1')).toHaveText('');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');

  // existing worksheet unchanged
  await sheetTab(page, 'Sheet1').click();
  await expect(cell(page, 'A1')).toHaveText('East');
  await expect(cell(page, 'B1')).toHaveText('1200');

  // the new tab still exists after refresh
  await page.reload();
  await expect(sheetTab(page, 'Sheet2')).toBeVisible();
  await expect(cell(page, 'A1')).toHaveText('East');
});

test('REQ-2-1-1#2: REQ-2-1-1 -the requested workflow SheetN the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await addWorksheet(page);
  await expect(sheetTab(page, 'Sheet2')).toHaveAttribute('aria-selected', 'true');

  await addWorksheet(page);
  await expect(sheetTab(page, 'Sheet3')).toBeVisible();
  await expect(sheetTab(page, 'Sheet3')).toHaveAttribute('aria-selected', 'true');

  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveCount(3);
  await expect(tabs.nth(0)).toContainText('Sheet1');
  await expect(tabs.nth(1)).toContainText('Sheet2');
  await expect(tabs.nth(2)).toContainText('Sheet3');

  await page.reload();
  await expect(sheetTab(page, 'Sheet1')).toBeVisible();
  await expect(sheetTab(page, 'Sheet2')).toBeVisible();
  await expect(sheetTab(page, 'Sheet3')).toBeVisible();
});

/* ------------------------------------------- REQ-2-1-2: Switch worksheets */

test('REQ-2-1-2: REQ-2-1-2 -the requested workflow, the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterValue(page, 'A1', 'East');
  await enterValue(page, 'B1', '1200');
  await addWorksheet(page);
  await enterValue(page, 'A1', 'North');
  await enterValue(page, 'B1', '800');
  await expect(cell(page, 'A1')).toHaveText('North');
  await expect(cell(page, 'B1')).toHaveText('800');

  await sheetTab(page, 'Sheet1').click();
  await expect(cell(page, 'A1')).toHaveText('East');
  await expect(cell(page, 'B1')).toHaveText('1200');
  await selectCell(page, 'A1');
  await expect(formulaBar(page)).toHaveValue('East');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');

  await sheetTab(page, 'Sheet2').click();
  await expect(cell(page, 'A1')).toHaveText('North');
  await expect(cell(page, 'B1')).toHaveText('800');

  // switching must not modify the source worksheet
  await sheetTab(page, 'Sheet1').click();
  await expect(cell(page, 'A1')).toHaveText('East');
  await expect(cell(page, 'B1')).toHaveText('1200');
});

test('REQ-2-1-2#2: REQ-2-1-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterValue(page, 'A1', 'East');

  await addWorksheet(page);
  // a worksheet opened with no selection history selects A1
  await expect(sheetTab(page, 'Sheet2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('');
  await expect(formulaBar(page)).toHaveValue('');

  await sheetTab(page, 'Sheet1').click();
  await expect(cell(page, 'A1')).toHaveText('East');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');

  await sheetTab(page, 'Sheet2').click();
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('');
});

test('REQ-2-1-2#3: REQ-2-1-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterValue(page, 'A1', 'East');
  await addWorksheet(page);
  await enterValue(page, 'A1', 'North');

  await selectCell(page, 'B2');
  await sheetTab(page, 'Sheet1').click();
  await selectCell(page, 'B3');

  await sheetTab(page, 'Sheet2').click();
  await expect(cell(page, 'B2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'B3')).toHaveAttribute('aria-selected', 'false');
  await expect(cell(page, 'A1')).toHaveText('North');

  // returning to the source worksheet restores its most recent state
  await sheetTab(page, 'Sheet1').click();
  await expect(cell(page, 'B3')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'B2')).toHaveAttribute('aria-selected', 'false');
  await expect(cell(page, 'A1')).toHaveText('East');
});

test('REQ-2-1-2#4: REQ-2-1-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterValue(page, 'A1', 'East');
  await enterValue(page, 'B1', '1200');
  await addWorksheet(page);
  await enterValue(page, 'A1', 'North');
  await enterValue(page, 'B1', '800');

  await selectCell(page, 'A1');
  await sheetTab(page, 'Sheet1').click();
  await selectCell(page, 'B1');

  await page.reload();
  // the last active tab and its selected cell are restored
  await expect(sheetTab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'B1')).toHaveAttribute('aria-selected', 'true');
  await expect(formulaBar(page)).toHaveValue('1200');

  // the other worksheet restores its own last confirmed selected cell
  await sheetTab(page, 'Sheet2').click();
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('North');
});

test('REQ-2-1-2#5: REQ-2-1-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterValue(page, 'A1', '2');
  await enterValue(page, 'B1', '3');
  await enterValue(page, 'C1', '=A1+B1');
  await expect(cell(page, 'C1')).toHaveText('5');

  await addWorksheet(page);
  await enterValue(page, 'C1', '7');
  await expect(cell(page, 'C1')).toHaveText('7');

  // the formula bar shows the original formula of the selected cell of the target worksheet
  await sheetTab(page, 'Sheet1').click();
  await selectCell(page, 'C1');
  await expect(formulaBar(page)).toHaveValue('=A1+B1');
  await expect(cell(page, 'C1')).toHaveText('5');

  await sheetTab(page, 'Sheet2').click();
  await selectCell(page, 'C1');
  await expect(formulaBar(page)).toHaveValue('7');
  await expect(cell(page, 'C1')).toHaveText('7');
  await expect(cell(page, 'A1')).toHaveText('');
});

/* ------------------------------------------- REQ-2-1-3: Rename a worksheet */

test('REQ-2-1-3: REQ-2-1-3 -the requested workflow,the requested workflow', async ({ page }) => {
  const newName = 'Data' + u();
  await createWorkbook(page);
  await addWorksheet(page);

  await worksheetMenu(page, 'Sheet2', 'Rename');
  const renameDialog = dlg(page, 'Rename worksheet');
  await expect(renameDialog).toBeVisible();
  await expect(renameDialog.getByLabel('Worksheet name', { exact: true })).toHaveValue('Sheet2');
  await renameDialog.getByLabel('Worksheet name', { exact: true }).fill(newName);
  await renameDialog.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(sheetTab(page, newName)).toBeVisible();
  await expect(sheetTab(page, 'Sheet2')).toHaveCount(0);

  await page.reload();
  await expect(sheetTab(page, newName)).toBeVisible();
  await expect(sheetTab(page, 'Sheet1')).toBeVisible();
});

test('REQ-2-1-3#2: REQ-2-1-3 -the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await addWorksheet(page);

  await worksheetMenu(page, 'Sheet2', 'Rename');
  const renameDialog = dlg(page, 'Rename worksheet');
  await expect(renameDialog).toBeVisible();
  await renameDialog.getByLabel('Worksheet name', { exact: true }).fill('   ');
  await renameDialog.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText('Worksheet name cannot be empty', { exact: true })).toBeVisible();
  await expect(sheetTab(page, 'Sheet2')).toBeVisible();
  await expect(sheetTab(page, 'Sheet1')).toBeVisible();
});

test('REQ-2-1-3#3: REQ-2-1-3 -the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await addWorksheet(page);

  await worksheetMenu(page, 'Sheet2', 'Rename');
  const renameDialog = dlg(page, 'Rename worksheet');
  await expect(renameDialog).toBeVisible();
  await renameDialog.getByLabel('Worksheet name', { exact: true }).fill('Sheet1');
  await renameDialog.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText('Worksheet name already exists', { exact: true })).toBeVisible();
  await expect(sheetTab(page, 'Sheet2')).toBeVisible();
  await expect(sheetTab(page, 'Sheet1')).toHaveCount(1);
  await expect(page.getByRole('tab')).toHaveCount(2);
});

/* ------------------------------------------- REQ-2-1-4: Delete a worksheet */

test('REQ-2-1-4: REQ-2-1-4 -the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterValue(page, 'A1', 'East');
  await addWorksheet(page);
  await enterValue(page, 'A1', 'North');
  await expect(cell(page, 'A1')).toHaveText('North');

  await worksheetMenu(page, 'Sheet2', 'Delete');
  const deleteDialog = dlg(page, 'Delete worksheet');
  await expect(deleteDialog).toBeVisible();
  await expect(deleteDialog).toContainText('Sheet2');
  await deleteDialog.getByRole('button', { name: 'Delete worksheet', exact: true }).click();

  await expect(sheetTab(page, 'Sheet2')).toHaveCount(0);
  await expect(sheetTab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('East');

  await page.reload();
  await expect(sheetTab(page, 'Sheet2')).toHaveCount(0);
  await expect(sheetTab(page, 'Sheet1')).toBeVisible();
});

test('REQ-2-1-4#2: REQ-2-1-4 -the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbook(page);

  await worksheetMenu(page, 'Sheet1', 'Delete');
  await expect(page.getByText('A workbook must contain at least one worksheet', { exact: true })).toBeVisible();
  await expect(dlg(page, 'Delete worksheet')).toHaveCount(0);
  await expect(sheetTab(page, 'Sheet1')).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(1);
});

test('REQ-2-1-4#3: REQ-2-1-4 -the requested workflow,the requested workflow', async ({ page }) => {
  await createPivotWorkbook(page, 'B3');

  // Sheet1 is still a pivot table source worksheet
  await sheetTab(page, 'Sheet1').click();
  await worksheetMenu(page, 'Sheet1', 'Delete');
  const deleteDialog = dlg(page, 'Delete worksheet');
  await deleteDialog.getByRole('button', { name: 'Delete worksheet', exact: true }).click();

  await expect(page.getByText('Please delete or rebuild dependent pivot tables first', { exact: true })).toBeVisible();
  await expect(deleteDialog).toHaveCount(0);
  await expect(sheetTab(page, 'Sheet1')).toBeVisible();
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1200');
});

test('REQ-2-1-4#4: REQ-2-1-4 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterValue(page, 'A1', 'Region');
  await enterValue(page, 'B1', 'Sales');
  await enterValue(page, 'A2', 'East');
  await enterValue(page, 'B2', '1200');
  await addWorksheet(page);
  await sheetTab(page, 'Sheet1').click();

  await selectRange(page, 'A1', 'B2');
  await dataMenu(page, 'Create pivot table');
  const createDialog = dlg(page, 'Create pivot table');
  await createDialog.getByRole('radio', { name: 'New worksheet', exact: true }).check();
  await createDialog.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(sheetTab(page, 'Pivot1')).toBeVisible();

  // delete the pivot-result worksheet
  await worksheetMenu(page, 'Pivot1', 'Delete');
  const pivotDialog = dlg(page, 'Delete worksheet');
  await expect(pivotDialog).toContainText('Pivot1');
  await pivotDialog.getByRole('button', { name: 'Delete worksheet', exact: true }).click();
  await expect(sheetTab(page, 'Pivot1')).toHaveCount(0);

  // the source worksheet is no longer constrained by that pivot table
  await sheetTab(page, 'Sheet1').click();
  await worksheetMenu(page, 'Sheet1', 'Delete');
  const sourceDialog = dlg(page, 'Delete worksheet');
  await sourceDialog.getByRole('button', { name: 'Delete worksheet', exact: true }).click();

  await expect(sheetTab(page, 'Sheet1')).toHaveCount(0);
  await expect(sheetTab(page, 'Sheet2')).toBeVisible();
  await page.reload();
  await expect(sheetTab(page, 'Sheet1')).toHaveCount(0);
  await expect(sheetTab(page, 'Sheet2')).toBeVisible();
});

/* ------------------------------------------- REQ-2-2-1: Insert and delete rows */

test('REQ-2-2-1: REQ-2-2-1 -the requested workflow 3 the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await seedSalesRows(page);
  await enterValue(page, 'C2', '=B2*2');
  await expect(cell(page, 'C2')).toHaveText('2400');

  await rowMenu(page, 2, 'Insert 1 row above');

  await expect(cell(page, 'A2')).toHaveText('');
  await expect(cell(page, 'B2')).toHaveText('');
  await expect(cell(page, 'A3')).toHaveText('East');
  await expect(cell(page, 'B3')).toHaveText('1200');
  await expect(cell(page, 'A4')).toHaveText('North');
  await expect(cell(page, 'B4')).toHaveText('800');

  await selectCell(page, 'C3');
  await expect(formulaBar(page)).toHaveValue('=B3*2');
  await expect(cell(page, 'C3')).toHaveText('2400');

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('');
  await expect(cell(page, 'A3')).toHaveText('East');
  await expect(cell(page, 'A4')).toHaveText('North');
  await expect(cell(page, 'C3')).toHaveText('2400');
});

test('REQ-2-2-1#2: REQ-2-2-1 -the requested workflow 3 the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await seedSalesRows(page);

  await rowMenu(page, 2, 'Insert 1 row below');

  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'A3')).toHaveText('');
  await expect(cell(page, 'B3')).toHaveText('');
  await expect(cell(page, 'A4')).toHaveText('North');
  await expect(cell(page, 'B4')).toHaveText('800');

  await page.reload();
  await expect(cell(page, 'A3')).toHaveText('');
  await expect(cell(page, 'A4')).toHaveText('North');
  await expect(cell(page, 'B4')).toHaveText('800');
});

test('REQ-2-2-1#3: REQ-2-2-1 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await seedSalesRows(page);
  await enterValue(page, 'C2', '=B2*2');
  await enterValue(page, 'C3', '=B3*2');
  await expect(cell(page, 'C3')).toHaveText('1600');

  await rowMenu(page, 2, 'Delete row');

  await expect(cell(page, 'A2')).toHaveText('North');
  await expect(cell(page, 'B2')).toHaveText('800');
  await expect(cell(page, 'A3')).toHaveText('');
  await expect(cell(page, 'B3')).toHaveText('');

  await selectCell(page, 'C2');
  await expect(formulaBar(page)).toHaveValue('=B2*2');
  await expect(cell(page, 'C2')).toHaveText('1600');

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('North');
  await expect(cell(page, 'C2')).toHaveText('1600');
});

test('REQ-2-2-1#4: REQ-2-2-1 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterValue(page, 'A1', 'Item');
  await enterValue(page, 'B1', 'Score');
  await enterValue(page, 'A2', 'Pen');
  await enterValue(page, 'B2', '50');
  await enterValue(page, 'A3', 'Pencil');
  await enterValue(page, 'B3', '60');

  await selectRange(page, 'B2', 'B3');
  await dataMenu(page, 'Data validation');
  const validationDialog = dlg(page, 'Data validation');
  await choose(page, validationDialog.getByLabel('Rule type', { exact: true }), 'Number range');
  await validationDialog.getByLabel('Minimum', { exact: true }).fill('0');
  await validationDialog.getByLabel('Maximum', { exact: true }).fill('100');
  await validationDialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(validationDialog).toHaveCount(0);

  await selectCell(page, 'B2');
  await formulaBar(page).fill('101');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Please enter a number from 0 to 100', { exact: true })).toBeVisible();
  await expect(cell(page, 'B2')).toHaveText('50');

  // the validation rule moves down with the constrained cells
  await rowMenu(page, 2, 'Insert 1 row above');
  await expect(cell(page, 'B2')).toHaveText('');
  await expect(cell(page, 'B3')).toHaveText('50');

  await selectCell(page, 'B3');
  await formulaBar(page).fill('101');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Please enter a number from 0 to 100', { exact: true })).toBeVisible();
  await expect(cell(page, 'B3')).toHaveText('50');

  await page.reload();
  await expect(cell(page, 'B3')).toHaveText('50');
});

test('REQ-2-2-1#5: REQ-2-2-1 -the requested workflow', async ({ page }) => {
  await createPivotWorkbook(page, 'B3');

  const editor = page.getByRole('region', { name: 'Pivot table editor', exact: true });
  await expect(editor).toBeVisible();
  await choose(page, editor.getByLabel('Rows', { exact: true }), 'Region');
  await choose(page, editor.getByLabel('Values', { exact: true }), 'Sales');
  await choose(page, editor.getByLabel('Summarize by', { exact: true }), 'SUM');
  await editor.getByRole('button', { name: 'Apply', exact: true }).click();

  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('SUM of Sales');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'B3')).toHaveText('800');
  await expect(cell(page, 'A4')).toHaveText('Grand Total');
  await expect(cell(page, 'B4')).toHaveText('2000');

  // change the source range through the row-number menu
  await sheetTab(page, 'Sheet1').click();
  await rowMenu(page, 2, 'Insert 1 row above');
  await enterValue(page, 'A2', 'South');
  await enterValue(page, 'B2', '700');

  // existing pivot result stays unchanged until refresh
  await sheetTab(page, 'Pivot1').click();
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'B4')).toHaveText('2000');

  await page.getByRole('button', { name: 'Refresh pivot table', exact: true }).click();
  await expect(cell(page, 'A2')).toHaveText('South');
  await expect(cell(page, 'B2')).toHaveText('700');
  await expect(cell(page, 'A3')).toHaveText('East');
  await expect(cell(page, 'B3')).toHaveText('1200');
  await expect(cell(page, 'A5')).toHaveText('Grand Total');
  await expect(cell(page, 'B5')).toHaveText('2700');
});

/* ------------------------------------------- REQ-2-2-2: Insert and delete columns */

test('REQ-2-2-2: REQ-2-2-2 -the requested workflow B the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await seedSalesRows(page);

  await columnMenu(page, 'B', 'Insert 1 column left');

  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('');
  await expect(cell(page, 'B2')).toHaveText('');
  await expect(cell(page, 'C1')).toHaveText('Sales');
  await expect(cell(page, 'C2')).toHaveText('1200');
  await expect(cell(page, 'C3')).toHaveText('800');

  await page.reload();
  await expect(cell(page, 'B1')).toHaveText('');
  await expect(cell(page, 'C1')).toHaveText('Sales');
});

test('REQ-2-2-2#2: REQ-2-2-2 -the requested workflow B the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await seedSalesRows(page);

  await columnMenu(page, 'A', 'Insert 1 column right');

  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('');
  await expect(cell(page, 'B2')).toHaveText('');
  await expect(cell(page, 'C1')).toHaveText('Sales');
  await expect(cell(page, 'C2')).toHaveText('1200');
  await expect(cell(page, 'C3')).toHaveText('800');

  await page.reload();
  await expect(cell(page, 'B1')).toHaveText('');
  await expect(cell(page, 'C2')).toHaveText('1200');
});

test('REQ-2-2-2#3: REQ-2-2-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterValue(page, 'A1', 'Region');
  await enterValue(page, 'B1', 'Sales');
  await enterValue(page, 'C1', 'Note');
  await enterValue(page, 'A2', 'East');
  await enterValue(page, 'B2', '1200');
  await enterValue(page, 'C2', '=B2*2');
  await expect(cell(page, 'C2')).toHaveText('2400');

  await columnMenu(page, 'A', 'Delete column');

  // data outside the deleted column is preserved
  await expect(cell(page, 'A1')).toHaveText('Sales');
  await expect(cell(page, 'B1')).toHaveText('Note');
  await expect(cell(page, 'A2')).toHaveText('1200');

  await selectCell(page, 'B2');
  await expect(formulaBar(page)).toHaveValue('=A2*2');
  await expect(cell(page, 'B2')).toHaveText('2400');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('Sales');
  await expect(cell(page, 'B2')).toHaveText('2400');
});

test('REQ-2-2-2#4: REQ-2-2-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterValue(page, 'A1', 'Item');
  await enterValue(page, 'B1', 'Score');
  await enterValue(page, 'A2', 'Pen');
  await enterValue(page, 'B2', '50');
  await enterValue(page, 'A3', 'Pencil');
  await enterValue(page, 'B3', '60');

  await selectRange(page, 'B2', 'B3');
  await dataMenu(page, 'Data validation');
  const validationDialog = dlg(page, 'Data validation');
  await choose(page, validationDialog.getByLabel('Rule type', { exact: true }), 'Number range');
  await validationDialog.getByLabel('Minimum', { exact: true }).fill('0');
  await validationDialog.getByLabel('Maximum', { exact: true }).fill('100');
  await validationDialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(validationDialog).toHaveCount(0);

  await selectCell(page, 'B2');
  await formulaBar(page).fill('101');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Please enter a number from 0 to 100', { exact: true })).toBeVisible();
  await expect(cell(page, 'B2')).toHaveText('50');

  // the validation rule moves right with the constrained cells
  await columnMenu(page, 'B', 'Insert 1 column left');
  await expect(cell(page, 'B2')).toHaveText('');
  await expect(cell(page, 'C2')).toHaveText('50');

  await selectCell(page, 'C2');
  await formulaBar(page).fill('101');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Please enter a number from 0 to 100', { exact: true })).toBeVisible();
  await expect(cell(page, 'C2')).toHaveText('50');

  await page.reload();
  await expect(cell(page, 'C2')).toHaveText('50');
});

test('REQ-2-2-2#5: REQ-2-2-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterValue(page, 'A1', 'Region');
  await enterValue(page, 'B1', 'Sales');
  await enterValue(page, 'A2', 'East');
  await enterValue(page, 'B2', '1200');
  await enterValue(page, 'A3', 'North');
  await enterValue(page, 'B3', '800');

  await selectRange(page, 'A1', 'B3');
  await dataMenu(page, 'Create pivot table');
  const createDialog = dlg(page, 'Create pivot table');
  await createDialog.getByRole('radio', { name: 'New worksheet', exact: true }).check();
  await createDialog.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(sheetTab(page, 'Pivot1')).toBeVisible();

  const editor = page.getByRole('region', { name: 'Pivot table editor', exact: true });
  await choose(page, editor.getByLabel('Rows', { exact: true }), 'Region');
  await choose(page, editor.getByLabel('Values', { exact: true }), 'Sales');
  await choose(page, editor.getByLabel('Summarize by', { exact: true }), 'SUM');
  await editor.getByRole('button', { name: 'Apply', exact: true }).click();

  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('SUM of Sales');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1200');

  // delete the selected pivot source field from the source worksheet
  await sheetTab(page, 'Sheet1').click();
  await columnMenu(page, 'A', 'Delete column');
  await expect(cell(page, 'A1')).toHaveText('Sales');

  // refreshing keeps the last successful result and reports the missing field
  await sheetTab(page, 'Pivot1').click();
  await page.getByRole('button', { name: 'Refresh pivot table', exact: true }).click();
  await expect(page.getByText('Pivot field is no longer available. Select a new field.', { exact: true })).toBeVisible();
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1200');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

