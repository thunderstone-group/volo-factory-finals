// Acceptance tests for REQ-3 (Cell and Range Editing).
// Seed state used by these scenarios: workbook "Q3 Sales", worksheet "Sheet1",
// range A1:B2 containing "Item"/"Qty" (row 1) and "Pen"/"4" (row 2),
// and target range D1:E2 in the same worksheet.

const { test, expect } = require('@playwright/test');

const WORKBOOK = 'Q3 Sales';

const cell = (page, coord) => page.getByRole('gridcell', { name: coord, exact: true });
const formulaBar = (page) => page.getByLabel('Formula bar', { exact: true });
const grid = (page) => page.getByRole('grid', { name: 'Worksheet grid', exact: true });
const undoButton = (page) => page.getByRole('button', { name: 'Undo', exact: true });
const redoButton = (page) => page.getByRole('button', { name: 'Redo', exact: true });

async function openWorkbook(page) {
  await page.goto('/');
  const link = page.getByRole('link', { name: WORKBOOK, exact: true });
  await expect(link).toBeVisible();
  await link.click();
  await expect(grid(page)).toBeVisible();
}

async function reloadEditor(page) {
  await page.reload();
  await expect(grid(page)).toBeVisible();
}

// Enters a value the way REQ-3-1-1 describes: select the cell, type in the
// text box labeled "Formula bar", commit with Enter.
async function writeCell(page, coord, value) {
  await cell(page, coord).click();
  await formulaBar(page).fill(value);
  await formulaBar(page).press('Enter');
}

async function expectFormula(page, coord, value) {
  await cell(page, coord).click();
  await expect(formulaBar(page)).toHaveValue(value);
}

// Selects a rectangular region by dragging from one corner to the opposite one.
async function dragSelect(page, from, to) {
  const a = await cell(page, from).boundingBox();
  const b = await cell(page, to).boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
  await page.mouse.up();
}

async function setClipboard(page, text) {
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
}

test('REQ-3-1-1: REQ-3-1-1 -the requested workflow,the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  // Seeded source range.
  await expect(cell(page, 'A1')).toHaveText('Item');
  await expect(cell(page, 'B1')).toHaveText('Qty');
  await expect(cell(page, 'A2')).toHaveText('Pen');
  await expect(cell(page, 'B2')).toHaveText('4');

  // Enter the target range values through the formula bar.
  await writeCell(page, 'D1', 'East');
  await writeCell(page, 'E1', '1200');
  await writeCell(page, 'D2', 'North');
  await writeCell(page, 'E2', '800');

  await expect(cell(page, 'D1')).toHaveText('East');
  await expect(cell(page, 'E1')).toHaveText('1200');
  await expect(cell(page, 'D2')).toHaveText('North');
  await expect(cell(page, 'E2')).toHaveText('800');
  await expectFormula(page, 'D1', 'East');

  await reloadEditor(page);
  await expect(cell(page, 'A1')).toHaveText('Item');
  await expect(cell(page, 'B2')).toHaveText('4');
  await expect(cell(page, 'D1')).toHaveText('East');
  await expect(cell(page, 'E1')).toHaveText('1200');
  await expect(cell(page, 'D2')).toHaveText('North');
  await expect(cell(page, 'E2')).toHaveText('800');
});

test('REQ-3-1-1#2: REQ-3-1-1 -Escape the requested workflow,the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  // Inline grid editor: Escape cancels the uncommitted change.
  await cell(page, 'A2').dblclick();
  const editor = page.getByRole('textbox', { name: 'Edit A2', exact: true });
  await expect(editor).toBeVisible();
  await editor.fill('Pencil');
  await editor.press('Escape');
  await expect(cell(page, 'A2')).toHaveText('Pen');

  // Formula bar: Escape cancels the uncommitted change.
  await cell(page, 'B2').click();
  await expect(formulaBar(page)).toHaveValue('4');
  await formulaBar(page).fill('99');
  await formulaBar(page).press('Escape');
  await cell(page, 'A1').click();
  await expect(cell(page, 'B2')).toHaveText('4');
  await expectFormula(page, 'B2', '4');

  await reloadEditor(page);
  await expect(cell(page, 'A2')).toHaveText('Pen');
  await expect(cell(page, 'B2')).toHaveText('4');
});

test('REQ-3-1-1#3: REQ-3-1-1 -the requested workflow, the requested workflow, the requested workflow, the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  // Text, number, boolean-like and date text values.
  await writeCell(page, 'D1', 'North');
  await writeCell(page, 'E1', '1200');
  await writeCell(page, 'D2', 'TRUE');
  await writeCell(page, 'E2', '2024-01-15');

  // Commit through the grid inline editor by clicking another cell.
  await cell(page, 'D1').dblclick();
  const editor = page.getByRole('textbox', { name: 'Edit D1', exact: true });
  await expect(editor).toBeVisible();
  await editor.fill('East');
  await cell(page, 'E2').click();

  await expect(cell(page, 'D1')).toHaveText('East');
  await expect(cell(page, 'E1')).toHaveText('1200');
  await expect(cell(page, 'D2')).toHaveText('TRUE');
  await expect(cell(page, 'E2')).toHaveText('2024-01-15');
  await expectFormula(page, 'D1', 'East');

  await reloadEditor(page);
  await expect(cell(page, 'D1')).toHaveText('East');
  await expect(cell(page, 'E1')).toHaveText('1200');
  await expect(cell(page, 'D2')).toHaveText('TRUE');
  await expect(cell(page, 'E2')).toHaveText('2024-01-15');
});

test('REQ-3-1-1#4: REQ-3-1-1 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  // A formula cell shows the calculated result in the grid and the original
  // submitted formula in the formula bar.
  await writeCell(page, 'D1', '=B2*2');
  await expect(cell(page, 'D1')).toHaveText('8');
  await expectFormula(page, 'D1', '=B2*2');

  await reloadEditor(page);
  await expect(cell(page, 'D1')).toHaveText('8');
  await expectFormula(page, 'D1', '=B2*2');
  // The seeded source of the formula is unchanged.
  await expect(cell(page, 'B2')).toHaveText('4');
});

test('REQ-3-1-2: REQ-3-1-2 -the requested workflow B2 the requested workflow,the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await setClipboard(page, 'East\t1200\nNorth\t800');
  await cell(page, 'D1').click();
  await page.keyboard.press('Control+V');

  await expect(cell(page, 'D1')).toHaveText('East');
  await expect(cell(page, 'E1')).toHaveText('1200');
  await expect(cell(page, 'D2')).toHaveText('North');
  await expect(cell(page, 'E2')).toHaveText('800');
  // Only the target rectangle changed.
  await expect(cell(page, 'A1')).toHaveText('Item');
  await expect(cell(page, 'B2')).toHaveText('4');

  await reloadEditor(page);
  await expect(cell(page, 'D1')).toHaveText('East');
  await expect(cell(page, 'E1')).toHaveText('1200');
  await expect(cell(page, 'D2')).toHaveText('North');
  await expect(cell(page, 'E2')).toHaveText('800');
});

test('REQ-3-1-2#2: REQ-3-1-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await setClipboard(page, 'East\t1200\nNorth\t800');
  await cell(page, 'D1').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Paste', exact: true }).click();

  await expect(cell(page, 'D1')).toHaveText('East');
  await expect(cell(page, 'E1')).toHaveText('1200');
  await expect(cell(page, 'D2')).toHaveText('North');
  await expect(cell(page, 'E2')).toHaveText('800');
  await expect(cell(page, 'A1')).toHaveText('Item');

  await reloadEditor(page);
  await expect(cell(page, 'D1')).toHaveText('East');
  await expect(cell(page, 'E1')).toHaveText('1200');
  await expect(cell(page, 'D2')).toHaveText('North');
  await expect(cell(page, 'E2')).toHaveText('800');
});

test('REQ-3-1-2#3: REQ-3-1-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  // A formula inside the target rectangle is replaced by the pasted content.
  await writeCell(page, 'D1', '=1+1');
  await expect(cell(page, 'D1')).toHaveText('2');

  await setClipboard(page, 'East\t\nNorth\t800');
  await cell(page, 'D1').click();
  await page.keyboard.press('Control+V');

  await expect(cell(page, 'D1')).toHaveText('East');
  await expect(cell(page, 'E1')).toHaveText('');
  await expect(cell(page, 'D2')).toHaveText('North');
  await expect(cell(page, 'E2')).toHaveText('800');

  await reloadEditor(page);
  await expect(cell(page, 'D1')).toHaveText('East');
  await expect(cell(page, 'E1')).toHaveText('');
  await expect(cell(page, 'D2')).toHaveText('North');
  await expect(cell(page, 'E2')).toHaveText('800');
});

test('REQ-3-1-2#4: REQ-3-1-2 -the requested workflow A1 the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await writeCell(page, 'G1', 'keep');
  await expect(cell(page, 'G1')).toHaveText('keep');

  // The whole pasted rectangle is applied, not only a part of it.
  await setClipboard(page, 'East\t1200\nNorth\t800\nSouth\t700');
  await cell(page, 'D1').click();
  await page.keyboard.press('Control+V');

  await expect(cell(page, 'D1')).toHaveText('East');
  await expect(cell(page, 'E1')).toHaveText('1200');
  await expect(cell(page, 'D2')).toHaveText('North');
  await expect(cell(page, 'E2')).toHaveText('800');
  await expect(cell(page, 'D3')).toHaveText('South');
  await expect(cell(page, 'E3')).toHaveText('700');
  await expect(cell(page, 'G1')).toHaveText('keep');
  await expect(cell(page, 'A1')).toHaveText('Item');

  await reloadEditor(page);
  await expect(cell(page, 'D1')).toHaveText('East');
  await expect(cell(page, 'E3')).toHaveText('700');
  await expect(cell(page, 'G1')).toHaveText('keep');
});

test('REQ-3-1-2#5: REQ-3-1-2 -the requested workflow C3 the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await setClipboard(page, 'East\t1200\nNorth\t800');
  await cell(page, 'C3').click();
  await page.keyboard.press('Control+V');

  await expect(cell(page, 'C3')).toHaveText('East');
  await expect(cell(page, 'D3')).toHaveText('1200');
  await expect(cell(page, 'C4')).toHaveText('North');
  await expect(cell(page, 'D4')).toHaveText('800');
  await expect(cell(page, 'A1')).toHaveText('Item');

  await reloadEditor(page);
  await expect(cell(page, 'C3')).toHaveText('East');
  await expect(cell(page, 'D3')).toHaveText('1200');
  await expect(cell(page, 'C4')).toHaveText('North');
  await expect(cell(page, 'D4')).toHaveText('800');
});

test('REQ-3-1-3: REQ-3-1-3 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await expect(grid(page)).toHaveAttribute('aria-multiselectable', 'true');

  // Selecting a single cell.
  await cell(page, 'D1').click();
  await expect(cell(page, 'D1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'false');
  await expect(cell(page, 'E2')).toHaveAttribute('aria-selected', 'false');

  // Selecting another cell replaces the previous selection.
  await cell(page, 'A1').click();
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'D1')).toHaveAttribute('aria-selected', 'false');
});

test('REQ-3-1-3#2: REQ-3-1-3 -the requested workflow,the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await dragSelect(page, 'D1', 'E2');

  await expect(cell(page, 'D1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'E1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'D2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'E2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'false');
  await expect(cell(page, 'A2')).toHaveAttribute('aria-selected', 'false');
  await expect(cell(page, 'C1')).toHaveAttribute('aria-selected', 'false');
  await expect(cell(page, 'D3')).toHaveAttribute('aria-selected', 'false');

  // The complete rectangle is restored after refreshing.
  await reloadEditor(page);
  await expect(cell(page, 'D1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'E1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'D2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'E2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'false');
  await expect(cell(page, 'D3')).toHaveAttribute('aria-selected', 'false');
});

test('REQ-3-2-1: REQ-3-2-1 -the requested workflow A1:B2 the requested workflow D1:E2,the requested workflow, the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  // Copy the seeded range A1:B2 to the target range D1:E2.
  await dragSelect(page, 'A1', 'B2');
  await page.keyboard.press('Control+C');
  await cell(page, 'D1').click();
  await page.keyboard.press('Control+V');

  await expect(cell(page, 'D1')).toHaveText('Item');
  await expect(cell(page, 'E1')).toHaveText('Qty');
  await expect(cell(page, 'D2')).toHaveText('Pen');
  await expect(cell(page, 'E2')).toHaveText('4');
  // The source range remains unchanged after a copy.
  await expect(cell(page, 'A1')).toHaveText('Item');
  await expect(cell(page, 'B2')).toHaveText('4');

  await reloadEditor(page);
  await expect(cell(page, 'D1')).toHaveText('Item');
  await expect(cell(page, 'E1')).toHaveText('Qty');
  await expect(cell(page, 'D2')).toHaveText('Pen');
  await expect(cell(page, 'E2')).toHaveText('4');
  await expect(cell(page, 'A1')).toHaveText('Item');
});

test('REQ-3-2-1#2: REQ-3-2-1 -the requested workflow A1:B2 the requested workflow D1:E2,the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  // Build a source block inside the target range, then cut it to G1.
  await writeCell(page, 'D1', 'Item');
  await writeCell(page, 'E1', 'Qty');
  await writeCell(page, 'D2', 'Pen');
  await writeCell(page, 'E2', '4');

  await dragSelect(page, 'D1', 'E2');
  await page.keyboard.press('Control+X');
  await cell(page, 'G1').click();
  await page.keyboard.press('Control+V');

  // The target range is displayed completely ...
  await expect(cell(page, 'G1')).toHaveText('Item');
  await expect(cell(page, 'H1')).toHaveText('Qty');
  await expect(cell(page, 'G2')).toHaveText('Pen');
  await expect(cell(page, 'H2')).toHaveText('4');
  // ... before the cut source is cleared.
  await expect(cell(page, 'D1')).toHaveText('');
  await expect(cell(page, 'E1')).toHaveText('');
  await expect(cell(page, 'D2')).toHaveText('');
  await expect(cell(page, 'E2')).toHaveText('');

  await reloadEditor(page);
  await expect(cell(page, 'G1')).toHaveText('Item');
  await expect(cell(page, 'H2')).toHaveText('4');
  await expect(cell(page, 'D1')).toHaveText('');
});

test('REQ-3-2-1#3: REQ-3-2-1 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  // A copied formula adjusts its relative references by the target offset.
  await writeCell(page, 'D1', '=A1');
  await expect(cell(page, 'D1')).toHaveText('Item');
  await expectFormula(page, 'D1', '=A1');

  await cell(page, 'D1').click();
  await page.keyboard.press('Control+C');
  await cell(page, 'E1').click();
  await page.keyboard.press('Control+V');

  await expect(cell(page, 'E1')).toHaveText('Qty');
  await expectFormula(page, 'E1', '=B1');
  // The source formula and result remain unchanged.
  await expect(cell(page, 'D1')).toHaveText('Item');
  await expectFormula(page, 'D1', '=A1');

  await reloadEditor(page);
  await expect(cell(page, 'E1')).toHaveText('Qty');
  await expectFormula(page, 'E1', '=B1');
  await expect(cell(page, 'D1')).toHaveText('Item');
});

test('REQ-3-2-1#4: REQ-3-2-1 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  // Build the two-dimensional block in D1:E2, copy it to G1:H2.
  await writeCell(page, 'D1', 'East');
  await writeCell(page, 'E1', '1200');
  await writeCell(page, 'D2', 'North');
  await writeCell(page, 'E2', '800');

  await dragSelect(page, 'D1', 'E2');
  await page.keyboard.press('Control+C');
  await cell(page, 'G1').click();
  await page.keyboard.press('Control+V');

  await expect(cell(page, 'G1')).toHaveText('East');
  await expect(cell(page, 'H1')).toHaveText('1200');
  await expect(cell(page, 'G2')).toHaveText('North');
  await expect(cell(page, 'H2')).toHaveText('800');
  // The source range and cells outside the ranges are unchanged.
  await expect(cell(page, 'D1')).toHaveText('East');
  await expect(cell(page, 'E2')).toHaveText('800');
  await expect(cell(page, 'A1')).toHaveText('Item');
  await expect(cell(page, 'B2')).toHaveText('4');
  await expect(cell(page, 'F1')).toHaveText('');

  await reloadEditor(page);
  await expect(cell(page, 'G1')).toHaveText('East');
  await expect(cell(page, 'H2')).toHaveText('800');
  await expect(cell(page, 'D1')).toHaveText('East');
  await expect(cell(page, 'A1')).toHaveText('Item');
});

test('REQ-3-2-2: REQ-3-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await writeCell(page, 'D1', 'Item');
  await expect(cell(page, 'D1')).toHaveText('Item');
  await writeCell(page, 'D1', 'East');
  await expect(cell(page, 'D1')).toHaveText('East');

  await undoButton(page).click();
  await expect(cell(page, 'D1')).toHaveText('Item');

  await reloadEditor(page);
  await expect(cell(page, 'D1')).toHaveText('Item');
});

test('REQ-3-2-2#2: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await writeCell(page, 'D1', 'North');
  await writeCell(page, 'D1', '800');
  await expect(cell(page, 'D1')).toHaveText('800');

  await undoButton(page).click();
  await expect(cell(page, 'D1')).toHaveText('North');

  await redoButton(page).click();
  await expect(cell(page, 'D1')).toHaveText('800');

  await reloadEditor(page);
  await expect(cell(page, 'D1')).toHaveText('800');
});

test('REQ-3-2-2#3: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await writeCell(page, 'D1', 'North');
  await writeCell(page, 'D1', '1200');
  await expect(cell(page, 'D1')).toHaveText('1200');

  await cell(page, 'D1').click();
  await page.keyboard.press('Control+z');
  await expect(cell(page, 'D1')).toHaveText('North');

  await page.keyboard.press('Control+y');
  await expect(cell(page, 'D1')).toHaveText('1200');

  await reloadEditor(page);
  await expect(cell(page, 'D1')).toHaveText('1200');
});

test('REQ-3-2-2#4: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await writeCell(page, 'D1', 'Item');
  await writeCell(page, 'E1', 'Qty');
  await writeCell(page, 'D1', 'East');
  await writeCell(page, 'E1', '1200');

  // Consecutive undos restore the changes in reverse order.
  await undoButton(page).click();
  await expect(cell(page, 'E1')).toHaveText('Qty');
  await expect(cell(page, 'D1')).toHaveText('East');

  await undoButton(page).click();
  await expect(cell(page, 'D1')).toHaveText('Item');
  await expect(cell(page, 'E1')).toHaveText('Qty');

  await reloadEditor(page);
  await expect(cell(page, 'D1')).toHaveText('Item');
  await expect(cell(page, 'E1')).toHaveText('Qty');
});

test('REQ-3-2-2#5: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await writeCell(page, 'D1', 'Item');
  await writeCell(page, 'E1', 'Qty');
  await writeCell(page, 'D2', 'Pen');
  await writeCell(page, 'E2', '4');

  await setClipboard(page, 'East\t1200\nNorth\t800');
  await cell(page, 'D1').click();
  await page.keyboard.press('Control+V');
  await expect(cell(page, 'D1')).toHaveText('East');
  await expect(cell(page, 'E2')).toHaveText('800');

  // Undo of the bulk paste restores the whole rectangle.
  await undoButton(page).click();
  await expect(cell(page, 'D1')).toHaveText('Item');
  await expect(cell(page, 'E1')).toHaveText('Qty');
  await expect(cell(page, 'D2')).toHaveText('Pen');
  await expect(cell(page, 'E2')).toHaveText('4');

  await reloadEditor(page);
  await expect(cell(page, 'D1')).toHaveText('Item');
  await expect(cell(page, 'E1')).toHaveText('Qty');
  await expect(cell(page, 'D2')).toHaveText('Pen');
  await expect(cell(page, 'E2')).toHaveText('4');
});

test('REQ-3-2-2#6: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await writeCell(page, 'D1', 'East');
  await expect(cell(page, 'D1')).toHaveText('East');

  // Insert a column to the left of column C; cells from C rightwards shift.
  await page.getByRole('columnheader', { name: 'C', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 column left', exact: true }).click();
  await expect(cell(page, 'E1')).toHaveText('East');

  // Undo restores the row/column structure.
  await undoButton(page).click();
  await expect(cell(page, 'D1')).toHaveText('East');

  await reloadEditor(page);
  await expect(cell(page, 'D1')).toHaveText('East');
});

test('REQ-3-2-2#7: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await writeCell(page, 'D1', 'North');
  await writeCell(page, 'D1', 'East');
  await undoButton(page).click();
  await expect(cell(page, 'D1')).toHaveText('North');

  // A new modification after an undo discards the redo branch.
  await writeCell(page, 'D1', 'Item');
  await expect(cell(page, 'D1')).toHaveText('Item');
  await expect(redoButton(page)).toBeDisabled();

  await cell(page, 'D1').click();
  await page.keyboard.press('Control+y');
  await expect(cell(page, 'D1')).toHaveText('Item');

  await reloadEditor(page);
  await expect(cell(page, 'D1')).toHaveText('Item');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

