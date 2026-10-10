const { test, expect } = require('@playwright/test');

test.use({ actionTimeout: 5000 });

function grid(page) {
  return page.getByRole('grid', { name: 'Worksheet grid', exact: true });
}

function cell(page, coord) {
  return grid(page).getByRole('gridcell', { name: coord, exact: true });
}

async function createBlankWorkbook(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
}

async function addWorksheet(page) {
  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toBeVisible();
}

async function openWorksheetMenu(page, worksheetName) {
  await page.getByRole('button', { name: `Worksheet options for ${worksheetName}`, exact: true }).click();
}

async function setCell(page, coord, value) {
  await cell(page, coord).click();
  const formulaBar = page.getByLabel('Formula bar', { exact: true });
  await formulaBar.click();
  await formulaBar.fill(String(value));
  await formulaBar.press('Enter');
}

async function dragSelect(page, fromCoord, toCoord) {
  const from = cell(page, fromCoord);
  const to = cell(page, toCoord);
  await from.scrollIntoViewIfNeeded();
  await to.scrollIntoViewIfNeeded();
  const fromBox = await from.boundingBox();
  const toBox = await to.boundingBox();
  if (!fromBox || !toBox) throw new Error('Unable to locate drag selection cells');
  await page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(toBox.x + toBox.width / 2, toBox.y + toBox.height / 2, { steps: 8 });
  await page.mouse.up();
}

async function selectPivotField(page, editor, label, optionName) {
  const combo = editor.getByRole('combobox', { name: label, exact: true });
  const tag = await combo.evaluate((el) => el.tagName);
  if (tag === 'SELECT') {
    await combo.selectOption({ label: optionName });
  } else {
    await combo.click();
    await page.getByRole('option', { name: optionName, exact: true }).click();
  }
}

test('REQ-2-1-4: Delete one of multiple worksheets', async ({ page }) => {
  await createBlankWorkbook(page);
  await addWorksheet(page);

  await openWorksheetMenu(page, 'Sheet2');
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();

  const confirmDialog = page.getByRole('dialog', { name: 'Delete worksheet', exact: true });
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.getByRole('button', { name: 'Delete worksheet', exact: true }).click();

  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).not.toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).not.toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('REQ-2-1-4#2: Preserve the last worksheet', async ({ page }) => {
  await createBlankWorkbook(page);

  await openWorksheetMenu(page, 'Sheet1');
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();

  await expect(page.getByText('A workbook must contain at least one worksheet', { exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
});

test('REQ-2-1-4#3: Reject deletion of a pivot table source worksheet', async ({ page }) => {
  await createBlankWorkbook(page);

  await setCell(page, 'A1', 'Region');
  await setCell(page, 'B1', 'Sales');
  await setCell(page, 'A2', 'East');
  await setCell(page, 'B2', '100');

  await dragSelect(page, 'A1', 'B2');
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Create pivot table', exact: true }).click();

  const createDialog = page.getByRole('dialog', { name: 'Create pivot table', exact: true });
  await expect(createDialog).toBeVisible();
  await createDialog.getByRole('radio', { name: 'New worksheet', exact: true }).click();
  await createDialog.getByRole('button', { name: 'Create', exact: true }).click();

  const editor = page.getByRole('region', { name: 'Pivot table editor', exact: true });
  await expect(editor).toBeVisible();
  await selectPivotField(page, editor, 'Rows', 'Region');
  await selectPivotField(page, editor, 'Values', 'Sales');
  await selectPivotField(page, editor, 'Summarize by', 'SUM');
  await editor.getByRole('button', { name: 'Apply', exact: true }).click();

  await expect(page.getByRole('tab', { name: 'Pivot1', exact: true })).toBeVisible();
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('100');

  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await openWorksheetMenu(page, 'Sheet1');
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();

  const confirmDialog = page.getByRole('dialog', { name: 'Delete worksheet', exact: true });
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.getByRole('button', { name: 'Delete worksheet', exact: true }).click();

  await expect(page.getByText('Please delete or rebuild dependent pivot tables first', { exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await expect(cell(page, 'A2')).toHaveText('East');

  await page.getByRole('tab', { name: 'Pivot1', exact: true }).click();
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('100');
});

test('REQ-2-2-1: Insert a row into existing data', async ({ page }) => {
  await createBlankWorkbook(page);

  await setCell(page, 'A1', 'Item');
  await setCell(page, 'B1', 'Amount');
  await setCell(page, 'A2', 'Alpha');
  await setCell(page, 'B2', '10');
  await setCell(page, 'A3', 'Beta');
  await setCell(page, 'B3', '20');

  await grid(page).getByRole('rowheader', { name: '3', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 row above', exact: true }).click();

  await expect(cell(page, 'A3')).toHaveText('');
  await expect(cell(page, 'B3')).toHaveText('');
  await expect(cell(page, 'A4')).toHaveText('Beta');
  await expect(cell(page, 'B4')).toHaveText('20');
  await expect(cell(page, 'A2')).toHaveText('Alpha');
  await expect(cell(page, 'B2')).toHaveText('10');

  await page.reload();
  await expect(cell(page, 'A3')).toHaveText('');
  await expect(cell(page, 'B3')).toHaveText('');
  await expect(cell(page, 'A4')).toHaveText('Beta');
  await expect(cell(page, 'B4')).toHaveText('20');
});

test('REQ-2-2-1#2: Delete a row and reopen', async ({ page }) => {
  await createBlankWorkbook(page);

  await setCell(page, 'A2', 'Alpha');
  await setCell(page, 'A3', 'Remove me');
  await setCell(page, 'A4', 'Beta');

  await grid(page).getByRole('rowheader', { name: '3', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete row', exact: true }).click();

  await expect(cell(page, 'A3')).toHaveText('Beta');
  await expect(cell(page, 'A4')).toHaveText('');
  await expect(cell(page, 'A2')).toHaveText('Alpha');

  await page.reload();
  await expect(cell(page, 'A3')).toHaveText('Beta');
  await expect(cell(page, 'A4')).toHaveText('');
  await expect(cell(page, 'A2')).toHaveText('Alpha');
});

test('REQ-2-2-2: Insert a column beside existing data', async ({ page }) => {
  await createBlankWorkbook(page);

  await setCell(page, 'A1', 'Alpha');
  await setCell(page, 'B1', 'Beta');
  await setCell(page, 'C1', 'Gamma');

  await grid(page).getByRole('columnheader', { name: 'B', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 column left', exact: true }).click();

  await expect(cell(page, 'A1')).toHaveText('Alpha');
  await expect(cell(page, 'B1')).toHaveText('');
  await expect(cell(page, 'C1')).toHaveText('Beta');
  await expect(cell(page, 'D1')).toHaveText('Gamma');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('Alpha');
  await expect(cell(page, 'B1')).toHaveText('');
  await expect(cell(page, 'C1')).toHaveText('Beta');
  await expect(cell(page, 'D1')).toHaveText('Gamma');
});

test('REQ-2-2-2#2: Delete a column referenced by a formula', async ({ page }) => {
  await createBlankWorkbook(page);

  await setCell(page, 'A1', 'Unit price');
  await setCell(page, 'B1', 'Quantity');
  await setCell(page, 'C1', 'Total');
  await setCell(page, 'A2', '10');
  await setCell(page, 'B2', '2');
  await setCell(page, 'C2', '=A2*B2');
  await expect(cell(page, 'C2')).toHaveText('20');

  await grid(page).getByRole('columnheader', { name: 'B', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete column', exact: true }).click();

  await expect(cell(page, 'B1')).toHaveText('Total');
  await expect(cell(page, 'B2')).toHaveText('#REF!');
  await expect(cell(page, 'A1')).toHaveText('Unit price');
  await expect(cell(page, 'A2')).toHaveText('10');

  await page.reload();
  await expect(cell(page, 'B1')).toHaveText('Total');
  await expect(cell(page, 'B2')).toHaveText('#REF!');
  await expect(cell(page, 'A1')).toHaveText('Unit price');
  await expect(cell(page, 'A2')).toHaveText('10');
});
