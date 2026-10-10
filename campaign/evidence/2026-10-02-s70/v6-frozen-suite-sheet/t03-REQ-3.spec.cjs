const { test, expect } = require('@playwright/test');

const WORKBOOK = 'Q3 Sales';
const SHEET1 = 'Sheet1';

const grid = (page) => page.getByRole('grid', { name: 'Worksheet grid' });
const cell = (page, coordinate) => grid(page).getByRole('gridcell', { name: coordinate, exact: true });
const formulaBar = (page) => page.getByLabel('Formula bar', { exact: true });
const undoButton = (page) => page.getByRole('button', { name: 'Undo', exact: true });
const redoButton = (page) => page.getByRole('button', { name: 'Redo', exact: true });

// Home page -> editor, working on the seeded worksheet Sheet1.
async function openWorkbook(page) {
  await page.goto('/');
  await expect(page.getByRole('link', { name: WORKBOOK, exact: true })).toBeVisible();
  await page.getByRole('link', { name: WORKBOOK, exact: true }).click();
  await expect(grid(page)).toBeVisible();
  await page.getByRole('tab', { name: SHEET1, exact: true }).click();
  await expect(page.getByRole('tab', { name: SHEET1, exact: true })).toHaveAttribute('aria-selected', 'true');
}

// A cell is written through the visible "Formula bar" text box and committed with Enter.
async function enterValue(page, coordinate, value) {
  await cell(page, coordinate).click();
  await formulaBar(page).fill(value);
  await formulaBar(page).press('Enter');
}

// Seed worksheet content: A1:B1 = Item/Qty and A2:B2 = Pen/4, written through the documented controls.
async function seedItemsRange(page) {
  await enterValue(page, 'A1', 'Item');
  await enterValue(page, 'B1', 'Qty');
  await enterValue(page, 'A2', 'Pen');
  await enterValue(page, 'B2', '4');
  await expect(cell(page, 'A1')).toHaveText('Item');
  await expect(cell(page, 'B2')).toHaveText('4');
}

// Select a rectangle by dragging from one corner to the diagonally opposite cell.
async function dragSelect(page, from, to) {
  const start = await cell(page, from).boundingBox();
  const end = await cell(page, to).boundingBox();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 5 });
  await page.mouse.up();
}

async function setClipboard(page, text) {
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
}

async function pasteFromGridMenu(page, coordinate) {
  await cell(page, coordinate).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Paste', exact: true }).click();
}

// ---------------------------------------------------------------------------
// REQ-3-1-1 Edit a Cell Through the Grid or Formula Bar
// ---------------------------------------------------------------------------

test('REQ-3-1-1: REQ-3-1-1 -the requested workflow,the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  // Ordinary cell written through the grid itself, then shown consistently by grid and formula bar.
  await cell(page, 'A1').click();
  await formulaBar(page).fill('Item');
  await formulaBar(page).press('Enter');
  await expect(cell(page, 'A1')).toHaveText('Item');
  await cell(page, 'A1').click();
  await expect(formulaBar(page)).toHaveValue('Item');

  // Edit through the grid: double-click shows the inline text box "Edit <cell coordinate>".
  await cell(page, 'D1').dblclick();
  const inlineEditor = page.getByRole('textbox', { name: 'Edit D1', exact: true });
  await expect(inlineEditor).toBeVisible();
  await inlineEditor.fill('East');
  await inlineEditor.press('Enter');
  await expect(cell(page, 'D1')).toHaveText('East');
  await cell(page, 'D1').click();
  await expect(formulaBar(page)).toHaveValue('East');

  // Edit through the formula bar.
  await cell(page, 'D2').click();
  await formulaBar(page).fill('1200');
  await formulaBar(page).press('Enter');
  await expect(cell(page, 'D2')).toHaveText('1200');
  await cell(page, 'D2').click();
  await expect(formulaBar(page)).toHaveValue('1200');

  // Values persist after refresh.
  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(cell(page, 'D1')).toHaveText('East');
  await expect(cell(page, 'D2')).toHaveText('1200');
  await cell(page, 'D1').click();
  await expect(formulaBar(page)).toHaveValue('East');
});

test('REQ-3-1-1#2: REQ-3-1-1 -Escape the requested workflow,the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await enterValue(page, 'B2', '4');
  await expect(cell(page, 'B2')).toHaveText('4');

  // Escape cancels the uncommitted change made in the grid.
  await cell(page, 'B2').dblclick();
  const inlineEditor = page.getByRole('textbox', { name: 'Edit B2', exact: true });
  await expect(inlineEditor).toBeVisible();
  await inlineEditor.fill('999');
  await inlineEditor.press('Escape');

  await expect(cell(page, 'B2')).toHaveText('4');
  await cell(page, 'B2').click();
  await expect(formulaBar(page)).toHaveValue('4');

  await page.reload();
  await expect(cell(page, 'B2')).toHaveText('4');
});

test('REQ-3-1-1#3: REQ-3-1-1 -the requested workflow, the requested workflow, the requested workflow, the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  // A number committed by clicking another cell.
  await cell(page, 'D1').dblclick();
  const inlineEditor = page.getByRole('textbox', { name: 'Edit D1', exact: true });
  await expect(inlineEditor).toBeVisible();
  await inlineEditor.fill('2');
  await cell(page, 'A1').click();
  await expect(cell(page, 'D1')).toHaveText('2');

  await enterValue(page, 'D2', '4');

  // A formula cell: grid shows the calculated result, the formula bar the original formula.
  await enterValue(page, 'E1', '=D1*2');
  await expect(cell(page, 'E1')).toHaveText('4');
  await cell(page, 'E1').click();
  await expect(formulaBar(page)).toHaveValue('=D1*2');

  await enterValue(page, 'E2', '=SUM(D1:D2)');
  await expect(cell(page, 'E2')).toHaveText('6');

  // Dependent formulas update after the source value is committed.
  await enterValue(page, 'D1', '10');
  await expect(cell(page, 'E1')).toHaveText('20');
  await expect(cell(page, 'E2')).toHaveText('14');

  // Values, original formulas and results persist after refresh.
  await page.reload();
  await expect(cell(page, 'E1')).toHaveText('20');
  await expect(cell(page, 'E2')).toHaveText('14');
  await cell(page, 'E2').click();
  await expect(formulaBar(page)).toHaveValue('=SUM(D1:D2)');
});

test('REQ-3-1-1#4: REQ-3-1-1 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await enterValue(page, 'G1', '1200');
  await expect(cell(page, 'G1')).toHaveText('1200');
  await cell(page, 'G1').click();
  await expect(formulaBar(page)).toHaveValue('1200');

  await enterValue(page, 'G2', '2024-01-15');
  await expect(cell(page, 'G2')).toHaveText('2024-01-15');

  await page.reload();
  await expect(cell(page, 'G1')).toHaveText('1200');
  await expect(cell(page, 'G2')).toHaveText('2024-01-15');
  await cell(page, 'G2').click();
  await expect(formulaBar(page)).toHaveValue('2024-01-15');
});

// ---------------------------------------------------------------------------
// REQ-3-1-2 Paste Two-Dimensional Table Data
// ---------------------------------------------------------------------------

test('REQ-3-1-2: REQ-3-1-2 -the requested workflow B2 the requested workflow,the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  // Paste the whole rectangle through the grid context menu command "Paste".
  await setClipboard(page, 'East\t1200\nNorth\t800');
  await pasteFromGridMenu(page, 'B2');

  await expect(cell(page, 'B2')).toHaveText('East');
  await expect(cell(page, 'C2')).toHaveText('1200');
  await expect(cell(page, 'B3')).toHaveText('North');
  await expect(cell(page, 'C3')).toHaveText('800');

  await page.reload();
  await expect(cell(page, 'B2')).toHaveText('East');
  await expect(cell(page, 'C2')).toHaveText('1200');
  await expect(cell(page, 'B3')).toHaveText('North');
  await expect(cell(page, 'C3')).toHaveText('800');

  // Put the seeded cell B2 back to its documented value.
  await enterValue(page, 'B2', '4');
  await expect(cell(page, 'B2')).toHaveText('4');
});

test('REQ-3-1-2#2: REQ-3-1-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  // Ctrl+V pastes the same external clipboard content; empty fields are preserved.
  await setClipboard(page, 'East\t\t800');
  await cell(page, 'E5').click();
  await page.keyboard.press('Control+V');

  await expect(cell(page, 'E5')).toHaveText('East');
  await expect(cell(page, 'G5')).toHaveText('800');
  await cell(page, 'F5').click();
  await expect(formulaBar(page)).toHaveValue('');

  await page.reload();
  await expect(cell(page, 'E5')).toHaveText('East');
  await expect(cell(page, 'G5')).toHaveText('800');
});

test('REQ-3-1-2#3: REQ-3-1-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await enterValue(page, 'D7', '2');
  await enterValue(page, 'E7', '=D7*2');
  await expect(cell(page, 'E7')).toHaveText('4');
  await enterValue(page, 'F7', '=E7+1');
  await expect(cell(page, 'F7')).toHaveText('5');

  // Formulas inside the target rectangle are replaced and related formulas recalculate.
  await setClipboard(page, '5\t6');
  await cell(page, 'D7').click();
  await page.keyboard.press('Control+V');

  await expect(cell(page, 'D7')).toHaveText('5');
  await expect(cell(page, 'E7')).toHaveText('6');
  await expect(cell(page, 'F7')).toHaveText('7');
  await cell(page, 'E7').click();
  await expect(formulaBar(page)).toHaveValue('6');

  await page.reload();
  await expect(cell(page, 'E7')).toHaveText('6');
  await expect(cell(page, 'F7')).toHaveText('7');
});

test('REQ-3-1-2#4: REQ-3-1-2 -the requested workflow A1 the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await setClipboard(page, 'Alpha\tBeta\nGamma\tDelta');
  await pasteFromGridMenu(page, 'A1');

  await expect(cell(page, 'A1')).toHaveText('Alpha');
  await expect(cell(page, 'B1')).toHaveText('Beta');
  await expect(cell(page, 'A2')).toHaveText('Gamma');
  await expect(cell(page, 'B2')).toHaveText('Delta');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('Alpha');
  await expect(cell(page, 'B1')).toHaveText('Beta');
  await expect(cell(page, 'A2')).toHaveText('Gamma');
  await expect(cell(page, 'B2')).toHaveText('Delta');

  // Restore the seeded range A1:B2 = Item/Qty, Pen/4 through the documented paste flow.
  await setClipboard(page, 'Item\tQty\nPen\t4');
  await pasteFromGridMenu(page, 'A1');
  await expect(cell(page, 'A1')).toHaveText('Item');
  await expect(cell(page, 'B1')).toHaveText('Qty');
  await expect(cell(page, 'A2')).toHaveText('Pen');
  await expect(cell(page, 'B2')).toHaveText('4');
});

test('REQ-3-1-2#5: REQ-3-1-2 -the requested workflow C3 the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await setClipboard(page, 'South\t700\nWest\t900');
  await cell(page, 'C3').click();
  await page.keyboard.press('Control+V');

  await expect(cell(page, 'C3')).toHaveText('South');
  await expect(cell(page, 'D3')).toHaveText('700');
  await expect(cell(page, 'C4')).toHaveText('West');
  await expect(cell(page, 'D4')).toHaveText('900');

  await page.reload();
  await expect(cell(page, 'C3')).toHaveText('South');
  await expect(cell(page, 'D3')).toHaveText('700');
  await expect(cell(page, 'C4')).toHaveText('West');
  await expect(cell(page, 'D4')).toHaveText('900');
});

// ---------------------------------------------------------------------------
// REQ-3-1-3 Select a Rectangular Cell Range
// ---------------------------------------------------------------------------

test('REQ-3-1-3: REQ-3-1-3 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await expect(grid(page)).toHaveAttribute('aria-multiselectable', 'true');

  await dragSelect(page, 'D1', 'E2');
  await expect(cell(page, 'D1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'E1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'D2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'E2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'false');
  await expect(cell(page, 'C1')).toHaveAttribute('aria-selected', 'false');
  await expect(cell(page, 'E3')).toHaveAttribute('aria-selected', 'false');

  // The complete rectangle is restored after refresh.
  await page.reload();
  await expect(grid(page)).toBeVisible();
  await page.getByRole('tab', { name: SHEET1, exact: true }).click();
  await expect(cell(page, 'D1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'E1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'D2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'E2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'false');
  await expect(cell(page, 'C1')).toHaveAttribute('aria-selected', 'false');
  await expect(cell(page, 'E3')).toHaveAttribute('aria-selected', 'false');
});

test('REQ-3-1-3#2: REQ-3-1-3 -the requested workflow,the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  // A single cell selection, then a rectangle that replaces it.
  await cell(page, 'C3').click();
  await expect(cell(page, 'C3')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'false');

  await dragSelect(page, 'A1', 'B2');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'B1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'B2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'C3')).toHaveAttribute('aria-selected', 'false');

  // Working on another worksheet must not overwrite this worksheet's selection.
  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
  await expect(page.getByRole('tab', { selected: true })).not.toHaveText(SHEET1);
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'B2')).toHaveAttribute('aria-selected', 'false');

  await page.getByRole('tab', { name: SHEET1, exact: true }).click();
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'B1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'B2')).toHaveAttribute('aria-selected', 'true');

  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'B1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'B2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'C3')).toHaveAttribute('aria-selected', 'false');
});

// ---------------------------------------------------------------------------
// REQ-3-2-1 Copy, Cut, and Paste Cell Ranges
// ---------------------------------------------------------------------------

test('REQ-3-2-1: REQ-3-2-1 -the requested workflow A1:B2 the requested workflow D1:E2,the requested workflow, the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await seedItemsRange(page);

  // Copy A1:B2 and paste it at D1 (Ctrl+C / Ctrl+V).
  await dragSelect(page, 'A1', 'B2');
  await page.keyboard.press('Control+C');
  await cell(page, 'D1').click();
  await page.keyboard.press('Control+V');

  await expect(cell(page, 'D1')).toHaveText('Item');
  await expect(cell(page, 'E1')).toHaveText('Qty');
  await expect(cell(page, 'D2')).toHaveText('Pen');
  await expect(cell(page, 'E2')).toHaveText('4');

  // The source range stays unchanged after a copy.
  await expect(cell(page, 'A1')).toHaveText('Item');
  await expect(cell(page, 'B1')).toHaveText('Qty');
  await expect(cell(page, 'A2')).toHaveText('Pen');
  await expect(cell(page, 'B2')).toHaveText('4');

  await page.reload();
  await expect(cell(page, 'D1')).toHaveText('Item');
  await expect(cell(page, 'E1')).toHaveText('Qty');
  await expect(cell(page, 'D2')).toHaveText('Pen');
  await expect(cell(page, 'E2')).toHaveText('4');
});

test('REQ-3-2-1#2: REQ-3-2-1 -the requested workflow A1:B2 the requested workflow D1:E2,the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await seedItemsRange(page);

  // Cut A1:B2 and paste it at D1:E2; the source is cleared only once the target shows the content.
  await dragSelect(page, 'A1', 'B2');
  await page.keyboard.press('Control+X');
  await cell(page, 'D1').click();
  await page.keyboard.press('Control+V');

  await expect(cell(page, 'D1')).toHaveText('Item');
  await expect(cell(page, 'E1')).toHaveText('Qty');
  await expect(cell(page, 'D2')).toHaveText('Pen');
  await expect(cell(page, 'E2')).toHaveText('4');

  await cell(page, 'A1').click();
  await expect(formulaBar(page)).toHaveValue('');
  await cell(page, 'B2').click();
  await expect(formulaBar(page)).toHaveValue('');

  await page.reload();
  await expect(cell(page, 'D1')).toHaveText('Item');
  await expect(cell(page, 'E2')).toHaveText('4');
  await cell(page, 'A1').click();
  await expect(formulaBar(page)).toHaveValue('');

  // Move the seeded records back to A1:B2 through the same documented flow.
  await dragSelect(page, 'D1', 'E2');
  await page.keyboard.press('Control+X');
  await cell(page, 'A1').click();
  await page.keyboard.press('Control+V');
  await expect(cell(page, 'A1')).toHaveText('Item');
  await expect(cell(page, 'B1')).toHaveText('Qty');
  await expect(cell(page, 'A2')).toHaveText('Pen');
  await expect(cell(page, 'B2')).toHaveText('4');
});

test('REQ-3-2-1#3: REQ-3-2-1 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await enterValue(page, 'D1', '2');
  await enterValue(page, 'D2', '5');
  await enterValue(page, 'E1', '=D1*2');
  await enterValue(page, 'F1', '=$D$1+1');
  await expect(cell(page, 'E1')).toHaveText('4');
  await expect(cell(page, 'F1')).toHaveText('3');

  // Relative reference moves with the target offset, the source stays unchanged.
  await cell(page, 'E1').click();
  await page.keyboard.press('Control+C');
  await cell(page, 'E2').click();
  await page.keyboard.press('Control+V');
  await cell(page, 'E2').click();
  await expect(formulaBar(page)).toHaveValue('=D2*2');
  await expect(cell(page, 'E2')).toHaveText('10');
  await expect(cell(page, 'E1')).toHaveText('4');
  await cell(page, 'E1').click();
  await expect(formulaBar(page)).toHaveValue('=D1*2');

  // Absolute reference stays unchanged.
  await cell(page, 'F1').click();
  await page.keyboard.press('Control+C');
  await cell(page, 'F2').click();
  await page.keyboard.press('Control+V');
  await cell(page, 'F2').click();
  await expect(formulaBar(page)).toHaveValue('=$D$1+1');
  await expect(cell(page, 'F2')).toHaveText('3');
  await expect(cell(page, 'F1')).toHaveText('3');

  await page.reload();
  await expect(cell(page, 'E2')).toHaveText('10');
  await expect(cell(page, 'F2')).toHaveText('3');
  await cell(page, 'E2').click();
  await expect(formulaBar(page)).toHaveValue('=D2*2');
});

test('REQ-3-2-1#4: REQ-3-2-1 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await seedItemsRange(page);

  await enterValue(page, 'D1', '2');
  await enterValue(page, 'D2', '4');
  await enterValue(page, 'E1', '=D1*2');
  await enterValue(page, 'E2', '=D2*2');
  await expect(cell(page, 'E1')).toHaveText('4');
  await expect(cell(page, 'E2')).toHaveText('8');

  // The whole rectangle keeps its two-dimensional layout, formulas adjust to the new offset.
  await dragSelect(page, 'D1', 'E2');
  await page.keyboard.press('Control+C');
  await cell(page, 'G1').click();
  await page.keyboard.press('Control+V');

  await expect(cell(page, 'G1')).toHaveText('2');
  await expect(cell(page, 'H1')).toHaveText('4');
  await expect(cell(page, 'G2')).toHaveText('4');
  await expect(cell(page, 'H2')).toHaveText('8');
  await cell(page, 'H2').click();
  await expect(formulaBar(page)).toHaveValue('=G2*2');

  // Cells outside the source and target rectangles are unchanged.
  await expect(cell(page, 'D1')).toHaveText('2');
  await expect(cell(page, 'E1')).toHaveText('4');
  await expect(cell(page, 'A1')).toHaveText('Item');

  await page.reload();
  await expect(cell(page, 'H1')).toHaveText('4');
  await expect(cell(page, 'H2')).toHaveText('8');
  await cell(page, 'H2').click();
  await expect(formulaBar(page)).toHaveValue('=G2*2');
});

// ---------------------------------------------------------------------------
// REQ-3-2-2 Undo and Redo Recent Operations
// ---------------------------------------------------------------------------

test('REQ-3-2-2: REQ-3-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await enterValue(page, 'D1', '1');
  await expect(cell(page, 'D1')).toHaveText('1');
  await enterValue(page, 'D1', 'East');
  await expect(cell(page, 'D1')).toHaveText('East');

  await undoButton(page).click();
  await expect(cell(page, 'D1')).toHaveText('1');

  await page.reload();
  await expect(cell(page, 'D1')).toHaveText('1');
});

test('REQ-3-2-2#2: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await enterValue(page, 'D1', '1');
  await enterValue(page, 'D1', 'East');
  await expect(cell(page, 'D1')).toHaveText('East');

  await undoButton(page).click();
  await expect(cell(page, 'D1')).toHaveText('1');

  await redoButton(page).click();
  await expect(cell(page, 'D1')).toHaveText('East');

  await page.reload();
  await expect(cell(page, 'D1')).toHaveText('East');
});

test('REQ-3-2-2#3: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await enterValue(page, 'D1', '1');
  await enterValue(page, 'D1', 'East');
  await expect(cell(page, 'D1')).toHaveText('East');

  // Ctrl+Z and Ctrl+Y perform the same operations as the toolbar buttons.
  await cell(page, 'D1').click();
  await page.keyboard.press('Control+Z');
  await expect(cell(page, 'D1')).toHaveText('1');

  await page.keyboard.press('Control+Y');
  await expect(cell(page, 'D1')).toHaveText('East');

  await page.reload();
  await expect(cell(page, 'D1')).toHaveText('East');
});

test('REQ-3-2-2#4: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await enterValue(page, 'D1', '1');
  await enterValue(page, 'E1', '2');
  await expect(cell(page, 'D1')).toHaveText('1');
  await expect(cell(page, 'E1')).toHaveText('2');

  // A bulk paste is undone as one complete operation.
  await setClipboard(page, '7\t8');
  await cell(page, 'D1').click();
  await page.keyboard.press('Control+V');
  await expect(cell(page, 'D1')).toHaveText('7');
  await expect(cell(page, 'E1')).toHaveText('8');

  await undoButton(page).click();
  await expect(cell(page, 'D1')).toHaveText('1');
  await expect(cell(page, 'E1')).toHaveText('2');

  await page.reload();
  await expect(cell(page, 'D1')).toHaveText('1');
  await expect(cell(page, 'E1')).toHaveText('2');
});

test('REQ-3-2-2#5: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await enterValue(page, 'A2', 'Pen');
  await enterValue(page, 'B2', '4');
  await expect(cell(page, 'A2')).toHaveText('Pen');

  // Insert a row above row 2, then undo restores the row structure.
  await page.getByRole('rowheader', { name: '2', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 row above', exact: true }).click();
  await expect(cell(page, 'A3')).toHaveText('Pen');
  await expect(cell(page, 'B3')).toHaveText('4');
  await cell(page, 'A2').click();
  await expect(formulaBar(page)).toHaveValue('');

  await undoButton(page).click();
  await expect(cell(page, 'A2')).toHaveText('Pen');
  await expect(cell(page, 'B2')).toHaveText('4');

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('Pen');
  await expect(cell(page, 'B2')).toHaveText('4');
});

test('REQ-3-2-2#6: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await enterValue(page, 'D1', '1');
  await enterValue(page, 'D1', '2');
  await enterValue(page, 'D1', '3');
  await expect(cell(page, 'D1')).toHaveText('3');

  // Consecutive undos restore the changes in reverse order.
  await undoButton(page).click();
  await expect(cell(page, 'D1')).toHaveText('2');
  await undoButton(page).click();
  await expect(cell(page, 'D1')).toHaveText('1');

  await page.reload();
  await expect(cell(page, 'D1')).toHaveText('1');
});

test('REQ-3-2-2#7: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await enterValue(page, 'D1', '1');
  await enterValue(page, 'D1', '2');
  await undoButton(page).click();
  await expect(cell(page, 'D1')).toHaveText('1');
  await expect(redoButton(page)).toBeEnabled();

  // A new modification after an undo disables Redo and Ctrl+Y cannot restore the old branch.
  await enterValue(page, 'D1', '9');
  await expect(cell(page, 'D1')).toHaveText('9');
  await expect(redoButton(page)).toBeDisabled();

  await cell(page, 'D1').click();
  await page.keyboard.press('Control+Y');
  await expect(cell(page, 'D1')).toHaveText('9');

  await page.reload();
  await expect(cell(page, 'D1')).toHaveText('9');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

