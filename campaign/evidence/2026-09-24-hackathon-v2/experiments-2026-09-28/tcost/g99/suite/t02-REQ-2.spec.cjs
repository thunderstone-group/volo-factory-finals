const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function createBlankWorkbook(page, name) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Rename workbook', exact: true }).click();
  await page.getByLabel('Workbook name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
}

async function openWorkbook(page, name) {
  await page.goto('/');
  await page.getByRole('link', { name, exact: true }).click();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
}

async function setCell(page, coord, value) {
  const cell = page.getByRole('gridcell', { name: coord, exact: true }).first();
  await cell.click();
  await page.getByLabel('Formula bar', { exact: true }).fill(value);
  await page.getByLabel('Formula bar', { exact: true }).press('Enter');
}

async function selectCell(page, coord) {
  const cell = page.getByRole('gridcell', { name: coord, exact: true }).first();
  await cell.click();
  await expect(cell).toHaveAttribute('aria-selected', 'true');
}

async function addWorksheet(page, expectedName) {
  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
  const tab = page.getByRole('tab', { name: expectedName, exact: true });
  await expect(tab).toBeVisible();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('gridcell', { name: 'A1', exact: true }).first()).toHaveAttribute('aria-selected', 'true');
}

async function switchToTab(page, name) {
  const tab = page.getByRole('tab', { name, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

async function createWorkbookWithSheets(page, name) {
  await createBlankWorkbook(page, name);
  await setCell(page, 'A1', 'East');
  await setCell(page, 'B1', '1200');
  await setCell(page, 'A2', 'North');
  await setCell(page, 'B2', '800');
  await addWorksheet(page, 'Sheet2');
  await setCell(page, 'A1', 'West');
  await setCell(page, 'B1', '500');
  await switchToTab(page, 'Sheet1');
}

async function openWorksheetMenu(page, worksheetName) {
  await page.getByRole('button', { name: `Worksheet options for ${worksheetName}`, exact: true }).click();
}

async function insertRowAbove(page, rowNumber) {
  await page.getByRole('rowheader', { name: String(rowNumber), exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 row above', exact: true }).click();
}

async function insertRowBelow(page, rowNumber) {
  await page.getByRole('rowheader', { name: String(rowNumber), exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 row below', exact: true }).click();
}

async function deleteRow(page, rowNumber) {
  await page.getByRole('rowheader', { name: String(rowNumber), exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete row', exact: true }).click();
}

async function insertColumnLeft(page, columnLetter) {
  await page.getByRole('columnheader', { name: columnLetter, exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 column left', exact: true }).click();
}

async function insertColumnRight(page, columnLetter) {
  await page.getByRole('columnheader', { name: columnLetter, exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 column right', exact: true }).click();
}

async function deleteColumn(page, columnLetter) {
  await page.getByRole('columnheader', { name: columnLetter, exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete column', exact: true }).click();
}

test('REQ-2-1-1: REQ-2-1-1 -the requested workflow Sheet2,the requested workflow', async ({ page }) => {
  const name = `wb-${u()}`;
  await createBlankWorkbook(page, name);
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('gridcell', { name: 'A1', exact: true }).first()).toHaveAttribute('aria-selected', 'true');

  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();

  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await expect(page.getByRole('gridcell', { name: 'A1', exact: true }).first()).toHaveAttribute('aria-selected', 'true');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('gridcell', { name: 'A1', exact: true }).first()).toHaveAttribute('aria-selected', 'true');
});

test('REQ-2-1-1#2: REQ-2-1-1 -the requested workflow SheetN the requested workflow', async ({ page }) => {
  const name = `wb-${u()}`;
  await createBlankWorkbook(page, name);
  await addWorksheet(page, 'Sheet2');

  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();

  await expect(page.getByRole('tab', { name: 'Sheet3', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet3', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet3', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('REQ-2-1-2: REQ-2-1-2 -the requested workflow, the requested workflow', async ({ page }) => {
  const name = `wb-${u()}`;
  await createWorkbookWithSheets(page, name);

  await selectCell(page, 'B2');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('800');

  await switchToTab(page, 'Sheet2');
  await expect(page.getByRole('gridcell', { name: 'B1', exact: true }).first()).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('500');

  await switchToTab(page, 'Sheet1');
  await expect(page.getByRole('gridcell', { name: 'B2', exact: true }).first()).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('800');
  await expect(page.getByRole('gridcell', { name: 'A1', exact: true }).first()).toHaveText('East');
});

test('REQ-2-1-2#2: REQ-2-1-2 -the requested workflow', async ({ page }) => {
  const name = `wb-${u()}`;
  await createWorkbookWithSheets(page, name);

  await selectCell(page, 'A1');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('East');

  await switchToTab(page, 'Sheet2');
  await expect(page.getByRole('gridcell', { name: 'B1', exact: true }).first()).toHaveAttribute('aria-selected', 'true');
  await setCell(page, 'C1', 'New');

  await switchToTab(page, 'Sheet1');
  await expect(page.getByRole('gridcell', { name: 'A1', exact: true }).first()).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('East');
  await expect(page.getByRole('gridcell', { name: 'A1', exact: true }).first()).toHaveText('East');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('gridcell', { name: 'A1', exact: true }).first()).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('gridcell', { name: 'A1', exact: true }).first()).toHaveText('East');
});

test('REQ-2-1-2#3: REQ-2-1-2 -the requested workflow', async ({ page }) => {
  const name = `wb-${u()}`;
  await createBlankWorkbook(page, name);
  await addWorksheet(page, 'Sheet2');
  await switchToTab(page, 'Sheet1');
  await switchToTab(page, 'Sheet2');

  await expect(page.getByRole('gridcell', { name: 'A1', exact: true }).first()).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('');
});

test('REQ-2-1-2#4: REQ-2-1-2 -the requested workflow', async ({ page }) => {
  const name = `wb-${u()}`;
  await createWorkbookWithSheets(page, name);

  await selectCell(page, 'B2');
  await switchToTab(page, 'Sheet2');
  await selectCell(page, 'B1');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('gridcell', { name: 'B1', exact: true }).first()).toHaveAttribute('aria-selected', 'true');

  await switchToTab(page, 'Sheet1');
  await expect(page.getByRole('gridcell', { name: 'B2', exact: true }).first()).toHaveAttribute('aria-selected', 'true');

  await switchToTab(page, 'Sheet2');
  await expect(page.getByRole('gridcell', { name: 'B1', exact: true }).first()).toHaveAttribute('aria-selected', 'true');
});

test('REQ-2-1-2#5: REQ-2-1-2 -the requested workflow', async ({ page }) => {
  const name = `wb-${u()}`;
  await createBlankWorkbook(page, name);
  await setCell(page, 'A1', '2');
  await setCell(page, 'A2', '3');
  await setCell(page, 'A3', '=A1+A2');
  await expect(page.getByRole('gridcell', { name: 'A3', exact: true }).first()).toHaveText('5');

  await addWorksheet(page, 'Sheet2');
  await setCell(page, 'A1', 'X');
  await switchToTab(page, 'Sheet1');
  await selectCell(page, 'A3');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A1+A2');

  await switchToTab(page, 'Sheet2');
  await expect(page.getByRole('gridcell', { name: 'A1', exact: true }).first()).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('X');
});

test('REQ-2-1-3: REQ-2-1-3 -the requested workflow,the requested workflow', async ({ page }) => {
  const name = `wb-${u()}`;
  const newSheetName = `Data-${u()}`;
  await createBlankWorkbook(page, name);
  await addWorksheet(page, 'Sheet2');

  await openWorksheetMenu(page, 'Sheet1');
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  await expect(page.getByLabel('Worksheet name', { exact: true })).toHaveValue('Sheet1');
  await page.getByLabel('Worksheet name', { exact: true }).fill(newSheetName);
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByRole('tab', { name: newSheetName, exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: newSheetName, exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('tab', { name: newSheetName, exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: newSheetName, exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('REQ-2-1-3#2: REQ-2-1-3 -the requested workflow,the requested workflow', async ({ page }) => {
  const name = `wb-${u()}`;
  await createBlankWorkbook(page, name);
  await addWorksheet(page, 'Sheet2');

  await openWorksheetMenu(page, 'Sheet1');
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  await page.getByLabel('Worksheet name', { exact: true }).fill('Sheet2');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText('Worksheet name already exists', { exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toBeVisible();
});

test('REQ-2-1-3#3: REQ-2-1-3 -the requested workflow,the requested workflow', async ({ page }) => {
  const name = `wb-${u()}`;
  await createBlankWorkbook(page, name);
  await addWorksheet(page, 'Sheet2');

  await openWorksheetMenu(page, 'Sheet1');
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  await page.getByLabel('Worksheet name', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText('Worksheet name cannot be empty', { exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toBeVisible();
});

test('REQ-2-1-4: REQ-2-1-4 -the requested workflow,the requested workflow', async ({ page }) => {
  const name = `wb-${u()}`;
  await createBlankWorkbook(page, name);
  await addWorksheet(page, 'Sheet2');

  await openWorksheetMenu(page, 'Sheet1');
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Delete worksheet' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Sheet1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete worksheet', exact: true }).click();

  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveAttribute('aria-selected', 'true');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('REQ-2-1-4#2: REQ-2-1-4 -the requested workflow,the requested workflow', async ({ page }) => {
  const name = `wb-${u()}`;
  await createBlankWorkbook(page, name);
  await addWorksheet(page, 'Sheet2');

  await openWorksheetMenu(page, 'Sheet2');
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Delete worksheet' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Sheet2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete worksheet', exact: true }).click();

  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('REQ-2-1-4#3: REQ-2-1-4 -the requested workflow,the requested workflow', async ({ page }) => {
  const name = `wb-${u()}`;
  const doomed = `doomed-${u()}`;
  await createBlankWorkbook(page, name);
  await setCell(page, 'A1', doomed);
  await addWorksheet(page, 'Sheet2');
  await switchToTab(page, 'Sheet1');

  await openWorksheetMenu(page, 'Sheet1');
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  await page.getByRole('dialog', { name: 'Delete worksheet', exact: true }).getByRole('button', { name: 'Delete worksheet', exact: true }).click();

  await openWorkbook(page, name);
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText(doomed, { exact: true })).toHaveCount(0);
});

test('REQ-2-1-4#4: REQ-2-1-4 -the requested workflow', async ({ page }) => {
  const name = `wb-${u()}`;
  await createBlankWorkbook(page, name);

  await openWorksheetMenu(page, 'Sheet1');
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();

  await expect(page.getByRole('dialog', { name: 'Delete worksheet' })).toHaveCount(0);
  await expect(page.getByText('A workbook must contain at least one worksheet', { exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('REQ-2-2-1: REQ-2-2-1 -the requested workflow 3 the requested workflow,the requested workflow', async ({ page }) => {
  const name = `wb-${u()}`;
  await createBlankWorkbook(page, name);
  await setCell(page, 'A1', 'East');
  await setCell(page, 'B1', '1200');
  await setCell(page, 'A2', 'North');
  await setCell(page, 'B2', '800');
  await setCell(page, 'A3', 'South');
  await setCell(page, 'B3', '700');

  await insertRowAbove(page, 3);

  await expect(page.getByRole('gridcell', { name: 'A3', exact: true }).first()).toHaveText('');
  await expect(page.getByRole('gridcell', { name: 'A4', exact: true }).first()).toHaveText('South');
  await expect(page.getByRole('gridcell', { name: 'B4', exact: true }).first()).toHaveText('700');

  await page.reload();
  await expect(page.getByRole('gridcell', { name: 'A3', exact: true }).first()).toHaveText('');
  await expect(page.getByRole('gridcell', { name: 'A4', exact: true }).first()).toHaveText('South');
  await expect(page.getByRole('gridcell', { name: 'B4', exact: true }).first()).toHaveText('700');
});

test('REQ-2-2-1#2: REQ-2-2-1 -the requested workflow 3 the requested workflow,the requested workflow', async ({ page }) => {
  const name = `wb-${u()}`;
  await createBlankWorkbook(page, name);
  await setCell(page, 'A1', 'East');
  await setCell(page, 'B1', '1200');
  await setCell(page, 'A2', 'North');
  await setCell(page, 'B2', '800');
  await setCell(page, 'A3', 'South');
  await setCell(page, 'B3', '700');

  await insertRowBelow(page, 3);

  await expect(page.getByRole('gridcell', { name: 'A3', exact: true }).first()).toHaveText('South');
  await expect(page.getByRole('gridcell', { name: 'A4', exact: true }).first()).toHaveText('');

  await page.reload();
  await expect(page.getByRole('gridcell', { name: 'A3', exact: true }).first()).toHaveText('South');
  await expect(page.getByRole('gridcell', { name: 'A4', exact: true }).first()).toHaveText('');
});

test('REQ-2-2-1#3: REQ-2-2-1 -the requested workflow', async ({ page }) => {
  const name = `wb-${u()}`;
  await createBlankWorkbook(page, name);
  await setCell(page, 'A1', 'East');
  await setCell(page, 'B1', '1200');
  await setCell(page, 'A2', 'North');
  await setCell(page, 'B2', '800');
  await setCell(page, 'A3', 'South');
  await setCell(page, 'B3', '700');

  await deleteRow(page, 2);

  await expect(page.getByRole('gridcell', { name: 'A2', exact: true }).first()).toHaveText('South');
  await expect(page.getByRole('gridcell', { name: 'B2', exact: true }).first()).toHaveText('700');
  await expect(page.getByRole('gridcell', { name: 'A1', exact: true }).first()).toHaveText('East');

  await page.reload();
  await expect(page.getByRole('gridcell', { name: 'A2', exact: true }).first()).toHaveText('South');
  await expect(page.getByRole('gridcell', { name: 'B2', exact: true }).first()).toHaveText('700');
});

test('REQ-2-2-1#4: REQ-2-2-1 -the requested workflow', async ({ page }) => {
  const name = `wb-${u()}`;
  await createBlankWorkbook(page, name);
  await setCell(page, 'A1', '2');
  await setCell(page, 'B1', '3');
  await setCell(page, 'A2', '10');
  await setCell(page, 'B2', '20');
  await setCell(page, 'C2', '=A2+B2');
  await expect(page.getByRole('gridcell', { name: 'C2', exact: true }).first()).toHaveText('30');

  await insertRowAbove(page, 2);

  await expect(page.getByRole('gridcell', { name: 'C3', exact: true }).first()).toHaveText('30');
  await selectCell(page, 'C3');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A3+B3');

  await page.reload();
  await expect(page.getByRole('gridcell', { name: 'C3', exact: true }).first()).toHaveText('30');
  await selectCell(page, 'C3');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A3+B3');
});

test('REQ-2-2-1#5: REQ-2-2-1 -the requested workflow', async ({ page }) => {
  const name = `wb-${u()}`;
  await createBlankWorkbook(page, name);
  await setCell(page, 'A1', '2');
  await setCell(page, 'B1', '3');
  await setCell(page, 'A2', '10');
  await setCell(page, 'B2', '20');
  await setCell(page, 'C2', '=A2+B2');
  await setCell(page, 'A3', '5');
  await setCell(page, 'B3', '6');
  await setCell(page, 'C3', '=A3+B3');

  await deleteRow(page, 2);

  await expect(page.getByRole('gridcell', { name: 'C2', exact: true }).first()).toHaveText('11');
  await selectCell(page, 'C2');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A2+B2');

  await page.reload();
  await expect(page.getByRole('gridcell', { name: 'C2', exact: true }).first()).toHaveText('11');
  await selectCell(page, 'C2');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A2+B2');
});

test('REQ-2-2-2: REQ-2-2-2 -the requested workflow B the requested workflow,the requested workflow', async ({ page }) => {
  const name = `wb-${u()}`;
  await createBlankWorkbook(page, name);
  await setCell(page, 'A1', 'Region');
  await setCell(page, 'B1', 'Sales');
  await setCell(page, 'C1', 'Status');
  await setCell(page, 'A2', 'East');
  await setCell(page, 'B2', '1200');
  await setCell(page, 'C2', 'Open');

  await insertColumnLeft(page, 'B');

  await expect(page.getByRole('gridcell', { name: 'B1', exact: true }).first()).toHaveText('');
  await expect(page.getByRole('gridcell', { name: 'C1', exact: true }).first()).toHaveText('Sales');
  await expect(page.getByRole('gridcell', { name: 'D1', exact: true }).first()).toHaveText('Status');
  await expect(page.getByRole('gridcell', { name: 'B2', exact: true }).first()).toHaveText('');
  await expect(page.getByRole('gridcell', { name: 'C2', exact: true }).first()).toHaveText('1200');
  await expect(page.getByRole('gridcell', { name: 'D2', exact: true }).first()).toHaveText('Open');

  await page.reload();
  await expect(page.getByRole('gridcell', { name: 'C1', exact: true }).first()).toHaveText('Sales');
  await expect(page.getByRole('gridcell', { name: 'D1', exact: true }).first()).toHaveText('Status');
  await expect(page.getByRole('gridcell', { name: 'C2', exact: true }).first()).toHaveText('1200');
  await expect(page.getByRole('gridcell', { name: 'D2', exact: true }).first()).toHaveText('Open');
});

test('REQ-2-2-2#2: REQ-2-2-2 -the requested workflow B the requested workflow,the requested workflow', async ({ page }) => {
  const name = `wb-${u()}`;
  await createBlankWorkbook(page, name);
  await setCell(page, 'A1', 'Region');
  await setCell(page, 'B1', 'Sales');
  await setCell(page, 'C1', 'Status');
  await setCell(page, 'A2', 'East');
  await setCell(page, 'B2', '1200');
  await setCell(page, 'C2', 'Open');

  await insertColumnRight(page, 'B');

  await expect(page.getByRole('gridcell', { name: 'B1', exact: true }).first()).toHaveText('Sales');
  await expect(page.getByRole('gridcell', { name: 'C1', exact: true }).first()).toHaveText('');
  await expect(page.getByRole('gridcell', { name: 'D1', exact: true }).first()).toHaveText('Status');
  await expect(page.getByRole('gridcell', { name: 'C2', exact: true }).first()).toHaveText('');
  await expect(page.getByRole('gridcell', { name: 'D2', exact: true }).first()).toHaveText('Open');

  await page.reload();
  await expect(page.getByRole('gridcell', { name: 'D1', exact: true }).first()).toHaveText('Status');
  await expect(page.getByRole('gridcell', { name: 'D2', exact: true }).first()).toHaveText('Open');
});

test('REQ-2-2-2#3: REQ-2-2-2 -the requested workflow', async ({ page }) => {
  const name = `wb-${u()}`;
  await createBlankWorkbook(page, name);
  await setCell(page, 'A1', 'Region');
  await setCell(page, 'B1', 'Sales');
  await setCell(page, 'C1', 'Status');
  await setCell(page, 'A2', 'East');
  await setCell(page, 'B2', '1200');
  await setCell(page, 'C2', 'Open');

  await deleteColumn(page, 'B');

  await expect(page.getByRole('gridcell', { name: 'B1', exact: true }).first()).toHaveText('Status');
  await expect(page.getByRole('gridcell', { name: 'B2', exact: true }).first()).toHaveText('Open');
  await expect(page.getByRole('gridcell', { name: 'A1', exact: true }).first()).toHaveText('Region');

  await page.reload();
  await expect(page.getByRole('gridcell', { name: 'B1', exact: true }).first()).toHaveText('Status');
  await expect(page.getByRole('gridcell', { name: 'B2', exact: true }).first()).toHaveText('Open');
});

test('REQ-2-2-2#4: REQ-2-2-2 -the requested workflow', async ({ page }) => {
  const name = `wb-${u()}`;
  await createBlankWorkbook(page, name);
  await setCell(page, 'A1', '2');
  await setCell(page, 'B1', '3');
  await setCell(page, 'C1', '=A1+B1');
  await expect(page.getByRole('gridcell', { name: 'C1', exact: true }).first()).toHaveText('5');

  await insertColumnLeft(page, 'B');

  await expect(page.getByRole('gridcell', { name: 'D1', exact: true }).first()).toHaveText('5');
  await selectCell(page, 'D1');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A1+C1');

  await page.reload();
  await expect(page.getByRole('gridcell', { name: 'D1', exact: true }).first()).toHaveText('5');
  await selectCell(page, 'D1');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A1+C1');
});

test('REQ-2-2-2#5: REQ-2-2-2 -the requested workflow', async ({ page }) => {
  const name = `wb-${u()}`;
  await createBlankWorkbook(page, name);
  await setCell(page, 'A1', '2');
  await setCell(page, 'B1', '3');
  await setCell(page, 'C1', '=A1+B1');
  await expect(page.getByRole('gridcell', { name: 'C1', exact: true }).first()).toHaveText('5');

  await deleteColumn(page, 'B');

  await expect(page.getByRole('gridcell', { name: 'B1', exact: true }).first()).toHaveText('#REF!');

  await page.reload();
  await expect(page.getByRole('gridcell', { name: 'B1', exact: true }).first()).toHaveText('#REF!');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

