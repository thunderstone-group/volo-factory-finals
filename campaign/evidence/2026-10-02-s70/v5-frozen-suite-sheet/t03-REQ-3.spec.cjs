const { test, expect } = require('@playwright/test');

const WORKBOOK_NAME = 'Q3 Sales';

// ---------------------------------------------------------------- helpers

function grid(page) {
  return page.getByRole('grid', { name: 'Worksheet grid', exact: true });
}

function cell(page, coord) {
  return page.getByRole('gridcell', { name: coord, exact: true });
}

function formulaBar(page) {
  return page.getByLabel('Formula bar', { exact: true });
}

function undoButton(page) {
  return page.getByRole('button', { name: 'Undo', exact: true });
}

function redoButton(page) {
  return page.getByRole('button', { name: 'Redo', exact: true });
}

async function openWorkbook(page) {
  await page.goto('/');
  const link = page.getByRole('link', { name: WORKBOOK_NAME, exact: true });
  await expect(link).toBeVisible();
  await link.click();
  await expect(grid(page)).toBeVisible();
}

async function reloadEditor(page) {
  await page.reload();
  await expect(grid(page)).toBeVisible();
}

async function selectCell(page, coord) {
  await cell(page, coord).click();
}

// Enters a value through the "Formula bar" text box and commits with Enter.
async function enterValue(page, coord, value) {
  await selectCell(page, coord);
  const fb = formulaBar(page);
  await fb.fill(value);
  await fb.press('Enter');
}

// Enters a value directly in the grid through the inline "Edit <cell>" text box.
async function enterValueInGrid(page, coord, value) {
  await cell(page, coord).dblclick();
  const editor = page.getByRole('textbox', { name: `Edit ${coord}`, exact: true });
  await expect(editor).toBeVisible();
  await editor.fill(value);
  await editor.press('Enter');
}

async function expectCellText(page, coord, text) {
  await expect(cell(page, coord)).toHaveText(text);
}

async function expectFormulaBarValue(page, coord, value) {
  await selectCell(page, coord);
  await expect(formulaBar(page)).toHaveValue(value);
}

// GIVEN data of REQ-3: range A1:B2 holding Item/Qty and Pen/4.
async function seedBaseRange(page) {
  await enterValue(page, 'A1', 'Item');
  await enterValue(page, 'B1', 'Qty');
  await enterValue(page, 'A2', 'Pen');
  await enterValue(page, 'B2', '4');
}

async function dragSelect(page, fromCoord, toCoord) {
  const from = await cell(page, fromCoord).boundingBox();
  const to = await cell(page, toCoord).boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 });
  await page.mouse.up();
}

async function copyRange(page) {
  await page.keyboard.press('Control+c');
}

async function cutRange(page) {
  await page.keyboard.press('Control+x');
}

async function pasteRange(page) {
  await page.keyboard.press('Control+v');
}

async function setClipboard(page, text) {
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
}

// ------------------------------------------------------ REQ-3-1-1 scenarios

test('REQ-3-1-1: REQ-3-1-1 -the requested workflow,the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  // Text entered through the formula bar, committed with Enter.
  await enterValue(page, 'D1', 'East');
  await expectCellText(page, 'D1', 'East');
  await expectFormulaBarValue(page, 'D1', 'East');

  // A number, committed by clicking another cell.
  await selectCell(page, 'D2');
  await formulaBar(page).fill('1200');
  await selectCell(page, 'A3');
  await expectCellText(page, 'D2', '1200');
  await expectFormulaBarValue(page, 'D2', '1200');

  // A formula cell: grid shows the result, formula bar shows the submitted formula.
  await enterValue(page, 'E1', '=D2*2');
  await expectCellText(page, 'E1', '2400');
  await expectFormulaBarValue(page, 'E1', '=D2*2');

  await reloadEditor(page);
  await expectCellText(page, 'D1', 'East');
  await expectCellText(page, 'D2', '1200');
  await expectCellText(page, 'E1', '2400');
  await expectFormulaBarValue(page, 'E1', '=D2*2');
});

test('REQ-3-1-1#2: REQ-3-1-1 -Escape the requested workflow,the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await enterValue(page, 'D1', 'Committed');
  await enterValue(page, 'D2', 'Original');

  // Escape cancels an uncommitted change made directly in the grid.
  await cell(page, 'D1').dblclick();
  const editor = page.getByRole('textbox', { name: 'Edit D1', exact: true });
  await expect(editor).toBeVisible();
  await editor.pressSequentially('XYZ');
  await editor.press('Escape');
  await expectCellText(page, 'D1', 'Committed');
  await expectFormulaBarValue(page, 'D1', 'Committed');

  // Escape cancels an uncommitted change made in the formula bar.
  await selectCell(page, 'D2');
  await formulaBar(page).fill('Discarded');
  await formulaBar(page).press('Escape');
  await expectCellText(page, 'D2', 'Original');
  await expectFormulaBarValue(page, 'D2', 'Original');

  await reloadEditor(page);
  await expectCellText(page, 'D1', 'Committed');
  await expectCellText(page, 'D2', 'Original');
});

test('REQ-3-1-1#3: REQ-3-1-1 -the requested workflow, the requested workflow, the requested workflow, the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  // Text.
  await enterValue(page, 'D1', 'Hello world');
  await expectCellText(page, 'D1', 'Hello world');
  await expectFormulaBarValue(page, 'D1', 'Hello world');

  // Number.
  await enterValue(page, 'D2', '42');
  await expectCellText(page, 'D2', '42');
  await expectFormulaBarValue(page, 'D2', '42');

  // Boolean-like value entered through the grid.
  await enterValueInGrid(page, 'E1', 'TRUE');
  await expectCellText(page, 'E1', 'TRUE');
  await expectFormulaBarValue(page, 'E1', 'TRUE');

  // Date text.
  await enterValue(page, 'E2', '2024-01-15');
  await expectCellText(page, 'E2', '2024-01-15');
  await expectFormulaBarValue(page, 'E2', '2024-01-15');

  // Formula beginning with an equals sign.
  await enterValue(page, 'F1', '=(1+2)*3');
  await expectCellText(page, 'F1', '9');
  await expectFormulaBarValue(page, 'F1', '=(1+2)*3');

  await reloadEditor(page);
  await expectCellText(page, 'D1', 'Hello world');
  await expectCellText(page, 'D2', '42');
  await expectCellText(page, 'E1', 'TRUE');
  await expectCellText(page, 'E2', '2024-01-15');
  await expectCellText(page, 'F1', '9');
  await expectFormulaBarValue(page, 'F1', '=(1+2)*3');
});

test('REQ-3-1-1#4: REQ-3-1-1 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await enterValue(page, 'D1', '2');
  await enterValue(page, 'E1', '3');
  await enterValue(page, 'D2', '=D1+E1');
  await enterValue(page, 'E2', '=D2*2');
  await expectCellText(page, 'D2', '5');
  await expectCellText(page, 'E2', '10');

  // Committing a new source value updates direct and indirect dependents.
  await enterValue(page, 'D1', '4');
  await expectCellText(page, 'D2', '7');
  await expectCellText(page, 'E2', '14');
  await expectFormulaBarValue(page, 'D2', '=D1+E1');
  await expectFormulaBarValue(page, 'E2', '=D2*2');

  await reloadEditor(page);
  await expectCellText(page, 'D2', '7');
  await expectCellText(page, 'E2', '14');
  await expectFormulaBarValue(page, 'D2', '=D1+E1');
});

// ------------------------------------------------------ REQ-3-1-2 scenarios

test('REQ-3-1-2: REQ-3-1-2 -the requested workflow B2 the requested workflow,the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await seedBaseRange(page);

  await setClipboard(page, 'East\t1200\nNorth\t800');
  await selectCell(page, 'B2');
  await pasteRange(page);

  await expectCellText(page, 'B2', 'East');
  await expectCellText(page, 'C2', '1200');
  await expectCellText(page, 'B3', 'North');
  await expectCellText(page, 'C3', '800');
  await expectCellText(page, 'A1', 'Item');
  await expectCellText(page, 'A2', 'Pen');

  await reloadEditor(page);
  await expectCellText(page, 'B2', 'East');
  await expectCellText(page, 'C2', '1200');
  await expectCellText(page, 'B3', 'North');
  await expectCellText(page, 'C3', '800');
});

test('REQ-3-1-2#2: REQ-3-1-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  // Empty fields inside the pasted rectangle are preserved.
  await setClipboard(page, '10\t\t30\n40\t\t60');
  await selectCell(page, 'D1');
  await pasteRange(page);

  await expectCellText(page, 'D1', '10');
  await expectCellText(page, 'E1', '');
  await expectCellText(page, 'F1', '30');
  await expectCellText(page, 'D2', '40');
  await expectCellText(page, 'E2', '');
  await expectCellText(page, 'F2', '60');

  await reloadEditor(page);
  await expectCellText(page, 'D1', '10');
  await expectCellText(page, 'E1', '');
  await expectCellText(page, 'F1', '30');
  await expectCellText(page, 'D2', '40');
  await expectCellText(page, 'E2', '');
  await expectCellText(page, 'F2', '60');
});

test('REQ-3-1-2#3: REQ-3-1-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await setClipboard(page, 'Alpha\tBeta\nGamma\tDelta');
  await selectCell(page, 'D1');
  await cell(page, 'D1').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Paste', exact: true }).click();

  await expectCellText(page, 'D1', 'Alpha');
  await expectCellText(page, 'E1', 'Beta');
  await expectCellText(page, 'D2', 'Gamma');
  await expectCellText(page, 'E2', 'Delta');

  await reloadEditor(page);
  await expectCellText(page, 'D1', 'Alpha');
  await expectCellText(page, 'E1', 'Beta');
  await expectCellText(page, 'D2', 'Gamma');
  await expectCellText(page, 'E2', 'Delta');
});

test('REQ-3-1-2#4: REQ-3-1-2 -the requested workflow A1 the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await enterValue(page, 'D1', 'Keep');
  await setClipboard(page, 'X\tY\nZ\tW');
  await selectCell(page, 'A1');
  await pasteRange(page);

  // Only the target rectangle is overwritten.
  await expectCellText(page, 'A1', 'X');
  await expectCellText(page, 'B1', 'Y');
  await expectCellText(page, 'A2', 'Z');
  await expectCellText(page, 'B2', 'W');
  await expectCellText(page, 'C1', '');
  await expectCellText(page, 'D1', 'Keep');

  await reloadEditor(page);
  await expectCellText(page, 'A1', 'X');
  await expectCellText(page, 'B1', 'Y');
  await expectCellText(page, 'A2', 'Z');
  await expectCellText(page, 'B2', 'W');
  await expectCellText(page, 'D1', 'Keep');
});

test('REQ-3-1-2#5: REQ-3-1-2 -the requested workflow C3 the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await enterValue(page, 'E1', '=C3*2');
  await setClipboard(page, '5\t6\n7\t8');
  await selectCell(page, 'C3');
  await pasteRange(page);

  await expectCellText(page, 'C3', '5');
  await expectCellText(page, 'D3', '6');
  await expectCellText(page, 'C4', '7');
  await expectCellText(page, 'D4', '8');
  // Related formula recalculated from the pasted content.
  await expectCellText(page, 'E1', '10');

  await reloadEditor(page);
  await expectCellText(page, 'C3', '5');
  await expectCellText(page, 'D3', '6');
  await expectCellText(page, 'C4', '7');
  await expectCellText(page, 'D4', '8');
  await expectCellText(page, 'E1', '10');
});

// ------------------------------------------------------ REQ-3-1-3 scenarios

test('REQ-3-1-3: REQ-3-1-3 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await expect(grid(page)).toHaveAttribute('aria-multiselectable', 'true');

  // Single cell selection.
  await selectCell(page, 'C3');
  await expect(cell(page, 'C3')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'false');

  // Drag from one corner to the diagonally opposite corner.
  await dragSelect(page, 'D1', 'E2');
  await expect(cell(page, 'D1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'E1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'D2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'E2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'C1')).toHaveAttribute('aria-selected', 'false');
  await expect(cell(page, 'D3')).toHaveAttribute('aria-selected', 'false');
  await expect(cell(page, 'C3')).toHaveAttribute('aria-selected', 'false');

  // Selecting another cell replaces the previous selection.
  await selectCell(page, 'A1');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'D1')).toHaveAttribute('aria-selected', 'false');
  await expect(cell(page, 'E1')).toHaveAttribute('aria-selected', 'false');
  await expect(cell(page, 'D2')).toHaveAttribute('aria-selected', 'false');
  await expect(cell(page, 'E2')).toHaveAttribute('aria-selected', 'false');
});

test('REQ-3-1-3#2: REQ-3-1-3 -the requested workflow,the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await dragSelect(page, 'D1', 'E2');
  await expect(cell(page, 'D1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'E2')).toHaveAttribute('aria-selected', 'true');

  // The complete rectangle is still selected after refresh.
  await reloadEditor(page);
  await expect(cell(page, 'D1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'E1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'D2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'E2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'false');
  await expect(cell(page, 'C3')).toHaveAttribute('aria-selected', 'false');

  // A new rectangular selection replaces the previous one and persists too.
  await dragSelect(page, 'A1', 'B2');
  await reloadEditor(page);
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'B1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'B2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'D1')).toHaveAttribute('aria-selected', 'false');
  await expect(cell(page, 'E2')).toHaveAttribute('aria-selected', 'false');
});

// ------------------------------------------------------ REQ-3-2-1 scenarios

test('REQ-3-2-1: REQ-3-2-1 -the requested workflow A1:B2 the requested workflow D1:E2,the requested workflow, the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await seedBaseRange(page);

  await dragSelect(page, 'A1', 'B2');
  await copyRange(page);
  await selectCell(page, 'D1');
  await pasteRange(page);

  await expectCellText(page, 'D1', 'Item');
  await expectCellText(page, 'E1', 'Qty');
  await expectCellText(page, 'D2', 'Pen');
  await expectCellText(page, 'E2', '4');
  // The copied source range is unchanged.
  await expectCellText(page, 'A1', 'Item');
  await expectCellText(page, 'B1', 'Qty');
  await expectCellText(page, 'A2', 'Pen');
  await expectCellText(page, 'B2', '4');

  await reloadEditor(page);
  await expectCellText(page, 'D1', 'Item');
  await expectCellText(page, 'E1', 'Qty');
  await expectCellText(page, 'D2', 'Pen');
  await expectCellText(page, 'E2', '4');
  await expectCellText(page, 'A1', 'Item');
  await expectCellText(page, 'B2', '4');
});

test('REQ-3-2-1#2: REQ-3-2-1 -the requested workflow A1:B2 the requested workflow D1:E2,the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await seedBaseRange(page);

  await dragSelect(page, 'A1', 'B2');
  await cutRange(page);
  // The source is only cleared once the target range has been displayed.
  await expectCellText(page, 'A1', 'Item');
  await expectCellText(page, 'B2', '4');

  await selectCell(page, 'D1');
  await pasteRange(page);

  await expectCellText(page, 'D1', 'Item');
  await expectCellText(page, 'E1', 'Qty');
  await expectCellText(page, 'D2', 'Pen');
  await expectCellText(page, 'E2', '4');
  await expectCellText(page, 'A1', '');
  await expectCellText(page, 'B1', '');
  await expectCellText(page, 'A2', '');
  await expectCellText(page, 'B2', '');

  await reloadEditor(page);
  await expectCellText(page, 'D1', 'Item');
  await expectCellText(page, 'E2', '4');
  await expectCellText(page, 'A1', '');
  await expectCellText(page, 'B1', '');
});

test('REQ-3-2-1#3: REQ-3-2-1 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await enterValue(page, 'D1', '2');
  await enterValue(page, 'E1', '3');
  await enterValue(page, 'D2', '=D1+E1');
  await enterValue(page, 'E2', '=D1*E1');
  await expectCellText(page, 'D2', '5');
  await expectCellText(page, 'E2', '6');

  await dragSelect(page, 'D1', 'E2');
  await copyRange(page);
  await selectCell(page, 'D4');
  await pasteRange(page);

  await expectCellText(page, 'D4', '2');
  await expectCellText(page, 'E4', '3');
  await expectCellText(page, 'D5', '5');
  await expectCellText(page, 'E5', '6');
  // Relative references adjust to the target offset.
  await expectFormulaBarValue(page, 'D5', '=D4+E4');
  await expectFormulaBarValue(page, 'E5', '=D4*E4');
  // Source formulas and results are unchanged.
  await expectCellText(page, 'D2', '5');
  await expectCellText(page, 'E2', '6');
  await expectFormulaBarValue(page, 'D2', '=D1+E1');

  await reloadEditor(page);
  await expectCellText(page, 'D5', '5');
  await expectCellText(page, 'E5', '6');
  await expectFormulaBarValue(page, 'D5', '=D4+E4');
});

test('REQ-3-2-1#4: REQ-3-2-1 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await enterValue(page, 'G1', 'Stay');
  await enterValue(page, 'D1', '2');
  await enterValue(page, 'E1', '3');
  await enterValue(page, 'D2', '=D1+E1');
  await enterValue(page, 'E2', '=D1*E1');

  await dragSelect(page, 'D1', 'E2');
  await cutRange(page);
  await selectCell(page, 'D4');
  await pasteRange(page);

  await expectCellText(page, 'D4', '2');
  await expectCellText(page, 'E4', '3');
  await expectCellText(page, 'D5', '5');
  await expectCellText(page, 'E5', '6');
  await expectFormulaBarValue(page, 'D5', '=D4+E4');
  await expectCellText(page, 'D1', '');
  await expectCellText(page, 'E1', '');
  await expectCellText(page, 'D2', '');
  await expectCellText(page, 'E2', '');
  // Cells outside the ranges are untouched.
  await expectCellText(page, 'G1', 'Stay');

  await reloadEditor(page);
  await expectCellText(page, 'D4', '2');
  await expectCellText(page, 'E5', '6');
  await expectCellText(page, 'D1', '');
  await expectCellText(page, 'G1', 'Stay');
});

// ------------------------------------------------------ REQ-3-2-2 scenarios

test('REQ-3-2-2: REQ-3-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await enterValue(page, 'D1', 'Base');
  await enterValue(page, 'D1', 'One');
  await expectCellText(page, 'D1', 'One');

  await undoButton(page).click();
  await expectCellText(page, 'D1', 'Base');

  await reloadEditor(page);
  await expectCellText(page, 'D1', 'Base');
});

test('REQ-3-2-2#2: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await enterValue(page, 'D1', 'Base1');
  await enterValue(page, 'D2', 'Base2');
  await enterValue(page, 'D1', 'X1');
  await enterValue(page, 'D2', 'X2');

  // Consecutive undos restore the changes in reverse order.
  await undoButton(page).click();
  await expectCellText(page, 'D2', 'Base2');
  await expectCellText(page, 'D1', 'X1');
  await undoButton(page).click();
  await expectCellText(page, 'D1', 'Base1');

  // Redo reapplies the whole undone operation.
  await redoButton(page).click();
  await expectCellText(page, 'D1', 'X1');
  await redoButton(page).click();
  await expectCellText(page, 'D2', 'X2');

  await reloadEditor(page);
  await expectCellText(page, 'D1', 'X1');
  await expectCellText(page, 'D2', 'X2');
});

test('REQ-3-2-2#3: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await enterValue(page, 'D1', 'Base');
  await enterValue(page, 'D1', 'Changed');
  await expectCellText(page, 'D1', 'Changed');

  await selectCell(page, 'D1');
  await page.keyboard.press('Control+z');
  await expectCellText(page, 'D1', 'Base');

  await reloadEditor(page);
  await expectCellText(page, 'D1', 'Base');
});

test('REQ-3-2-2#4: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await enterValue(page, 'D1', 'Base');
  await enterValue(page, 'D1', 'Changed');

  await selectCell(page, 'D1');
  await page.keyboard.press('Control+z');
  await expectCellText(page, 'D1', 'Base');

  await page.keyboard.press('Control+y');
  await expectCellText(page, 'D1', 'Changed');

  await reloadEditor(page);
  await expectCellText(page, 'D1', 'Changed');
});

test('REQ-3-2-2#5: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await enterValue(page, 'D1', 'Keep1');
  await enterValue(page, 'E1', 'Keep2');
  await enterValue(page, 'D2', 'Keep3');
  await enterValue(page, 'E2', 'Keep4');

  await setClipboard(page, 'P1\tP2\nP3\tP4');
  await selectCell(page, 'D1');
  await pasteRange(page);
  await expectCellText(page, 'D1', 'P1');
  await expectCellText(page, 'E1', 'P2');
  await expectCellText(page, 'D2', 'P3');
  await expectCellText(page, 'E2', 'P4');

  await undoButton(page).click();
  await expectCellText(page, 'D1', 'Keep1');
  await expectCellText(page, 'E1', 'Keep2');
  await expectCellText(page, 'D2', 'Keep3');
  await expectCellText(page, 'E2', 'Keep4');

  await reloadEditor(page);
  await expectCellText(page, 'D1', 'Keep1');
  await expectCellText(page, 'E1', 'Keep2');
  await expectCellText(page, 'D2', 'Keep3');
  await expectCellText(page, 'E2', 'Keep4');
});

test('REQ-3-2-2#6: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await enterValue(page, 'A3', 'R3');
  await enterValue(page, 'A4', 'R4');

  await page.getByRole('rowheader', { name: '3', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 row above', exact: true }).click();
  await expectCellText(page, 'A3', '');
  await expectCellText(page, 'A4', 'R3');
  await expectCellText(page, 'A5', 'R4');

  await undoButton(page).click();
  await expectCellText(page, 'A3', 'R3');
  await expectCellText(page, 'A4', 'R4');

  await reloadEditor(page);
  await expectCellText(page, 'A3', 'R3');
  await expectCellText(page, 'A4', 'R4');
});

test('REQ-3-2-2#7: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await enterValue(page, 'D1', 'Base');
  await enterValue(page, 'D1', 'Changed');
  await undoButton(page).click();
  await expectCellText(page, 'D1', 'Base');

  // A new modification after an undo disables Redo.
  await enterValue(page, 'D1', 'New');
  await expect(redoButton(page)).toBeDisabled();

  await selectCell(page, 'D1');
  await page.keyboard.press('Control+y');
  await expectCellText(page, 'D1', 'New');

  await reloadEditor(page);
  await expectCellText(page, 'D1', 'New');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

