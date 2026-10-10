const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const grid = (page) => page.getByRole('grid', { name: 'Worksheet grid' });
const cell = (page, ref) => page.getByRole('gridcell', { name: ref, exact: true });
const formulaBar = (page) => page.getByLabel('Formula bar', { exact: true });

// The seeded workbook `Q3 Sales` is reached from the workbook home page.
async function openSeededWorkbook(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Q3 Sales', exact: true }).click();
  await expect(grid(page)).toBeVisible();
}

async function reloadEditor(page) {
  await page.reload();
  await expect(grid(page)).toBeVisible();
}

async function selectCell(page, ref) {
  await cell(page, ref).click();
}

// Enter a value or a formula through the text box labeled "Formula bar"
// and commit it with Enter.
async function setCell(page, ref, input) {
  await selectCell(page, ref);
  await formulaBar(page).fill(input);
  await formulaBar(page).press('Enter');
}

async function expectCellText(page, ref, text) {
  await expect(cell(page, ref)).toHaveText(text);
}

// Select the cell and check the formula bar content (original expression).
async function expectFormula(page, ref, formula) {
  await selectCell(page, ref);
  await expect(formulaBar(page)).toHaveValue(formula);
}

// Copy the currently selected cell/range and paste it at the target cell.
async function copyPaste(page, from, to) {
  await selectCell(page, from);
  await page.keyboard.press('Control+C');
  await selectCell(page, to);
  await page.keyboard.press('Control+V');
}

// ---------------------------------------------------------------------------
// REQ-4-1-1 Calculate Basic Expressions and Aggregate Functions
// ---------------------------------------------------------------------------

test('REQ-4-1-1: REQ-4-1-1 -the requested workflow,the requested workflow', async ({ page }) => {
  await openSeededWorkbook(page);
  await expectCellText(page, 'A1', '2');
  await expectCellText(page, 'B1', '3');

  // Enter a basic expression directly in the grid through the inline editor.
  await cell(page, 'J7').dblclick();
  const editor = page.getByLabel('Edit J7', { exact: true });
  await editor.fill('=A1+B1');
  await editor.press('Enter');

  await expectCellText(page, 'J7', '5');
  await expectFormula(page, 'J7', '=A1+B1');

  await reloadEditor(page);
  await expectCellText(page, 'J7', '5');
  await expectFormula(page, 'J7', '=A1+B1');
});

test('REQ-4-1-1#2: REQ-4-1-1 -the requested workflow', async ({ page }) => {
  await openSeededWorkbook(page);
  await expectCellText(page, 'A1', '2');

  // Enter a formula through the formula bar, commit it by clicking another cell.
  await selectCell(page, 'F8');
  await formulaBar(page).fill('=A1*3');
  await selectCell(page, 'G8');

  await expectCellText(page, 'F8', '6');
  await expectFormula(page, 'F8', '=A1*3');

  await reloadEditor(page);
  await expectCellText(page, 'F8', '6');
  await expectFormula(page, 'F8', '=A1*3');
});

test('REQ-4-1-1#3: REQ-4-1-1 -the requested workflow, the requested workflow', async ({ page }) => {
  await openSeededWorkbook(page);

  // Numeric constants, references, parentheses, subtraction, division, multiplication.
  await setCell(page, 'F9', '10');
  await setCell(page, 'G9', '4');
  await setCell(page, 'H9', '=(F9-G9)*2');
  await setCell(page, 'I9', '=F9/G9');

  await expectCellText(page, 'H9', '12');
  await expectCellText(page, 'I9', '2.5');
  await expectFormula(page, 'H9', '=(F9-G9)*2');
  await expectFormula(page, 'I9', '=F9/G9');

  await reloadEditor(page);
  await expectCellText(page, 'H9', '12');
  await expectCellText(page, 'I9', '2.5');
  await expectFormula(page, 'H9', '=(F9-G9)*2');
  await expectFormula(page, 'I9', '=F9/G9');
});

test('REQ-4-1-1#4: REQ-4-1-1 -the requested workflow', async ({ page }) => {
  await openSeededWorkbook(page);

  // F12 is intentionally left empty: aggregates must ignore empty cells.
  await setCell(page, 'F10', '10');
  await setCell(page, 'F11', '20');
  await setCell(page, 'F13', '30');
  await setCell(page, 'G10', '=SUM(F10:F13)');
  await setCell(page, 'G11', '=AVERAGE(F10:F13)');
  await setCell(page, 'G12', '=MIN(F10:F13)');
  await setCell(page, 'G13', '=MAX(F10:F13)');

  await expectCellText(page, 'G10', '60');
  await expectCellText(page, 'G11', '20');
  await expectCellText(page, 'G12', '10');
  await expectCellText(page, 'G13', '30');
  await expectFormula(page, 'G10', '=SUM(F10:F13)');

  await reloadEditor(page);
  await expectCellText(page, 'G10', '60');
  await expectCellText(page, 'G11', '20');
  await expectCellText(page, 'G12', '10');
  await expectCellText(page, 'G13', '30');
  await expectFormula(page, 'G11', '=AVERAGE(F10:F13)');
});

test('REQ-4-1-1#5: REQ-4-1-1 -the requested workflow', async ({ page }) => {
  await openSeededWorkbook(page);

  // F17 is empty, F15 holds text: COUNT counts numeric cells only,
  // SUM uses numeric cells only. Function names are case-insensitive.
  await setCell(page, 'F14', '5');
  await setCell(page, 'F15', 'North');
  await setCell(page, 'F16', '15');
  await setCell(page, 'G14', '=count(F14:F17)');
  await setCell(page, 'H14', '=SUM(F14:F17)');

  await expectCellText(page, 'G14', '2');
  await expectCellText(page, 'H14', '20');
  await expectFormula(page, 'G14', '=count(F14:F17)');
  await expectFormula(page, 'H14', '=SUM(F14:F17)');

  await reloadEditor(page);
  await expectCellText(page, 'G14', '2');
  await expectCellText(page, 'H14', '20');
  await expectFormula(page, 'G14', '=count(F14:F17)');
  await expectFormula(page, 'H14', '=SUM(F14:F17)');
});

// ---------------------------------------------------------------------------
// REQ-4-1-2 Copy Formulas and Adjust Relative References
// ---------------------------------------------------------------------------

test('REQ-4-1-2: REQ-4-1-2 -the requested workflow', async ({ page }) => {
  await openSeededWorkbook(page);

  await setCell(page, 'F18', '1');
  await setCell(page, 'G18', '2');
  await setCell(page, 'H18', '=F18+G18');
  await expectCellText(page, 'H18', '3');
  await setCell(page, 'F19', '10');
  await setCell(page, 'G19', '20');

  // Copy the formula one row down: relative references adjust by the offset.
  await copyPaste(page, 'H18', 'H19');

  await expectCellText(page, 'H19', '30');
  await expectFormula(page, 'H19', '=F19+G19');
  // The source formula and result are unchanged.
  await expectCellText(page, 'H18', '3');
  await expectFormula(page, 'H18', '=F18+G18');

  await reloadEditor(page);
  await expectCellText(page, 'H19', '30');
  await expectFormula(page, 'H19', '=F19+G19');
  await expectCellText(page, 'H18', '3');
  await expectFormula(page, 'H18', '=F18+G18');
});

test('REQ-4-1-2#2: REQ-4-1-2 -the requested workflow', async ({ page }) => {
  await openSeededWorkbook(page);

  await setCell(page, 'I20', '3');
  await setCell(page, 'J20', '4');
  await setCell(page, 'K20', '=$I$20+$J$20');
  await expectCellText(page, 'K20', '7');

  // Copy one row down: absolute references stay unchanged.
  await copyPaste(page, 'K20', 'K21');

  await expectCellText(page, 'K21', '7');
  await expectFormula(page, 'K21', '=$I$20+$J$20');
  await expectCellText(page, 'K20', '7');
  await expectFormula(page, 'K20', '=$I$20+$J$20');

  await reloadEditor(page);
  await expectCellText(page, 'K21', '7');
  await expectFormula(page, 'K21', '=$I$20+$J$20');
});

// ---------------------------------------------------------------------------
// REQ-4-2-1 Recalculate Dependent Formulas After Source Data Changes
// ---------------------------------------------------------------------------

test('REQ-4-2-1: REQ-4-2-1 -the requested workflow,the requested workflow', async ({ page }) => {
  await openSeededWorkbook(page);

  await setCell(page, 'I22', '4');
  await setCell(page, 'J22', '=I22*2');
  await expectCellText(page, 'J22', '8');

  // Source value edit recalculates the dependent formula.
  await setCell(page, 'I22', '10');
  await expectCellText(page, 'J22', '20');
  await expectFormula(page, 'J22', '=I22*2');

  await reloadEditor(page);
  await expectCellText(page, 'J22', '20');
  await expectFormula(page, 'J22', '=I22*2');
});

test('REQ-4-2-1#2: REQ-4-2-1 -the requested workflow', async ({ page }) => {
  await openSeededWorkbook(page);

  await setCell(page, 'I23', '2');
  await setCell(page, 'J23', '=I23+1');
  await setCell(page, 'K23', '=J23*2');
  await expectCellText(page, 'J23', '3');
  await expectCellText(page, 'K23', '6');

  // Indirect dependency updates in dependency order.
  await setCell(page, 'I23', '5');
  await expectCellText(page, 'J23', '6');
  await expectCellText(page, 'K23', '12');
  await expectFormula(page, 'K23', '=J23*2');

  await reloadEditor(page);
  await expectCellText(page, 'J23', '6');
  await expectCellText(page, 'K23', '12');
  await expectFormula(page, 'K23', '=J23*2');
});

test('REQ-4-2-1#3: REQ-4-2-1 -the requested workflow', async ({ page }) => {
  await openSeededWorkbook(page);

  await setCell(page, 'I24', '1');
  await setCell(page, 'J24', '=I24*10');
  await expectCellText(page, 'J24', '10');

  // Another worksheet with its own formula that does not reference the source cell.
  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
  const otherTab = page.getByRole('tab').last();
  await expect(otherTab).toHaveAttribute('aria-selected', 'true');
  await setCell(page, 'A1', '7');
  await setCell(page, 'B1', '=A1*3');
  await expectCellText(page, 'B1', '21');

  // Back to the worksheet holding the source cell.
  const sourceTab = page.getByRole('tab').first();
  await sourceTab.click();
  await expectCellText(page, 'I24', '1');

  // Bulk paste of a new source value: dependent formula recalculates.
  await page.evaluate((t) => navigator.clipboard.writeText(t), '5');
  await cell(page, 'I24').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Paste', exact: true }).click();
  await expectCellText(page, 'I24', '5');
  await expectCellText(page, 'J24', '50');
  await expectFormula(page, 'J24', '=I24*10');

  // The unrelated formula on the other worksheet is unchanged.
  await otherTab.click();
  await expectCellText(page, 'B1', '21');
  await expectFormula(page, 'B1', '=A1*3');

  await reloadEditor(page);
  await expectCellText(page, 'B1', '21');

  await sourceTab.click();
  await expectCellText(page, 'J24', '50');
});

// ---------------------------------------------------------------------------
// REQ-4-2-2 Display and Fix Formula Errors
// ---------------------------------------------------------------------------

test('REQ-4-2-2: REQ-4-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await openSeededWorkbook(page);

  await setCell(page, 'I25', '6');
  await setCell(page, 'J25', '0');
  await setCell(page, 'K25', '=I25/J25');
  await expectCellText(page, 'K25', '#DIV/0!');
  await expectFormula(page, 'K25', '=I25/J25');

  // An error cell does not block other cells.
  await setCell(page, 'L25', '3');
  await setCell(page, 'M25', '=L25*2');
  await expectCellText(page, 'M25', '6');

  await reloadEditor(page);
  await expectCellText(page, 'K25', '#DIV/0!');
  await expectFormula(page, 'K25', '=I25/J25');

  // Changing the error to a valid division removes the error.
  await setCell(page, 'J25', '3');
  await expectCellText(page, 'K25', '2');
  await expectFormula(page, 'K25', '=I25/J25');

  await reloadEditor(page);
  await expectCellText(page, 'K25', '2');
  await expectFormula(page, 'K25', '=I25/J25');
});

test('REQ-4-2-2#2: REQ-4-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await openSeededWorkbook(page);

  await setCell(page, 'I26', '8');
  await setCell(page, 'J26', '=I26');
  await expectCellText(page, 'J26', '8');

  // Pasting the formula one column to the left moves the relative reference
  // outside the worksheet bounds: invalid reference.
  await copyPaste(page, 'J26', 'I26');

  await expectCellText(page, 'I26', '#REF!');
  await expectFormula(page, 'I26', '=#REF!');

  await reloadEditor(page);
  await expectCellText(page, 'I26', '#REF!');
  await expectFormula(page, 'I26', '=#REF!');

  // Replacing the broken formula with a valid one removes the error.
  await setCell(page, 'I26', '=1+1');
  await expectCellText(page, 'I26', '2');

  await reloadEditor(page);
  await expectCellText(page, 'I26', '2');
  await expectFormula(page, 'I26', '=1+1');
});

test('REQ-4-2-2#3: REQ-4-2-2 -the requested workflow', async ({ page }) => {
  await openSeededWorkbook(page);

  await setCell(page, 'I27', '=NOTAFUNCTION(1)');
  await expectCellText(page, 'I27', '#NAME?');
  await expectFormula(page, 'I27', '=NOTAFUNCTION(1)');

  await reloadEditor(page);
  await expectCellText(page, 'I27', '#NAME?');
  await expectFormula(page, 'I27', '=NOTAFUNCTION(1)');

  await setCell(page, 'I27', '=1+1');
  await expectCellText(page, 'I27', '2');

  await reloadEditor(page);
  await expectCellText(page, 'I27', '2');
  await expectFormula(page, 'I27', '=1+1');
});

test('REQ-4-2-2#4: REQ-4-2-2 -the requested workflow', async ({ page }) => {
  await openSeededWorkbook(page);

  await setCell(page, 'I28', '=1+');
  await expectCellText(page, 'I28', '#ERROR!');
  await expectFormula(page, 'I28', '=1+');

  await reloadEditor(page);
  await expectCellText(page, 'I28', '#ERROR!');
  await expectFormula(page, 'I28', '=1+');

  await setCell(page, 'I28', '=2+3');
  await expectCellText(page, 'I28', '5');

  await reloadEditor(page);
  await expectCellText(page, 'I28', '5');
  await expectFormula(page, 'I28', '=2+3');
});

test('REQ-4-2-2#5: REQ-4-2-2 -the requested workflow', async ({ page }) => {
  await openSeededWorkbook(page);

  // Circular reference.
  await setCell(page, 'I29', '=J29');
  await setCell(page, 'J29', '=I29');

  await expectCellText(page, 'I29', '#REF!');
  await expectCellText(page, 'J29', '#REF!');
  await expectFormula(page, 'I29', '=J29');

  await reloadEditor(page);
  await expectCellText(page, 'I29', '#REF!');
  await expectCellText(page, 'J29', '#REF!');
  await expectFormula(page, 'J29', '=I29');

  // Breaking the circular reference removes the error.
  await setCell(page, 'J29', '5');
  await expectCellText(page, 'J29', '5');
  await expectCellText(page, 'I29', '5');
  await expectFormula(page, 'I29', '=J29');

  await reloadEditor(page);
  await expectCellText(page, 'I29', '5');
  await expectCellText(page, 'J29', '5');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

