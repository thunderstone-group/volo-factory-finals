const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function createBlankWorkbook(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
}

async function importCsv(page, content) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Import CSV', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import CSV', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('CSV file', { exact: true }).setInputFiles({
    name: 'pivot-data.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(content, 'utf8'),
  });
  await dialog.getByRole('button', { name: 'Confirm import', exact: true }).click();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
}

async function addWorksheet(page) {
  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toBeVisible();
}

async function openWorksheetMenuCommand(page, sheetName, command) {
  await page.getByRole('button', { name: `Worksheet options for ${sheetName}`, exact: true }).click();
  await page.getByRole('menuitem', { name: command, exact: true }).click();
}

async function selectComboboxOption(page, label, optionName) {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  const option = page.getByRole('option', { name: optionName, exact: true });
  await expect(option).toBeVisible();
  await option.click();
}

async function createPivot(page) {
  const a1 = page.getByRole('gridcell', { name: 'A1', exact: true });
  const c4 = page.getByRole('gridcell', { name: 'C4', exact: true });
  await c4.scrollIntoViewIfNeeded();
  await a1.click();
  const from = await a1.boundingBox();
  const to = await c4.boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 5 });
  await page.mouse.up();

  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Create pivot table', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create pivot table', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Source range: A1:C4');
  await dialog.getByRole('radio', { name: 'New worksheet', exact: true }).check();
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Pivot table editor', exact: true })).toBeVisible();

  await selectComboboxOption(page, 'Rows', 'Region');
  await selectComboboxOption(page, 'Values', 'Sales');
  await selectComboboxOption(page, 'Summarize by', 'SUM');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Pivot1', exact: true })).toBeVisible();
}

test('REQ-2-1-3: REQ-2-1-3 -the requested workflow,the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  const newName = 'Data' + u();

  await openWorksheetMenuCommand(page, 'Sheet1', 'Rename');
  const dialog = page.getByRole('dialog', { name: 'Rename worksheet', exact: true });
  await expect(dialog).toBeVisible();
  const nameInput = dialog.getByLabel('Worksheet name', { exact: true });
  await expect(nameInput).toHaveValue('Sheet1');
  await nameInput.fill(newName);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByRole('tab', { name: newName, exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('tab', { name: newName, exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveCount(0);
});

test('REQ-2-1-3#2: REQ-2-1-3 -the requested workflow,the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);

  await openWorksheetMenuCommand(page, 'Sheet1', 'Rename');
  const dialog = page.getByRole('dialog', { name: 'Rename worksheet', exact: true });
  await dialog.getByLabel('Worksheet name', { exact: true }).fill('   ');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText('Worksheet name cannot be empty', { exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
});

test('REQ-2-1-3#3: REQ-2-1-3 -the requested workflow,the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await addWorksheet(page);

  await openWorksheetMenuCommand(page, 'Sheet1', 'Rename');
  const dialog = page.getByRole('dialog', { name: 'Rename worksheet', exact: true });
  await dialog.getByLabel('Worksheet name', { exact: true }).fill('Sheet2');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText('Worksheet name already exists', { exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toBeVisible();
});

test('REQ-2-1-4: REQ-2-1-4 -the requested workflow,the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await addWorksheet(page);

  await openWorksheetMenuCommand(page, 'Sheet2', 'Delete');
  const dialog = page.getByRole('dialog', { name: 'Delete worksheet', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Sheet2');
  await dialog.getByRole('button', { name: 'Delete worksheet', exact: true }).click();

  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
});

test('REQ-2-1-4#2: REQ-2-1-4 -the requested workflow,the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);

  await openWorksheetMenuCommand(page, 'Sheet1', 'Delete');
  await expect(page.getByRole('dialog', { name: 'Delete worksheet', exact: true })).toHaveCount(0);
  await expect(page.getByText('A workbook must contain at least one worksheet', { exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
});

test('REQ-2-1-4#3: REQ-2-1-4 -the requested workflow,the requested workflow', async ({ page }) => {
  await importCsv(page, 'Region,Sales,Status\nEast,1200,Open\nNorth,800,Closed\nSouth,700,Open\n');
  await createPivot(page);

  await openWorksheetMenuCommand(page, 'Sheet1', 'Delete');
  const dialog = page.getByRole('dialog', { name: 'Delete worksheet', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Sheet1');
  await dialog.getByRole('button', { name: 'Delete worksheet', exact: true }).click();

  await expect(page.getByText('Please delete or rebuild dependent pivot tables first', { exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Pivot1', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Pivot1', exact: true })).toBeVisible();
});

test('REQ-2-1-4#4: REQ-2-1-4 -the requested workflow', async ({ page }) => {
  await importCsv(page, 'Region,Sales,Status\nEast,1200,Open\nNorth,800,Closed\nSouth,700,Open\n');
  await addWorksheet(page);
  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await createPivot(page);

  await openWorksheetMenuCommand(page, 'Pivot1', 'Delete');
  const dialog = page.getByRole('dialog', { name: 'Delete worksheet', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Pivot1');
  await dialog.getByRole('button', { name: 'Delete worksheet', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Pivot1', exact: true })).toHaveCount(0);

  await openWorksheetMenuCommand(page, 'Sheet1', 'Delete');
  const sourceDialog = page.getByRole('dialog', { name: 'Delete worksheet', exact: true });
  await expect(sourceDialog).toBeVisible();
  await expect(sourceDialog).toContainText('Sheet1');
  await sourceDialog.getByRole('button', { name: 'Delete worksheet', exact: true }).click();

  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Pivot1', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toBeVisible();
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

