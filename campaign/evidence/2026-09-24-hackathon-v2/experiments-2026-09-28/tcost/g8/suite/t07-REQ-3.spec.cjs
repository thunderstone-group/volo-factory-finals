const { test, expect } = require('@playwright/test');

test.setTimeout(15000);

async function openWorkbook(page, name = 'Q3 Sales') {
  await page.goto('/');
  await page.getByRole('link', { name, exact: true }).click();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
}

function cell(page, coord) {
  return page
    .getByRole('grid', { name: 'Worksheet grid', exact: true })
    .getByRole('gridcell', { name: coord, exact: true });
}

async function expectCellValue(page, coord, value) {
  await expect(cell(page, coord)).toHaveText(value);
}

async function selectCell(page, coord) {
  await cell(page, coord).click();
}

async function editCellViaGrid(page, coord, value) {
  await cell(page, coord).dblclick();
  const editor = page.getByLabel(`Edit ${coord}`, { exact: true });
  await editor.fill(value);
  await editor.press('Enter');
}

async function editCellViaFormulaBar(page, coord, value, commitByClicking) {
  await selectCell(page, coord);
  const bar = page.getByLabel('Formula bar', { exact: true });
  await bar.fill(value);
  if (commitByClicking) {
    await cell(page, commitByClicking).click();
  } else {
    await bar.press('Enter');
  }
}

async function expectFormulaBar(page, value) {
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue(value);
}

test('REQ-3-1-1: REQ-3-1-1 -the requested workflow,the requested workflow', async ({ page }) => {
  // GIVEN the fresh session starts at the home page; the seed contains
  // workbook Q3 Sales, range A1:B2 (Item/Qty, Pen/4), and target range D1:E2.
  await openWorkbook(page);
  await expectCellValue(page, 'A1', 'Item');
  await expectCellValue(page, 'B1', 'Qty');
  await expectCellValue(page, 'A2', 'Pen');
  await expectCellValue(page, 'B2', '4');

  // WHEN the workflow enters East, 1200, North, and 800 into D1:E2 through the grid.
  await editCellViaGrid(page, 'D1', 'East');
  await editCellViaGrid(page, 'E1', '1200');
  await editCellViaGrid(page, 'D2', 'North');
  await editCellViaGrid(page, 'E2', '800');

  // THEN the grid shows the entered values and the formula bar shows the same content
  // for the selected cell; the seeded range A1:B2 stays unchanged.
  await expectCellValue(page, 'D1', 'East');
  await expectCellValue(page, 'E1', '1200');
  await expectCellValue(page, 'D2', 'North');
  await expectCellValue(page, 'E2', '800');
  await selectCell(page, 'D1');
  await expectFormulaBar(page, 'East');
  await expectCellValue(page, 'A1', 'Item');
  await expectCellValue(page, 'B1', 'Qty');
  await expectCellValue(page, 'A2', 'Pen');
  await expectCellValue(page, 'B2', '4');

  // THEN after refreshing, the successful result remains persisted.
  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expectCellValue(page, 'D1', 'East');
  await expectCellValue(page, 'E1', '1200');
  await expectCellValue(page, 'D2', 'North');
  await expectCellValue(page, 'E2', '800');
  await selectCell(page, 'D1');
  await expectFormulaBar(page, 'East');
  await expectCellValue(page, 'A1', 'Item');
  await expectCellValue(page, 'B2', '4');
});

test('REQ-3-1-1#2: REQ-3-1-1 -Escape the requested workflow,the requested workflow', async ({ page }) => {
  // GIVEN the fresh session starts at the home page with the seeded workbook Q3 Sales.
  await openWorkbook(page);

  // Build the last successful committed value in D1 through the grid.
  await editCellViaGrid(page, 'D1', 'East');
  await expectCellValue(page, 'D1', 'East');

  // WHEN the user edits D1 to "1200" and presses Escape, the uncommitted change is cancelled.
  await cell(page, 'D1').dblclick();
  const editor = page.getByLabel('Edit D1', { exact: true });
  await editor.fill('1200');
  await editor.press('Escape');

  // THEN the grid and formula bar continue to show the last successful value.
  await expectCellValue(page, 'D1', 'East');
  await selectCell(page, 'D1');
  await expectFormulaBar(page, 'East');

  // THEN after refresh the original value remains persisted.
  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expectCellValue(page, 'D1', 'East');
  await selectCell(page, 'D1');
  await expectFormulaBar(page, 'East');
});

test('REQ-3-1-1#3: REQ-3-1-1 -the requested workflow, the requested workflow, the requested workflow, the requested workflow', async ({ page }) => {
  // GIVEN the fresh session starts at the home page with the seeded workbook Q3 Sales.
  await openWorkbook(page);

  // WHEN values are entered through the Formula bar, committed either with Enter
  // or by clicking another cell.
  await editCellViaFormulaBar(page, 'D1', 'East');
  await editCellViaFormulaBar(page, 'E1', '1200', 'D2');
  await editCellViaFormulaBar(page, 'D2', 'North');
  await editCellViaFormulaBar(page, 'E2', '800', 'D1');

  // THEN the grid and Formula bar show the same content for the edited cells.
  await expectCellValue(page, 'D1', 'East');
  await expectCellValue(page, 'E1', '1200');
  await expectCellValue(page, 'D2', 'North');
  await expectCellValue(page, 'E2', '800');
  await selectCell(page, 'E1');
  await expectFormulaBar(page, '1200');
  await selectCell(page, 'D2');
  await expectFormulaBar(page, 'North');

  // THEN after refresh the values remain persisted.
  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expectCellValue(page, 'D1', 'East');
  await expectCellValue(page, 'E1', '1200');
  await expectCellValue(page, 'D2', 'North');
  await expectCellValue(page, 'E2', '800');
  await selectCell(page, 'E2');
  await expectFormulaBar(page, '800');
});

test('REQ-3-1-1#4: REQ-3-1-1 -the requested workflow', async ({ page }) => {
  // GIVEN the fresh session starts at the home page with the seeded workbook Q3 Sales.
  await openWorkbook(page);

  // Build a source value in E1 through the grid.
  await editCellViaGrid(page, 'E1', '10');
  await expectCellValue(page, 'E1', '10');

  // WHEN formulas are entered through the grid: a direct formula in D1 and
  // an indirect formula in C1 that depends on D1.
  await editCellViaGrid(page, 'D1', '=E1+1');
  await editCellViaGrid(page, 'C1', '=D1*2');

  // THEN formula cells show the calculated result in the grid and the original
  // submitted formula in the formula bar.
  await expectCellValue(page, 'D1', '11');
  await expectCellValue(page, 'C1', '22');
  await selectCell(page, 'D1');
  await expectFormulaBar(page, '=E1+1');
  await selectCell(page, 'C1');
  await expectFormulaBar(page, '=D1*2');

  // WHEN the source value is committed.
  await editCellViaGrid(page, 'E1', '20');

  // THEN directly and indirectly dependent formulas update their results while
  // the formula bar keeps the original formulas.
  await expectCellValue(page, 'D1', '21');
  await expectCellValue(page, 'C1', '42');
  await selectCell(page, 'D1');
  await expectFormulaBar(page, '=E1+1');
  await selectCell(page, 'C1');
  await expectFormulaBar(page, '=D1*2');

  // THEN after refresh, values, original formulas, and results persist.
  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expectCellValue(page, 'E1', '20');
  await expectCellValue(page, 'D1', '21');
  await expectCellValue(page, 'C1', '42');
  await selectCell(page, 'D1');
  await expectFormulaBar(page, '=E1+1');
  await selectCell(page, 'C1');
  await expectFormulaBar(page, '=D1*2');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

