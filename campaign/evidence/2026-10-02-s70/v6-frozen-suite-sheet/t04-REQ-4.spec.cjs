const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const grid = (page) => page.getByRole('grid', { name: 'Worksheet grid', exact: true });
const cell = (page, coord) => grid(page).getByRole('gridcell', { name: coord, exact: true });
const formulaBar = (page) => page.getByRole('textbox', { name: 'Formula bar', exact: true });

// The home page lists workbooks as links named after the workbook.
async function openWorkbook(page) {
  await page.goto('/');
  const link = page.getByRole('link', { name: 'Q3 Sales', exact: true });
  await expect(link).toBeVisible();
  await link.click();
  await expect(grid(page)).toBeVisible();
}

async function selectCell(page, coord) {
  await cell(page, coord).click();
}

// Enter a value/formula through the "Formula bar" (REQ-3-1-1) and commit with Enter.
async function setCell(page, coord, value) {
  await selectCell(page, coord);
  const fb = formulaBar(page);
  await fb.click();
  await fb.fill(value);
  await fb.press('Enter');
}

// Enter a value/formula through the inline grid editor (REQ-3-1-1).
async function setCellInGrid(page, coord, value) {
  await cell(page, coord).dblclick();
  const editor = page.getByRole('textbox', { name: `Edit ${coord}`, exact: true });
  await editor.fill(value);
  await editor.press('Enter');
}

async function expectCell(page, coord, value) {
  await expect(cell(page, coord)).toHaveText(value);
}

// The editor entry is stable: reloading shows the same workbook and state.
async function reloadEditor(page) {
  await page.reload();
  await expect(grid(page)).toBeVisible();
}

// Add a worksheet (REQ-2-1-1); the new tab becomes active. Returns its visible name.
async function addWorksheet(page) {
  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
  const active = page.getByRole('tab', { selected: true });
  await expect(active).toHaveAttribute('aria-selected', 'true');
  const text = (await active.innerText()).trim();
  return text.split('\n')[0].trim();
}

// ---------------------------------------------------------------------------
// REQ-4-1-1 Calculate Basic Expressions and Aggregate Functions
// ---------------------------------------------------------------------------

test('REQ-4-1-1: REQ-4-1-1 -the requested workflow,the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await setCell(page, 'A1', '2');
  await setCell(page, 'B1', '3');
  await setCell(page, 'C1', '=A1+B1');

  // grid shows the result, formula bar shows the original formula
  await expectCell(page, 'C1', '5');
  await selectCell(page, 'C1');
  await expect(formulaBar(page)).toHaveValue('=A1+B1');

  // both persist after refresh
  await reloadEditor(page);
  await expectCell(page, 'C1', '5');
  await selectCell(page, 'C1');
  await expect(formulaBar(page)).toHaveValue('=A1+B1');
});

test('REQ-4-1-1#2: REQ-4-1-1 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await setCell(page, 'A2', '2');
  await setCell(page, 'B2', '3');
  // parentheses, addition, multiplication, subtraction and division
  await setCell(page, 'C2', '=((A2+B2)*2)-4/2');
  await expectCell(page, 'C2', '8');

  // a formula referencing another formula cell
  await setCell(page, 'D2', '=C2*2');
  await expectCell(page, 'D2', '16');

  await selectCell(page, 'C2');
  await expect(formulaBar(page)).toHaveValue('=((A2+B2)*2)-4/2');

  await reloadEditor(page);
  await expectCell(page, 'C2', '8');
  await expectCell(page, 'D2', '16');
  await selectCell(page, 'C2');
  await expect(formulaBar(page)).toHaveValue('=((A2+B2)*2)-4/2');
});

test('REQ-4-1-1#3: REQ-4-1-1 -the requested workflow, the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await setCell(page, 'A3', '10');
  await setCell(page, 'A4', '20');
  await setCell(page, 'A5', '30');

  await setCell(page, 'B3', '=SUM(A3:A5)');
  await setCell(page, 'B4', '=AVERAGE(A3:A5)');
  await setCell(page, 'B5', '=MIN(A3:A5)');
  await setCell(page, 'B6', '=MAX(A3:A5)');
  await setCell(page, 'B7', '=COUNT(A3:A5)');

  await expectCell(page, 'B3', '60');
  await expectCell(page, 'B4', '20');
  await expectCell(page, 'B5', '10');
  await expectCell(page, 'B6', '30');
  await expectCell(page, 'B7', '3');

  await reloadEditor(page);
  await expectCell(page, 'B3', '60');
  await expectCell(page, 'B4', '20');
  await expectCell(page, 'B5', '10');
  await expectCell(page, 'B6', '30');
  await expectCell(page, 'B7', '3');
  await selectCell(page, 'B4');
  await expect(formulaBar(page)).toHaveValue('=AVERAGE(A3:A5)');
});

test('REQ-4-1-1#4: REQ-4-1-1 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await setCell(page, 'A6', '5');
  await setCell(page, 'A7', '15');
  // A8 is left empty on purpose

  // function names are case-insensitive
  await setCell(page, 'C6', '=sum(A6:A8)');
  await setCell(page, 'C7', '=SuM(A6:A8)');
  await expectCell(page, 'C6', '20');
  await expectCell(page, 'C7', '20');

  // empty cells are ignored, not treated as zero (AVERAGE of 5 and 15 is 10)
  await setCell(page, 'C8', '=average(A6:A8)');
  await expectCell(page, 'C8', '10');

  // COUNT only counts numeric cells
  await setCell(page, 'C9', '=COUNT(A6:A8)');
  await expectCell(page, 'C9', '2');

  await reloadEditor(page);
  await expectCell(page, 'C6', '20');
  await expectCell(page, 'C7', '20');
  await expectCell(page, 'C8', '10');
  await expectCell(page, 'C9', '2');
});

test('REQ-4-1-1#5: REQ-4-1-1 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  // entered directly in the grid through the inline editor
  await setCellInGrid(page, 'A10', '7');
  await setCellInGrid(page, 'B10', '8');
  await setCellInGrid(page, 'C10', '=A10*B10');

  await expectCell(page, 'C10', '56');
  await selectCell(page, 'C10');
  await expect(formulaBar(page)).toHaveValue('=A10*B10');

  await reloadEditor(page);
  await expectCell(page, 'C10', '56');
  await selectCell(page, 'C10');
  await expect(formulaBar(page)).toHaveValue('=A10*B10');
});

// ---------------------------------------------------------------------------
// REQ-4-1-2 Copy Formulas and Adjust Relative References
// ---------------------------------------------------------------------------

test('REQ-4-1-2: REQ-4-1-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await setCell(page, 'A12', '2');
  await setCell(page, 'B12', '3');
  await setCell(page, 'C12', '=A12+B12');      // relative references
  await setCell(page, 'D12', '=$A$12+B12');    // absolute + relative
  await expectCell(page, 'C12', '5');
  await expectCell(page, 'D12', '5');

  await setCell(page, 'A14', '10');
  await setCell(page, 'B14', '20');

  // copy the relative formula one cell down / two rows down
  await selectCell(page, 'C12');
  await page.keyboard.press('Control+c');
  await selectCell(page, 'C14');
  await page.keyboard.press('Control+v');
  await expectCell(page, 'C14', '30');
  await selectCell(page, 'C14');
  await expect(formulaBar(page)).toHaveValue('=A14+B14');

  // copy the absolute + relative formula
  await selectCell(page, 'D12');
  await page.keyboard.press('Control+c');
  await selectCell(page, 'D14');
  await page.keyboard.press('Control+v');
  await expectCell(page, 'D14', '22');
  await selectCell(page, 'D14');
  await expect(formulaBar(page)).toHaveValue('=$A$12+B14');

  // source stays unchanged
  await expectCell(page, 'C12', '5');
  await selectCell(page, 'C12');
  await expect(formulaBar(page)).toHaveValue('=A12+B12');

  await reloadEditor(page);
  await expectCell(page, 'C14', '30');
  await expectCell(page, 'D14', '22');
  await selectCell(page, 'C14');
  await expect(formulaBar(page)).toHaveValue('=A14+B14');
  await selectCell(page, 'D14');
  await expect(formulaBar(page)).toHaveValue('=$A$12+B14');
});

test('REQ-4-1-2#2: REQ-4-1-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await setCell(page, 'A16', '5');
  await setCell(page, 'B16', '=A16');
  await expectCell(page, 'B16', '5');

  // copying one column to the left moves the relative reference outside the sheet -> #REF!
  await selectCell(page, 'B16');
  await page.keyboard.press('Control+c');
  await selectCell(page, 'A17');
  await cell(page, 'A17').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Paste', exact: true }).click();

  await expectCell(page, 'A17', '#REF!');
  await selectCell(page, 'A17');
  await expect(formulaBar(page)).toHaveValue('=#REF!');

  // source is unaffected
  await expectCell(page, 'B16', '5');
  await selectCell(page, 'B16');
  await expect(formulaBar(page)).toHaveValue('=A16');

  await reloadEditor(page);
  await expectCell(page, 'A17', '#REF!');
  await selectCell(page, 'A17');
  await expect(formulaBar(page)).toHaveValue('=#REF!');
  await expectCell(page, 'B16', '5');
});

// ---------------------------------------------------------------------------
// REQ-4-2-1 Recalculate Dependent Formulas After Source Data Changes
// ---------------------------------------------------------------------------

test('REQ-4-2-1: REQ-4-2-1 -the requested workflow,the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await setCell(page, 'A1', '2');
  await setCell(page, 'B1', '3');
  await setCell(page, 'C1', '=A1+B1');   // direct dependent
  await setCell(page, 'D1', '=C1*2');    // indirect dependent
  await expectCell(page, 'C1', '5');
  await expectCell(page, 'D1', '10');

  // change the source value
  await setCell(page, 'A1', '10');
  await expectCell(page, 'C1', '13');
  await expectCell(page, 'D1', '26');

  // each formula bar still shows the original formula
  await selectCell(page, 'C1');
  await expect(formulaBar(page)).toHaveValue('=A1+B1');
  await selectCell(page, 'D1');
  await expect(formulaBar(page)).toHaveValue('=C1*2');

  // new results persist after refresh
  await reloadEditor(page);
  await expectCell(page, 'C1', '13');
  await expectCell(page, 'D1', '26');
  await selectCell(page, 'C1');
  await expect(formulaBar(page)).toHaveValue('=A1+B1');
});

test('REQ-4-2-1#2: REQ-4-2-1 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  // a second worksheet whose formula does not reference the changed cells
  const otherSheet = await addWorksheet(page);
  await setCell(page, 'A1', '=5+5');
  await expectCell(page, 'A1', '10');
  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await expect(grid(page)).toBeVisible();

  await setCell(page, 'A18', '1');
  await setCell(page, 'D18', '=A18+1');   // direct dependent
  await setCell(page, 'E18', '=D18*2');   // indirect dependent
  await expectCell(page, 'D18', '2');
  await expectCell(page, 'E18', '4');

  // bulk paste a 2x2 rectangle over the source cell
  await page.evaluate((t) => navigator.clipboard.writeText(t), '5\t6\n7\t8');
  await selectCell(page, 'A18');
  await page.keyboard.press('Control+v');
  await expectCell(page, 'A18', '5');
  await expectCell(page, 'B18', '6');
  await expectCell(page, 'A19', '7');
  await expectCell(page, 'B19', '8');

  await expectCell(page, 'D18', '6');
  await expectCell(page, 'E18', '12');

  await reloadEditor(page);
  await expectCell(page, 'D18', '6');
  await expectCell(page, 'E18', '12');
  await selectCell(page, 'D18');
  await expect(formulaBar(page)).toHaveValue('=A18+1');

  // the other worksheet is unaffected
  await page.getByRole('tab', { name: otherSheet, exact: true }).click();
  await expect(grid(page)).toBeVisible();
  await expectCell(page, 'A1', '10');
});

test('REQ-4-2-1#3: REQ-4-2-1 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await setCell(page, 'A20', '5');
  await setCell(page, 'B20', '10');
  await setCell(page, 'C20', '=A20+B20');
  await expectCell(page, 'C20', '15');

  // insert a row above the target row: references and result follow the shift
  await grid(page).getByRole('rowheader', { name: '20', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 row above', exact: true }).click();

  await expectCell(page, 'C21', '15');
  await selectCell(page, 'C21');
  await expect(formulaBar(page)).toHaveValue('=A21+B21');

  await reloadEditor(page);
  await expectCell(page, 'C21', '15');
  await selectCell(page, 'C21');
  await expect(formulaBar(page)).toHaveValue('=A21+B21');
});

// ---------------------------------------------------------------------------
// REQ-4-2-2 Display and Fix Formula Errors
// ---------------------------------------------------------------------------

test('REQ-4-2-2: REQ-4-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await setCell(page, 'D12', '=1/0');
  await expectCell(page, 'D12', '#DIV/0!');
  await selectCell(page, 'D12');
  await expect(formulaBar(page)).toHaveValue('=1/0');

  // the error cell does not block other cells
  await setCell(page, 'C12', '=2+3');
  await expectCell(page, 'C12', '5');

  // error value and original formula persist after refresh
  await reloadEditor(page);
  await expectCell(page, 'D12', '#DIV/0!');
  await selectCell(page, 'D12');
  await expect(formulaBar(page)).toHaveValue('=1/0');

  // fix it: dependent result updates and the error is gone
  await setCell(page, 'E12', '=D12*10');
  await setCell(page, 'D12', '=10/2');
  await expectCell(page, 'D12', '5');
  await expectCell(page, 'E12', '50');
  await selectCell(page, 'D12');
  await expect(formulaBar(page)).toHaveValue('=10/2');

  await reloadEditor(page);
  await expectCell(page, 'D12', '5');
  await expectCell(page, 'E12', '50');
});

test('REQ-4-2-2#2: REQ-4-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  // unsupported function -> #NAME?
  await setCell(page, 'D13', '=FOO(1)');
  await expectCell(page, 'D13', '#NAME?');
  await selectCell(page, 'D13');
  await expect(formulaBar(page)).toHaveValue('=FOO(1)');

  await reloadEditor(page);
  await expectCell(page, 'D13', '#NAME?');
  await selectCell(page, 'D13');
  await expect(formulaBar(page)).toHaveValue('=FOO(1)');

  // fix it
  await setCell(page, 'D13', '=1+1');
  await expectCell(page, 'D13', '2');
  await selectCell(page, 'D13');
  await expect(formulaBar(page)).toHaveValue('=1+1');

  await reloadEditor(page);
  await expectCell(page, 'D13', '2');
});

test('REQ-4-2-2#3: REQ-4-2-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  // malformed expression -> #ERROR!
  await setCell(page, 'D14', '=1+');
  await expectCell(page, 'D14', '#ERROR!');
  await selectCell(page, 'D14');
  await expect(formulaBar(page)).toHaveValue('=1+');

  await reloadEditor(page);
  await expectCell(page, 'D14', '#ERROR!');
  await selectCell(page, 'D14');
  await expect(formulaBar(page)).toHaveValue('=1+');

  // fix it
  await setCell(page, 'D14', '=2*3');
  await expectCell(page, 'D14', '6');
  await selectCell(page, 'D14');
  await expect(formulaBar(page)).toHaveValue('=2*3');

  await reloadEditor(page);
  await expectCell(page, 'D14', '6');
});

test('REQ-4-2-2#4: REQ-4-2-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  // indirect circular reference -> #REF!
  await setCell(page, 'D15', '=E15');
  await setCell(page, 'E15', '=D15');
  await expectCell(page, 'D15', '#REF!');
  await expectCell(page, 'E15', '#REF!');
  await selectCell(page, 'D15');
  await expect(formulaBar(page)).toHaveValue('=E15');

  await reloadEditor(page);
  await expectCell(page, 'D15', '#REF!');
  await expectCell(page, 'E15', '#REF!');
  await selectCell(page, 'D15');
  await expect(formulaBar(page)).toHaveValue('=E15');

  // fixing the formula removes the error and recalculates the dependent cell
  await setCell(page, 'D15', '=5');
  await expectCell(page, 'D15', '5');
  await expectCell(page, 'E15', '5');

  await reloadEditor(page);
  await expectCell(page, 'E15', '5');
});

test('REQ-4-2-2#5: REQ-4-2-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  // A0 is an invalid A1-style reference -> #REF!
  await setCell(page, 'D16', '=A0');
  await expectCell(page, 'D16', '#REF!');
  await selectCell(page, 'D16');
  await expect(formulaBar(page)).toHaveValue('=A0');

  await reloadEditor(page);
  await expectCell(page, 'D16', '#REF!');
  await selectCell(page, 'D16');
  await expect(formulaBar(page)).toHaveValue('=A0');

  // fix it
  await setCell(page, 'D16', '=7');
  await expectCell(page, 'D16', '7');
  await selectCell(page, 'D16');
  await expect(formulaBar(page)).toHaveValue('=7');

  await reloadEditor(page);
  await expectCell(page, 'D16', '7');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

