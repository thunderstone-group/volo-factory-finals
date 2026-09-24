const { test, expect } = require('@playwright/test');
const f = require('./fixtures.cjs');

const grid = (page) => page.getByRole('grid', { name: 'Worksheet grid', exact: true });
const cell = (page, coord) => grid(page).getByRole('gridcell', { name: coord, exact: true });
const formulaBar = (page) => page.getByLabel('Formula bar', { exact: true });

test('REQ-4-1-1: Perform arithmetic using referenced cells', async ({ page }) => {
  await f.createWorkbook(page);
  await f.enterCells(page, { A1: '3', B1: '4' });
  await f.enterCell(page, 'C1', '=(A1+B1)*2');

  await expect(cell(page, 'C1')).toHaveText('14');
  await cell(page, 'C1').click();
  await expect(formulaBar(page)).toHaveValue('=(A1+B1)*2');

  await page.reload();
  await expect(cell(page, 'C1')).toHaveText('14');
  await cell(page, 'C1').click();
  await expect(formulaBar(page)).toHaveValue('=(A1+B1)*2');
});

test('REQ-4-1-1#2: Calculate aggregate functions over a contiguous range', async ({ page }) => {
  await f.createWorkbook(page);
  await f.enterCells(page, { B2: '2', B4: '4', B6: '6' });
  await f.enterCells(page, {
    D2: '=sum(B2:B10)',
    D3: '=AVERAGE(B2:B10)',
    D4: '=COUNT(B2:B10)',
    D5: '=MIN(B2:B10)',
    D6: '=MAX(B2:B10)',
  });

  await expect(cell(page, 'D2')).toHaveText('12');
  await expect(cell(page, 'D3')).toHaveText('4');
  await expect(cell(page, 'D4')).toHaveText('3');
  await expect(cell(page, 'D5')).toHaveText('2');
  await expect(cell(page, 'D6')).toHaveText('6');
});

test('REQ-4-1-2: Copy a formula downward', async ({ page }) => {
  await f.createWorkbook(page);
  await f.enterCells(page, { A1: '1', B1: '2', A2: '10', C1: '=A1+$B$1' });

  await cell(page, 'C1').click();
  await f.copySelection(page);
  await cell(page, 'C2').click();
  await f.pasteSelection(page);

  await expect(cell(page, 'C2')).toHaveText('12');
  await cell(page, 'C2').click();
  await expect(formulaBar(page)).toHaveValue('=A2+$B$1');

  await expect(cell(page, 'C1')).toHaveText('3');
  await cell(page, 'C1').click();
  await expect(formulaBar(page)).toHaveValue('=A1+$B$1');

  await page.reload();
  await expect(cell(page, 'C2')).toHaveText('12');
  await cell(page, 'C2').click();
  await expect(formulaBar(page)).toHaveValue('=A2+$B$1');
  await expect(cell(page, 'C1')).toHaveText('3');
  await cell(page, 'C1').click();
  await expect(formulaBar(page)).toHaveValue('=A1+$B$1');
});

test('REQ-4-2-1: Update multi-level formula dependencies', async ({ page }) => {
  await f.createWorkbook(page);
  await f.enterCells(page, { A1: '10', B1: '=A1*2', C1: '=B1+5' });
  await f.addWorksheet(page);
  await f.enterCells(page, { A1: 'Other', B1: '=1+1' });
  await f.switchToSheet(page, 'Sheet1');
  await f.enterCell(page, 'A1', '20');

  await expect(cell(page, 'B1')).toHaveText('40');
  await cell(page, 'B1').click();
  await expect(formulaBar(page)).toHaveValue('=A1*2');

  await expect(cell(page, 'C1')).toHaveText('45');
  await cell(page, 'C1').click();
  await expect(formulaBar(page)).toHaveValue('=B1+5');

  await f.switchToSheet(page, 'Sheet2');
  await expect(cell(page, 'A1')).toHaveText('Other');
  await expect(cell(page, 'B1')).toHaveText('2');
  await cell(page, 'B1').click();
  await expect(formulaBar(page)).toHaveValue('=1+1');

  await f.switchToSheet(page, 'Sheet1');
  await page.reload();
  await expect(cell(page, 'B1')).toHaveText('40');
  await expect(cell(page, 'C1')).toHaveText('45');
  await cell(page, 'C1').click();
  await expect(formulaBar(page)).toHaveValue('=B1+5');
});

test('REQ-4-2-1#2: Recalculate dependent formulas after moving a source value', async ({ page }) => {
  await f.createWorkbook(page);
  await f.enterCells(page, { A1: '2', B1: '3', C1: '=B1*2', D1: '=C1+1' });

  await cell(page, 'A1').click();
  await f.cutSelection(page);
  await cell(page, 'B1').click();
  await f.pasteSelection(page);

  await expect(cell(page, 'A1')).toHaveText('');
  await expect(cell(page, 'B1')).toHaveText('2');
  await expect(cell(page, 'C1')).toHaveText('4');
  await cell(page, 'C1').click();
  await expect(formulaBar(page)).toHaveValue('=B1*2');
  await expect(cell(page, 'D1')).toHaveText('5');
  await cell(page, 'D1').click();
  await expect(formulaBar(page)).toHaveValue('=C1+1');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('');
  await expect(cell(page, 'B1')).toHaveText('2');
  await expect(cell(page, 'C1')).toHaveText('4');
  await cell(page, 'C1').click();
  await expect(formulaBar(page)).toHaveValue('=B1*2');
  await expect(cell(page, 'D1')).toHaveText('5');
  await cell(page, 'D1').click();
  await expect(formulaBar(page)).toHaveValue('=C1+1');
});

test('REQ-4-2-2: Isolate invalid formulas', async ({ page }) => {
  await f.createWorkbook(page);
  await f.enterCells(page, { A1: 'Keep' });
  await f.enterCells(page, {
    B1: '=1/0',
    B2: '=A0',
    B3: '=UNSUPPORTED(1)',
    B4: '=1+',
    B5: '=B5',
  });

  const cases = [
    ['B1', '=1/0', '#DIV/0!'],
    ['B2', '=A0', '#REF!'],
    ['B3', '=UNSUPPORTED(1)', '#NAME?'],
    ['B4', '=1+', '#ERROR!'],
    ['B5', '=B5', '#REF!'],
  ];
  for (const [coord, expr, error] of cases) {
    await expect(cell(page, coord)).toHaveText(error);
    await cell(page, coord).click();
    await expect(formulaBar(page)).toHaveValue(expr);
  }

  await f.enterCell(page, 'A1', 'Modified');
  await expect(cell(page, 'A1')).toHaveText('Modified');
});

test('REQ-4-2-2#2: Correct an erroneous formula', async ({ page }) => {
  await f.createWorkbook(page);
  await f.enterCells(page, { A1: '2', B1: '=1/0' });
  await expect(cell(page, 'B1')).toHaveText('#DIV/0!');

  await f.enterCell(page, 'B1', '=A1*3');

  await expect(cell(page, 'B1')).toHaveText('6');
  await cell(page, 'B1').click();
  await expect(formulaBar(page)).toHaveValue('=A1*3');

  await page.reload();
  await expect(cell(page, 'B1')).toHaveText('6');
  await cell(page, 'B1').click();
  await expect(formulaBar(page)).toHaveValue('=A1*3');
});
