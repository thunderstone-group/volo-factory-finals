const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const grid = (page) => page.getByRole('grid', { name: 'Worksheet grid', exact: true });
const cell = (page, coord) => grid(page).getByRole('gridcell', { name: coord, exact: true });

async function createWorkbook(page, name) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'New blank workbook', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(grid(page)).toBeVisible();

  await page.getByRole('button', { name: 'Rename workbook', exact: true }).click();
  await expect(page.getByLabel('Workbook name', { exact: true })).toBeVisible();
  await page.getByLabel('Workbook name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByLabel('Workbook name', { exact: true })).toBeHidden();
}

async function enterCell(page, coord, value) {
  await cell(page, coord).click({ position: { x: 2, y: 2 } });
  await page.getByLabel('Formula bar', { exact: true }).fill(String(value));
  await page.keyboard.press('Enter');
}

async function seedSales(page) {
  await enterCell(page, 'A1', 'Region');
  await enterCell(page, 'B1', 'Sales');
  await enterCell(page, 'C1', 'Status');
  await enterCell(page, 'A2', 'East');
  await enterCell(page, 'B2', 1200);
  await enterCell(page, 'C2', 'Open');
  await enterCell(page, 'A3', 'North');
  await enterCell(page, 'B3', 800);
  await enterCell(page, 'C3', 'Closed');
  await enterCell(page, 'A4', 'South');
  await enterCell(page, 'B4', 700);
  await enterCell(page, 'C4', 'Open');
}

async function createSalesWorkbook(page) {
  const name = 'Validation ' + u();
  await createWorkbook(page, name);
  await seedSales(page);
  return name;
}

async function selectRange(page, start, end) {
  const sc = cell(page, start);
  const ec = cell(page, end);
  await sc.scrollIntoViewIfNeeded();
  await ec.scrollIntoViewIfNeeded();
  const sb = await sc.boundingBox();
  const eb = await ec.boundingBox();
  await page.mouse.move(sb.x + 2, sb.y + sb.height / 2);
  await page.mouse.down();
  await page.mouse.move(eb.x + 2, eb.y + eb.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(cell(page, end)).toHaveAttribute('aria-selected', 'true');
}

async function openDataValidation(page) {
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Data validation', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Data validation', exact: true })).toBeVisible();
}

async function setDropdownRule(page, start, end, allowed) {
  await selectRange(page, start, end);
  await openDataValidation(page);
  const dlg = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await dlg.getByLabel('Rule type', { exact: true }).selectOption({ label: 'Dropdown' });
  await dlg.getByLabel('Allowed values', { exact: true }).fill(allowed);
  await dlg.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dlg).toBeHidden();
}

async function setNumberRule(page, start, end, min, max) {
  await selectRange(page, start, end);
  await openDataValidation(page);
  const dlg = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await dlg.getByLabel('Rule type', { exact: true }).selectOption({ label: 'Number range' });
  await dlg.getByLabel('Minimum', { exact: true }).fill(String(min));
  await dlg.getByLabel('Maximum', { exact: true }).fill(String(max));
  await dlg.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dlg).toBeHidden();
}

test('REQ-5-2-1: REQ-5-2-1 -the requested workflow A1:A2 the requested workflow,the requested workflow', async ({ page }) => {
  await createSalesWorkbook(page);

  await setDropdownRule(page, 'A1', 'A2', ' Region , East , North , South ');

  await expect(cell(page, 'A1').getByRole('button', { name: 'Open dropdown for A1', exact: true })).toBeVisible();
  await cell(page, 'A2').getByRole('button', { name: 'Open dropdown for A2', exact: true }).click();

  await expect(page.getByRole('option', { name: 'Region', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'East', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'North', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'South', exact: true })).toBeVisible();

  await page.getByRole('option', { name: 'North', exact: true }).click();
  await expect(cell(page, 'A2')).toHaveText('North');

  await page.getByLabel('Formula bar', { exact: true }).fill('West');
  await page.keyboard.press('Enter');

  await expect(page.getByText(/Please select one of the following values: Region, ?East, ?North, ?South/)).toBeVisible();
  await expect(cell(page, 'A2')).toHaveText('North');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('North');

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('North');
  await expect(cell(page, 'A2').getByRole('button', { name: 'Open dropdown for A2', exact: true })).toBeVisible();
});

test('REQ-5-2-1#2: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await createSalesWorkbook(page);

  await enterCell(page, 'D1', 10);
  await enterCell(page, 'D2', 20);
  await enterCell(page, 'D3', 30);
  await enterCell(page, 'D4', 40);

  await setNumberRule(page, 'D1', 'D4', 0, 100);

  await cell(page, 'D2').click({ position: { x: 2, y: 2 } });
  await page.getByLabel('Formula bar', { exact: true }).fill('101');
  await page.keyboard.press('Enter');

  await expect(page.getByText('Please enter a number from 0 to 100', { exact: true })).toBeVisible();
  await expect(cell(page, 'D2')).toHaveText('20');

  await cell(page, 'D2').click({ position: { x: 2, y: 2 } });
  await page.getByLabel('Formula bar', { exact: true }).fill('100');
  await page.keyboard.press('Enter');
  await expect(cell(page, 'D2')).toHaveText('100');

  await page.reload();
  await expect(cell(page, 'D2')).toHaveText('100');

  await cell(page, 'D2').click({ position: { x: 2, y: 2 } });
  await page.getByLabel('Formula bar', { exact: true }).fill('101');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Please enter a number from 0 to 100', { exact: true })).toBeVisible();
});

test('REQ-5-2-1#3: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await createSalesWorkbook(page);

  await enterCell(page, 'E1', 12);
  await enterCell(page, 'E2', 13);

  await setNumberRule(page, 'E1', 'E2', 10, 20);

  await page.evaluate((t) => navigator.clipboard.writeText(t), '15\n25');
  await cell(page, 'E1').click({ position: { x: 2, y: 2 } });
  await page.keyboard.press('Control+V');

  await expect(page.getByText('Please enter a number between 10 and 20', { exact: true })).toBeVisible();
  await expect(cell(page, 'E1')).toHaveText('12');
  await expect(cell(page, 'E2')).toHaveText('13');

  await page.evaluate((t) => navigator.clipboard.writeText(t), '15\n16');
  await cell(page, 'E1').click({ position: { x: 2, y: 2 } });
  await page.keyboard.press('Control+V');

  await expect(cell(page, 'E1')).toHaveText('15');
  await expect(cell(page, 'E2')).toHaveText('16');

  await page.reload();
  await expect(cell(page, 'E1')).toHaveText('15');
  await expect(cell(page, 'E2')).toHaveText('16');

  await cell(page, 'E1').click({ position: { x: 2, y: 2 } });
  await page.getByLabel('Formula bar', { exact: true }).fill('25');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Please enter a number between 10 and 20', { exact: true })).toBeVisible();
  await expect(cell(page, 'E1')).toHaveText('15');
});

test('REQ-5-2-1#4: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await createSalesWorkbook(page);

  await setDropdownRule(page, 'A1', 'A2', 'Region,East,North,South');

  await selectRange(page, 'A1', 'A2');
  await openDataValidation(page);
  const dlg = page.getByRole('dialog', { name: 'Data validation', exact: true });

  await expect(dlg.getByLabel('Allowed values', { exact: true })).toHaveValue('Region,East,North,South');
  await expect(dlg.getByRole('button', { name: 'Delete rule', exact: true })).toBeVisible();

  await dlg.getByRole('button', { name: 'Delete rule', exact: true }).click();
  await expect(dlg).toBeHidden();

  await expect(page.getByRole('button', { name: 'Open dropdown for A1', exact: true })).toHaveCount(0);
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(cell(page, 'A2')).toHaveText('East');

  await page.reload();
  await expect(page.getByRole('button', { name: 'Open dropdown for A1', exact: true })).toHaveCount(0);
  await expect(cell(page, 'A2')).toHaveText('East');
});

test('REQ-5-2-1#5: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await createSalesWorkbook(page);

  await enterCell(page, 'D1', 10);
  await enterCell(page, 'D2', 20);

  await setNumberRule(page, 'D1', 'D2', 0, 100);

  await selectRange(page, 'D1', 'D2');
  await openDataValidation(page);
  const dlg = page.getByRole('dialog', { name: 'Data validation', exact: true });

  await expect(dlg.getByLabel('Minimum', { exact: true })).toHaveValue('0');
  await expect(dlg.getByLabel('Maximum', { exact: true })).toHaveValue('100');

  await dlg.getByLabel('Minimum', { exact: true }).fill('10');
  await dlg.getByLabel('Maximum', { exact: true }).fill('20');
  await dlg.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dlg).toBeHidden();

  await cell(page, 'D1').click({ position: { x: 2, y: 2 } });
  await page.getByLabel('Formula bar', { exact: true }).fill('50');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Please enter a number between 10 and 20', { exact: true })).toBeVisible();
  await expect(cell(page, 'D1')).toHaveText('10');

  await cell(page, 'D1').click({ position: { x: 2, y: 2 } });
  await page.getByLabel('Formula bar', { exact: true }).fill('15');
  await page.keyboard.press('Enter');
  await expect(cell(page, 'D1')).toHaveText('15');

  await page.reload();
  await expect(cell(page, 'D1')).toHaveText('15');

  await cell(page, 'D1').click({ position: { x: 2, y: 2 } });
  await page.getByLabel('Formula bar', { exact: true }).fill('25');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Please enter a number between 10 and 20', { exact: true })).toBeVisible();
});

test('REQ-5-2-1#6: REQ-5-2-1 -the requested workflow', async ({ page }) => {
  await createSalesWorkbook(page);

  await enterCell(page, 'D1', 50);
  await setNumberRule(page, 'D1', 'D1', 0, 100);

  await cell(page, 'D1').dblclick({ position: { x: 2, y: 2 } });
  const edit = page.getByRole('textbox', { name: 'Edit D1', exact: true });
  await expect(edit).toBeVisible();
  await edit.fill('101');
  await page.keyboard.press('Enter');

  await expect(page.getByText('Please enter a number from 0 to 100', { exact: true })).toBeVisible();
  await expect(cell(page, 'D1')).toHaveText('50');

  await page.reload();
  await expect(cell(page, 'D1')).toHaveText('50');

  await cell(page, 'D1').dblclick({ position: { x: 2, y: 2 } });
  await page.getByRole('textbox', { name: 'Edit D1', exact: true }).fill('101');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Please enter a number from 0 to 100', { exact: true })).toBeVisible();
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

