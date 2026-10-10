// REQ-4 Formula Calculation - end-to-end acceptance tests.
// Every test creates its own blank workbook through the home page, so the seeded
// workbook and its data are never modified by these tests.

const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------- helpers ----

function worksheetGrid(page) {
  return page.getByRole('grid', { name: 'Worksheet grid', exact: true });
}

function cell(page, coordinate) {
  return worksheetGrid(page).getByRole('gridcell', { name: coordinate, exact: true });
}

function formulaBar(page) {
  return page.getByLabel('Formula bar', { exact: true });
}

// Create a blank workbook through the documented home page flow.
async function createBlankWorkbook(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(worksheetGrid(page)).toBeVisible();
}

// Enter content directly in the grid, committing with Enter.
async function enterInGrid(page, coordinate, value) {
  await cell(page, coordinate).click();
  await page.keyboard.type(value);
  await page.keyboard.press('Enter');
}

// Enter content through the text box labeled "Formula bar", committing with Enter.
async function enterInFormulaBar(page, coordinate, value) {
  await cell(page, coordinate).click();
  const bar = formulaBar(page);
  await bar.click();
  await bar.fill(value);
  await bar.press('Enter');
}

// Enter content through the inline editor shown by double-clicking a grid cell.
async function enterInline(page, coordinate, value) {
  await cell(page, coordinate).dblclick();
  const editor = page.getByRole('textbox', { name: `Edit ${coordinate}`, exact: true });
  await editor.fill(value);
  await editor.press('Enter');
}

async function expectCell(page, coordinate, value) {
  await expect(cell(page, coordinate)).toHaveText(value);
}

// Select a cell and check the formula bar shows its ordinary value / original formula.
async function selectAndExpectFormulaBar(page, coordinate, content) {
  await cell(page, coordinate).click();
  await expect(formulaBar(page)).toHaveValue(content);
}

// ------------------------------------------------------- REQ-4-1-1 tests ----

test('REQ-4-1-1: REQ-4-1-1 -the requested workflow,the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);

  // Grid entry of numbers and formulas.
  await enterInGrid(page, 'A1', '2');
  await enterInGrid(page, 'B1', '3');
  await enterInGrid(page, 'C1', '=A1+B1');
  await expectCell(page, 'C1', '5');
  await enterInGrid(page, 'D1', '=C1*2');
  await expectCell(page, 'D1', '10');

  // Grid shows the result, formula bar shows the original expression.
  await expectCell(page, 'C1', '5');
  await selectAndExpectFormulaBar(page, 'C1', '=A1+B1');
  await selectAndExpectFormulaBar(page, 'D1', '=C1*2');

  // Values, original formulas and results persist after refresh.
  await page.reload();
  await expectCell(page, 'A1', '2');
  await expectCell(page, 'B1', '3');
  await expectCell(page, 'C1', '5');
  await expectCell(page, 'D1', '10');
  await selectAndExpectFormulaBar(page, 'C1', '=A1+B1');
  await selectAndExpectFormulaBar(page, 'D1', '=C1*2');
});

test('REQ-4-1-1#2: REQ-4-1-1 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);

  await enterInGrid(page, 'A1', '12');
  await enterInGrid(page, 'B1', '4');

  // Operators and parentheses entered through the formula bar.
  await enterInFormulaBar(page, 'C1', '=A1-B1');
  await expectCell(page, 'C1', '8');
  await enterInFormulaBar(page, 'D1', '=A1*B1');
  await expectCell(page, 'D1', '48');
  await enterInFormulaBar(page, 'E1', '=A1/B1');
  await expectCell(page, 'E1', '3');
  await enterInFormulaBar(page, 'F1', '=(A1+B1)*2');
  await expectCell(page, 'F1', '32');
  await enterInFormulaBar(page, 'G1', '=A1+B1*2');
  await expectCell(page, 'G1', '20');

  await selectAndExpectFormulaBar(page, 'E1', '=A1/B1');
  await selectAndExpectFormulaBar(page, 'F1', '=(A1+B1)*2');

  await page.reload();
  await expectCell(page, 'C1', '8');
  await expectCell(page, 'D1', '48');
  await expectCell(page, 'E1', '3');
  await expectCell(page, 'F1', '32');
  await expectCell(page, 'G1', '20');
  await selectAndExpectFormulaBar(page, 'G1', '=A1+B1*2');
});

test('REQ-4-1-1#3: REQ-4-1-1 -the requested workflow, the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);

  // Source numbers entered through the inline editor shown by double-clicking.
  await enterInline(page, 'A1', '2');
  await enterInline(page, 'A2', '4');
  await enterInline(page, 'A3', '6');
  await enterInline(page, 'A4', '8');

  await enterInFormulaBar(page, 'B1', '=SUM(A1:A4)');
  await expectCell(page, 'B1', '20');
  await enterInFormulaBar(page, 'B2', '=AVERAGE(A1:A4)');
  await expectCell(page, 'B2', '5');
  await enterInFormulaBar(page, 'B3', '=COUNT(A1:A4)');
  await expectCell(page, 'B3', '4');
  await enterInFormulaBar(page, 'B4', '=MIN(A1:A4)');
  await expectCell(page, 'B4', '2');
  await enterInFormulaBar(page, 'B5', '=MAX(A1:A4)');
  await expectCell(page, 'B5', '8');

  await selectAndExpectFormulaBar(page, 'B1', '=SUM(A1:A4)');

  await page.reload();
  await expectCell(page, 'B1', '20');
  await expectCell(page, 'B2', '5');
  await expectCell(page, 'B3', '4');
  await expectCell(page, 'B4', '2');
  await expectCell(page, 'B5', '8');
  await selectAndExpectFormulaBar(page, 'B2', '=AVERAGE(A1:A4)');
});

test('REQ-4-1-1#4: REQ-4-1-1 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);

  await enterInGrid(page, 'A1', '2');
  await enterInGrid(page, 'A2', '4');
  await enterInGrid(page, 'A3', 'East');

  // Function names are case-insensitive; blanks and text are not treated as numbers.
  await enterInFormulaBar(page, 'B1', '=sum(A1:A4)');
  await expectCell(page, 'B1', '6');
  await enterInFormulaBar(page, 'B2', '=Average(A1:A4)');
  await expectCell(page, 'B2', '3');
  await enterInFormulaBar(page, 'B3', '=count(A1:A4)');
  await expectCell(page, 'B3', '2');
  await enterInFormulaBar(page, 'B4', '=MIN(a1:a4)');
  await expectCell(page, 'B4', '2');
  await enterInFormulaBar(page, 'B5', '=Max(A1:A4)');
  await expectCell(page, 'B5', '4');

  await page.reload();
  await expectCell(page, 'B1', '6');
  await expectCell(page, 'B2', '3');
  await expectCell(page, 'B3', '2');
  await expectCell(page, 'B4', '2');
  await expectCell(page, 'B5', '4');
  await selectAndExpectFormulaBar(page, 'B1', '=sum(A1:A4)');
});

test('REQ-4-1-1#5: REQ-4-1-1 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);

  await enterInGrid(page, 'A1', '2');
  await enterInGrid(page, 'B1', '3');
  await enterInFormulaBar(page, 'C1', '=A1+B1');
  await enterInFormulaBar(page, 'D1', '=C1*2');
  await enterInFormulaBar(page, 'E1', '=D1+1');

  await expectCell(page, 'C1', '5');
  await expectCell(page, 'D1', '10');
  await expectCell(page, 'E1', '11');

  // A committed source change updates directly and indirectly dependent formulas.
  await enterInline(page, 'A1', '5');
  await expectCell(page, 'C1', '8');
  await expectCell(page, 'D1', '16');
  await expectCell(page, 'E1', '17');

  // Grid and formula bar stay consistent for the same cell.
  await selectAndExpectFormulaBar(page, 'A1', '5');
  await selectAndExpectFormulaBar(page, 'C1', '=A1+B1');
  await selectAndExpectFormulaBar(page, 'D1', '=C1*2');
  await selectAndExpectFormulaBar(page, 'E1', '=D1+1');

  await page.reload();
  await expectCell(page, 'A1', '5');
  await expectCell(page, 'C1', '8');
  await expectCell(page, 'D1', '16');
  await expectCell(page, 'E1', '17');
  await selectAndExpectFormulaBar(page, 'D1', '=C1*2');
});

// ------------------------------------------------------- REQ-4-1-2 tests ----

test('REQ-4-1-2: REQ-4-1-2 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);

  await enterInGrid(page, 'A1', '2');
  await enterInGrid(page, 'B1', '3');
  await enterInGrid(page, 'A2', '10');
  await enterInGrid(page, 'B2', '20');
  await enterInFormulaBar(page, 'C1', '=A1+B1');
  await enterInFormulaBar(page, 'C2', '=A2+B2');
  await expectCell(page, 'C1', '5');
  await expectCell(page, 'C2', '30');

  // Select the rectangular source range C1:C2 by dragging, then copy it to D1:D2.
  await cell(page, 'C1').hover();
  await page.mouse.down();
  await cell(page, 'C2').hover();
  await page.mouse.up();
  await expect(cell(page, 'C1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'C2')).toHaveAttribute('aria-selected', 'true');

  await page.keyboard.press('Control+C');
  await cell(page, 'D1').click();
  await page.keyboard.press('Control+V');

  // Relative references adjust by the target offset; source formulas/results stay.
  await expectCell(page, 'D1', '8');
  await expectCell(page, 'D2', '50');
  await selectAndExpectFormulaBar(page, 'D1', '=B1+C1');
  await selectAndExpectFormulaBar(page, 'D2', '=B2+C2');
  await expectCell(page, 'C1', '5');
  await expectCell(page, 'C2', '30');
  await selectAndExpectFormulaBar(page, 'C1', '=A1+B1');

  await page.reload();
  await expectCell(page, 'C1', '5');
  await expectCell(page, 'C2', '30');
  await expectCell(page, 'D1', '8');
  await expectCell(page, 'D2', '50');
  await selectAndExpectFormulaBar(page, 'D2', '=B2+C2');
});

test('REQ-4-1-2#2: REQ-4-1-2 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);

  await enterInGrid(page, 'A1', '2');
  await enterInGrid(page, 'B1', '3');
  await enterInGrid(page, 'B2', '5');
  await enterInFormulaBar(page, 'C1', '=$A$1+B1');
  await expectCell(page, 'C1', '5');

  // Copy the formula one row down: relative B1 changes, absolute $A$1 does not.
  await cell(page, 'C1').click();
  await page.keyboard.press('Control+C');
  await cell(page, 'C2').click();
  await page.keyboard.press('Control+V');
  await expectCell(page, 'C2', '7');
  await selectAndExpectFormulaBar(page, 'C2', '=$A$1+B2');
  await expectCell(page, 'C1', '5');
  await selectAndExpectFormulaBar(page, 'C1', '=$A$1+B1');

  // Copying a formula so that a relative reference leaves the grid shows =#REF! / #REF!.
  await enterInGrid(page, 'A4', '7');
  await enterInFormulaBar(page, 'B4', '=A4');
  await expectCell(page, 'B4', '7');
  await cell(page, 'B4').click();
  await page.keyboard.press('Control+C');
  await cell(page, 'A5').click();
  await page.keyboard.press('Control+V');
  await expectCell(page, 'A5', '#REF!');
  await selectAndExpectFormulaBar(page, 'A5', '=#REF!');
  await expectCell(page, 'B4', '7');

  await page.reload();
  await expectCell(page, 'C1', '5');
  await expectCell(page, 'C2', '7');
  await selectAndExpectFormulaBar(page, 'C2', '=$A$1+B2');
  await expectCell(page, 'A5', '#REF!');
});

// ------------------------------------------------------- REQ-4-2-1 tests ----

test('REQ-4-2-1: REQ-4-2-1 -the requested workflow,the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);

  await enterInGrid(page, 'A1', '2');
  await enterInGrid(page, 'B1', '3');
  await enterInFormulaBar(page, 'C1', '=A1+B1');
  await enterInFormulaBar(page, 'D1', '=C1*2');
  await expectCell(page, 'C1', '5');
  await expectCell(page, 'D1', '10');

  // Source-value edit: direct and indirect dependents recalculate.
  await enterInFormulaBar(page, 'A1', '10');
  await expectCell(page, 'A1', '10');
  await expectCell(page, 'C1', '13');
  await expectCell(page, 'D1', '26');
  await selectAndExpectFormulaBar(page, 'C1', '=A1+B1');
  await selectAndExpectFormulaBar(page, 'D1', '=C1*2');

  await page.reload();
  await expectCell(page, 'A1', '10');
  await expectCell(page, 'C1', '13');
  await expectCell(page, 'D1', '26');
  await selectAndExpectFormulaBar(page, 'D1', '=C1*2');
});

test('REQ-4-2-1#2: REQ-4-2-1 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);

  await enterInGrid(page, 'A1', '1');
  await enterInGrid(page, 'B1', '1');
  await enterInFormulaBar(page, 'C1', '=A1+B1');
  await expectCell(page, 'C1', '2');

  // Bulk paste of a two-dimensional table over A1:B2 through the grid context menu.
  await page.evaluate((t) => navigator.clipboard.writeText(t), '5\t6\n7\t8');
  await cell(page, 'A1').click();
  await cell(page, 'A1').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Paste', exact: true }).click();

  await expectCell(page, 'A1', '5');
  await expectCell(page, 'B1', '6');
  await expectCell(page, 'A2', '7');
  await expectCell(page, 'B2', '8');
  await expectCell(page, 'C1', '11');
  await selectAndExpectFormulaBar(page, 'C1', '=A1+B1');

  await page.reload();
  await expectCell(page, 'A1', '5');
  await expectCell(page, 'B1', '6');
  await expectCell(page, 'A2', '7');
  await expectCell(page, 'B2', '8');
  await expectCell(page, 'C1', '11');
  await selectAndExpectFormulaBar(page, 'C1', '=A1+B1');
});

test('REQ-4-2-1#3: REQ-4-2-1 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);

  await enterInGrid(page, 'A1', '2');
  await enterInGrid(page, 'B1', '3');
  await enterInFormulaBar(page, 'C1', '=A1+B1');
  await expectCell(page, 'C1', '5');

  // Second worksheet with its own formula, which must not be affected by row/column changes.
  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Sheet2' })).toBeVisible();
  await enterInFormulaBar(page, 'A1', '=1+1');
  await expectCell(page, 'A1', '2');

  // Back to the first worksheet, insert a row above row 1.
  await page.getByRole('tab', { name: 'Sheet1' }).click();
  await expectCell(page, 'C1', '5');
  await page.getByRole('rowheader', { name: '1', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 row above', exact: true }).click();
  await expectCell(page, 'A2', '2');
  await expectCell(page, 'B2', '3');
  await expectCell(page, 'C2', '5');
  await selectAndExpectFormulaBar(page, 'C2', '=A2+B2');

  // Insert a column to the left of column A: data and references shift together.
  await page.getByRole('columnheader', { name: 'A', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 column left', exact: true }).click();
  await expectCell(page, 'B2', '2');
  await expectCell(page, 'C2', '3');
  await expectCell(page, 'D2', '5');
  await selectAndExpectFormulaBar(page, 'D2', '=B2+C2');

  // The other worksheet is unchanged.
  await page.getByRole('tab', { name: 'Sheet2' }).click();
  await expectCell(page, 'A1', '2');
  await selectAndExpectFormulaBar(page, 'A1', '=1+1');

  await page.getByRole('tab', { name: 'Sheet1' }).click();
  await page.reload();
  await expectCell(page, 'B2', '2');
  await expectCell(page, 'C2', '3');
  await expectCell(page, 'D2', '5');
  await selectAndExpectFormulaBar(page, 'D2', '=B2+C2');
});

// ------------------------------------------------------- REQ-4-2-2 tests ----

test('REQ-4-2-2: REQ-4-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);

  await enterInGrid(page, 'A1', '10');
  await enterInGrid(page, 'B1', '0');
  await enterInFormulaBar(page, 'C1', '=A1/B1');

  // Division by zero: grid shows #DIV/0!, formula bar the submitted formula.
  await expectCell(page, 'C1', '#DIV/0!');
  await selectAndExpectFormulaBar(page, 'C1', '=A1/B1');

  // The error cell does not block viewing, editing or recalculating other cells.
  await enterInGrid(page, 'D1', '1');
  await expectCell(page, 'D1', '1');
  await enterInFormulaBar(page, 'E1', '=1+1');
  await expectCell(page, 'E1', '2');
  await expectCell(page, 'C1', '#DIV/0!');

  await page.reload();
  await expectCell(page, 'C1', '#DIV/0!');
  await selectAndExpectFormulaBar(page, 'C1', '=A1/B1');
  await expectCell(page, 'E1', '2');
});

test('REQ-4-2-2#2: REQ-4-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);

  await enterInGrid(page, 'A4', '7');
  await enterInFormulaBar(page, 'B4', '=A4');
  await expectCell(page, 'B4', '7');

  // Copying the formula so its reference leaves the grid yields an invalid reference.
  await cell(page, 'B4').click();
  await page.keyboard.press('Control+C');
  await cell(page, 'A5').click();
  await page.keyboard.press('Control+V');

  await expectCell(page, 'A5', '#REF!');
  await selectAndExpectFormulaBar(page, 'A5', '=#REF!');
  await expectCell(page, 'B4', '7');

  await page.reload();
  await expectCell(page, 'A5', '#REF!');
  await selectAndExpectFormulaBar(page, 'A5', '=#REF!');
  await expectCell(page, 'B4', '7');
});

test('REQ-4-2-2#3: REQ-4-2-2 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);

  await enterInGrid(page, 'A1', '3');
  await enterInFormulaBar(page, 'B1', '=NOTAFUNCTION(A1)');

  // Unsupported function: #NAME? with the original expression in the formula bar.
  await expectCell(page, 'B1', '#NAME?');
  await selectAndExpectFormulaBar(page, 'B1', '=NOTAFUNCTION(A1)');

  // Unrelated cells keep calculating.
  await enterInFormulaBar(page, 'C1', '=A1+1');
  await expectCell(page, 'C1', '4');
  await expectCell(page, 'B1', '#NAME?');

  await page.reload();
  await expectCell(page, 'B1', '#NAME?');
  await selectAndExpectFormulaBar(page, 'B1', '=NOTAFUNCTION(A1)');
  await expectCell(page, 'C1', '4');
});

test('REQ-4-2-2#4: REQ-4-2-2 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);

  await enterInGrid(page, 'A1', '4');
  await enterInFormulaBar(page, 'B1', '=A1+');

  // Malformed expression: #ERROR! with the original expression in the formula bar.
  await expectCell(page, 'B1', '#ERROR!');
  await selectAndExpectFormulaBar(page, 'B1', '=A1+');

  // The error cell does not block other cells.
  await enterInFormulaBar(page, 'C1', '=A1*2');
  await expectCell(page, 'C1', '8');

  await page.reload();
  await expectCell(page, 'B1', '#ERROR!');
  await selectAndExpectFormulaBar(page, 'B1', '=A1+');
  await expectCell(page, 'C1', '8');
});

test('REQ-4-2-2#5: REQ-4-2-2 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);

  // Direct circular reference between A1 and B1.
  await enterInFormulaBar(page, 'A1', '=B1');
  await enterInFormulaBar(page, 'B1', '=A1');
  await expectCell(page, 'A1', '#REF!');
  await expectCell(page, 'B1', '#REF!');
  await selectAndExpectFormulaBar(page, 'A1', '=B1');
  await selectAndExpectFormulaBar(page, 'B1', '=A1');

  await page.reload();
  await expectCell(page, 'A1', '#REF!');
  await expectCell(page, 'B1', '#REF!');
  await selectAndExpectFormulaBar(page, 'A1', '=B1');

  // Changing the error cell to a valid formula fixes it and updates dependents.
  await enterInFormulaBar(page, 'A1', '=1+1');
  await expectCell(page, 'A1', '2');
  await selectAndExpectFormulaBar(page, 'A1', '=1+1');
  await expectCell(page, 'B1', '2');

  await page.reload();
  await expectCell(page, 'A1', '2');
  await expectCell(page, 'B1', '2');
  await selectAndExpectFormulaBar(page, 'A1', '=1+1');
  await selectAndExpectFormulaBar(page, 'B1', '=A1');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

