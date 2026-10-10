const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// The active worksheet grid (REQ-1).
function grid(page) {
  return page.getByRole('grid', { name: 'Worksheet grid', exact: true });
}

// A grid cell is addressable by its coordinate (REQ-1).
function cell(page, coord) {
  return page.getByRole('gridcell', { name: coord, exact: true });
}

// The editor text box labeled "Formula bar" (REQ-3-1-1).
function formulaBar(page) {
  return page.getByLabel('Formula bar', { exact: true });
}

// GIVEN: the visitor is on the home page and opens the seeded workbook Q3 Sales.
async function openSeededWorkbook(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Q3 Sales', exact: true }).click();
  await expect(grid(page)).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute(
    'aria-selected',
    'true'
  );
}

async function selectCell(page, coord) {
  await cell(page, coord).click();
}

// Enters an ordinary value or a formula through the "Formula bar" and commits with Enter.
async function enterInCell(page, coord, value) {
  await selectCell(page, coord);
  const bar = formulaBar(page);
  await bar.fill(value);
  await bar.press('Enter');
}

async function expectCellText(page, coord, text) {
  await expect(cell(page, coord)).toHaveText(text);
}

// Selects the cell and checks that the formula bar shows the original value/formula.
async function expectCellFormula(page, coord, formula) {
  await selectCell(page, coord);
  await expect(formulaBar(page)).toHaveValue(formula);
}

async function reloadEditor(page) {
  await page.reload();
  await expect(grid(page)).toBeVisible();
}

// ---------------------------------------------------------------------------
// REQ-4-1-1 - Calculate Basic Expressions and Aggregate Functions
// ---------------------------------------------------------------------------

test('REQ-4-1-1: REQ-4-1-1 -the requested workflow,the requested workflow', async ({ page }) => {
  await openSeededWorkbook(page);

  // GIVEN A1=2, B1=3 and the formulas =A1+B1 and =C1*2
  await enterInCell(page, 'A1', '2');
  await enterInCell(page, 'B1', '3');
  await enterInCell(page, 'C1', '=A1+B1');
  await enterInCell(page, 'D1', '=C1*2');

  // THEN the grid displays results calculated from the current source data
  await expectCellText(page, 'C1', '5');
  await expectCellText(page, 'D1', '10');
  // and the formula bar displays the original expression
  await expectCellFormula(page, 'C1', '=A1+B1');

  // THEN after refresh results and expressions persist
  await reloadEditor(page);
  await expectCellText(page, 'A1', '2');
  await expectCellText(page, 'B1', '3');
  await expectCellText(page, 'C1', '5');
  await expectCellText(page, 'D1', '10');
  await expectCellFormula(page, 'C1', '=A1+B1');
});

test('REQ-4-1-1#2: REQ-4-1-1 -the requested workflow', async ({ page }) => {
  await openSeededWorkbook(page);

  await enterInCell(page, 'A2', '10');
  await enterInCell(page, 'A3', '20');
  await enterInCell(page, 'A4', '30');
  await enterInCell(page, 'B2', '=SUM(A2:A4)');
  await enterInCell(page, 'C2', '=AVERAGE(A2:A4)');
  await enterInCell(page, 'D2', '=COUNT(A2:A4)');
  await enterInCell(page, 'E2', '=MIN(A2:A4)');
  await enterInCell(page, 'E3', '=MAX(A2:A4)');

  await expectCellText(page, 'B2', '60');
  await expectCellText(page, 'C2', '20');
  await expectCellText(page, 'D2', '3');
  await expectCellText(page, 'E2', '10');
  await expectCellText(page, 'E3', '30');
  await expectCellFormula(page, 'B2', '=SUM(A2:A4)');

  await reloadEditor(page);
  await expectCellText(page, 'B2', '60');
  await expectCellText(page, 'C2', '20');
  await expectCellText(page, 'D2', '3');
  await expectCellText(page, 'E2', '10');
  await expectCellText(page, 'E3', '30');
  await expectCellFormula(page, 'E3', '=MAX(A2:A4)');
});

test('REQ-4-1-1#3: REQ-4-1-1 -the requested workflow, the requested workflow', async ({ page }) => {
  await openSeededWorkbook(page);

  // B5 stays empty on purpose: blanks must not be treated as zero
  await enterInCell(page, 'A5', '2');
  await enterInCell(page, 'C5', '4');
  await enterInCell(page, 'D5', '=sum(a5:c5)');
  await enterInCell(page, 'E5', '=Average(A5:C5)');
  await enterInCell(page, 'B6', '=COUNT(A5:C5)');

  // function names are case-insensitive; blanks are ignored
  await expectCellText(page, 'D5', '6');
  await expectCellText(page, 'E5', '3');
  // COUNT counts only numeric cells
  await expectCellText(page, 'B6', '2');
  await expectCellFormula(page, 'D5', '=sum(a5:c5)');

  await reloadEditor(page);
  await expectCellText(page, 'D5', '6');
  await expectCellText(page, 'E5', '3');
  await expectCellText(page, 'B6', '2');
});

test('REQ-4-1-1#4: REQ-4-1-1 -the requested workflow', async ({ page }) => {
  await openSeededWorkbook(page);

  await enterInCell(page, 'A6', '=(2+3)*4');
  await enterInCell(page, 'B6', '=10-4/2');
  await enterInCell(page, 'C6', '=2+3*4');
  await enterInCell(page, 'D6', '=(10-2)/4');

  await expectCellText(page, 'A6', '20');
  await expectCellText(page, 'B6', '8');
  await expectCellText(page, 'C6', '14');
  await expectCellText(page, 'D6', '2');
  await expectCellFormula(page, 'D6', '=(10-2)/4');

  await reloadEditor(page);
  await expectCellText(page, 'A6', '20');
  await expectCellText(page, 'B6', '8');
  await expectCellText(page, 'C6', '14');
  await expectCellText(page, 'D6', '2');
  await expectCellFormula(page, 'D6', '=(10-2)/4');
});

test('REQ-4-1-1#5: REQ-4-1-1 -the requested workflow', async ({ page }) => {
  await openSeededWorkbook(page);

  // entered in the grid: double-click shows the inline text box "Edit A7"
  await cell(page, 'A7').dblclick();
  const editor = page.getByRole('textbox', { name: 'Edit A7', exact: true });
  await expect(editor).toBeVisible();
  await editor.fill('5');
  await editor.press('Enter');

  // entered through the formula bar
  await enterInCell(page, 'B7', '7');
  await enterInCell(page, 'C7', '=A7+B7');

  await expectCellText(page, 'A7', '5');
  await expectCellText(page, 'C7', '12');
  // grid, formula bar and selection stay consistent for the same cell
  await expectCellFormula(page, 'A7', '5');
  await expectCellFormula(page, 'B7', '7');
  await expectCellFormula(page, 'C7', '=A7+B7');

  await reloadEditor(page);
  await expectCellText(page, 'A7', '5');
  await expectCellText(page, 'B7', '7');
  await expectCellText(page, 'C7', '12');
  await expectCellFormula(page, 'C7', '=A7+B7');
});

// ---------------------------------------------------------------------------
// REQ-4-1-2 - Copy Formulas and Adjust Relative References
// ---------------------------------------------------------------------------

test('REQ-4-1-2: REQ-4-1-2 -the requested workflow', async ({ page }) => {
  await openSeededWorkbook(page);

  await enterInCell(page, 'A8', '2');
  await enterInCell(page, 'B8', '3');
  await enterInCell(page, 'C8', '=A8+B8');
  await expectCellText(page, 'C8', '5');

  // copy C8 and paste it one column to the right
  await selectCell(page, 'C8');
  await page.keyboard.press('Control+C');
  await selectCell(page, 'D8');
  await page.keyboard.press('Control+V');

  // relative references adjust by the target offset: =A8+B8 -> =B8+C8
  await expectCellText(page, 'D8', '8');
  await expectCellFormula(page, 'D8', '=B8+C8');
  // the source formula and result remain unchanged
  await expectCellText(page, 'C8', '5');
  await expectCellFormula(page, 'C8', '=A8+B8');

  await reloadEditor(page);
  await expectCellText(page, 'C8', '5');
  await expectCellText(page, 'D8', '8');
  await expectCellFormula(page, 'D8', '=B8+C8');
});

test('REQ-4-1-2#2: REQ-4-1-2 -the requested workflow', async ({ page }) => {
  await openSeededWorkbook(page);

  await enterInCell(page, 'A9', '2');
  await enterInCell(page, 'B9', '3');
  await enterInCell(page, 'C9', '=$A$9+$B$9');
  await expectCellText(page, 'C9', '5');

  // absolute references stay unchanged when the formula is copied
  await selectCell(page, 'C9');
  await page.keyboard.press('Control+C');
  await selectCell(page, 'E9');
  await page.keyboard.press('Control+V');
  await expectCellText(page, 'E9', '5');
  await expectCellFormula(page, 'E9', '=$A$9+$B$9');

  // a relative reference moved outside the worksheet bounds becomes #REF!
  await enterInCell(page, 'B10', '=A10+1');
  await selectCell(page, 'B10');
  await page.keyboard.press('Control+C');
  await selectCell(page, 'A10');
  await page.keyboard.press('Control+V');
  await expectCellText(page, 'A10', '#REF!');
  await selectCell(page, 'A10');
  await expect(formulaBar(page)).toHaveValue(/#REF!/);

  await reloadEditor(page);
  await expectCellText(page, 'A10', '#REF!');
  await expectCellText(page, 'E9', '5');
  await expectCellFormula(page, 'E9', '=$A$9+$B$9');
});

// ---------------------------------------------------------------------------
// REQ-4-2-1 - Recalculate Dependent Formulas After Source Data Changes
// ---------------------------------------------------------------------------

test('REQ-4-2-1: REQ-4-2-1 -the requested workflow,the requested workflow', async ({ page }) => {
  await openSeededWorkbook(page);

  await enterInCell(page, 'A1', '2');
  await enterInCell(page, 'B1', '3');
  await enterInCell(page, 'C1', '=A1+B1');
  await expectCellText(page, 'C1', '5');

  // source-value edit recalculates the dependent formula
  await enterInCell(page, 'A1', '10');
  await expectCellText(page, 'C1', '13');
  await expectCellFormula(page, 'C1', '=A1+B1');

  await reloadEditor(page);
  await expectCellText(page, 'A1', '10');
  await expectCellText(page, 'C1', '13');
  await expectCellFormula(page, 'C1', '=A1+B1');
});

test('REQ-4-2-1#2: REQ-4-2-1 -the requested workflow', async ({ page }) => {
  await openSeededWorkbook(page);

  // indirect dependency: C2 depends on B2 which depends on A2
  await enterInCell(page, 'A2', '2');
  await enterInCell(page, 'B2', '=A2*2');
  await enterInCell(page, 'C2', '=B2+1');
  await expectCellText(page, 'B2', '4');
  await expectCellText(page, 'C2', '5');

  await enterInCell(page, 'A2', '5');
  await expectCellText(page, 'B2', '10');
  await expectCellText(page, 'C2', '11');
  await expectCellFormula(page, 'C2', '=B2+1');

  await reloadEditor(page);
  await expectCellText(page, 'A2', '5');
  await expectCellText(page, 'B2', '10');
  await expectCellText(page, 'C2', '11');
  await expectCellFormula(page, 'B2', '=A2*2');
});

test('REQ-4-2-1#3: REQ-4-2-1 -the requested workflow', async ({ page }) => {
  await openSeededWorkbook(page);

  await enterInCell(page, 'A3', '1');
  await enterInCell(page, 'B3', '2');
  await enterInCell(page, 'C3', '=A3+B3');
  await expectCellText(page, 'C3', '3');

  // bulk paste over the source cells of the formula
  await page.evaluate((t) => navigator.clipboard.writeText(t), '7\t8');
  await selectCell(page, 'A3');
  await page.keyboard.press('Control+V');

  await expectCellText(page, 'A3', '7');
  await expectCellText(page, 'B3', '8');
  await expectCellText(page, 'C3', '15');
  await expectCellFormula(page, 'C3', '=A3+B3');

  await reloadEditor(page);
  await expectCellText(page, 'A3', '7');
  await expectCellText(page, 'B3', '8');
  await expectCellText(page, 'C3', '15');
  await expectCellFormula(page, 'C3', '=A3+B3');
});

// ---------------------------------------------------------------------------
// REQ-4-2-2 - Display and Fix Formula Errors
// ---------------------------------------------------------------------------

test('REQ-4-2-2: REQ-4-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await openSeededWorkbook(page);

  // division by zero
  await enterInCell(page, 'A4', '=1/0');
  await expectCellText(page, 'A4', '#DIV/0!');
  await expectCellFormula(page, 'A4', '=1/0');

  // an error cell does not block viewing, editing or recalculating other cells
  await enterInCell(page, 'B4', '=2+2');
  await expectCellText(page, 'B4', '4');

  await reloadEditor(page);
  await expectCellText(page, 'A4', '#DIV/0!');
  await expectCellFormula(page, 'A4', '=1/0');
  await expectCellText(page, 'B4', '4');
});

test('REQ-4-2-2#2: REQ-4-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await openSeededWorkbook(page);

  // circular reference
  await enterInCell(page, 'A5', '=A5+1');
  await expectCellText(page, 'A5', '#REF!');
  await expectCellFormula(page, 'A5', '=A5+1');

  // other cells can still be viewed, edited and recalculated
  await enterInCell(page, 'B5', '=1+1');
  await expectCellText(page, 'B5', '2');

  await reloadEditor(page);
  await expectCellText(page, 'A5', '#REF!');
  await expectCellFormula(page, 'A5', '=A5+1');
  await expectCellText(page, 'B5', '2');
});

test('REQ-4-2-2#3: REQ-4-2-2 -the requested workflow', async ({ page }) => {
  await openSeededWorkbook(page);

  // unsupported function
  await enterInCell(page, 'A6', '=FOO(1)');
  await expectCellText(page, 'A6', '#NAME?');
  await expectCellFormula(page, 'A6', '=FOO(1)');

  await reloadEditor(page);
  await expectCellText(page, 'A6', '#NAME?');
  await expectCellFormula(page, 'A6', '=FOO(1)');
});

test('REQ-4-2-2#4: REQ-4-2-2 -the requested workflow', async ({ page }) => {
  await openSeededWorkbook(page);

  // malformed expression
  await enterInCell(page, 'A7', '=1+');
  await expectCellText(page, 'A7', '#ERROR!');
  await expectCellFormula(page, 'A7', '=1+');

  await reloadEditor(page);
  await expectCellText(page, 'A7', '#ERROR!');
  await expectCellFormula(page, 'A7', '=1+');
});

test('REQ-4-2-2#5: REQ-4-2-2 -the requested workflow', async ({ page }) => {
  await openSeededWorkbook(page);

  await enterInCell(page, 'A8', '=1/0');
  await expectCellText(page, 'A8', '#DIV/0!');
  await enterInCell(page, 'B8', '=A8+1');

  // fix the error through the normal cell-editing flow
  await enterInCell(page, 'A8', '=4/2');
  await expectCellText(page, 'A8', '2');
  await expectCellFormula(page, 'A8', '=4/2');
  // the dependent result updates as well
  await expectCellText(page, 'B8', '3');
  await expectCellFormula(page, 'B8', '=A8+1');

  // the error no longer appears after refresh
  await reloadEditor(page);
  await expectCellText(page, 'A8', '2');
  await expectCellText(page, 'B8', '3');
  await expectCellFormula(page, 'A8', '=4/2');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });
test('REQ-4-2-1#audit-1: dependent formulas recalculate after a row insertion', async ({ page }) => {
  await openSeededWorkbook(page);

  await enterInCell(page, 'A1', '2');
  await enterInCell(page, 'A2', '3');
  await enterInCell(page, 'C1', '=A1+A2');
  await expectCellText(page, 'C1', '5');

  // row-number menu: insert a blank row above row 1
  await page.getByRole('rowheader', { name: '1', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 row above', exact: true }).click();

  // the record and the formula moved down together: result stays consistent with the source values
  await expectCellText(page, 'A2', '2');
  await expectCellText(page, 'A3', '3');
  await expectCellText(page, 'C2', '5');
  // the formula bar shows the original (adjusted) formula, not the result
  await expectCellFormula(page, 'C2', '=A2+A3');

  await reloadEditor(page);
  await expectCellText(page, 'A2', '2');
  await expectCellText(page, 'A3', '3');
  await expectCellText(page, 'C2', '5');
  await expectCellFormula(page, 'C2', '=A2+A3');
});

test('REQ-4-2-1#audit-2: formulas in another worksheet stay unchanged when source values change', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(grid(page)).toBeVisible();

  await enterInCell(page, 'A1', '2');
  await enterInCell(page, 'B1', '3');
  await enterInCell(page, 'C1', '=A1+B1');
  await expectCellText(page, 'C1', '5');

  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await enterInCell(page, 'A1', '=6*7');
  await expectCellText(page, 'A1', '42');

  // change the source value on Sheet1 and watch the dependent formula on Sheet1 only
  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await expectCellText(page, 'C1', '5');
  await enterInCell(page, 'A1', '10');
  await expectCellText(page, 'A1', '10');
  await expectCellText(page, 'C1', '13');

  // the other worksheet does not reference those source cells and is unchanged
  await page.getByRole('tab', { name: 'Sheet2', exact: true }).click();
  await expectCellText(page, 'A1', '42');

  await reloadEditor(page);
  await expectCellText(page, 'A1', '42');
  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await expectCellText(page, 'A1', '10');
  await expectCellText(page, 'C1', '13');
});

test('REQ-4-1-2#audit-1: copying a formula downward adjusts relative row references', async ({ page }) => {
  await openSeededWorkbook(page);

  await enterInCell(page, 'A1', '2');
  await enterInCell(page, 'B1', '3');
  await enterInCell(page, 'A2', '10');
  await enterInCell(page, 'B2', '20');
  await enterInCell(page, 'C1', '=A1+B1');
  await expectCellText(page, 'C1', '5');

  // copy the formula one row down
  await selectCell(page, 'C1');
  await page.keyboard.press('Control+C');
  await selectCell(page, 'C2');
  await page.keyboard.press('Control+V');

  // both row references shift by the target offset
  await expectCellText(page, 'C2', '30');
  await expectCellFormula(page, 'C2', '=A2+B2');
  // the source formula and result remain unchanged
  await expectCellText(page, 'C1', '5');
  await expectCellFormula(page, 'C1', '=A1+B1');

  await reloadEditor(page);
  await expectCellText(page, 'C2', '30');
  await expectCellText(page, 'C1', '5');
  await expectCellFormula(page, 'C2', '=A2+B2');
});

test('REQ-4-1-1#audit-1: aggregates ignore empty and non-numeric cells', async ({ page }) => {
  await openSeededWorkbook(page);

  await enterInCell(page, 'A1', '5');
  await enterInCell(page, 'A2', 'n/a');
  await enterInCell(page, 'A3', '8');
  // A4 is left empty on purpose

  await enterInCell(page, 'C1', '=MIN(A1:A4)');
  await enterInCell(page, 'D1', '=MAX(A1:A4)');
  await enterInCell(page, 'E1', '=SUM(A1:A4)');
  await enterInCell(page, 'F1', '=COUNT(A1:A4)');

  // blank and text are not treated as zero and are not counted
  await expectCellText(page, 'C1', '5');
  await expectCellText(page, 'D1', '8');
  await expectCellText(page, 'E1', '13');
  await expectCellText(page, 'F1', '2');
  await expectCellFormula(page, 'C1', '=MIN(A1:A4)');

  await reloadEditor(page);
  await expectCellText(page, 'C1', '5');
  await expectCellText(page, 'D1', '8');
  await expectCellText(page, 'E1', '13');
  await expectCellText(page, 'F1', '2');
});

test('REQ-4-2-2#audit-1: an indirect circular reference shows #REF! and can be fixed', async ({ page }) => {
  await openSeededWorkbook(page);

  await enterInCell(page, 'A1', '=B1+1');
  await enterInCell(page, 'B1', '=A1+1');

  await expectCellText(page, 'A1', '#REF!');
  await expectCellText(page, 'B1', '#REF!');
  // the formula bar still shows the original formula of the error cell
  await expectCellFormula(page, 'A1', '=B1+1');

  // break the cycle: B1 becomes an ordinary value and A1 recalculates
  await enterInCell(page, 'B1', '5');
  await expectCellText(page, 'B1', '5');
  await expectCellText(page, 'A1', '6');
  await expectCellFormula(page, 'A1', '=B1+1');

  await reloadEditor(page);
  await expectCellText(page, 'A1', '6');
  await expectCellText(page, 'B1', '5');
  await expectCellFormula(page, 'A1', '=B1+1');
});
