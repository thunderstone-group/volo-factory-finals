const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function createWorkbook(page, name) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Rename workbook', exact: true }).click();
  await page.getByLabel('Workbook name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByLabel('Workbook name', { exact: true })).not.toBeVisible();
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
}

async function addWorksheet(page) {
  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
  const sheet2 = page.getByRole('tab', { name: 'Sheet2', exact: true });
  await expect(sheet2).toBeVisible();
  await expect(sheet2).toHaveAttribute('aria-selected', 'true');
}

async function openWorksheetOptions(page, sheetName) {
  await page.getByRole('button', {
    name: `Worksheet options for ${sheetName}`,
    exact: true,
  }).click();
}

async function setCell(page, coordinate, value) {
  await page.getByRole('gridcell', { name: coordinate, exact: true }).click();
  await page.getByLabel('Formula bar', { exact: true }).fill(value);
  await page.keyboard.press('Enter');
}

async function dragRange(page, startCell, endCell) {
  const start = page.getByRole('gridcell', { name: startCell, exact: true });
  const end = page.getByRole('gridcell', { name: endCell, exact: true });
  await start.scrollIntoViewIfNeeded();
  await end.scrollIntoViewIfNeeded();
  const startBox = await start.boundingBox();
  const endBox = await end.boundingBox();

  await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(endBox.x + endBox.width / 2, endBox.y + endBox.height / 2, { steps: 8 });
  await page.mouse.up();
}

async function chooseCombo(page, scope, label, optionName) {
  await scope.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: optionName, exact: true }).click();
}

async function seedSourceData(page) {
  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  const values = {
    A1: 'Region',
    B1: 'Sales',
    C1: 'Status',
    A2: 'East',
    B2: '1200',
    C2: 'Open',
    A3: 'North',
    B3: '800',
    C3: 'Closed',
    A4: 'South',
    B4: '700',
    C4: 'Open',
  };
  for (const coordinate of Object.keys(values)) {
    await setCell(page, coordinate, values[coordinate]);
  }
  await expect(page.getByRole('gridcell', { name: 'A1', exact: true })).toHaveText('Region');
}

async function createPivot(page) {
  await dragRange(page, 'A1', 'C4');
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Create pivot table', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Create pivot table', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Source range: A1:C4', { exact: true })).toBeVisible();
  await dialog.getByRole('radio', { name: 'New worksheet', exact: true }).click();
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();

  await expect(page.getByRole('tab', { name: 'Pivot1', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Pivot1', exact: true }).click();

  const editor = page.getByRole('region', { name: 'Pivot table editor', exact: true });
  await expect(editor).toBeVisible();
  await chooseCombo(page, editor, 'Rows', 'Region');
  await chooseCombo(page, editor, 'Values', 'Sales');
  await chooseCombo(page, editor, 'Summarize by', 'SUM');
  await editor.getByRole('button', { name: 'Apply', exact: true }).click();

  await expect(page.getByRole('gridcell', { name: 'A1', exact: true })).toHaveText('Region');
  await expect(page.getByRole('gridcell', { name: 'B1', exact: true })).toHaveText('SUM of Sales');
}

test('REQ-2-1-3: REQ-2-1-3 -the requested workflow,the requested workflow', async ({ page }) => {
  const workbookName = 'WB ' + u();
  const newSheetName = 'Data ' + u();
  await createWorkbook(page, workbookName);

  await openWorksheetOptions(page, 'Sheet1');
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Rename worksheet', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Worksheet name', { exact: true })).toHaveValue('Sheet1');
  await dialog.getByLabel('Worksheet name', { exact: true }).fill(`  ${newSheetName}  `);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('tab', { name: newSheetName, exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('tab', { name: newSheetName, exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveCount(0);
});

test('REQ-2-1-3#2: REQ-2-1-3 -the requested workflow,the requested workflow', async ({ page }) => {
  const workbookName = 'WB ' + u();
  await createWorkbook(page, workbookName);
  await addWorksheet(page);

  await openWorksheetOptions(page, 'Sheet2');
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Rename worksheet', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Worksheet name', { exact: true }).fill('  Sheet1  ');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText('Worksheet name already exists', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
});

test('REQ-2-1-3#3: REQ-2-1-3 -the requested workflow,the requested workflow', async ({ page }) => {
  const workbookName = 'WB ' + u();
  await createWorkbook(page, workbookName);

  await openWorksheetOptions(page, 'Sheet1');
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Rename worksheet', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Worksheet name', { exact: true }).fill('    ');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText('Worksheet name cannot be empty', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
});

test('REQ-2-1-4: REQ-2-1-4 -the requested workflow,the requested workflow', async ({ page }) => {
  const workbookName = 'WB ' + u();
  await createWorkbook(page, workbookName);
  await addWorksheet(page);
  await setCell(page, 'A1', 'Doomed');

  await openWorksheetOptions(page, 'Sheet2');
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Delete worksheet', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Sheet2/).first()).toBeVisible();
  await dialog.getByRole('button', { name: 'Delete worksheet', exact: true }).click();

  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute(
    'aria-selected',
    'true'
  );

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
});

test('REQ-2-1-4#2: REQ-2-1-4 -the requested workflow,the requested workflow', async ({ page }) => {
  const workbookName = 'WB ' + u();
  await createWorkbook(page, workbookName);

  await openWorksheetOptions(page, 'Sheet1');
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();

  await expect(
    page.getByRole('dialog', { name: 'Delete worksheet', exact: true })
  ).not.toBeVisible();
  await expect(
    page.getByText('A workbook must contain at least one worksheet', { exact: true })
  ).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
});

test('REQ-2-1-4#3: REQ-2-1-4 -the requested workflow,the requested workflow', async ({ page }) => {
  const workbookName = 'WB ' + u();
  await createWorkbook(page, workbookName);
  await addWorksheet(page);
  await seedSourceData(page);
  await createPivot(page);

  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await openWorksheetOptions(page, 'Sheet1');
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Delete worksheet', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Delete worksheet', exact: true }).click();

  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText('Please delete or rebuild dependent pivot tables first', { exact: true })
  ).toBeVisible();

  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await expect(page.getByRole('gridcell', { name: 'A1', exact: true })).toHaveText('Region');

  await page.getByRole('tab', { name: 'Pivot1', exact: true }).click();
  await expect(page.getByRole('gridcell', { name: 'B1', exact: true })).toHaveText('SUM of Sales');
  await expect(page.getByRole('gridcell', { name: 'B5', exact: true })).toHaveText('2700');

  await page.reload();
  await page.getByRole('tab', { name: 'Pivot1', exact: true }).click();
  await expect(page.getByRole('gridcell', { name: 'B5', exact: true })).toHaveText('2700');
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
});

test('REQ-2-1-4#4: REQ-2-1-4 -the requested workflow', async ({ page }) => {
  const workbookName = 'WB ' + u();
  await createWorkbook(page, workbookName);
  await addWorksheet(page);
  await seedSourceData(page);
  await createPivot(page);

  await page.getByRole('tab', { name: 'Pivot1', exact: true }).click();
  await openWorksheetOptions(page, 'Pivot1');
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();

  const deletePivotDialog = page.getByRole('dialog', { name: 'Delete worksheet', exact: true });
  await expect(deletePivotDialog).toBeVisible();
  await expect(deletePivotDialog.getByText(/Pivot1/).first()).toBeVisible();
  await deletePivotDialog.getByRole('button', { name: 'Delete worksheet', exact: true }).click();

  await expect(deletePivotDialog).not.toBeVisible();
  await expect(page.getByRole('tab', { name: 'Pivot1', exact: true })).toHaveCount(0);

  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await openWorksheetOptions(page, 'Sheet1');
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();

  const deleteSourceDialog = page.getByRole('dialog', { name: 'Delete worksheet', exact: true });
  await expect(deleteSourceDialog).toBeVisible();
  await expect(deleteSourceDialog.getByText(/Sheet1/).first()).toBeVisible();
  await deleteSourceDialog.getByRole('button', { name: 'Delete worksheet', exact: true }).click();

  await expect(deleteSourceDialog).not.toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toBeVisible();
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

