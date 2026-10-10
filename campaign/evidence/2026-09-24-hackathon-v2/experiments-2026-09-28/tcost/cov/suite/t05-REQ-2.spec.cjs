const { test, expect } = require('@playwright/test');

test.setTimeout(15000);

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function importWorkbook(page, csv, stem) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Import CSV', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import CSV', exact: true });
  await dialog.getByLabel('CSV file', { exact: true }).setInputFiles({
    name: `${stem}.csv`,
    mimeType: 'text/csv',
    buffer: Buffer.from(csv, 'utf-8'),
  });
  await dialog.getByRole('button', { name: 'Confirm import', exact: true }).click();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
}

async function editCell(page, coord, value) {
  const cell = page.getByRole('gridcell', { name: coord, exact: true });
  await cell.dblclick();
  await page.getByLabel(`Edit ${coord}`, { exact: true }).fill(String(value));
  await page.keyboard.press('Enter');
}

async function expectCellText(page, coord, text) {
  await expect(page.getByRole('gridcell', { name: coord, exact: true })).toHaveText(text);
}

async function useRowMenu(page, rowNumber, command) {
  await page.getByRole('rowheader', { name: String(rowNumber), exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: command, exact: true }).click();
}

async function insertRowAbove(page, rowNumber) {
  await useRowMenu(page, rowNumber, 'Insert 1 row above');
}

async function insertRowBelow(page, rowNumber) {
  await useRowMenu(page, rowNumber, 'Insert 1 row below');
}

async function deleteRow(page, rowNumber) {
  await useRowMenu(page, rowNumber, 'Delete row');
}

async function dataMenuItem(page, name) {
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByRole('menuitem', { name, exact: true }).click();
}

async function setNumberValidation(page, coord, min, max) {
  await page.getByRole('gridcell', { name: coord, exact: true }).click();
  await dataMenuItem(page, 'Data validation');
  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await dialog.getByLabel('Rule type', { exact: true }).click();
  await page.getByRole('option', { name: 'Number range', exact: true }).click();
  await dialog.getByLabel('Minimum', { exact: true }).fill(String(min));
  await dialog.getByLabel('Maximum', { exact: true }).fill(String(max));
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();
}

async function selectRangeByDrag(page, startCoord, endCoord) {
  const grid = page.getByRole('grid', { name: 'Worksheet grid', exact: true });
  const startCell = grid.getByRole('gridcell', { name: startCoord, exact: true });
  const endCell = grid.getByRole('gridcell', { name: endCoord, exact: true });
  await startCell.scrollIntoViewIfNeeded();
  const startBox = await startCell.boundingBox();
  await endCell.scrollIntoViewIfNeeded();
  const endBox = await endCell.boundingBox();
  if (!startBox || !endBox) throw new Error('Range cells are not visible');
  await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(endBox.x + endBox.width / 2, endBox.y + endBox.height / 2, { steps: 5 });
  await page.mouse.up();
}

test('REQ-2-2-1: REQ-2-2-1 -the requested workflow 3 the requested workflow,the requested workflow', async ({ page }) => {
  const name = `rw${u()}`;
  await importWorkbook(page, 'Item,Qty,Total\nPen,4,\nInk,2,\n', name);

  await editCell(page, 'C2', '=B2+B3');
  await expectCellText(page, 'C2', '6');

  await insertRowAbove(page, 3);

  await expectCellText(page, 'A3', '');
  await expectCellText(page, 'B3', '');
  await expectCellText(page, 'A4', 'Ink');
  await expectCellText(page, 'B4', '2');
  await expectCellText(page, 'C2', '6');

  await page.getByRole('gridcell', { name: 'C2', exact: true }).click();
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=B2+B4');

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expectCellText(page, 'A4', 'Ink');
  await expectCellText(page, 'B4', '2');
  await expectCellText(page, 'C2', '6');

  await page.getByRole('gridcell', { name: 'C2', exact: true }).click();
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=B2+B4');
});

test('REQ-2-2-1#2: REQ-2-2-1 -the requested workflow 3 the requested workflow,the requested workflow', async ({ page }) => {
  const name = `rw${u()}`;
  await importWorkbook(page, 'Region,Sales\nEast,1200\nNorth,800\n', name);

  await insertRowBelow(page, 2);

  await expectCellText(page, 'A1', 'East');
  await expectCellText(page, 'B1', '1200');
  await expectCellText(page, 'A2', 'North');
  await expectCellText(page, 'B2', '800');
  await expectCellText(page, 'A3', '');
  await expectCellText(page, 'B3', '');

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expectCellText(page, 'A1', 'East');
  await expectCellText(page, 'B1', '1200');
  await expectCellText(page, 'A2', 'North');
  await expectCellText(page, 'B2', '800');
  await expectCellText(page, 'A3', '');
  await expectCellText(page, 'B3', '');
});

test('REQ-2-2-1#3: REQ-2-2-1 -the requested workflow', async ({ page }) => {
  const name = `rw${u()}`;
  await importWorkbook(page, 'Region,Sales,Extra\nEast,1200,A\nNorth,800,B\nSouth,700,C\n', name);

  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
  await page.getByRole('tab', { name: 'Sheet2', exact: true }).click();
  await editCell(page, 'A1', 'Other');
  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();

  await deleteRow(page, 3);

  await expectCellText(page, 'A2', 'East');
  await expectCellText(page, 'A3', 'South');
  await expectCellText(page, 'B3', '700');
  await expectCellText(page, 'A4', '');

  await page.getByRole('tab', { name: 'Sheet2', exact: true }).click();
  await expectCellText(page, 'A1', 'Other');

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expectCellText(page, 'A1', 'Other');

  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await expectCellText(page, 'A3', 'South');
  await expectCellText(page, 'B3', '700');
  await expectCellText(page, 'A4', '');
});

test('REQ-2-2-1#4: REQ-2-2-1 -the requested workflow', async ({ page }) => {
  const name = `val${u()}`;
  await importWorkbook(page, 'Region,Sales\nEast,1200\nNorth,80\n', name);

  await setNumberValidation(page, 'B3', 0, 100);
  await insertRowAbove(page, 3);

  await expectCellText(page, 'A3', '');
  await expectCellText(page, 'A4', 'North');
  await expectCellText(page, 'B4', '80');

  const b4 = page.getByRole('gridcell', { name: 'B4', exact: true });
  await b4.dblclick();
  await page.getByLabel('Edit B4', { exact: true }).fill('150');
  await page.keyboard.press('Enter');

  await expect(page.getByText('Please enter a number from 0 to 100', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(b4).toHaveText('80');

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();

  const b4AfterReload = page.getByRole('gridcell', { name: 'B4', exact: true });
  await b4AfterReload.dblclick();
  await page.getByLabel('Edit B4', { exact: true }).fill('150');
  await page.keyboard.press('Enter');

  await expect(page.getByText('Please enter a number from 0 to 100', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(b4AfterReload).toHaveText('80');
});

test('REQ-2-2-1#5: REQ-2-2-1 -the requested workflow', async ({ page }) => {
  const name = `pv${u()}`;
  await importWorkbook(page, 'Region,Sales\nEast,1200\nNorth,800\n', name);

  await selectRangeByDrag(page, 'A1', 'B3');
  await dataMenuItem(page, 'Create pivot table');

  const dialog = page.getByRole('dialog', { name: 'Create pivot table', exact: true });
  await expect(dialog.getByText('Source range: A1:B3', { exact: true })).toBeVisible();
  await dialog.getByRole('radio', { name: 'New worksheet', exact: true }).check();
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();

  await expect(page.getByRole('tab', { name: 'Pivot1', exact: true })).toBeVisible();

  const editor = page.getByRole('region', { name: 'Pivot table editor', exact: true });
  await editor.getByLabel('Rows', { exact: true }).click();
  await page.getByRole('option', { name: 'Region', exact: true }).click();
  await editor.getByLabel('Values', { exact: true }).click();
  await page.getByRole('option', { name: 'Sales', exact: true }).click();
  await editor.getByLabel('Summarize by', { exact: true }).click();
  await page.getByRole('option', { name: 'SUM', exact: true }).click();
  await editor.getByRole('button', { name: 'Apply', exact: true }).click();

  await expectCellText(page, 'A1', 'Region');
  await expectCellText(page, 'B1', 'SUM of Sales');
  await expectCellText(page, 'B4', '2000');

  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await deleteRow(page, 3);
  await page.getByRole('tab', { name: 'Pivot1', exact: true }).click();

  await expectCellText(page, 'B4', '2000');

  await page.getByRole('button', { name: 'Refresh pivot table', exact: true }).click();
  await expectCellText(page, 'A3', 'Grand Total');
  await expectCellText(page, 'B3', '1200');

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expectCellText(page, 'A3', 'Grand Total');
  await expectCellText(page, 'B3', '1200');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

