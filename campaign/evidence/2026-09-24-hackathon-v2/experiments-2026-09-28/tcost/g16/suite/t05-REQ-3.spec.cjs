const { test, expect } = require('@playwright/test');

async function openWorkbook(page, name = 'Q3 Sales') {
  await page.goto('/');
  await page.getByRole('link', { name, exact: true }).click();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
}

function cell(page, coord) {
  return page
    .getByRole('grid', { name: 'Worksheet grid', exact: true })
    .getByRole('gridcell', { name: coord, exact: true });
}

async function setCellValue(page, coord, value) {
  await cell(page, coord).click();
  const formulaBar = page.getByLabel('Formula bar', { exact: true });
  await formulaBar.fill(value);
  await formulaBar.press('Enter');
}

async function undo(page) {
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
}

async function selectRange(page, from, to) {
  const fromCell = cell(page, from);
  const toCell = cell(page, to);
  await fromCell.scrollIntoViewIfNeeded();
  await toCell.scrollIntoViewIfNeeded();
  const fromBox = await fromCell.boundingBox();
  const toBox = await toCell.boundingBox();

  await page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(toBox.x + toBox.width / 2, toBox.y + toBox.height / 2, { steps: 10 });
  await page.mouse.up();
}

test('REQ-3-2-2: REQ-3-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await setCellValue(page, 'B2', '5');
  await expect(cell(page, 'B2')).toHaveText('5');

  await undo(page);
  await expect(cell(page, 'B2')).toHaveText('4');

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(cell(page, 'B2')).toHaveText('4');
});

test('REQ-3-2-2#2: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await setCellValue(page, 'B2', '5');
  await expect(cell(page, 'B2')).toHaveText('5');

  await cell(page, 'B2').click();
  await page.keyboard.press('Control+z');
  await expect(cell(page, 'B2')).toHaveText('4');
  await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeEnabled();

  await page.keyboard.press('Control+y');
  await expect(cell(page, 'B2')).toHaveText('5');

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(cell(page, 'B2')).toHaveText('5');

  await setCellValue(page, 'B2', '4');
  await expect(cell(page, 'B2')).toHaveText('4');
});

test('REQ-3-2-2#3: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  const text = '10\t20\n30\t40';
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
  await cell(page, 'D1').click();
  await page.keyboard.press('Control+v');

  await expect(cell(page, 'D1')).toHaveText('10');
  await expect(cell(page, 'E1')).toHaveText('20');
  await expect(cell(page, 'D2')).toHaveText('30');
  await expect(cell(page, 'E2')).toHaveText('40');

  await undo(page);
  await expect(cell(page, 'D1')).toHaveText('');
  await expect(cell(page, 'E1')).toHaveText('');
  await expect(cell(page, 'D2')).toHaveText('');
  await expect(cell(page, 'E2')).toHaveText('');

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(cell(page, 'D1')).toHaveText('');
  await expect(cell(page, 'E2')).toHaveText('');
});

test('REQ-3-2-2#4: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await selectRange(page, 'A1', 'B2');
  await page.keyboard.press('Control+x');
  await cell(page, 'D1').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Paste', exact: true }).click();

  await expect(cell(page, 'D1')).toHaveText('Item');
  await expect(cell(page, 'E1')).toHaveText('Qty');
  await expect(cell(page, 'D2')).toHaveText('Pen');
  await expect(cell(page, 'E2')).toHaveText('4');
  await expect(cell(page, 'A1')).toHaveText('');
  await expect(cell(page, 'B2')).toHaveText('');

  await undo(page);
  await expect(cell(page, 'A1')).toHaveText('Item');
  await expect(cell(page, 'B1')).toHaveText('Qty');
  await expect(cell(page, 'A2')).toHaveText('Pen');
  await expect(cell(page, 'B2')).toHaveText('4');
  await expect(cell(page, 'D1')).toHaveText('');
  await expect(cell(page, 'E2')).toHaveText('');

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(cell(page, 'A1')).toHaveText('Item');
  await expect(cell(page, 'B2')).toHaveText('4');
});

test('REQ-3-2-2#5: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await page.getByRole('rowheader', { name: '2', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 row above', exact: true }).click();

  await expect(cell(page, 'A2')).toHaveText('');
  await expect(cell(page, 'A3')).toHaveText('Pen');
  await expect(cell(page, 'B3')).toHaveText('4');

  await undo(page);
  await expect(cell(page, 'A2')).toHaveText('Pen');
  await expect(cell(page, 'B2')).toHaveText('4');

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(cell(page, 'A2')).toHaveText('Pen');
  await expect(cell(page, 'B2')).toHaveText('4');
});

test('REQ-3-2-2#6: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await page.getByRole('columnheader', { name: 'B', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete column', exact: true }).click();

  await expect(cell(page, 'A1')).toHaveText('Item');
  await expect(cell(page, 'A2')).toHaveText('Pen');
  await expect(cell(page, 'B1')).toHaveText('');
  await expect(cell(page, 'B2')).toHaveText('');

  await cell(page, 'A1').click();
  await page.keyboard.press('Control+z');
  await expect(cell(page, 'B1')).toHaveText('Qty');
  await expect(cell(page, 'B2')).toHaveText('4');

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(cell(page, 'B1')).toHaveText('Qty');
  await expect(cell(page, 'B2')).toHaveText('4');
});

test('REQ-3-2-2#7: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await setCellValue(page, 'B2', '5');
  await expect(cell(page, 'B2')).toHaveText('5');

  await undo(page);
  await expect(cell(page, 'B2')).toHaveText('4');

  const redoButton = page.getByRole('button', { name: 'Redo', exact: true });
  await expect(redoButton).toBeEnabled();

  await setCellValue(page, 'B2', '6');
  await expect(cell(page, 'B2')).toHaveText('6');
  await expect(redoButton).toBeDisabled();

  await cell(page, 'B2').click();
  await page.keyboard.press('Control+y');
  await expect(cell(page, 'B2')).toHaveText('6');

  await setCellValue(page, 'B2', '4');
  await expect(cell(page, 'B2')).toHaveText('4');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

