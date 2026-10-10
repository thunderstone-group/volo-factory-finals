const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function grid(page) {
  return page.getByRole('grid', { name: 'Worksheet grid', exact: true });
}

function cell(page, coord) {
  return grid(page).getByRole('gridcell', { name: coord, exact: true });
}

function rowHeader(page, num) {
  return grid(page).getByRole('rowheader', { name: String(num), exact: true });
}

function columnHeader(page, letter) {
  return grid(page).getByRole('columnheader', { name: letter, exact: true });
}

async function createWorkbook(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(grid(page)).toBeVisible();

  const name = 'W' + u();
  await page.getByRole('button', { name: 'Rename workbook', exact: true }).click();
  await page.getByLabel('Workbook name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByLabel('Workbook name', { exact: true })).toBeHidden();
}

async function setCell(page, coord, value) {
  await cell(page, coord).click();
  const formulaBar = page.getByLabel('Formula bar', { exact: true });
  await formulaBar.fill(String(value));
  await formulaBar.press('Enter');
}

test('REQ-3-2-2: REQ-3-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await setCell(page, 'A1', 'Item');
  await setCell(page, 'B1', 'Qty');
  await setCell(page, 'A2', 'Pen');
  await setCell(page, 'B2', '4');

  await setCell(page, 'A1', 'Notebook');
  await expect(cell(page, 'A1')).toHaveText('Notebook');

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(cell(page, 'A1')).toHaveText('Item');

  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(cell(page, 'A1')).toHaveText('Notebook');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('Notebook');
});

test('REQ-3-2-2#2: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await setCell(page, 'D1', 'a');
  await setCell(page, 'E1', 'b');
  await setCell(page, 'D2', 'c');
  await setCell(page, 'E2', 'd');

  await page.evaluate((t) => navigator.clipboard.writeText(t), 'X\tY\n1\t2');
  await cell(page, 'D1').click();
  await page.keyboard.press('Control+v');
  await expect(cell(page, 'D1')).toHaveText('X');
  await expect(cell(page, 'E1')).toHaveText('Y');
  await expect(cell(page, 'D2')).toHaveText('1');
  await expect(cell(page, 'E2')).toHaveText('2');

  await page.keyboard.press('Control+z');
  await expect(cell(page, 'D1')).toHaveText('a');
  await expect(cell(page, 'E1')).toHaveText('b');
  await expect(cell(page, 'D2')).toHaveText('c');
  await expect(cell(page, 'E2')).toHaveText('d');

  await page.keyboard.press('Control+y');
  await expect(cell(page, 'D1')).toHaveText('X');
  await expect(cell(page, 'E1')).toHaveText('Y');
  await expect(cell(page, 'D2')).toHaveText('1');
  await expect(cell(page, 'E2')).toHaveText('2');

  await page.reload();
  await expect(cell(page, 'D1')).toHaveText('X');
  await expect(cell(page, 'E1')).toHaveText('Y');
  await expect(cell(page, 'D2')).toHaveText('1');
  await expect(cell(page, 'E2')).toHaveText('2');
});

test('REQ-3-2-2#3: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await setCell(page, 'A1', 'Region');
  await setCell(page, 'B1', 'Sales');
  await setCell(page, 'A2', 'East');
  await setCell(page, 'B2', '1200');
  await setCell(page, 'A3', 'North');
  await setCell(page, 'B3', '800');

  await rowHeader(page, 2).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 row above', exact: true }).click();
  await expect(cell(page, 'A3')).toHaveText('East');
  await expect(cell(page, 'A4')).toHaveText('North');

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'A3')).toHaveText('North');

  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(cell(page, 'A3')).toHaveText('East');
  await expect(cell(page, 'A4')).toHaveText('North');

  await page.reload();
  await expect(cell(page, 'A3')).toHaveText('East');
  await expect(cell(page, 'A4')).toHaveText('North');
});

test('REQ-3-2-2#4: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await setCell(page, 'B1', 'Sales');
  await setCell(page, 'B2', '1200');
  await setCell(page, 'B3', '800');

  await columnHeader(page, 'B').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 column left', exact: true }).click();
  await expect(cell(page, 'C1')).toHaveText('Sales');
  await expect(cell(page, 'C2')).toHaveText('1200');

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(cell(page, 'B1')).toHaveText('Sales');
  await expect(cell(page, 'B2')).toHaveText('1200');

  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(cell(page, 'C1')).toHaveText('Sales');
  await expect(cell(page, 'C2')).toHaveText('1200');

  await page.reload();
  await expect(cell(page, 'C1')).toHaveText('Sales');
  await expect(cell(page, 'C2')).toHaveText('1200');
});

test('REQ-3-2-2#5: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await setCell(page, 'A1', '1');
  await setCell(page, 'B1', '2');
  await setCell(page, 'C1', '=A1+B1');
  await expect(cell(page, 'C1')).toHaveText('3');

  await setCell(page, 'A1', '5');
  await expect(cell(page, 'C1')).toHaveText('7');
  await setCell(page, 'B1', '7');
  await expect(cell(page, 'C1')).toHaveText('12');

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(cell(page, 'B1')).toHaveText('2');
  await expect(cell(page, 'C1')).toHaveText('7');

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(cell(page, 'A1')).toHaveText('1');
  await expect(cell(page, 'C1')).toHaveText('3');

  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(cell(page, 'A1')).toHaveText('5');
  await expect(cell(page, 'C1')).toHaveText('7');

  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(cell(page, 'B1')).toHaveText('7');
  await expect(cell(page, 'C1')).toHaveText('12');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('5');
  await expect(cell(page, 'B1')).toHaveText('7');
  await expect(cell(page, 'C1')).toHaveText('12');
});

test('REQ-3-2-2#6: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await setCell(page, 'A1', '2');
  await setCell(page, 'B1', '3');
  await setCell(page, 'C1', '=A1+B1');
  await expect(cell(page, 'C1')).toHaveText('5');

  await setCell(page, 'A1', '10');
  await expect(cell(page, 'C1')).toHaveText('13');

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(cell(page, 'A1')).toHaveText('2');
  await expect(cell(page, 'C1')).toHaveText('5');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('2');
  await expect(cell(page, 'C1')).toHaveText('5');

  await cell(page, 'C1').click();
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A1+B1');
});

test('REQ-3-2-2#7: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);
  await setCell(page, 'A1', 'old');
  await setCell(page, 'A1', 'new');
  await expect(cell(page, 'A1')).toHaveText('new');

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(cell(page, 'A1')).toHaveText('old');

  await setCell(page, 'A1', 'other');
  await expect(cell(page, 'A1')).toHaveText('other');
  await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeDisabled();

  await page.keyboard.press('Control+y');
  await expect(cell(page, 'A1')).toHaveText('other');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('other');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

