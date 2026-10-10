const { test, expect } = require('@playwright/test');

const grid = (page) => page.getByRole('grid', { name: 'Worksheet grid', exact: true });
const cell = (page, coord) => grid(page).getByRole('gridcell', { name: coord, exact: true });
const formulaBar = (page) => page.getByLabel('Formula bar', { exact: true });

async function openQ3Sales(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Q3 Sales', exact: true }).click();
  await expect(grid(page)).toBeVisible();
  const sheet1 = page.getByRole('tab', { name: 'Sheet1', exact: true });
  if ((await sheet1.getAttribute('aria-selected')) !== 'true') {
    await sheet1.click();
  }
  await expect(grid(page)).toBeVisible();
}

async function selectCell(page, coord) {
  await cell(page, coord).click();
}

async function setCell(page, coord, content) {
  await selectCell(page, coord);
  const bar = formulaBar(page);
  await bar.fill(content);
  await bar.press('Enter');
  await selectCell(page, coord);
  await expect(bar).toHaveValue(content);
}

async function editCellDirect(page, coord, content) {
  await cell(page, coord).dblclick();
  const editor = page.getByLabel(`Edit ${coord}`, { exact: true });
  await editor.fill(content);
  await editor.press('Enter');
}

async function pasteExternal(page, coord, text) {
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
  await selectCell(page, coord);
  await page.keyboard.press('ControlOrMeta+v');
}

async function setupDependentState(page) {
  await openQ3Sales(page);
  await setCell(page, 'A1', '2');
  await setCell(page, 'B1', '3');
  await setCell(page, 'C1', '=A1+B1');
  await setCell(page, 'D1', '=C1*2');
}

async function insertRowAbove(page, row) {
  await page.getByRole('rowheader', { name: String(row), exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 row above', exact: true }).click();
}

async function insertColumnLeft(page, col) {
  await page.getByRole('columnheader', { name: col, exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 column left', exact: true }).click();
}

test('REQ-4-1-1: REQ-4-1-1 -the requested workflow,the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await setCell(page, 'A1', '2');
  await setCell(page, 'B1', '3');
  await setCell(page, 'C1', '=A1+B1');
  await setCell(page, 'D1', '=(C1-1)*2');

  await expect(cell(page, 'C1')).toHaveText('5');
  await expect(cell(page, 'D1')).toHaveText('8');
  await selectCell(page, 'C1');
  await expect(formulaBar(page)).toHaveValue('=A1+B1');

  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(cell(page, 'C1')).toHaveText('5');
  await expect(cell(page, 'D1')).toHaveText('8');
  await selectCell(page, 'D1');
  await expect(formulaBar(page)).toHaveValue('=(C1-1)*2');
});

test('REQ-4-1-1#2: REQ-4-1-1 -the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await setCell(page, 'A1', '1');
  await setCell(page, 'A2', '2');
  await setCell(page, 'A3', '3');
  await setCell(page, 'A4', '');
  await setCell(page, 'A5', 'x');

  await setCell(page, 'B1', '=SUM(A1:A5)');
  await setCell(page, 'B2', '=AVERAGE(A1:A5)');
  await setCell(page, 'B3', '=COUNT(A1:A5)');
  await setCell(page, 'B4', '=MIN(A1:A5)');
  await setCell(page, 'B5', '=MAX(A1:A5)');

  await expect(cell(page, 'B1')).toHaveText('6');
  await expect(cell(page, 'B2')).toHaveText('2');
  await expect(cell(page, 'B3')).toHaveText('3');
  await expect(cell(page, 'B4')).toHaveText('1');
  await expect(cell(page, 'B5')).toHaveText('3');

  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(cell(page, 'B1')).toHaveText('6');
  await expect(cell(page, 'B2')).toHaveText('2');
  await expect(cell(page, 'B3')).toHaveText('3');
  await expect(cell(page, 'B4')).toHaveText('1');
  await expect(cell(page, 'B5')).toHaveText('3');
});

test('REQ-4-1-1#3: REQ-4-1-1 -the requested workflow, the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await setCell(page, 'A2', '1');
  await setCell(page, 'A3', '2');
  await setCell(page, 'A4', '3');

  await editCellDirect(page, 'A1', '=sum(A2:A4)');
  await expect(cell(page, 'A1')).toHaveText('6');
  await selectCell(page, 'A1');
  await expect(formulaBar(page)).toHaveValue('=sum(A2:A4)');

  await setCell(page, 'B1', '=SuM(A2:A4)');
  await expect(cell(page, 'B1')).toHaveText('6');

  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(cell(page, 'A1')).toHaveText('6');
  await selectCell(page, 'A1');
  await expect(formulaBar(page)).toHaveValue('=sum(A2:A4)');
});

test('REQ-4-1-1#4: REQ-4-1-1 -the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await setCell(page, 'A1', '10');
  await setCell(page, 'B1', '2');
  await setCell(page, 'C1', '=A1/B1');
  await setCell(page, 'D1', '=A1*B1-C1');

  await expect(cell(page, 'C1')).toHaveText('5');
  await expect(cell(page, 'D1')).toHaveText('15');

  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(cell(page, 'C1')).toHaveText('5');
  await expect(cell(page, 'D1')).toHaveText('15');
  await selectCell(page, 'D1');
  await expect(formulaBar(page)).toHaveValue('=A1*B1-C1');
});

test('REQ-4-1-1#5: REQ-4-1-1 -the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await setCell(page, 'B1', '=2*(3+4)-1');

  await expect(cell(page, 'B1')).toHaveText('13');
  await selectCell(page, 'B1');
  await expect(formulaBar(page)).toHaveValue('=2*(3+4)-1');

  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(cell(page, 'B1')).toHaveText('13');
  await selectCell(page, 'B1');
  await expect(formulaBar(page)).toHaveValue('=2*(3+4)-1');
});

test('REQ-4-1-2: REQ-4-1-2 -the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await setCell(page, 'A1', '2');
  await setCell(page, 'B1', '3');
  await setCell(page, 'C1', '=A1+B1');
  await setCell(page, 'D1', '=C1*2');
  await setCell(page, 'E1', '=$A$1+B1');

  await selectCell(page, 'E1');
  await page.keyboard.press('ControlOrMeta+c');
  await selectCell(page, 'F1');
  await page.keyboard.press('ControlOrMeta+v');

  await expect(cell(page, 'E1')).toHaveText('5');
  await expect(cell(page, 'F1')).toHaveText('7');
  await selectCell(page, 'F1');
  await expect(formulaBar(page)).toHaveValue('=$A$1+C1');

  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(cell(page, 'F1')).toHaveText('7');
  await selectCell(page, 'F1');
  await expect(formulaBar(page)).toHaveValue('=$A$1+C1');
});

test('REQ-4-1-2#2: REQ-4-1-2 -the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await setCell(page, 'A1', '1');
  await setCell(page, 'C1', '=A1');

  await selectCell(page, 'C1');
  await page.keyboard.press('ControlOrMeta+c');
  await selectCell(page, 'B1');
  await page.keyboard.press('ControlOrMeta+v');

  await expect(cell(page, 'B1')).toHaveText('#REF!');
  await selectCell(page, 'B1');
  await expect(formulaBar(page)).toHaveValue('=#REF!');
  await expect(cell(page, 'C1')).toHaveText('1');

  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(cell(page, 'B1')).toHaveText('#REF!');
  await selectCell(page, 'B1');
  await expect(formulaBar(page)).toHaveValue('=#REF!');
});

test('REQ-4-2-1: REQ-4-2-1 -the requested workflow,the requested workflow', async ({ page }) => {
  await setupDependentState(page);

  await setCell(page, 'A1', '5');

  await expect(cell(page, 'C1')).toHaveText('8');
  await expect(cell(page, 'D1')).toHaveText('16');
  await selectCell(page, 'C1');
  await expect(formulaBar(page)).toHaveValue('=A1+B1');
  await selectCell(page, 'D1');
  await expect(formulaBar(page)).toHaveValue('=C1*2');

  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(cell(page, 'C1')).toHaveText('8');
  await expect(cell(page, 'D1')).toHaveText('16');
  await selectCell(page, 'C1');
  await expect(formulaBar(page)).toHaveValue('=A1+B1');
  await selectCell(page, 'D1');
  await expect(formulaBar(page)).toHaveValue('=C1*2');
});

test('REQ-4-2-1#2: REQ-4-2-1 -the requested workflow', async ({ page }) => {
  await setupDependentState(page);

  await pasteExternal(page, 'A1', '5\t7\n6\t8');

  await expect(cell(page, 'A1')).toHaveText('5');
  await expect(cell(page, 'B1')).toHaveText('7');
  await expect(cell(page, 'C1')).toHaveText('12');
  await expect(cell(page, 'D1')).toHaveText('24');

  await selectCell(page, 'A1');
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('ControlOrMeta+x');
  await selectCell(page, 'F1');
  await page.keyboard.press('ControlOrMeta+v');

  await expect(cell(page, 'F1')).toHaveText('5');
  await expect(cell(page, 'G1')).toHaveText('7');
  await expect(cell(page, 'C1')).toHaveText('12');
  await expect(cell(page, 'D1')).toHaveText('24');
  await selectCell(page, 'C1');
  await expect(formulaBar(page)).toHaveValue('=F1+G1');

  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(cell(page, 'C1')).toHaveText('12');
  await selectCell(page, 'C1');
  await expect(formulaBar(page)).toHaveValue('=F1+G1');
});

test('REQ-4-2-1#3: REQ-4-2-1 -the requested workflow', async ({ page }) => {
  await setupDependentState(page);

  await insertRowAbove(page, 1);

  await expect(cell(page, 'C2')).toHaveText('5');
  await expect(cell(page, 'D2')).toHaveText('10');
  await selectCell(page, 'C2');
  await expect(formulaBar(page)).toHaveValue('=A2+B2');
  await selectCell(page, 'D2');
  await expect(formulaBar(page)).toHaveValue('=C2*2');

  await insertColumnLeft(page, 'A');

  await expect(cell(page, 'B2')).toHaveText('2');
  await expect(cell(page, 'C2')).toHaveText('3');
  await expect(cell(page, 'D2')).toHaveText('5');
  await expect(cell(page, 'E2')).toHaveText('10');
  await selectCell(page, 'D2');
  await expect(formulaBar(page)).toHaveValue('=B2+C2');
  await selectCell(page, 'E2');
  await expect(formulaBar(page)).toHaveValue('=D2*2');

  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(cell(page, 'D2')).toHaveText('5');
  await expect(cell(page, 'E2')).toHaveText('10');
  await selectCell(page, 'D2');
  await expect(formulaBar(page)).toHaveValue('=B2+C2');
  await selectCell(page, 'E2');
  await expect(formulaBar(page)).toHaveValue('=D2*2');
});

test('REQ-4-2-2: REQ-4-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await setCell(page, 'B1', '=1/0');

  await expect(cell(page, 'B1')).toHaveText('#DIV/0!');
  await selectCell(page, 'B1');
  await expect(formulaBar(page)).toHaveValue('=1/0');

  await setCell(page, 'C1', '=1+1');
  await expect(cell(page, 'C1')).toHaveText('2');

  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(cell(page, 'B1')).toHaveText('#DIV/0!');
  await selectCell(page, 'B1');
  await expect(formulaBar(page)).toHaveValue('=1/0');
});

test('REQ-4-2-2#2: REQ-4-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await setCell(page, 'B1', '=A0');

  await expect(cell(page, 'B1')).toHaveText('#REF!');
  await selectCell(page, 'B1');
  await expect(formulaBar(page)).toHaveValue('=A0');

  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(cell(page, 'B1')).toHaveText('#REF!');
  await selectCell(page, 'B1');
  await expect(formulaBar(page)).toHaveValue('=A0');
});

test('REQ-4-2-2#3: REQ-4-2-2 -the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await setCell(page, 'B1', '=NOTAFUNCTION(1)');

  await expect(cell(page, 'B1')).toHaveText('#NAME?');
  await selectCell(page, 'B1');
  await expect(formulaBar(page)).toHaveValue('=NOTAFUNCTION(1)');

  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(cell(page, 'B1')).toHaveText('#NAME?');
  await selectCell(page, 'B1');
  await expect(formulaBar(page)).toHaveValue('=NOTAFUNCTION(1)');
});

test('REQ-4-2-2#4: REQ-4-2-2 -the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await setCell(page, 'B1', '=1+');

  await expect(cell(page, 'B1')).toHaveText('#ERROR!');
  await selectCell(page, 'B1');
  await expect(formulaBar(page)).toHaveValue('=1+');

  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(cell(page, 'B1')).toHaveText('#ERROR!');
  await selectCell(page, 'B1');
  await expect(formulaBar(page)).toHaveValue('=1+');
});

test('REQ-4-2-2#5: REQ-4-2-2 -the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await setCell(page, 'C1', '=A1+1');
  await setCell(page, 'A1', '=A1');

  await expect(cell(page, 'A1')).toHaveText('#REF!');
  await selectCell(page, 'A1');
  await expect(formulaBar(page)).toHaveValue('=A1');

  await setCell(page, 'A1', '=2+3');
  await expect(cell(page, 'A1')).toHaveText('5');
  await expect(cell(page, 'C1')).toHaveText('6');
  await selectCell(page, 'A1');
  await expect(formulaBar(page)).toHaveValue('=2+3');

  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(cell(page, 'A1')).toHaveText('5');
  await expect(cell(page, 'C1')).toHaveText('6');
  await selectCell(page, 'A1');
  await expect(formulaBar(page)).toHaveValue('=2+3');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

