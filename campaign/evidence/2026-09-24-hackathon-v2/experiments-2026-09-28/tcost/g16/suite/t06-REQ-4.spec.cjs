const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function createWorkbook(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();

  const name = 'w' + u();
  await page.getByRole('button', { name: 'Rename workbook', exact: true }).click();
  await page.getByLabel('Workbook name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  return name;
}

async function selectCell(page, coord) {
  await page.getByRole('gridcell', { name: coord, exact: true }).click();
}

async function enterInFormulaBar(page, coord, value) {
  await selectCell(page, coord);
  const bar = page.getByLabel('Formula bar', { exact: true });
  await bar.fill(value);
  await bar.press('Enter');
}

async function enterInGrid(page, coord, value) {
  const cell = page.getByRole('gridcell', { name: coord, exact: true });
  await cell.dblclick();
  const editor = page.getByLabel(`Edit ${coord}`, { exact: true });
  await editor.fill(value);
  await editor.press('Enter');
}

async function expectCell(page, coord, value) {
  await expect(page.getByRole('gridcell', { name: coord, exact: true })).toHaveText(value);
}

async function expectFormulaBar(page, coord, formula) {
  await selectCell(page, coord);
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue(formula);
}

async function selectRange(page, start, end) {
  const startCell = page.getByRole('gridcell', { name: start, exact: true });
  const endCell = page.getByRole('gridcell', { name: end, exact: true });
  const sb = await startCell.boundingBox();
  const eb = await endCell.boundingBox();
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.mouse.down();
  await page.mouse.move(eb.x + eb.width / 2, eb.y + eb.height / 2, { steps: 8 });
  await page.mouse.up();
}

async function copyRange(page, start, end) {
  await selectRange(page, start, end);
  await page.getByRole('gridcell', { name: start, exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Copy', exact: true }).click();
}

async function pasteTo(page, target) {
  const targetCell = page.getByRole('gridcell', { name: target, exact: true });
  await targetCell.click();
  await targetCell.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Paste', exact: true }).click();
}

test('REQ-4-1-1: REQ-4-1-1 -the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterInFormulaBar(page, 'A1', '2');
  await enterInFormulaBar(page, 'B1', '3');
  await enterInFormulaBar(page, 'C1', '=A1+B1');
  await enterInGrid(page, 'D1', '=A1*B1+1');

  await expectCell(page, 'C1', '5');
  await expectCell(page, 'D1', '7');
  await expectFormulaBar(page, 'C1', '=A1+B1');
  await expectFormulaBar(page, 'D1', '=A1*B1+1');

  await page.reload();
  await expectCell(page, 'C1', '5');
  await expectCell(page, 'D1', '7');
  await expectFormulaBar(page, 'C1', '=A1+B1');
  await expectFormulaBar(page, 'D1', '=A1*B1+1');
});

test('REQ-4-1-1#2: REQ-4-1-1 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterInFormulaBar(page, 'A1', '2');
  await enterInFormulaBar(page, 'B1', '4');
  await enterInFormulaBar(page, 'C1', '6');
  await enterInFormulaBar(page, 'D1', '=SUM(A1:C1)');
  await enterInFormulaBar(page, 'E1', '=AVERAGE(A1:C1)');

  await expectCell(page, 'D1', '12');
  await expectCell(page, 'E1', '4');
  await expectFormulaBar(page, 'D1', '=SUM(A1:C1)');
  await expectFormulaBar(page, 'E1', '=AVERAGE(A1:C1)');

  await page.reload();
  await expectCell(page, 'D1', '12');
  await expectCell(page, 'E1', '4');
});

test('REQ-4-1-1#3: REQ-4-1-1 -the requested workflow, the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterInFormulaBar(page, 'A1', '2');
  await enterInFormulaBar(page, 'C1', '7');
  await enterInFormulaBar(page, 'D1', 'text');
  await enterInGrid(page, 'E1', '=COUNT(A1:D1)');
  await enterInGrid(page, 'F1', '=MIN(A1:D1)');
  await enterInGrid(page, 'G1', '=MAX(A1:D1)');
  await enterInGrid(page, 'H1', '=SUM(A1:D1)');

  await expectCell(page, 'E1', '2');
  await expectCell(page, 'F1', '2');
  await expectCell(page, 'G1', '7');
  await expectCell(page, 'H1', '9');

  await page.reload();
  await expectCell(page, 'E1', '2');
  await expectCell(page, 'F1', '2');
  await expectCell(page, 'G1', '7');
  await expectCell(page, 'H1', '9');
});

test('REQ-4-1-1#4: REQ-4-1-1 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterInFormulaBar(page, 'A1', '5');
  await enterInFormulaBar(page, 'B1', '3');
  await enterInFormulaBar(page, 'C1', '=sum(A1:B1)');
  await enterInFormulaBar(page, 'D1', '=aVeRaGe(A1:B1)');
  await enterInFormulaBar(page, 'E1', '=(A1+B1)*2');

  await expectCell(page, 'C1', '8');
  await expectCell(page, 'D1', '4');
  await expectCell(page, 'E1', '16');
  await expectFormulaBar(page, 'C1', '=sum(A1:B1)');
  await expectFormulaBar(page, 'D1', '=aVeRaGe(A1:B1)');

  await page.reload();
  await expectCell(page, 'C1', '8');
  await expectCell(page, 'D1', '4');
  await expectCell(page, 'E1', '16');
});

test('REQ-4-1-1#5: REQ-4-1-1 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterInFormulaBar(page, 'A1', '2');
  await enterInFormulaBar(page, 'C1', '4');
  await enterInFormulaBar(page, 'D1', '=AVERAGE(A1:C1)');

  await expectCell(page, 'D1', '3');

  await page.reload();
  await expectCell(page, 'D1', '3');
});

test('REQ-4-1-2: REQ-4-1-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterInFormulaBar(page, 'A1', '1');
  await enterInFormulaBar(page, 'B1', '2');
  await enterInFormulaBar(page, 'A2', '3');
  await enterInFormulaBar(page, 'B2', '4');
  await enterInFormulaBar(page, 'C1', '=A1+B1');
  await enterInFormulaBar(page, 'D1', '=$A$1+B1');

  await expectCell(page, 'C1', '3');
  await expectCell(page, 'D1', '3');

  await copyRange(page, 'C1', 'D1');
  await pasteTo(page, 'C2');

  await expectCell(page, 'C2', '7');
  await expectCell(page, 'D2', '5');
  await expectFormulaBar(page, 'C2', '=A2+B2');
  await expectFormulaBar(page, 'D2', '=$A$1+B2');
  await expectCell(page, 'C1', '3');
  await expectCell(page, 'D1', '3');

  await page.reload();
  await expectCell(page, 'C2', '7');
  await expectCell(page, 'D2', '5');
  await expectFormulaBar(page, 'C2', '=A2+B2');
  await expectFormulaBar(page, 'D2', '=$A$1+B2');
});

test('REQ-4-1-2#2: REQ-4-1-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterInFormulaBar(page, 'A1', '2');
  await enterInFormulaBar(page, 'A2', '3');
  await enterInFormulaBar(page, 'B2', '=A1');

  await expectCell(page, 'B2', '2');

  await copyRange(page, 'B2', 'B2');
  await pasteTo(page, 'A2');

  await expectCell(page, 'A2', '#REF!');
  await expectFormulaBar(page, 'A2', '=#REF!');
  await expectCell(page, 'B2', '2');
  await expectFormulaBar(page, 'B2', '=A1');

  await page.reload();
  await expectCell(page, 'A2', '#REF!');
  await expectFormulaBar(page, 'A2', '=#REF!');
  await expectCell(page, 'B2', '2');
});

test('REQ-4-2-1: REQ-4-2-1 -the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterInFormulaBar(page, 'A1', '2');
  await enterInFormulaBar(page, 'B1', '3');
  await enterInFormulaBar(page, 'C1', '=A1+B1');
  await enterInFormulaBar(page, 'D1', '=C1*2');

  await expectCell(page, 'C1', '5');
  await expectCell(page, 'D1', '10');

  await enterInFormulaBar(page, 'A1', '10');

  await expectCell(page, 'C1', '13');
  await expectCell(page, 'D1', '26');
  await expectFormulaBar(page, 'C1', '=A1+B1');
  await expectFormulaBar(page, 'D1', '=C1*2');

  await page.reload();
  await expectCell(page, 'C1', '13');
  await expectCell(page, 'D1', '26');
  await expectFormulaBar(page, 'C1', '=A1+B1');
  await expectFormulaBar(page, 'D1', '=C1*2');
});

test('REQ-4-2-1#2: REQ-4-2-1 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterInFormulaBar(page, 'A1', '1');
  await enterInFormulaBar(page, 'B1', '2');
  await enterInFormulaBar(page, 'A2', '3');
  await enterInFormulaBar(page, 'B2', '4');
  await enterInFormulaBar(page, 'D1', '=A1+B1');
  await enterInFormulaBar(page, 'D2', '=A2+B2');

  await expectCell(page, 'D1', '3');
  await expectCell(page, 'D2', '7');

  const table = '10\t20\n30\t40';
  await page.evaluate((t) => navigator.clipboard.writeText(t), table);
  await selectCell(page, 'A1');
  await page.keyboard.press('Control+v');

  await expectCell(page, 'A1', '10');
  await expectCell(page, 'B1', '20');
  await expectCell(page, 'A2', '30');
  await expectCell(page, 'B2', '40');
  await expectCell(page, 'D1', '30');
  await expectCell(page, 'D2', '70');

  await page.reload();
  await expectCell(page, 'D1', '30');
  await expectCell(page, 'D2', '70');
});

test('REQ-4-2-1#3: REQ-4-2-1 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterInFormulaBar(page, 'A1', '1');
  await enterInFormulaBar(page, 'B1', '2');
  await enterInFormulaBar(page, 'A2', '3');
  await enterInFormulaBar(page, 'B2', '4');
  await enterInFormulaBar(page, 'C2', '=A2+B2');

  await expectCell(page, 'C2', '7');

  await page.getByRole('rowheader', { name: '1', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 row below', exact: true }).click();

  await expectCell(page, 'C3', '7');
  await expectFormulaBar(page, 'C3', '=A3+B3');

  await page.reload();
  await expectCell(page, 'C3', '7');
  await expectFormulaBar(page, 'C3', '=A3+B3');
});

test('REQ-4-2-2: REQ-4-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterInFormulaBar(page, 'A1', '2');
  await enterInFormulaBar(page, 'B1', '3');
  await enterInFormulaBar(page, 'C1', '=1/0');

  await expectCell(page, 'C1', '#DIV/0!');
  await expectFormulaBar(page, 'C1', '=1/0');

  await page.reload();
  await expectCell(page, 'C1', '#DIV/0!');
  await expectFormulaBar(page, 'C1', '=1/0');

  await enterInGrid(page, 'C1', '=2+3');
  await expectCell(page, 'C1', '5');
  await expectFormulaBar(page, 'C1', '=2+3');

  await page.reload();
  await expectCell(page, 'C1', '5');
  await expectFormulaBar(page, 'C1', '=2+3');
});

test('REQ-4-2-2#2: REQ-4-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterInFormulaBar(page, 'A1', '2');
  await enterInFormulaBar(page, 'C1', '=A0');

  await expectCell(page, 'C1', '#REF!');
  await expectFormulaBar(page, 'C1', '=A0');

  await page.reload();
  await expectCell(page, 'C1', '#REF!');
  await expectFormulaBar(page, 'C1', '=A0');
});

test('REQ-4-2-2#3: REQ-4-2-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterInFormulaBar(page, 'A1', '1');
  await enterInFormulaBar(page, 'B1', '=NOPE(1)');

  await expectCell(page, 'B1', '#NAME?');
  await expectFormulaBar(page, 'B1', '=NOPE(1)');

  await enterInFormulaBar(page, 'C1', '=2+3');
  await expectCell(page, 'C1', '5');

  await page.reload();
  await expectCell(page, 'B1', '#NAME?');
  await expectFormulaBar(page, 'B1', '=NOPE(1)');
  await expectCell(page, 'C1', '5');
});

test('REQ-4-2-2#4: REQ-4-2-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterInFormulaBar(page, 'A1', '1');
  await enterInFormulaBar(page, 'B1', '=1+*2');

  await expectCell(page, 'B1', '#ERROR!');
  await expectFormulaBar(page, 'B1', '=1+*2');

  await page.reload();
  await expectCell(page, 'B1', '#ERROR!');
  await expectFormulaBar(page, 'B1', '=1+*2');
});

test('REQ-4-2-2#5: REQ-4-2-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterInFormulaBar(page, 'A1', '1');
  await enterInFormulaBar(page, 'C1', '=C1');

  await expectCell(page, 'C1', '#REF!');
  await expectFormulaBar(page, 'C1', '=C1');

  await page.reload();
  await expectCell(page, 'C1', '#REF!');
  await expectFormulaBar(page, 'C1', '=C1');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

