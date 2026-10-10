const { test, expect } = require('@playwright/test');
const f = require('./fixtures.cjs');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const cell = (page, coord) => page.getByRole('gridcell', { name: coord, exact: true });
const formulaBar = (page) => page.getByLabel('Formula bar', { exact: true });

async function setNumberValidation(page, startCoord, endCoord, min, max) {
  await f.selectRange(page, startCoord, endCoord);
  await f.dataCommand(page, 'Data validation');
  const dialog = page.getByRole('dialog', { name: 'Data validation' });
  await f.chooseOption(dialog, 'Rule type', 'Number range');
  await dialog.getByLabel('Minimum', { exact: true }).fill(String(min));
  await dialog.getByLabel('Maximum', { exact: true }).fill(String(max));
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();
}

async function setDropdownValidation(page, startCoord, endCoord, values) {
  await f.selectRange(page, startCoord, endCoord);
  await f.dataCommand(page, 'Data validation');
  const dialog = page.getByRole('dialog', { name: 'Data validation' });
  await f.chooseOption(dialog, 'Rule type', 'Dropdown');
  await dialog.getByLabel('Allowed values', { exact: true }).fill(values.join(', '));
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();
}

test('REQ-5-1-1: Sort sales in descending order', async ({ page }) => {
  const workbook = `wb${u()}`;
  await f.createWorkbook(page, { name: workbook });
  await f.enterCells(page, {
    A1: 'Region', B1: 'Sales', C1: 'Status',
    A2: 'East', B2: 1200, C2: 'Open',
    A3: 'North', B3: 800, C3: 'Closed',
    A4: 'South', B4: 1200, C4: 'Pending',
    A5: 'West', B5: 500, C5: 'Open',
    E1: 'Outside',
  });

  await f.sortRange(page, 'A1', 'C5', { sortBy: 'Sales', order: 'Descending', hasHeader: true });

  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'A3')).toHaveText('South');
  await expect(cell(page, 'A4')).toHaveText('North');
  await expect(cell(page, 'A5')).toHaveText('West');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'B3')).toHaveText('1200');
  await expect(cell(page, 'B4')).toHaveText('800');
  await expect(cell(page, 'B5')).toHaveText('500');
  await expect(cell(page, 'C2')).toHaveText('Open');
  await expect(cell(page, 'C3')).toHaveText('Pending');
  await expect(cell(page, 'C4')).toHaveText('Closed');
  await expect(cell(page, 'C5')).toHaveText('Open');
  await expect(cell(page, 'E1')).toHaveText('Outside');

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'A3')).toHaveText('South');
  await expect(cell(page, 'A4')).toHaveText('North');
  await expect(cell(page, 'A5')).toHaveText('West');
  await expect(cell(page, 'E1')).toHaveText('Outside');
});

test('REQ-5-1-1#2: Preserve formula and validation alignment after sorting', async ({ page }) => {
  const workbook = `wb${u()}`;
  await f.createWorkbook(page, { name: workbook });
  await f.enterCells(page, {
    A1: 'Item', B1: 'Score', C1: 'Double',
    A2: 'Alpha', B2: 3, C2: '=B2*2',
    A3: 'Bravo', B3: 1, C3: '=B3*2',
    A4: 'Charlie', B4: 2, C4: '=B4*2',
  });

  await setNumberValidation(page, 'B2', 'B4', 0, 10);
  await f.sortRange(page, 'A1', 'C4', { sortBy: 'Score', order: 'Ascending', hasHeader: true });

  await expect(cell(page, 'A2')).toHaveText('Bravo');
  await expect(cell(page, 'A3')).toHaveText('Charlie');
  await expect(cell(page, 'A4')).toHaveText('Alpha');
  await expect(cell(page, 'B2')).toHaveText('1');
  await expect(cell(page, 'C2')).toHaveText('2');
  await expect(cell(page, 'B3')).toHaveText('2');
  await expect(cell(page, 'C3')).toHaveText('4');
  await expect(cell(page, 'B4')).toHaveText('3');
  await expect(cell(page, 'C4')).toHaveText('6');

  for (const [coord, formula] of [['C2', '=B2*2'], ['C3', '=B3*2'], ['C4', '=B4*2']]) {
    await cell(page, coord).click();
    await expect(formulaBar(page)).toHaveValue(formula);
  }

  await cell(page, 'B2').click();
  await formulaBar(page).fill('11');
  await formulaBar(page).press('Enter');
  await expect(page.getByText('Please enter a number from 0 to 10', { exact: true })).toBeVisible();
  await expect(cell(page, 'B2')).toHaveText('1');
  await expect(cell(page, 'C2')).toHaveText('2');

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('Bravo');
  await expect(cell(page, 'B2')).toHaveText('1');
  await expect(cell(page, 'C2')).toHaveText('2');
});

test('REQ-5-1-1#3: Preserve an existing filter condition after sorting', async ({ page }) => {
  const workbook = `wb${u()}`;
  await f.createWorkbook(page, { name: workbook });
  await f.enterCells(page, {
    A1: 'Item', B1: 'Score',
    A2: 'Alpha', B2: 3,
    A3: 'Bravo', B3: 1,
    A4: 'Charlie', B4: 2,
  });

  await f.createFilter(page, 'A1', 'B4');
  await f.filterByCondition(page, 'Score', 'Greater than', '1');
  await expect(page.getByRole('button', { name: 'Filter Score', exact: true })).toBeVisible();
  await expect(cell(page, 'A3')).not.toBeVisible();

  await f.sortRange(page, 'A1', 'B4', { sortBy: 'Score', order: 'Ascending', hasHeader: true });
  await expect(page.getByRole('button', { name: 'Filter Score', exact: true })).toBeVisible();
  await expect(cell(page, 'A2')).not.toBeVisible();
  await expect(cell(page, 'A3')).toHaveText('Charlie');
  await expect(cell(page, 'A4')).toHaveText('Alpha');

  await page.reload();
  await expect(page.getByRole('button', { name: 'Filter Score', exact: true })).toBeVisible();
  await expect(cell(page, 'A2')).not.toBeVisible();
  await expect(cell(page, 'A3')).toHaveText('Charlie');
  await expect(cell(page, 'A4')).toHaveText('Alpha');
});

test('REQ-5-1-2: Filter using conditions on multiple columns', async ({ page }) => {
  const workbook = `wb${u()}`;
  await f.createWorkbook(page, { name: workbook });
  await f.enterCells(page, {
    A1: 'Region', B1: 'Sales', C1: 'Status',
    A2: 'East', B2: 1200, C2: 'Open',
    A3: 'East', B3: 900, C3: 'Closed',
    A4: 'North', B4: 2000, C4: 'Open',
    A5: 'East', B5: 1500, C5: 'Closed',
    A6: 'South', B6: 700, C6: 'Open',
  });

  await f.createFilter(page, 'A1', 'C6');
  await f.filterByValues(page, 'Region', ['East']);
  await f.filterByCondition(page, 'Sales', 'Greater than', '1000');

  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'A5')).toHaveText('East');
  await expect(cell(page, 'A3')).not.toBeVisible();
  await expect(cell(page, 'A4')).not.toBeVisible();
  await expect(cell(page, 'A6')).not.toBeVisible();

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'A5')).toHaveText('East');
  await expect(cell(page, 'A3')).not.toBeVisible();
  await expect(cell(page, 'A4')).not.toBeVisible();
  await expect(cell(page, 'A6')).not.toBeVisible();

  await f.clearFilter(page);
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'A3')).toHaveText('East');
  await expect(cell(page, 'A4')).toHaveText('North');
  await expect(cell(page, 'A5')).toHaveText('East');
  await expect(cell(page, 'A6')).toHaveText('South');
  await expect(cell(page, 'B3')).toHaveText('900');
  await expect(cell(page, 'B4')).toHaveText('2000');
  await expect(cell(page, 'B6')).toHaveText('700');
});

test('REQ-5-2-1: Enter status using a dropdown rule', async ({ page }) => {
  const workbook = `wb${u()}`;
  await f.createWorkbook(page, { name: workbook });
  await setDropdownValidation(page, 'A1', 'A2', ['Not Started', 'In Progress', 'Completed']);
  await f.chooseDropdownOption(page, 'A1', 'In Progress');

  await expect(cell(page, 'A1')).toHaveText('In Progress');
  await expect(page.getByRole('button', { name: 'Open dropdown for A2', exact: true })).toBeVisible();

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('In Progress');
  await expect(page.getByRole('button', { name: 'Open dropdown for A2', exact: true })).toBeVisible();
});

test('REQ-5-2-1#2: Reject a number outside the allowed range', async ({ page }) => {
  const workbook = `wb${u()}`;
  await f.createWorkbook(page, { name: workbook });
  await f.enterCell(page, 'A1', 50);
  await setNumberValidation(page, 'A1', 'A1', 0, 100);

  await cell(page, 'A1').click();
  await formulaBar(page).fill('120');
  await formulaBar(page).press('Enter');
  await expect(page.getByText('Please enter a number between 0 and 100', { exact: true })).toBeVisible();
  await expect(cell(page, 'A1')).toHaveText('50');

  await page.reload();
  await cell(page, 'A1').click();
  await formulaBar(page).fill('101');
  await formulaBar(page).press('Enter');
  await expect(page.getByText('Please enter a number between 0 and 100', { exact: true })).toBeVisible();
  await expect(cell(page, 'A1')).toHaveText('50');

  await cell(page, 'A1').click();
  await formulaBar(page).fill('100');
  await formulaBar(page).press('Enter');
  await expect(cell(page, 'A1')).toHaveText('100');
});

test('REQ-5-2-1#3: Reject a value outside the dropdown rule', async ({ page }) => {
  const workbook = `wb${u()}`;
  await f.createWorkbook(page, { name: workbook });
  await f.enterCell(page, 'A1', 'Open');
  await setDropdownValidation(page, 'A1', 'A1', ['Open', 'Closed']);

  await cell(page, 'A1').click();
  await formulaBar(page).fill('Pending');
  await formulaBar(page).press('Enter');
  await expect(page.getByText('Please select one of the following values: Open, Closed', { exact: true })).toBeVisible();
  await expect(cell(page, 'A1')).toHaveText('Open');
  await expect(formulaBar(page)).toHaveValue('Open');

  await page.reload();
  await cell(page, 'A1').click();
  await formulaBar(page).fill('Pending');
  await formulaBar(page).press('Enter');
  await expect(page.getByText('Please select one of the following values: Open, Closed', { exact: true })).toBeVisible();
  await expect(cell(page, 'A1')).toHaveText('Open');
});

test('REQ-5-3-1: Summarize sales by region', async ({ page }) => {
  const workbook = `wb${u()}`;
  await f.createWorkbook(page, { name: workbook });
  await f.enterCells(page, {
    A1: 'Region', B1: 'Sales',
    A2: 'East', B2: 1200,
    A3: 'North', B3: 800,
    A4: 'East', B4: 600,
    A5: 'South', B5: 1000,
    A6: 'North', B6: 700,
  });

  await f.createPivot(page, 'A1', 'B6', {
    rows: ['Region'],
    columns: [],
    values: ['Sales'],
    summarizeBy: 'SUM',
  });

  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('SUM of Sales');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1800');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'B3')).toHaveText('1500');
  await expect(cell(page, 'A4')).toHaveText('South');
  await expect(cell(page, 'B4')).toHaveText('1000');
  await expect(cell(page, 'A5')).toHaveText('Grand Total');
  await expect(cell(page, 'B5')).toHaveText('4300');

  await f.switchToSheet(page, 'Sheet1');
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B1')).toHaveText('Sales');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(cell(page, 'A6')).toHaveText('North');
  await expect(cell(page, 'B6')).toHaveText('700');

  await f.switchToSheet(page, 'Pivot1');
  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1800');
  await expect(cell(page, 'A5')).toHaveText('Grand Total');
  await expect(cell(page, 'B5')).toHaveText('4300');
});

test('REQ-5-3-1#2: Refresh a pivot table after source data changes', async ({ page }) => {
  const workbook = `wb${u()}`;
  await f.createWorkbook(page, { name: workbook });
  await f.enterCells(page, {
    A1: 'Region', B1: 'Sales',
    A2: 'East', B2: 1200,
    A3: 'North', B3: 800,
    A4: 'East', B4: 600,
  });

  await f.createPivot(page, 'A1', 'B4', {
    rows: ['Region'],
    columns: [],
    values: ['Sales'],
    summarizeBy: 'SUM',
  });
  await expect(cell(page, 'B2')).toHaveText('1800');
  await expect(cell(page, 'B3')).toHaveText('800');
  await expect(cell(page, 'B4')).toHaveText('2600');

  await f.switchToSheet(page, 'Sheet1');
  await f.enterCell(page, 'B2', 1500);

  await f.switchToSheet(page, 'Pivot1');
  await expect(cell(page, 'B2')).toHaveText('1800');
  await f.refreshPivot(page);
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('2100');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'B3')).toHaveText('800');
  await expect(cell(page, 'A4')).toHaveText('Grand Total');
  await expect(cell(page, 'B4')).toHaveText('2900');

  await f.switchToSheet(page, 'Sheet1');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'B2')).toHaveText('1500');
  await expect(cell(page, 'A3')).toHaveText('North');
  await expect(cell(page, 'B3')).toHaveText('800');
  await expect(cell(page, 'A4')).toHaveText('East');
  await expect(cell(page, 'B4')).toHaveText('600');

  await f.switchToSheet(page, 'Pivot1');
  await page.reload();
  await expect(cell(page, 'B2')).toHaveText('2100');
  await expect(cell(page, 'B3')).toHaveText('800');
  await expect(cell(page, 'B4')).toHaveText('2900');
});

test('REQ-5-3-1#3: Refresh a pivot table after inserting rows or columns in the source range', async ({ page }) => {
  const workbook = `wb${u()}`;
  await f.createWorkbook(page, { name: workbook });
  await f.enterCells(page, {
    A1: 'Region', B1: 'Sales',
    A2: 'East', B2: 100,
    A3: 'North', B3: 200,
    A4: 'East', B4: 300,
  });

  await f.createPivot(page, 'A1', 'B4', {
    rows: ['Region'],
    columns: [],
    values: ['Sales'],
    summarizeBy: 'SUM',
  });
  await expect(cell(page, 'B2')).toHaveText('400');
  await expect(cell(page, 'B3')).toHaveText('200');
  await expect(cell(page, 'B4')).toHaveText('600');

  await f.switchToSheet(page, 'Sheet1');
  await f.insertRowAbove(page, 3);
  await f.enterCell(page, 'A3', 'East');
  await f.enterCell(page, 'B3', 50);

  await f.switchToSheet(page, 'Pivot1');
  await f.refreshPivot(page);
  await expect(cell(page, 'B2')).toHaveText('450');
  await expect(cell(page, 'B3')).toHaveText('200');
  await expect(cell(page, 'B4')).toHaveText('650');

  await f.switchToSheet(page, 'Sheet1');
  await f.insertColumnLeft(page, 'B');

  await f.switchToSheet(page, 'Pivot1');
  await f.refreshPivot(page);
  await expect(cell(page, 'B2')).toHaveText('450');
  await expect(cell(page, 'B3')).toHaveText('200');
  await expect(cell(page, 'B4')).toHaveText('650');

  await f.switchToSheet(page, 'Sheet1');
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'C1')).toHaveText('Sales');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'C2')).toHaveText('100');
  await expect(cell(page, 'A3')).toHaveText('East');
  await expect(cell(page, 'C3')).toHaveText('50');
  await expect(cell(page, 'A4')).toHaveText('North');
  await expect(cell(page, 'C4')).toHaveText('200');
  await expect(cell(page, 'A5')).toHaveText('East');
  await expect(cell(page, 'C5')).toHaveText('300');

  await f.switchToSheet(page, 'Pivot1');
  await page.reload();
  await expect(cell(page, 'B2')).toHaveText('450');
  await expect(cell(page, 'B3')).toHaveText('200');
  await expect(cell(page, 'B4')).toHaveText('650');
});

test('REQ-5-3-1#4: Preserve the last pivot result when a selected source field is deleted', async ({ page }) => {
  const workbook = `wb${u()}`;
  await f.createWorkbook(page, { name: workbook });
  await f.enterCells(page, {
    A1: 'Region', B1: 'Sales',
    A2: 'East', B2: 400,
    A3: 'North', B3: 200,
  });

  await f.createPivot(page, 'A1', 'B3', {
    rows: ['Region'],
    columns: [],
    values: ['Sales'],
    summarizeBy: 'SUM',
  });
  await expect(cell(page, 'B2')).toHaveText('400');
  await expect(cell(page, 'B3')).toHaveText('200');
  await expect(cell(page, 'B4')).toHaveText('600');

  await f.switchToSheet(page, 'Sheet1');
  await f.deleteColumn(page, 'B');

  await f.switchToSheet(page, 'Pivot1');
  await f.refreshPivot(page);
  await expect(page.getByText('Pivot field is no longer available. Select a new field.', { exact: true })).toBeVisible();
  await expect(cell(page, 'B2')).toHaveText('400');
  await expect(cell(page, 'B3')).toHaveText('200');
  await expect(cell(page, 'B4')).toHaveText('600');

  await f.switchToSheet(page, 'Sheet1');
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'A2')).toHaveText('East');
  await expect(cell(page, 'A3')).toHaveText('North');

  await f.switchToSheet(page, 'Pivot1');
  await page.reload();
  await expect(cell(page, 'B2')).toHaveText('400');
  await expect(cell(page, 'B3')).toHaveText('200');
  await expect(cell(page, 'B4')).toHaveText('600');
});
