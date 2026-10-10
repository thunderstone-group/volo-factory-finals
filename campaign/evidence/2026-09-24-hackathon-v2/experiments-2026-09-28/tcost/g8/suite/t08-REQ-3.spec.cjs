const { test, expect } = require('@playwright/test');

const WORKBOOK = 'Q3 Sales';

async function openWorkbook(page) {
  await page.goto('/');
  await page.getByRole('link', { name: WORKBOOK, exact: true }).click();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
}

function grid(page) {
  return page.getByRole('grid', { name: 'Worksheet grid', exact: true });
}

function cell(page, coord) {
  return grid(page).getByRole('gridcell', { name: coord, exact: true });
}

async function expectCell(page, coord, value) {
  await expect(cell(page, coord)).toHaveText(value);
}

async function expectSelected(page, coord, selected) {
  await expect(cell(page, coord)).toHaveAttribute('aria-selected', selected ? 'true' : 'false');
}

async function selectCell(page, coord) {
  await cell(page, coord).click();
}

async function selectRange(page, start, end) {
  const from = cell(page, start);
  const to = cell(page, end);
  const fromBox = await from.boundingBox();
  const toBox = await to.boundingBox();
  if (!fromBox || !toBox) {
    throw new Error(`Could not locate cells ${start} or ${end}`);
  }
  await page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(toBox.x + toBox.width / 2, toBox.y + toBox.height / 2, { steps: 5 });
  await page.mouse.up();
}

async function enterCellValue(page, coord, value) {
  await cell(page, coord).dblclick();
  const editor = page.getByRole('textbox', { name: `Edit ${coord}`, exact: true });
  await editor.fill(value);
  await editor.press('Enter');
}

async function putClipboard(page, text) {
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
}

async function pasteViaMenu(page, target, text) {
  await putClipboard(page, text);
  await cell(page, target).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Paste', exact: true }).click();
}

async function pasteViaKeyboard(page, target, text) {
  await putClipboard(page, text);
  await selectCell(page, target);
  await page.keyboard.press('Control+V');
}

test('REQ-3-1-2: REQ-3-1-2 -the requested workflow B2 the requested workflow,the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  const text = 'East\t1200\nNorth\t800';
  await pasteViaMenu(page, 'D1', text);

  await expectCell(page, 'D1', 'East');
  await expectCell(page, 'E1', '1200');
  await expectCell(page, 'D2', 'North');
  await expectCell(page, 'E2', '800');
  await expectCell(page, 'A1', 'Item');
  await expectCell(page, 'B1', 'Qty');
  await expectCell(page, 'A2', 'Pen');
  await expectCell(page, 'B2', '4');

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expectCell(page, 'D1', 'East');
  await expectCell(page, 'E1', '1200');
  await expectCell(page, 'D2', 'North');
  await expectCell(page, 'E2', '800');
  await expectCell(page, 'A1', 'Item');
  await expectCell(page, 'B1', 'Qty');
  await expectCell(page, 'A2', 'Pen');
  await expectCell(page, 'B2', '4');
});

test('REQ-3-1-2#2: REQ-3-1-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  const text = 'East\t1200\nNorth\t800';
  await pasteViaKeyboard(page, 'D1', text);

  await expectCell(page, 'D1', 'East');
  await expectCell(page, 'E1', '1200');
  await expectCell(page, 'D2', 'North');
  await expectCell(page, 'E2', '800');
  await expectCell(page, 'A1', 'Item');
  await expectCell(page, 'B1', 'Qty');
  await expectCell(page, 'A2', 'Pen');
  await expectCell(page, 'B2', '4');

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expectCell(page, 'D1', 'East');
  await expectCell(page, 'E1', '1200');
  await expectCell(page, 'D2', 'North');
  await expectCell(page, 'E2', '800');
});

test('REQ-3-1-2#3: REQ-3-1-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  const text = 'East\t\nNorth\t800';
  await pasteViaKeyboard(page, 'D1', text);

  await expectCell(page, 'D1', 'East');
  await expectCell(page, 'E1', '');
  await expectCell(page, 'D2', 'North');
  await expectCell(page, 'E2', '800');

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expectCell(page, 'D1', 'East');
  await expectCell(page, 'E1', '');
  await expectCell(page, 'D2', 'North');
  await expectCell(page, 'E2', '800');
});

test('REQ-3-1-2#4: REQ-3-1-2 -the requested workflow A1 the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await enterCellValue(page, 'D1', 'old');
  await enterCellValue(page, 'E1', 'old');
  await enterCellValue(page, 'D2', 'old');
  await enterCellValue(page, 'E2', 'old');
  await expectCell(page, 'D1', 'old');
  await expectCell(page, 'E1', 'old');
  await expectCell(page, 'D2', 'old');
  await expectCell(page, 'E2', 'old');

  const text = 'East\t1200\nNorth\t800';
  await pasteViaMenu(page, 'D1', text);

  await expectCell(page, 'D1', 'East');
  await expectCell(page, 'E1', '1200');
  await expectCell(page, 'D2', 'North');
  await expectCell(page, 'E2', '800');
  await expectCell(page, 'A1', 'Item');
  await expectCell(page, 'B1', 'Qty');
  await expectCell(page, 'A2', 'Pen');
  await expectCell(page, 'B2', '4');

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expectCell(page, 'D1', 'East');
  await expectCell(page, 'E1', '1200');
  await expectCell(page, 'D2', 'North');
  await expectCell(page, 'E2', '800');
  await expectCell(page, 'A1', 'Item');
  await expectCell(page, 'B1', 'Qty');
  await expectCell(page, 'A2', 'Pen');
  await expectCell(page, 'B2', '4');
});

test('REQ-3-1-2#5: REQ-3-1-2 -the requested workflow C3 the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  const text = 'East\t1200\nNorth\t800';
  await pasteViaKeyboard(page, 'C3', text);

  await expectCell(page, 'C3', 'East');
  await expectCell(page, 'D3', '1200');
  await expectCell(page, 'C4', 'North');
  await expectCell(page, 'D4', '800');
  await expectCell(page, 'A1', 'Item');
  await expectCell(page, 'B1', 'Qty');
  await expectCell(page, 'A2', 'Pen');
  await expectCell(page, 'B2', '4');

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expectCell(page, 'C3', 'East');
  await expectCell(page, 'D3', '1200');
  await expectCell(page, 'C4', 'North');
  await expectCell(page, 'D4', '800');
});

test('REQ-3-1-3: REQ-3-1-3 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await expect(grid(page)).toHaveAttribute('aria-multiselectable', 'true');

  await selectCell(page, 'A1');
  await expectSelected(page, 'A1', true);
  await expectSelected(page, 'B1', false);
  await expectSelected(page, 'A2', false);
  await expectSelected(page, 'B2', false);

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expectSelected(page, 'A1', true);
  await expectSelected(page, 'B1', false);
  await expectSelected(page, 'A2', false);
  await expectSelected(page, 'B2', false);
});

test('REQ-3-1-3#2: REQ-3-1-3 -the requested workflow,the requested workflow', async ({ page }) => {
  await openWorkbook(page);

  await expect(grid(page)).toHaveAttribute('aria-multiselectable', 'true');

  await selectRange(page, 'A1', 'B2');
  await expectSelected(page, 'A1', true);
  await expectSelected(page, 'B1', true);
  await expectSelected(page, 'A2', true);
  await expectSelected(page, 'B2', true);
  await expectSelected(page, 'C1', false);
  await expectSelected(page, 'A3', false);

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expectSelected(page, 'A1', true);
  await expectSelected(page, 'B1', true);
  await expectSelected(page, 'A2', true);
  await expectSelected(page, 'B2', true);
  await expectSelected(page, 'C1', false);
  await expectSelected(page, 'A3', false);
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

