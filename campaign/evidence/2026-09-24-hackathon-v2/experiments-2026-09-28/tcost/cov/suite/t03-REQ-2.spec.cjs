const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function createUniqueWorkbook(page) {
  const name = 'wb' + u();
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Rename workbook', exact: true }).click();
  const nameField = page.getByLabel('Workbook name', { exact: true });
  await nameField.fill(name);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(nameField).toBeHidden();
  return name;
}

function activeGrid(page) {
  return page.getByRole('grid', { name: 'Worksheet grid', exact: true });
}

function cell(page, coord) {
  return activeGrid(page).getByRole('gridcell', { name: coord, exact: true });
}

async function selectCell(page, coord) {
  await cell(page, coord).click();
}

async function setCell(page, coord, value) {
  await selectCell(page, coord);
  const formulaBar = page.getByLabel('Formula bar', { exact: true });
  await formulaBar.fill(value);
  await formulaBar.press('Enter');
}

async function addWorksheet(page) {
  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
}

async function switchToSheet(page, name) {
  await page.getByRole('tab', { name, exact: true }).click();
  await expect(page.getByRole('tab', { name, exact: true })).toHaveAttribute('aria-selected', 'true');
}

async function expectCellValue(page, coord, value) {
  await expect(cell(page, coord)).toHaveText(value);
}

async function expectCellSelected(page, coord, selected) {
  await expect(cell(page, coord)).toHaveAttribute('aria-selected', selected ? 'true' : 'false');
}

async function expectFormulaBar(page, value) {
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue(value);
}

test('REQ-2-1-1 -the requested workflow Sheet2,the requested workflow', async ({ page }) => {
  await createUniqueWorkbook(page);
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');

  await setCell(page, 'A1', 'East');
  await setCell(page, 'B1', '1200');
  await setCell(page, 'A2', 'North');
  await setCell(page, 'B2', '800');

  await addWorksheet(page);
  const sheet2 = page.getByRole('tab', { name: 'Sheet2', exact: true });
  await expect(sheet2).toBeVisible();
  await expect(sheet2).toHaveAttribute('aria-selected', 'true');
  await expectCellSelected(page, 'A1', true);
  await expectCellValue(page, 'A1', '');

  await switchToSheet(page, 'Sheet1');
  await expectCellValue(page, 'A1', 'East');
  await expectCellValue(page, 'B1', '1200');
  await expectCellValue(page, 'A2', 'North');
  await expectCellValue(page, 'B2', '800');

  await switchToSheet(page, 'Sheet2');
  await selectCell(page, 'A1');
  await page.reload();

  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expectCellSelected(page, 'A1', true);
});

test('REQ-2-1-1 -the requested workflow SheetN the requested workflow', async ({ page }) => {
  await createUniqueWorkbook(page);
  await setCell(page, 'A1', 'East');

  await addWorksheet(page);
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toBeVisible();
  await switchToSheet(page, 'Sheet2');
  await setCell(page, 'A1', 'North');

  await addWorksheet(page);
  const sheet3 = page.getByRole('tab', { name: 'Sheet3', exact: true });
  await expect(sheet3).toBeVisible();
  await expect(sheet3).toHaveAttribute('aria-selected', 'true');
  await expectCellSelected(page, 'A1', true);
  await expectCellValue(page, 'A1', '');

  await switchToSheet(page, 'Sheet1');
  await expectCellValue(page, 'A1', 'East');
  await switchToSheet(page, 'Sheet2');
  await expectCellValue(page, 'A1', 'North');

  await switchToSheet(page, 'Sheet3');
  await page.reload();

  await expect(page.getByRole('tab', { name: 'Sheet3', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expectCellSelected(page, 'A1', true);
});

test('REQ-2-1-2 -the requested workflow, the requested workflow', async ({ page }) => {
  await createUniqueWorkbook(page);
  await setCell(page, 'A1', 'East');

  await addWorksheet(page);
  await switchToSheet(page, 'Sheet2');
  await setCell(page, 'A1', 'North');

  await switchToSheet(page, 'Sheet1');
  await selectCell(page, 'A1');
  await expectFormulaBar(page, 'East');
  await expectCellValue(page, 'A1', 'East');

  await switchToSheet(page, 'Sheet2');
  await selectCell(page, 'A1');
  await expectFormulaBar(page, 'North');
  await expectCellValue(page, 'A1', 'North');
});

test('REQ-2-1-2 -the requested workflow', async ({ page }) => {
  await createUniqueWorkbook(page);
  await addWorksheet(page);
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expectCellSelected(page, 'A1', true);
  await expectFormulaBar(page, '');
});

test('REQ-2-1-2 -the requested workflow', async ({ page }) => {
  await createUniqueWorkbook(page);
  await setCell(page, 'A1', 'East');
  await setCell(page, 'B1', '1200');
  await setCell(page, 'A2', 'North');
  await setCell(page, 'B2', '800');

  await selectCell(page, 'A1');
  await addWorksheet(page);
  await switchToSheet(page, 'Sheet2');
  await switchToSheet(page, 'Sheet1');

  await expectCellValue(page, 'A1', 'East');
  await expectCellValue(page, 'B1', '1200');
  await expectCellValue(page, 'A2', 'North');
  await expectCellValue(page, 'B2', '800');
  await expectCellSelected(page, 'A1', true);
  await expectFormulaBar(page, 'East');
});

test('REQ-2-1-2 -the requested workflow', async ({ page }) => {
  await createUniqueWorkbook(page);
  await setCell(page, 'A1', 'East');
  await setCell(page, 'B1', '1200');
  await selectCell(page, 'A1');

  await addWorksheet(page);
  await switchToSheet(page, 'Sheet2');
  await setCell(page, 'A1', 'North');
  await setCell(page, 'B1', '800');
  await selectCell(page, 'B1');

  await page.reload();

  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expectCellSelected(page, 'B1', true);
  await expectFormulaBar(page, '800');

  await switchToSheet(page, 'Sheet1');
  await expectCellSelected(page, 'A1', true);
  await expectFormulaBar(page, 'East');
});

test('REQ-2-1-2 -the requested workflow', async ({ page }) => {
  await createUniqueWorkbook(page);
  await setCell(page, 'A1', '1200');
  await setCell(page, 'B1', '800');
  await setCell(page, 'C1', '=A1+B1');
  await expectCellValue(page, 'C1', '2000');
  await selectCell(page, 'C1');

  await addWorksheet(page);
  await switchToSheet(page, 'Sheet1');
  await selectCell(page, 'C1');
  await expectFormulaBar(page, '=A1+B1');
  await expectCellValue(page, 'C1', '2000');

  await switchToSheet(page, 'Sheet2');
  await switchToSheet(page, 'Sheet1');
  await selectCell(page, 'C1');
  await expectFormulaBar(page, '=A1+B1');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

