const { test, expect } = require('@playwright/test');

async function openNewWorkbook(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
}

function cell(page, coord) {
  return page
    .getByRole('grid', { name: 'Worksheet grid', exact: true })
    .getByRole('gridcell', { name: coord, exact: true });
}

async function setCell(page, coord, value) {
  await cell(page, coord).click();
  const bar = page.getByLabel('Formula bar', { exact: true });
  await bar.fill(value);
  await bar.press('Enter');
}

async function expectCellValue(page, coord, value) {
  await expect(cell(page, coord)).toHaveText(value);
}

async function selectRange(page, startCoord, endCoord) {
  const start = cell(page, startCoord);
  const end = cell(page, endCoord);
  await start.click();
  const startBox = await start.boundingBox();
  const endBox = await end.boundingBox();
  await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(endBox.x + endBox.width / 2, endBox.y + endBox.height / 2, { steps: 5 });
  await page.mouse.up();
}

async function writeClipboard(page, text) {
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
}

test('REQ-3-1-1: REQ-3-1-1 -the requested workflow,the requested workflow', async ({ page }) => {
  await openNewWorkbook(page);
  await setCell(page, 'A1', '2');
  await setCell(page, 'B1', '3');
  await setCell(page, 'C1', '=A1+B1');
  await setCell(page, 'D1', '=C1*2');

  await expectCellValue(page, 'C1', '5');
  await expectCellValue(page, 'D1', '10');

  await setCell(page, 'A1', '5');
  await expectCellValue(page, 'C1', '8');
  await expectCellValue(page, 'D1', '16');

  await cell(page, 'C1').click();
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A1+B1');
  await cell(page, 'D1').click();
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=C1*2');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await expectCellValue(page, 'A1', '5');
  await expectCellValue(page, 'C1', '8');
  await expectCellValue(page, 'D1', '16');
  await cell(page, 'C1').click();
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A1+B1');
});

test('REQ-3-1-1#2: REQ-3-1-1 -Escape the requested workflow,the requested workflow', async ({ page }) => {
  await openNewWorkbook(page);
  await setCell(page, 'A1', 'keep');

  await cell(page, 'A1').dblclick();
  const editor = page.getByLabel('Edit A1', { exact: true });
  await editor.fill('changed');
  await editor.press('Escape');

  await expectCellValue(page, 'A1', 'keep');
  await cell(page, 'A1').click();
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('keep');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await expectCellValue(page, 'A1', 'keep');
});

test('REQ-3-1-1#3: REQ-3-1-1 -the requested workflow, the requested workflow, the requested workflow, the requested workflow', async ({ page }) => {
  await openNewWorkbook(page);
  await setCell(page, 'A1', '10');
  await setCell(page, 'B1', '=A1*2');
  await expectCellValue(page, 'B1', '20');

  await cell(page, 'A1').dblclick();
  const editor = page.getByLabel('Edit A1', { exact: true });
  await editor.fill('25');
  await editor.press('Enter');

  await expectCellValue(page, 'A1', '25');
  await expectCellValue(page, 'B1', '50');
  await cell(page, 'B1').click();
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A1*2');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await expectCellValue(page, 'A1', '25');
  await expectCellValue(page, 'B1', '50');
});

test('REQ-3-1-1#4: REQ-3-1-1 -the requested workflow', async ({ page }) => {
  await openNewWorkbook(page);
  await cell(page, 'A1').click();
  await page.getByLabel('Formula bar', { exact: true }).fill('world');
  await cell(page, 'B1').click();

  await expectCellValue(page, 'A1', 'world');
  await cell(page, 'A1').click();
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('world');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await expectCellValue(page, 'A1', 'world');
  await cell(page, 'A1').click();
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('world');
});

test('REQ-3-1-2: REQ-3-1-2 -the requested workflow B2 the requested workflow,the requested workflow', async ({ page }) => {
  await openNewWorkbook(page);
  await setCell(page, 'B2', 'old');
  await setCell(page, 'C2', 'old');
  await setCell(page, 'B3', 'old');
  await setCell(page, 'C3', 'old');

  await cell(page, 'B2').click();
  await writeClipboard(page, 'x\t\n1\t2');
  await page.keyboard.press('Control+V');

  await expectCellValue(page, 'B2', 'x');
  await expectCellValue(page, 'C2', '');
  await expectCellValue(page, 'B3', '1');
  await expectCellValue(page, 'C3', '2');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await expectCellValue(page, 'B2', 'x');
  await expectCellValue(page, 'C2', '');
  await expectCellValue(page, 'B3', '1');
  await expectCellValue(page, 'C3', '2');
});

test('REQ-3-1-2#2: REQ-3-1-2 -the requested workflow', async ({ page }) => {
  await openNewWorkbook(page);
  await writeClipboard(page, 'a\tb\nc\td');
  await cell(page, 'A1').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Paste', exact: true }).click();

  await expectCellValue(page, 'A1', 'a');
  await expectCellValue(page, 'B1', 'b');
  await expectCellValue(page, 'A2', 'c');
  await expectCellValue(page, 'B2', 'd');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await expectCellValue(page, 'A1', 'a');
  await expectCellValue(page, 'B1', 'b');
  await expectCellValue(page, 'A2', 'c');
  await expectCellValue(page, 'B2', 'd');
});

test('REQ-3-1-2#3: REQ-3-1-2 -the requested workflow', async ({ page }) => {
  await openNewWorkbook(page);
  await setCell(page, 'A1', '2');
  await setCell(page, 'B1', '3');
  await setCell(page, 'C1', '=A1+B1');
  await expectCellValue(page, 'C1', '5');

  await cell(page, 'A1').click();
  await writeClipboard(page, '10\t20');
  await page.keyboard.press('Control+V');

  await expectCellValue(page, 'A1', '10');
  await expectCellValue(page, 'B1', '20');
  await expectCellValue(page, 'C1', '30');
  await cell(page, 'C1').click();
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=A1+B1');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await expectCellValue(page, 'A1', '10');
  await expectCellValue(page, 'B1', '20');
  await expectCellValue(page, 'C1', '30');
});

test('REQ-3-1-2#4: REQ-3-1-2 -the requested workflow A1 the requested workflow', async ({ page }) => {
  await openNewWorkbook(page);
  await setCell(page, 'A1', 'old1');
  await setCell(page, 'B1', 'old2');
  await setCell(page, 'A2', 'old3');
  await setCell(page, 'B2', 'old4');
  await setCell(page, 'C1', 'outside');

  await cell(page, 'A1').click();
  await writeClipboard(page, 'a\tb\nc\td');
  await page.keyboard.press('Control+V');

  await expectCellValue(page, 'A1', 'a');
  await expectCellValue(page, 'B1', 'b');
  await expectCellValue(page, 'A2', 'c');
  await expectCellValue(page, 'B2', 'd');
  await expectCellValue(page, 'C1', 'outside');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await expectCellValue(page, 'A1', 'a');
  await expectCellValue(page, 'B1', 'b');
  await expectCellValue(page, 'A2', 'c');
  await expectCellValue(page, 'B2', 'd');
  await expectCellValue(page, 'C1', 'outside');
});

test('REQ-3-1-2#5: REQ-3-1-2 -the requested workflow C3 the requested workflow', async ({ page }) => {
  await openNewWorkbook(page);
  await setCell(page, 'C3', 'old1');
  await setCell(page, 'D3', 'old2');
  await setCell(page, 'C4', 'old3');
  await setCell(page, 'D4', 'old4');

  await cell(page, 'C3').click();
  await writeClipboard(page, 'Alpha\tBeta\n1\t');
  await page.keyboard.press('Control+V');

  await expectCellValue(page, 'C3', 'Alpha');
  await expectCellValue(page, 'D3', 'Beta');
  await expectCellValue(page, 'C4', '1');
  await expectCellValue(page, 'D4', '');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await expectCellValue(page, 'C3', 'Alpha');
  await expectCellValue(page, 'D3', 'Beta');
  await expectCellValue(page, 'C4', '1');
  await expectCellValue(page, 'D4', '');
});

test('REQ-3-1-3: REQ-3-1-3 -the requested workflow', async ({ page }) => {
  await openNewWorkbook(page);
  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();

  const grid = page.getByRole('grid', { name: 'Worksheet grid', exact: true });
  await expect(grid).toHaveAttribute('aria-multiselectable', 'true');

  await selectRange(page, 'A1', 'B2');
  for (const coord of ['A1', 'B1', 'A2', 'B2']) {
    await expect(cell(page, coord)).toHaveAttribute('aria-selected', 'true');
  }
  for (const coord of ['C1', 'D1', 'A3']) {
    await expect(cell(page, coord)).toHaveAttribute('aria-selected', 'false');
  }

  await page.getByRole('tab', { name: 'Sheet2', exact: true }).click();
  await cell(page, 'C3').click();
  await expect(cell(page, 'C3')).toHaveAttribute('aria-selected', 'true');

  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  for (const coord of ['A1', 'B1', 'A2', 'B2']) {
    await expect(cell(page, coord)).toHaveAttribute('aria-selected', 'true');
  }
  await expect(cell(page, 'C1')).toHaveAttribute('aria-selected', 'false');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  for (const coord of ['A1', 'B1', 'A2', 'B2']) {
    await expect(cell(page, coord)).toHaveAttribute('aria-selected', 'true');
  }
  await expect(cell(page, 'C1')).toHaveAttribute('aria-selected', 'false');
});

test('REQ-3-1-3#2: REQ-3-1-3 -the requested workflow,the requested workflow', async ({ page }) => {
  await openNewWorkbook(page);
  await selectRange(page, 'D1', 'E2');

  for (const coord of ['D1', 'E1', 'D2', 'E2']) {
    await expect(cell(page, coord)).toHaveAttribute('aria-selected', 'true');
  }
  for (const coord of ['A1', 'B1', 'C1']) {
    await expect(cell(page, coord)).toHaveAttribute('aria-selected', 'false');
  }

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  for (const coord of ['D1', 'E1', 'D2', 'E2']) {
    await expect(cell(page, coord)).toHaveAttribute('aria-selected', 'true');
  }
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'false');

  await cell(page, 'A1').click();
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'D1')).toHaveAttribute('aria-selected', 'false');
});

test('REQ-3-2-1: REQ-3-2-1 -the requested workflow A1:B2 the requested workflow D1:E2,the requested workflow, the requested workflow', async ({ page }) => {
  await openNewWorkbook(page);
  await setCell(page, 'A1', '10');
  await setCell(page, 'B1', '5');
  await setCell(page, 'A2', '=A1+B1');
  await setCell(page, 'B2', '=A1*B1');
  await expectCellValue(page, 'A2', '15');
  await expectCellValue(page, 'B2', '50');

  await selectRange(page, 'A1', 'B2');
  await page.keyboard.press('Control+C');
  await cell(page, 'D1').click();
  await page.keyboard.press('Control+V');

  await expectCellValue(page, 'D1', '10');
  await expectCellValue(page, 'E1', '5');
  await expectCellValue(page, 'D2', '15');
  await expectCellValue(page, 'E2', '50');
  await expectCellValue(page, 'A1', '10');
  await expectCellValue(page, 'B2', '50');

  await cell(page, 'D2').click();
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=D1+E1');
  await cell(page, 'E2').click();
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=D1*E1');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await expectCellValue(page, 'D1', '10');
  await expectCellValue(page, 'E1', '5');
  await expectCellValue(page, 'D2', '15');
  await expectCellValue(page, 'E2', '50');
  await cell(page, 'D2').click();
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=D1+E1');
});

test('REQ-3-2-1#2: REQ-3-2-1 -the requested workflow A1:B2 the requested workflow D1:E2,the requested workflow', async ({ page }) => {
  await openNewWorkbook(page);
  await setCell(page, 'A1', 'x');
  await setCell(page, 'B1', 'y');
  await setCell(page, 'A2', 'z');
  await setCell(page, 'B2', 'w');

  await selectRange(page, 'A1', 'B2');
  await page.keyboard.press('Control+X');
  await cell(page, 'D1').click();
  await page.keyboard.press('Control+V');

  await expectCellValue(page, 'D1', 'x');
  await expectCellValue(page, 'E1', 'y');
  await expectCellValue(page, 'D2', 'z');
  await expectCellValue(page, 'E2', 'w');
  await expectCellValue(page, 'A1', '');
  await expectCellValue(page, 'B1', '');
  await expectCellValue(page, 'A2', '');
  await expectCellValue(page, 'B2', '');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await expectCellValue(page, 'D1', 'x');
  await expectCellValue(page, 'E1', 'y');
  await expectCellValue(page, 'D2', 'z');
  await expectCellValue(page, 'E2', 'w');
  await expectCellValue(page, 'A1', '');
  await expectCellValue(page, 'B1', '');
  await expectCellValue(page, 'A2', '');
  await expectCellValue(page, 'B2', '');
});

test('REQ-3-2-1#3: REQ-3-2-1 -the requested workflow', async ({ page }) => {
  await openNewWorkbook(page);
  await setCell(page, 'A1', '2');
  await setCell(page, 'B1', '3');
  await setCell(page, 'C1', '=$A$1+B1');
  await expectCellValue(page, 'C1', '5');

  await cell(page, 'C1').click();
  await page.keyboard.press('Control+C');
  await cell(page, 'D1').click();
  await page.keyboard.press('Control+V');

  await expectCellValue(page, 'D1', '7');
  await cell(page, 'D1').click();
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=$A$1+C1');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await expectCellValue(page, 'D1', '7');
  await cell(page, 'D1').click();
  await expect(page.getByLabel('Formula bar', { exact: true })).toHaveValue('=$A$1+C1');
});

test('REQ-3-2-1#4: REQ-3-2-1 -the requested workflow', async ({ page }) => {
  await openNewWorkbook(page);
  await setCell(page, 'A1', '1');
  await setCell(page, 'B1', '2');
  await setCell(page, 'A2', '3');
  await setCell(page, 'B2', '4');
  await setCell(page, 'C3', 'outside');

  await selectRange(page, 'A1', 'B2');
  await page.keyboard.press('Control+C');
  await cell(page, 'D1').click();
  await page.keyboard.press('Control+V');

  await expectCellValue(page, 'D1', '1');
  await expectCellValue(page, 'E1', '2');
  await expectCellValue(page, 'D2', '3');
  await expectCellValue(page, 'E2', '4');
  await expectCellValue(page, 'C3', 'outside');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sheet1', exact: true })).toBeVisible();
  await expectCellValue(page, 'D1', '1');
  await expectCellValue(page, 'E1', '2');
  await expectCellValue(page, 'D2', '3');
  await expectCellValue(page, 'E2', '4');
  await expectCellValue(page, 'C3', 'outside');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

