const { test, expect } = require('@playwright/test');

const unique = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const formulaBar = (page) => page.getByLabel('Formula bar', { exact: true });
const grid = (page) => page.getByRole('grid', { name: 'Worksheet grid', exact: true });
const cell = (page, coord) => grid(page).getByRole('gridcell', { name: coord, exact: true });

async function selectCell(page, coord) {
  await cell(page, coord).click();
}

async function enterCell(page, coord, value) {
  await selectCell(page, coord);
  await formulaBar(page).fill(value);
  await formulaBar(page).press('Enter');
}

async function createWorkbook(page) {
  const name = 'wb-' + unique();
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.getByRole('button', { name: 'Rename workbook', exact: true }).click();
  await page.getByLabel('Workbook name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
}

async function createFormulaWorkbook(page) {
  await createWorkbook(page);
  await enterCell(page, 'A1', '2');
  await enterCell(page, 'B1', '3');
  await enterCell(page, 'C1', '=A1+B1');
  await enterCell(page, 'D1', '=C1*2');
}

test('REQ-4-2-1: REQ-4-2-1 -the requested workflow,the requested workflow', async ({ page }) => {
  await createFormulaWorkbook(page);

  await enterCell(page, 'A1', '5');

  await expect(cell(page, 'C1')).toHaveText('8');
  await expect(cell(page, 'D1')).toHaveText('16');

  await selectCell(page, 'C1');
  await expect(formulaBar(page)).toHaveValue('=A1+B1');
  await selectCell(page, 'D1');
  await expect(formulaBar(page)).toHaveValue('=C1*2');

  await page.reload();

  await expect(cell(page, 'C1')).toHaveText('8');
  await expect(cell(page, 'D1')).toHaveText('16');
  await selectCell(page, 'C1');
  await expect(formulaBar(page)).toHaveValue('=A1+B1');
  await selectCell(page, 'D1');
  await expect(formulaBar(page)).toHaveValue('=C1*2');
});

test('REQ-4-2-1#2: REQ-4-2-1 -the requested workflow', async ({ page }) => {
  await createFormulaWorkbook(page);

  await page.evaluate((t) => navigator.clipboard.writeText(t), '6\t9');
  await selectCell(page, 'A1');
  await page.keyboard.press('Control+V');

  await expect(cell(page, 'C1')).toHaveText('15');
  await expect(cell(page, 'D1')).toHaveText('30');

  await selectCell(page, 'C1');
  await expect(formulaBar(page)).toHaveValue('=A1+B1');
  await selectCell(page, 'D1');
  await expect(formulaBar(page)).toHaveValue('=C1*2');

  await page.reload();

  await expect(cell(page, 'C1')).toHaveText('15');
  await expect(cell(page, 'D1')).toHaveText('30');
  await selectCell(page, 'C1');
  await expect(formulaBar(page)).toHaveValue('=A1+B1');
  await selectCell(page, 'D1');
  await expect(formulaBar(page)).toHaveValue('=C1*2');
});

test('REQ-4-2-1#3: REQ-4-2-1 -the requested workflow', async ({ page }) => {
  await createFormulaWorkbook(page);

  await page.getByRole('rowheader', { name: '1', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 row above', exact: true }).click();

  await expect(cell(page, 'A2')).toHaveText('2');
  await expect(cell(page, 'B2')).toHaveText('3');
  await expect(cell(page, 'C2')).toHaveText('5');
  await expect(cell(page, 'D2')).toHaveText('10');

  await selectCell(page, 'C2');
  await expect(formulaBar(page)).toHaveValue('=A2+B2');
  await selectCell(page, 'D2');
  await expect(formulaBar(page)).toHaveValue('=C2*2');

  await page.reload();

  await expect(cell(page, 'A2')).toHaveText('2');
  await expect(cell(page, 'B2')).toHaveText('3');
  await expect(cell(page, 'C2')).toHaveText('5');
  await expect(cell(page, 'D2')).toHaveText('10');
  await selectCell(page, 'C2');
  await expect(formulaBar(page)).toHaveValue('=A2+B2');
  await selectCell(page, 'D2');
  await expect(formulaBar(page)).toHaveValue('=C2*2');
});

test('REQ-4-2-2: REQ-4-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterCell(page, 'A1', '1');
  await enterCell(page, 'B1', '0');
  await enterCell(page, 'C1', '=A1/B1');

  await expect(cell(page, 'C1')).toHaveText('#DIV/0!');
  await selectCell(page, 'C1');
  await expect(formulaBar(page)).toHaveValue('=A1/B1');

  await page.reload();

  await expect(cell(page, 'C1')).toHaveText('#DIV/0!');
  await selectCell(page, 'C1');
  await expect(formulaBar(page)).toHaveValue('=A1/B1');
});

test('REQ-4-2-2#2: REQ-4-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterCell(page, 'C1', '=A0');

  await expect(cell(page, 'C1')).toHaveText('#REF!');
  await selectCell(page, 'C1');
  await expect(formulaBar(page)).toHaveValue('=A0');

  await page.reload();

  await expect(cell(page, 'C1')).toHaveText('#REF!');
  await selectCell(page, 'C1');
  await expect(formulaBar(page)).toHaveValue('=A0');
});

test('REQ-4-2-2#3: REQ-4-2-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterCell(page, 'C1', '=NOTAFUNCTION(1)');

  await expect(cell(page, 'C1')).toHaveText('#NAME?');
  await selectCell(page, 'C1');
  await expect(formulaBar(page)).toHaveValue('=NOTAFUNCTION(1)');

  await page.reload();

  await expect(cell(page, 'C1')).toHaveText('#NAME?');
  await selectCell(page, 'C1');
  await expect(formulaBar(page)).toHaveValue('=NOTAFUNCTION(1)');
});

test('REQ-4-2-2#4: REQ-4-2-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterCell(page, 'C1', '=1+');

  await expect(cell(page, 'C1')).toHaveText('#ERROR!');
  await selectCell(page, 'C1');
  await expect(formulaBar(page)).toHaveValue('=1+');

  await page.reload();

  await expect(cell(page, 'C1')).toHaveText('#ERROR!');
  await selectCell(page, 'C1');
  await expect(formulaBar(page)).toHaveValue('=1+');
});

test('REQ-4-2-2#5: REQ-4-2-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await enterCell(page, 'C1', '=C1');

  await expect(cell(page, 'C1')).toHaveText('#REF!');
  await selectCell(page, 'C1');
  await expect(formulaBar(page)).toHaveValue('=C1');

  await enterCell(page, 'C1', '=2+3');

  await expect(cell(page, 'C1')).toHaveText('5');
  await selectCell(page, 'C1');
  await expect(formulaBar(page)).toHaveValue('=2+3');

  await page.reload();

  await expect(cell(page, 'C1')).toHaveText('5');
  await selectCell(page, 'C1');
  await expect(formulaBar(page)).toHaveValue('=2+3');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

