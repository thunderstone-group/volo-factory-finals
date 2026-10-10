const { test, expect } = require('@playwright/test');
const fs = require('fs');

/* ------------------------------------------------------------------ */
/* shared seed tables (built through the application's own UI)          */
/* ------------------------------------------------------------------ */

const SALES_TABLE = [
  ['Region', 'Sales', 'Status'],
  ['East', '1200', 'Open'],
  ['North', '800', 'Closed'],
  ['South', '700', 'Open'],
];

const DATE_TABLE = [
  ['Region', 'Sales', 'Status', 'Date'],
  ['East', '1200', 'Open', '2024-02-10'],
  ['North', '800', 'Closed', '2024-01-03'],
  ['South', '700', 'Open', '2024-01-01'],
];

const EXT_TABLE = [
  ['Region', 'Sales', 'Status', 'Date', 'Notes'],
  ['East', '1200', 'Open', '2024-01-05', ''],
  ['North', '800', 'Closed', '2024-01-03', 'note'],
  ['South', '700', 'Open', '2024-01-01', ''],
];

const ITEM_TABLE = [
  ['Item', 'Qty'],
  ['Pen', '4'],
  ['Book', '9'],
];

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function colName(index) {
  let s = '';
  let n = index + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function cell(page, coord) {
  return page.getByRole('gridcell', { name: coord, exact: true });
}

function formulaBar(page) {
  return page.getByLabel('Formula bar', { exact: true });
}

function sheetTab(page, name) {
  return page.getByRole('tab', { name, exact: true });
}

async function setClipboard(page, text) {
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
}

async function newBlankWorkbook(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
}

async function typeCell(page, coord, value) {
  await cell(page, coord).click();
  const bar = formulaBar(page);
  await bar.click();
  await bar.fill(value);
  await bar.press('Enter');
}

async function fillTable(page, rows) {
  await setClipboard(page, rows.map((r) => r.join('\t')).join('\n'));
  await cell(page, 'A1').click();
  await page.keyboard.press('Control+V');
  let pasted = false;
  for (let i = 0; i < 10 && !pasted; i++) {
    const first = await cell(page, 'A1').textContent().catch(() => null);
    const second = await cell(page, 'B2').textContent().catch(() => null);
    if ((first || '').trim() === rows[0][0] && (second || '').trim() === rows[1][1]) {
      pasted = true;
    } else {
      await page.waitForTimeout(120);
    }
  }
  if (!pasted) {
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        await typeCell(page, colName(c) + (r + 1), rows[r][c]);
      }
    }
  }
  await expect(cell(page, 'A1')).toHaveText(rows[0][0]);
}

async function selectRange(page, from, to) {
  const a = cell(page, from);
  const b = cell(page, to);
  const boxA = await a.boundingBox();
  const boxB = await b.boundingBox();
  await page.mouse.move(boxA.x + boxA.width / 2, boxA.y + boxA.height / 2);
  await page.mouse.down();
  await page.mouse.move(boxB.x + boxB.width / 2, boxB.y + boxB.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(a).toHaveAttribute('aria-selected', 'true');
  await expect(b).toHaveAttribute('aria-selected', 'true');
}

async function openDataMenuItem(page, name) {
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByRole('menuitem', { name, exact: true }).click();
}

async function chooseCombo(page, scope, label, optionName) {
  await scope.getByLabel(label, { exact: true }).click();
  await page.getByRole('option', { name: optionName, exact: true }).click();
}

async function sortRange(page, from, to, by, order) {
  await selectRange(page, from, to);
  await openDataMenuItem(page, 'Sort range');
  const dlg = page.getByRole('dialog', { name: 'Sort range', exact: true });
  await expect(dlg).toBeVisible();
  await dlg.getByRole('checkbox', { name: 'Data has header row', exact: true }).check();
  await chooseCombo(page, dlg, 'Sort by', by);
  await chooseCombo(page, dlg, 'Order', order);
  await dlg.getByRole('button', { name: 'Sort', exact: true }).click();
}

async function createFilter(page, from, to) {
  await selectRange(page, from, to);
  await openDataMenuItem(page, 'Create filter');
}

async function filterByValue(page, header, uncheckedValue) {
  await page.getByRole('button', { name: `Filter ${header}`, exact: true }).click();
  const dlg = page.getByRole('dialog', { name: `Filter ${header}`, exact: true });
  await expect(dlg).toBeVisible();
  await dlg.getByRole('checkbox', { name: uncheckedValue, exact: true }).uncheck();
  await dlg.getByRole('button', { name: 'Apply', exact: true }).click();
}

async function filterByCondition(page, header, condition, value) {
  await page.getByRole('button', { name: `Filter ${header}`, exact: true }).click();
  const dlg = page.getByRole('dialog', { name: `Filter ${header}`, exact: true });
  await expect(dlg).toBeVisible();
  await chooseCombo(page, dlg, 'Condition', condition);
  if (value !== undefined) {
    await dlg.getByLabel('Value', { exact: true }).fill(value);
  }
  await dlg.getByRole('button', { name: 'Apply', exact: true }).click();
}

async function openValidationDialog(page) {
  await openDataMenuItem(page, 'Data validation');
  const dlg = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await expect(dlg).toBeVisible();
  return dlg;
}

async function createPivotSheet(page, from, to) {
  await selectRange(page, from, to);
  await openDataMenuItem(page, 'Create pivot table');
  const dlg = page.getByRole('dialog', { name: 'Create pivot table', exact: true });
  await expect(dlg).toBeVisible();
  await dlg.getByRole('button', { name: 'Create', exact: true }).click();
  const editor = page.getByRole('region', { name: 'Pivot table editor', exact: true });
  await expect(editor).toBeVisible();
  return editor;
}

async function configurePivot(page, editor, fields) {
  if (fields.rows) await chooseCombo(page, editor, 'Rows', fields.rows);
  if (fields.columns) await chooseCombo(page, editor, 'Columns', fields.columns);
  if (fields.values) await chooseCombo(page, editor, 'Values', fields.values);
  if (fields.summarizeBy) await chooseCombo(page, editor, 'Summarize by', fields.summarizeBy);
  await editor.getByRole('button', { name: 'Apply', exact: true }).click();
}

/* ------------------------------------------------------------------ */
/* REQ-5-1-1  Sort a data range by a specified column                  */
/* ------------------------------------------------------------------ */

test('REQ-5-1-1: REQ-5-1-1 -the requested workflow Sales the requested workflow,the requested workflow', async ({ page }) => {
  await newBlankWorkbook(page);
  await fillTable(page, SALES_TABLE);

  await sortRange(page, 'A1', 'C4', 'Region', 'Descending');

  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'A2')).toHaveText('South');
  await expect(cell(page, 'B2')).toHaveText('700');
  await expect(cell(page, 'C2')).toHaveText('Open');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'B3')).toHaveText('800');
  await expect(cell(page, 'C3')).toHaveText('Closed');
  await expect(cell(page, 'A4')).toHaveText('East');
  await expect(cell(page, 'B4')).toHaveText('1200');
  await expect(cell(page, 'C4')).toHaveText('Open');

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('South');
  await expect(cell(page, 'C2')).toHaveText('Open');
  await expect(cell(page, 'A4')).toHaveText('East');
  await expect(cell(page, 'B4')).toHaveText('1200');
});

test('REQ-5-1-1#2: REQ-5-1-1 -the requested workflow ISO the requested workflow', async ({ page }) => {
  await newBlankWorkbook(page);
  await fillTable(page, SALES_TABLE);

  await sortRange(page, 'A1', 'C4', 'Sales', 'Ascending');

  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'A2')).toHaveText('South');
  await expect(cell(page, 'B2')).toHaveText('700');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'B3')).toHaveText('800');
  await expect(cell(page, 'A4')).toHaveText('East');
  await expect(cell(page, 'B4')).toHaveText('1200');

  await cell(page, 'B2').click();
  await expect(formulaBar(page)).toHaveValue('700');

  await page.reload();
  await expect(cell(page, 'B2')).toHaveText('700');
  await expect(cell(page, 'A4')).toHaveText('East');
  await expect(cell(page, 'C4')).toHaveText('Open');
});

test('REQ-5-1-1#3: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  await newBlankWorkbook(page);
  await fillTable(page, SALES_TABLE);

  await sortRange(page, 'A1', 'C4', 'Status', 'Ascending');

  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'A2')).toHaveText('North');
  await expect(cell(page, 'C2')).toHaveText('Closed');
  await expect(cell(page, 'A3')).toHaveText('East');
  await expect(cell(page, 'C3')).toHaveText('Open');
  await expect(cell(page, 'A4')).toHaveText('South');
  await expect(cell(page, 'C4')).toHaveText('Open');

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('North');
  await expect(cell(page, 'A3')).toHaveText('East');
  await expect(cell(page, 'A4')).toHaveText('South');
});

test('REQ-5-1-1#4: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  await newBlankWorkbook(page);
  await fillTable(page, DATE_TABLE);

  await sortRange(page, 'A1', 'D4', 'Date', 'Ascending');

  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'A2')).toHaveText('South');
  await expect(cell(page, 'D2')).toHaveText('2024-01-01');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'D3')).toHaveText('2024-01-03');
  await expect(cell(page, 'A4')).toHaveText('East');
  await expect(cell(page, 'D4')).toHaveText('2024-02-10');

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('South');
  await expect(cell(page, 'A4')).toHaveText('East');
});

test('REQ-5-1-1#5: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  await newBlankWorkbook(page);
  await fillTable(page, SALES_TABLE);
  await typeCell(page, 'E1', 'Keep');

  await sortRange(page, 'A1', 'B4', 'Sales', 'Ascending');

  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'A2')).toHaveText('South');
  await expect(cell(page, 'B2')).toHaveText('700');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'B3')).toHaveText('800');
  await expect(cell(page, 'A4')).toHaveText('East');
  await expect(cell(page, 'B4')).toHaveText('1200');

  // data outside the selected range stays unchanged
  await expect(cell(page, 'C2')).toHaveText('Open');
  await expect(cell(page, 'C3')).toHaveText('Closed');
  await expect(cell(page, 'C4')).toHaveText('Open');
  await expect(cell(page, 'E1')).toHaveText('Keep');

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('South');
  await expect(cell(page, 'B2')).toHaveText('700');
  await expect(cell(page, 'E1')).toHaveText('Keep');
});

test('REQ-5-1-1#6: REQ-5-1-1 -the requested workflow', async ({ page }) => {
  await newBlankWorkbook(page);
  await fillTable(page, SALES_TABLE);
  await typeCell(page, 'E1', 'Keep');

  await sortRange(page, 'A1', 'C4', 'Status', 'Descending');

  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'C2')).toHaveText('Open');
  await expect(cell(page, 'A3')).toHaveText('South');
  await expect(cell(page, 'C3')).toHaveText('Open');
  await expect(cell(page, 'A4')).toHaveText('North');
  await expect(cell(page, 'C4')).toHaveText('Closed');
  await expect(cell(page, 'E1')).toHaveText('Keep');

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'A3')).toHaveText('South');
  await expect(cell(page, 'A4')).toHaveText('North');
  await expect(cell(page, 'E1')).toHaveText('Keep');
});

/* ------------------------------------------------------------------ */
/* REQ-5-1-2  Filter rows by value or condition                        */
/* ------------------------------------------------------------------ */

test('REQ-5-1-2: REQ-5-1-2 -the requested workflow Region the requested workflow Sales the requested workflow,the requested workflow', async ({ page }) => {
  await newBlankWorkbook(page);
  await fillTable(page, EXT_TABLE);
  await createFilter(page, 'A1', 'E4');

  await filterByValue(page, 'Region', 'North');

  await expect(cell(page, 'A2')).toBeVisible();
  await expect(cell(page, 'A3')).toBeHidden();
  await expect(cell(page, 'A4')).toBeVisible();

  await page.reload();
  await expect(cell(page, 'A3')).toBeHidden();
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'A4')).toHaveText('South');

  // Clear filter restores every source record in its original order
  await openDataMenuItem(page, 'Clear filter');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'A4')).toHaveText('South');
  await expect(cell(page, 'B3')).toHaveText('800');

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'A4')).toHaveText('South');
});

test('REQ-5-1-2#2: REQ-5-1-2 -the requested workflow, the requested workflow,the requested workflow', async ({ page }) => {
  await newBlankWorkbook(page);
  await fillTable(page, EXT_TABLE);
  await createFilter(page, 'A1', 'E4');

  await filterByCondition(page, 'Region', 'Text contains', 'o');
  await expect(cell(page, 'A2')).toBeHidden();
  await expect(cell(page, 'A3')).toBeVisible();
  await expect(cell(page, 'A4')).toBeVisible();

  await filterByCondition(page, 'Sales', 'Greater than', '750');
  await expect(cell(page, 'A3')).toBeVisible();
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'A2')).toBeHidden();
  await expect(cell(page, 'A4')).toBeHidden();

  await page.reload();
  await expect(cell(page, 'A3')).toBeVisible();
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'A2')).toBeHidden();
  await expect(cell(page, 'A4')).toBeHidden();
});

test('REQ-5-1-2#3: REQ-5-1-2 -CSV the requested workflow', async ({ page }) => {
  await newBlankWorkbook(page);
  await fillTable(page, EXT_TABLE);
  await createFilter(page, 'A1', 'E4');

  await filterByValue(page, 'Region', 'North');
  await expect(cell(page, 'A3')).toBeHidden();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export CSV', exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
  const content = fs.readFileSync(await download.path(), 'utf8');
  // hidden rows inside the filtered range are still exported
  expect(content).toContain('North');
  expect(content).toContain('East');
  expect(content).toContain('South');
  expect(content).toContain('800');

  // export does not change the worksheet or the filter view
  await expect(cell(page, 'A3')).toBeHidden();
  await expect(cell(page, 'A1')).toBeVisible();
  await expect(cell(page, 'A4')).toHaveText('South');

  await page.reload();
  await expect(cell(page, 'A3')).toBeHidden();
  await expect(cell(page, 'A2')).toHaveText('East');
});

test('REQ-5-1-2#4: REQ-5-1-2 -the requested workflow', async ({ page }) => {
  await newBlankWorkbook(page);
  await fillTable(page, EXT_TABLE);
  await createFilter(page, 'A1', 'E4');

  await filterByCondition(page, 'Date', 'Before', '2024-01-04');

  await expect(cell(page, 'A2')).toBeHidden();
  await expect(cell(page, 'A3')).toBeVisible();
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'A4')).toBeVisible();
  await expect(cell(page, 'A4')).toHaveText('South');

  await page.reload();
  await expect(cell(page, 'A2')).toBeHidden();
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'A4')).toHaveText('South');

  await openDataMenuItem(page, 'Clear filter');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'A4')).toHaveText('South');
});

test('REQ-5-1-2#5: REQ-5-1-2 -the requested workflow', async ({ page }) => {
  await newBlankWorkbook(page);
  await fillTable(page, EXT_TABLE);
  await createFilter(page, 'A1', 'E4');

  await filterByCondition(page, 'Notes', 'Is empty');
  await expect(cell(page, 'A2')).toBeVisible();
  await expect(cell(page, 'A3')).toBeHidden();
  await expect(cell(page, 'A4')).toBeVisible();

  await page.reload();
  await expect(cell(page, 'A3')).toBeHidden();
  await expect(cell(page, 'A2')).toHaveText('East');

  await filterByCondition(page, 'Notes', 'Is not empty');
  await expect(cell(page, 'A2')).toBeHidden();
  await expect(cell(page, 'A3')).toBeVisible();
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'A4')).toBeHidden();

  await page.reload();
  await expect(cell(page, 'A3')).toBeVisible();
  await expect(cell(page, 'A2')).toBeHidden();
  await expect(cell(page, 'A4')).toBeHidden();

  await openDataMenuItem(page, 'Clear filter');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'A4')).toHaveText('South');

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'A4')).toHaveText('South');
});

/* ------------------------------------------------------------------ */
/* REQ-5-2-1  Dropdown or numeric validation for a range               */
/* ------------------------------------------------------------------ */

test('REQ-5-2-1: REQ-5-2-1 -the requested workflow A1:A2 the requested workflow,the requested workflow', async ({ page }) => {
  await newBlankWorkbook(page);
  await fillTable(page, SALES_TABLE);

  await selectRange(page, 'A1', 'A2');
  const dlg = await openValidationDialog(page);
  await chooseCombo(page, dlg, 'Rule type', 'Dropdown');
  await dlg.getByLabel('Allowed values', { exact: true }).fill('East , West , North , South');
  await dlg.getByRole('button', { name: 'Save', exact: true }).click();

  // invalid value written through the formula bar: whole operation rejected
  await typeCell(page, 'A2', 'Central');
  await expect(
    page.getByText('Please select one of the following values: East, West, North, South', { exact: true })
  ).toBeVisible();
  await expect(cell(page, 'A2')).toHaveText('East');

  // valid value chosen from the dropdown button
  await page.getByRole('button', { name: 'Open dropdown for A2', exact: true }).click();
  await expect(page.getByRole('option', { name: 'West', exact: true })).toBeVisible();
  await page.getByRole('option', { name: 'North', exact: true }).click();
  await expect(cell(page, 'A2')).toHaveText('North');

  // rule stays active after refresh
  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('North');
  await typeCell(page, 'A2', 'Central');
  await expect(
    page.getByText('Please select one of the following values: East, West, North, South', { exact: true })
  ).toBeVisible();
  await expect(cell(page, 'A2')).toHaveText('North');
});

test('REQ-5-2-1#2: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await newBlankWorkbook(page);
  await fillTable(page, SALES_TABLE);

  await selectRange(page, 'B1', 'B2');
  const dlg = await openValidationDialog(page);
  await chooseCombo(page, dlg, 'Rule type', 'Dropdown');
  await dlg.getByLabel('Allowed values', { exact: true }).fill(' Red , Green ');
  await dlg.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dlg).toBeHidden();

  // invalid value written through the grid's inline editor
  await cell(page, 'B2').dblclick();
  await page.getByRole('textbox', { name: 'Edit B2', exact: true }).fill('Blue');
  await page.getByRole('textbox', { name: 'Edit B2', exact: true }).press('Enter');
  await expect(
    page.getByText('Please select one of the following values: Red, Green', { exact: true })
  ).toBeVisible();
  await expect(cell(page, 'B2')).toHaveText('1200');

  // valid value written through the grid's inline editor
  await cell(page, 'B2').dblclick();
  await page.getByRole('textbox', { name: 'Edit B2', exact: true }).fill('Green');
  await page.getByRole('textbox', { name: 'Edit B2', exact: true }).press('Enter');
  await expect(cell(page, 'B2')).toHaveText('Green');

  await page.reload();
  await expect(cell(page, 'B2')).toHaveText('Green');
});

test('REQ-5-2-1#3: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await newBlankWorkbook(page);
  await fillTable(page, ITEM_TABLE);

  await selectRange(page, 'B2', 'B3');
  const dlg = await openValidationDialog(page);
  await chooseCombo(page, dlg, 'Rule type', 'Number range');
  await dlg.getByLabel('Minimum', { exact: true }).fill('0');
  await dlg.getByLabel('Maximum', { exact: true }).fill('100');
  await dlg.getByRole('button', { name: 'Save', exact: true }).click();

  await typeCell(page, 'B3', '101');
  await expect(page.getByText('Please enter a number from 0 to 100', { exact: true })).toBeVisible();
  await expect(cell(page, 'B3')).toHaveText('9');

  await typeCell(page, 'B3', '100');
  await expect(cell(page, 'B3')).toHaveText('100');

  await typeCell(page, 'B3', '0');
  await expect(cell(page, 'B3')).toHaveText('0');

  await page.reload();
  await typeCell(page, 'B3', '101');
  await expect(page.getByText('Please enter a number from 0 to 100', { exact: true })).toBeVisible();
  await expect(cell(page, 'B3')).toHaveText('0');
  await expect(cell(page, 'B2')).toHaveText('4');
});

test('REQ-5-2-1#4: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await newBlankWorkbook(page);
  await fillTable(page, ITEM_TABLE);

  await selectRange(page, 'B2', 'B3');
  const dlg = await openValidationDialog(page);
  await chooseCombo(page, dlg, 'Rule type', 'Number range');
  await dlg.getByLabel('Minimum', { exact: true }).fill('0');
  await dlg.getByLabel('Maximum', { exact: true }).fill('100');
  await dlg.getByRole('button', { name: 'Save', exact: true }).click();

  // bulk paste where one target is invalid: no target may change
  await setClipboard(page, '50\n500');
  await cell(page, 'B2').click();
  await page.keyboard.press('Control+V');
  await expect(page.getByText('Please enter a number from 0 to 100', { exact: true })).toBeVisible();
  await expect(cell(page, 'B2')).toHaveText('4');
  await expect(cell(page, 'B3')).toHaveText('9');

  await page.reload();
  await expect(cell(page, 'B2')).toHaveText('4');
  await expect(cell(page, 'B3')).toHaveText('9');
});

test('REQ-5-2-1#5: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await newBlankWorkbook(page);
  await fillTable(page, ITEM_TABLE);
  await typeCell(page, 'D1', '500');

  await selectRange(page, 'B2', 'B3');
  const dlg = await openValidationDialog(page);
  await chooseCombo(page, dlg, 'Rule type', 'Number range');
  await dlg.getByLabel('Minimum', { exact: true }).fill('0');
  await dlg.getByLabel('Maximum', { exact: true }).fill('100');
  await dlg.getByRole('button', { name: 'Save', exact: true }).click();

  // range move onto a validated target: rejected as a whole
  await cell(page, 'D1').click();
  await page.keyboard.press('Control+X');
  await cell(page, 'B2').click();
  await page.keyboard.press('Control+V');
  await expect(page.getByText('Please enter a number from 0 to 100', { exact: true })).toBeVisible();
  await expect(cell(page, 'B2')).toHaveText('4');
  await expect(cell(page, 'D1')).toHaveText('500');

  await page.reload();
  await expect(cell(page, 'B2')).toHaveText('4');
  await expect(cell(page, 'D1')).toHaveText('500');

  await typeCell(page, 'B2', '500');
  await expect(page.getByText('Please enter a number from 0 to 100', { exact: true })).toBeVisible();
  await expect(cell(page, 'B2')).toHaveText('4');
});

test('REQ-5-2-1#6: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await newBlankWorkbook(page);
  await fillTable(page, ITEM_TABLE);

  await selectRange(page, 'B2', 'B3');
  let dlg = await openValidationDialog(page);
  await chooseCombo(page, dlg, 'Rule type', 'Number range');
  await dlg.getByLabel('Minimum', { exact: true }).fill('0');
  await dlg.getByLabel('Maximum', { exact: true }).fill('100');
  await dlg.getByRole('button', { name: 'Save', exact: true }).click();

  // reopening shows the existing rule prefilled, with a delete command
  await selectRange(page, 'B2', 'B3');
  dlg = await openValidationDialog(page);
  await expect(dlg.getByLabel('Rule type', { exact: true })).toContainText('Number range');
  await expect(dlg.getByLabel('Minimum', { exact: true })).toHaveValue('0');
  await expect(dlg.getByLabel('Maximum', { exact: true })).toHaveValue('100');
  await expect(dlg.getByRole('button', { name: 'Delete rule', exact: true })).toBeVisible();

  await dlg.getByLabel('Maximum', { exact: true }).fill('200');
  await dlg.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dlg).toBeHidden();
  await expect(cell(page, 'B2')).toHaveText('4');
  await expect(cell(page, 'B3')).toHaveText('9');

  await typeCell(page, 'B2', '150');
  await expect(cell(page, 'B2')).toHaveText('150');
  await typeCell(page, 'B2', '250');
  await expect(page.getByText('Please enter a number between 0 and 200', { exact: true })).toBeVisible();
  await expect(cell(page, 'B2')).toHaveText('150');

  await selectRange(page, 'B2', 'B3');
  dlg = await openValidationDialog(page);
  await dlg.getByRole('button', { name: 'Delete rule', exact: true }).click();
  await expect(dlg).toBeHidden();
  await expect(cell(page, 'B2')).toHaveText('150');

  await typeCell(page, 'B2', '500');
  await expect(cell(page, 'B2')).toHaveText('500');
});

/* ------------------------------------------------------------------ */
/* REQ-5-3-1  Create and refresh a basic pivot table                   */
/* ------------------------------------------------------------------ */

test('REQ-5-3-1: REQ-5-3-1 -the requested workflow Pivot1 the requested workflow Region the requested workflow Sales,the requested workflow', async ({ page }) => {
  await newBlankWorkbook(page);
  await fillTable(page, SALES_TABLE);

  await selectRange(page, 'A1', 'C4');
  await openDataMenuItem(page, 'Create pivot table');
  const dlg = page.getByRole('dialog', { name: 'Create pivot table', exact: true });
  await expect(dlg).toBeVisible();
  await expect(dlg.getByText('Source range: A1:C4', { exact: true })).toBeVisible();
  await expect(dlg.getByRole('radio', { name: 'New worksheet', exact: true })).toBeVisible();
  await dlg.getByRole('button', { name: 'Create', exact: true }).click();

  await expect(page.getByRole('tab', { name: 'Pivot1', exact: true })).toBeVisible();
  const editor = page.getByRole('region', { name: 'Pivot table editor', exact: true });
  await expect(editor).toBeVisible();

  await configurePivot(page, editor, { rows: 'Region', values: 'Sales', summarizeBy: 'SUM' });

  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('SUM of Sales');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'B3')).toHaveText('800');
  await expect(cell(page, 'A4')).toHaveText('South');
  await expect(cell(page, 'B4')).toHaveText('700');
  await expect(cell(page, 'A5')).toHaveText('Grand Total');
  await expect(cell(page, 'B5')).toHaveText('2700');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('SUM of Sales');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'B5')).toHaveText('2700');
});

test('REQ-5-3-1#2: REQ-5-3-1 -the requested workflow,the requested workflow', async ({ page }) => {
  await newBlankWorkbook(page);
  await fillTable(page, SALES_TABLE);

  const editor = await createPivotSheet(page, 'A1', 'C4');
  await configurePivot(page, editor, {
    rows: 'Region',
    columns: 'Status',
    values: 'Sales',
    summarizeBy: 'SUM',
  });

  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('Open');
  await expect(cell(page, 'C1')).toHaveText('Closed');
  await expect(cell(page, 'D1')).toHaveText('Grand Total');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'D2')).toHaveText('1200');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'C3')).toHaveText('800');
  await expect(cell(page, 'A4')).toHaveText('South');
  await expect(cell(page, 'B4')).toHaveText('700');
  await expect(cell(page, 'A5')).toHaveText('Grand Total');
  await expect(cell(page, 'B5')).toHaveText('1900');
  await expect(cell(page, 'C5')).toHaveText('800');
  await expect(cell(page, 'D5')).toHaveText('2700');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('Open');
  await expect(cell(page, 'D1')).toHaveText('Grand Total');
  await expect(cell(page, 'D5')).toHaveText('2700');
});

test('REQ-5-3-1#3: REQ-5-3-1 -the requested workflow COUNT the requested workflow', async ({ page }) => {
  await newBlankWorkbook(page);
  await fillTable(page, SALES_TABLE);

  const editor = await createPivotSheet(page, 'A1', 'C4');
  await configurePivot(page, editor, {
    rows: 'Region',
    columns: 'Status',
    values: 'Sales',
    summarizeBy: 'COUNT',
  });

  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('Open');
  await expect(cell(page, 'C1')).toHaveText('Closed');
  await expect(cell(page, 'D1')).toHaveText('Grand Total');
  await expect(cell(page, 'B2')).toHaveText('1');
  await expect(cell(page, 'C2')).toHaveText('0');
  await expect(cell(page, 'D2')).toHaveText('1');
  await expect(cell(page, 'B3')).toHaveText('0');
  await expect(cell(page, 'C3')).toHaveText('1');
  await expect(cell(page, 'B4')).toHaveText('1');
  await expect(cell(page, 'C4')).toHaveText('0');
  await expect(cell(page, 'A5')).toHaveText('Grand Total');
  await expect(cell(page, 'B5')).toHaveText('2');
  await expect(cell(page, 'C5')).toHaveText('1');
  await expect(cell(page, 'D5')).toHaveText('3');

  await page.reload();
  await expect(cell(page, 'C2')).toHaveText('0');
  await expect(cell(page, 'D5')).toHaveText('3');
});

test('REQ-5-3-1#4: REQ-5-3-1 -AVERAGE the requested workflow', async ({ page }) => {
  await newBlankWorkbook(page);
  await fillTable(page, SALES_TABLE);

  const editor = await createPivotSheet(page, 'A1', 'C4');
  await configurePivot(page, editor, { rows: 'Region', values: 'Sales', summarizeBy: 'AVERAGE' });

  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('AVERAGE of Sales');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'B3')).toHaveText('800');
  await expect(cell(page, 'A4')).toHaveText('South');
  await expect(cell(page, 'B4')).toHaveText('700');
  await expect(cell(page, 'A5')).toHaveText('Grand Total');
  await expect(cell(page, 'B5')).toHaveText('900');

  await page.reload();
  await expect(cell(page, 'B1')).toHaveText('AVERAGE of Sales');
  await expect(cell(page, 'B5')).toHaveText('900');
});

test('REQ-5-3-1#5: REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await newBlankWorkbook(page);
  await fillTable(page, SALES_TABLE);

  const editor = await createPivotSheet(page, 'A1', 'C4');
  await configurePivot(page, editor, { rows: 'Region', values: 'Sales', summarizeBy: 'SUM' });
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'B5')).toHaveText('2700');

  // the source worksheet keeps its original values and order
  await sheetTab(page, 'Sheet1').click();
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'C2')).toHaveText('Open');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'B3')).toHaveText('800');
  await expect(cell(page, 'A4')).toHaveText('South');
  await expect(cell(page, 'B4')).toHaveText('700');

  await sheetTab(page, 'Pivot1').click();
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('SUM of Sales');
  await expect(cell(page, 'B5')).toHaveText('2700');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B5')).toHaveText('2700');

  await sheetTab(page, 'Sheet1').click();
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'A4')).toHaveText('South');
  await expect(cell(page, 'C4')).toHaveText('Open');
});

test('REQ-5-3-1#6: REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await newBlankWorkbook(page);
  await fillTable(page, SALES_TABLE);

  const editor = await createPivotSheet(page, 'A1', 'C4');
  await configurePivot(page, editor, { rows: 'Region', values: 'Sales', summarizeBy: 'SUM' });
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'B5')).toHaveText('2700');

  // a text field cannot be summed
  await chooseCombo(page, editor, 'Values', 'Status');
  await chooseCombo(page, editor, 'Summarize by', 'SUM');
  await editor.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByText('Value field requires numeric values', { exact: true })).toBeVisible();

  // the last successful result is preserved
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'B5')).toHaveText('2700');

  // the source worksheet is not modified
  await sheetTab(page, 'Sheet1').click();
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'A4')).toHaveText('South');
});

test('REQ-5-3-1#7: REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await newBlankWorkbook(page);
  await fillTable(page, SALES_TABLE);

  const editor = await createPivotSheet(page, 'A1', 'C4');
  await configurePivot(page, editor, { rows: 'Region', values: 'Sales', summarizeBy: 'SUM' });
  await expect(cell(page, 'B5')).toHaveText('2700');

  // delete a source column that a pivot field uses
  await sheetTab(page, 'Sheet1').click();
  await page.getByRole('columnheader', { name: 'B', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete column', exact: true }).click();
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('Status');

  await sheetTab(page, 'Pivot1').click();
  await page.getByRole('button', { name: 'Refresh pivot table', exact: true }).click();
  await expect(
    page.getByText('Pivot field is no longer available. Select a new field.', { exact: true })
  ).toBeVisible();

  // the last successful result and the source worksheet are preserved
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'B5')).toHaveText('2700');

  await sheetTab(page, 'Sheet1').click();
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('Status');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('Open');
});

test('REQ-5-3-1#8: REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await newBlankWorkbook(page);
  await fillTable(page, SALES_TABLE);

  const editor = await createPivotSheet(page, 'A1', 'C4');
  await configurePivot(page, editor, { rows: 'Region', values: 'Sales', summarizeBy: 'SUM' });
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'B5')).toHaveText('2700');

  await sheetTab(page, 'Sheet1').click();
  await typeCell(page, 'B2', '2000');
  await expect(cell(page, 'B2')).toHaveText('2000');

  await sheetTab(page, 'Pivot1').click();
  await page.getByRole('button', { name: 'Refresh pivot table', exact: true }).click();
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('2000');
  await expect(cell(page, 'B5')).toHaveText('3500');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('SUM of Sales');
  await expect(cell(page, 'B2')).toHaveText('2000');
  await expect(cell(page, 'B5')).toHaveText('3500');
});

test('REQ-5-3-1#9: REQ-5-3-1 -the requested workflow COUNT the requested workflow', async ({ page }) => {
  await newBlankWorkbook(page);
  await fillTable(page, EXT_TABLE);

  const editor = await createPivotSheet(page, 'A1', 'E4');
  await configurePivot(page, editor, { rows: 'Region', values: 'Notes', summarizeBy: 'COUNT' });

  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('COUNT of Notes');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('0');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'B3')).toHaveText('1');
  await expect(cell(page, 'A4')).toHaveText('South');
  await expect(cell(page, 'B4')).toHaveText('0');
  await expect(cell(page, 'A5')).toHaveText('Grand Total');
  await expect(cell(page, 'B5')).toHaveText('1');

  await page.reload();
  await expect(cell(page, 'B1')).toHaveText('COUNT of Notes');
  await expect(cell(page, 'B2')).toHaveText('0');
  await expect(cell(page, 'B5')).toHaveText('1');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

