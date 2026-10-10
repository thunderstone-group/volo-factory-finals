const { test, expect } = require('@playwright/test');

/* ---------------------------------------------------------------- helpers */

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const grid = (page) => page.getByRole('grid', { name: 'Worksheet grid', exact: true });
const cell = (page, coord) => page.getByRole('gridcell', { name: coord, exact: true });
const formulaBar = (page) => page.getByLabel('Formula bar', { exact: true });
const undoButton = (page) => page.getByRole('button', { name: 'Undo', exact: true });
const redoButton = (page) => page.getByRole('button', { name: 'Redo', exact: true });

// A blank workbook created through the home page flow (New blank workbook -> Create).
async function newWorkbook(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(grid(page)).toBeVisible();
}

// A blank workbook with a unique, known name, so it can be reopened from the home page.
async function namedWorkbook(page, name) {
  await newWorkbook(page);
  await page.getByRole('button', { name: 'Rename workbook', exact: true }).click();
  await page.getByLabel('Workbook name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Rename workbook', exact: true })).toBeVisible();
}

async function selectCell(page, coord) {
  await cell(page, coord).click();
}

// Enter a value through the "Formula bar" and commit it with Enter.
async function typeInCell(page, coord, value) {
  await selectCell(page, coord);
  const bar = formulaBar(page);
  await bar.fill(value);
  await bar.press('Enter');
}

// Enter a value through the inline grid text box "Edit <cell coordinate>".
async function editInGrid(page, coord, value) {
  await cell(page, coord).dblclick();
  const editor = page.getByRole('textbox', { name: 'Edit ' + coord, exact: true });
  await editor.fill(value);
  await editor.press('Enter');
}

async function putClipboard(page, text) {
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
}

// Paste external clipboard text with Ctrl+V starting at coord.
async function pasteAt(page, coord, text) {
  await selectCell(page, coord);
  await putClipboard(page, text);
  await page.keyboard.press('Control+V');
}

async function dragSelect(page, from, to) {
  const fromLoc = cell(page, from);
  await fromLoc.scrollIntoViewIfNeeded();
  const a = await fromLoc.boundingBox();
  const b = await cell(page, to).boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
  await page.mouse.up();
}

async function openDataCommand(page, command) {
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByRole('menuitem', { name: command, exact: true }).click();
}

// The range must already be selected; applies an inclusive 0..100 style numeric rule.
async function applyNumberValidation(page, min, max) {
  await openDataCommand(page, 'Data validation');
  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await dialog.getByRole('combobox', { name: 'Rule type', exact: true }).click();
  await page.getByRole('option', { name: 'Number range', exact: true }).click();
  await dialog.getByLabel('Minimum', { exact: true }).fill(min);
  await dialog.getByLabel('Maximum', { exact: true }).fill(max);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
}

/* ------------------------------------------------- REQ-3-1-1 (scenario 1) */

test('REQ-3-1-1: REQ-3-1-1 -the requested workflow,the requested workflow', async ({ page }) => {
  await newWorkbook(page);

  // Ordinary value entered through the formula bar, committed with Enter.
  await typeInCell(page, 'A1', 'Pen');
  await expect(cell(page, 'A1')).toHaveText('Pen');
  await selectCell(page, 'A1');
  await expect(formulaBar(page)).toHaveValue('Pen');

  // Ordinary value entered through the grid, committed by clicking another cell.
  await cell(page, 'B1').dblclick();
  const editor = page.getByRole('textbox', { name: 'Edit B1', exact: true });
  await editor.fill('4');
  await cell(page, 'A2').click();
  await expect(cell(page, 'B1')).toHaveText('4');
  await selectCell(page, 'B1');
  await expect(formulaBar(page)).toHaveValue('4');

  // Values persist after refresh.
  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(cell(page, 'A1')).toHaveText('Pen');
  await expect(cell(page, 'B1')).toHaveText('4');
  await selectCell(page, 'A1');
  await expect(formulaBar(page)).toHaveValue('Pen');
  await selectCell(page, 'B1');
  await expect(formulaBar(page)).toHaveValue('4');
});

/* ------------------------------------------------- REQ-3-1-1 (scenario 2) */

test('REQ-3-1-1#2: REQ-3-1-1 -Escape the requested workflow,the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await typeInCell(page, 'A1', 'Pen');

  // Escape cancels an uncommitted change made in the grid.
  await cell(page, 'A1').dblclick();
  const editor = page.getByRole('textbox', { name: 'Edit A1', exact: true });
  await editor.fill('Marker');
  await editor.press('Escape');
  await expect(cell(page, 'A1')).toHaveText('Pen');
  await selectCell(page, 'A1');
  await expect(formulaBar(page)).toHaveValue('Pen');

  // Escape cancels an uncommitted change made in the formula bar.
  await selectCell(page, 'B1');
  const bar = formulaBar(page);
  await bar.fill('Draft');
  await bar.press('Escape');
  await expect(cell(page, 'B1')).toHaveText('');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('Pen');
  await expect(cell(page, 'B1')).toHaveText('');
});

/* ------------------------------------------------- REQ-3-1-1 (scenario 3) */

test('REQ-3-1-1#3: REQ-3-1-1 -the requested workflow, the requested workflow, the requested workflow, the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await typeInCell(page, 'A1', '2');
  await typeInCell(page, 'B1', '3');

  // Formula cell: result in the grid, original expression in the formula bar.
  await typeInCell(page, 'C1', '=A1+B1');
  await expect(cell(page, 'C1')).toHaveText('5');
  await selectCell(page, 'C1');
  await expect(formulaBar(page)).toHaveValue('=A1+B1');

  await typeInCell(page, 'D1', '=C1*2');
  await expect(cell(page, 'D1')).toHaveText('10');

  // Directly and indirectly dependent formulas update after a source value is committed.
  await typeInCell(page, 'A1', '10');
  await expect(cell(page, 'C1')).toHaveText('13');
  await expect(cell(page, 'D1')).toHaveText('26');

  await page.reload();
  await expect(cell(page, 'C1')).toHaveText('13');
  await expect(cell(page, 'D1')).toHaveText('26');
  await selectCell(page, 'C1');
  await expect(formulaBar(page)).toHaveValue('=A1+B1');
  await selectCell(page, 'D1');
  await expect(formulaBar(page)).toHaveValue('=C1*2');
});

/* ------------------------------------------------- REQ-3-1-1 (scenario 4) */

test('REQ-3-1-1#4: REQ-3-1-1 -the requested workflow', async ({ page }) => {
  await newWorkbook(page);

  await editInGrid(page, 'A1', 'Pen');        // text
  await typeInCell(page, 'B1', '42');         // number
  await typeInCell(page, 'C1', 'TRUE');       // boolean-like value
  await typeInCell(page, 'D1', '2024-01-15'); // date text

  await expect(cell(page, 'A1')).toHaveText('Pen');
  await expect(cell(page, 'B1')).toHaveText('42');
  await expect(cell(page, 'C1')).toHaveText('TRUE');
  await expect(cell(page, 'D1')).toHaveText('2024-01-15');
  await selectCell(page, 'A1');
  await expect(formulaBar(page)).toHaveValue('Pen');
  await selectCell(page, 'C1');
  await expect(formulaBar(page)).toHaveValue('TRUE');
  await selectCell(page, 'D1');
  await expect(formulaBar(page)).toHaveValue('2024-01-15');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('Pen');
  await expect(cell(page, 'B1')).toHaveText('42');
  await expect(cell(page, 'C1')).toHaveText('TRUE');
  await expect(cell(page, 'D1')).toHaveText('2024-01-15');
});

/* ------------------------------------------------- REQ-3-1-2 (scenario 1) */

test('REQ-3-1-2: REQ-3-1-2 -the requested workflow B2 the requested workflow,the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await typeInCell(page, 'A1', 'keep');

  // Ctrl+V at B2: 2 rows x 3 columns with empty fields preserved.
  await pasteAt(page, 'B2', 'a\t\tb\nc\td\t');

  await expect(cell(page, 'B2')).toHaveText('a');
  await expect(cell(page, 'C2')).toHaveText('');
  await expect(cell(page, 'D2')).toHaveText('b');
  await expect(cell(page, 'B3')).toHaveText('c');
  await expect(cell(page, 'C3')).toHaveText('d');
  await expect(cell(page, 'D3')).toHaveText('');
  // cells outside the target rectangle are untouched
  await expect(cell(page, 'A1')).toHaveText('keep');
  await expect(cell(page, 'A2')).toHaveText('');

  await page.reload();
  await expect(cell(page, 'B2')).toHaveText('a');
  await expect(cell(page, 'C2')).toHaveText('');
  await expect(cell(page, 'D2')).toHaveText('b');
  await expect(cell(page, 'B3')).toHaveText('c');
  await expect(cell(page, 'C3')).toHaveText('d');
  await expect(cell(page, 'A1')).toHaveText('keep');
});

/* ------------------------------------------------- REQ-3-1-2 (scenario 2) */

test('REQ-3-1-2#2: REQ-3-1-2 -the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await putClipboard(page, 'East\t1200\nNorth\t800');

  // Paste through the grid context menu command.
  await selectCell(page, 'A1');
  await cell(page, 'A1').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Paste', exact: true }).click();

  await expect(cell(page, 'A1')).toHaveText('East');
  await expect(cell(page, 'B1')).toHaveText('1200');
  await expect(cell(page, 'A2')).toHaveText('North');
  await expect(cell(page, 'B2')).toHaveText('800');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('East');
  await expect(cell(page, 'B1')).toHaveText('1200');
  await expect(cell(page, 'A2')).toHaveText('North');
  await expect(cell(page, 'B2')).toHaveText('800');
});

/* ------------------------------------------------- REQ-3-1-2 (scenario 3) */

test('REQ-3-1-2#3: REQ-3-1-2 -the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await typeInCell(page, 'A1', '1');
  await typeInCell(page, 'B1', '2');
  await typeInCell(page, 'C1', '=A1+B1');
  await typeInCell(page, 'D1', '=C1*2');
  await expect(cell(page, 'C1')).toHaveText('3');
  await expect(cell(page, 'D1')).toHaveText('6');

  // Only the pasted rectangle is overwritten; the formula inside it is replaced.
  await pasteAt(page, 'B1', '5\t7');
  await expect(cell(page, 'A1')).toHaveText('1');
  await expect(cell(page, 'B1')).toHaveText('5');
  await expect(cell(page, 'C1')).toHaveText('7');
  await selectCell(page, 'C1');
  await expect(formulaBar(page)).toHaveValue('7');
  // related formula recalculated
  await expect(cell(page, 'D1')).toHaveText('14');
  // untouched cells
  await expect(cell(page, 'B2')).toHaveText('');
  await expect(cell(page, 'A2')).toHaveText('');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('1');
  await expect(cell(page, 'C1')).toHaveText('7');
  await expect(cell(page, 'D1')).toHaveText('14');
});

/* ------------------------------------------------- REQ-3-1-2 (scenario 4) */

test('REQ-3-1-2#4: REQ-3-1-2 -the requested workflow A1 the requested workflow', async ({ page }) => {
  await newWorkbook(page);

  await pasteAt(page, 'A1', 'r1c1\tr1c2\nr2c1\tr2c2\nr3c1\tr3c2');

  await expect(cell(page, 'A1')).toHaveText('r1c1');
  await expect(cell(page, 'B1')).toHaveText('r1c2');
  await expect(cell(page, 'A2')).toHaveText('r2c1');
  await expect(cell(page, 'B2')).toHaveText('r2c2');
  await expect(cell(page, 'A3')).toHaveText('r3c1');
  await expect(cell(page, 'B3')).toHaveText('r3c2');
  await expect(cell(page, 'C1')).toHaveText('');
  await expect(cell(page, 'C3')).toHaveText('');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('r1c1');
  await expect(cell(page, 'B2')).toHaveText('r2c2');
  await expect(cell(page, 'A3')).toHaveText('r3c1');
  await expect(cell(page, 'B3')).toHaveText('r3c2');
});

/* ------------------------------------------------- REQ-3-1-2 (scenario 5) */

test('REQ-3-1-2#5: REQ-3-1-2 -the requested workflow C3 the requested workflow', async ({ page }) => {
  await newWorkbook(page);

  // 0-to-100 numeric rule on the paste target rectangle C3:D4.
  await dragSelect(page, 'C3', 'D4');
  await applyNumberValidation(page, '0', '100');

  // One invalid target rejects the whole paste; no value is silently dropped.
  await pasteAt(page, 'C3', '50\t101');
  await expect(page.getByText('Please enter a number from 0 to 100', { exact: true })).toBeVisible();
  await expect(cell(page, 'C3')).toHaveText('');
  await expect(cell(page, 'D3')).toHaveText('');

  await page.reload();
  await expect(cell(page, 'C3')).toHaveText('');
  await expect(cell(page, 'D3')).toHaveText('');
  await expect(cell(page, 'C4')).toHaveText('');
  await expect(cell(page, 'D4')).toHaveText('');
});

/* ------------------------------------------------- REQ-3-1-3 (scenario 1) */

test('REQ-3-1-3: REQ-3-1-3 -the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await expect(grid(page)).toHaveAttribute('aria-multiselectable', 'true');

  // Single cell selection.
  await selectCell(page, 'B2');
  await expect(cell(page, 'B2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'false');

  // Drag selection of the rectangle A1:B2.
  await dragSelect(page, 'A1', 'B2');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'B1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'B2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'C1')).toHaveAttribute('aria-selected', 'false');
  await expect(cell(page, 'A3')).toHaveAttribute('aria-selected', 'false');
  await expect(cell(page, 'C3')).toHaveAttribute('aria-selected', 'false');

  // Selecting another cell replaces the previous selection.
  await selectCell(page, 'D4');
  await expect(cell(page, 'D4')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'false');
  await expect(cell(page, 'B2')).toHaveAttribute('aria-selected', 'false');
});

/* ------------------------------------------------- REQ-3-1-3 (scenario 2) */

test('REQ-3-1-3#2: REQ-3-1-3 -the requested workflow,the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();

  // Select the rectangle A1:B2 on Sheet1.
  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await dragSelect(page, 'A1', 'B2');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'B2')).toHaveAttribute('aria-selected', 'true');

  // Select a single cell on Sheet2 - must not overwrite Sheet1's selection.
  await page.getByRole('tab', { name: 'Sheet2', exact: true }).click();
  await selectCell(page, 'C3');
  await expect(cell(page, 'C3')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'false');

  // Back on Sheet1 the complete rectangle is restored.
  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'B1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'B2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'C1')).toHaveAttribute('aria-selected', 'false');

  // The rectangle survives refresh on the active worksheet.
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'B1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'B2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'C1')).toHaveAttribute('aria-selected', 'false');
  await expect(cell(page, 'C3')).toHaveAttribute('aria-selected', 'false');

  // Sheet2 still carries its own single-cell selection.
  await page.getByRole('tab', { name: 'Sheet2', exact: true }).click();
  await expect(cell(page, 'C3')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'false');
});

/* ------------------------------------------------- REQ-3-2-1 (scenario 1) */

test('REQ-3-2-1: REQ-3-2-1 -the requested workflow A1:B2 the requested workflow D1:E2,the requested workflow, the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await typeInCell(page, 'A1', 'Item');
  await typeInCell(page, 'B1', 'Qty');
  await typeInCell(page, 'A2', 'Pen');
  await typeInCell(page, 'B2', '4');

  await dragSelect(page, 'A1', 'B2');
  await page.keyboard.press('Control+C');
  await selectCell(page, 'D1');
  await page.keyboard.press('Control+V');

  // Target range received the two-dimensional layout.
  await expect(cell(page, 'D1')).toHaveText('Item');
  await expect(cell(page, 'E1')).toHaveText('Qty');
  await expect(cell(page, 'D2')).toHaveText('Pen');
  await expect(cell(page, 'E2')).toHaveText('4');

  // Source range unchanged, cells outside the two ranges unchanged.
  await expect(cell(page, 'A1')).toHaveText('Item');
  await expect(cell(page, 'B1')).toHaveText('Qty');
  await expect(cell(page, 'A2')).toHaveText('Pen');
  await expect(cell(page, 'B2')).toHaveText('4');
  await expect(cell(page, 'C1')).toHaveText('');
  await expect(cell(page, 'D3')).toHaveText('');

  await page.reload();
  await expect(cell(page, 'D1')).toHaveText('Item');
  await expect(cell(page, 'E2')).toHaveText('4');
  await expect(cell(page, 'A1')).toHaveText('Item');
  await expect(cell(page, 'B2')).toHaveText('4');
});

/* ------------------------------------------------- REQ-3-2-1 (scenario 2) */

test('REQ-3-2-1#2: REQ-3-2-1 -the requested workflow A1:B2 the requested workflow D1:E2,the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await typeInCell(page, 'A1', 'Item');
  await typeInCell(page, 'B1', 'Qty');
  await typeInCell(page, 'A2', 'Pen');
  await typeInCell(page, 'B2', '4');

  await dragSelect(page, 'A1', 'B2');
  await page.keyboard.press('Control+X');
  await selectCell(page, 'D1');
  await page.keyboard.press('Control+V');

  await expect(cell(page, 'D1')).toHaveText('Item');
  await expect(cell(page, 'E1')).toHaveText('Qty');
  await expect(cell(page, 'D2')).toHaveText('Pen');
  await expect(cell(page, 'E2')).toHaveText('4');
  // source range cleared after the target is displayed
  await expect(cell(page, 'A1')).toHaveText('');
  await expect(cell(page, 'B1')).toHaveText('');
  await expect(cell(page, 'A2')).toHaveText('');
  await expect(cell(page, 'B2')).toHaveText('');

  await page.reload();
  await expect(cell(page, 'D1')).toHaveText('Item');
  await expect(cell(page, 'E2')).toHaveText('4');
  await expect(cell(page, 'A1')).toHaveText('');
  await expect(cell(page, 'B2')).toHaveText('');
});

/* ------------------------------------------------- REQ-3-2-1 (scenario 3) */

test('REQ-3-2-1#3: REQ-3-2-1 -the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await typeInCell(page, 'A1', '2');
  await typeInCell(page, 'B1', '3');
  await typeInCell(page, 'A2', '5');
  await typeInCell(page, 'B2', '7');
  await typeInCell(page, 'C1', '=A1+B1');
  await typeInCell(page, 'D1', '=$A$1+B1');
  await expect(cell(page, 'C1')).toHaveText('5');
  await expect(cell(page, 'D1')).toHaveText('5');

  // Copy a formula one row down: relative references adjust.
  await selectCell(page, 'C1');
  await page.keyboard.press('Control+C');
  await selectCell(page, 'C2');
  await page.keyboard.press('Control+V');
  await expect(cell(page, 'C2')).toHaveText('12');
  await selectCell(page, 'C2');
  await expect(formulaBar(page)).toHaveValue('=A2+B2');
  // source formula and result unchanged
  await expect(cell(page, 'C1')).toHaveText('5');
  await selectCell(page, 'C1');
  await expect(formulaBar(page)).toHaveValue('=A1+B1');

  // Copy a mixed formula: the absolute reference stays, the relative one adjusts.
  await selectCell(page, 'D1');
  await page.keyboard.press('Control+C');
  await selectCell(page, 'D2');
  await page.keyboard.press('Control+V');
  await expect(cell(page, 'D2')).toHaveText('9');
  await selectCell(page, 'D2');
  await expect(formulaBar(page)).toHaveValue('=$A$1+B2');

  await page.reload();
  await expect(cell(page, 'C2')).toHaveText('12');
  await selectCell(page, 'C2');
  await expect(formulaBar(page)).toHaveValue('=A2+B2');
  await expect(cell(page, 'D2')).toHaveText('9');
  await selectCell(page, 'D2');
  await expect(formulaBar(page)).toHaveValue('=$A$1+B2');
});

/* ------------------------------------------------- REQ-3-2-1 (scenario 4) */

test('REQ-3-2-1#4: REQ-3-2-1 -the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await typeInCell(page, 'A1', '150');

  // 0-to-100 numeric rule on the paste target B1.
  await selectCell(page, 'B1');
  await applyNumberValidation(page, '0', '100');

  await selectCell(page, 'A1');
  await page.keyboard.press('Control+C');
  await selectCell(page, 'B1');
  await page.keyboard.press('Control+V');

  await expect(page.getByText('Please enter a number from 0 to 100', { exact: true })).toBeVisible();
  // source and target both keep their original state
  await expect(cell(page, 'A1')).toHaveText('150');
  await expect(cell(page, 'B1')).toHaveText('');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('150');
  await expect(cell(page, 'B1')).toHaveText('');
});

/* ------------------------------------------------- REQ-3-2-2 (scenario 1) */

test('REQ-3-2-2: REQ-3-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await typeInCell(page, 'A1', 'alpha');
  await expect(cell(page, 'A1')).toHaveText('alpha');

  await selectCell(page, 'A1');
  await undoButton(page).click();
  await expect(cell(page, 'A1')).toHaveText('');

  await redoButton(page).click();
  await expect(cell(page, 'A1')).toHaveText('alpha');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('alpha');
});

/* ------------------------------------------------- REQ-3-2-2 (scenario 2) */

test('REQ-3-2-2#2: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await typeInCell(page, 'A1', 'alpha');
  await selectCell(page, 'A1');

  await page.keyboard.press('Control+Z');
  await expect(cell(page, 'A1')).toHaveText('');

  await page.keyboard.press('Control+Y');
  await expect(cell(page, 'A1')).toHaveText('alpha');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('alpha');
});

/* ------------------------------------------------- REQ-3-2-2 (scenario 3) */

test('REQ-3-2-2#3: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await typeInCell(page, 'A1', 'old1');
  await typeInCell(page, 'B1', 'old2');

  await pasteAt(page, 'A1', 'new1\tnew2');
  await expect(cell(page, 'A1')).toHaveText('new1');
  await expect(cell(page, 'B1')).toHaveText('new2');

  await selectCell(page, 'A1');
  await undoButton(page).click();
  await expect(cell(page, 'A1')).toHaveText('old1');
  await expect(cell(page, 'B1')).toHaveText('old2');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('old1');
  await expect(cell(page, 'B1')).toHaveText('old2');
});

/* ------------------------------------------------- REQ-3-2-2 (scenario 4) */

test('REQ-3-2-2#4: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await typeInCell(page, 'A1', 'X');
  await typeInCell(page, 'A2', 'Y');

  // Insert a row above row 2 through the row-number menu.
  await page.getByRole('rowheader', { name: '2', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 row above', exact: true }).click();
  await expect(cell(page, 'A2')).toHaveText('');
  await expect(cell(page, 'A3')).toHaveText('Y');

  // Undo restores the previous row structure.
  await selectCell(page, 'A1');
  await undoButton(page).click();
  await expect(cell(page, 'A1')).toHaveText('X');
  await expect(cell(page, 'A2')).toHaveText('Y');
  await expect(cell(page, 'A3')).toHaveText('');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('X');
  await expect(cell(page, 'A2')).toHaveText('Y');
  await expect(cell(page, 'A3')).toHaveText('');
});

/* ------------------------------------------------- REQ-3-2-2 (scenario 5) */

test('REQ-3-2-2#5: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await typeInCell(page, 'A1', 'one');
  await typeInCell(page, 'A2', 'two');
  await typeInCell(page, 'A3', 'three');

  // Consecutive undo operations restore changes in reverse order.
  await selectCell(page, 'A1');
  await undoButton(page).click();
  await expect(cell(page, 'A3')).toHaveText('');
  await expect(cell(page, 'A2')).toHaveText('two');
  await expect(cell(page, 'A1')).toHaveText('one');

  await undoButton(page).click();
  await expect(cell(page, 'A2')).toHaveText('');
  await expect(cell(page, 'A1')).toHaveText('one');

  // Redo reapplies the operation that was just undone.
  await redoButton(page).click();
  await expect(cell(page, 'A2')).toHaveText('two');
  await expect(cell(page, 'A1')).toHaveText('one');
  await expect(cell(page, 'A3')).toHaveText('');
});

/* ------------------------------------------------- REQ-3-2-2 (scenario 6) */

test('REQ-3-2-2#6: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  const first = 'Alpha ' + u();

  await namedWorkbook(page, first);
  await typeInCell(page, 'A1', 'alpha');
  await expect(cell(page, 'A1')).toHaveText('alpha');

  // A second workbook with its own edit; undoing there must not touch the first one.
  await newWorkbook(page);
  await typeInCell(page, 'A1', 'beta');
  await expect(cell(page, 'A1')).toHaveText('beta');
  await selectCell(page, 'A1');
  await undoButton(page).click();
  await expect(cell(page, 'A1')).toHaveText('');

  await page.goto('/');
  await page.getByRole('link', { name: first, exact: true }).click();
  await expect(grid(page)).toBeVisible();
  await expect(cell(page, 'A1')).toHaveText('alpha');
});

/* ------------------------------------------------- REQ-3-2-2 (scenario 7) */

test('REQ-3-2-2#7: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await newWorkbook(page);
  await typeInCell(page, 'A1', 'one');
  await typeInCell(page, 'B1', 'two');

  await selectCell(page, 'A1');
  await undoButton(page).click();
  await expect(cell(page, 'B1')).toHaveText('');

  // A new modification after the undo disables Redo and blocks Ctrl+Y.
  await typeInCell(page, 'C1', 'three');
  await expect(redoButton(page)).toBeDisabled();

  await selectCell(page, 'A1');
  await page.keyboard.press('Control+Y');
  await expect(cell(page, 'B1')).toHaveText('');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('one');
  await expect(cell(page, 'B1')).toHaveText('');
  await expect(cell(page, 'C1')).toHaveText('three');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

