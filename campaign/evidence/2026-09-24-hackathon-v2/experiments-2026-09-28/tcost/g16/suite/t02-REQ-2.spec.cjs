const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const wbName = (prefix) => `${prefix}-${u()}`;

const cell = (page, coord) => page.getByRole('gridcell', { name: coord, exact: true });
const formulaBar = (page) => page.getByLabel('Formula bar', { exact: true });
const tab = (page, name) => page.getByRole('tab', { name, exact: true });
const worksheetOptionsButton = (page, sheetName) =>
  page.getByRole('button', { name: `Worksheet options for ${sheetName}`, exact: true });

async function createWorkbook(page, name) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(tab(page, 'Sheet1')).toBeVisible();
  await page.getByRole('button', { name: 'Rename workbook', exact: true }).click();
  await page.getByLabel('Workbook name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Rename workbook', exact: true })).toBeVisible();
}

async function setCell(page, coord, value) {
  await cell(page, coord).click();
  await formulaBar(page).fill(String(value));
  await page.keyboard.press('Enter');
}

async function addWorksheet(page, expectedName) {
  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
  await expect(tab(page, expectedName)).toHaveAttribute('aria-selected', 'true');
}

async function openWorksheetMenu(page, sheetName) {
  await worksheetOptionsButton(page, sheetName).click();
}

async function renameWorksheet(page, currentName, newName) {
  await openWorksheetMenu(page, currentName);
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Rename worksheet', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Worksheet name', { exact: true }).fill(newName);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
}

async function deleteWorksheet(page, sheetName) {
  await openWorksheetMenu(page, sheetName);
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete worksheet', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(sheetName);
  await dialog.getByRole('button', { name: 'Delete worksheet', exact: true }).click();
}

async function createTwoSheetDataWorkbook(page) {
  const name = wbName('WB');
  await createWorkbook(page, name);
  await addWorksheet(page, 'Sheet2');
  await tab(page, 'Sheet1').click();
  await setCell(page, 'A1', 'East');
  await setCell(page, 'B1', 1200);
  await setCell(page, 'A2', 'North');
  await setCell(page, 'B2', 800);
  await cell(page, 'A1').click();
  return name;
}

async function selectRange(page, start, end) {
  const startLocator = cell(page, start);
  const endLocator = cell(page, end);
  await startLocator.click();
  const sb = await startLocator.boundingBox();
  const eb = await endLocator.boundingBox();
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.mouse.down();
  await page.mouse.move(eb.x + eb.width / 2, eb.y + eb.height / 2, { steps: 5 });
  await page.mouse.up();
}

async function selectComboOption(page, scope, label, optionName) {
  const combo = scope.getByLabel(label, { exact: true });
  await combo.click();
  await page.getByRole('option', { name: optionName, exact: true }).click();
}

async function createPivotSetup(page) {
  const name = wbName('PVT');
  await createWorkbook(page, name);
  await addWorksheet(page, 'Sheet2');
  await tab(page, 'Sheet1').click();
  await setCell(page, 'A1', 'Region');
  await setCell(page, 'B1', 'Sales');
  await setCell(page, 'A2', 'East');
  await setCell(page, 'B2', 1200);
  await setCell(page, 'A3', 'North');
  await setCell(page, 'B3', 800);
  await selectRange(page, 'A1', 'B3');

  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Create pivot table', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Create pivot table', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Source range:');
  await dialog.getByRole('radio', { name: 'New worksheet', exact: true }).check();
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();

  const editor = page.getByRole('region', { name: 'Pivot table editor', exact: true });
  await expect(editor).toBeVisible();
  await selectComboOption(page, editor, 'Rows', 'Region');
  await selectComboOption(page, editor, 'Values', 'Sales');
  await selectComboOption(page, editor, 'Summarize by', 'SUM');
  await editor.getByRole('button', { name: 'Apply', exact: true }).click();

  return name;
}

test('REQ-2-1-1: REQ-2-1-1 -the requested workflow Sheet2,the requested workflow', async ({ page }) => {
  await createWorkbook(page, wbName('ADD1'));
  await setCell(page, 'A1', 'keep');

  const grid = page.getByRole('grid', { name: 'Worksheet grid', exact: true });
  await expect(grid).toHaveAttribute('aria-multiselectable', 'true');

  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
  await expect(tab(page, 'Sheet2')).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page, 'Sheet1')).toBeVisible();
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('');

  await tab(page, 'Sheet1').click();
  await expect(cell(page, 'A1')).toHaveText('keep');

  await tab(page, 'Sheet2').click();
  await page.reload();
  await expect(tab(page, 'Sheet2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
});

test('REQ-2-1-1#2: REQ-2-1-1 -the requested workflow SheetN the requested workflow', async ({ page }) => {
  await createTwoSheetDataWorkbook(page);

  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
  await expect(tab(page, 'Sheet3')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');

  await tab(page, 'Sheet1').click();
  await expect(cell(page, 'A1')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('800');

  await page.reload();
  await expect(tab(page, 'Sheet3')).toHaveAttribute('aria-selected', 'true');
});

test('REQ-2-1-2: REQ-2-1-2 -the requested workflow, the requested workflow', async ({ page }) => {
  await createTwoSheetDataWorkbook(page);

  await tab(page, 'Sheet2').click();
  await expect(tab(page, 'Sheet2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('');
  await expect(formulaBar(page)).toHaveValue('');

  await tab(page, 'Sheet1').click();
  await expect(cell(page, 'A1')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('800');
});

test('REQ-2-1-2#2: REQ-2-1-2 -the requested workflow', async ({ page }) => {
  await createTwoSheetDataWorkbook(page);

  await tab(page, 'Sheet2').click();
  await cell(page, 'B2').click();
  await setCell(page, 'B2', 999);
  await cell(page, 'B2').click();

  await tab(page, 'Sheet1').click();
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('East');

  await tab(page, 'Sheet2').click();
  await expect(cell(page, 'B2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'B2')).toHaveText('999');
});

test('REQ-2-1-2#3: REQ-2-1-2 -the requested workflow', async ({ page }) => {
  await createTwoSheetDataWorkbook(page);

  await setCell(page, 'C1', 5);
  await setCell(page, 'D1', '=C1*2');

  await cell(page, 'D1').click();
  await expect(cell(page, 'D1')).toHaveText('10');
  await expect(formulaBar(page)).toHaveValue('=C1*2');

  await cell(page, 'C1').click();
  await expect(formulaBar(page)).toHaveValue('5');

  await tab(page, 'Sheet2').click();
  await cell(page, 'A1').click();
  await expect(formulaBar(page)).toHaveValue('');

  await tab(page, 'Sheet1').click();
  await cell(page, 'D1').click();
  await expect(formulaBar(page)).toHaveValue('=C1*2');
});

test('REQ-2-1-2#4: REQ-2-1-2 -the requested workflow', async ({ page }) => {
  await createTwoSheetDataWorkbook(page);

  await tab(page, 'Sheet2').click();
  await cell(page, 'B1').click();

  await page.reload();
  await expect(tab(page, 'Sheet2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'B1')).toHaveAttribute('aria-selected', 'true');
});

test('REQ-2-1-2#5: REQ-2-1-2 -the requested workflow', async ({ page }) => {
  await createTwoSheetDataWorkbook(page);

  await cell(page, 'A2').click();
  await tab(page, 'Sheet2').click();
  await cell(page, 'B1').click();

  await page.reload();
  await expect(tab(page, 'Sheet2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'B1')).toHaveAttribute('aria-selected', 'true');

  await tab(page, 'Sheet1').click();
  await expect(cell(page, 'A2')).toHaveAttribute('aria-selected', 'true');
});

test('REQ-2-1-3: REQ-2-1-3 -the requested workflow,the requested workflow', async ({ page }) => {
  const newName = `Renamed-${u()}`;
  await createWorkbook(page, wbName('RN1'));

  await renameWorksheet(page, 'Sheet1', newName);
  await expect(tab(page, newName)).toBeVisible();
  await expect(tab(page, 'Sheet1')).toHaveCount(0);

  await page.reload();
  await expect(tab(page, newName)).toBeVisible();
});

test('REQ-2-1-3#2: REQ-2-1-3 -the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbook(page, wbName('RN2'));

  await openWorksheetMenu(page, 'Sheet1');
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Rename worksheet', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Worksheet name', { exact: true }).fill('');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText('Worksheet name cannot be empty', { exact: true })).toBeVisible();
  await expect(tab(page, 'Sheet1')).toBeVisible();
});

test('REQ-2-1-3#3: REQ-2-1-3 -the requested workflow,the requested workflow', async ({ page }) => {
  await createTwoSheetDataWorkbook(page);

  await renameWorksheet(page, 'Sheet1', 'Sheet2');
  await expect(page.getByText('Worksheet name already exists', { exact: true })).toBeVisible();
  await expect(tab(page, 'Sheet1')).toBeVisible();
  await expect(tab(page, 'Sheet2')).toBeVisible();
});

test('REQ-2-1-4: REQ-2-1-4 -the requested workflow,the requested workflow', async ({ page }) => {
  await createTwoSheetDataWorkbook(page);

  await deleteWorksheet(page, 'Sheet2');
  await expect(tab(page, 'Sheet2')).toHaveCount(0);
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('East');

  await page.reload();
  await expect(tab(page, 'Sheet2')).toHaveCount(0);
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
});

test('REQ-2-1-4#2: REQ-2-1-4 -the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbook(page, wbName('LAST'));

  await openWorksheetMenu(page, 'Sheet1');
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();

  await expect(page.getByRole('dialog', { name: 'Delete worksheet', exact: true })).toHaveCount(0);
  await expect(page.getByText('A workbook must contain at least one worksheet', { exact: true })).toBeVisible();
  await expect(tab(page, 'Sheet1')).toBeVisible();

  await page.reload();
  await expect(tab(page, 'Sheet1')).toBeVisible();
});

test('REQ-2-1-4#3: REQ-2-1-4 -the requested workflow,the requested workflow', async ({ page }) => {
  await createPivotSetup(page);

  await tab(page, 'Sheet1').click();
  await openWorksheetMenu(page, 'Sheet1');
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();

  await expect(page.getByRole('dialog', { name: 'Delete worksheet', exact: true })).toHaveCount(0);
  await expect(page.getByText('Please delete or rebuild dependent pivot tables first', { exact: true })).toBeVisible();
  await expect(tab(page, 'Sheet1')).toBeVisible();
  await expect(tab(page, 'Pivot1')).toBeVisible();
});

test('REQ-2-1-4#4: REQ-2-1-4 -the requested workflow', async ({ page }) => {
  await createPivotSetup(page);

  await deleteWorksheet(page, 'Pivot1');
  await expect(tab(page, 'Pivot1')).toHaveCount(0);

  await deleteWorksheet(page, 'Sheet1');
  await expect(tab(page, 'Sheet1')).toHaveCount(0);
  await expect(tab(page, 'Sheet2')).toHaveAttribute('aria-selected', 'true');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

