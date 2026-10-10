const { test, expect } = require('@playwright/test');

function cell(page, coord) {
  return page.getByRole('gridcell', { name: coord, exact: true });
}

async function createBlankWorkbook(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
}

async function selectCell(page, coord) {
  await cell(page, coord).click();
}

async function setCellValue(page, coord, value) {
  await cell(page, coord).dblclick();
  const editor = page.getByLabel(`Edit ${coord}`, { exact: true });
  await editor.fill(value);
  await editor.press('Enter');
}

async function setFormula(page, coord, formula) {
  await selectCell(page, coord);
  const bar = page.getByLabel('Formula bar', { exact: true });
  await bar.fill(formula);
  await bar.press('Enter');
}

async function copyCell(page, source) {
  await selectCell(page, source);
  await page.keyboard.press('ControlOrMeta+c');
}

async function pasteTo(page, target) {
  await selectCell(page, target);
  await page.keyboard.press('ControlOrMeta+v');
}

test('REQ-4-1-1: REQ-4-1-1 -the requested workflow,the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCellValue(page, 'A1', '2');
  await setCellValue(page, 'B1', '3');
  await setFormula(page, 'C1', '=A1+B1');
  await expect(cell(page, 'C1')).toHaveText('5');
  await selectCell(page, 'C1');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A1+B1');
  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('2');
  await expect(cell(page, 'B1')).toHaveText('3');
  await expect(cell(page, 'C1')).toHaveText('5');
  await selectCell(page, 'C1');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A1+B1');
});

test('REQ-4-1-1#2: REQ-4-1-1 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCellValue(page, 'A1', '10');
  await setCellValue(page, 'B1', '2');
  await setCellValue(page, 'C1', '3');
  await setFormula(page, 'D1', '=(A1+B1)*C1/2');
  await expect(cell(page, 'D1')).toHaveText('18');
  await selectCell(page, 'D1');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=(A1+B1)*C1/2');
  await page.reload();
  await expect(cell(page, 'D1')).toHaveText('18');
  await selectCell(page, 'D1');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=(A1+B1)*C1/2');
});

test('REQ-4-1-1#3: REQ-4-1-1 -the requested workflow, the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCellValue(page, 'A1', '10');
  await setCellValue(page, 'A2', '20');
  await setCellValue(page, 'A4', '30');
  await setCellValue(page, 'A5', 'text');
  await setFormula(page, 'B1', '=SUM(A1:A5)');
  await setFormula(page, 'B2', '=AVERAGE(A1:A5)');
  await setFormula(page, 'B3', '=COUNT(A1:A5)');
  await setFormula(page, 'B4', '=MIN(A1:A5)');
  await setFormula(page, 'B5', '=MAX(A1:A5)');
  await expect(cell(page, 'B1')).toHaveText('60');
  await expect(cell(page, 'B2')).toHaveText('20');
  await expect(cell(page, 'B3')).toHaveText('3');
  await expect(cell(page, 'B4')).toHaveText('10');
  await expect(cell(page, 'B5')).toHaveText('30');
  await page.reload();
  await expect(cell(page, 'B1')).toHaveText('60');
  await expect(cell(page, 'B2')).toHaveText('20');
  await expect(cell(page, 'B3')).toHaveText('3');
});

test('REQ-4-1-1#4: REQ-4-1-1 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCellValue(page, 'A1', '5');
  await setCellValue(page, 'A2', '15');
  await setFormula(page, 'B1', '=sum(A1:A3)');
  await setFormula(page, 'B2', '=AVERAGE(A1:A3)');
  await setFormula(page, 'B3', '=max(A1:A3)');
  await expect(cell(page, 'B1')).toHaveText('20');
  await expect(cell(page, 'B2')).toHaveText('15');
  await expect(cell(page, 'B3')).toHaveText('15');
  await page.reload();
  await expect(cell(page, 'B1')).toHaveText('20');
  await selectCell(page, 'B1');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=sum(A1:A3)');
});

test('REQ-4-1-1#5: REQ-4-1-1 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCellValue(page, 'A1', '4');
  await setCellValue(page, 'A2', '5');
  await setCellValue(page, 'A3', '6');
  await setFormula(page, 'B1', '=A1+A2+A3');
  await expect(cell(page, 'B1')).toHaveText('15');
  await page.reload();
  await expect(cell(page, 'B1')).toHaveText('15');
  await selectCell(page, 'B1');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A1+A2+A3');
});

test('REQ-4-1-2: REQ-4-1-2 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCellValue(page, 'A1', '2');
  await setCellValue(page, 'A2', '3');
  await setCellValue(page, 'A3', '4');
  await setFormula(page, 'B1', '=A1*2');
  await expect(cell(page, 'B1')).toHaveText('2');
  await copyCell(page, 'B1');
  await pasteTo(page, 'B2');
  await expect(cell(page, 'B2')).toHaveText('6');
  await selectCell(page, 'B2');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A2*2');
  await selectCell(page, 'B1');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A1*2');
  await page.reload();
  await expect(cell(page, 'B2')).toHaveText('6');
  await selectCell(page, 'B2');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A2*2');
});

test('REQ-4-1-2#2: REQ-4-1-2 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCellValue(page, 'A1', '2');
  await setCellValue(page, 'B1', '3');
  await setCellValue(page, 'B2', '4');
  await setFormula(page, 'C1', '=$A$1+B1');
  await expect(cell(page, 'C1')).toHaveText('5');
  await copyCell(page, 'C1');
  await pasteTo(page, 'C2');
  await expect(cell(page, 'C2')).toHaveText('6');
  await selectCell(page, 'C2');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=$A$1+B2');
  await setFormula(page, 'E1', '=A2');
  await copyCell(page, 'E1');
  await pasteTo(page, 'D1');
  await expect(cell(page, 'D1')).toHaveText('#REF!');
  await selectCell(page, 'D1');
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=#REF!');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

