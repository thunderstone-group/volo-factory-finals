const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const SEED_CSV = 'Region,Sales,Status\nEast,1200,Open\nNorth,800,Closed\nSouth,700,Open\n';

function gridCell(page, coord) {
  return page
    .getByRole('grid', { name: 'Worksheet grid', exact: true })
    .getByRole('gridcell', { name: coord, exact: true });
}

async function importSeedWorkbook(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Import CSV', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import CSV', exact: true });
  await dialog.getByLabel('CSV file', { exact: true }).setInputFiles({
    name: `validation-${u()}.csv`,
    mimeType: 'text/csv',
    buffer: Buffer.from(SEED_CSV, 'utf8'),
  });
  await dialog.getByRole('button', { name: 'Confirm import', exact: true }).click();

  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(gridCell(page, 'A1')).toHaveText('Region');
}

async function selectCell(page, coord) {
  await gridCell(page, coord).click();
}

async function setCellValue(page, coord, value) {
  await selectCell(page, coord);
  const bar = page.getByRole('textbox', { name: 'Formula bar', exact: true });
  await bar.fill(value);
  await bar.press('Enter');
}

async function selectRange(page, startCoord, endCoord) {
  const start = gridCell(page, startCoord);
  const end = gridCell(page, endCoord);
  await start.scrollIntoViewIfNeeded();
  await end.scrollIntoViewIfNeeded();

  const startBox = await start.boundingBox();
  const endBox = await end.boundingBox();
  if (!startBox || !endBox) throw new Error(`Could not locate range ${startCoord}:${endCoord}`);

  await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(endBox.x + endBox.width / 2, endBox.y + endBox.height / 2, { steps: 5 });
  await page.mouse.up();
}

async function openDataValidation(page) {
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Data validation', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Data validation', exact: true })).toBeVisible();
}

async function pickRuleType(page, ruleType) {
  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await dialog.getByRole('combobox', { name: 'Rule type', exact: true }).click();
  await page.getByRole('option', { name: ruleType, exact: true }).click();
}

async function saveValidation(page) {
  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();
}

async function createDropdownRule(page, startCoord, endCoord, allowedValues) {
  await selectRange(page, startCoord, endCoord);
  await openDataValidation(page);
  await pickRuleType(page, 'Dropdown');
  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await dialog.getByRole('textbox', { name: 'Allowed values', exact: true }).fill(allowedValues);
  await saveValidation(page);
}

async function createNumberRule(page, startCoord, endCoord, min, max) {
  await selectRange(page, startCoord, endCoord);
  await openDataValidation(page);
  await pickRuleType(page, 'Number range');
  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await dialog.getByRole('textbox', { name: 'Minimum', exact: true }).fill(String(min));
  await dialog.getByRole('textbox', { name: 'Maximum', exact: true }).fill(String(max));
  await saveValidation(page);
}

async function expectCellValue(page, coord, value) {
  await expect(gridCell(page, coord)).toHaveText(value);
}

test('REQ-5-2-1: REQ-5-2-1 -the requested workflow A1:A2 the requested workflow,the requested workflow', async ({ page }) => {
  await importSeedWorkbook(page);
  await createDropdownRule(page, 'A1', 'A2', 'Region, East, North');

  await page.getByRole('button', { name: 'Open dropdown for A2', exact: true }).click();
  await expect(page.getByRole('option', { name: 'East', exact: true })).toBeVisible();
  await page.getByRole('option', { name: 'East', exact: true }).click();

  await setCellValue(page, 'A2', 'West');
  await expect(page.getByText(/Please select one of the following values:/)).toBeVisible();
  await expectCellValue(page, 'A2', 'East');

  await page.reload();
  await expectCellValue(page, 'A2', 'East');
  await expect(page.getByRole('button', { name: 'Open dropdown for A2', exact: true })).toBeVisible();
});

test('REQ-5-2-1#2: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await importSeedWorkbook(page);
  await setCellValue(page, 'D2', '50');
  await setCellValue(page, 'D3', '60');
  await createNumberRule(page, 'D2', 'D3', 0, 200);

  await setCellValue(page, 'D2', '201');
  await expect(page.getByText(/Please enter a number between 0 and 200/)).toBeVisible();
  await expectCellValue(page, 'D2', '50');

  await page.reload();
  await expectCellValue(page, 'D2', '50');
});

test('REQ-5-2-1#3: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await importSeedWorkbook(page);
  await setCellValue(page, 'D2', '10');
  await setCellValue(page, 'D3', '20');
  await setCellValue(page, 'E2', '30');
  await setCellValue(page, 'E3', '40');
  await createNumberRule(page, 'D2', 'E3', 0, 100);

  await page.evaluate((t) => navigator.clipboard.writeText(t), '1\t2\n3\t101');
  await selectCell(page, 'D2');
  await page.keyboard.press('ControlOrMeta+V');

  await expect(page.getByText(/Please enter a number from 0 to 100/)).toBeVisible();
  await expectCellValue(page, 'D2', '10');
  await expectCellValue(page, 'D3', '20');
  await expectCellValue(page, 'E2', '30');
  await expectCellValue(page, 'E3', '40');
});

test('REQ-5-2-1#4: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await importSeedWorkbook(page);
  await createDropdownRule(page, 'C2', 'C4', 'Open,Closed');

  await page.reload();
  await expect(page.getByRole('button', { name: 'Open dropdown for C2', exact: true })).toBeVisible();

  await setCellValue(page, 'C2', 'Pending');
  await expect(page.getByText(/Please select one of the following values:/)).toBeVisible();
  await expectCellValue(page, 'C2', 'Open');
});

test('REQ-5-2-1#5: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await importSeedWorkbook(page);
  await createDropdownRule(page, 'C2', 'C3', 'Open,Closed');

  await selectRange(page, 'C2', 'C3');
  await openDataValidation(page);
  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await expect(dialog.getByRole('textbox', { name: 'Allowed values', exact: true })).toHaveValue('Open,Closed');
  await dialog.getByRole('button', { name: 'Delete rule', exact: true }).click();
  await expect(dialog).toBeHidden();

  await setCellValue(page, 'C2', 'Pending');
  await expectCellValue(page, 'C2', 'Pending');
});

test('REQ-5-2-1#6: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await importSeedWorkbook(page);
  await setCellValue(page, 'D2', '50');
  await setCellValue(page, 'D3', '60');
  await createNumberRule(page, 'D2', 'D3', 0, 100);

  await selectRange(page, 'D2', 'D3');
  await openDataValidation(page);
  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await expect(dialog.getByRole('textbox', { name: 'Minimum', exact: true })).toHaveValue('0');
  await expect(dialog.getByRole('textbox', { name: 'Maximum', exact: true })).toHaveValue('100');
  await dialog.getByRole('textbox', { name: 'Maximum', exact: true }).fill('200');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();

  await setCellValue(page, 'D2', '150');
  await expectCellValue(page, 'D2', '150');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

