const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function grid(page) {
  return page.getByRole('grid', { name: 'Worksheet grid', exact: true });
}

function cell(page, coord) {
  return grid(page).getByRole('gridcell', { name: coord, exact: true });
}

function formulaBar(page) {
  return page.getByLabel('Formula bar', { exact: true });
}

async function createBlankWorkbook(page, name) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.getByRole('tab', { name: 'Sheet1', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Rename workbook', exact: true }).click();
  await page.getByLabel('Workbook name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(formulaBar(page)).toBeVisible();
}

async function selectCell(page, coord) {
  await cell(page, coord).click();
}

async function selectRange(page, startCoord, endCoord) {
  const start = cell(page, startCoord);
  const end = cell(page, endCoord);
  await start.scrollIntoViewIfNeeded();
  await end.scrollIntoViewIfNeeded();
  const startBox = await start.boundingBox();
  const endBox = await end.boundingBox();
  await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(endBox.x + endBox.width / 2, endBox.y + endBox.height / 2, { steps: 5 });
  await page.mouse.up();
}

async function enterCell(page, coord, value) {
  await selectCell(page, coord);
  const fb = formulaBar(page);
  await fb.fill(value);
  await fb.press('Enter');
}

async function expectCellValue(page, coord, value) {
  await expect(cell(page, coord)).toHaveText(value);
}

async function expectFormula(page, coord, formula) {
  await selectCell(page, coord);
  await expect(formulaBar(page)).toHaveValue(formula);
}

test('REQ-3-1-1: REQ-3-1-1 -the requested workflow,the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page, 't3_1_1_' + u());

  await enterCell(page, 'A1', 'East');
  await enterCell(page, 'B1', '1200');

  await expectCellValue(page, 'A1', 'East');
  await expectCellValue(page, 'B1', '1200');
  await expectFormula(page, 'A1', 'East');

  await page.reload();
  await expectCellValue(page, 'A1', 'East');
  await expectCellValue(page, 'B1', '1200');
  await expectFormula(page, 'A1', 'East');
});

test('REQ-3-1-1#2: REQ-3-1-1 -Escape the requested workflow,the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page, 't3_1_1e_' + u());

  await enterCell(page, 'A1', 'Original');
  await selectCell(page, 'A1');
  await formulaBar(page).fill('Changed');
  await formulaBar(page).press('Escape');

  await expect(cell(page, 'A1')).toHaveText('Original');
  await expect(formulaBar(page)).toHaveValue('Original');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('Original');
});

test('REQ-3-1-1#3: REQ-3-1-1 -the requested workflow, the requested workflow, the requested workflow, the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page, 't3_1_1f_' + u());

  await enterCell(page, 'A1', '2');
  await enterCell(page, 'B1', '3');
  await enterCell(page, 'C1', '=A1+B1');
  await enterCell(page, 'C2', '=C1*2');

  await expectCellValue(page, 'C1', '5');
  await expectCellValue(page, 'C2', '10');
  await expectFormula(page, 'C1', '=A1+B1');
  await expectFormula(page, 'C2', '=C1*2');

  await enterCell(page, 'A1', '10');
  await expectCellValue(page, 'C1', '13');
  await expectCellValue(page, 'C2', '26');

  await page.reload();
  await expectCellValue(page, 'C1', '13');
  await expectCellValue(page, 'C2', '26');
  await expectFormula(page, 'C1', '=A1+B1');
  await expectFormula(page, 'C2', '=C1*2');
});

test('REQ-3-1-1#4: REQ-3-1-1 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page, 't3_1_1c_' + u());

  await selectCell(page, 'A1');
  await formulaBar(page).fill('North');
  await cell(page, 'B1').click();

  await expect(cell(page, 'A1')).toHaveText('North');
  await expectFormula(page, 'B1', '');
});

test('REQ-3-1-2: REQ-3-1-2 -the requested workflow B2 the requested workflow,the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page, 't3_1_2b_' + u());

  await page.evaluate((text) => navigator.clipboard.writeText(text), '11\t12\n13\t14');
  await selectCell(page, 'B2');
  await page.keyboard.press('Control+v');

  await expectCellValue(page, 'B2', '11');
  await expectCellValue(page, 'C2', '12');
  await expectCellValue(page, 'B3', '13');
  await expectCellValue(page, 'C3', '14');

  await page.reload();
  await expectCellValue(page, 'B2', '11');
  await expectCellValue(page, 'C3', '14');
});

test('REQ-3-1-2#2: REQ-3-1-2 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page, 't3_1_2p_' + u());

  await page.evaluate((text) => navigator.clipboard.writeText(text), 'x\t\nz\tw');
  await cell(page, 'A1').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Paste', exact: true }).click();

  await expect(cell(page, 'A1')).toHaveText('x');
  await expect(cell(page, 'B1')).toHaveText('');
  await expect(cell(page, 'A2')).toHaveText('z');
  await expect(cell(page, 'B2')).toHaveText('w');

  await page.reload();
  await expect(cell(page, 'B1')).toHaveText('');
  await expect(cell(page, 'B2')).toHaveText('w');
});

test('REQ-3-1-2#3: REQ-3-1-2 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page, 't3_1_2r_' + u());

  await enterCell(page, 'B2', '2');
  await enterCell(page, 'D1', '=B2*2');
  await expectCellValue(page, 'D1', '4');

  await page.evaluate((text) => navigator.clipboard.writeText(text), '5\t6\n7\t8');
  await selectCell(page, 'B2');
  await page.keyboard.press('Control+v');

  await expectCellValue(page, 'B2', '5');
  await expectCellValue(page, 'C3', '8');
  await expectCellValue(page, 'D1', '10');

  await page.reload();
  await expectCellValue(page, 'D1', '10');
});

test('REQ-3-1-2#4: REQ-3-1-2 -the requested workflow A1 the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page, 't3_1_2a_' + u());

  await enterCell(page, 'E1', 'outside');

  await page.evaluate((text) => navigator.clipboard.writeText(text), '1\t2\n3\t4');
  await selectCell(page, 'A1');
  await page.keyboard.press('Control+v');

  await expectCellValue(page, 'A1', '1');
  await expectCellValue(page, 'B1', '2');
  await expectCellValue(page, 'A2', '3');
  await expectCellValue(page, 'B2', '4');
  await expectCellValue(page, 'E1', 'outside');

  await page.reload();
  await expectCellValue(page, 'A1', '1');
  await expectCellValue(page, 'B2', '4');
  await expectCellValue(page, 'E1', 'outside');
});

test('REQ-3-1-2#5: REQ-3-1-2 -the requested workflow C3 the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page, 't3_1_2c_' + u());

  await page.evaluate((text) => navigator.clipboard.writeText(text), 'a\tb\nc\td');
  await selectCell(page, 'C3');
  await page.keyboard.press('Control+v');

  await expectCellValue(page, 'C3', 'a');
  await expectCellValue(page, 'D3', 'b');
  await expectCellValue(page, 'C4', 'c');
  await expectCellValue(page, 'D4', 'd');

  await page.reload();
  await expectCellValue(page, 'C3', 'a');
  await expectCellValue(page, 'D4', 'd');
});

test('REQ-3-1-3: REQ-3-1-3 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page, 't3_1_3s_' + u());

  const gridEl = grid(page);
  await expect(gridEl).toHaveAttribute('aria-multiselectable', 'true');

  await cell(page, 'A1').click();
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'B1')).toHaveAttribute('aria-selected', 'false');

  await cell(page, 'C3').click();
  await expect(cell(page, 'C3')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'false');

  await page.reload();
  await expect(cell(page, 'C3')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'false');
});

test('REQ-3-1-3#2: REQ-3-1-3 -the requested workflow,the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page, 't3_1_3r_' + u());

  await selectRange(page, 'A1', 'B2');

  for (const coord of ['A1', 'B1', 'A2', 'B2']) {
    await expect(cell(page, coord)).toHaveAttribute('aria-selected', 'true');
  }
  await expect(cell(page, 'C1')).toHaveAttribute('aria-selected', 'false');

  await page.reload();
  for (const coord of ['A1', 'B1', 'A2', 'B2']) {
    await expect(cell(page, coord)).toHaveAttribute('aria-selected', 'true');
  }
  await expect(cell(page, 'C1')).toHaveAttribute('aria-selected', 'false');

  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await cell(page, 'D1').click();
  await expect(cell(page, 'D1')).toHaveAttribute('aria-selected', 'true');

  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  for (const coord of ['A1', 'B1', 'A2', 'B2']) {
    await expect(cell(page, coord)).toHaveAttribute('aria-selected', 'true');
  }
});

test('REQ-3-2-1: REQ-3-2-1 -the requested workflow A1:B2 the requested workflow D1:E2,the requested workflow, the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page, 't3_2_1c_' + u());

  await enterCell(page, 'A1', 'Item');
  await enterCell(page, 'B1', 'Qty');
  await enterCell(page, 'A2', 'Pen');
  await enterCell(page, 'B2', '4');

  await selectRange(page, 'A1', 'B2');
  await page.keyboard.press('Control+c');
  await cell(page, 'D1').click();
  await page.keyboard.press('Control+v');

  await expectCellValue(page, 'D1', 'Item');
  await expectCellValue(page, 'E1', 'Qty');
  await expectCellValue(page, 'D2', 'Pen');
  await expectCellValue(page, 'E2', '4');
  await expectCellValue(page, 'A1', 'Item');
  await expectCellValue(page, 'B2', '4');

  await page.reload();
  await expectCellValue(page, 'D1', 'Item');
  await expectCellValue(page, 'E2', '4');
});

test('REQ-3-2-1#2: REQ-3-2-1 -the requested workflow A1:B2 the requested workflow D1:E2,the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page, 't3_2_1x_' + u());

  await enterCell(page, 'A1', 'Item');
  await enterCell(page, 'B1', 'Qty');
  await enterCell(page, 'A2', 'Pen');
  await enterCell(page, 'B2', '4');

  await selectRange(page, 'A1', 'B2');
  await page.keyboard.press('Control+x');
  await cell(page, 'D1').click();
  await page.keyboard.press('Control+v');

  await expectCellValue(page, 'D1', 'Item');
  await expectCellValue(page, 'E1', 'Qty');
  await expectCellValue(page, 'D2', 'Pen');
  await expectCellValue(page, 'E2', '4');
  await expect(cell(page, 'A1')).toHaveText('');
  await expect(cell(page, 'B2')).toHaveText('');

  await page.reload();
  await expect(cell(page, 'D1')).toHaveText('Item');
  await expect(cell(page, 'A1')).toHaveText('');
});

test('REQ-3-2-1#3: REQ-3-2-1 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page, 't3_2_1f_' + u());

  await enterCell(page, 'A1', '2');
  await enterCell(page, 'B1', '3');
  await enterCell(page, 'A2', '4');
  await enterCell(page, 'B2', '=$A$1*B1');

  await expectCellValue(page, 'B2', '6');

  await selectRange(page, 'A1', 'B2');
  await page.keyboard.press('Control+c');
  await cell(page, 'D1').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Paste', exact: true }).click();

  await expectCellValue(page, 'D1', '2');
  await expectCellValue(page, 'E1', '3');
  await expectCellValue(page, 'D2', '4');
  await expectCellValue(page, 'E2', '6');
  await expectFormula(page, 'E2', '=$A$1*E1');
  await expectCellValue(page, 'B2', '6');

  await page.reload();
  await expectCellValue(page, 'E2', '6');
  await expectFormula(page, 'E2', '=$A$1*E1');
});

test('REQ-3-2-1#4: REQ-3-2-1 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page, 't3_2_1m_' + u());

  await enterCell(page, 'A1', 'Item');
  await enterCell(page, 'B1', 'Qty');
  await enterCell(page, 'A2', 'Pen');
  await enterCell(page, 'B2', '4');

  await selectRange(page, 'A1', 'B2');
  await page.keyboard.press('Control+c');
  await cell(page, 'D1').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Paste', exact: true }).click();

  await expectCellValue(page, 'D1', 'Item');
  await expectCellValue(page, 'E1', 'Qty');
  await expectCellValue(page, 'D2', 'Pen');
  await expectCellValue(page, 'E2', '4');
  await expectCellValue(page, 'A1', 'Item');
  await expectCellValue(page, 'B2', '4');

  await page.reload();
  await expectCellValue(page, 'D1', 'Item');
  await expectCellValue(page, 'E2', '4');
  await expectCellValue(page, 'A1', 'Item');
});

test('REQ-3-2-2: REQ-3-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page, 't3_2_2u_' + u());

  await enterCell(page, 'A1', 'one');
  await enterCell(page, 'A1', 'two');

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(cell(page, 'A1')).toHaveText('one');

  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(cell(page, 'A1')).toHaveText('two');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('two');
});

test('REQ-3-2-2#2: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page, 't3_2_2r_' + u());

  await enterCell(page, 'A1', 'data');
  await page.getByRole('rowheader', { name: '1', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 row above', exact: true }).click();

  await expect(cell(page, 'A2')).toHaveText('data');
  await expect(cell(page, 'A1')).toHaveText('');

  await page.keyboard.press('Control+z');
  await expect(cell(page, 'A1')).toHaveText('data');

  await page.keyboard.press('Control+y');
  await expect(cell(page, 'A2')).toHaveText('data');
  await expect(cell(page, 'A1')).toHaveText('');

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('data');
});

test('REQ-3-2-2#3: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page, 't3_2_2p_' + u());

  await page.evaluate((text) => navigator.clipboard.writeText(text), 'a\tb\nc\td');
  await cell(page, 'A1').click();
  await page.keyboard.press('Control+v');

  await expect(cell(page, 'A1')).toHaveText('a');
  await expect(cell(page, 'B2')).toHaveText('d');

  await page.keyboard.press('Control+z');
  await expect(cell(page, 'A1')).toHaveText('');
  await expect(cell(page, 'B2')).toHaveText('');

  await page.keyboard.press('Control+y');
  await expect(cell(page, 'A1')).toHaveText('a');
  await expect(cell(page, 'B2')).toHaveText('d');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('a');
});

test('REQ-3-2-2#4: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page, 't3_2_2c_' + u());

  await enterCell(page, 'A1', 'first');
  await enterCell(page, 'A1', 'second');
  await enterCell(page, 'A1', 'third');

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(cell(page, 'A1')).toHaveText('first');

  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(cell(page, 'A1')).toHaveText('third');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('third');
});

test('REQ-3-2-2#5: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page, 't3_2_2m_' + u());

  await enterCell(page, 'A1', 'x');
  await enterCell(page, 'A2', 'y');

  await selectRange(page, 'A1', 'A2');
  await page.keyboard.press('Control+x');
  await cell(page, 'B1').click();
  await page.keyboard.press('Control+v');

  await expect(cell(page, 'B1')).toHaveText('x');
  await expect(cell(page, 'B2')).toHaveText('y');

  await page.keyboard.press('Control+z');
  await expect(cell(page, 'A1')).toHaveText('x');
  await expect(cell(page, 'A2')).toHaveText('y');
  await expect(cell(page, 'B1')).toHaveText('');

  await page.keyboard.press('Control+y');
  await expect(cell(page, 'B1')).toHaveText('x');
  await expect(cell(page, 'B2')).toHaveText('y');

  await page.reload();
  await expect(cell(page, 'B1')).toHaveText('x');
});

test('REQ-3-2-2#6: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page, 't3_2_2d_' + u());

  await enterCell(page, 'A1', 'one');
  await enterCell(page, 'A1', 'two');

  const undo = page.getByRole('button', { name: 'Undo', exact: true });
  const redo = page.getByRole('button', { name: 'Redo', exact: true });

  await undo.click();
  await expect(cell(page, 'A1')).toHaveText('one');

  await enterCell(page, 'A1', 'three');
  await expect(redo).toBeDisabled();

  await page.keyboard.press('Control+y');
  await expect(cell(page, 'A1')).toHaveText('three');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('three');
});

test('REQ-3-2-2#7: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page, 't3_2_2col_' + u());

  await enterCell(page, 'A1', 'x');
  await page.getByRole('columnheader', { name: 'A', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 column right', exact: true }).click();

  await expect(cell(page, 'B1')).toHaveText('x');
  await expect(cell(page, 'A1')).toHaveText('');

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(cell(page, 'A1')).toHaveText('x');

  await page.keyboard.press('Control+y');
  await expect(cell(page, 'B1')).toHaveText('x');
  await expect(cell(page, 'A1')).toHaveText('');

  await page.reload();
  await expect(cell(page, 'B1')).toHaveText('x');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

