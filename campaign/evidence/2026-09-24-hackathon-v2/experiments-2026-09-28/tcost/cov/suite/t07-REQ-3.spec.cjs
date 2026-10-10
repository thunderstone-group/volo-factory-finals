const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function importWorkbook(page, csv) {
  const name = `t${u()}`;
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
  return name;
}

function cell(page, coord) {
  return page
    .getByRole('grid', { name: 'Worksheet grid', exact: true })
    .getByRole('gridcell', { name: coord, exact: true });
}

function formulaBar(page) {
  return page.getByLabel('Formula bar', { exact: true });
}

async function setCellViaFormulaBar(page, coord, value, commitWith = 'Enter') {
  await cell(page, coord).click();
  await formulaBar(page).fill(value);
  if (commitWith === 'Enter') {
    await formulaBar(page).press('Enter');
  } else if (commitWith === 'click') {
    await cell(page, commitWith).click();
  }
}

async function chooseCombo(page, combo, optionName) {
  try {
    await combo.selectOption({ label: optionName });
  } catch (error) {
    await combo.click();
    await page.getByRole('option', { name: optionName, exact: true }).click();
  }
}

test('REQ-3-1-1 -the requested workflow,the requested workflow', async ({ page }) => {
  await importWorkbook(page, 'Item,Qty\nPen,4\n');

  await setCellViaFormulaBar(page, 'D1', 'East', 'Enter');
  await setCellViaFormulaBar(page, 'E1', '1200', 'Enter');
  await setCellViaFormulaBar(page, 'D2', 'North', 'Enter');
  await setCellViaFormulaBar(page, 'E2', '800', 'Enter');

  await cell(page, 'D1').click();
  await expect(formulaBar(page)).toHaveValue('East');
  await cell(page, 'E1').click();
  await expect(formulaBar(page)).toHaveValue('1200');
  await cell(page, 'D2').click();
  await expect(formulaBar(page)).toHaveValue('North');
  await cell(page, 'E2').click();
  await expect(formulaBar(page)).toHaveValue('800');

  await expect(cell(page, 'D1')).toHaveText('East');
  await expect(cell(page, 'E1')).toHaveText('1200');
  await expect(cell(page, 'D2')).toHaveText('North');
  await expect(cell(page, 'E2')).toHaveText('800');

  await page.reload();
  await expect(cell(page, 'D1')).toHaveText('East');
  await expect(cell(page, 'E1')).toHaveText('1200');
  await expect(cell(page, 'D2')).toHaveText('North');
  await expect(cell(page, 'E2')).toHaveText('800');
});

test('REQ-3-1-1 -Escape the requested workflow,the requested workflow', async ({ page }) => {
  await importWorkbook(page, 'Item,Qty\nPen,4\n');

  await cell(page, 'A1').dblclick();
  const edit = page.getByRole('textbox', { name: 'Edit A1', exact: true });
  await edit.fill('Changed');
  await edit.press('Escape');

  await expect(cell(page, 'A1')).toHaveText('Item');
  await cell(page, 'A1').click();
  await expect(formulaBar(page)).toHaveValue('Item');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('Item');
});

test('REQ-3-1-1 -the requested workflow, the requested workflow, the requested workflow, the requested workflow', async ({ page }) => {
  await importWorkbook(page, 'Item,Qty\nPen,4\n');

  await setCellViaFormulaBar(page, 'D1', '2', 'Enter');
  await setCellViaFormulaBar(page, 'D2', '3', 'Enter');
  await setCellViaFormulaBar(page, 'D3', '=D1+D2', 'Enter');
  await setCellViaFormulaBar(page, 'D4', '=D3*2', 'Enter');

  await cell(page, 'D3').click();
  await expect(cell(page, 'D3')).toHaveText('5');
  await expect(formulaBar(page)).toHaveValue('=D1+D2');

  await cell(page, 'D4').click();
  await expect(cell(page, 'D4')).toHaveText('10');

  await setCellViaFormulaBar(page, 'D1', '10', 'Enter');

  await expect(cell(page, 'D3')).toHaveText('13');
  await expect(cell(page, 'D4')).toHaveText('26');
  await cell(page, 'D3').click();
  await expect(formulaBar(page)).toHaveValue('=D1+D2');

  await setCellViaFormulaBar(page, 'E1', 'TRUE', 'Enter');
  await setCellViaFormulaBar(page, 'E2', '2024-01-01', 'Enter');
  await expect(cell(page, 'E1')).toHaveText('TRUE');
  await expect(cell(page, 'E2')).toHaveText('2024-01-01');

  await page.reload();
  await expect(cell(page, 'D3')).toHaveText('13');
  await expect(cell(page, 'D4')).toHaveText('26');
  await expect(cell(page, 'E1')).toHaveText('TRUE');
  await expect(cell(page, 'E2')).toHaveText('2024-01-01');

  await cell(page, 'D3').click();
  await expect(formulaBar(page)).toHaveValue('=D1+D2');
});

test('REQ-3-1-1 -the requested workflow', async ({ page }) => {
  await importWorkbook(page, 'Item,Qty\nPen,4\n');

  await cell(page, 'D1').click();
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Data validation', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  const ruleType = dialog.getByRole('combobox', { name: 'Rule type', exact: true });
  await chooseCombo(page, ruleType, 'Number range');
  await dialog.getByLabel('Minimum', { exact: true }).fill('1');
  await dialog.getByLabel('Maximum', { exact: true }).fill('10');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();

  await formulaBar(page).fill('11');
  await formulaBar(page).press('Enter');

  await expect(page.getByText('Please enter a number between 1 and 10', { exact: true })).toBeVisible();
  await expect(cell(page, 'D1')).toHaveText('');
  await expect(formulaBar(page)).toHaveValue('');

  await formulaBar(page).fill('5');
  await cell(page, 'E1').click();

  await expect(cell(page, 'D1')).toHaveText('5');

  await page.reload();
  await expect(cell(page, 'D1')).toHaveText('5');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

