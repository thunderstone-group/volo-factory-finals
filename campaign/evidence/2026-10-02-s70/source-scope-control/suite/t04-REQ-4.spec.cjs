const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const cell = (page, coord) => page.getByRole('gridcell', { name: coord, exact: true });
const formulaBar = (page) => page.getByLabel('Formula bar', { exact: true });
const menuItem = (page, name) => page.getByRole('menuitem', { name, exact: true });

// The seed contents a scenario assumes (A1=2, B1=3, formulas such as =A1+B1)
// are built by every test itself through the documented "New blank workbook"
// flow, so no test has to change or restore shared seed data.
async function newWorkbook(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1' })).toBeVisible();
}

async function selectCell(page, coord) {
  await cell(page, coord).click();
}

// ordinary value or formula typed through the "Formula bar" and committed with Enter
async function typeInCell(page, coord, value) {
  await selectCell(page, coord);
  await formulaBar(page).fill(value);
  await formulaBar(page).press('Enter');
}

// ordinary value or formula typed through the grid inline editor (double-click)
async function typeInGrid(page, coord, value) {
  await cell(page, coord).dblclick();
  const editor = page.getByRole('textbox', { name: `Edit ${coord}`, exact: true });
  await editor.fill(value);
  await editor.press('Enter');
}

async function expectCellText(page, coord, text) {
  await expect(cell(page, coord)).toHaveText(text);
}

async function expectFormula(page, coord, formula) {
  await selectCell(page, coord);
  await expect(formulaBar(page)).toHaveValue(formula);
}

async function copyCell(page, from, to) {
  await selectCell(page, from);
  await page.keyboard.press('Control+C');
  await selectCell(page, to);
  await page.keyboard.press('Control+V');
}

// ---------------------------------------------------------------------------
// REQ-4-1-1  Calculate Basic Expressions and Aggregate Functions
// ---------------------------------------------------------------------------

test('REQ-4-1-1: REQ-4-1-1 -the requested workflow,the requested workflow', async ({ page }) => {
  await newWorkbook(page);

  // source values in the grid
  await typeInCell(page, 'A1', '2');
  await typeInCell(page, 'B1', '3');
  await expectCellText(page, 'A1', '2');
  await expectCellText(page, 'B1', '3');

  // formula over A1-style references: grid shows the result, formula bar the expression
  await typeInCell(page, 'C1', '=A1+B1');
  await expectCellText(page, 'C1', '5');
  await expectFormula(page, 'C1', '=A1+B1');

  // formula depending on another formula cell
  await typeInCell(page, 'D1', '=C1*2');
  await expectCellText(page, 'D1', '10');
  await expectFormula(page, 'D1', '=C1*2');

  await page.reload();
  await expectCellText(page, 'C1', '5');
  await expectCellText(page, 'D1', '10');
  await expectFormula(page, 'C1', '=A1+B1');
  await expectFormula(page, 'D1', '=C1*2');
});

test('REQ-4-1-1#2: REQ-4-1-1 -the requested workflow', async ({ page }) => {
  await newWorkbook(page);

  await typeInCell(page, 'A1', '2');
  await typeInCell(page, 'B1', '3');

  // parentheses and multiplication
  await typeInCell(page, 'C1', '=(A1+B1)*2');
  await expectCellText(page, 'C1', '10');
  await expectFormula(page, 'C1', '=(A1+B1)*2');

  // subtraction, entered through the grid inline editor
  await typeInGrid(page, 'D1', '=B1-A1');
  await expectCellText(page, 'D1', '1');
  await expectFormula(page, 'D1', '=B1-A1');

  await typeInCell(page, 'E1', '=B1*A1');
  await expectCellText(page, 'E1', '6');

  await typeInCell(page, 'F1', '=B1/A1');
  await expectCellText(page, 'F1', '1.5');
  await expectFormula(page, 'F1', '=B1/A1');

  await page.reload();
  await expectCellText(page, 'C1', '10');
  await expectCellText(page, 'D1', '1');
  await expectCellText(page, 'E1', '6');
  await expectCellText(page, 'F1', '1.5');
});

test('REQ-4-1-1#3: REQ-4-1-1 -the requested workflow, the requested workflow', async ({ page }) => {
  await newWorkbook(page);

  await typeInCell(page, 'A1', '2');
  await typeInCell(page, 'A2', '4');
  await typeInCell(page, 'A3', '6');
  await typeInCell(page, 'A4', '8');

  // function names are case-insensitive
  await typeInCell(page, 'B1', '=sum(a1:a4)');
  await expectCellText(page, 'B1', '20');
  await expectFormula(page, 'B1', '=sum(a1:a4)');

  await typeInCell(page, 'B2', '=average(A1:A4)');
  await expectCellText(page, 'B2', '5');
  await expectFormula(page, 'B2', '=average(A1:A4)');

  await typeInCell(page, 'B3', '=Sum(A1:A4)');
  await expectCellText(page, 'B3', '20');

  await page.reload();
  await expectCellText(page, 'B1', '20');
  await expectCellText(page, 'B2', '5');
  await expectCellText(page, 'B3', '20');
  await expectFormula(page, 'B1', '=sum(a1:a4)');
});

test('REQ-4-1-1#4: REQ-4-1-1 -the requested workflow', async ({ page }) => {
  await newWorkbook(page);

  await typeInCell(page, 'A1', '1');
  await typeInCell(page, 'A2', '2');
  await typeInCell(page, 'A3', 'note');

  // COUNT counts only numeric cells, aggregates ignore blanks and text
  await typeInCell(page, 'B1', '=COUNT(A1:A4)');
  await expectCellText(page, 'B1', '2');
  await expectFormula(page, 'B1', '=COUNT(A1:A4)');

  await typeInCell(page, 'B2', '=SUM(A1:A4)');
  await expectCellText(page, 'B2', '3');

  await typeInCell(page, 'B3', '=AVERAGE(A1:A4)');
  await expectCellText(page, 'B3', '1.5');

  await typeInCell(page, 'B4', '=MIN(A1:A4)');
  await expectCellText(page, 'B4', '1');

  await typeInCell(page, 'B5', '=MAX(A1:A4)');
  await expectCellText(page, 'B5', '2');

  await page.reload();
  await expectCellText(page, 'B1', '2');
  await expectCellText(page, 'B2', '3');
  await expectCellText(page, 'B3', '1.5');
  await expectCellText(page, 'B4', '1');
  await expectCellText(page, 'B5', '2');
});

test('REQ-4-1-1#5: REQ-4-1-1 -the requested workflow', async ({ page }) => {
  await newWorkbook(page);

  await typeInCell(page, 'C1', '=(2+3)*4');
  await expectCellText(page, 'C1', '20');
  await expectFormula(page, 'C1', '=(2+3)*4');

  await typeInCell(page, 'C2', '=10-2*3');
  await expectCellText(page, 'C2', '4');

  await typeInCell(page, 'C3', '=100/4');
  await expectCellText(page, 'C3', '25');

  await typeInCell(page, 'C4', '=C1+C3');
  await expectCellText(page, 'C4', '45');
  await expectFormula(page, 'C4', '=C1+C3');

  await page.reload();
  await expectCellText(page, 'C1', '20');
  await expectCellText(page, 'C2', '4');
  await expectCellText(page, 'C3', '25');
  await expectCellText(page, 'C4', '45');
  await expectFormula(page, 'C1', '=(2+3)*4');
  await expectFormula(page, 'C4', '=C1+C3');
});

// ---------------------------------------------------------------------------
// REQ-4-1-2  Copy Formulas and Adjust Relative References
// ---------------------------------------------------------------------------

test('REQ-4-1-2: REQ-4-1-2 -the requested workflow', async ({ page }) => {
  await newWorkbook(page);

  await typeInCell(page, 'A1', '2');
  await typeInCell(page, 'B1', '3');
  await typeInCell(page, 'A2', '4');
  await typeInCell(page, 'B2', '5');

  await typeInCell(page, 'C1', '=A1+B1');
  await expectCellText(page, 'C1', '5');

  await typeInCell(page, 'D1', '=$A$1+B1');
  await expectCellText(page, 'D1', '5');

  // relative references adjust to the target offset
  await copyCell(page, 'C1', 'C2');
  await expectCellText(page, 'C2', '9');
  await expectFormula(page, 'C2', '=A2+B2');

  // absolute references stay unchanged
  await copyCell(page, 'D1', 'D2');
  await expectCellText(page, 'D2', '7');
  await expectFormula(page, 'D2', '=$A$1+B2');

  // source formula and result remain unchanged
  await expectCellText(page, 'C1', '5');
  await expectFormula(page, 'C1', '=A1+B1');
  await expectCellText(page, 'D1', '5');

  await page.reload();
  await expectCellText(page, 'C2', '9');
  await expectCellText(page, 'D2', '7');
  await expectFormula(page, 'C2', '=A2+B2');
  await expectFormula(page, 'D2', '=$A$1+B2');
});

test('REQ-4-1-2#2: REQ-4-1-2 -the requested workflow', async ({ page }) => {
  await newWorkbook(page);

  await typeInCell(page, 'A1', '2');
  await typeInCell(page, 'A2', '=A1');
  await expectCellText(page, 'A2', '2');

  // the copied formula is moved one row up, outside the worksheet bounds
  await copyCell(page, 'A2', 'A1');
  await expectCellText(page, 'A1', '#REF!');
  await expectFormula(page, 'A1', '=#REF!');

  await page.reload();
  await expectCellText(page, 'A1', '#REF!');
  await expectFormula(page, 'A1', '=#REF!');
});

// ---------------------------------------------------------------------------
// REQ-4-2-1  Recalculate Dependent Formulas After Source Data Changes
// ---------------------------------------------------------------------------

test('REQ-4-2-1: REQ-4-2-1 -the requested workflow,the requested workflow', async ({ page }) => {
  await newWorkbook(page);

  await typeInCell(page, 'A1', '2');
  await typeInCell(page, 'B1', '3');
  await typeInCell(page, 'C1', '=A1+B1');
  await typeInCell(page, 'D1', '=C1*2');
  await expectCellText(page, 'C1', '5');
  await expectCellText(page, 'D1', '10');

  // source value edit recalculates direct and indirect dependents
  await typeInCell(page, 'A1', '5');
  await expectCellText(page, 'C1', '8');
  await expectCellText(page, 'D1', '16');
  await expectFormula(page, 'C1', '=A1+B1');
  await expectFormula(page, 'D1', '=C1*2');

  await page.reload();
  await expectCellText(page, 'C1', '8');
  await expectCellText(page, 'D1', '16');
});

test('REQ-4-2-1#2: REQ-4-2-1 -the requested workflow', async ({ page }) => {
  await newWorkbook(page);

  await typeInCell(page, 'A1', '2');
  await typeInCell(page, 'B1', '3');
  await typeInCell(page, 'C1', '=A1+B1');
  await expectCellText(page, 'C1', '5');

  // bulk paste over the source cells recalculates the dependent formula
  await page.evaluate((t) => navigator.clipboard.writeText(t), '10\t20\n30\t40');
  await cell(page, 'A1').click({ button: 'right' });
  await menuItem(page, 'Paste').click();

  await expectCellText(page, 'A1', '10');
  await expectCellText(page, 'B1', '20');
  await expectCellText(page, 'A2', '30');
  await expectCellText(page, 'B2', '40');
  await expectCellText(page, 'C1', '30');
  await expectFormula(page, 'C1', '=A1+B1');

  await page.reload();
  await expectCellText(page, 'C1', '30');
  await expectCellText(page, 'A2', '30');
});

test('REQ-4-2-1#3: REQ-4-2-1 -the requested workflow', async ({ page }) => {
  await newWorkbook(page);

  await typeInCell(page, 'A1', '2');
  await typeInCell(page, 'B1', '3');
  await typeInCell(page, 'C1', '=A1+B1');
  await typeInCell(page, 'D1', '=C1*2');
  await expectCellText(page, 'C1', '5');
  await expectCellText(page, 'D1', '10');

  // shifting a row moves the referenced cells and adjusts the formulas with them
  await page.getByRole('rowheader', { name: '1', exact: true }).click({ button: 'right' });
  await menuItem(page, 'Insert 1 row above').click();

  await expectCellText(page, 'A2', '2');
  await expectCellText(page, 'B2', '3');
  await expectCellText(page, 'C2', '5');
  await expectCellText(page, 'D2', '10');
  await expectFormula(page, 'C2', '=A2+B2');
  await expectFormula(page, 'D2', '=C2*2');

  await page.reload();
  await expectCellText(page, 'A2', '2');
  await expectCellText(page, 'C2', '5');
  await expectCellText(page, 'D2', '10');
});

// ---------------------------------------------------------------------------
// REQ-4-2-2  Display and Fix Formula Errors
// ---------------------------------------------------------------------------

test('REQ-4-2-2: REQ-4-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await newWorkbook(page);

  await typeInCell(page, 'A1', '2');
  await typeInCell(page, 'B1', '0');
  await typeInCell(page, 'C1', '=A1/B1');
  await expectCellText(page, 'C1', '#DIV/0!');
  await expectFormula(page, 'C1', '=A1/B1');

  // the error cell does not block other cells
  await typeInCell(page, 'C2', '=A1+1');
  await expectCellText(page, 'C2', '3');

  await page.reload();
  await expectCellText(page, 'C1', '#DIV/0!');
  await expectFormula(page, 'C1', '=A1/B1');
  await expectCellText(page, 'C2', '3');
});

test('REQ-4-2-2#2: REQ-4-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await newWorkbook(page);

  // unsupported function
  await typeInCell(page, 'C1', '=FOO(A1:A2)');
  await expectCellText(page, 'C1', '#NAME?');
  await expectFormula(page, 'C1', '=FOO(A1:A2)');

  // malformed expression
  await typeInCell(page, 'D1', '=1+*2');
  await expectCellText(page, 'D1', '#ERROR!');
  await expectFormula(page, 'D1', '=1+*2');

  await page.reload();
  await expectCellText(page, 'C1', '#NAME?');
  await expectCellText(page, 'D1', '#ERROR!');
  await expectFormula(page, 'C1', '=FOO(A1:A2)');
  await expectFormula(page, 'D1', '=1+*2');
});

test('REQ-4-2-2#3: REQ-4-2-2 -the requested workflow', async ({ page }) => {
  await newWorkbook(page);

  await typeInCell(page, 'A1', '2');
  await typeInCell(page, 'C1', '=A1');
  await expectCellText(page, 'C1', '2');

  // copied one column to the left, the reference can no longer be preserved
  await copyCell(page, 'C1', 'B1');
  await expectCellText(page, 'B1', '#REF!');
  await expectFormula(page, 'B1', '=#REF!');

  // unrelated cells keep working next to the error cell
  await typeInCell(page, 'D1', '=1+1');
  await expectCellText(page, 'D1', '2');

  await page.reload();
  await expectCellText(page, 'B1', '#REF!');
  await expectFormula(page, 'B1', '=#REF!');
  await expectCellText(page, 'D1', '2');
});

test('REQ-4-2-2#4: REQ-4-2-2 -the requested workflow', async ({ page }) => {
  await newWorkbook(page);

  // direct circular reference
  await typeInCell(page, 'A1', '=A1+1');
  await expectCellText(page, 'A1', '#REF!');
  await expectFormula(page, 'A1', '=A1+1');

  // indirect circular reference
  await typeInCell(page, 'A2', '=B2');
  await typeInCell(page, 'B2', '=A2');
  await expectCellText(page, 'A2', '#REF!');
  await expectCellText(page, 'B2', '#REF!');
  await expectFormula(page, 'A2', '=B2');

  // other cells are still usable and calculate normally
  await typeInCell(page, 'C1', '=1+1');
  await expectCellText(page, 'C1', '2');

  await page.reload();
  await expectCellText(page, 'A1', '#REF!');
  await expectCellText(page, 'A2', '#REF!');
  await expectCellText(page, 'B2', '#REF!');
  await expectCellText(page, 'C1', '2');
  await expectFormula(page, 'A1', '=A1+1');
});

test('REQ-4-2-2#5: REQ-4-2-2 -the requested workflow', async ({ page }) => {
  await newWorkbook(page);

  await typeInCell(page, 'A1', '6');
  await typeInCell(page, 'B1', '0');
  await typeInCell(page, 'C1', '=A1/B1');
  await typeInCell(page, 'D1', '=C1*2');
  await expectCellText(page, 'C1', '#DIV/0!');
  await expectFormula(page, 'C1', '=A1/B1');

  // the erroneous formula is replaced by a valid one
  await typeInCell(page, 'C1', '=A1+4');
  await expectCellText(page, 'C1', '10');
  await expectFormula(page, 'C1', '=A1+4');
  await expectCellText(page, 'D1', '20');

  await page.reload();
  await expectCellText(page, 'C1', '10');
  await expectCellText(page, 'D1', '20');
  await expectFormula(page, 'C1', '=A1+4');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

