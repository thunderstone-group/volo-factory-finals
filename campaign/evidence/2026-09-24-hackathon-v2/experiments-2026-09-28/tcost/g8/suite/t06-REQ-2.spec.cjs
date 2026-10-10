const { test, expect } = require('@playwright/test');

const worksheetGrid = (page) =>
  page.getByRole('grid', { name: 'Worksheet grid', exact: true });

const cell = (page, coord) =>
  worksheetGrid(page).getByRole('gridcell', { name: coord, exact: true });

const columnHeader = (page, column) =>
  worksheetGrid(page).getByRole('columnheader', { name: column, exact: true });

const formulaBar = (page) =>
  page.getByLabel('Formula bar', { exact: true });

async function createBlankWorkbook(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(worksheetGrid(page)).toBeVisible();
}

async function setCell(page, coord, value) {
  await cell(page, coord).click();
  await formulaBar(page).fill(String(value));
  await formulaBar(page).press('Enter');
}

async function insertColumn(page, column, side) {
  await columnHeader(page, column).click({ button: 'right' });
  await page.getByRole('menuitem', { name: `Insert 1 column ${side}`, exact: true }).click();
}

async function deleteColumn(page, column) {
  await columnHeader(page, column).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete column', exact: true }).click();
}

async function expectCellText(page, coord, value) {
  await expect(cell(page, coord)).toHaveText(String(value));
}

test('REQ-2-2-2: REQ-2-2-2 -the requested workflow B the requested workflow,the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCell(page, 'A1', 'Region');
  await setCell(page, 'B1', 'Sales');
  await setCell(page, 'A2', 'East');
  await setCell(page, 'B2', '1200');

  await insertColumn(page, 'B', 'left');

  await expectCellText(page, 'A1', 'Region');
  await expectCellText(page, 'B1', '');
  await expectCellText(page, 'C1', 'Sales');
  await expectCellText(page, 'A2', 'East');
  await expectCellText(page, 'B2', '');
  await expectCellText(page, 'C2', '1200');

  await page.reload();
  await expect(worksheetGrid(page)).toBeVisible();

  await expectCellText(page, 'A1', 'Region');
  await expectCellText(page, 'B1', '');
  await expectCellText(page, 'C1', 'Sales');
  await expectCellText(page, 'A2', 'East');
  await expectCellText(page, 'B2', '');
  await expectCellText(page, 'C2', '1200');
});

test('REQ-2-2-2#2: REQ-2-2-2 -the requested workflow B the requested workflow,the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCell(page, 'A1', 'Region');
  await setCell(page, 'B1', 'Sales');
  await setCell(page, 'C1', 'Status');
  await setCell(page, 'A2', 'East');
  await setCell(page, 'B2', '1200');
  await setCell(page, 'C2', 'Open');

  await insertColumn(page, 'B', 'right');

  await expectCellText(page, 'A1', 'Region');
  await expectCellText(page, 'B1', 'Sales');
  await expectCellText(page, 'C1', '');
  await expectCellText(page, 'D1', 'Status');
  await expectCellText(page, 'A2', 'East');
  await expectCellText(page, 'B2', '1200');
  await expectCellText(page, 'C2', '');
  await expectCellText(page, 'D2', 'Open');

  await page.reload();
  await expect(worksheetGrid(page)).toBeVisible();

  await expectCellText(page, 'A1', 'Region');
  await expectCellText(page, 'B1', 'Sales');
  await expectCellText(page, 'C1', '');
  await expectCellText(page, 'D1', 'Status');
  await expectCellText(page, 'A2', 'East');
  await expectCellText(page, 'B2', '1200');
  await expectCellText(page, 'C2', '');
  await expectCellText(page, 'D2', 'Open');
});

test('REQ-2-2-2#3: REQ-2-2-2 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCell(page, 'A1', 'Region');
  await setCell(page, 'B1', 'Sales');
  await setCell(page, 'C1', 'Status');
  await setCell(page, 'A2', 'East');
  await setCell(page, 'B2', '1200');
  await setCell(page, 'C2', 'Open');

  await deleteColumn(page, 'B');

  await expectCellText(page, 'A1', 'Region');
  await expectCellText(page, 'B1', 'Status');
  await expectCellText(page, 'A2', 'East');
  await expectCellText(page, 'B2', 'Open');

  await page.reload();
  await expect(worksheetGrid(page)).toBeVisible();

  await expectCellText(page, 'A1', 'Region');
  await expectCellText(page, 'B1', 'Status');
  await expectCellText(page, 'A2', 'East');
  await expectCellText(page, 'B2', 'Open');
});

test('REQ-2-2-2#4: REQ-2-2-2 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCell(page, 'A1', '2');
  await setCell(page, 'B1', '3');
  await setCell(page, 'C1', '=A1+B1');

  await insertColumn(page, 'B', 'left');

  await expectCellText(page, 'A1', '2');
  await expectCellText(page, 'C1', '3');
  await expectCellText(page, 'D1', '5');
  await cell(page, 'D1').click();
  await expect(formulaBar(page)).toHaveValue('=A1+C1');

  await page.reload();
  await expect(worksheetGrid(page)).toBeVisible();

  await expectCellText(page, 'A1', '2');
  await expectCellText(page, 'C1', '3');
  await expectCellText(page, 'D1', '5');
  await cell(page, 'D1').click();
  await expect(formulaBar(page)).toHaveValue('=A1+C1');
});

test('REQ-2-2-2#5: REQ-2-2-2 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCell(page, 'A1', '2');
  await setCell(page, 'B1', '3');
  await setCell(page, 'C1', '=B1*2');

  await deleteColumn(page, 'B');

  await expectCellText(page, 'A1', '2');
  await expectCellText(page, 'B1', '#REF!');

  await page.reload();
  await expect(worksheetGrid(page)).toBeVisible();

  await expectCellText(page, 'A1', '2');
  await expectCellText(page, 'B1', '#REF!');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

