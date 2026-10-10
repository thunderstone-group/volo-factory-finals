const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const grid = (page) => page.getByRole('grid', { name: 'Worksheet grid', exact: true });
const cell = (page, coord) => grid(page).getByRole('gridcell', { name: coord, exact: true });
const formulaBar = (page) => page.getByLabel('Formula bar', { exact: true });
const sheetTab = (page, name) => page.getByRole('tab', { name, exact: true });
const dlg = (page, name) => page.getByRole('dialog', { name, exact: true });

async function openSeedWorkbook(page) {
  await page.goto('/');
  const link = page.getByRole('link', { name: 'Q3 Sales', exact: true });
  await expect(link).toBeVisible();
  await link.click();
  await expect(sheetTab(page, 'Sheet1')).toBeVisible();
  await expect(sheetTab(page, 'Sheet2')).toBeVisible();
}

async function gotoSheet(page, name) {
  await sheetTab(page, name).click();
  await expect(sheetTab(page, name)).toHaveAttribute('aria-selected', 'true');
}

async function setCell(page, coord, value) {
  await cell(page, coord).click();
  await formulaBar(page).fill(value);
  await formulaBar(page).press('Enter');
}

async function cellText(page, coord) {
  return ((await cell(page, coord).textContent()) || '').trim();
}

async function selectRange(page, from, to) {
  const a = await cell(page, from).boundingBox();
  const b = await cell(page, to).boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 5 });
  await page.mouse.up();
}

async function nextTabName(page, prefix) {
  const raw = await page.getByRole('tab').evaluateAll((els) =>
    els.map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim()));
  const taken = raw.map((t) => (t.match(new RegExp('^' + prefix + '\\d+')) || [t])[0]);
  let n = 1;
  while (taken.includes(prefix + n)) n += 1;
  return prefix + n;
}

// Adds a worksheet through the documented "Add worksheet" button and returns its name.
async function addWorksheet(page) {
  const name = await nextTabName(page, 'Sheet');
  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
  await expect(sheetTab(page, name)).toBeVisible();
  return name;
}

async function openSheetMenu(page, name, command) {
  await page.getByRole('button', { name: 'Worksheet options for ' + name, exact: true }).click();
  await page.getByRole('menuitem', { name: command, exact: true }).click();
}

async function openDataMenu(page, command) {
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByRole('menuitem', { name: command, exact: true }).click();
}

async function openRowMenu(page, row, command) {
  await page.getByRole('rowheader', { name: String(row), exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: command, exact: true }).click();
}

async function openColumnMenu(page, letter, command) {
  await page.getByRole('columnheader', { name: letter, exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: command, exact: true }).click();
}

/* ------------------------------------------------------------------ */
/* REQ-2-1-1  Add a Worksheet                                          */
/* ------------------------------------------------------------------ */

test('REQ-2-1-1: REQ-2-1-1 -the requested workflow Sheet2,the requested workflow', async ({ page }) => {
  await openSeedWorkbook(page);
  await gotoSheet(page, 'Sheet1');
  const kept = await cellText(page, 'A1');

  const created = await addWorksheet(page);

  await expect(sheetTab(page, created)).toHaveAttribute('aria-selected', 'true');
  await expect(sheetTab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'false');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('');

  // existing worksheets and their data remain unchanged
  await gotoSheet(page, 'Sheet1');
  await expect(cell(page, 'A1')).toHaveText(kept);
});

test('REQ-2-1-1#2: REQ-2-1-1 -the requested workflow SheetN the requested workflow', async ({ page }) => {
  await openSeedWorkbook(page);
  const created = await addWorksheet(page);
  await expect(sheetTab(page, created)).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('');

  await page.reload();
  await expect(sheetTab(page, created)).toBeVisible();
  await expect(sheetTab(page, 'Sheet1')).toBeVisible();
  await expect(sheetTab(page, 'Sheet2')).toBeVisible();

  // reopening from the workbook home page
  await page.goto('/');
  const link = page.getByRole('link', { name: 'Q3 Sales', exact: true });
  await expect(link).toBeVisible();
  await link.click();
  await expect(sheetTab(page, created)).toBeVisible();
});

/* ------------------------------------------------------------------ */
/* REQ-2-1-2  Switch Worksheets                                        */
/* ------------------------------------------------------------------ */

test('REQ-2-1-2: REQ-2-1-2 -the requested workflow, the requested workflow', async ({ page }) => {
  await openSeedWorkbook(page);

  await gotoSheet(page, 'Sheet1');
  await setCell(page, 'A1', 'East');
  await setCell(page, 'B1', '1200');

  await gotoSheet(page, 'Sheet2');
  await setCell(page, 'A1', 'North');
  await setCell(page, 'B1', '800');

  await gotoSheet(page, 'Sheet1');
  await expect(cell(page, 'A1')).toHaveText('East');
  await expect(cell(page, 'B1')).toHaveText('1200');
  await cell(page, 'A1').click();
  await expect(formulaBar(page)).toHaveValue('East');

  await gotoSheet(page, 'Sheet2');
  await expect(cell(page, 'A1')).toHaveText('North');
  await expect(cell(page, 'B1')).toHaveText('800');
  await cell(page, 'A1').click();
  await expect(formulaBar(page)).toHaveValue('North');

  await page.reload();
  await expect(sheetTab(page, 'Sheet2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('North');
});

test('REQ-2-1-2#2: REQ-2-1-2 -the requested workflow', async ({ page }) => {
  await openSeedWorkbook(page);

  await gotoSheet(page, 'Sheet1');
  await setCell(page, 'A1', '2');
  await setCell(page, 'B1', '3');
  await setCell(page, 'C1', '=A1+B1');
  await expect(cell(page, 'C1')).toHaveText('5');
  await cell(page, 'C1').click();
  await expect(formulaBar(page)).toHaveValue('=A1+B1');

  await gotoSheet(page, 'Sheet2');
  await setCell(page, 'A1', '=1+2');
  await expect(cell(page, 'A1')).toHaveText('3');
  await cell(page, 'A1').click();
  await expect(formulaBar(page)).toHaveValue('=1+2');

  await gotoSheet(page, 'Sheet1');
  await cell(page, 'C1').click();
  await expect(formulaBar(page)).toHaveValue('=A1+B1');
  await expect(cell(page, 'C1')).toHaveText('5');
});

test('REQ-2-1-2#3: REQ-2-1-2 -the requested workflow', async ({ page }) => {
  await openSeedWorkbook(page);

  await gotoSheet(page, 'Sheet1');
  await cell(page, 'B2').click();
  await expect(cell(page, 'B2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'false');

  // a worksheet opened for the first time with no selection history selects A1
  const fresh = await addWorksheet(page);
  await expect(sheetTab(page, fresh)).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');

  await gotoSheet(page, 'Sheet2');
  await cell(page, 'C3').click();
  await expect(cell(page, 'C3')).toHaveAttribute('aria-selected', 'true');

  await gotoSheet(page, 'Sheet1');
  await expect(cell(page, 'B2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'false');

  await gotoSheet(page, 'Sheet2');
  await expect(cell(page, 'C3')).toHaveAttribute('aria-selected', 'true');

  await gotoSheet(page, fresh);
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
});

test('REQ-2-1-2#4: REQ-2-1-2 -the requested workflow', async ({ page }) => {
  await openSeedWorkbook(page);

  await gotoSheet(page, 'Sheet2');
  await cell(page, 'B2').click();
  await expect(cell(page, 'B2')).toHaveAttribute('aria-selected', 'true');

  await page.reload();
  await expect(sheetTab(page, 'Sheet2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'B2')).toHaveAttribute('aria-selected', 'true');

  await page.goto('/');
  const link = page.getByRole('link', { name: 'Q3 Sales', exact: true });
  await expect(link).toBeVisible();
  await link.click();
  await expect(sheetTab(page, 'Sheet2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'B2')).toHaveAttribute('aria-selected', 'true');
});

test('REQ-2-1-2#5: REQ-2-1-2 -the requested workflow', async ({ page }) => {
  await openSeedWorkbook(page);

  await gotoSheet(page, 'Sheet2');
  await setCell(page, 'A1', 'North');
  await setCell(page, 'B1', '800');

  await gotoSheet(page, 'Sheet1');
  await setCell(page, 'A1', 'Region');
  await setCell(page, 'B1', 'Sales');
  await setCell(page, 'A2', 'East');
  await setCell(page, 'B2', '1200');
  await selectRange(page, 'A1', 'B2');
  await expect(cell(page, 'B2')).toHaveAttribute('aria-selected', 'true');
  await openDataMenu(page, 'Create filter');
  await expect(page.getByRole('button', { name: 'Filter Region', exact: true })).toBeVisible();

  // switching shows the target worksheet's own state and no filter buttons of the source
  await gotoSheet(page, 'Sheet2');
  await expect(cell(page, 'A1')).toHaveText('North');
  await expect(cell(page, 'B1')).toHaveText('800');
  await expect(page.getByRole('button', { name: 'Filter Region', exact: true })).toHaveCount(0);

  // the source worksheet was not modified by switching
  await gotoSheet(page, 'Sheet1');
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(page.getByRole('button', { name: 'Filter Region', exact: true })).toBeVisible();

  await openDataMenu(page, 'Clear filter');
  await expect(page.getByRole('button', { name: 'Filter Region', exact: true })).toHaveCount(0);
});

/* ------------------------------------------------------------------ */
/* REQ-2-1-3  Rename a Worksheet                                       */
/* ------------------------------------------------------------------ */

test('REQ-2-1-3: REQ-2-1-3 -the requested workflow,the requested workflow', async ({ page }) => {
  await openSeedWorkbook(page);
  const target = await addWorksheet(page);

  await openSheetMenu(page, target, 'Rename');
  const renameDialog = dlg(page, 'Rename worksheet');
  await expect(renameDialog).toBeVisible();
  await expect(renameDialog.getByLabel('Worksheet name', { exact: true })).toHaveValue(target);

  const newName = 'Data' + u();
  await renameDialog.getByLabel('Worksheet name', { exact: true }).fill('  ' + newName + '  ');
  await renameDialog.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(sheetTab(page, newName)).toBeVisible();
  await expect(sheetTab(page, target)).toHaveCount(0);

  await page.reload();
  await expect(sheetTab(page, newName)).toBeVisible();
});

test('REQ-2-1-3#2: REQ-2-1-3 -the requested workflow,the requested workflow', async ({ page }) => {
  await openSeedWorkbook(page);
  const target = await addWorksheet(page);

  await openSheetMenu(page, target, 'Rename');
  const renameDialog = dlg(page, 'Rename worksheet');
  await expect(renameDialog).toBeVisible();
  await renameDialog.getByLabel('Worksheet name', { exact: true }).fill('   ');
  await renameDialog.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText('Worksheet name cannot be empty', { exact: true })).toBeVisible();
  await expect(sheetTab(page, target)).toBeVisible();
});

test('REQ-2-1-3#3: REQ-2-1-3 -the requested workflow,the requested workflow', async ({ page }) => {
  await openSeedWorkbook(page);
  const target = await addWorksheet(page);

  await openSheetMenu(page, target, 'Rename');
  const renameDialog = dlg(page, 'Rename worksheet');
  await expect(renameDialog).toBeVisible();
  await renameDialog.getByLabel('Worksheet name', { exact: true }).fill('Sheet1');
  await renameDialog.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText('Worksheet name already exists', { exact: true })).toBeVisible();
  await expect(sheetTab(page, target)).toBeVisible();
  await expect(sheetTab(page, 'Sheet1')).toBeVisible();
});

/* ------------------------------------------------------------------ */
/* REQ-2-1-4  Delete a Worksheet                                       */
/* ------------------------------------------------------------------ */

test('REQ-2-1-4: REQ-2-1-4 -the requested workflow,the requested workflow', async ({ page }) => {
  await openSeedWorkbook(page);
  const target = await addWorksheet(page);

  await openSheetMenu(page, target, 'Delete');
  const deleteDialog = dlg(page, 'Delete worksheet');
  await expect(deleteDialog).toBeVisible();
  await expect(deleteDialog).toContainText(target);
  await deleteDialog.getByRole('button', { name: 'Delete worksheet', exact: true }).click();

  await expect(sheetTab(page, target)).toHaveCount(0);
  await expect(page.getByRole('tab', { selected: true })).toHaveCount(1);

  await page.reload();
  await expect(sheetTab(page, target)).toHaveCount(0);
});

test('REQ-2-1-4#2: REQ-2-1-4 -the requested workflow,the requested workflow', async ({ page }) => {
  await openSeedWorkbook(page);

  await gotoSheet(page, 'Sheet1');
  await setCell(page, 'A1', 'Region');
  await setCell(page, 'B1', 'Sales');
  await setCell(page, 'A2', 'East');
  await setCell(page, 'B2', '1200');
  await selectRange(page, 'A1', 'B2');
  await expect(cell(page, 'B2')).toHaveAttribute('aria-selected', 'true');

  const pivot = await nextTabName(page, 'Pivot');
  await openDataMenu(page, 'Create pivot table');
  const pivotDialog = dlg(page, 'Create pivot table');
  await expect(pivotDialog).toBeVisible();
  await expect(pivotDialog).toContainText('Source range: A1:B2');
  await pivotDialog.getByRole('radio', { name: 'New worksheet', exact: true }).check();
  await pivotDialog.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(sheetTab(page, pivot)).toBeVisible();

  // the source worksheet of an existing pivot table cannot be deleted
  await gotoSheet(page, 'Sheet1');
  await openSheetMenu(page, 'Sheet1', 'Delete');
  const deleteDialog = dlg(page, 'Delete worksheet');
  await expect(deleteDialog).toBeVisible();
  await deleteDialog.getByRole('button', { name: 'Delete worksheet', exact: true }).click();
  await expect(page.getByText('Please delete or rebuild dependent pivot tables first', { exact: true })).toBeVisible();
  await expect(deleteDialog).toHaveCount(0);
  await expect(sheetTab(page, 'Sheet1')).toBeVisible();
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'B2')).toHaveText('1200');
  await expect(sheetTab(page, pivot)).toBeVisible();

  // after the pivot-result worksheet is deleted the source is no longer constrained
  await openSheetMenu(page, pivot, 'Delete');
  await dlg(page, 'Delete worksheet').getByRole('button', { name: 'Delete worksheet', exact: true }).click();
  await expect(sheetTab(page, pivot)).toHaveCount(0);

  await gotoSheet(page, 'Sheet1');
  await openSheetMenu(page, 'Sheet1', 'Delete');
  await expect(dlg(page, 'Delete worksheet')).toBeVisible();
});

test('REQ-2-1-4#3: REQ-2-1-4 -the requested workflow,the requested workflow', async ({ page }) => {
  // a workbook with a single worksheet is created so that the last-worksheet rule can be exercised
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Q3 Sales', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();

  await expect(sheetTab(page, 'Sheet1')).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(1);

  await openSheetMenu(page, 'Sheet1', 'Delete');
  await expect(dlg(page, 'Delete worksheet')).toHaveCount(0);
  await expect(page.getByText('A workbook must contain at least one worksheet', { exact: true })).toBeVisible();
  await expect(sheetTab(page, 'Sheet1')).toBeVisible();
});

test('REQ-2-1-4#4: REQ-2-1-4 -the requested workflow', async ({ page }) => {
  await openSeedWorkbook(page);
  await gotoSheet(page, 'Sheet1');
  const kept = await cellText(page, 'A1');

  const target = await addWorksheet(page);
  await setCell(page, 'A1', 'Temp' + u());
  await setCell(page, 'B1', '5');
  await setCell(page, 'C1', '=B1*2');
  await expect(cell(page, 'C1')).toHaveText('10');

  await openSheetMenu(page, target, 'Delete');
  await dlg(page, 'Delete worksheet').getByRole('button', { name: 'Delete worksheet', exact: true }).click();
  await expect(sheetTab(page, target)).toHaveCount(0);
  await expect(sheetTab(page, 'Sheet1')).toBeVisible();

  await page.reload();
  await expect(sheetTab(page, target)).toHaveCount(0);

  await gotoSheet(page, 'Sheet1');
  await expect(cell(page, 'A1')).toHaveText(kept);
});

/* ------------------------------------------------------------------ */
/* REQ-2-2-1  Insert and Delete Rows                                   */
/* ------------------------------------------------------------------ */

test('REQ-2-2-1: REQ-2-2-1 -the requested workflow 3 the requested workflow,the requested workflow', async ({ page }) => {
  await openSeedWorkbook(page);
  await gotoSheet(page, 'Sheet1');
  await setCell(page, 'A1', 'East');
  await setCell(page, 'B1', '1200');
  await setCell(page, 'A2', 'North');
  await setCell(page, 'B2', '800');
  await setCell(page, 'A3', 'South');
  await setCell(page, 'B3', '700');

  await openRowMenu(page, 3, 'Insert 1 row above');

  await expect(cell(page, 'A1')).toHaveText('East');
  await expect(cell(page, 'A2')).toHaveText('North');
  await expect(cell(page, 'A3')).toHaveText('');
  await expect(cell(page, 'A4')).toHaveText('South');
  await expect(cell(page, 'B4')).toHaveText('700');

  await page.reload();
  await expect(cell(page, 'A4')).toHaveText('South');

  await openRowMenu(page, 3, 'Delete row');
  await expect(cell(page, 'A3')).toHaveText('South');
});

test('REQ-2-2-1#2: REQ-2-2-1 -the requested workflow 3 the requested workflow,the requested workflow', async ({ page }) => {
  await openSeedWorkbook(page);
  await gotoSheet(page, 'Sheet1');
  await setCell(page, 'A1', 'East');
  await setCell(page, 'B1', '1200');
  await setCell(page, 'A2', 'North');
  await setCell(page, 'B2', '800');
  await setCell(page, 'A3', 'South');
  await setCell(page, 'B3', '700');

  await openRowMenu(page, 2, 'Insert 1 row below');

  await expect(cell(page, 'A1')).toHaveText('East');
  await expect(cell(page, 'A2')).toHaveText('North');
  await expect(cell(page, 'A3')).toHaveText('');
  await expect(cell(page, 'A4')).toHaveText('South');
  await expect(cell(page, 'B4')).toHaveText('700');

  await page.reload();
  await expect(cell(page, 'A4')).toHaveText('South');

  await openRowMenu(page, 3, 'Delete row');
  await expect(cell(page, 'A3')).toHaveText('South');
});

test('REQ-2-2-1#3: REQ-2-2-1 -the requested workflow', async ({ page }) => {
  await openSeedWorkbook(page);
  await gotoSheet(page, 'Sheet1');
  await setCell(page, 'A1', 'East');
  await setCell(page, 'B1', '1200');
  await setCell(page, 'A2', 'North');
  await setCell(page, 'B2', '800');
  await setCell(page, 'A3', 'South');
  await setCell(page, 'B3', '700');

  await openRowMenu(page, 2, 'Delete row');

  await expect(cell(page, 'A1')).toHaveText('East');
  await expect(cell(page, 'A2')).toHaveText('South');
  await expect(cell(page, 'B2')).toHaveText('700');
  await expect(cell(page, 'A3')).toHaveText('');

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('South');

  await openRowMenu(page, 2, 'Insert 1 row above');
  await setCell(page, 'A2', 'North');
  await setCell(page, 'B2', '800');
  await expect(cell(page, 'A3')).toHaveText('South');
});

test('REQ-2-2-1#4: REQ-2-2-1 -the requested workflow', async ({ page }) => {
  await openSeedWorkbook(page);
  await gotoSheet(page, 'Sheet1');
  await setCell(page, 'A1', '2');
  await setCell(page, 'B1', '3');
  await setCell(page, 'C1', '=A1+B1');
  await expect(cell(page, 'C1')).toHaveText('5');

  await gotoSheet(page, 'Sheet2');
  await setCell(page, 'A1', '10');
  await setCell(page, 'B1', '20');
  await setCell(page, 'C1', '=A1+B1');
  await expect(cell(page, 'C1')).toHaveText('30');

  await gotoSheet(page, 'Sheet1');
  await openRowMenu(page, 1, 'Insert 1 row above');
  await expect(cell(page, 'A2')).toHaveText('2');
  await expect(cell(page, 'C2')).toHaveText('5');
  await cell(page, 'C2').click();
  await expect(formulaBar(page)).toHaveValue('=A2+B2');

  // formulas in another worksheet that do not reference these cells remain unchanged
  await gotoSheet(page, 'Sheet2');
  await expect(cell(page, 'C1')).toHaveText('30');

  await gotoSheet(page, 'Sheet1');
  await page.reload();
  await expect(cell(page, 'C2')).toHaveText('5');
  await cell(page, 'C2').click();
  await expect(formulaBar(page)).toHaveValue('=A2+B2');

  await openRowMenu(page, 1, 'Delete row');
  await expect(cell(page, 'C1')).toHaveText('5');
});

test('REQ-2-2-1#5: REQ-2-2-1 -the requested workflow', async ({ page }) => {
  await openSeedWorkbook(page);
  await gotoSheet(page, 'Sheet1');
  await setCell(page, 'B1', '50');
  await setCell(page, 'B2', '60');

  await selectRange(page, 'B1', 'B2');
  await expect(cell(page, 'B2')).toHaveAttribute('aria-selected', 'true');
  await openDataMenu(page, 'Data validation');
  const ruleDialog = dlg(page, 'Data validation');
  await expect(ruleDialog).toBeVisible();
  await ruleDialog.getByLabel('Rule type', { exact: true }).click();
  await page.getByRole('option', { name: 'Number range', exact: true }).click();
  await ruleDialog.getByLabel('Minimum', { exact: true }).fill('0');
  await ruleDialog.getByLabel('Maximum', { exact: true }).fill('100');
  await ruleDialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(ruleDialog).toHaveCount(0);

  // the rule moves with its cells when a row is inserted above
  await openRowMenu(page, 1, 'Insert 1 row above');
  await expect(cell(page, 'B2')).toHaveText('50');

  await setCell(page, 'B2', '101');
  await expect(page.getByText('Please enter a number from 0 to 100', { exact: true })).toBeVisible();

  // restore the worksheet structure and remove the rule
  await openRowMenu(page, 1, 'Delete row');
  await selectRange(page, 'B1', 'B2');
  await openDataMenu(page, 'Data validation');
  const ruleDialog2 = dlg(page, 'Data validation');
  await expect(ruleDialog2).toBeVisible();
  await ruleDialog2.getByRole('button', { name: 'Delete rule', exact: true }).click();
});

/* ------------------------------------------------------------------ */
/* REQ-2-2-2  Insert and Delete Columns                                */
/* ------------------------------------------------------------------ */

test('REQ-2-2-2: REQ-2-2-2 -the requested workflow B the requested workflow,the requested workflow', async ({ page }) => {
  await openSeedWorkbook(page);
  await gotoSheet(page, 'Sheet1');
  await setCell(page, 'A1', 'East');
  await setCell(page, 'B1', '1200');
  await setCell(page, 'C1', 'Open');

  await openColumnMenu(page, 'B', 'Insert 1 column left');

  await expect(cell(page, 'A1')).toHaveText('East');
  await expect(cell(page, 'B1')).toHaveText('');
  await expect(cell(page, 'C1')).toHaveText('1200');
  await expect(cell(page, 'D1')).toHaveText('Open');

  await page.reload();
  await expect(cell(page, 'C1')).toHaveText('1200');

  await openColumnMenu(page, 'B', 'Delete column');
  await expect(cell(page, 'B1')).toHaveText('1200');
});

test('REQ-2-2-2#2: REQ-2-2-2 -the requested workflow B the requested workflow,the requested workflow', async ({ page }) => {
  await openSeedWorkbook(page);
  await gotoSheet(page, 'Sheet1');
  await setCell(page, 'A1', '2');
  await setCell(page, 'B1', '3');
  await setCell(page, 'C1', '=A1+B1');
  await expect(cell(page, 'C1')).toHaveText('5');

  await openColumnMenu(page, 'A', 'Insert 1 column right');

  await expect(cell(page, 'A1')).toHaveText('2');
  await expect(cell(page, 'B1')).toHaveText('');
  await expect(cell(page, 'C1')).toHaveText('3');
  await expect(cell(page, 'D1')).toHaveText('5');
  await cell(page, 'D1').click();
  await expect(formulaBar(page)).toHaveValue('=B1+C1');

  await page.reload();
  await expect(cell(page, 'D1')).toHaveText('5');
  await cell(page, 'D1').click();
  await expect(formulaBar(page)).toHaveValue('=B1+C1');

  await openColumnMenu(page, 'B', 'Delete column');
  await expect(cell(page, 'C1')).toHaveText('5');
});

test('REQ-2-2-2#3: REQ-2-2-2 -the requested workflow', async ({ page }) => {
  await openSeedWorkbook(page);
  await gotoSheet(page, 'Sheet1');
  await setCell(page, 'A1', 'East');
  await setCell(page, 'B1', '1200');
  await setCell(page, 'C1', 'Open');

  await openColumnMenu(page, 'B', 'Delete column');

  await expect(cell(page, 'A1')).toHaveText('East');
  await expect(cell(page, 'B1')).toHaveText('Open');
  await expect(cell(page, 'C1')).toHaveText('');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('East');
  await expect(cell(page, 'B1')).toHaveText('Open');

  await openColumnMenu(page, 'B', 'Insert 1 column left');
  await setCell(page, 'B1', '1200');
  await expect(cell(page, 'C1')).toHaveText('Open');
});

test('REQ-2-2-2#4: REQ-2-2-2 -the requested workflow', async ({ page }) => {
  await openSeedWorkbook(page);
  await gotoSheet(page, 'Sheet1');
  await setCell(page, 'A1', '2');
  await setCell(page, 'B1', '3');
  await setCell(page, 'C1', '=A1+B1');
  await expect(cell(page, 'C1')).toHaveText('5');

  await openColumnMenu(page, 'A', 'Delete column');

  await expect(cell(page, 'A1')).toHaveText('3');
  await expect(cell(page, 'B1')).toHaveText('#REF!');

  await page.reload();
  await expect(cell(page, 'B1')).toHaveText('#REF!');

  await openColumnMenu(page, 'A', 'Insert 1 column left');
  await setCell(page, 'A1', '2');
  await expect(cell(page, 'C1')).toHaveText('#REF!');
});

test('REQ-2-2-2#5: REQ-2-2-2 -the requested workflow', async ({ page }) => {
  await openSeedWorkbook(page);
  await gotoSheet(page, 'Sheet1');
  await setCell(page, 'B1', '50');
  await setCell(page, 'B2', '60');

  await selectRange(page, 'B1', 'B2');
  await expect(cell(page, 'B2')).toHaveAttribute('aria-selected', 'true');
  await openDataMenu(page, 'Data validation');
  const ruleDialog = dlg(page, 'Data validation');
  await expect(ruleDialog).toBeVisible();
  await ruleDialog.getByLabel('Rule type', { exact: true }).click();
  await page.getByRole('option', { name: 'Number range', exact: true }).click();
  await ruleDialog.getByLabel('Minimum', { exact: true }).fill('0');
  await ruleDialog.getByLabel('Maximum', { exact: true }).fill('100');
  await ruleDialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(ruleDialog).toHaveCount(0);

  // the rule moves with its cells when a column is inserted to the left
  await openColumnMenu(page, 'A', 'Insert 1 column left');
  await expect(cell(page, 'C1')).toHaveText('50');

  await setCell(page, 'C1', '101');
  await expect(page.getByText('Please enter a number from 0 to 100', { exact: true })).toBeVisible();

  // restore the worksheet structure and remove the rule
  await openColumnMenu(page, 'A', 'Delete column');
  await selectRange(page, 'B1', 'B2');
  await openDataMenu(page, 'Data validation');
  const ruleDialog2 = dlg(page, 'Data validation');
  await expect(ruleDialog2).toBeVisible();
  await ruleDialog2.getByRole('button', { name: 'Delete rule', exact: true }).click();
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

