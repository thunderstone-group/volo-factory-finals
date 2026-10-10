const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const grid = (page) => page.getByRole('grid', { name: 'Worksheet grid', exact: true });

async function createWorkbook(page, name) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(grid(page)).toBeVisible();
  await page.getByRole('button', { name: 'Rename workbook', exact: true }).click();
  await page.getByLabel('Workbook name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(grid(page)).toBeVisible();
}

async function selectCell(page, coord) {
  await grid(page).getByRole('gridcell', { name: coord, exact: true }).click();
}

async function expectCell(page, coord, value) {
  await expect(grid(page).getByRole('gridcell', { name: coord, exact: true })).toHaveText(value);
}

async function expectFormulaBar(page, value) {
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue(value);
}

async function setCell(page, coord, value) {
  await selectCell(page, coord);
  await page.getByLabel('Formula bar', { exact: true }).fill(value);
  await page.getByLabel('Formula bar', { exact: true }).press('Enter');
  await selectCell(page, coord);
}

async function setCellInline(page, coord, value) {
  const cell = grid(page).getByRole('gridcell', { name: coord, exact: true });
  await cell.dblclick();
  await page.getByLabel('Edit ' + coord, { exact: true }).fill(value);
  await page.getByLabel('Edit ' + coord, { exact: true }).press('Enter');
  await selectCell(page, coord);
}

async function copyCell(page, source, target) {
  await selectCell(page, source);
  await page.keyboard.press('ControlOrMeta+c');
  await selectCell(page, target);
  await page.keyboard.press('ControlOrMeta+v');
  await selectCell(page, target);
}

async function pasteText(page, coord, text) {
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
  await selectCell(page, coord);
  await page.keyboard.press('ControlOrMeta+v');
}

async function insertRowAbove(page, rowNumber) {
  await page.getByRole('rowheader', { name: String(rowNumber), exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 row above', exact: true }).click();
}

test('REQ-4-1-1: REQ-4-1-1 -the requested workflow,the requested workflow', async ({ page }) => {
  const name = 'W' + u();
  await createWorkbook(page, name);
  await setCell(page, 'A1', '2');
  await setCell(page, 'B1', '3');
  await setCellInline(page, 'C1', '=A1+B1');
  await expectCell(page, 'C1', '5');
  await selectCell(page, 'C1');
  await expectFormulaBar(page, '=A1+B1');
  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expectCell(page, 'C1', '5');
  await selectCell(page, 'C1');
  await expectFormulaBar(page, '=A1+B1');
});

test('REQ-4-1-1#2: REQ-4-1-1 -the requested workflow', async ({ page }) => {
  const name = 'W' + u();
  await createWorkbook(page, name);
  await setCell(page, 'A1', '2');
  await setCell(page, 'B1', '3');
  await setCell(page, 'D1', '=(A1+B1)*2');
  await expectCell(page, 'D1', '10');
  await selectCell(page, 'D1');
  await expectFormulaBar(page, '=(A1+B1)*2');
  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expectCell(page, 'D1', '10');
  await selectCell(page, 'D1');
  await expectFormulaBar(page, '=(A1+B1)*2');
});

test('REQ-4-1-1#3: REQ-4-1-1 -the requested workflow, the requested workflow', async ({ page }) => {
  const name = 'W' + u();
  await createWorkbook(page, name);
  await setCell(page, 'A1', '2');
  await setCell(page, 'B1', '3');
  await setCell(page, 'D1', 'x');
  await setCell(page, 'E1', '=SUM(A1:D1)');
  await expectCell(page, 'E1', '5');
  await selectCell(page, 'E1');
  await expectFormulaBar(page, '=SUM(A1:D1)');
  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expectCell(page, 'E1', '5');
  await selectCell(page, 'E1');
  await expectFormulaBar(page, '=SUM(A1:D1)');
});

test('REQ-4-1-1#4: REQ-4-1-1 -the requested workflow', async ({ page }) => {
  const name = 'W' + u();
  await createWorkbook(page, name);
  await setCell(page, 'A1', '2');
  await setCell(page, 'B1', '3');
  await setCell(page, 'D1', 'x');
  await setCell(page, 'E1', '=AVERAGE(A1:D1)');
  await setCell(page, 'F1', '=MIN(A1:D1)');
  await setCell(page, 'G1', '=MAX(A1:D1)');
  await expectCell(page, 'E1', '2.5');
  await expectCell(page, 'F1', '2');
  await expectCell(page, 'G1', '3');
  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expectCell(page, 'E1', '2.5');
  await expectCell(page, 'F1', '2');
  await expectCell(page, 'G1', '3');
});

test('REQ-4-1-1#5: REQ-4-1-1 -the requested workflow', async ({ page }) => {
  const name = 'W' + u();
  await createWorkbook(page, name);
  await setCell(page, 'A1', '2');
  await setCell(page, 'B1', '3');
  await setCell(page, 'D1', 'x');
  await setCell(page, 'E1', '=count(A1:D1)');
  await expectCell(page, 'E1', '2');
  await selectCell(page, 'E1');
  await expectFormulaBar(page, '=count(A1:D1)');
  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expectCell(page, 'E1', '2');
  await selectCell(page, 'E1');
  await expectFormulaBar(page, '=count(A1:D1)');
});

test('REQ-4-1-2: REQ-4-1-2 -the requested workflow', async ({ page }) => {
  const name = 'W' + u();
  await createWorkbook(page, name);
  await setCell(page, 'A1', '2');
  await setCell(page, 'B1', '3');
  await setCell(page, 'C1', '=A1+B1');
  await expectCell(page, 'C1', '5');
  await copyCell(page, 'C1', 'D1');
  await expectCell(page, 'D1', '8');
  await selectCell(page, 'D1');
  await expectFormulaBar(page, '=B1+C1');
  await selectCell(page, 'C1');
  await expectFormulaBar(page, '=A1+B1');
  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expectCell(page, 'D1', '8');
  await selectCell(page, 'D1');
  await expectFormulaBar(page, '=B1+C1');
});

test('REQ-4-1-2#2: REQ-4-1-2 -the requested workflow', async ({ page }) => {
  const name = 'W' + u();
  await createWorkbook(page, name);
  await setCell(page, 'A1', '2');
  await setCell(page, 'B1', '3');
  await setCell(page, 'C1', '=$A$1+B1');
  await expectCell(page, 'C1', '5');
  await copyCell(page, 'C1', 'D1');
  await expectCell(page, 'D1', '7');
  await selectCell(page, 'D1');
  await expectFormulaBar(page, '=$A$1+C1');
  await selectCell(page, 'C1');
  await expectFormulaBar(page, '=$A$1+B1');
  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expectCell(page, 'D1', '7');
  await selectCell(page, 'D1');
  await expectFormulaBar(page, '=$A$1+C1');
});

test('REQ-4-2-1: REQ-4-2-1 -the requested workflow,the requested workflow', async ({ page }) => {
  const name = 'W' + u();
  await createWorkbook(page, name);
  await setCell(page, 'A1', '2');
  await setCell(page, 'B1', '3');
  await setCell(page, 'C1', '=A1+B1');
  await setCell(page, 'D1', '=C1*2');
  await expectCell(page, 'C1', '5');
  await expectCell(page, 'D1', '10');
  await setCell(page, 'A1', '5');
  await expectCell(page, 'C1', '8');
  await expectCell(page, 'D1', '16');
  await selectCell(page, 'C1');
  await expectFormulaBar(page, '=A1+B1');
  await selectCell(page, 'D1');
  await expectFormulaBar(page, '=C1*2');
  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expectCell(page, 'A1', '5');
  await expectCell(page, 'C1', '8');
  await expectCell(page, 'D1', '16');
  await selectCell(page, 'C1');
  await expectFormulaBar(page, '=A1+B1');
  await selectCell(page, 'D1');
  await expectFormulaBar(page, '=C1*2');
});

test('REQ-4-2-1#2: REQ-4-2-1 -the requested workflow', async ({ page }) => {
  const name = 'W' + u();
  await createWorkbook(page, name);
  await setCell(page, 'A1', '2');
  await setCell(page, 'B1', '3');
  await setCell(page, 'C1', '=A1+B1');
  await setCell(page, 'D1', '=C1*2');
  await expectCell(page, 'C1', '5');
  await expectCell(page, 'D1', '10');
  await pasteText(page, 'A1', '5\t7');
  await expectCell(page, 'A1', '5');
  await expectCell(page, 'B1', '7');
  await expectCell(page, 'C1', '12');
  await expectCell(page, 'D1', '24');
  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expectCell(page, 'C1', '12');
  await expectCell(page, 'D1', '24');
});

test('REQ-4-2-1#3: REQ-4-2-1 -the requested workflow', async ({ page }) => {
  const name = 'W' + u();
  await createWorkbook(page, name);
  await setCell(page, 'A1', '2');
  await setCell(page, 'B1', '3');
  await setCell(page, 'C1', '=A1+B1');
  await expectCell(page, 'C1', '5');
  await insertRowAbove(page, 1);
  await expectCell(page, 'C2', '5');
  await selectCell(page, 'C2');
  await expectFormulaBar(page, '=A2+B2');
  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expectCell(page, 'C2', '5');
  await selectCell(page, 'C2');
  await expectFormulaBar(page, '=A2+B2');
});

test('REQ-4-2-2: REQ-4-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  const name = 'W' + u();
  await createWorkbook(page, name);
  await setCell(page, 'A1', '2');
  await setCell(page, 'B1', '3');
  await setCell(page, 'C1', '=1/0');
  await expectCell(page, 'C1', '#DIV/0!');
  await selectCell(page, 'C1');
  await expectFormulaBar(page, '=1/0');
  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expectCell(page, 'A1', '2');
  await expectCell(page, 'B1', '3');
  await expectCell(page, 'C1', '#DIV/0!');
  await selectCell(page, 'C1');
  await expectFormulaBar(page, '=1/0');
});

test('REQ-4-2-2#2: REQ-4-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  const name = 'W' + u();
  await createWorkbook(page, name);
  await setCell(page, 'C1', '=NOTAFUNC(1)');
  await expectCell(page, 'C1', '#NAME?');
  await selectCell(page, 'C1');
  await expectFormulaBar(page, '=NOTAFUNC(1)');
  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expectCell(page, 'C1', '#NAME?');
  await selectCell(page, 'C1');
  await expectFormulaBar(page, '=NOTAFUNC(1)');
});

test('REQ-4-2-2#3: REQ-4-2-2 -the requested workflow', async ({ page }) => {
  const name = 'W' + u();
  await createWorkbook(page, name);
  await setCell(page, 'C1', '=A1+');
  await expectCell(page, 'C1', '#ERROR!');
  await selectCell(page, 'C1');
  await expectFormulaBar(page, '=A1+');
  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expectCell(page, 'C1', '#ERROR!');
  await selectCell(page, 'C1');
  await expectFormulaBar(page, '=A1+');
});

test('REQ-4-2-2#4: REQ-4-2-2 -the requested workflow', async ({ page }) => {
  const name = 'W' + u();
  await createWorkbook(page, name);
  await setCell(page, 'C1', '=C1');
  await expectCell(page, 'C1', '#REF!');
  await selectCell(page, 'C1');
  await expectFormulaBar(page, '=C1');
  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expectCell(page, 'C1', '#REF!');
  await selectCell(page, 'C1');
  await expectFormulaBar(page, '=C1');
});

test('REQ-4-2-2#5: REQ-4-2-2 -the requested workflow', async ({ page }) => {
  const name = 'W' + u();
  await createWorkbook(page, name);
  await setCell(page, 'A1', '2');
  await setCell(page, 'B1', '3');
  await setCell(page, 'D1', '=1/0');
  await setCell(page, 'E1', '=D1*2');
  await expectCell(page, 'D1', '#DIV/0!');
  await expectCell(page, 'E1', '#DIV/0!');
  await setCell(page, 'D1', '=A1+B1');
  await expectCell(page, 'D1', '5');
  await expectCell(page, 'E1', '10');
  await selectCell(page, 'D1');
  await expectFormulaBar(page, '=A1+B1');
  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expectCell(page, 'D1', '5');
  await expectCell(page, 'E1', '10');
  await selectCell(page, 'D1');
  await expectFormulaBar(page, '=A1+B1');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

