const { test, expect } = require('@playwright/test');

const u = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const salesRows = [
  ['Region', 'Sales', 'Status'],
  ['East', '1200', 'Open'],
  ['North', '800', 'Closed'],
  ['South', '700', 'Open'],
];

async function importWorkbook(page, rows) {
  const name = u();
  const csv = rows.map((r) => r.join(',')).join('\n') + '\n';
  await page.goto('/');
  await page.getByRole('button', { name: 'Import CSV', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import CSV', exact: true });
  await dialog.getByLabel('CSV file', { exact: true }).setInputFiles({
    name: `${name}.csv`,
    mimeType: 'text/csv',
    buffer: Buffer.from(csv, 'utf8'),
  });
  await dialog.getByRole('button', { name: 'Confirm import', exact: true }).click();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
}

async function selectRange(page, start, end) {
  const startCell = page.getByRole('gridcell', { name: start, exact: true });
  const endCell = page.getByRole('gridcell', { name: end, exact: true });
  await startCell.scrollIntoViewIfNeeded();
  await endCell.scrollIntoViewIfNeeded();
  const from = await startCell.boundingBox();
  const to = await endCell.boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 5 });
  await page.mouse.up();
}

async function clickDataMenuCommand(page, name) {
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByRole('menuitem', { name, exact: true }).click();
}

async function chooseCombo(scope, label, option) {
  const combo = scope.getByLabel(label, { exact: true });
  await combo.click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

const cell = (page, coord) =>
  page.getByRole('gridcell', { name: coord, exact: true });

async function setCellValue(page, coord, value) {
  await cell(page, coord).click();
  const bar = page.getByLabel('Formula bar', { exact: true });
  await bar.fill(value);
  await bar.press('Enter');
}

async function createPivot(page, rowsData, config) {
  await importWorkbook(page, rowsData);
  await selectRange(page, 'A1', 'C6');
  await clickDataMenuCommand(page, 'Create pivot table');
  const dialog = page.getByRole('dialog', { name: 'Create pivot table', exact: true });
  await expect(dialog.getByText('Source range: A1:C6', { exact: true })).toBeVisible();
  await dialog.getByRole('radio', { name: 'New worksheet', exact: true }).check();
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();
  const pivotTab = page.getByRole('tab', { name: 'Pivot1', exact: true });
  await expect(pivotTab).toBeVisible();
  await expect(pivotTab).toHaveAttribute('aria-selected', 'true');
  const editor = page.getByRole('region', { name: 'Pivot table editor', exact: true });
  await expect(editor).toBeVisible();
  if (config.rows) await chooseCombo(editor, 'Rows', config.rows);
  if (config.columns) await chooseCombo(editor, 'Columns', config.columns);
  if (config.values) await chooseCombo(editor, 'Values', config.values);
  if (config.summarize) await chooseCombo(editor, 'Summarize by', config.summarize);
  await editor.getByRole('button', { name: 'Apply', exact: true }).click();
  if (config.rows) {
    await expect(cell(page, 'A1')).toHaveText(config.rows);
  }
}

test('REQ-5-2-1: REQ-5-2-1 -the requested workflow A1:A2 the requested workflow,the requested workflow', async ({ page }) => {
  await importWorkbook(page, salesRows);
  await selectRange(page, 'A1', 'A2');
  await clickDataMenuCommand(page, 'Data validation');
  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await expect(dialog).toBeVisible();
  await chooseCombo(dialog, 'Rule type', 'Dropdown');
  await dialog.getByLabel('Allowed values', { exact: true }).fill('East,North,South');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).not.toBeVisible();

  const dropdownA2 = page.getByRole('button', { name: 'Open dropdown for A2', exact: true });
  await expect(dropdownA2).toBeVisible();
  await dropdownA2.click();
  await page.getByRole('option', { name: 'North', exact: true }).click();
  await expect(cell(page, 'A2')).toHaveText('North');

  await cell(page, 'B2').click();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('North');
  const bar = page.getByLabel('Formula bar', { exact: true });
  await bar.fill('Central');
  await bar.press('Enter');
  await expect(page.getByText(/Please select one of the following values: East, ?North, ?South/)).toBeVisible();
  await expect(cell(page, 'A2')).toHaveText('North');

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(cell(page, 'A2')).toHaveText('North');
  await expect(page.getByRole('button', { name: 'Open dropdown for A2', exact: true })).toBeVisible();
});

test('REQ-5-2-1#2: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await importWorkbook(page, salesRows);
  await selectRange(page, 'B5', 'B6');
  await clickDataMenuCommand(page, 'Data validation');
  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await chooseCombo(dialog, 'Rule type', 'Number range');
  await dialog.getByLabel('Minimum', { exact: true }).fill('10');
  await dialog.getByLabel('Maximum', { exact: true }).fill('20');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).not.toBeVisible();

  await setCellValue(page, 'B5', '15');
  await expect(cell(page, 'B5')).toHaveText('15');
  await setCellValue(page, 'B5', '101');
  await expect(page.getByText('Please enter a number between 10 and 20', { exact: true })).toBeVisible();
  await expect(cell(page, 'B5')).toHaveText('15');

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(cell(page, 'B5')).toHaveText('15');
  await setCellValue(page, 'B5', '101');
  await expect(page.getByText('Please enter a number between 10 and 20', { exact: true })).toBeVisible();
  await expect(cell(page, 'B5')).toHaveText('15');
});

test('REQ-5-2-1#3: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await importWorkbook(page, salesRows);
  await selectRange(page, 'A2', 'A3');
  await clickDataMenuCommand(page, 'Data validation');
  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await chooseCombo(dialog, 'Rule type', 'Dropdown');
  await dialog.getByLabel('Allowed values', { exact: true }).fill('East,North,South');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).not.toBeVisible();

  await page.evaluate((t) => navigator.clipboard.writeText(t), 'North\nCentral');
  await cell(page, 'B2').click();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Control+V');
  await expect(page.getByText(/Please select one of the following values: East, ?North, ?South/)).toBeVisible();
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'A3')).toHaveText('North');
});

test('REQ-5-2-1#4: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await importWorkbook(page, salesRows);
  await selectRange(page, 'B5', 'B6');
  await clickDataMenuCommand(page, 'Data validation');
  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await chooseCombo(dialog, 'Rule type', 'Number range');
  await dialog.getByLabel('Minimum', { exact: true }).fill('10');
  await dialog.getByLabel('Maximum', { exact: true }).fill('20');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).not.toBeVisible();

  await setCellValue(page, 'B5', '15');
  await expect(cell(page, 'B5')).toHaveText('15');
  await cell(page, 'B5').dblclick();
  const edit = page.getByLabel('Edit B5', { exact: true });
  await edit.fill('25');
  await edit.press('Enter');
  await expect(page.getByText('Please enter a number between 10 and 20', { exact: true })).toBeVisible();
  await expect(cell(page, 'B5')).toHaveText('15');

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(cell(page, 'B5')).toHaveText('15');
});

test('REQ-5-2-1#5: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await importWorkbook(page, salesRows);
  await selectRange(page, 'A2', 'A3');
  await clickDataMenuCommand(page, 'Data validation');
  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await chooseCombo(dialog, 'Rule type', 'Dropdown');
  await dialog.getByLabel('Allowed values', { exact: true }).fill('East,North,South');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).not.toBeVisible();

  await cell(page, 'B2').click();
  await page.keyboard.press('ArrowLeft');
  await clickDataMenuCommand(page, 'Data validation');
  const reopened = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await expect(reopened.getByText('Dropdown', { exact: true })).toBeVisible();
  await expect(reopened.getByLabel('Allowed values', { exact: true })).toHaveValue('East,North,South');
  await expect(reopened.getByRole('button', { name: 'Delete rule', exact: true })).toBeVisible();
  await reopened.getByRole('button', { name: 'Delete rule', exact: true }).click();
  await expect(reopened).not.toBeVisible();

  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(page.getByRole('button', { name: 'Open dropdown for A2', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(page.getByRole('button', { name: 'Open dropdown for A2', exact: true })).toHaveCount(0);
});

test('REQ-5-2-1#6: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await importWorkbook(page, salesRows);
  await selectRange(page, 'C2', 'C3');
  await clickDataMenuCommand(page, 'Data validation');
  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await chooseCombo(dialog, 'Rule type', 'Dropdown');
  await dialog.getByLabel('Allowed values', { exact: true }).fill('Open,Closed');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).not.toBeVisible();

  await page.getByRole('button', { name: 'Open dropdown for C2', exact: true }).click();
  await page.getByRole('option', { name: 'Closed', exact: true }).click();
  await expect(cell(page, 'C2')).toHaveText('Closed');

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(cell(page, 'C2')).toHaveText('Closed');
  await expect(page.getByRole('button', { name: 'Open dropdown for C2', exact: true })).toBeVisible();

  await cell(page, 'B2').click();
  await page.keyboard.press('ArrowRight');
  const bar = page.getByLabel('Formula bar', { exact: true });
  await bar.fill('Pending');
  await bar.press('Enter');
  await expect(page.getByText(/Please select one of the following values: Open, ?Closed/)).toBeVisible();
  await expect(cell(page, 'C2')).toHaveText('Closed');
});

test('REQ-5-3-1: REQ-5-3-1 -the requested workflow Pivot1 the requested workflow Region the requested workflow Sales,the requested workflow', async ({ page }) => {
  await createPivot(page, salesRows, { rows: 'Region', values: 'Sales', summarize: 'SUM' });
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
  await expect(page.getByRole('tab', { name: 'Pivot1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'B5')).toHaveText('2700');
});

test('REQ-5-3-1#2: REQ-5-3-1 -the requested workflow,the requested workflow', async ({ page }) => {
  await createPivot(page, salesRows, {
    rows: 'Region',
    columns: 'Status',
    values: 'Sales',
    summarize: 'SUM',
  });
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('Open');
  await expect(cell(page, 'C1')).toHaveText('Closed');
  await expect(cell(page, 'D1')).toHaveText('Grand Total');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'D2')).toHaveText('1200');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'C3')).toHaveText('800');
  await expect(cell(page, 'D3')).toHaveText('800');
  await expect(cell(page, 'A4')).toHaveText('South');
  await expect(cell(page, 'B4')).toHaveText('700');
  await expect(cell(page, 'D4')).toHaveText('700');
  await expect(cell(page, 'A5')).toHaveText('Grand Total');
  await expect(cell(page, 'D5')).toHaveText('2700');
});

test('REQ-5-3-1#3: REQ-5-3-1 -the requested workflow COUNT the requested workflow', async ({ page }) => {
  await createPivot(page, salesRows, { rows: 'Region', values: 'Sales', summarize: 'COUNT' });
  await expect(cell(page, 'B1')).toHaveText('COUNT of Sales');
  await expect(cell(page, 'B2')).toHaveText('1');
  await expect(cell(page, 'B3')).toHaveText('1');
  await expect(cell(page, 'B4')).toHaveText('1');
  await expect(cell(page, 'B5')).toHaveText('3');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Pivot1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'B5')).toHaveText('3');
});

test('REQ-5-3-1#4: REQ-5-3-1 -AVERAGE the requested workflow', async ({ page }) => {
  await createPivot(page, salesRows, { rows: 'Region', values: 'Sales', summarize: 'AVERAGE' });
  await expect(cell(page, 'B1')).toHaveText('AVERAGE of Sales');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'B3')).toHaveText('800');
  await expect(cell(page, 'B4')).toHaveText('700');
  await expect(cell(page, 'B5')).toHaveText('900');
});

test('REQ-5-3-1#5: REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await createPivot(page, salesRows, { rows: 'Region', values: 'Sales', summarize: 'SUM' });
  await expect(cell(page, 'B5')).toHaveText('2700');

  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await setCellValue(page, 'B2', '1500');
  await expect(cell(page, 'B2')).toHaveText('1500');

  await page.getByRole('tab', { name: 'Pivot1', exact: true }).click();
  await expect(cell(page, 'B5')).toHaveText('2700');
  await page.getByRole('button', { name: 'Refresh pivot table', exact: true }).click();
  await expect(cell(page, 'B5')).toHaveText('3000');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Pivot1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'B5')).toHaveText('3000');
});

test('REQ-5-3-1#6: REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await createPivot(page, salesRows, { rows: 'Region', values: 'Sales', summarize: 'SUM' });
  await expect(cell(page, 'B5')).toHaveText('2700');

  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await page.getByRole('columnheader', { name: 'B', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete column', exact: true }).click();

  await page.getByRole('tab', { name: 'Pivot1', exact: true }).click();
  await expect(cell(page, 'B5')).toHaveText('2700');
  await page.getByRole('button', { name: 'Refresh pivot table', exact: true }).click();
  await expect(page.getByText('Pivot field is no longer available. Select a new field.', { exact: true })).toBeVisible();
  await expect(cell(page, 'B5')).toHaveText('2700');
});

test('REQ-5-3-1#7: REQ-5-3-1 -the requested workflow', async ({ page }) => {
  await createPivot(page, salesRows, { rows: 'Region', values: 'Sales', summarize: 'SUM' });
  await expect(cell(page, 'B5')).toHaveText('2700');

  const editor = page.getByRole('region', { name: 'Pivot table editor', exact: true });
  await chooseCombo(editor, 'Values', 'Status');
  await editor.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByText('Value field requires numeric values', { exact: true })).toBeVisible();
  await expect(cell(page, 'B5')).toHaveText('2700');

  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await expect(cell(page, 'B2')).toHaveText('1200');
});

test('REQ-5-3-1#8: REQ-5-3-1 -the requested workflow', async ({ page }) => {
  const rows = [
    ['Region', 'Sales', 'Status'],
    ['East', '1200', 'Open'],
    ['North', '', 'Closed'],
    ['South', '700', 'Open'],
  ];
  await createPivot(page, rows, {
    rows: 'Region',
    columns: 'Status',
    values: 'Sales',
    summarize: 'COUNT',
  });
  await expect(cell(page, 'B1')).toHaveText('Open');
  await expect(cell(page, 'C1')).toHaveText('Closed');
  await expect(cell(page, 'D1')).toHaveText('Grand Total');
  await expect(cell(page, 'B2')).toHaveText('1');
  await expect(cell(page, 'C2')).toHaveText('0');
  await expect(cell(page, 'B3')).toHaveText('0');
  await expect(cell(page, 'C3')).toHaveText('0');
  await expect(cell(page, 'B4')).toHaveText('1');
  await expect(cell(page, 'C4')).toHaveText('0');
  await expect(cell(page, 'B5')).toHaveText('2');
  await expect(cell(page, 'C5')).toHaveText('0');
  await expect(cell(page, 'D5')).toHaveText('2');
});

test('REQ-5-3-1#9: REQ-5-3-1 -the requested workflow COUNT the requested workflow', async ({ page }) => {
  const rows = [
    ['Region', 'Sales', 'Status'],
    ['East', '1200', 'Open'],
    ['North', 'N/A', 'Closed'],
    ['South', '700', 'Open'],
  ];
  await createPivot(page, rows, { rows: 'Region', values: 'Sales', summarize: 'COUNT' });
  await expect(cell(page, 'B1')).toHaveText('COUNT of Sales');
  await expect(cell(page, 'B2')).toHaveText('1');
  await expect(cell(page, 'B3')).toHaveText('1');
  await expect(cell(page, 'B4')).toHaveText('1');
  await expect(cell(page, 'B5')).toHaveText('3');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

