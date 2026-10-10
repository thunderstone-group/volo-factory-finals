const { test, expect } = require('@playwright/test');

async function createBlankWorkbook(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('grid', { name: 'Worksheet grid' })).toBeVisible();
}

async function setCell(page, coord, value) {
  await page.getByRole('gridcell', { name: coord, exact: true }).click();
  const formulaBar = page.getByLabel('Formula bar', { exact: true });
  await formulaBar.fill(String(value));
  await formulaBar.press('Enter');
}

async function seedSheet(page) {
  await createBlankWorkbook(page);
  await setCell(page, 'A1', 'Region');
  await setCell(page, 'B1', 'Sales');
  await setCell(page, 'A2', 'East');
  await setCell(page, 'B2', '1200');
  await setCell(page, 'A3', 'North');
  await setCell(page, 'B3', '800');
}

async function expectCell(page, coord, text) {
  await expect(page.getByRole('gridcell', { name: coord, exact: true })).toHaveText(text);
}

async function rowCommand(page, rowNumber, command) {
  await page.getByRole('rowheader', { name: String(rowNumber), exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: command, exact: true }).click();
}

async function columnCommand(page, columnLetter, command) {
  await page.getByRole('columnheader', { name: columnLetter, exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: command, exact: true }).click();
}

test('REQ-2-2-1: REQ-2-2-1 -the requested workflow 3 the requested workflow,the requested workflow', async ({ page }) => {
  await seedSheet(page);
  await rowCommand(page, 3, 'Insert 1 row above');

  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'B2', '1200');
  await expectCell(page, 'A3', '');
  await expectCell(page, 'B3', '');
  await expectCell(page, 'A4', 'North');
  await expectCell(page, 'B4', '800');

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid' })).toBeVisible();
  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'B2', '1200');
  await expectCell(page, 'A3', '');
  await expectCell(page, 'B3', '');
  await expectCell(page, 'A4', 'North');
  await expectCell(page, 'B4', '800');
});

test('REQ-2-2-1#2: REQ-2-2-1 -the requested workflow 3 the requested workflow,the requested workflow', async ({ page }) => {
  await seedSheet(page);
  await rowCommand(page, 3, 'Insert 1 row below');

  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'B2', '1200');
  await expectCell(page, 'A3', 'North');
  await expectCell(page, 'B3', '800');
  await expectCell(page, 'A4', '');
  await expectCell(page, 'B4', '');

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid' })).toBeVisible();
  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'B2', '1200');
  await expectCell(page, 'A3', 'North');
  await expectCell(page, 'B3', '800');
  await expectCell(page, 'A4', '');
  await expectCell(page, 'B4', '');
});

test('REQ-2-2-1#3: REQ-2-2-1 -the requested workflow', async ({ page }) => {
  await seedSheet(page);
  await rowCommand(page, 2, 'Delete row');

  await expectCell(page, 'A2', 'North');
  await expectCell(page, 'B2', '800');
  await expectCell(page, 'A3', '');
  await expectCell(page, 'B3', '');

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid' })).toBeVisible();
  await expectCell(page, 'A2', 'North');
  await expectCell(page, 'B2', '800');
  await expectCell(page, 'A3', '');
  await expectCell(page, 'B3', '');
});

test('REQ-2-2-1#4: REQ-2-2-1 -the requested workflow', async ({ page }) => {
  await seedSheet(page);
  await rowCommand(page, 3, 'Delete row');

  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'B2', '1200');
  await expectCell(page, 'A3', '');
  await expectCell(page, 'B3', '');

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid' })).toBeVisible();
  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'B2', '1200');
  await expectCell(page, 'A3', '');
  await expectCell(page, 'B3', '');
});

test('REQ-2-2-1#5: REQ-2-2-1 -the requested workflow', async ({ page }) => {
  await seedSheet(page);
  await rowCommand(page, 2, 'Insert 1 row below');

  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'B2', '1200');
  await expectCell(page, 'A3', '');
  await expectCell(page, 'B3', '');
  await expectCell(page, 'A4', 'North');
  await expectCell(page, 'B4', '800');

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid' })).toBeVisible();
  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'B2', '1200');
  await expectCell(page, 'A3', '');
  await expectCell(page, 'B3', '');
  await expectCell(page, 'A4', 'North');
  await expectCell(page, 'B4', '800');
});

test('REQ-2-2-2: REQ-2-2-2 -the requested workflow B the requested workflow,the requested workflow', async ({ page }) => {
  await seedSheet(page);
  await columnCommand(page, 'B', 'Insert 1 column left');

  await expectCell(page, 'A1', 'Region');
  await expectCell(page, 'B1', '');
  await expectCell(page, 'C1', 'Sales');
  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'B2', '');
  await expectCell(page, 'C2', '1200');
  await expectCell(page, 'A3', 'North');
  await expectCell(page, 'B3', '');
  await expectCell(page, 'C3', '800');

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid' })).toBeVisible();
  await expectCell(page, 'A1', 'Region');
  await expectCell(page, 'B1', '');
  await expectCell(page, 'C1', 'Sales');
  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'B2', '');
  await expectCell(page, 'C2', '1200');
  await expectCell(page, 'A3', 'North');
  await expectCell(page, 'B3', '');
  await expectCell(page, 'C3', '800');
});

test('REQ-2-2-2#2: REQ-2-2-2 -the requested workflow B the requested workflow,the requested workflow', async ({ page }) => {
  await seedSheet(page);
  await columnCommand(page, 'B', 'Insert 1 column right');

  await expectCell(page, 'A1', 'Region');
  await expectCell(page, 'B1', 'Sales');
  await expectCell(page, 'C1', '');
  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'B2', '1200');
  await expectCell(page, 'C2', '');
  await expectCell(page, 'A3', 'North');
  await expectCell(page, 'B3', '800');
  await expectCell(page, 'C3', '');

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid' })).toBeVisible();
  await expectCell(page, 'A1', 'Region');
  await expectCell(page, 'B1', 'Sales');
  await expectCell(page, 'C1', '');
  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'B2', '1200');
  await expectCell(page, 'C2', '');
  await expectCell(page, 'A3', 'North');
  await expectCell(page, 'B3', '800');
  await expectCell(page, 'C3', '');
});

test('REQ-2-2-2#3: REQ-2-2-2 -the requested workflow', async ({ page }) => {
  await seedSheet(page);
  await columnCommand(page, 'B', 'Delete column');

  await expectCell(page, 'A1', 'Region');
  await expectCell(page, 'B1', '');
  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'B2', '');
  await expectCell(page, 'A3', 'North');
  await expectCell(page, 'B3', '');

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid' })).toBeVisible();
  await expectCell(page, 'A1', 'Region');
  await expectCell(page, 'B1', '');
  await expectCell(page, 'A2', 'East');
  await expectCell(page, 'B2', '');
  await expectCell(page, 'A3', 'North');
  await expectCell(page, 'B3', '');
});

test('REQ-2-2-2#4: REQ-2-2-2 -the requested workflow', async ({ page }) => {
  await seedSheet(page);
  await columnCommand(page, 'A', 'Delete column');

  await expectCell(page, 'A1', 'Sales');
  await expectCell(page, 'B1', '');
  await expectCell(page, 'A2', '1200');
  await expectCell(page, 'B2', '');
  await expectCell(page, 'A3', '800');
  await expectCell(page, 'B3', '');

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid' })).toBeVisible();
  await expectCell(page, 'A1', 'Sales');
  await expectCell(page, 'B1', '');
  await expectCell(page, 'A2', '1200');
  await expectCell(page, 'B2', '');
  await expectCell(page, 'A3', '800');
  await expectCell(page, 'B3', '');
});

test('REQ-2-2-2#5: REQ-2-2-2 -the requested workflow', async ({ page }) => {
  await seedSheet(page);
  await columnCommand(page, 'A', 'Insert 1 column left');

  await expectCell(page, 'A1', '');
  await expectCell(page, 'B1', 'Region');
  await expectCell(page, 'C1', 'Sales');
  await expectCell(page, 'A2', '');
  await expectCell(page, 'B2', 'East');
  await expectCell(page, 'C2', '1200');
  await expectCell(page, 'A3', '');
  await expectCell(page, 'B3', 'North');
  await expectCell(page, 'C3', '800');

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid' })).toBeVisible();
  await expectCell(page, 'A1', '');
  await expectCell(page, 'B1', 'Region');
  await expectCell(page, 'C1', 'Sales');
  await expectCell(page, 'A2', '');
  await expectCell(page, 'B2', 'East');
  await expectCell(page, 'C2', '1200');
  await expectCell(page, 'A3', '');
  await expectCell(page, 'B3', 'North');
  await expectCell(page, 'C3', '800');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

