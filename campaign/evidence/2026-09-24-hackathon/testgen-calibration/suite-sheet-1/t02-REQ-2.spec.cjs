const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function newBlankWorkbook(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
}

async function cell(page, coord) {
  return page
    .getByRole('grid', { name: 'Worksheet grid', exact: true })
    .getByRole('gridcell', { name: coord, exact: true });
}

async function selectCell(page, coord) {
  await cell(page, coord).click();
}

async function setCell(page, coord, value) {
  await selectCell(page, coord);
  const formulaBar = page.getByLabel('Formula bar', { exact: true });
  await formulaBar.fill(value);
  await formulaBar.press('Enter');
}

async function addWorksheet(page) {
  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toBeVisible();
}

async function clickTab(page, name) {
  await page.getByRole('tab', { name, exact: true }).click();
}

async function openWorksheetMenu(page, name) {
  await page.getByRole('button', { name: `Worksheet options for ${name}`, exact: true }).click();
}

async function renameWorksheet(page, currentName, newName, { waitClosed = true } = {}) {
  await openWorksheetMenu(page, currentName);
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Rename worksheet', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Worksheet name', { exact: true }).fill(newName);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  if (waitClosed) {
    await expect(dialog).toBeHidden();
  }
}

async function selectRange(page, startCoord, endCoord) {
  const grid = page.getByRole('grid', { name: 'Worksheet grid', exact: true });
  const start = grid.getByRole('gridcell', { name: startCoord, exact: true });
  const end = grid.getByRole('gridcell', { name: endCoord, exact: true });
  await start.scrollIntoViewIfNeeded();
  await end.scrollIntoViewIfNeeded();
  const startBox = await start.boundingBox();
  const endBox = await end.boundingBox();
  if (!startBox || !endBox) {
    throw new Error('Could not locate range cells');
  }
  await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(endBox.x + endBox.width / 2, endBox.y + endBox.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(start).toHaveAttribute('aria-selected', 'true');
  await expect(end).toHaveAttribute('aria-selected', 'true');
}

async function openDataMenu(page) {
  await page.getByRole('button', { name: 'Data', exact: true }).click();
}

async function chooseComboOption(page, combo, optionName) {
  const tag = await combo.evaluate((el) => el.tagName).catch(() => '');
  if (tag === 'SELECT') {
    await combo.selectOption({ label: optionName });
    return;
  }
  await combo.click();
  await page.getByRole('option', { name: optionName, exact: true }).click();
}

async function createFilter(page, startCoord, endCoord) {
  await selectRange(page, startCoord, endCoord);
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: 'Create filter', exact: true }).click();
}

async function createDropdownValidation(page, coord, allowedValues) {
  await selectCell(page, coord);
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: 'Data validation', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await expect(dialog).toBeVisible();
  await chooseComboOption(page, dialog.getByLabel('Rule type', { exact: true }), 'Dropdown');
  await dialog.getByLabel('Allowed values', { exact: true }).fill(allowedValues);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();
}

test('REQ-2-1-1: Add a worksheet and preserve it after refresh', async ({ page }) => {
  await newBlankWorkbook(page);
  await setCell(page, 'A1', 'Existing data');
  await addWorksheet(page);

  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');

  await page.reload();

  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveAttribute('aria-selected', 'true');

  await clickTab(page, 'Sheet1');
  await expect(cell(page, 'A1')).toHaveText('Existing data');
});

test('REQ-2-1-2: Keep worksheet data independent when switching', async ({ page }) => {
  await newBlankWorkbook(page);
  await setCell(page, 'A1', 'Sheet1 data');
  await addWorksheet(page);
  await setCell(page, 'A1', 'Sheet2 data');

  await clickTab(page, 'Sheet1');
  await expect(cell(page, 'A1')).toHaveText('Sheet1 data');

  await clickTab(page, 'Sheet2');
  await expect(cell(page, 'A1')).toHaveText('Sheet2 data');

  await clickTab(page, 'Sheet1');
  await expect(cell(page, 'A1')).toHaveText('Sheet1 data');
});

test('REQ-2-1-2#2: Keep Filter and Validation Entry Points Isolated When Switching', async ({ page }) => {
  await newBlankWorkbook(page);

  await setCell(page, 'A1', 'Region');
  await setCell(page, 'B1', 'Sales');
  await setCell(page, 'C1', 'Status');
  await setCell(page, 'A2', 'East');
  await setCell(page, 'B2', '1200');
  await setCell(page, 'C2', 'Open');

  await addWorksheet(page);
  await setCell(page, 'A1', 'Sheet2 value');
  await clickTab(page, 'Sheet1');

  await createFilter(page, 'A1', 'C2');
  await expect(page.getByRole('button', { name: 'Filter Region', exact: true })).toBeVisible();

  await createDropdownValidation(page, 'C2', 'Open,Closed');
  await expect(page.getByRole('button', { name: 'Open dropdown for C2', exact: true })).toBeVisible();

  await clickTab(page, 'Sheet2');
  await expect(page.getByRole('button', { name: 'Filter Region', exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open dropdown for C2', exact: true })).toBeHidden();
  await expect(cell(page, 'A1')).toHaveText('Sheet2 value');

  await clickTab(page, 'Sheet1');
  await expect(page.getByRole('button', { name: 'Filter Region', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open dropdown for C2', exact: true })).toBeVisible();
  await expect(cell(page, 'A1')).toHaveText('Region');

  await clickTab(page, 'Sheet2');
  await expect(page.getByRole('button', { name: 'Filter Region', exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open dropdown for C2', exact: true })).toBeHidden();
  await expect(cell(page, 'A1')).toHaveText('Sheet2 value');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: 'Filter Region', exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open dropdown for C2', exact: true })).toBeHidden();
  await expect(cell(page, 'A1')).toHaveText('Sheet2 value');
});

test('REQ-2-1-3: Save a unique worksheet name', async ({ page }) => {
  await newBlankWorkbook(page);
  const newName = 'Data' + u();

  await renameWorksheet(page, 'Sheet1', newName);

  await expect(page.getByRole('tab', { name: newName, exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('tab', { name: newName, exact: true })).toBeVisible();
});

test('REQ-2-1-3#2: Reject a duplicate name', async ({ page }) => {
  await newBlankWorkbook(page);
  await addWorksheet(page);
  const target = 'Shared' + u();

  await renameWorksheet(page, 'Sheet2', target);
  await clickTab(page, 'Sheet1');

  await renameWorksheet(page, 'Sheet1', target, { waitClosed: false });
  await expect(page.getByText('Worksheet name already exists', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: target, exact: true })).toBeVisible();
});

test('REQ-2-1-3#3: Reject an empty worksheet name', async ({ page }) => {
  await newBlankWorkbook(page);

  await renameWorksheet(page, 'Sheet1', '   ', { waitClosed: false });
  await expect(page.getByText('Worksheet name cannot be empty', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
});
