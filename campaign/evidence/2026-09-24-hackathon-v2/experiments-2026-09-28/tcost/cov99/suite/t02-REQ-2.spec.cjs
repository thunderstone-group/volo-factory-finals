const { test, expect } = require('@playwright/test');

function uniqueName(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function grid(page) {
  return page.getByRole('grid', { name: 'Worksheet grid', exact: true });
}

async function createWorkbook(page) {
  await page.goto('/');
  const name = uniqueName('wb');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(grid(page)).toBeVisible();
  await page.getByRole('button', { name: 'Rename workbook', exact: true }).click();
  const field = page.getByLabel('Workbook name', { exact: true });
  await expect(field).toBeVisible();
  await field.fill(name);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  return name;
}

async function selectCell(page, coord) {
  await grid(page).getByRole('gridcell', { name: coord, exact: true }).click();
}

async function enterCell(page, coord, value) {
  await selectCell(page, coord);
  const formulaBar = page.getByLabel('Formula bar', { exact: true });
  await formulaBar.fill(String(value));
  await formulaBar.press('Enter');
}

async function expectCellValue(page, coord, value) {
  await expect(grid(page).getByRole('gridcell', { name: coord, exact: true })).toHaveText(String(value));
}

async function expectCellSelected(page, coord) {
  await expect(grid(page).getByRole('gridcell', { name: coord, exact: true })).toHaveAttribute('aria-selected', 'true');
}

async function addWorksheet(page) {
  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
}

async function openSheetMenu(page, sheetName) {
  await page.getByRole('button', { name: `Worksheet options for ${sheetName}`, exact: true }).click();
}

async function renameSheet(page, oldName, newName) {
  await openSheetMenu(page, oldName);
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Rename worksheet', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Worksheet name', { exact: true }).fill(newName);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('tab', { name: newName.trim(), exact: true })).toBeVisible();
}

async function deleteSheet(page, sheetName) {
  await openSheetMenu(page, sheetName);
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete worksheet', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(sheetName)).toBeVisible();
  await dialog.getByRole('button', { name: 'Delete worksheet', exact: true }).click();
}

async function selectRange(page, start, end) {
  const startCell = grid(page).getByRole('gridcell', { name: start, exact: true });
  const endCell = grid(page).getByRole('gridcell', { name: end, exact: true });
  const sb = await startCell.boundingBox();
  const eb = await endCell.boundingBox();
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.mouse.down();
  await page.mouse.move(eb.x + eb.width / 2, eb.y + eb.height / 2, { steps: 5 });
  await page.mouse.up();
}

async function openDataMenu(page) {
  await page.getByRole('button', { name: 'Data', exact: true }).click();
}

async function openRowMenu(page, rowNumber) {
  await page.getByRole('rowheader', { name: String(rowNumber), exact: true }).click({ button: 'right' });
}

async function openColumnMenu(page, columnLetter) {
  await page.getByRole('columnheader', { name: columnLetter, exact: true }).click({ button: 'right' });
}

async function setNumberValidation(page, start, end, min, max) {
  await selectRange(page, start, end);
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: 'Data validation', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Rule type', { exact: true }).click();
  await page.getByRole('option', { name: 'Number range', exact: true }).click();
  await dialog.getByLabel('Minimum', { exact: true }).fill(String(min));
  await dialog.getByLabel('Maximum', { exact: true }).fill(String(max));
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
}

async function enterSalesData(page) {
  await enterCell(page, 'A1', 'Region');
  await enterCell(page, 'B1', 'Sales');
  await enterCell(page, 'C1', 'Status');
  await enterCell(page, 'A2', 'East');
  await enterCell(page, 'B2', '1200');
  await enterCell(page, 'C2', 'Open');
  await enterCell(page, 'A3', 'North');
  await enterCell(page, 'B3', '800');
  await enterCell(page, 'C3', 'Closed');
}

async function createPivotForSales(page) {
  await selectRange(page, 'A1', 'C3');
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: 'Create pivot table', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create pivot table', exact: true });
  await expect(dialog.getByText('Source range: A1:C3', { exact: true })).toBeVisible();
  await dialog.getByRole('radio', { name: 'New worksheet', exact: true }).check();
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Pivot1', exact: true })).toHaveAttribute('aria-selected', 'true');
}

test('REQ-2-1-1: REQ-2-1-1 -the requested workflow Sheet2,the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await addWorksheet(page);
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(grid(page)).toBeVisible();
  await expectCellSelected(page, 'A1');
  await expectCellValue(page, 'A1', '');
  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('REQ-2-1-1#2: REQ-2-1-1 -the requested workflow SheetN the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await addWorksheet(page);
  await enterCell(page, 'A1', 'kept');
  await addWorksheet(page);
  await expect(page.getByRole('tab', { name: 'Sheet3', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expectCellValue(page, 'A1', '');
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet3', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Sheet2', exact: true }).click();
  await expectCellValue(page, 'A1', 'kept');
});

test('REQ-2-1-2: REQ-2-1-2 -the requested workflow, the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterCell(page, 'A1', 'East');
  await enterCell(page, 'B1', '1200');
  await enterCell(page, 'A2', 'North');
  await enterCell(page, 'B2', '800');
  await addWorksheet(page);
  await enterCell(page, 'A1', 'West');
  await enterCell(page, 'B1', '900');
  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await expectCellValue(page, 'A1', 'East');
  await expectCellValue(page, 'B1', '1200');
  await page.getByRole('tab', { name: 'Sheet2', exact: true }).click();
  await expectCellValue(page, 'A1', 'West');
  await expectCellValue(page, 'B1', '900');
  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await expectCellValue(page, 'A1', 'East');
});

test('REQ-2-1-2#2: REQ-2-1-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await expect(grid(page)).toHaveAttribute('aria-multiselectable', 'true');
  await addWorksheet(page);
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expectCellSelected(page, 'A1');
  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await selectCell(page, 'B2');
  await page.getByRole('tab', { name: 'Sheet2', exact: true }).click();
  await expectCellSelected(page, 'A1');
});

test('REQ-2-1-2#3: REQ-2-1-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await selectCell(page, 'B2');
  await addWorksheet(page);
  await selectCell(page, 'C3');
  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await expectCellSelected(page, 'B2');
  await page.getByRole('tab', { name: 'Sheet2', exact: true }).click();
  await expectCellSelected(page, 'C3');
});

test('REQ-2-1-2#4: REQ-2-1-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterCell(page, 'A1', '2');
  await enterCell(page, 'B1', '3');
  await enterCell(page, 'C1', '=A1+B1');
  await selectCell(page, 'C1');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A1+B1');
  await addWorksheet(page);
  await expectCellValue(page, 'A1', '');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('');
  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await selectCell(page, 'C1');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A1+B1');
  await expectCellValue(page, 'C1', '5');
});

test('REQ-2-1-2#5: REQ-2-1-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await addWorksheet(page);
  await selectCell(page, 'D4');
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expectCellSelected(page, 'D4');
});

test('REQ-2-1-3: REQ-2-1-3 -the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await renameSheet(page, 'Sheet1', '  Budget Data  ');
  await expect(page.getByRole('tab', { name: 'Budget Data', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Budget Data', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('REQ-2-1-3#2: REQ-2-1-3 -the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await openSheetMenu(page, 'Sheet1');
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Rename worksheet', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Worksheet name', { exact: true }).fill('   ');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Worksheet name cannot be empty', { exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
});

test('REQ-2-1-3#3: REQ-2-1-3 -the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await addWorksheet(page);
  await openSheetMenu(page, 'Sheet2');
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Rename worksheet', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Worksheet name', { exact: true }).fill('Sheet1');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Worksheet name already exists', { exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toBeVisible();
});

test('REQ-2-1-4: REQ-2-1-4 -the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await addWorksheet(page);
  await deleteSheet(page, 'Sheet2');
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('REQ-2-1-4#2: REQ-2-1-4 -the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await addWorksheet(page);
  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await enterSalesData(page);
  await createPivotForSales(page);
  await deleteSheet(page, 'Pivot1');
  await expect(page.getByRole('tab', { name: 'Pivot1', exact: true })).toHaveCount(0);
  await deleteSheet(page, 'Sheet1');
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toBeVisible();
});

test('REQ-2-1-4#3: REQ-2-1-4 -the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterSalesData(page);
  await createPivotForSales(page);
  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await openSheetMenu(page, 'Sheet1');
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete worksheet', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Delete worksheet', exact: true }).click();
  await expect(page.getByText('Please delete or rebuild dependent pivot tables first', { exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Pivot1', exact: true })).toBeVisible();
});

test('REQ-2-1-4#4: REQ-2-1-4 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await openSheetMenu(page, 'Sheet1');
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  await expect(page.getByText('A workbook must contain at least one worksheet', { exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Delete worksheet', exact: true })).toHaveCount(0);
});

test('REQ-2-2-1: REQ-2-2-1 -the requested workflow 3 the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterCell(page, 'A1', 'East');
  await enterCell(page, 'B1', '1200');
  await enterCell(page, 'A2', 'North');
  await enterCell(page, 'B2', '800');
  await openRowMenu(page, 2);
  await page.getByRole('menuitem', { name: 'Insert 1 row above', exact: true }).click();
  await expectCellValue(page, 'A2', '');
  await expectCellValue(page, 'B2', '');
  await expectCellValue(page, 'A3', 'North');
  await expectCellValue(page, 'B3', '800');
  await page.reload();
  await expectCellValue(page, 'A2', '');
  await expectCellValue(page, 'A3', 'North');
});

test('REQ-2-2-1#2: REQ-2-2-1 -the requested workflow 3 the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterCell(page, 'A1', 'East');
  await enterCell(page, 'B1', '1200');
  await enterCell(page, 'A2', 'North');
  await enterCell(page, 'B2', '800');
  await openRowMenu(page, 2);
  await page.getByRole('menuitem', { name: 'Insert 1 row below', exact: true }).click();
  await expectCellValue(page, 'A2', 'North');
  await expectCellValue(page, 'B2', '800');
  await expectCellValue(page, 'A3', '');
  await expectCellValue(page, 'B3', '');
  await page.reload();
  await expectCellValue(page, 'A2', 'North');
  await expectCellValue(page, 'A3', '');
});

test('REQ-2-2-1#3: REQ-2-2-1 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterCell(page, 'A1', 'East');
  await enterCell(page, 'B1', '1200');
  await enterCell(page, 'A2', 'North');
  await enterCell(page, 'B2', '800');
  await openRowMenu(page, 1);
  await page.getByRole('menuitem', { name: 'Delete row', exact: true }).click();
  await expectCellValue(page, 'A1', 'North');
  await expectCellValue(page, 'B1', '800');
  await expectCellValue(page, 'A2', '');
  await page.reload();
  await expectCellValue(page, 'A1', 'North');
  await expectCellValue(page, 'B1', '800');
});

test('REQ-2-2-1#4: REQ-2-2-1 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterCell(page, 'A1', '2');
  await enterCell(page, 'B1', '3');
  await enterCell(page, 'C1', '=A1+B1');
  await selectCell(page, 'C1');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A1+B1');
  await openRowMenu(page, 1);
  await page.getByRole('menuitem', { name: 'Insert 1 row above', exact: true }).click();
  await selectCell(page, 'C2');
  await expectCellValue(page, 'C2', '5');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A2+B2');
  await page.reload();
  await selectCell(page, 'C2');
  await expectCellValue(page, 'C2', '5');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A2+B2');
});

test('REQ-2-2-1#5: REQ-2-2-1 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterCell(page, 'B1', '50');
  await enterCell(page, 'B2', '80');
  await setNumberValidation(page, 'B1', 'B2', 0, 100);
  await openRowMenu(page, 1);
  await page.getByRole('menuitem', { name: 'Insert 1 row above', exact: true }).click();
  await expectCellValue(page, 'B2', '50');
  await enterCell(page, 'B2', '101');
  await expect(page.getByText('Please enter a number from 0 to 100', { exact: true })).toBeVisible();
  await expectCellValue(page, 'B2', '50');
  await page.reload();
  await expectCellValue(page, 'B2', '50');
  await enterCell(page, 'B2', '101');
  await expect(page.getByText('Please enter a number from 0 to 100', { exact: true })).toBeVisible();
  await expectCellValue(page, 'B2', '50');
});

test('REQ-2-2-2: REQ-2-2-2 -the requested workflow B the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterCell(page, 'A1', 'East');
  await enterCell(page, 'B1', '1200');
  await enterCell(page, 'A2', 'North');
  await enterCell(page, 'B2', '800');
  await openColumnMenu(page, 'B');
  await page.getByRole('menuitem', { name: 'Insert 1 column left', exact: true }).click();
  await expectCellValue(page, 'A1', 'East');
  await expectCellValue(page, 'B1', '');
  await expectCellValue(page, 'C1', '1200');
  await expectCellValue(page, 'A2', 'North');
  await expectCellValue(page, 'C2', '800');
  await page.reload();
  await expectCellValue(page, 'C1', '1200');
  await expectCellValue(page, 'C2', '800');
});

test('REQ-2-2-2#2: REQ-2-2-2 -the requested workflow B the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterCell(page, 'A1', 'East');
  await enterCell(page, 'B1', '1200');
  await enterCell(page, 'A2', 'North');
  await enterCell(page, 'B2', '800');
  await openColumnMenu(page, 'B');
  await page.getByRole('menuitem', { name: 'Insert 1 column right', exact: true }).click();
  await expectCellValue(page, 'A1', 'East');
  await expectCellValue(page, 'B1', '1200');
  await expectCellValue(page, 'C1', '');
  await expectCellValue(page, 'A2', 'North');
  await expectCellValue(page, 'B2', '800');
  await page.reload();
  await expectCellValue(page, 'B1', '1200');
  await expectCellValue(page, 'C1', '');
});

test('REQ-2-2-2#3: REQ-2-2-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterCell(page, 'A1', 'East');
  await enterCell(page, 'B1', '1200');
  await enterCell(page, 'C1', 'Keep');
  await enterCell(page, 'A2', 'North');
  await enterCell(page, 'B2', '800');
  await enterCell(page, 'C2', 'Keep2');
  await openColumnMenu(page, 'B');
  await page.getByRole('menuitem', { name: 'Delete column', exact: true }).click();
  await expectCellValue(page, 'A1', 'East');
  await expectCellValue(page, 'B1', 'Keep');
  await expectCellValue(page, 'A2', 'North');
  await expectCellValue(page, 'B2', 'Keep2');
  await page.reload();
  await expectCellValue(page, 'B1', 'Keep');
  await expectCellValue(page, 'B2', 'Keep2');
});

test('REQ-2-2-2#4: REQ-2-2-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterCell(page, 'A1', '2');
  await enterCell(page, 'B1', '3');
  await enterCell(page, 'C1', '=A1+B1');
  await selectCell(page, 'C1');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A1+B1');
  await openColumnMenu(page, 'B');
  await page.getByRole('menuitem', { name: 'Insert 1 column left', exact: true }).click();
  await selectCell(page, 'D1');
  await expectCellValue(page, 'D1', '5');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A1+C1');
  await page.reload();
  await selectCell(page, 'D1');
  await expectCellValue(page, 'D1', '5');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A1+C1');
});

test('REQ-2-2-2#5: REQ-2-2-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterCell(page, 'A1', '2');
  await enterCell(page, 'B1', '3');
  await enterCell(page, 'C1', '=A1+B1');
  await selectCell(page, 'C1');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A1+B1');
  await openColumnMenu(page, 'B');
  await page.getByRole('menuitem', { name: 'Delete column', exact: true }).click();
  await selectCell(page, 'B1');
  await expectCellValue(page, 'B1', '#REF!');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue(/#REF!/);
  await page.reload();
  await selectCell(page, 'B1');
  await expectCellValue(page, 'B1', '#REF!');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue(/#REF!/);
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

