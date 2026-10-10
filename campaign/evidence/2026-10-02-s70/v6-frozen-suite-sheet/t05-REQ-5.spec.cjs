// End-to-end acceptance tests for REQ-5 (sorting, filtering, data validation, pivot analysis).
const { test, expect } = require('@playwright/test');
const fs = require('fs');

// Seeded worksheet range A1:C6 with headers Region/Sales/Status and the rows the requirements name.
const SEED_ROWS = [
  ['East', '1200', 'Open'],
  ['North', '800', 'Closed'],
  ['South', '700', 'Open'],
];

async function expectCell(page, coord, text) {
  await expect(page.getByRole('gridcell', { name: coord, exact: true })).toHaveText(text);
}

async function expectRows(page, rows) {
  for (let i = 0; i < rows.length; i += 1) {
    const r = i + 2;
    await expectCell(page, `A${r}`, rows[i][0]);
    await expectCell(page, `B${r}`, rows[i][1]);
    await expectCell(page, `C${r}`, rows[i][2]);
  }
}

async function expectHeaderRow(page) {
  await expectCell(page, 'A1', 'Region');
  await expectCell(page, 'B1', 'Sales');
  await expectCell(page, 'C1', 'Status');
}

async function switchTo(page, name) {
  const tab = page.getByRole('tab', { name, exact: true });
  await expect(tab).toBeVisible();
  if ((await tab.getAttribute('aria-selected')) !== 'true') {
    await tab.click();
  }
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

async function openWorkbook(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Q3 Sales', exact: true }).click();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await switchTo(page, 'Sheet1');
}

async function dragSelect(page, from, to) {
  const start = page.getByRole('gridcell', { name: from, exact: true });
  const end = page.getByRole('gridcell', { name: to, exact: true });
  await expect(start).toBeVisible();
  const a = await start.boundingBox();
  const b = await end.boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(start).toHaveAttribute('aria-selected', 'true');
  await expect(end).toHaveAttribute('aria-selected', 'true');
}

async function selectCell(page, coord) {
  const c = page.getByRole('gridcell', { name: coord, exact: true });
  await c.click();
  await expect(c).toHaveAttribute('aria-selected', 'true');
}

async function setCellViaGrid(page, coord, value) {
  await page.getByRole('gridcell', { name: coord, exact: true }).dblclick();
  const editor = page.getByRole('textbox', { name: `Edit ${coord}`, exact: true });
  await editor.fill(value);
  await editor.press('Enter');
}

async function setCellViaFormulaBar(page, coord, value) {
  await selectCell(page, coord);
  const bar = page.getByRole('textbox', { name: 'Formula bar', exact: true });
  await bar.click();
  await bar.fill(value);
  await bar.press('Enter');
}

async function openDataMenu(page, item) {
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByRole('menuitem', { name: item, exact: true }).click();
}

async function sortRange(page, by, order) {
  await openDataMenu(page, 'Sort range');
  const dialog = page.getByRole('dialog', { name: 'Sort range', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('combobox', { name: 'Sort by', exact: true }).click();
  await page.getByRole('option', { name: by, exact: true }).click();
  await dialog.getByRole('combobox', { name: 'Order', exact: true }).click();
  await page.getByRole('option', { name: order, exact: true }).click();
  await dialog.getByRole('checkbox', { name: 'Data has header row', exact: true }).check();
  await dialog.getByRole('button', { name: 'Sort', exact: true }).click();
  await expect(dialog).toBeHidden();
}

async function restoreSeededOrder(page) {
  await dragSelect(page, 'A1', 'C4');
  await sortRange(page, 'Sales', 'Descending');
  await expectRows(page, SEED_ROWS);
}

async function createFilter(page) {
  await dragSelect(page, 'A1', 'C4');
  await openDataMenu(page, 'Create filter');
  await expect(page.getByRole('button', { name: 'Filter Region', exact: true })).toBeVisible();
}

async function clearFilter(page) {
  await openDataMenu(page, 'Clear filter');
}

async function filterByValues(page, header, values) {
  await page.getByRole('button', { name: `Filter ${header}`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: `Filter ${header}`, exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Clear selection', exact: true }).click();
  for (const value of values) {
    await dialog.getByRole('checkbox', { name: value, exact: true }).check();
  }
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(dialog).toBeHidden();
}

async function filterByCondition(page, header, condition, value) {
  await page.getByRole('button', { name: `Filter ${header}`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: `Filter ${header}`, exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('combobox', { name: 'Condition', exact: true }).click();
  await page.getByRole('option', { name: condition, exact: true }).click();
  if (value !== undefined) {
    await dialog.getByLabel('Value', { exact: true }).fill(value);
  }
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(dialog).toBeHidden();
}

async function expectVisibleRow(page, row) {
  await expect(page.getByRole('gridcell', { name: `A${row}`, exact: true })).toBeVisible();
}

async function expectHiddenRow(page, row) {
  await expect(page.getByRole('gridcell', { name: `A${row}`, exact: true })).toBeHidden();
}

async function openValidationDialog(page) {
  await openDataMenu(page, 'Data validation');
  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function saveDropdownRule(page, from, to, allowed) {
  await dragSelect(page, from, to);
  const dialog = await openValidationDialog(page);
  await dialog.getByRole('combobox', { name: 'Rule type', exact: true }).click();
  await page.getByRole('option', { name: 'Dropdown', exact: true }).click();
  await dialog.getByLabel('Allowed values', { exact: true }).fill(allowed);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();
}

const DROPDOWN_ERROR = /Please select one of the following values:\s*Open,\s*Closed/;
const NUMBER_ERROR = /Please enter a number (between|from) 0 (and|to) 100/;

async function createPivot(page, from, to) {
  await dragSelect(page, from, to);
  await openDataMenu(page, 'Create pivot table');
  const dialog = page.getByRole('dialog', { name: 'Create pivot table', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(`Source range: ${from}:${to}`);
  await expect(dialog.getByRole('radio', { name: 'New worksheet', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(dialog).toBeHidden();
}

function pivotEditor(page) {
  return page.getByRole('region', { name: 'Pivot table editor', exact: true });
}

async function setPivotField(page, label, option) {
  await pivotEditor(page).getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

async function applyPivot(page) {
  await pivotEditor(page).getByRole('button', { name: 'Apply', exact: true }).click();
}

async function expectPivot(page, cells) {
  for (const [coord, text] of Object.entries(cells)) {
    await expectCell(page, coord, text);
  }
}

async function deleteWorksheet(page, name) {
  await page.getByRole('button', { name: `Worksheet options for ${name}`, exact: true }).click();
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete worksheet', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(name);
  await dialog.getByRole('button', { name: 'Delete worksheet', exact: true }).click();
  await expect(page.getByRole('tab', { name, exact: true })).toBeHidden();
}

/* ------------------------------- REQ-5-1-1 ------------------------------- */

test('REQ-5-1-1: REQ-5-1-1 -the requested workflow Sales the requested workflow,the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await expectHeaderRow(page);
  await expectRows(page, SEED_ROWS);

  await dragSelect(page, 'A1', 'C4');
  await sortRange(page, 'Sales', 'Ascending');

  // header row does not participate, whole records move together by row
  await expectHeaderRow(page);
  await expectRows(page, [
    ['South', '700', 'Open'],
    ['North', '800', 'Closed'],
    ['East', '1200', 'Open'],
  ]);

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expectHeaderRow(page);
  await expectRows(page, [
    ['South', '700', 'Open'],
    ['North', '800', 'Closed'],
    ['East', '1200', 'Open'],
  ]);

  await restoreSeededOrder(page);
});

test('REQ-5-1-1#2: REQ-5-1-1 -the requested workflow ISO the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await dragSelect(page, 'A1', 'C4');
  await sortRange(page, 'Region', 'Descending');

  await expectHeaderRow(page);
  await expectRows(page, [
    ['South', '700', 'Open'],
    ['North', '800', 'Closed'],
    ['East', '1200', 'Open'],
  ]);

  await page.reload();
  await expectRows(page, [
    ['South', '700', 'Open'],
    ['North', '800', 'Closed'],
    ['East', '1200', 'Open'],
  ]);

  await restoreSeededOrder(page);
});

test('REQ-5-1-1#3: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await dragSelect(page, 'A1', 'C4');
  await sortRange(page, 'Status', 'Ascending');

  // equal sort keys keep their original relative order (East before South)
  await expectRows(page, [
    ['North', '800', 'Closed'],
    ['East', '1200', 'Open'],
    ['South', '700', 'Open'],
  ]);

  await page.reload();
  await expectRows(page, [
    ['North', '800', 'Closed'],
    ['East', '1200', 'Open'],
    ['South', '700', 'Open'],
  ]);

  await restoreSeededOrder(page);
});

test('REQ-5-1-1#4: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await dragSelect(page, 'A1', 'B4');
  await sortRange(page, 'Sales', 'Ascending');

  // data outside the selection (column C) is not touched
  await expectCell(page, 'A2', 'South');
  await expectCell(page, 'B2', '700');
  await expectCell(page, 'C2', 'Open');
  await expectCell(page, 'A3', 'North');
  await expectCell(page, 'B3', '800');
  await expectCell(page, 'C3', 'Closed');
  await expectCell(page, 'A4', 'East');
  await expectCell(page, 'B4', '1200');
  await expectCell(page, 'C4', 'Open');

  await page.reload();
  await expectCell(page, 'A2', 'South');
  await expectCell(page, 'B2', '700');
  await expectCell(page, 'C2', 'Open');
  await expectCell(page, 'A4', 'East');
  await expectCell(page, 'B4', '1200');
  await expectCell(page, 'C4', 'Open');

  // restore the seeded order
  await dragSelect(page, 'A1', 'B4');
  await sortRange(page, 'Sales', 'Descending');
  await expectRows(page, SEED_ROWS);
});

test('REQ-5-1-1#5: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await dragSelect(page, 'A1', 'C4');
  await sortRange(page, 'Sales', 'Descending');

  await expectHeaderRow(page);
  await expectRows(page, [
    ['East', '1200', 'Open'],
    ['North', '800', 'Closed'],
    ['South', '700', 'Open'],
  ]);

  await page.reload();
  await expectRows(page, [
    ['East', '1200', 'Open'],
    ['North', '800', 'Closed'],
    ['South', '700', 'Open'],
  ]);
});

test('REQ-5-1-1#6: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await dragSelect(page, 'A1', 'C4');
  await sortRange(page, 'Status', 'Descending');

  await expectRows(page, [
    ['East', '1200', 'Open'],
    ['South', '700', 'Open'],
    ['North', '800', 'Closed'],
  ]);

  await page.reload();
  await expectRows(page, [
    ['East', '1200', 'Open'],
    ['South', '700', 'Open'],
    ['North', '800', 'Closed'],
  ]);

  await restoreSeededOrder(page);
});

/* ------------------------------- REQ-5-1-2 ------------------------------- */

test('REQ-5-1-2: REQ-5-1-2 -the requested workflow Region the requested workflow Sales the requested workflow,the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await createFilter(page);

  await filterByValues(page, 'Region', ['East']);
  await expectCell(page, 'A2', 'East');
  await expectVisibleRow(page, 2);
  await expectHiddenRow(page, 3);
  await expectHiddenRow(page, 4);

  await filterByValues(page, 'Sales', ['1200']);
  await expectVisibleRow(page, 2);
  await expectHiddenRow(page, 3);
  await expectHiddenRow(page, 4);

  await page.reload();
  await expectCell(page, 'A2', 'East');
  await expectVisibleRow(page, 2);
  await expectHiddenRow(page, 3);
  await expectHiddenRow(page, 4);

  await clearFilter(page);
  await expectRows(page, SEED_ROWS);
  await expectVisibleRow(page, 3);
  await expectVisibleRow(page, 4);
});

test('REQ-5-1-2#2: REQ-5-1-2 -the requested workflow, the requested workflow,the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await createFilter(page);

  await filterByCondition(page, 'Region', 'Text contains', 'o');
  await expectHiddenRow(page, 2); // East
  await expectVisibleRow(page, 3); // North
  await expectVisibleRow(page, 4); // South

  // conditions on different columns are combined with AND
  await filterByCondition(page, 'Sales', 'Greater than', '700');
  await expectHiddenRow(page, 2);
  await expectVisibleRow(page, 3); // 800 > 700
  await expectHiddenRow(page, 4); // 700 is not greater than 700

  await page.reload();
  await expectHiddenRow(page, 2);
  await expectVisibleRow(page, 3);
  await expectHiddenRow(page, 4);

  await clearFilter(page);
  await expectRows(page, SEED_ROWS);
});

test('REQ-5-1-2#3: REQ-5-1-2 -CSV the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await createFilter(page);
  await filterByValues(page, 'Region', ['East']);
  await expectHiddenRow(page, 3);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export CSV', exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
  const text = fs.readFileSync(await download.path(), 'utf8');
  expect(text).toContain('Region');
  expect(text).toContain('East');
  expect(text).toContain('North');
  expect(text).toContain('South');

  // export does not change the filtered view
  await expectVisibleRow(page, 2);
  await expectHiddenRow(page, 3);

  await clearFilter(page);
  await expectRows(page, SEED_ROWS);
});

test('REQ-5-1-2#4: REQ-5-1-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await createFilter(page);
  await filterByValues(page, 'Status', ['Closed']);
  await expectHiddenRow(page, 2);
  await expectVisibleRow(page, 3);
  await expectHiddenRow(page, 4);

  // clear filter restores all records in original order and with original values
  await clearFilter(page);
  await expectRows(page, SEED_ROWS);
  await expectVisibleRow(page, 2);
  await expectVisibleRow(page, 3);
  await expectVisibleRow(page, 4);

  await page.reload();
  await expectRows(page, SEED_ROWS);
  await expectVisibleRow(page, 2);
  await expectVisibleRow(page, 3);
  await expectVisibleRow(page, 4);
});

test('REQ-5-1-2#5: REQ-5-1-2 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await createFilter(page);

  await filterByCondition(page, 'Status', 'Is not empty');
  await expectVisibleRow(page, 2);
  await expectVisibleRow(page, 3);
  await expectVisibleRow(page, 4);

  await filterByCondition(page, 'Status', 'Is empty');
  await expectHiddenRow(page, 2);
  await expectHiddenRow(page, 3);
  await expectHiddenRow(page, 4);

  await page.reload();
  await expectHiddenRow(page, 2);
  await expectHiddenRow(page, 3);
  await expectHiddenRow(page, 4);

  await clearFilter(page);
  await expectRows(page, SEED_ROWS);
  await expectVisibleRow(page, 2);
});

/* ------------------------------- REQ-5-2-1 ------------------------------- */

test('REQ-5-2-1: REQ-5-2-1 -the requested workflow A1:A2 the requested workflow,the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await saveDropdownRule(page, 'A1', 'A2', 'East, North');

  // saving the rule does not change existing cell values
  await expectCell(page, 'A1', 'Region');
  await expectCell(page, 'A2', 'East');

  await expect(page.getByRole('button', { name: 'Open dropdown for A1', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open dropdown for A2', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open dropdown for A2', exact: true }).click();
  await expect(page.getByRole('option', { name: 'East', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'North', exact: true })).toBeVisible();
  await page.getByRole('option', { name: 'North', exact: true }).click();
  await expectCell(page, 'A2', 'North');

  // rule stays active after refresh
  await page.reload();
  await expectCell(page, 'A2', 'North');
  await expect(page.getByRole('button', { name: 'Open dropdown for A2', exact: true })).toBeVisible();

  // restore the seeded value
  await page.getByRole('button', { name: 'Open dropdown for A2', exact: true }).click();
  await page.getByRole('option', { name: 'East', exact: true }).click();
  await expectCell(page, 'A2', 'East');
});

test('REQ-5-2-1#2: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await saveDropdownRule(page, 'C2', 'C4', 'Open, Closed');
  await expectRows(page, SEED_ROWS);

  // invalid value written through the grid is rejected
  await setCellViaGrid(page, 'C2', 'Pending');
  await expect(page.getByText(DROPDOWN_ERROR).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expectCell(page, 'C2', 'Open');
  await expectRows(page, SEED_ROWS);

  await page.reload();
  await expectCell(page, 'C2', 'Open');
  await expectRows(page, SEED_ROWS);
  await expect(page.getByRole('button', { name: 'Open dropdown for C2', exact: true })).toBeVisible();
});

test('REQ-5-2-1#3: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await setCellViaGrid(page, 'D1', '10');
  await setCellViaGrid(page, 'D2', '20');
  await setCellViaGrid(page, 'D3', '30');

  await dragSelect(page, 'D2', 'D3');
  const dialog = await openValidationDialog(page);
  await dialog.getByRole('combobox', { name: 'Rule type', exact: true }).click();
  await page.getByRole('option', { name: 'Number range', exact: true }).click();
  await dialog.getByLabel('Minimum', { exact: true }).fill('0');
  await dialog.getByLabel('Maximum', { exact: true }).fill('100');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();

  // inclusive boundary value is accepted
  await setCellViaGrid(page, 'D2', '100');
  await expectCell(page, 'D2', '100');

  // out-of-range value is rejected and the original value remains
  await setCellViaGrid(page, 'D3', '101');
  await expect(page.getByText(NUMBER_ERROR).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expectCell(page, 'D3', '30');

  // rule stays active after refresh
  await page.reload();
  await expectCell(page, 'D2', '100');
  await expectCell(page, 'D3', '30');
  await setCellViaGrid(page, 'D3', '0');
  await expectCell(page, 'D3', '0');

  // clean up the created rule
  await dragSelect(page, 'D2', 'D3');
  const reopen = await openValidationDialog(page);
  await reopen.getByRole('button', { name: 'Delete rule', exact: true }).click();
  await expect(reopen).toBeHidden();
});

test('REQ-5-2-1#4: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await saveDropdownRule(page, 'C2', 'C4', 'Open, Closed');

  // reopening an existing rule shows the prefilled rule and the delete button
  await dragSelect(page, 'C2', 'C4');
  const dialog = await openValidationDialog(page);
  await expect(dialog.getByRole('combobox', { name: 'Rule type', exact: true })).toContainText('Dropdown');
  await expect(dialog.getByLabel('Allowed values', { exact: true })).toHaveValue('Open, Closed');
  await dialog.getByRole('button', { name: 'Delete rule', exact: true }).click();
  await expect(dialog).toBeHidden();

  // the constraint is gone
  await setCellViaGrid(page, 'C2', 'Pending');
  await expectCell(page, 'C2', 'Pending');

  // restore the seeded value
  await setCellViaGrid(page, 'C2', 'Open');
  await page.reload();
  await expectCell(page, 'C2', 'Open');
});

test('REQ-5-2-1#5: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await saveDropdownRule(page, 'C2', 'C4', 'Open, Closed');

  // a bulk paste with one invalid target is rejected completely
  await selectCell(page, 'C2');
  await page.evaluate((t) => navigator.clipboard.writeText(t), 'Open\nPending');
  await page.keyboard.press('Control+V');

  await expect(page.getByText(DROPDOWN_ERROR).first()).toBeVisible();
  await expectRows(page, SEED_ROWS);

  await page.reload();
  await expectRows(page, SEED_ROWS);
  await expect(page.getByRole('button', { name: 'Open dropdown for C4', exact: true })).toBeVisible();
});

test('REQ-5-2-1#6: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await saveDropdownRule(page, 'C2', 'C4', 'Open, Closed');

  // invalid value written through the formula bar is rejected
  await selectCell(page, 'C2');
  const bar = page.getByRole('textbox', { name: 'Formula bar', exact: true });
  await expect(bar).toHaveValue('Open');
  await setCellViaFormulaBar(page, 'C2', 'Pending');

  await expect(page.getByText(DROPDOWN_ERROR).first()).toBeVisible();
  await expectCell(page, 'C2', 'Open');

  await page.reload();
  await expectCell(page, 'C2', 'Open');
  await selectCell(page, 'C2');
  await expect(page.getByRole('textbox', { name: 'Formula bar', exact: true })).toHaveValue('Open');
});

/* ------------------------------- REQ-5-3-1 ------------------------------- */

test('REQ-5-3-1: REQ-5-3-1 -the requested workflow Pivot1 the requested workflow Region the requested workflow Sales,the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await createPivot(page, 'A1', 'C4');

  await expect(page.getByRole('tab', { name: 'Pivot1', exact: true })).toHaveAttribute('aria-selected', 'true');

  await setPivotField(page, 'Rows', 'Region');
  await setPivotField(page, 'Values', 'Sales');
  await setPivotField(page, 'Summarize by', 'SUM');
  await applyPivot(page);

  await expectPivot(page, {
    A1: 'Region',
    B1: 'SUM of Sales',
    A2: 'East',
    B2: '1200',
    A3: 'North',
    B3: '800',
    A4: 'South',
    B4: '700',
    A5: 'Grand Total',
    B5: '2700',
  });

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Pivot1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expectPivot(page, { A1: 'Region', B1: 'SUM of Sales', A2: 'East', B2: '1200', B5: '2700' });

  await deleteWorksheet(page, 'Pivot1');
});

test('REQ-5-3-1#2: REQ-5-3-1 -the requested workflow,the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await createPivot(page, 'A1', 'C4');

  await setPivotField(page, 'Rows', 'Region');
  await setPivotField(page, 'Columns', 'Status');
  await setPivotField(page, 'Values', 'Sales');
  await setPivotField(page, 'Summarize by', 'COUNT');
  await applyPivot(page);

  await expectPivot(page, {
    A1: 'Region',
    B1: 'Open',
    C1: 'Closed',
    D1: 'Grand Total',
    A2: 'East',
    B2: '1',
    C2: '0',
    D2: '1',
    A3: 'North',
    B3: '0',
    C3: '1',
    D3: '1',
    A4: 'South',
    B4: '1',
    C4: '0',
    D4: '1',
    A5: 'Grand Total',
    B5: '2',
    C5: '1',
    D5: '3',
  });

  await page.reload();
  await expectPivot(page, { B1: 'Open', C1: 'Closed', D1: 'Grand Total', D5: '3' });

  await deleteWorksheet(page, 'Pivot1');
});

test('REQ-5-3-1#3: REQ-5-3-1 -the requested workflow COUNT the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await createPivot(page, 'A1', 'C4');

  await setPivotField(page, 'Rows', 'Region');
  await setPivotField(page, 'Values', 'Sales');
  await setPivotField(page, 'Summarize by', 'COUNT');
  await applyPivot(page);

  await expectPivot(page, {
    A1: 'Region',
    B1: 'COUNT of Sales',
    A2: 'East',
    B2: '1',
    A3: 'North',
    B3: '1',
    A4: 'South',
    B4: '1',
    A5: 'Grand Total',
    B5: '3',
  });

  // reopening the workbook from the home page still shows the same pivot worksheet and results
  await page.goto('/');
  await page.getByRole('link', { name: 'Q3 Sales', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Pivot1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expectPivot(page, { B1: 'COUNT of Sales', B5: '3' });

  await deleteWorksheet(page, 'Pivot1');
});

test('REQ-5-3-1#4: REQ-5-3-1 -AVERAGE the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await createPivot(page, 'A1', 'C4');

  await setPivotField(page, 'Rows', 'Region');
  await setPivotField(page, 'Values', 'Sales');
  await setPivotField(page, 'Summarize by', 'AVERAGE');
  await applyPivot(page);

  await expectPivot(page, {
    A1: 'Region',
    B1: 'AVERAGE of Sales',
    A2: 'East',
    B2: '1200',
    A3: 'North',
    B3: '800',
    A4: 'South',
    B4: '700',
    A5: 'Grand Total',
    B5: '900',
  });

  // AVERAGE over a value field with no parseable numbers is rejected and the old result kept
  await setPivotField(page, 'Values', 'Status');
  await applyPivot(page);
  await expect(page.getByText('Value field requires numeric values', { exact: true })).toBeVisible();
  await expectPivot(page, { B1: 'AVERAGE of Sales', B2: '1200', B5: '900' });

  await setPivotField(page, 'Values', 'Sales');
  await applyPivot(page);
  await page.reload();
  await expectPivot(page, { B1: 'AVERAGE of Sales', B5: '900' });

  await deleteWorksheet(page, 'Pivot1');
});

test('REQ-5-3-1#5: REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await createPivot(page, 'A1', 'C4');

  await setPivotField(page, 'Rows', 'Region');
  await setPivotField(page, 'Values', 'Sales');
  await setPivotField(page, 'Summarize by', 'SUM');
  await applyPivot(page);
  await expectPivot(page, { B2: '1200', B5: '2700' });

  // change a source value
  await switchTo(page, 'Sheet1');
  await setCellViaGrid(page, 'B2', '2000');
  await expectCell(page, 'B2', '2000');

  // the old pivot result is kept until refresh is clicked
  await switchTo(page, 'Pivot1');
  await expectPivot(page, { A2: 'East', B2: '1200', B5: '2700' });

  await page.getByRole('button', { name: 'Refresh pivot table', exact: true }).click();
  await expectPivot(page, { A2: 'East', B2: '2000', B5: '3500' });

  // restore the source value and the pivot result
  await switchTo(page, 'Sheet1');
  await setCellViaGrid(page, 'B2', '1200');
  await switchTo(page, 'Pivot1');
  await page.getByRole('button', { name: 'Refresh pivot table', exact: true }).click();
  await expectPivot(page, { B2: '1200', B5: '2700' });

  await deleteWorksheet(page, 'Pivot1');
});

test('REQ-5-3-1#6: REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await createPivot(page, 'A1', 'C4');

  await setPivotField(page, 'Rows', 'Region');
  await setPivotField(page, 'Values', 'Sales');
  await setPivotField(page, 'Summarize by', 'SUM');
  await applyPivot(page);
  await expectPivot(page, { B2: '1200', B5: '2700' });

  // switching back to the source worksheet leaves original values and order unchanged
  await switchTo(page, 'Sheet1');
  await expectHeaderRow(page);
  await expectRows(page, SEED_ROWS);

  await switchTo(page, 'Pivot1');
  await expectPivot(page, { A2: 'East', B5: '2700' });

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Pivot1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expectPivot(page, { A2: 'East', B2: '1200', B5: '2700' });

  await switchTo(page, 'Sheet1');
  await expectRows(page, SEED_ROWS);

  await switchTo(page, 'Pivot1');
  await deleteWorksheet(page, 'Pivot1');
});

test('REQ-5-3-1#7: REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await createPivot(page, 'A1', 'C4');

  await setPivotField(page, 'Rows', 'Region');
  await setPivotField(page, 'Values', 'Sales');
  await setPivotField(page, 'Summarize by', 'SUM');
  await applyPivot(page);
  await expectPivot(page, { A2: 'East', B2: '1200', B5: '2700' });

  // delete the selected source header
  await switchTo(page, 'Sheet1');
  await page.getByRole('columnheader', { name: 'A', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete column', exact: true }).click();
  await expectCell(page, 'A1', 'Sales');

  // refresh shows the explicit error and preserves the last successful result
  await switchTo(page, 'Pivot1');
  await page.getByRole('button', { name: 'Refresh pivot table', exact: true }).click();
  await expect(page.getByText('Pivot field is no longer available. Select a new field.', { exact: true })).toBeVisible();
  await expectPivot(page, { A2: 'East', B2: '1200', B5: '2700' });

  // undo the column deletion, then refresh again
  await switchTo(page, 'Sheet1');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expectCell(page, 'A1', 'Region');

  await switchTo(page, 'Pivot1');
  await page.getByRole('button', { name: 'Refresh pivot table', exact: true }).click();
  await expectPivot(page, { A2: 'East', B2: '1200', B5: '2700' });

  await deleteWorksheet(page, 'Pivot1');
});

test('REQ-5-3-1#8: REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await createPivot(page, 'A1', 'C4');
  await expect(page.getByRole('tab', { name: 'Pivot1', exact: true })).toHaveAttribute('aria-selected', 'true');

  await setPivotField(page, 'Rows', 'Region');
  await setPivotField(page, 'Values', 'Sales');
  await setPivotField(page, 'Summarize by', 'SUM');
  await applyPivot(page);
  await expectPivot(page, { B5: '2700' });

  // a second pivot table gets the first unused PivotN name
  await switchTo(page, 'Sheet1');
  await createPivot(page, 'A1', 'C4');
  await expect(page.getByRole('tab', { name: 'Pivot2', exact: true })).toHaveAttribute('aria-selected', 'true');

  await setPivotField(page, 'Rows', 'Status');
  await setPivotField(page, 'Values', 'Sales');
  await setPivotField(page, 'Summarize by', 'SUM');
  await applyPivot(page);
  await expectPivot(page, {
    A1: 'Status',
    B1: 'SUM of Sales',
    A2: 'Open',
    B2: '1900',
    A3: 'Closed',
    B3: '800',
    A4: 'Grand Total',
    B4: '2700',
  });

  await deleteWorksheet(page, 'Pivot2');
  await switchTo(page, 'Pivot1');
  await expectPivot(page, { A1: 'Region', B1: 'SUM of Sales', B5: '2700' });
  await deleteWorksheet(page, 'Pivot1');
});

test('REQ-5-3-1#9: REQ-5-3-1 -the requested workflow COUNT the requested workflow', async ({ page }) => {
  await openWorkbook(page);
  await createPivot(page, 'A1', 'C4');

  // COUNT over a nonnumeric value field counts non-empty records without failing
  await setPivotField(page, 'Rows', 'Region');
  await setPivotField(page, 'Values', 'Status');
  await setPivotField(page, 'Summarize by', 'COUNT');
  await applyPivot(page);

  await expectPivot(page, {
    A1: 'Region',
    B1: 'COUNT of Status',
    A2: 'East',
    B2: '1',
    A3: 'North',
    B3: '1',
    A4: 'South',
    B4: '1',
    A5: 'Grand Total',
    B5: '3',
  });

  await page.reload();
  await expectPivot(page, { B1: 'COUNT of Status', B2: '1', B5: '3' });

  await deleteWorksheet(page, 'Pivot1');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

