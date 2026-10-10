const { test, expect } = require('@playwright/test');

function cell(page, coord) {
  return page
    .getByRole('grid', { name: 'Worksheet grid', exact: true })
    .getByRole('gridcell', { name: coord, exact: true });
}

async function enterCell(page, coord, value) {
  const target = cell(page, coord);
  await target.click();
  await page.getByLabel('Formula bar', { exact: true }).fill(value);
  await page.keyboard.press('Enter');
  await expect(target).toHaveText(value);
}

async function selectRange(page, from, to) {
  const fromCell = cell(page, from);
  const toCell = cell(page, to);
  await fromCell.scrollIntoViewIfNeeded();
  await toCell.scrollIntoViewIfNeeded();

  const fromBox = await fromCell.boundingBox();
  const toBox = await toCell.boundingBox();
  if (!fromBox || !toBox) {
    throw new Error(`Could not locate grid cells for range ${from}:${to}`);
  }

  await page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(toBox.x + toBox.width / 2, toBox.y + toBox.height / 2, { steps: 10 });
  await page.mouse.up();

  await expect(fromCell).toHaveAttribute('aria-selected', 'true');
  await expect(toCell).toHaveAttribute('aria-selected', 'true');
}

async function createWorkbookWithSourceData(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();

  await enterCell(page, 'A1', 'Item');
  await enterCell(page, 'B1', 'Qty');
  await enterCell(page, 'A2', 'Pen');
  await enterCell(page, 'B2', '4');
}

async function expectTargetFilled(page) {
  await expect(cell(page, 'D1')).toHaveText('Item');
  await expect(cell(page, 'E1')).toHaveText('Qty');
  await expect(cell(page, 'D2')).toHaveText('Pen');
  await expect(cell(page, 'E2')).toHaveText('4');
}

async function expectSourceFilled(page) {
  await expect(cell(page, 'A1')).toHaveText('Item');
  await expect(cell(page, 'B1')).toHaveText('Qty');
  await expect(cell(page, 'A2')).toHaveText('Pen');
  await expect(cell(page, 'B2')).toHaveText('4');
}

async function expectSourceCleared(page) {
  await expect(cell(page, 'A1')).toHaveText('');
  await expect(cell(page, 'B1')).toHaveText('');
  await expect(cell(page, 'A2')).toHaveText('');
  await expect(cell(page, 'B2')).toHaveText('');
}

test('REQ-3-2-1: REQ-3-2-1 -the requested workflow A1:B2 the requested workflow D1:E2,the requested workflow, the requested workflow', async ({ page }) => {
  await createWorkbookWithSourceData(page);

  await selectRange(page, 'A1', 'B2');
  await page.keyboard.press('ControlOrMeta+C');

  await cell(page, 'D1').click();
  await page.keyboard.press('ControlOrMeta+V');

  await expectTargetFilled(page);
  await expectSourceFilled(page);

  await page.reload();
  await expectTargetFilled(page);
  await expectSourceFilled(page);
});

test('REQ-3-2-1#2: REQ-3-2-1 -the requested workflow A1:B2 the requested workflow D1:E2,the requested workflow', async ({ page }) => {
  await createWorkbookWithSourceData(page);

  await selectRange(page, 'A1', 'B2');
  await page.keyboard.press('ControlOrMeta+X');

  await cell(page, 'D1').click();
  await page.keyboard.press('ControlOrMeta+V');

  await expectTargetFilled(page);
  await expectSourceCleared(page);

  await page.reload();
  await expectTargetFilled(page);
  await expectSourceCleared(page);
});

test('REQ-3-2-1#3: REQ-3-2-1 -the requested workflow', async ({ page }) => {
  await createWorkbookWithSourceData(page);

  await selectRange(page, 'A1', 'B2');
  await page.keyboard.press('ControlOrMeta+C');

  await cell(page, 'D1').click();
  await cell(page, 'D1').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Paste', exact: true }).click();

  await expectTargetFilled(page);
  await expectSourceFilled(page);

  await page.reload();
  await expectTargetFilled(page);
  await expectSourceFilled(page);
});

test('REQ-3-2-1#4: REQ-3-2-1 -the requested workflow', async ({ page }) => {
  await createWorkbookWithSourceData(page);

  await selectRange(page, 'A1', 'B2');
  await page.keyboard.press('ControlOrMeta+X');

  await cell(page, 'D1').click();
  await cell(page, 'D1').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Paste', exact: true }).click();

  await expectTargetFilled(page);
  await expectSourceCleared(page);

  await page.reload();
  await expectTargetFilled(page);
  await expectSourceCleared(page);
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

