const { test, expect } = require('@playwright/test');
const fs = require('fs');

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

async function newBlankWorkbook(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
}

function cell(page, coord) {
  return page.getByRole('gridcell', { name: coord, exact: true });
}

async function expectCell(page, coord, value) {
  await expect(cell(page, coord)).toHaveText(value);
}

async function setCell(page, coord, value) {
  await cell(page, coord).click();
  const fb = page.getByRole('textbox', { name: 'Formula bar', exact: true });
  await fb.fill(value);
  await fb.press('Enter');
}

const SALES_TABLE = [
  ['Region', 'Sales', 'Status'],
  ['East', '1200', 'Open'],
  ['North', '800', 'Closed'],
  ['South', '700', 'Open'],
];

async function enterTable(page, start, table) {
  await cell(page, start).click();
  const text = table.map((r) => r.join('\t')).join('\n');
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
  await page.keyboard.press('Control+V');
}

async function salesWorkbook(page) {
  await newBlankWorkbook(page);
  await enterTable(page, 'A1', SALES_TABLE);
  await expectCell(page, 'A1', 'Region');
  await expectCell(page, 'A4', 'South');
}

async function selectRange(page, from, to) {
  const s = await cell(page, from).boundingBox();
  const e = await cell(page, to).boundingBox();
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
  await page.mouse.down();
  await page.mouse.move(e.x + e.width / 2, e.y + e.height / 2, { steps: 10 });
  await page.mouse.up();
}

async function openDataMenu(page) {
  await page.getByRole('button', { name: 'Data', exact: true }).click();
}

async function chooseCombo(page, scope, comboName, optionName) {
  await scope.getByRole('combobox', { name: comboName, exact: true }).click();
  await page.getByRole('option', { name: optionName, exact: true }).click();
}

async function sortRange(page, by, order, headerRow) {
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: 'Sort range', exact: true }).click();
  const dlg = page.getByRole('dialog', { name: 'Sort range', exact: true });
  await expect(dlg).toBeVisible();
  await chooseCombo(page, dlg, 'Sort by', by);
  await chooseCombo(page, dlg, 'Order', order);
  const cb = dlg.getByRole('checkbox', { name: 'Data has header row', exact: true });
  if (headerRow) {
    await cb.check();
  } else {
    await cb.uncheck();
  }
  await dlg.getByRole('button', { name: 'Sort', exact: true }).click();
}

async function createFilter(page) {
  await selectRange(page, 'A1', 'C4');
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: 'Create filter', exact: true }).click();
}

async function filterDialog(page, header) {
  await page.getByRole('button', { name: `Filter ${header}`, exact: true }).click();
  const dlg = page.getByRole('dialog', { name: `Filter ${header}`, exact: true });
  await expect(dlg).toBeVisible();
  return dlg;
}

async function openValidationDialog(page) {
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: 'Data validation', exact: true }).click();
  const dlg = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await expect(dlg).toBeVisible();
  return dlg;
}

async function saveDropdownRule(page, from, to, allowed) {
  await selectRange(page, from, to);
  const dlg = await openValidationDialog(page);
  await chooseCombo(page, dlg, 'Rule type', 'Dropdown');
  await dlg.getByRole('textbox', { name: 'Allowed values', exact: true }).fill(allowed);
  await dlg.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dlg).toBeHidden();
}

async function saveNumberRule(page, from, to, min, max) {
  await selectRange(page, from, to);
  const dlg = await openValidationDialog(page);
  await chooseCombo(page, dlg, 'Rule type', 'Number range');
  await dlg.getByRole('textbox', { name: 'Minimum', exact: true }).fill(min);
  await dlg.getByRole('textbox', { name: 'Maximum', exact: true }).fill(max);
  await dlg.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dlg).toBeHidden();
}

async function createPivot(page) {
  await selectRange(page, 'A1', 'C4');
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: 'Create pivot table', exact: true }).click();
  const dlg = page.getByRole('dialog', { name: 'Create pivot table', exact: true });
  await expect(dlg).toBeVisible();
  await expect(dlg.getByText('Source range: A1:C4', { exact: true })).toBeVisible();
  await dlg.getByRole('radio', { name: 'New worksheet', exact: true }).check();
  await dlg.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Pivot table editor', exact: true })).toBeVisible();
}

async function configurePivot(page, opts) {
  const ed = page.getByRole('region', { name: 'Pivot table editor', exact: true });
  if (opts.rows) await chooseCombo(page, ed, 'Rows', opts.rows);
  if (opts.columns) await chooseCombo(page, ed, 'Columns', opts.columns);
  if (opts.values) await chooseCombo(page, ed, 'Values', opts.values);
  if (opts.summarize) await chooseCombo(page, ed, 'Summarize by', opts.summarize);
  await ed.getByRole('button', { name: 'Apply', exact: true }).click();
}

/* ------------------------------------------------------------------ */
/* REQ-5-1-1  Sort a data range by a specified column                  */
/* ------------------------------------------------------------------ */

test('REQ-5-1-1: REQ-5-1-1 -the requested workflow Sales the requested workflow,the requested workflow', async ({ page }) => {
  await salesWorkbook(page);
  await selectRange(page, 'A1', 'C4');
  await sortRange(page, 'Sales', 'Ascending', true);

  // header row stays put
  await expectCell(page, 'A1', 'Region');
  await expectCell(page, 'B1', 'Sales');
  await expectCell(page, 'C1', 'Status');
  // whole records move together, numbers compared numerically
  await expectCell(page, 'A2', 'South');
  await expectCell(page, 'B2', '700');
  await expectCell(page, 'C2', 'Open');
  await expectCell(page, 'A3', 'North');
  await expectCell(page, 'B3', '800');
  await expectCell(page, 'A4', 'East');
  await expectCell(page, 'B4', '1200');

  await page.reload();
  await expectCell(page, 'A1', 'Region');
  await expectCell(page, 'A2', 'South');
  await expectCell(page, 'B2', '700');
  await expectCell(page, 'A4', 'East');
  await expectCell(page, 'B4', '1200');
});

test('REQ-5-1-1#2: REQ-5-1-1 -the requested workflow ISO the requested workflow', async ({ page }) => {
  await salesWorkbook(page);
  // a value outside the selected range must not move
  await setCell(page, 'E1', 'keep');
  await selectRange(page, 'A1', 'C4');
  await sortRange(page, 'Sales', 'Descending', true);

  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'B2', '1200');
  await expectCell(page, 'A3', 'North');
  await expectCell(page, 'B3', '800');
  await expectCell(page, 'A4', 'South');
  await expectCell(page, 'B4', '700');
  await expectCell(page, 'E1', 'keep');
});

test('REQ-5-1-1#3: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  await salesWorkbook(page);
  await selectRange(page, 'A1', 'C4');
  // "Data has header row" not set: the first row participates in the sort
  await sortRange(page, 'Region', 'Ascending', false);

  await expectCell(page, 'A1', 'East');
  await expectCell(page, 'A2', 'North');
  await expectCell(page, 'A3', 'Region');
  await expectCell(page, 'A4', 'South');
});

test('REQ-5-1-1#4: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  await salesWorkbook(page);
  await selectRange(page, 'A1', 'C4');
  await sortRange(page, 'Status', 'Ascending', true);

  // Closed first, then the two equal keys (Open) keep their original relative order
  await expectCell(page, 'A1', 'Region');
  await expectCell(page, 'A2', 'North');
  await expectCell(page, 'C2', 'Closed');
  await expectCell(page, 'A3', 'East');
  await expectCell(page, 'C3', 'Open');
  await expectCell(page, 'A4', 'South');
  await expectCell(page, 'C4', 'Open');
});

test('REQ-5-1-1#5: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  await salesWorkbook(page);
  await selectRange(page, 'A1', 'C4');
  await sortRange(page, 'Region', 'Descending', true);

  await expectCell(page, 'A1', 'Region');
  await expectCell(page, 'A2', 'South');
  await expectCell(page, 'A3', 'North');
  await expectCell(page, 'A4', 'East');

  await page.reload();
  await expectCell(page, 'A2', 'South');
  await expectCell(page, 'A3', 'North');
  await expectCell(page, 'A4', 'East');
});

test('REQ-5-1-1#6: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  await salesWorkbook(page);
  await selectRange(page, 'A1', 'C4');
  await openDataMenu(page);
  await page.getByRole('menuitem', { name: 'Sort range', exact: true }).click();
  const dlg = page.getByRole('dialog', { name: 'Sort range', exact: true });
  await expect(dlg).toBeVisible();

  // options of "Sort by" use the header text of the selected range
  await dlg.getByRole('combobox', { name: 'Sort by', exact: true }).click();
  await expect(page.getByRole('option', { name: 'Region', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Sales', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Status', exact: true })).toBeVisible();
  await page.getByRole('option', { name: 'Sales', exact: true }).click();
  await chooseCombo(page, dlg, 'Order', 'Ascending');
  await dlg.getByRole('checkbox', { name: 'Data has header row', exact: true }).check();
  await dlg.getByRole('button', { name: 'Sort', exact: true }).click();

  // formula bar is consistent with the new positions
  await cell(page, 'B2').click();
  await expect(page.getByRole('textbox', { name: 'Formula bar', exact: true })).toHaveValue('700');
});

/* ------------------------------------------------------------------ */
/* REQ-5-1-2  Filter rows by value or condition                        */
/* ------------------------------------------------------------------ */

test('REQ-5-1-2: REQ-5-1-2 -the requested workflow Region the requested workflow Sales the requested workflow,the requested workflow', async ({ page }) => {
  await salesWorkbook(page);
  await createFilter(page);
  const dlg = await filterDialog(page, 'Region');
  await dlg.getByRole('checkbox', { name: 'North', exact: true }).uncheck();
  await dlg.getByRole('checkbox', { name: 'South', exact: true }).uncheck();
  await dlg.getByRole('button', { name: 'Apply', exact: true }).click();

  await expectCell(page, 'A2', 'East');
  await expect(cell(page, 'A3')).toBeHidden();
  await expect(cell(page, 'A4')).toBeHidden();

  await page.reload();
  await expectCell(page, 'A2', 'East');
  await expect(cell(page, 'A3')).toBeHidden();
  await expect(cell(page, 'A4')).toBeHidden();
});

test('REQ-5-1-2#2: REQ-5-1-2 -the requested workflow, the requested workflow,the requested workflow', async ({ page }) => {
  await salesWorkbook(page);
  await createFilter(page);
  const dlg = await filterDialog(page, 'Sales');
  await chooseCombo(page, dlg, 'Condition', 'Greater than');
  await dlg.getByRole('textbox', { name: 'Value', exact: true }).fill('800');
  await dlg.getByRole('button', { name: 'Apply', exact: true }).click();

  await expectCell(page, 'A2', 'East');
  await expect(cell(page, 'A3')).toBeHidden();
  await expect(cell(page, 'A4')).toBeHidden();

  await page.reload();
  await expectCell(page, 'A2', 'East');
  await expect(cell(page, 'A3')).toBeHidden();
});

test('REQ-5-1-2#3: REQ-5-1-2 -CSV the requested workflow', async ({ page }) => {
  await salesWorkbook(page);
  await createFilter(page);
  const dlg = await filterDialog(page, 'Region');
  await dlg.getByRole('checkbox', { name: 'North', exact: true }).uncheck();
  await dlg.getByRole('checkbox', { name: 'South', exact: true }).uncheck();
  await dlg.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(cell(page, 'A3')).toBeHidden();

  // export still includes hidden rows within the filtered range
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export CSV', exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
  const filePath = await download.path();
  const text = fs.readFileSync(filePath, 'utf8');
  expect(text).toContain('East');
  expect(text).toContain('North');
  expect(text).toContain('South');
});

test('REQ-5-1-2#4: REQ-5-1-2 -the requested workflow', async ({ page }) => {
  await salesWorkbook(page);
  await createFilter(page);
  const dlg = await filterDialog(page, 'Region');
  await dlg.getByRole('checkbox', { name: 'North', exact: true }).uncheck();
  await dlg.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(cell(page, 'A3')).toBeHidden();

  await openDataMenu(page);
  await page.getByRole('menuitem', { name: 'Clear filter', exact: true }).click();

  // all source records return in their original order and values
  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'A3', 'North');
  await expectCell(page, 'A4', 'South');

  await page.reload();
  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'A3', 'North');
  await expectCell(page, 'A4', 'South');
});

test('REQ-5-1-2#5: REQ-5-1-2 -the requested workflow', async ({ page }) => {
  await salesWorkbook(page);
  await createFilter(page);

  let dlg = await filterDialog(page, 'Region');
  await chooseCombo(page, dlg, 'Condition', 'Text contains');
  await dlg.getByRole('textbox', { name: 'Value', exact: true }).fill('o');
  await dlg.getByRole('button', { name: 'Apply', exact: true }).click();

  dlg = await filterDialog(page, 'Sales');
  await chooseCombo(page, dlg, 'Condition', 'Greater than');
  await dlg.getByRole('textbox', { name: 'Value', exact: true }).fill('750');
  await dlg.getByRole('button', { name: 'Apply', exact: true }).click();

  // both conditions combined with AND: only North matches
  await expect(cell(page, 'A2')).toBeHidden();
  await expectCell(page, 'A3', 'North');
  await expect(cell(page, 'A4')).toBeHidden();

  await page.reload();
  await expect(cell(page, 'A2')).toBeHidden();
  await expectCell(page, 'A3', 'North');
  await expect(cell(page, 'A4')).toBeHidden();
});

/* ------------------------------------------------------------------ */
/* REQ-5-2-1  Set dropdown or numeric validation for a range           */
/* ------------------------------------------------------------------ */

test('REQ-5-2-1: REQ-5-2-1 -the requested workflow A1:A2 the requested workflow,the requested workflow', async ({ page }) => {
  await newBlankWorkbook(page);
  await setCell(page, 'A1', 'East');
  await saveDropdownRule(page, 'A1', 'A2', 'East, North, South');

  await expect(page.getByRole('button', { name: 'Open dropdown for A1', exact: true })).toBeVisible();

  // invalid dropdown value: operation rejected, original value kept
  await setCell(page, 'A1', 'West');
  await expect(page.getByText(/Please select one of the following values/)).toBeVisible();
  await expectCell(page, 'A1', 'East');
});

test('REQ-5-2-1#2: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await newBlankWorkbook(page);
  await saveDropdownRule(page, 'A1', 'A2', 'East, North, South');

  await page.getByRole('button', { name: 'Open dropdown for A1', exact: true }).click();
  await expect(page.getByRole('option', { name: 'East', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'North', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'South', exact: true })).toBeVisible();
  await page.getByRole('option', { name: 'North', exact: true }).click();
  await expectCell(page, 'A1', 'North');
});

test('REQ-5-2-1#3: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await newBlankWorkbook(page);
  await setCell(page, 'B3', '50');
  await saveNumberRule(page, 'B2', 'B3', '0', '100');

  // 101 is out of the inclusive 0-to-100 rule
  await setCell(page, 'B3', '101');
  await expect(page.getByText('Please enter a number from 0 to 100', { exact: true })).toBeVisible();
  await expectCell(page, 'B3', '50');

  // boundary value 100 is accepted
  await setCell(page, 'B3', '100');
  await expectCell(page, 'B3', '100');

  await page.reload();
  await expectCell(page, 'B3', '100');
});

test('REQ-5-2-1#4: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await newBlankWorkbook(page);
  await setCell(page, 'A1', '1');
  await setCell(page, 'A2', '2');
  await saveNumberRule(page, 'A1', 'A2', '0', '100');

  // bulk paste with an invalid target: the whole operation is rejected
  await cell(page, 'A1').click();
  await page.evaluate((t) => navigator.clipboard.writeText(t), '5\n200');
  await page.keyboard.press('Control+V');

  await expect(page.getByText('Please enter a number from 0 to 100', { exact: true })).toBeVisible();
  await expectCell(page, 'A1', '1');
  await expectCell(page, 'A2', '2');
});

test('REQ-5-2-1#5: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await newBlankWorkbook(page);
  await setCell(page, 'A1', 'East');
  await saveDropdownRule(page, 'A1', 'A2', 'East, North, South');

  // reopening an existing rule prefills it and offers "Delete rule"
  await selectRange(page, 'A1', 'A2');
  const dlg = await openValidationDialog(page);
  await expect(dlg.getByRole('textbox', { name: 'Allowed values', exact: true })).toHaveValue(/East\s*,\s*North\s*,\s*South/);
  await expect(dlg.getByRole('button', { name: 'Delete rule', exact: true })).toBeVisible();
  await dlg.getByRole('button', { name: 'Delete rule', exact: true }).click();
  await expect(dlg).toBeHidden();

  // existing cell value unchanged; constraint removed
  await expectCell(page, 'A1', 'East');
  await setCell(page, 'A1', 'West');
  await expectCell(page, 'A1', 'West');
});

test('REQ-5-2-1#6: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await newBlankWorkbook(page);
  await setCell(page, 'A1', 'East');
  await saveDropdownRule(page, 'A1', 'A2', 'East, North, South');

  await page.reload();

  // rule still active and the existing valid value is preserved
  await expect(page.getByRole('button', { name: 'Open dropdown for A1', exact: true })).toBeVisible();
  await expectCell(page, 'A1', 'East');

  await setCell(page, 'A1', 'West');
  await expect(page.getByText(/Please select one of the following values/)).toBeVisible();
  await expectCell(page, 'A1', 'East');
});

/* ------------------------------------------------------------------ */
/* REQ-5-3-1  Create and refresh a basic pivot table                   */
/* ------------------------------------------------------------------ */

test('REQ-5-3-1: REQ-5-3-1 -the requested workflow Pivot1 the requested workflow Region the requested workflow Sales,the requested workflow', async ({ page }) => {
  await salesWorkbook(page);
  await createPivot(page);
  await configurePivot(page, { rows: 'Region', values: 'Sales', summarize: 'SUM' });

  await expectCell(page, 'A1', 'Region');
  await expectCell(page, 'B1', 'SUM of Sales');
  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'B2', '1200');
  await expectCell(page, 'A3', 'North');
  await expectCell(page, 'B3', '800');
  await expectCell(page, 'A4', 'South');
  await expectCell(page, 'B4', '700');
  await expectCell(page, 'A5', 'Grand Total');
  await expectCell(page, 'B5', '2700');

  await page.reload();
  await expectCell(page, 'A1', 'Region');
  await expectCell(page, 'B1', 'SUM of Sales');
  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'A5', 'Grand Total');
  await expectCell(page, 'B5', '2700');
});

test('REQ-5-3-1#2: REQ-5-3-1 -the requested workflow,the requested workflow', async ({ page }) => {
  await salesWorkbook(page);
  await createPivot(page);
  await configurePivot(page, { rows: 'Region', values: 'Sales', summarize: 'COUNT' });

  await expectCell(page, 'A1', 'Region');
  await expectCell(page, 'B1', 'COUNT of Sales');
  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'B2', '1');
  await expectCell(page, 'A3', 'North');
  await expectCell(page, 'B3', '1');
  await expectCell(page, 'A4', 'South');
  await expectCell(page, 'B4', '1');
  await expectCell(page, 'A5', 'Grand Total');
  await expectCell(page, 'B5', '3');
});

test('REQ-5-3-1#3: REQ-5-3-1 -the requested workflow COUNT the requested workflow', async ({ page }) => {
  await salesWorkbook(page);
  await createPivot(page);
  await configurePivot(page, { rows: 'Status', values: 'Sales', summarize: 'COUNT' });

  await expectCell(page, 'A1', 'Status');
  await expectCell(page, 'B1', 'COUNT of Sales');
  await expectCell(page, 'A2', 'Open');
  await expectCell(page, 'B2', '2');
  await expectCell(page, 'A3', 'Closed');
  await expectCell(page, 'B3', '1');
  await expectCell(page, 'A4', 'Grand Total');
  await expectCell(page, 'B4', '3');

  await page.reload();
  await expectCell(page, 'A2', 'Open');
  await expectCell(page, 'B2', '2');
  await expectCell(page, 'A4', 'Grand Total');
  await expectCell(page, 'B4', '3');
});

test('REQ-5-3-1#4: REQ-5-3-1 -AVERAGE the requested workflow', async ({ page }) => {
  await salesWorkbook(page);
  await createPivot(page);
  await configurePivot(page, { rows: 'Region', values: 'Sales', summarize: 'AVERAGE' });

  await expectCell(page, 'B1', 'AVERAGE of Sales');
  await expectCell(page, 'B2', '1200');
  await expectCell(page, 'B3', '800');
  await expectCell(page, 'B4', '700');
  await expectCell(page, 'A5', 'Grand Total');
  await expectCell(page, 'B5', '900');
});

test('REQ-5-3-1#5: REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await salesWorkbook(page);
  await createPivot(page);
  await configurePivot(page, { rows: 'Region', columns: 'Status', values: 'Sales', summarize: 'SUM' });

  await expectCell(page, 'A1', 'Region');
  await expectCell(page, 'B1', 'Open');
  await expectCell(page, 'C1', 'Closed');
  await expectCell(page, 'D1', 'Grand Total');
  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'B2', '1200');
  await expectCell(page, 'A3', 'North');
  await expectCell(page, 'C3', '800');
  await expectCell(page, 'A4', 'South');
  await expectCell(page, 'B4', '700');
  await expectCell(page, 'A5', 'Grand Total');
  await expectCell(page, 'D5', '2700');
});

test('REQ-5-3-1#6: REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await salesWorkbook(page);
  await createPivot(page);
  await configurePivot(page, { rows: 'Region', values: 'Sales', summarize: 'SUM' });
  await expectCell(page, 'B5', '2700');

  // change the source value on the source worksheet
  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await setCell(page, 'B2', '2000');
  await page.getByRole('tab', { name: 'Pivot1', exact: true }).click();

  // existing result unchanged until refresh
  await expectCell(page, 'B5', '2700');
  await page.getByRole('button', { name: 'Refresh pivot table', exact: true }).click();
  await expectCell(page, 'B5', '3500');
});

test('REQ-5-3-1#7: REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await salesWorkbook(page);
  await createPivot(page);
  await configurePivot(page, { rows: 'Region', values: 'Sales', summarize: 'SUM' });

  // switching back to the source worksheet shows untouched source data
  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await expectCell(page, 'A1', 'Region');
  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'B2', '1200');
  await expectCell(page, 'A3', 'North');
  await expectCell(page, 'B3', '800');
  await expectCell(page, 'A4', 'South');
  await expectCell(page, 'B4', '700');
});

test('REQ-5-3-1#8: REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await salesWorkbook(page);
  await createPivot(page);
  await configurePivot(page, { rows: 'Region', values: 'Sales', summarize: 'SUM' });

  // delete the source header the pivot was built on
  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await page.getByRole('columnheader', { name: 'A', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete column', exact: true }).click();

  await page.getByRole('tab', { name: 'Pivot1', exact: true }).click();
  await page.getByRole('button', { name: 'Refresh pivot table', exact: true }).click();
  await expect(page.getByText('Pivot field is no longer available. Select a new field.', { exact: true })).toBeVisible();
});

test('REQ-5-3-1#9: REQ-5-3-1 -the requested workflow COUNT the requested workflow', async ({ page }) => {
  await salesWorkbook(page);
  await createPivot(page);
  await configurePivot(page, { rows: 'Region', values: 'Sales', summarize: 'SUM' });
  await expectCell(page, 'B5', '2700');

  // SUM over a text value field has no parseable numbers
  await configurePivot(page, { values: 'Status', summarize: 'SUM' });
  await expect(page.getByText('Value field requires numeric values', { exact: true })).toBeVisible();

  // last successful result is preserved
  await expectCell(page, 'A1', 'Region');
  await expectCell(page, 'B5', '2700');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });
test('REQ-5-1-1#audit-1: a filter still hides its nonmatching row after the same range is sorted', async ({ page }) => {
  await salesWorkbook(page);
  await createFilter(page);
  const dlg = await filterDialog(page, 'Status');
  await dlg.getByRole('checkbox', { name: 'Closed', exact: true }).uncheck();
  await dlg.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(cell(page, 'A3')).toBeHidden();

  await selectRange(page, 'A1', 'C4');
  await sortRange(page, 'Sales', 'Descending', true);

  // East (1200) first; the Closed row stays hidden, South (700) is still visible below it
  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'B2', '1200');
  await expect(cell(page, 'A3')).toBeHidden();
  await expectCell(page, 'A4', 'South');
  await expectCell(page, 'B4', '700');

  await page.reload();
  await expectCell(page, 'A2', 'East');
  await expect(cell(page, 'A3')).toBeHidden();
});

test('REQ-5-1-2#audit-1: the "Is empty" condition hides every row whose field has a value', async ({ page }) => {
  await newBlankWorkbook(page);
  await enterTable(page, 'A1', [
    ['Region', 'Sales', 'Status'],
    ['East', '1200', 'Open'],
    ['North', '800', ''],
    ['South', '700', 'Open'],
  ]);
  await expectCell(page, 'A3', 'North');

  await createFilter(page);
  const dlg = await filterDialog(page, 'Status');
  await chooseCombo(page, dlg, 'Condition', 'Is empty');
  await dlg.getByRole('button', { name: 'Apply', exact: true }).click();

  await expect(cell(page, 'A2')).toBeHidden();
  await expectCell(page, 'A3', 'North');
  await expectCell(page, 'B3', '800');
  await expect(cell(page, 'A4')).toBeHidden();

  await page.reload();
  await expect(cell(page, 'A2')).toBeHidden();
  await expectCell(page, 'A3', 'North');
  await expect(cell(page, 'A4')).toBeHidden();
});

test('REQ-5-1-2#audit-2: pivot summarization still includes rows hidden by a filter', async ({ page }) => {
  await salesWorkbook(page);
  await createFilter(page);
  const dlg = await filterDialog(page, 'Status');
  await dlg.getByRole('checkbox', { name: 'Closed', exact: true }).uncheck();
  await dlg.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(cell(page, 'A3')).toBeHidden();

  await selectRange(page, 'A1', 'C4');
  await createPivot(page);
  await configurePivot(page, { rows: 'Region', values: 'Sales', summarize: 'SUM' });

  // the hidden North/800 row is still summarised
  await expectCell(page, 'A1', 'Region');
  await expectCell(page, 'B1', 'SUM of Sales');
  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'B2', '1200');
  await expectCell(page, 'A3', 'North');
  await expectCell(page, 'B3', '800');
  await expectCell(page, 'A4', 'South');
  await expectCell(page, 'B4', '700');
  await expectCell(page, 'A5', 'Grand Total');
  await expectCell(page, 'B5', '2700');
});

test('REQ-5-2-1#audit-1: saving a modified numeric rule makes the new limits effective immediately', async ({ page }) => {
  await newBlankWorkbook(page);
  await setCell(page, 'B2', '40');
  await saveNumberRule(page, 'B2', 'B3', '0', '100');

  await selectRange(page, 'B2', 'B3');
  const dlg = await openValidationDialog(page);
  await expect(dlg.getByRole('textbox', { name: 'Minimum', exact: true })).toHaveValue('0');
  await expect(dlg.getByRole('textbox', { name: 'Maximum', exact: true })).toHaveValue('100');
  await dlg.getByRole('textbox', { name: 'Maximum', exact: true }).fill('50');
  await dlg.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dlg).toBeHidden();

  // successful save leaves the existing cell value untouched
  await expectCell(page, 'B2', '40');

  // the new maximum is effective immediately: 60 is rejected, 50 is the accepted boundary
  await setCell(page, 'B2', '60');
  await expectCell(page, 'B2', '40');
  await setCell(page, 'B2', '50');
  await expectCell(page, 'B2', '50');
});

test('REQ-5-3-1#audit-1: COUNT shows 0 for a row/column combination with no record', async ({ page }) => {
  await salesWorkbook(page);
  await createPivot(page);
  await configurePivot(page, { rows: 'Region', columns: 'Status', values: 'Sales', summarize: 'COUNT' });

  await expectCell(page, 'A1', 'Region');
  await expectCell(page, 'B1', 'Open');
  await expectCell(page, 'C1', 'Closed');
  await expectCell(page, 'D1', 'Grand Total');
  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'B2', '1');
  await expectCell(page, 'C2', '0');
  await expectCell(page, 'A3', 'North');
  await expectCell(page, 'B3', '0');
  await expectCell(page, 'C3', '1');
  await expectCell(page, 'A4', 'South');
  await expectCell(page, 'B4', '1');
  await expectCell(page, 'C4', '0');
  await expectCell(page, 'A5', 'Grand Total');
  await expectCell(page, 'B5', '2');
  await expectCell(page, 'C5', '1');
  await expectCell(page, 'D5', '3');
});

test('REQ-5-3-1#audit-2: COUNT over a text value field counts records without failing', async ({ page }) => {
  await salesWorkbook(page);
  await createPivot(page);
  await configurePivot(page, { rows: 'Region', values: 'Status', summarize: 'COUNT' });

  await expectCell(page, 'A1', 'Region');
  await expectCell(page, 'B1', 'COUNT of Status');
  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'B2', '1');
  await expectCell(page, 'A3', 'North');
  await expectCell(page, 'B3', '1');
  await expectCell(page, 'A4', 'South');
  await expectCell(page, 'B4', '1');
  await expectCell(page, 'A5', 'Grand Total');
  await expectCell(page, 'B5', '3');

  await page.reload();
  await expectCell(page, 'B1', 'COUNT of Status');
  await expectCell(page, 'B5', '3');
});
