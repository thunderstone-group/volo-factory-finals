// Acceptance tests for REQ-2: Worksheets and Table Structure.
// The application is never reset between tests, so every scenario opens the seeded
// workbook `Q3 Sales` from the home page and builds the worksheets it needs through
// the documented worksheet flows (Add worksheet / worksheet tab menu).

const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const grid = (page) => page.getByRole('grid', { name: 'Worksheet grid', exact: true });
const cell = (page, coord) => grid(page).getByRole('gridcell', { name: coord, exact: true });
const rowHead = (page, n) => grid(page).getByRole('rowheader', { name: String(n), exact: true });
const colHead = (page, l) => grid(page).getByRole('columnheader', { name: l, exact: true });
const formulaBar = (page) => page.getByLabel('Formula bar', { exact: true });

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// A worksheet tab is perceived by the worksheet name it displays.
const tab = (page, name) => page.getByRole('tab', { name: new RegExp(`^${escapeRe(name)}(\\s|$)`) });

async function openWorkbook(page, name) {
  await page.goto('/');
  const link = page.getByRole('link', { name, exact: true });
  await expect(link).toBeVisible();
  await link.click();
  await expect(grid(page)).toBeVisible();
}

async function openQ3Sales(page) {
  await openWorkbook(page, 'Q3 Sales');
}

async function usedNumbers(page, prefix) {
  const texts = await page.getByRole('tab').allTextContents();
  const joined = texts.join(' ');
  const nums = new Set();
  for (const m of joined.matchAll(new RegExp(`${prefix}(\\d+)`, 'g'))) nums.add(Number(m[1]));
  return nums;
}

// "The new tab uses the first unused SheetN name in positive-integer order".
async function nextSheetName(page) {
  const used = await usedNumbers(page, 'Sheet');
  let n = 1;
  while (used.has(n)) n += 1;
  return `Sheet${n}`;
}

async function nextPrefixedName(page, prefix) {
  const used = await usedNumbers(page, prefix);
  let n = 1;
  while (used.has(n)) n += 1;
  return `${prefix}${n}`;
}

// Creates a worksheet with the button "Add worksheet" and returns its tab name.
async function addSheet(page) {
  const name = await nextSheetName(page);
  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
  await expect(tab(page, name)).toBeVisible();
  await expect(tab(page, name)).toHaveAttribute('aria-selected', 'true');
  return name;
}

async function selectSheet(page, name) {
  await tab(page, name).click();
  await expect(tab(page, name)).toHaveAttribute('aria-selected', 'true');
}

async function openSheetMenu(page, name) {
  await page.getByRole('button', { name: `Worksheet options for ${name}`, exact: true }).click();
}

// Commits a value into a cell through the inline grid editor.
async function typeCell(page, coord, value) {
  await cell(page, coord).dblclick();
  const editor = page.getByRole('textbox', { name: `Edit ${coord}`, exact: true });
  await editor.fill(value);
  await page.keyboard.press('Enter');
}

// Fills a rectangle by pasting external clipboard content at the starting cell.
async function pasteAt(page, coord, text) {
  await cell(page, coord).click();
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
  await page.keyboard.press('Control+V');
}

async function dragRange(page, from, to) {
  const a = await cell(page, from).boundingBox();
  const b = await cell(page, to).boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
}

async function sheetWithRows(page) {
  const name = await addSheet(page);
  await pasteAt(page, 'A1', 'East\t1200\nNorth\t800\nSouth\t700\nWest\t900');
  await expect(cell(page, 'A1')).toHaveText('East');
  await expect(cell(page, 'A4')).toHaveText('West');
  return name;
}

async function sheetWithCols(page) {
  const name = await addSheet(page);
  await pasteAt(page, 'A1', 'East\t1200\tOpen\nNorth\t800\tClosed');
  await expect(cell(page, 'A1')).toHaveText('East');
  await expect(cell(page, 'C1')).toHaveText('Open');
  return name;
}

/* ------------------------------------------------------------------ REQ-2-1-1 */

test('REQ-2-1-1: REQ-2-1-1 -the requested workflow Sheet2,the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  const countBefore = await page.getByRole('tab').count();
  const name = await nextSheetName(page);
  await expect(tab(page, name)).toHaveCount(0);

  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();

  // The new tab uses the first unused SheetN name and becomes active.
  await expect(tab(page, name)).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(countBefore + 1);
  await expect(tab(page, name)).toHaveAttribute('aria-selected', 'true');
  // A1 is selected and the new worksheet is blank.
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('');
  await expect(formulaBar(page)).toHaveValue('');

  // The new tab still exists after refresh.
  await page.reload();
  await expect(tab(page, name)).toBeVisible();
  await expect(tab(page, name)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab')).toHaveCount(countBefore + 1);
});

test('REQ-2-1-1#2: REQ-2-1-1 -the requested workflow SheetN the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  const first = await addSheet(page);
  const marker = `keep-${u()}`;
  await typeCell(page, 'A1', marker);
  await expect(cell(page, 'A1')).toHaveText(marker);

  // The next added worksheet takes the next unused SheetN name.
  const second = await nextSheetName(page);
  expect(second).not.toBe(first);
  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
  await expect(tab(page, second)).toBeVisible();
  await expect(tab(page, second)).toHaveAttribute('aria-selected', 'true');

  // Existing worksheets and their data remain unchanged.
  await expect(tab(page, first)).toBeVisible();
  await selectSheet(page, first);
  await expect(cell(page, 'A1')).toHaveText(marker);

  await page.reload();
  await expect(tab(page, second)).toBeVisible();
  await expect(cell(page, 'A1')).toHaveText(marker);
});

/* ------------------------------------------------------------------ REQ-2-1-2 */

test('REQ-2-1-2: REQ-2-1-2 -the requested workflow, the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  const n1 = await addSheet(page);
  const v1 = `one-${u()}`;
  await typeCell(page, 'A1', v1);

  const n2 = await addSheet(page);
  const v2 = `two-${u()}`;
  await typeCell(page, 'A1', v2);
  await expect(cell(page, 'A1')).toHaveText(v2);

  // Clicking another tab switches the grid to that worksheet's state.
  await selectSheet(page, n1);
  await expect(cell(page, 'A1')).toHaveText(v1);
  await selectSheet(page, n2);
  await expect(cell(page, 'A1')).toHaveText(v2);

  await page.reload();
  await expect(tab(page, n2)).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText(v2);
});

test('REQ-2-1-2#2: REQ-2-1-2 -the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  const n1 = await addSheet(page);
  await typeCell(page, 'A1', '5');
  await typeCell(page, 'B1', '=A1+1');

  await cell(page, 'A1').click();
  await expect(formulaBar(page)).toHaveValue('5');
  await cell(page, 'B1').click();
  await expect(cell(page, 'B1')).toHaveText('6');
  await expect(formulaBar(page)).toHaveValue('=A1+1');

  const n2 = await addSheet(page);
  await expect(formulaBar(page)).toHaveValue('');

  await selectSheet(page, n1);
  await cell(page, 'B1').click();
  await expect(formulaBar(page)).toHaveValue('=A1+1');
  await expect(cell(page, 'B1')).toHaveText('6');

  await page.reload();
  await cell(page, 'B1').click();
  await expect(formulaBar(page)).toHaveValue('=A1+1');
  await expect(cell(page, 'B1')).toHaveText('6');
});

test('REQ-2-1-2#3: REQ-2-1-2 -the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  const n1 = await addSheet(page);
  // A worksheet opened for the first time with no selection history selects A1.
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');

  await cell(page, 'A3').click();
  await expect(cell(page, 'A3')).toHaveAttribute('aria-selected', 'true');

  const n2 = await addSheet(page);
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');

  // Each worksheet restores its own last confirmed selected cell.
  await selectSheet(page, n1);
  await expect(cell(page, 'A3')).toHaveAttribute('aria-selected', 'true');
  await selectSheet(page, n2);
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');

  await selectSheet(page, n1);
  await page.reload();
  await expect(tab(page, n1)).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A3')).toHaveAttribute('aria-selected', 'true');
});

test('REQ-2-1-2#4: REQ-2-1-2 -the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  const n1 = await addSheet(page);
  const marker = `src-${u()}`;
  await typeCell(page, 'A1', marker);
  await cell(page, 'A1').click();
  await expect(formulaBar(page)).toHaveValue(marker);

  // Switching away and back must not modify the source worksheet.
  const n2 = await addSheet(page);
  await typeCell(page, 'A1', `other-${u()}`);
  await selectSheet(page, n1);
  await expect(cell(page, 'A1')).toHaveText(marker);
  await expect(formulaBar(page)).toHaveValue(marker);

  await selectSheet(page, n2);
  await selectSheet(page, n1);
  await expect(cell(page, 'A1')).toHaveText(marker);

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText(marker);
});

test('REQ-2-1-2#5: REQ-2-1-2 -the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  const n1 = await addSheet(page);
  const n2 = await addSheet(page);
  await selectSheet(page, n1);

  await page.reload();
  await expect(tab(page, n1)).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page, n2)).toBeVisible();

  // Reopening from the application entry point shows the last active tab again.
  await page.goto('/');
  const link = page.getByRole('link', { name: 'Q3 Sales', exact: true });
  await expect(link).toBeVisible();
  await link.click();
  await expect(grid(page)).toBeVisible();
  await expect(tab(page, n1)).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page, n2)).toBeVisible();
});

/* ------------------------------------------------------------------ REQ-2-1-3 */

test('REQ-2-1-3: REQ-2-1-3 -the requested workflow,the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  const n1 = await addSheet(page);

  await openSheetMenu(page, n1);
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Rename worksheet', exact: true });
  await expect(dialog).toBeVisible();

  const input = dialog.getByLabel('Worksheet name', { exact: true });
  await expect(input).toHaveValue(n1);

  const newName = `Data ${u()}`;
  await input.fill(newName);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(tab(page, newName)).toBeVisible();
  await expect(tab(page, n1)).toHaveCount(0);

  await page.reload();
  await expect(tab(page, newName)).toBeVisible();
  await expect(tab(page, n1)).toHaveCount(0);
});

test('REQ-2-1-3#2: REQ-2-1-3 -the requested workflow,the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  const n1 = await addSheet(page);

  await openSheetMenu(page, n1);
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Rename worksheet', exact: true });
  await expect(dialog).toBeVisible();

  // Empty after trimming leading and trailing spaces is rejected.
  await dialog.getByLabel('Worksheet name', { exact: true }).fill('   ');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText('Worksheet name cannot be empty', { exact: true })).toBeVisible();
  await expect(tab(page, n1)).toBeVisible();
  await expect(cell(page, 'A1')).toBeVisible();
});

test('REQ-2-1-3#3: REQ-2-1-3 -the requested workflow,the requested workflow', async ({ page }) => {
  await openQ3Sales(page);

  const n1 = await addSheet(page);
  const nameA = `Data ${u()}`;
  await openSheetMenu(page, n1);
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Rename worksheet', exact: true });
  await dialog.getByLabel('Worksheet name', { exact: true }).fill(nameA);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(tab(page, nameA)).toBeVisible();

  const n2 = await addSheet(page);
  await openSheetMenu(page, n2);
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Rename worksheet', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Worksheet name', { exact: true }).fill(nameA);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();

  // A duplicate name within the same workbook is rejected.
  await expect(page.getByText('Worksheet name already exists', { exact: true })).toBeVisible();
  await expect(tab(page, n2)).toBeVisible();
  await expect(tab(page, nameA)).toBeVisible();
});

/* ------------------------------------------------------------------ REQ-2-1-4 */

test('REQ-2-1-4: REQ-2-1-4 -the requested workflow,the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  const target = await addSheet(page);
  await typeCell(page, 'A1', `del-${u()}`);
  const countBefore = await page.getByRole('tab').count();

  await openSheetMenu(page, target);
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete worksheet', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(target);
  await dialog.getByRole('button', { name: 'Delete worksheet', exact: true }).click();

  await expect(tab(page, target)).toHaveCount(0);
  await expect(page.getByRole('tab')).toHaveCount(countBefore - 1);
  // An adjacent worksheet becomes active.
  await expect(page.getByRole('tab', { selected: true })).toHaveCount(1);

  await page.reload();
  await expect(tab(page, target)).toHaveCount(0);
});

test('REQ-2-1-4#2: REQ-2-1-4 -the requested workflow,the requested workflow', async ({ page }) => {
  // Deleting the only worksheet must be refused, so a workbook that holds exactly one
  // worksheet is created through the documented "New blank workbook" creation flow.
  await page.goto('/');
  const create = page.getByRole('button', { name: 'New blank workbook', exact: true });
  await expect(create).toBeVisible();
  await create.click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(grid(page)).toBeVisible();
  await expect(tab(page, 'Sheet1')).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(1);

  await openSheetMenu(page, 'Sheet1');
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();

  await expect(page.getByText('A workbook must contain at least one worksheet', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Delete worksheet', exact: true })).toHaveCount(0);
  await expect(tab(page, 'Sheet1')).toBeVisible();
  await expect(grid(page)).toBeVisible();
});

test('REQ-2-1-4#3: REQ-2-1-4 -the requested workflow,the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  const source = await addSheet(page);
  await pasteAt(page, 'A1', 'Region\tSales\nEast\t1200\nNorth\t800');
  await expect(cell(page, 'A1')).toHaveText('Region');

  await dragRange(page, 'A1', 'B3');
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Create pivot table', exact: true }).click();
  const pivotDialog = page.getByRole('dialog', { name: 'Create pivot table', exact: true });
  await expect(pivotDialog).toBeVisible();
  await expect(pivotDialog).toContainText('Source range: A1:B3');
  await pivotDialog.getByRole('radio', { name: 'New worksheet', exact: true }).check();
  const pivotName = await nextPrefixedName(page, 'Pivot');
  await pivotDialog.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(tab(page, pivotName)).toBeVisible();

  // The source worksheet of an existing pivot table cannot be deleted.
  await selectSheet(page, source);
  await openSheetMenu(page, source);
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete worksheet', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Delete worksheet', exact: true }).click();

  await expect(
    page.getByText('Please delete or rebuild dependent pivot tables first', { exact: true })
  ).toBeVisible();
  await expect(tab(page, source)).toBeVisible();
  await expect(tab(page, pivotName)).toBeVisible();
  await expect(cell(page, 'A1')).toHaveText('Region');
});

test('REQ-2-1-4#4: REQ-2-1-4 -the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  const keep = await addSheet(page);
  const keepValue = `keep-${u()}`;
  await typeCell(page, 'A1', keepValue);

  const gone = await addSheet(page);
  await typeCell(page, 'A1', `gone-${u()}`);

  await openSheetMenu(page, gone);
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete worksheet', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(gone);
  await dialog.getByRole('button', { name: 'Delete worksheet', exact: true }).click();

  await expect(tab(page, gone)).toHaveCount(0);
  // Other worksheets and their data are unchanged.
  await selectSheet(page, keep);
  await expect(cell(page, 'A1')).toHaveText(keepValue);

  await page.reload();
  await expect(tab(page, gone)).toHaveCount(0);
  await expect(cell(page, 'A1')).toHaveText(keepValue);
});

/* ------------------------------------------------------------------ REQ-2-2-1 */

test('REQ-2-2-1: REQ-2-2-1 -the requested workflow 3 the requested workflow,the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await sheetWithRows(page);

  await rowHead(page, 3).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 row above', exact: true }).click();

  // The target row and all subsequent records shift downward together.
  await expect(cell(page, 'A1')).toHaveText('East');
  await expect(cell(page, 'A2')).toHaveText('North');
  await expect(cell(page, 'A3')).toHaveText('');
  await expect(cell(page, 'A4')).toHaveText('South');
  await expect(cell(page, 'B4')).toHaveText('700');
  await expect(cell(page, 'A5')).toHaveText('West');

  await page.reload();
  await expect(cell(page, 'A3')).toHaveText('');
  await expect(cell(page, 'A4')).toHaveText('South');
  await expect(cell(page, 'A5')).toHaveText('West');
});

test('REQ-2-2-1#2: REQ-2-2-1 -the requested workflow 3 the requested workflow,the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await sheetWithRows(page);

  await rowHead(page, 3).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 row below', exact: true }).click();

  await expect(cell(page, 'A1')).toHaveText('East');
  await expect(cell(page, 'A2')).toHaveText('North');
  await expect(cell(page, 'A3')).toHaveText('South');
  await expect(cell(page, 'A4')).toHaveText('');
  await expect(cell(page, 'A5')).toHaveText('West');
  await expect(cell(page, 'B5')).toHaveText('900');

  await page.reload();
  await expect(cell(page, 'A3')).toHaveText('South');
  await expect(cell(page, 'A4')).toHaveText('');
  await expect(cell(page, 'A5')).toHaveText('West');
});

test('REQ-2-2-1#3: REQ-2-2-1 -the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await sheetWithRows(page);

  await rowHead(page, 2).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete row', exact: true }).click();

  // Subsequent rows shift upward.
  await expect(cell(page, 'A1')).toHaveText('East');
  await expect(cell(page, 'A2')).toHaveText('South');
  await expect(cell(page, 'A3')).toHaveText('West');
  await expect(cell(page, 'A4')).toHaveText('');

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('South');
  await expect(cell(page, 'A3')).toHaveText('West');
});

test('REQ-2-2-1#4: REQ-2-2-1 -the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await addSheet(page);
  await pasteAt(page, 'A1', '2\t3');
  await expect(cell(page, 'B1')).toHaveText('3');

  await typeCell(page, 'C1', '=A1+B1');
  await cell(page, 'C1').click();
  await expect(cell(page, 'C1')).toHaveText('5');
  await expect(formulaBar(page)).toHaveValue('=A1+B1');

  await rowHead(page, 1).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 row above', exact: true }).click();

  // The formula shows the adjusted original formula and the correct result.
  await cell(page, 'C2').click();
  await expect(cell(page, 'C2')).toHaveText('5');
  await expect(formulaBar(page)).toHaveValue('=A2+B2');

  await page.reload();
  await cell(page, 'C2').click();
  await expect(formulaBar(page)).toHaveValue('=A2+B2');
  await expect(cell(page, 'C2')).toHaveText('5');
});

test('REQ-2-2-1#5: REQ-2-2-1 -the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await addSheet(page);
  await typeCell(page, 'A1', '10');
  await cell(page, 'A1').click();

  // A 0-to-100 numeric rule on the cell.
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Data validation', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Rule type', { exact: true }).click();
  await page.getByRole('option', { name: 'Number range', exact: true }).click();
  await dialog.getByLabel('Minimum', { exact: true }).fill('0');
  await dialog.getByLabel('Maximum', { exact: true }).fill('100');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toHaveCount(0);

  // The rule moves with the cell when a row is inserted above it.
  await rowHead(page, 1).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 row above', exact: true }).click();
  await expect(cell(page, 'A1')).toHaveText('');
  await expect(cell(page, 'A2')).toHaveText('10');

  await typeCell(page, 'A2', '101');
  await expect(page.getByText('Please enter a number from 0 to 100', { exact: true })).toBeVisible();
  await expect(cell(page, 'A2')).toHaveText('10');

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('10');
});

/* ------------------------------------------------------------------ REQ-2-2-2 */

test('REQ-2-2-2: REQ-2-2-2 -the requested workflow B the requested workflow,the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await sheetWithCols(page);

  await colHead(page, 'B').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 column left', exact: true }).click();

  // The target column and subsequent columns shift right together.
  await expect(cell(page, 'A1')).toHaveText('East');
  await expect(cell(page, 'B1')).toHaveText('');
  await expect(cell(page, 'C1')).toHaveText('1200');
  await expect(cell(page, 'D1')).toHaveText('Open');

  await page.reload();
  await expect(cell(page, 'B1')).toHaveText('');
  await expect(cell(page, 'C1')).toHaveText('1200');
  await expect(cell(page, 'D1')).toHaveText('Open');
});

test('REQ-2-2-2#2: REQ-2-2-2 -the requested workflow B the requested workflow,the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await sheetWithCols(page);

  await colHead(page, 'B').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 column right', exact: true }).click();

  await expect(cell(page, 'A1')).toHaveText('East');
  await expect(cell(page, 'B1')).toHaveText('1200');
  await expect(cell(page, 'C1')).toHaveText('');
  await expect(cell(page, 'D1')).toHaveText('Open');

  await page.reload();
  await expect(cell(page, 'B1')).toHaveText('1200');
  await expect(cell(page, 'C1')).toHaveText('');
  await expect(cell(page, 'D1')).toHaveText('Open');
});

test('REQ-2-2-2#3: REQ-2-2-2 -the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await sheetWithCols(page);

  await colHead(page, 'B').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete column', exact: true }).click();

  // Data outside the deleted column is preserved; subsequent columns shift left.
  await expect(cell(page, 'A1')).toHaveText('East');
  await expect(cell(page, 'B1')).toHaveText('Open');
  await expect(cell(page, 'C1')).toHaveText('');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('East');
  await expect(cell(page, 'B1')).toHaveText('Open');
});

test('REQ-2-2-2#4: REQ-2-2-2 -the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await addSheet(page);
  await pasteAt(page, 'A1', '2\t3');
  await expect(cell(page, 'B1')).toHaveText('3');

  await typeCell(page, 'C1', '=A1+B1');
  await cell(page, 'C1').click();
  await expect(cell(page, 'C1')).toHaveText('5');
  await expect(formulaBar(page)).toHaveValue('=A1+B1');

  await colHead(page, 'A').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert 1 column left', exact: true }).click();

  // The formula keeps its references adjusted to the moved columns.
  await cell(page, 'D1').click();
  await expect(cell(page, 'D1')).toHaveText('5');
  await expect(formulaBar(page)).toHaveValue('=B1+C1');

  await page.reload();
  await cell(page, 'D1').click();
  await expect(formulaBar(page)).toHaveValue('=B1+C1');
  await expect(cell(page, 'D1')).toHaveText('5');
});

test('REQ-2-2-2#5: REQ-2-2-2 -the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await addSheet(page);
  await pasteAt(page, 'A1', '5\t6');
  await expect(cell(page, 'B1')).toHaveText('6');

  await typeCell(page, 'C1', '=B1+1');
  await cell(page, 'C1').click();
  await expect(cell(page, 'C1')).toHaveText('7');

  // A direct reference that cannot be preserved displays #REF!.
  await colHead(page, 'B').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete column', exact: true }).click();
  await expect(cell(page, 'B1')).toHaveText('#REF!');

  await page.reload();
  await expect(cell(page, 'B1')).toHaveText('#REF!');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

