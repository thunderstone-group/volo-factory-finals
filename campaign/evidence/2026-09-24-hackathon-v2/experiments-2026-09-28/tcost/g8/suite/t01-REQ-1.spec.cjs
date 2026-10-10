const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function gotoHome(page) {
  await page.goto('/');
}

async function openQ3Sales(page) {
  await gotoHome(page);
  await page.getByRole('link', { name: 'Q3 Sales', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
}

async function expectQ3SalesState(page) {
  await expect(page.getByText('Q3 Sales', { exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  const grid = page.getByRole('grid', { name: 'Worksheet grid', exact: true });
  await expect(grid).toHaveAttribute('aria-multiselectable', 'true');
  await expect(grid.getByRole('gridcell', { name: 'A1', exact: true })).toHaveText('Region');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('Region');
}

async function createBlankWorkbook(page) {
  await gotoHome(page);
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
}

async function renameWorkbook(page, name) {
  await page.getByRole('button', { name: 'Rename workbook', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Workbook name', exact: true });
  await input.fill(name);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Workbook name', exact: true })).toBeHidden();
}

test('REQ-1-1-1: REQ-1-1-1 -the requested workflow,the requested workflow page entry the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await expectQ3SalesState(page);

  await page.reload();
  await expectQ3SalesState(page);
});

test('REQ-1-1-1#2: REQ-1-1-1 -the requested workflow', async ({ page }) => {
  await openQ3Sales(page);
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();

  const editorEntry = page.url();
  await gotoHome(page);
  await page.goto(editorEntry);

  await expectQ3SalesState(page);
});

test('REQ-1-2-1: REQ-1-2-1 -the requested workflow,the requested workflow Sheet1 the requested workflow A1 the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);

  const sheet1 = page.getByRole('tab', { name: 'Sheet1', exact: true });
  await expect(sheet1).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab')).toHaveCount(1);

  const grid = page.getByRole('grid', { name: 'Worksheet grid', exact: true });
  await expect(grid).toHaveAttribute('aria-multiselectable', 'true');

  const a1 = grid.getByRole('gridcell', { name: 'A1', exact: true });
  await expect(a1).toHaveAttribute('aria-selected', 'true');
  await expect(a1).toHaveText('');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true }).getByRole('gridcell', { name: 'A1', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('REQ-1-2-2: REQ-1-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  const newName = 'Workbook-' + u();

  await createBlankWorkbook(page);
  await renameWorkbook(page, newName);

  await expect(page.getByText(newName, { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText(newName, { exact: true })).toBeVisible();

  await gotoHome(page);
  const homeLink = page.getByRole('link', { name: newName, exact: true });
  await expect(homeLink).toBeVisible();
  await homeLink.click();
  await expect(page.getByText(newName, { exact: true })).toBeVisible();
});

test('REQ-1-2-2#2: REQ-1-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  const validName = 'Workbook-' + u();

  await createBlankWorkbook(page);
  await renameWorkbook(page, validName);

  await page.getByRole('button', { name: 'Rename workbook', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Workbook name', exact: true });
  await input.fill('   ');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText('Workbook name cannot be empty', { exact: true })).toBeVisible();
  await expect(page.getByText(validName, { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText(validName, { exact: true })).toBeVisible();
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

