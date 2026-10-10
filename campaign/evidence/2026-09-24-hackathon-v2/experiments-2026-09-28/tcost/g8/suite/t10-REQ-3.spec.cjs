const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function createBlankWorkbook(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
}

async function createNamedWorkbook(page, name) {
  await createBlankWorkbook(page);
  await page.getByRole('button', { name: 'Rename workbook', exact: true }).click();
  await page.getByLabel('Workbook name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByLabel('Workbook name', { exact: true })).toBeHidden();
}

async function openWorkbook(page, name) {
  await page.goto('/');
  await page.getByRole('link', { name, exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
}

function grid(page) {
  return page.getByRole('grid', { name: 'Worksheet grid', exact: true });
}

async function selectCell(page, coord) {
  await grid(page).getByRole('gridcell', { name: coord, exact: true }).click();
}

async function expectCell(page, coord, value) {
  await expect(grid(page).getByRole('gridcell', { name: coord, exact: true })).toHaveText(value);
}

async function expectFormulaBar(page, coord, value) {
  await selectCell(page, coord);
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue(value);
}

async function setCell(page, coord, value) {
  await selectCell(page, coord);
  const formulaBar = page.getByLabel('Formula bar', { exact: true });
  await formulaBar.fill(value);
  await formulaBar.press('Enter');
  await expectCell(page, coord, value);
}

async function pasteInto(page, coord, text) {
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
  await selectCell(page, coord);
  await page.keyboard.press('Control+v');
}

async function insertRowAbove(page, rowNumber) {
  await grid(page)
    .getByRole('rowheader', { name: String(rowNumber), exact: true })
    .click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 row above', exact: true }).click();
}

async function deleteColumn(page, columnLetter) {
  await grid(page)
    .getByRole('columnheader', { name: columnLetter, exact: true })
    .click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete column', exact: true }).click();
}

async function reloadWorkbook(page) {
  await page.reload();
  await expect(grid(page)).toBeVisible();
}

test('REQ-3-2-2: REQ-3-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCell(page, 'A1', 'old');
  await setCell(page, 'A1', 'new');

  await page.getByRole('button', { name: 'Undo', exact: true }).click();

  await expectCell(page, 'A1', 'old');
  await expectFormulaBar(page, 'A1', 'old');

  await reloadWorkbook(page);
  await expectCell(page, 'A1', 'old');
  await expectFormulaBar(page, 'A1', 'old');
});

test('REQ-3-2-2#2: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCell(page, 'A1', 'old');
  await setCell(page, 'A1', 'new');

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expectCell(page, 'A1', 'old');

  await page.getByRole('button', { name: 'Redo', exact: true }).click();

  await expectCell(page, 'A1', 'new');
  await expectFormulaBar(page, 'A1', 'new');

  await reloadWorkbook(page);
  await expectCell(page, 'A1', 'new');
  await expectFormulaBar(page, 'A1', 'new');
});

test('REQ-3-2-2#3: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCell(page, 'A1', 'keep');
  await pasteInto(page, 'C3', '11\t22\n33\t44');

  await expectCell(page, 'C3', '11');
  await expectCell(page, 'D3', '22');
  await expectCell(page, 'C4', '33');
  await expectCell(page, 'D4', '44');

  await page.keyboard.press('Control+z');

  await expectFormulaBar(page, 'C3', '');
  await expectCell(page, 'A1', 'keep');

  await reloadWorkbook(page);
  await expectFormulaBar(page, 'C3', '');
  await expectCell(page, 'A1', 'keep');
});

test('REQ-3-2-2#4: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCell(page, 'A1', 'old');
  await setCell(page, 'A1', 'new');

  await selectCell(page, 'A1');
  await page.keyboard.press('Control+z');
  await expectCell(page, 'A1', 'old');

  await setCell(page, 'A1', 'other');
  await selectCell(page, 'A1');

  await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeDisabled();
  await page.keyboard.press('Control+y');
  await expectCell(page, 'A1', 'other');

  await reloadWorkbook(page);
  await expectCell(page, 'A1', 'other');
});

test('REQ-3-2-2#5: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCell(page, 'A1', 'a');
  await setCell(page, 'A2', 'b');

  await insertRowAbove(page, 2);
  await expectCell(page, 'A3', 'b');

  await selectCell(page, 'A1');
  await page.keyboard.press('Control+z');

  await expectCell(page, 'A2', 'b');

  await reloadWorkbook(page);
  await expectCell(page, 'A2', 'b');
});

test('REQ-3-2-2#6: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCell(page, 'A1', 'x');
  await setCell(page, 'B1', 'y');

  await deleteColumn(page, 'B');
  await expectFormulaBar(page, 'B1', '');

  await page.getByRole('button', { name: 'Undo', exact: true }).click();

  await expectCell(page, 'B1', 'y');
  await expectCell(page, 'A1', 'x');

  await reloadWorkbook(page);
  await expectCell(page, 'B1', 'y');
});

test('REQ-3-2-2#7: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  const workbookA = 'Undo scope A ' + u();

  await createNamedWorkbook(page, workbookA);
  await setCell(page, 'A1', 'Aold');
  await setCell(page, 'A1', 'Anew');

  await createBlankWorkbook(page);
  await setCell(page, 'B1', 'Bold');
  await setCell(page, 'B1', 'Bnew');

  await selectCell(page, 'B1');
  await page.keyboard.press('Control+z');
  await expectCell(page, 'B1', 'Bold');

  await openWorkbook(page, workbookA);
  await expectCell(page, 'A1', 'Anew');

  await reloadWorkbook(page);
  await expectCell(page, 'A1', 'Anew');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

