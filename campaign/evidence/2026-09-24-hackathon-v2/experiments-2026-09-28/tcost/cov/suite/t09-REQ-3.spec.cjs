const { test, expect } = require('@playwright/test');

const worksheetGrid = (page) => page.getByRole('grid', { name: 'Worksheet grid', exact: true });
const cell = (page, coord) => worksheetGrid(page).getByRole('gridcell', { name: coord, exact: true });
const formulaBar = (page) => page.getByLabel('Formula bar', { exact: true });

async function openNewBlankWorkbook(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(worksheetGrid(page)).toBeVisible();
}

async function enterCell(page, coord, value, expected) {
  const target = cell(page, coord);
  await target.click();
  await formulaBar(page).fill(value);
  await formulaBar(page).press('Enter');
  await expect(target).toHaveText(expected === undefined ? String(value) : String(expected));
}

async function selectRange(page, start, end) {
  const startBox = await cell(page, start).boundingBox();
  const endBox = await cell(page, end).boundingBox();
  if (!startBox || !endBox) {
    throw new Error(`Could not find visible grid cells ${start} and ${end}`);
  }
  await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(endBox.x + endBox.width / 2, endBox.y + endBox.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(cell(page, start)).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, end)).toHaveAttribute('aria-selected', 'true');
}

async function expectEmpty(page, coord) {
  await expect(cell(page, coord)).toHaveText(/^\s*$/);
}

async function reloadGrid(page) {
  await page.reload();
  await expect(worksheetGrid(page)).toBeVisible();
}

async function setNumberValidation(page, start, end, min, max) {
  await selectRange(page, start, end);
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Data validation', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await dialog.getByLabel('Rule type', { exact: true }).click();
  await page.getByRole('option', { name: 'Number range', exact: true }).click();
  await dialog.getByLabel('Minimum', { exact: true }).fill(String(min));
  await dialog.getByLabel('Maximum', { exact: true }).fill(String(max));
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

test('REQ-3-2-1: REQ-3-2-1 -the requested workflow A1:B2 the requested workflow D1:E2,the requested workflow, the requested workflow', async ({ page }) => {
  await openNewBlankWorkbook(page);
  await enterCell(page, 'A1', 'Item');
  await enterCell(page, 'B1', 'Qty');
  await enterCell(page, 'A2', 'Pen');
  await enterCell(page, 'B2', '4');
  await enterCell(page, 'C1', 'untouched');

  await selectRange(page, 'A1', 'B2');
  await expect(cell(page, 'D1')).toHaveAttribute('aria-selected', 'false');

  await page.keyboard.press('Control+c');
  await cell(page, 'D1').click();
  await page.keyboard.press('Control+v');

  await expect(cell(page, 'D1')).toHaveText('Item');
  await expect(cell(page, 'E1')).toHaveText('Qty');
  await expect(cell(page, 'D2')).toHaveText('Pen');
  await expect(cell(page, 'E2')).toHaveText('4');
  await expect(cell(page, 'A1')).toHaveText('Item');
  await expect(cell(page, 'B1')).toHaveText('Qty');
  await expect(cell(page, 'A2')).toHaveText('Pen');
  await expect(cell(page, 'B2')).toHaveText('4');
  await expect(cell(page, 'C1')).toHaveText('untouched');

  await cell(page, 'D1').click();
  await expect(formulaBar(page)).toHaveValue('Item');

  await reloadGrid(page);
  await expect(cell(page, 'D1')).toHaveText('Item');
  await expect(cell(page, 'E1')).toHaveText('Qty');
  await expect(cell(page, 'D2')).toHaveText('Pen');
  await expect(cell(page, 'E2')).toHaveText('4');
  await expect(cell(page, 'A1')).toHaveText('Item');
  await expect(cell(page, 'B1')).toHaveText('Qty');
  await expect(cell(page, 'A2')).toHaveText('Pen');
  await expect(cell(page, 'B2')).toHaveText('4');
  await expect(cell(page, 'C1')).toHaveText('untouched');
});

test('REQ-3-2-1#2: REQ-3-2-1 -the requested workflow A1:B2 the requested workflow D1:E2,the requested workflow', async ({ page }) => {
  await openNewBlankWorkbook(page);
  await enterCell(page, 'A1', 'Item');
  await enterCell(page, 'B1', 'Qty');
  await enterCell(page, 'A2', 'Pen');
  await enterCell(page, 'B2', '4');
  await enterCell(page, 'C1', 'untouched');

  await selectRange(page, 'A1', 'B2');

  await page.keyboard.press('Control+x');
  await cell(page, 'D1').click();
  await page.keyboard.press('Control+v');

  await expect(cell(page, 'D1')).toHaveText('Item');
  await expect(cell(page, 'E1')).toHaveText('Qty');
  await expect(cell(page, 'D2')).toHaveText('Pen');
  await expect(cell(page, 'E2')).toHaveText('4');
  await expectEmpty(page, 'A1');
  await expectEmpty(page, 'B1');
  await expectEmpty(page, 'A2');
  await expectEmpty(page, 'B2');
  await expect(cell(page, 'C1')).toHaveText('untouched');

  await reloadGrid(page);
  await expect(cell(page, 'D1')).toHaveText('Item');
  await expect(cell(page, 'E1')).toHaveText('Qty');
  await expect(cell(page, 'D2')).toHaveText('Pen');
  await expect(cell(page, 'E2')).toHaveText('4');
  await expectEmpty(page, 'A1');
  await expectEmpty(page, 'B1');
  await expectEmpty(page, 'A2');
  await expectEmpty(page, 'B2');
  await expect(cell(page, 'C1')).toHaveText('untouched');
});

test('REQ-3-2-1#3: REQ-3-2-1 -the requested workflow', async ({ page }) => {
  await openNewBlankWorkbook(page);
  await enterCell(page, 'A1', 'unchanged');
  await enterCell(page, 'C1', '2');
  await enterCell(page, 'D1', '3');
  await enterCell(page, 'C2', '=C1+D1', 5);
  await enterCell(page, 'D2', '=$C$1+D1', 5);

  await selectRange(page, 'C1', 'D2');

  await page.keyboard.press('Control+c');
  await cell(page, 'G1').click();
  await page.keyboard.press('Control+v');

  await expect(cell(page, 'G1')).toHaveText('2');
  await expect(cell(page, 'H1')).toHaveText('3');
  await expect(cell(page, 'G2')).toHaveText('5');
  await expect(cell(page, 'H2')).toHaveText('5');
  await expect(cell(page, 'A1')).toHaveText('unchanged');
  await expect(cell(page, 'C2')).toHaveText('5');
  await expect(cell(page, 'D2')).toHaveText('5');

  await cell(page, 'C2').click();
  await expect(formulaBar(page)).toHaveValue('=C1+D1');
  await cell(page, 'D2').click();
  await expect(formulaBar(page)).toHaveValue('=$C$1+D1');
  await cell(page, 'G2').click();
  await expect(formulaBar(page)).toHaveValue('=G1+H1');
  await cell(page, 'H2').click();
  await expect(formulaBar(page)).toHaveValue('=$C$1+H1');

  await reloadGrid(page);
  await expect(cell(page, 'G2')).toHaveText('5');
  await expect(cell(page, 'H2')).toHaveText('5');
  await expect(cell(page, 'A1')).toHaveText('unchanged');
  await cell(page, 'C2').click();
  await expect(formulaBar(page)).toHaveValue('=C1+D1');
  await cell(page, 'G2').click();
  await expect(formulaBar(page)).toHaveValue('=G1+H1');
  await cell(page, 'H2').click();
  await expect(formulaBar(page)).toHaveValue('=$C$1+H1');
});

test('REQ-3-2-1#4: REQ-3-2-1 -the requested workflow', async ({ page }) => {
  await openNewBlankWorkbook(page);
  await enterCell(page, 'A1', '200');
  await enterCell(page, 'B1', '210');
  await enterCell(page, 'A2', '220');
  await enterCell(page, 'B2', '230');
  await enterCell(page, 'D1', '10');
  await enterCell(page, 'E1', '20');
  await enterCell(page, 'D2', '30');
  await enterCell(page, 'E2', '40');
  await enterCell(page, 'C1', 'untouched');

  await setNumberValidation(page, 'D1', 'E2', 0, 100);

  await selectRange(page, 'A1', 'B2');
  await page.keyboard.press('Control+x');
  await cell(page, 'D1').click();
  await page.keyboard.press('Control+v');

  await expect(page.getByText('Please enter a number from 0 to 100', { exact: true })).toBeVisible();
  await expect(cell(page, 'A1')).toHaveText('200');
  await expect(cell(page, 'B1')).toHaveText('210');
  await expect(cell(page, 'A2')).toHaveText('220');
  await expect(cell(page, 'B2')).toHaveText('230');
  await expect(cell(page, 'D1')).toHaveText('10');
  await expect(cell(page, 'E1')).toHaveText('20');
  await expect(cell(page, 'D2')).toHaveText('30');
  await expect(cell(page, 'E2')).toHaveText('40');
  await expect(cell(page, 'C1')).toHaveText('untouched');

  await reloadGrid(page);
  await expect(cell(page, 'A1')).toHaveText('200');
  await expect(cell(page, 'B1')).toHaveText('210');
  await expect(cell(page, 'A2')).toHaveText('220');
  await expect(cell(page, 'B2')).toHaveText('230');
  await expect(cell(page, 'D1')).toHaveText('10');
  await expect(cell(page, 'E1')).toHaveText('20');
  await expect(cell(page, 'D2')).toHaveText('30');
  await expect(cell(page, 'E2')).toHaveText('40');
  await expect(cell(page, 'C1')).toHaveText('untouched');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

