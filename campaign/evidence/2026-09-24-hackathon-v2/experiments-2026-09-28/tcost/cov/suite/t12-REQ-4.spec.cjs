const { test, expect } = require('@playwright/test');

async function createWorkbook(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
}

function gridCell(page, coord) {
  return page.getByRole('gridcell', { name: coord, exact: true });
}

async function selectCell(page, coord) {
  const cell = gridCell(page, coord);
  await cell.click();
  await expect(cell).toHaveAttribute('aria-selected', 'true');
}

async function setCell(page, coord, expression, display) {
  const cell = gridCell(page, coord);
  await cell.dblclick();
  const editor = page.getByLabel(`Edit ${coord}`, { exact: true });
  await editor.fill(expression);
  await editor.press('Enter');
  await expect(cell).toHaveText(display);
}

async function enterFormula(page, coord, formula) {
  await selectCell(page, coord);
  const bar = page.getByLabel('Formula bar', { exact: true });
  await bar.fill(formula);
  await bar.press('Enter');
}

async function expectFormulaBar(page, coord, value) {
  await selectCell(page, coord);
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue(value);
}

async function reloadToGrid(page) {
  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
}

test('REQ-4-2-1: REQ-4-2-1 -the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await setCell(page, 'A1', '2', '2');
  await setCell(page, 'B1', '3', '3');
  await setCell(page, 'C1', '=A1+B1', '5');
  await setCell(page, 'D1', '=C1*2', '10');

  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await setCell(page, 'A1', '=1+1', '2');
  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');

  await enterFormula(page, 'A1', '5');
  await expect(gridCell(page, 'A1')).toHaveText('5');
  await expect(gridCell(page, 'C1')).toHaveText('8');
  await expect(gridCell(page, 'D1')).toHaveText('16');
  await expectFormulaBar(page, 'C1', '=A1+B1');
  await expectFormulaBar(page, 'D1', '=C1*2');

  await page.getByRole('tab', { name: 'Sheet2', exact: true }).click();
  await expect(gridCell(page, 'A1')).toHaveText('2');
  await expectFormulaBar(page, 'A1', '=1+1');
  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();

  await reloadToGrid(page);
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(gridCell(page, 'A1')).toHaveText('5');
  await expect(gridCell(page, 'C1')).toHaveText('8');
  await expect(gridCell(page, 'D1')).toHaveText('16');
  await expectFormulaBar(page, 'C1', '=A1+B1');
  await expectFormulaBar(page, 'D1', '=C1*2');
});

test('REQ-4-2-1#2: REQ-4-2-1 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await setCell(page, 'A1', '2', '2');
  await setCell(page, 'B1', '3', '3');
  await setCell(page, 'C1', '=A1+B1', '5');
  await setCell(page, 'D1', '=C1*2', '10');

  const text = '5\t7';
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
  await selectCell(page, 'A1');
  await page.keyboard.press('Control+V');

  await expect(gridCell(page, 'A1')).toHaveText('5');
  await expect(gridCell(page, 'B1')).toHaveText('7');
  await expect(gridCell(page, 'C1')).toHaveText('12');
  await expect(gridCell(page, 'D1')).toHaveText('24');
  await expectFormulaBar(page, 'C1', '=A1+B1');
  await expectFormulaBar(page, 'D1', '=C1*2');

  await reloadToGrid(page);
  await expect(gridCell(page, 'A1')).toHaveText('5');
  await expect(gridCell(page, 'B1')).toHaveText('7');
  await expect(gridCell(page, 'C1')).toHaveText('12');
  await expect(gridCell(page, 'D1')).toHaveText('24');
  await expectFormulaBar(page, 'C1', '=A1+B1');
  await expectFormulaBar(page, 'D1', '=C1*2');
});

test('REQ-4-2-1#3: REQ-4-2-1 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await setCell(page, 'A1', '2', '2');
  await setCell(page, 'B1', '3', '3');
  await setCell(page, 'C1', '=A1+B1', '5');
  await setCell(page, 'D1', '=C1*2', '10');

  const start = gridCell(page, 'A1');
  const end = gridCell(page, 'B1');
  const startBox = await start.boundingBox();
  const endBox = await end.boundingBox();
  await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(endBox.x + endBox.width / 2, endBox.y + endBox.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(start).toHaveAttribute('aria-selected', 'true');
  await expect(end).toHaveAttribute('aria-selected', 'true');

  await page.keyboard.press('Control+X');
  await selectCell(page, 'A3');
  await page.keyboard.press('Control+V');

  await expect(gridCell(page, 'A1')).not.toHaveText('2');
  await expect(gridCell(page, 'B1')).not.toHaveText('3');
  await expect(gridCell(page, 'A3')).toHaveText('2');
  await expect(gridCell(page, 'B3')).toHaveText('3');
  await expect(gridCell(page, 'C1')).toHaveText('5');
  await expect(gridCell(page, 'D1')).toHaveText('10');
  await expectFormulaBar(page, 'C1', '=A3+B3');
  await expectFormulaBar(page, 'D1', '=C1*2');

  await page.getByRole('rowheader', { name: '3', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 row above', exact: true }).click();

  await expect(gridCell(page, 'A3')).not.toHaveText('2');
  await expect(gridCell(page, 'A4')).toHaveText('2');
  await expect(gridCell(page, 'B4')).toHaveText('3');
  await expect(gridCell(page, 'C1')).toHaveText('5');
  await expect(gridCell(page, 'D1')).toHaveText('10');
  await expectFormulaBar(page, 'C1', '=A4+B4');

  await reloadToGrid(page);
  await expect(gridCell(page, 'A4')).toHaveText('2');
  await expect(gridCell(page, 'B4')).toHaveText('3');
  await expect(gridCell(page, 'C1')).toHaveText('5');
  await expect(gridCell(page, 'D1')).toHaveText('10');
  await expectFormulaBar(page, 'C1', '=A4+B4');
  await expectFormulaBar(page, 'D1', '=C1*2');
});

test('REQ-4-2-2: REQ-4-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterFormula(page, 'C1', '=1/0');
  await expect(gridCell(page, 'C1')).toHaveText('#DIV/0!');
  await expectFormulaBar(page, 'C1', '=1/0');

  await enterFormula(page, 'D1', '=C1*2');
  await expect(gridCell(page, 'D1')).toHaveText('#DIV/0!');

  await reloadToGrid(page);
  await expect(gridCell(page, 'C1')).toHaveText('#DIV/0!');
  await expectFormulaBar(page, 'C1', '=1/0');

  await enterFormula(page, 'C1', '=1/1');
  await expect(gridCell(page, 'C1')).toHaveText('1');
  await expect(gridCell(page, 'D1')).toHaveText('2');
  await expectFormulaBar(page, 'C1', '=1/1');

  await reloadToGrid(page);
  await expect(gridCell(page, 'C1')).toHaveText('1');
  await expect(gridCell(page, 'D1')).toHaveText('2');
  await expectFormulaBar(page, 'C1', '=1/1');
});

test('REQ-4-2-2#2: REQ-4-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await setCell(page, 'A1', '2', '2');
  await enterFormula(page, 'C1', '=A0');
  await expect(gridCell(page, 'C1')).toHaveText('#REF!');
  await expectFormulaBar(page, 'C1', '=A0');

  await enterFormula(page, 'E1', '=A1+1');
  await expect(gridCell(page, 'E1')).toHaveText('3');
  await enterFormula(page, 'A1', '5');
  await expect(gridCell(page, 'E1')).toHaveText('6');
  await expect(gridCell(page, 'C1')).toHaveText('#REF!');

  await reloadToGrid(page);
  await expect(gridCell(page, 'C1')).toHaveText('#REF!');
  await expect(gridCell(page, 'E1')).toHaveText('6');
  await expectFormulaBar(page, 'C1', '=A0');
});

test('REQ-4-2-2#3: REQ-4-2-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterFormula(page, 'C1', '=UNKNOWN()');
  await expect(gridCell(page, 'C1')).toHaveText('#NAME?');
  await expectFormulaBar(page, 'C1', '=UNKNOWN()');

  await reloadToGrid(page);
  await expect(gridCell(page, 'C1')).toHaveText('#NAME?');
  await expectFormulaBar(page, 'C1', '=UNKNOWN()');
});

test('REQ-4-2-2#4: REQ-4-2-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterFormula(page, 'C1', '=1+');
  await expect(gridCell(page, 'C1')).toHaveText('#ERROR!');
  await expectFormulaBar(page, 'C1', '=1+');

  await reloadToGrid(page);
  await expect(gridCell(page, 'C1')).toHaveText('#ERROR!');
  await expectFormulaBar(page, 'C1', '=1+');
});

test('REQ-4-2-2#5: REQ-4-2-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterFormula(page, 'A1', '=A1');
  await expect(gridCell(page, 'A1')).toHaveText('#REF!');
  await expectFormulaBar(page, 'A1', '=A1');

  await reloadToGrid(page);
  await expect(gridCell(page, 'A1')).toHaveText('#REF!');
  await expectFormulaBar(page, 'A1', '=A1');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

