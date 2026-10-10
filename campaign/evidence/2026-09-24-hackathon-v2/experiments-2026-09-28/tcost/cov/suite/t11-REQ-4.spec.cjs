const { test, expect } = require('@playwright/test');

const grid = (page) => page.getByRole('grid', { name: 'Worksheet grid', exact: true });
const cell = (page, coordinate) => grid(page).getByRole('gridcell', { name: coordinate, exact: true });
const formulaBar = (page) => page.getByLabel('Formula bar', { exact: true });

async function createBlankWorkbook(page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'New blank workbook', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(grid(page)).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
}

async function fillValue(page, coordinate, value) {
  await cell(page, coordinate).click();
  const bar = formulaBar(page);
  await bar.fill(value);
  await bar.press('Enter');
}

async function fillViaGrid(page, coordinate, value) {
  await cell(page, coordinate).dblclick();
  const editor = page.getByLabel(`Edit ${coordinate}`, { exact: true });
  await editor.fill(value);
  await editor.press('Enter');
}

async function expectCell(page, coordinate, value) {
  await expect(cell(page, coordinate)).toHaveText(value);
}

async function selectAndExpectFormulaBar(page, coordinate, formula) {
  await cell(page, coordinate).click();
  await expect(formulaBar(page)).toHaveValue(formula);
}

test('REQ-4-1-1: REQ-4-1-1 -the requested workflow,the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);

  await fillValue(page, 'A1', '8');
  await fillValue(page, 'B1', '2');
  await fillValue(page, 'C1', '=A1+B1');
  await expectCell(page, 'C1', '10');
  await selectAndExpectFormulaBar(page, 'C1', '=A1+B1');

  await fillValue(page, 'D1', '=A1-B1');
  await expectCell(page, 'D1', '6');
  await selectAndExpectFormulaBar(page, 'D1', '=A1-B1');

  await fillValue(page, 'E1', '=A1*B1');
  await expectCell(page, 'E1', '16');
  await selectAndExpectFormulaBar(page, 'E1', '=A1*B1');

  await fillValue(page, 'F1', '=A1/B1');
  await expectCell(page, 'F1', '4');
  await selectAndExpectFormulaBar(page, 'F1', '=A1/B1');

  await fillValue(page, 'G1', '=(A1+B1)*2');
  await expectCell(page, 'G1', '20');
  await selectAndExpectFormulaBar(page, 'G1', '=(A1+B1)*2');

  await selectAndExpectFormulaBar(page, 'A1', '8');
  await expectCell(page, 'A1', '8');

  await page.reload();
  await expectCell(page, 'C1', '10');
  await expectCell(page, 'D1', '6');
  await expectCell(page, 'E1', '16');
  await expectCell(page, 'F1', '4');
  await expectCell(page, 'G1', '20');
  await selectAndExpectFormulaBar(page, 'C1', '=A1+B1');
  await selectAndExpectFormulaBar(page, 'G1', '=(A1+B1)*2');
});

test('REQ-4-1-1#2: REQ-4-1-1 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);

  await fillValue(page, 'A1', '2');
  await fillValue(page, 'A2', '4');
  await fillValue(page, 'A3', '6');
  // A4 is left empty.
  await fillValue(page, 'A5', 'x');

  await fillValue(page, 'B1', '=sum(A1:A5)');
  await expectCell(page, 'B1', '12');
  await selectAndExpectFormulaBar(page, 'B1', '=sum(A1:A5)');

  await fillValue(page, 'B2', '=AVERAGE(A1:A5)');
  await expectCell(page, 'B2', '4');
  await selectAndExpectFormulaBar(page, 'B2', '=AVERAGE(A1:A5)');

  await fillValue(page, 'B3', '=COUNT(A1:A5)');
  await expectCell(page, 'B3', '3');
  await selectAndExpectFormulaBar(page, 'B3', '=COUNT(A1:A5)');

  await fillValue(page, 'B4', '=MIN(A1:A5)');
  await expectCell(page, 'B4', '2');
  await selectAndExpectFormulaBar(page, 'B4', '=MIN(A1:A5)');

  await fillValue(page, 'B5', '=MAX(A1:A5)');
  await expectCell(page, 'B5', '6');
  await selectAndExpectFormulaBar(page, 'B5', '=MAX(A1:A5)');

  await fillValue(page, 'C1', '=Sum(A1:A5)');
  await expectCell(page, 'C1', '12');
  await selectAndExpectFormulaBar(page, 'C1', '=Sum(A1:A5)');

  await page.reload();
  await expectCell(page, 'B1', '12');
  await expectCell(page, 'B2', '4');
  await expectCell(page, 'B3', '3');
  await expectCell(page, 'B4', '2');
  await expectCell(page, 'B5', '6');
  await selectAndExpectFormulaBar(page, 'B1', '=sum(A1:A5)');
  await selectAndExpectFormulaBar(page, 'C1', '=Sum(A1:A5)');
});

test('REQ-4-1-1#3: REQ-4-1-1 -the requested workflow, the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);

  await fillValue(page, 'A1', '10');
  await fillValue(page, 'B1', '4');
  await fillValue(page, 'C1', '3');

  await fillViaGrid(page, 'D1', '=(A1-B1)*C1');
  await expectCell(page, 'D1', '18');
  await selectAndExpectFormulaBar(page, 'D1', '=(A1-B1)*C1');

  await fillViaGrid(page, 'E1', '=A1/B1');
  await expectCell(page, 'E1', '2.5');
  await selectAndExpectFormulaBar(page, 'E1', '=A1/B1');

  await page.reload();
  await expectCell(page, 'D1', '18');
  await expectCell(page, 'E1', '2.5');
  await selectAndExpectFormulaBar(page, 'D1', '=(A1-B1)*C1');
  await selectAndExpectFormulaBar(page, 'E1', '=A1/B1');
});

test('REQ-4-1-1#4: REQ-4-1-1 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);

  await fillValue(page, 'A1', '1');
  await fillValue(page, 'A2', '2');
  await fillValue(page, 'A3', '3');
  await fillValue(page, 'B1', '=SUM(A1:A3)');
  await expectCell(page, 'B1', '6');
  await selectAndExpectFormulaBar(page, 'B1', '=SUM(A1:A3)');

  await fillValue(page, 'A3', '5');
  await expectCell(page, 'B1', '8');
  await selectAndExpectFormulaBar(page, 'B1', '=SUM(A1:A3)');

  await page.reload();
  await expectCell(page, 'A3', '5');
  await expectCell(page, 'B1', '8');
  await selectAndExpectFormulaBar(page, 'B1', '=SUM(A1:A3)');
});

test('REQ-4-1-1#5: REQ-4-1-1 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);

  await fillValue(page, 'A1', '2');
  await fillValue(page, 'B1', '3');
  await fillValue(page, 'C1', '=A1+B1');
  await expectCell(page, 'C1', '5');
  await selectAndExpectFormulaBar(page, 'C1', '=A1+B1');

  const editorUrl = page.url();
  await page.goto('/');
  await page.goto(editorUrl);

  await expectCell(page, 'C1', '5');
  await selectAndExpectFormulaBar(page, 'C1', '=A1+B1');
});

test('REQ-4-1-2: REQ-4-1-2 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);

  await fillValue(page, 'A1', '1');
  await fillValue(page, 'A2', '2');
  await fillValue(page, 'B1', '10');
  await fillValue(page, 'C1', '=A1+$B$1');
  await expectCell(page, 'C1', '11');
  await selectAndExpectFormulaBar(page, 'C1', '=A1+$B$1');

  await cell(page, 'C1').click();
  await page.keyboard.press('Control+c');
  await cell(page, 'C2').click();
  await page.keyboard.press('Control+v');
  await expectCell(page, 'C2', '12');
  await selectAndExpectFormulaBar(page, 'C2', '=A2+$B$1');

  await cell(page, 'C1').click();
  await page.keyboard.press('Control+c');
  await cell(page, 'D1').click();
  await page.keyboard.press('Control+v');
  await expectCell(page, 'D1', '20');
  await selectAndExpectFormulaBar(page, 'D1', '=B1+$B$1');

  await expectCell(page, 'C1', '11');
  await selectAndExpectFormulaBar(page, 'C1', '=A1+$B$1');

  await page.reload();
  await expectCell(page, 'C1', '11');
  await expectCell(page, 'C2', '12');
  await expectCell(page, 'D1', '20');
  await selectAndExpectFormulaBar(page, 'C2', '=A2+$B$1');
  await selectAndExpectFormulaBar(page, 'D1', '=B1+$B$1');
});

test('REQ-4-1-2#2: REQ-4-1-2 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);

  await fillValue(page, 'C1', '=A1');
  await selectAndExpectFormulaBar(page, 'C1', '=A1');

  await cell(page, 'C1').click();
  await page.keyboard.press('Control+c');
  await cell(page, 'B1').click();
  await page.keyboard.press('Control+v');

  await expectCell(page, 'B1', '#REF!');
  await selectAndExpectFormulaBar(page, 'B1', '=#REF!');
  await selectAndExpectFormulaBar(page, 'C1', '=A1');

  await page.reload();
  await expectCell(page, 'B1', '#REF!');
  await selectAndExpectFormulaBar(page, 'B1', '=#REF!');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

