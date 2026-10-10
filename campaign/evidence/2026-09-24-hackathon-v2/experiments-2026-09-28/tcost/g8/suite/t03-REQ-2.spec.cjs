const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function worksheetGrid(page) {
  return page.getByRole('grid', { name: 'Worksheet grid', exact: true });
}

function cell(page, coord) {
  return worksheetGrid(page).getByRole('gridcell', { name: coord, exact: true });
}

async function expectSelectedCell(page, coord) {
  await expect(cell(page, coord)).toHaveAttribute('aria-selected', 'true');
}

async function createWorkbook(page) {
  const name = 'wb ' + u();
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();

  const sheet1Tab = page.getByRole('tab', { name: 'Sheet1', exact: true });
  await expect(sheet1Tab).toBeVisible();
  await expect(sheet1Tab).toHaveAttribute('aria-selected', 'true');
  await expectSelectedCell(page, 'A1');

  await page.getByRole('button', { name: 'Rename workbook', exact: true }).click();
  const nameInput = page.getByLabel('Workbook name', { exact: true });
  await nameInput.fill(name);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(nameInput).toBeHidden();
}

async function addWorksheet(page) {
  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
}

async function setCell(page, coord, value) {
  const cellLocator = cell(page, coord);
  await cellLocator.click();
  await page.getByLabel('Formula bar', { exact: true }).fill(String(value));
  await page.keyboard.press('Enter');
  if (!String(value).startsWith('=')) {
    await expect(cellLocator).toHaveText(String(value));
  }
}

async function selectRange(page, startCoord, endCoord) {
  const start = cell(page, startCoord);
  const end = cell(page, endCoord);
  const startBox = await start.boundingBox();
  const endBox = await end.boundingBox();
  if (!startBox || !endBox) {
    throw new Error(`Cells ${startCoord} and ${endCoord} must be visible`);
  }
  await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(endBox.x + endBox.width / 2, endBox.y + endBox.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(start).toHaveAttribute('aria-selected', 'true');
  await expect(end).toHaveAttribute('aria-selected', 'true');
}

test('REQ-2-1-1: REQ-2-1-1 -the requested workflow Sheet2,the requested workflow', async ({ page }) => {
  await createWorkbook(page);

  await setCell(page, 'A1', 'Existing');
  await addWorksheet(page);

  const sheet2Tab = page.getByRole('tab', { name: 'Sheet2', exact: true });
  await expect(sheet2Tab).toBeVisible();
  await expect(sheet2Tab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'false');
  await expectSelectedCell(page, 'A1');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('');

  await page.reload();
  await expect(worksheetGrid(page)).toBeVisible();
  await expect(sheet2Tab).toBeVisible();
  await expect(sheet2Tab).toHaveAttribute('aria-selected', 'true');
  await expectSelectedCell(page, 'A1');

  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await expect(cell(page, 'A1')).toHaveText('Existing');
});

test('REQ-2-1-1#2: REQ-2-1-1 -the requested workflow SheetN the requested workflow', async ({ page }) => {
  await createWorkbook(page);

  await addWorksheet(page);
  const sheet2Tab = page.getByRole('tab', { name: 'Sheet2', exact: true });
  await expect(sheet2Tab).toBeVisible();
  await expect(sheet2Tab).toHaveAttribute('aria-selected', 'true');

  await addWorksheet(page);
  const sheet3Tab = page.getByRole('tab', { name: 'Sheet3', exact: true });
  await expect(sheet3Tab).toBeVisible();
  await expect(sheet3Tab).toHaveAttribute('aria-selected', 'true');
  await expect(sheet2Tab).toHaveAttribute('aria-selected', 'false');
  await expectSelectedCell(page, 'A1');

  await page.reload();
  await expect(worksheetGrid(page)).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await expect(sheet2Tab).toBeVisible();
  await expect(sheet3Tab).toBeVisible();
  await expect(sheet3Tab).toHaveAttribute('aria-selected', 'true');
});

test('REQ-2-1-2: REQ-2-1-2 -the requested workflow, the requested workflow', async ({ page }) => {
  await createWorkbook(page);

  await setCell(page, 'A1', 'East');
  await setCell(page, 'B1', '1200');

  await addWorksheet(page);
  await setCell(page, 'A1', 'North');
  await setCell(page, 'B1', '800');

  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('East');
  await expect(cell(page, 'B1')).toHaveText('1200');

  await page.getByRole('tab', { name: 'Sheet2', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('North');
  await expect(cell(page, 'B1')).toHaveText('800');
  await expect(cell(page, 'A1')).not.toHaveText('East');
});

test('REQ-2-1-2#2: REQ-2-1-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);

  await cell(page, 'B2').click();
  await page.getByLabel('Formula bar', { exact: true }).fill('Sheet1-B2');
  await page.keyboard.press('Enter');
  await cell(page, 'B2').click();
  await expectSelectedCell(page, 'B2');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('Sheet1-B2');

  await addWorksheet(page);
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await cell(page, 'C3').click();
  await page.getByLabel('Formula bar', { exact: true }).fill('Sheet2-C3');
  await page.keyboard.press('Enter');
  await cell(page, 'C3').click();
  await expectSelectedCell(page, 'C3');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('Sheet2-C3');

  await page.reload();
  await expect(worksheetGrid(page)).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expectSelectedCell(page, 'C3');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('Sheet2-C3');

  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expectSelectedCell(page, 'B2');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('Sheet1-B2');
});

test('REQ-2-1-2#3: REQ-2-1-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);

  await setCell(page, 'A1', 'Region');

  await addWorksheet(page);
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await setCell(page, 'A1', 2);
  await setCell(page, 'B1', 3);
  await setCell(page, 'C1', '=A1+B1');

  await cell(page, 'C1').click();
  await expect(cell(page, 'C1')).toHaveText('5');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A1+B1');

  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await cell(page, 'A1').click();
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('Region');

  await page.getByRole('tab', { name: 'Sheet2', exact: true }).click();
  await cell(page, 'C1').click();
  await expect(cell(page, 'C1')).toHaveText('5');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A1+B1');
});

test('REQ-2-1-2#4: REQ-2-1-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);

  await setCell(page, 'A1', 'Region');
  await setCell(page, 'B1', 'Sales');
  await setCell(page, 'C1', 'Status');
  await setCell(page, 'A2', 'East');
  await setCell(page, 'B2', 1200);
  await setCell(page, 'C2', 'Open');
  await setCell(page, 'A3', 'North');
  await setCell(page, 'B3', 800);
  await setCell(page, 'C3', 'Closed');

  await selectRange(page, 'A1', 'C3');
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Create filter', exact: true }).click();

  const filterRegionButton = page.getByRole('button', { name: 'Filter Region', exact: true });
  await expect(filterRegionButton).toBeVisible();

  await addWorksheet(page);
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(filterRegionButton).not.toBeVisible();

  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await expect(filterRegionButton).toBeVisible();
});

test('REQ-2-1-2#5: REQ-2-1-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page);

  await cell(page, 'B2').click();
  await page.getByLabel('Formula bar', { exact: true }).fill('Sheet1-B2');
  await page.keyboard.press('Enter');
  await cell(page, 'B2').click();
  await expectSelectedCell(page, 'B2');

  await addWorksheet(page);
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expectSelectedCell(page, 'A1');

  await page.reload();
  await expect(worksheetGrid(page)).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expectSelectedCell(page, 'A1');

  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await expectSelectedCell(page, 'B2');

  await page.getByRole('tab', { name: 'Sheet2', exact: true }).click();
  await expectSelectedCell(page, 'A1');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

