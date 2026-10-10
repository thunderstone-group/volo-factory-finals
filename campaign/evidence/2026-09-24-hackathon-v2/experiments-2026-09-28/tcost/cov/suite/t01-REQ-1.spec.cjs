const { test, expect } = require('@playwright/test');

const uniq = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function openSeededWorkbook(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Q3 Sales', exact: true }).click();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
}

async function createBlankWorkbook(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
}

test('REQ-1-1-1: REQ-1-1-1 -the requested workflow,the requested workflow page entry the requested workflow', async ({ page }) => {
  await page.goto('/');
  const q3Link = page.getByRole('link', { name: 'Q3 Sales', exact: true });
  await expect(q3Link).toBeVisible();
  await expect(page.getByText(/Last updated: /).first()).toBeVisible();

  await q3Link.click();

  const grid = page.getByRole('grid', { name: 'Worksheet grid', exact: true });
  await expect(grid).toBeVisible();
  await expect(grid).toHaveAttribute('aria-multiselectable', 'true');
  await expect(page.getByText('Q3 Sales', { exact: true })).toBeVisible();
  await expect(page.getByText(/Last updated: /).first()).toBeVisible();

  const sheet1Tab = page.getByRole('tab', { name: 'Sheet1', exact: true });
  await expect(sheet1Tab).toBeVisible();
  await expect(sheet1Tab).toHaveAttribute('aria-selected', 'true');

  const a1 = grid.getByRole('gridcell', { name: 'A1', exact: true });
  await expect(a1).toBeVisible();
  await expect(a1).toHaveText('Region');
  await expect(a1).toHaveAttribute('aria-selected', 'true');

  await expect(page.getByRole('rowheader', { name: '1', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'A', exact: true })).toBeVisible();
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('Region');

  const directUrl = page.url();
  await page.goto(directUrl);
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(page.getByRole('gridcell', { name: 'A1', exact: true })).toHaveText('Region');

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('gridcell', { name: 'A1', exact: true })).toHaveText('Region');
  await page.getByRole('gridcell', { name: 'A1', exact: true }).click();
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('Region');
});

test('REQ-1-1-1#2: REQ-1-1-1 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);

  const foreignValue = 'Foreign' + uniq();
  const formulaBar = page.getByLabel('Formula bar', { exact: true });
  await formulaBar.fill(foreignValue);
  await page.getByRole('gridcell', { name: 'B1', exact: true }).click();

  const blankGrid = page.getByRole('grid', { name: 'Worksheet grid', exact: true });
  await expect(blankGrid.getByRole('gridcell', { name: 'A1', exact: true })).toHaveText(foreignValue);

  await openSeededWorkbook(page);

  const q3Grid = page.getByRole('grid', { name: 'Worksheet grid', exact: true });
  await expect(q3Grid.getByRole('gridcell', { name: 'A1', exact: true })).toHaveText('Region');
  await expect(q3Grid).not.toContainText(foreignValue);

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('gridcell', { name: 'A1', exact: true })).toHaveText('Region');
  await page.getByRole('gridcell', { name: 'A1', exact: true }).click();
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('Region');
});

test('REQ-1-2-1: REQ-1-2-1 -the requested workflow,the requested workflow Sheet1 the requested workflow A1 the requested workflow', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();

  const grid = page.getByRole('grid', { name: 'Worksheet grid', exact: true });
  await expect(grid).toBeVisible();

  const sheet1 = page.getByRole('tab', { name: 'Sheet1', exact: true });
  await expect(sheet1).toBeVisible();
  await expect(sheet1).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveCount(0);

  const a1 = grid.getByRole('gridcell', { name: 'A1', exact: true });
  await expect(a1).toBeVisible();
  await expect(a1).toHaveAttribute('aria-selected', 'true');
  await expect(a1).toHaveText('');

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveCount(0);
  const a1AfterReload = page.getByRole('gridcell', { name: 'A1', exact: true });
  await expect(a1AfterReload).toHaveAttribute('aria-selected', 'true');
  await expect(a1AfterReload).toHaveText('');
});

test('REQ-1-2-2: REQ-1-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await page.getByRole('button', { name: 'Rename workbook', exact: true }).click();

  const nameInput = page.getByLabel('Workbook name', { exact: true });
  await expect(nameInput).toBeVisible();

  const newName = 'Renamed ' + uniq();
  await nameInput.fill('   ' + newName + '   ');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText(newName, { exact: true })).toBeVisible();

  await page.goto('/');
  const renamedLink = page.getByRole('link', { name: newName, exact: true });
  await expect(renamedLink).toBeVisible();

  await renamedLink.click();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(page.getByText(newName, { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
  await expect(page.getByText(newName, { exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('REQ-1-2-2#2: REQ-1-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await page.getByRole('button', { name: 'Rename workbook', exact: true }).click();

  const nameInput = page.getByLabel('Workbook name', { exact: true });
  await expect(nameInput).toBeVisible();
  const originalName = await nameInput.inputValue();

  await nameInput.fill('   ');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText('Workbook name cannot be empty', { exact: true })).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('link', { name: originalName, exact: true }).first()).toBeVisible();
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

