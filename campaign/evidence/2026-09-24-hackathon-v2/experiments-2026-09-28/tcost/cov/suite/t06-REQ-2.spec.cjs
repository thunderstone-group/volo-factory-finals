const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function importWorkbook(csvText) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Import CSV', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import CSV', exact: true });
  await expect(dialog).toBeVisible();
  const filename = `wb_${u()}.csv`;
  await dialog.getByLabel('CSV file', { exact: true }).setInputFiles({
    name: filename,
    mimeType: 'text/csv',
    buffer: Buffer.from(csvText, 'utf8'),
  });
  await dialog.getByRole('button', { name: 'Confirm import', exact: true }).click();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
}

async function setCell(coord, value) {
  const cell = page.getByRole('gridcell', { name: coord, exact: true });
  await cell.click();
  await page.keyboard.type(value);
  await page.keyboard.press('Enter');
}

async function selectRange(startCoord, endCoord) {
  const start = page.getByRole('gridcell', { name: startCoord, exact: true });
  const end = page.getByRole('gridcell', { name: endCoord, exact: true });
  const startBox = await start.boundingBox();
  const endBox = await end.boundingBox();
  await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(endBox.x + endBox.width / 2, endBox.y + endBox.height / 2, { steps: 5 });
  await page.mouse.up();
}

async function openDataMenu() {
  await page.getByRole('button', { name: 'Data', exact: true }).click();
}

async function selectCombo(label, optionName) {
  const combo = page.getByLabel(label, { exact: true });
  const tag = await combo.evaluate((el) => el.tagName);
  if (tag === 'SELECT') {
    await combo.selectOption({ label: optionName });
  } else {
    await combo.click();
    await page.getByRole('option', { name: optionName, exact: true }).click();
  }
}

async function insertColumnLeft(columnLetter) {
  await page.getByRole('columnheader', { name: columnLetter, exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 column left', exact: true }).click();
}

async function insertColumnRight(columnLetter) {
  await page.getByRole('columnheader', { name: columnLetter, exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 column right', exact: true }).click();
}

async function deleteColumn(columnLetter) {
  await page.getByRole('columnheader', { name: columnLetter, exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete column', exact: true }).click();
}

test('REQ-2-2-2: REQ-2-2-2 -the requested workflow B the requested workflow,the requested workflow', async () => {
  await importWorkbook('Region,Sales\nEast,1200\nNorth,800');

  await insertColumnLeft('B');

  await expect(page.getByRole('gridcell', { name: 'A1', exact: true })).toHaveText('Region');
  await expect(page.getByRole('gridcell', { name: 'A2', exact: true })).toHaveText('East');
  await expect(page.getByRole('gridcell', { name: 'A3', exact: true })).toHaveText('North');
  await expect(page.getByRole('gridcell', { name: 'B1', exact: true })).toHaveText('');
  await expect(page.getByRole('gridcell', { name: 'B2', exact: true })).toHaveText('');
  await expect(page.getByRole('gridcell', { name: 'B3', exact: true })).toHaveText('');
  await expect(page.getByRole('gridcell', { name: 'C1', exact: true })).toHaveText('Sales');
  await expect(page.getByRole('gridcell', { name: 'C2', exact: true })).toHaveText('1200');
  await expect(page.getByRole('gridcell', { name: 'C3', exact: true })).toHaveText('800');

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(page.getByRole('gridcell', { name: 'A2', exact: true })).toHaveText('East');
  await expect(page.getByRole('gridcell', { name: 'C2', exact: true })).toHaveText('1200');
  await expect(page.getByRole('gridcell', { name: 'C3', exact: true })).toHaveText('800');
});

test('REQ-2-2-2#2: REQ-2-2-2 -the requested workflow B the requested workflow,the requested workflow', async () => {
  await importWorkbook('Region,Sales\nEast,1200\nNorth,800');

  await insertColumnRight('B');

  await expect(page.getByRole('gridcell', { name: 'A1', exact: true })).toHaveText('Region');
  await expect(page.getByRole('gridcell', { name: 'A2', exact: true })).toHaveText('East');
  await expect(page.getByRole('gridcell', { name: 'A3', exact: true })).toHaveText('North');
  await expect(page.getByRole('gridcell', { name: 'B1', exact: true })).toHaveText('Sales');
  await expect(page.getByRole('gridcell', { name: 'B2', exact: true })).toHaveText('1200');
  await expect(page.getByRole('gridcell', { name: 'B3', exact: true })).toHaveText('800');
  await expect(page.getByRole('gridcell', { name: 'C1', exact: true })).toHaveText('');
  await expect(page.getByRole('gridcell', { name: 'C2', exact: true })).toHaveText('');
  await expect(page.getByRole('gridcell', { name: 'C3', exact: true })).toHaveText('');

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(page.getByRole('gridcell', { name: 'B2', exact: true })).toHaveText('1200');
  await expect(page.getByRole('gridcell', { name: 'C1', exact: true })).toHaveText('');
});

test('REQ-2-2-2#3: REQ-2-2-2 -the requested workflow', async () => {
  await importWorkbook('2,3\n4,5');
  await setCell('C1', '=A1*2');
  await setCell('D1', '=B1*2');

  await deleteColumn('B');

  await expect(page.getByRole('gridcell', { name: 'A1', exact: true })).toHaveText('2');
  await expect(page.getByRole('gridcell', { name: 'A2', exact: true })).toHaveText('4');
  await expect(page.getByRole('gridcell', { name: 'B1', exact: true })).toHaveText('4');
  await expect(page.getByRole('gridcell', { name: 'C1', exact: true })).toHaveText('#REF!');

  await page.getByRole('gridcell', { name: 'B1', exact: true }).click();
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A1*2');

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(page.getByRole('gridcell', { name: 'B1', exact: true })).toHaveText('4');
  await expect(page.getByRole('gridcell', { name: 'C1', exact: true })).toHaveText('#REF!');
  await page.getByRole('gridcell', { name: 'B1', exact: true }).click();
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A1*2');
});

test('REQ-2-2-2#4: REQ-2-2-2 -the requested workflow', async () => {
  await importWorkbook('Region,Sales\nEast,50\nNorth,80');

  await selectRange('B2', 'B3');
  await openDataMenu();
  await page.getByRole('menuitem', { name: 'Data validation', exact: true }).click();
  const validationDialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await selectCombo('Rule type', 'Number range');
  await validationDialog.getByLabel('Minimum', { exact: true }).fill('0');
  await validationDialog.getByLabel('Maximum', { exact: true }).fill('100');
  await validationDialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(validationDialog).not.toBeVisible();

  await selectRange('A1', 'B3');
  await openDataMenu();
  await page.getByRole('menuitem', { name: 'Create filter', exact: true }).click();
  await page.getByRole('button', { name: 'Filter Region', exact: true }).click();
  const filterDialog = page.getByRole('dialog', { name: 'Filter Region', exact: true });
  await filterDialog.getByRole('button', { name: 'Clear selection', exact: true }).click();
  await filterDialog.getByRole('checkbox', { name: 'East', exact: true }).check();
  await filterDialog.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByRole('gridcell', { name: 'B3', exact: true })).toBeHidden();

  await insertColumnLeft('A');

  await expect(page.getByRole('gridcell', { name: 'B2', exact: true })).toBeVisible();
  await expect(page.getByRole('gridcell', { name: 'B3', exact: true })).toBeHidden();

  await page.getByRole('gridcell', { name: 'C2', exact: true }).click();
  await page.keyboard.type('200');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Please enter a number from 0 to 100', { exact: true })).toBeVisible();
  await expect(page.getByRole('gridcell', { name: 'C2', exact: true })).toHaveText('50');

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(page.getByRole('gridcell', { name: 'C2', exact: true })).toHaveText('50');
  await expect(page.getByRole('gridcell', { name: 'B3', exact: true })).toBeHidden();
});

test('REQ-2-2-2#5: REQ-2-2-2 -the requested workflow', async () => {
  await importWorkbook('Region,Sales\nEast,1200\nNorth,800');

  await selectRange('A1', 'B3');
  await openDataMenu();
  await page.getByRole('menuitem', { name: 'Create pivot table', exact: true }).click();
  const createDialog = page.getByRole('dialog', { name: 'Create pivot table', exact: true });
  await expect(createDialog.getByText('Source range: A1:B3', { exact: true })).toBeVisible();
  await createDialog.getByRole('radio', { name: 'New worksheet', exact: true }).check();
  await createDialog.getByRole('button', { name: 'Create', exact: true }).click();

  const editor = page.getByRole('region', { name: 'Pivot table editor', exact: true });
  await expect(editor).toBeVisible();
  await selectCombo('Rows', 'Region');
  await selectCombo('Values', 'Sales');
  await selectCombo('Summarize by', 'SUM');
  await editor.getByRole('button', { name: 'Apply', exact: true }).click();

  await expect(page.getByRole('gridcell', { name: 'B2', exact: true })).toHaveText('1200');

  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await insertColumnLeft('A');
  await page.getByRole('tab', { name: 'Pivot1', exact: true }).click();
  await expect(page.getByRole('gridcell', { name: 'B2', exact: true })).toHaveText('1200');
  await page.getByRole('button', { name: 'Refresh pivot table', exact: true }).click();
  await expect(page.getByRole('gridcell', { name: 'B2', exact: true })).toHaveText('1200');

  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await deleteColumn('C');
  await page.getByRole('tab', { name: 'Pivot1', exact: true }).click();
  await page.getByRole('button', { name: 'Refresh pivot table', exact: true }).click();
  await expect(page.getByText('Pivot field is no longer available. Select a new field.', { exact: true })).toBeVisible();
  await expect(page.getByRole('gridcell', { name: 'B2', exact: true })).toHaveText('1200');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

