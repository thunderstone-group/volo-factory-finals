const { test, expect } = require('@playwright/test');

async function createBlankWorkbook(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
}

function cell(page, coord) {
  return page.getByRole('gridcell', { name: coord, exact: true });
}

function formulaBar(page) {
  return page.getByLabel('Formula bar', { exact: true });
}

async function clickCell(page, coord) {
  await cell(page, coord).click();
}

async function setCell(page, coord, value) {
  await clickCell(page, coord);
  const bar = formulaBar(page);
  await expect(bar).toHaveValue('');
  await bar.fill(value);
  await page.keyboard.press('Enter');
}

async function dragRange(page, start, end) {
  const from = cell(page, start);
  const to = cell(page, end);
  const fromBox = await from.boundingBox();
  const toBox = await to.boundingBox();
  if (!fromBox || !toBox) throw new Error('Grid cells for drag range are not visible');
  await page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(toBox.x + toBox.width / 2, toBox.y + toBox.height / 2, { steps: 5 });
  await page.mouse.up();
}

async function reloadEditor(page) {
  await page.reload();
  await expect(page.getByRole('grid', { name: 'Worksheet grid', exact: true })).toBeVisible();
}

test('REQ-3-1-1: Edit a cell and preserve it after refresh', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCell(page, 'A1', '2');
  await setCell(page, 'B1', '=A1*2');
  await expect(cell(page, 'B1')).toHaveText('4');

  await clickCell(page, 'A1');
  const bar = formulaBar(page);
  await expect(bar).toHaveValue('2');
  await bar.fill('3');
  await page.keyboard.press('Enter');

  await expect(cell(page, 'A1')).toHaveText('3');
  await expect(cell(page, 'B1')).toHaveText('6');
  await clickCell(page, 'A1');
  await expect(bar).toHaveValue('3');
  await clickCell(page, 'B1');
  await expect(bar).toHaveValue('=A1*2');

  await reloadEditor(page);
  await expect(cell(page, 'A1')).toHaveText('3');
  await expect(cell(page, 'B1')).toHaveText('6');
  await clickCell(page, 'B1');
  await expect(formulaBar(page)).toHaveValue('=A1*2');
});

test('REQ-3-1-1#2: Cancel an uncommitted edit', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCell(page, 'A1', 'Saved value');

  await clickCell(page, 'A1');
  const bar = formulaBar(page);
  await expect(bar).toHaveValue('Saved value');

  await cell(page, 'A1').dblclick();
  const editor = page.getByRole('textbox', { name: 'Edit A1', exact: true });
  await expect(editor).toBeVisible();
  await editor.fill('Unsaved value');
  await page.keyboard.press('Escape');

  await expect(editor).not.toBeVisible();
  await expect(cell(page, 'A1')).toHaveText('Saved value');
  await expect(bar).toHaveValue('Saved value');

  await reloadEditor(page);
  await expect(cell(page, 'A1')).toHaveText('Saved value');
  await expect(page.getByText('Unsaved value', { exact: true })).toHaveCount(0);
});

test('REQ-3-1-2: Paste multi-row, multi-column data', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCell(page, 'A1', 'Outside');
  await setCell(page, 'E4', 'Keep');

  const clipboardText = 'Alpha\t\t3\nBeta\tTwo\t4';
  await page.evaluate((t) => navigator.clipboard.writeText(t), clipboardText);

  await clickCell(page, 'B2');
  await page.keyboard.press('Control+V');

  await expect(cell(page, 'B2')).toHaveText('Alpha');
  await expect(cell(page, 'C2')).toHaveText('');
  await expect(cell(page, 'D2')).toHaveText('3');
  await expect(cell(page, 'B3')).toHaveText('Beta');
  await expect(cell(page, 'C3')).toHaveText('Two');
  await expect(cell(page, 'D3')).toHaveText('4');
  await expect(cell(page, 'A1')).toHaveText('Outside');
  await expect(cell(page, 'E4')).toHaveText('Keep');

  await reloadEditor(page);
  await expect(cell(page, 'B2')).toHaveText('Alpha');
  await expect(cell(page, 'C2')).toHaveText('');
  await expect(cell(page, 'D2')).toHaveText('3');
  await expect(cell(page, 'B3')).toHaveText('Beta');
  await expect(cell(page, 'C3')).toHaveText('Two');
  await expect(cell(page, 'D3')).toHaveText('4');
  await expect(cell(page, 'A1')).toHaveText('Outside');
  await expect(cell(page, 'E4')).toHaveText('Keep');
});

test('REQ-3-1-3: Select an exact rectangular range', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCell(page, 'A1', 'H1');
  await setCell(page, 'B1', 'H2');
  await setCell(page, 'A2', 'R2A');
  await setCell(page, 'B2', 'R2B');
  await setCell(page, 'A3', 'R3A');
  await setCell(page, 'B3', 'R3B');
  await setCell(page, 'C1', 'Adjacent');

  await dragRange(page, 'A1', 'B3');

  for (const coord of ['A1', 'B1', 'A2', 'B2', 'A3', 'B3']) {
    await expect(cell(page, coord)).toHaveAttribute('aria-selected', 'true');
  }
  for (const coord of ['C1', 'C2', 'C3', 'A4', 'B4']) {
    await expect(cell(page, coord)).toHaveAttribute('aria-selected', 'false');
  }

  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Create pivot table', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create pivot table', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Source range: A1:B3');

  await reloadEditor(page);
  for (const coord of ['A1', 'B1', 'A2', 'B2', 'A3', 'B3']) {
    await expect(cell(page, coord)).toHaveAttribute('aria-selected', 'true');
  }
  for (const coord of ['C1', 'C2', 'C3', 'A4', 'B4']) {
    await expect(cell(page, coord)).toHaveAttribute('aria-selected', 'false');
  }

  await clickCell(page, 'C1');
  await expect(cell(page, 'C1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'false');

  await reloadEditor(page);
  await expect(cell(page, 'C1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'false');
});

test('REQ-3-2-1: Copy a range to a new location', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCell(page, 'G1', 'Keep');
  await setCell(page, 'A1', '1');
  await setCell(page, 'B1', '2');
  await setCell(page, 'A2', '3');
  await setCell(page, 'B2', '=A1+$B$1');
  await expect(cell(page, 'B2')).toHaveText('3');

  await dragRange(page, 'A1', 'B2');
  await page.keyboard.press('Control+C');
  await clickCell(page, 'D1');
  await page.keyboard.press('Control+V');

  await expect(cell(page, 'D1')).toHaveText('1');
  await expect(cell(page, 'E1')).toHaveText('2');
  await expect(cell(page, 'D2')).toHaveText('3');
  await expect(cell(page, 'E2')).toHaveText('3');
  await expect(cell(page, 'A1')).toHaveText('1');
  await expect(cell(page, 'B1')).toHaveText('2');
  await expect(cell(page, 'A2')).toHaveText('3');
  await expect(cell(page, 'B2')).toHaveText('3');
  await expect(cell(page, 'G1')).toHaveText('Keep');

  await clickCell(page, 'E2');
  await expect(formulaBar(page)).toHaveValue('=D1+$B$1');

  await reloadEditor(page);
  await expect(cell(page, 'D1')).toHaveText('1');
  await expect(cell(page, 'E1')).toHaveText('2');
  await expect(cell(page, 'D2')).toHaveText('3');
  await expect(cell(page, 'E2')).toHaveText('3');
  await expect(cell(page, 'A1')).toHaveText('1');
  await expect(cell(page, 'B1')).toHaveText('2');
  await expect(cell(page, 'A2')).toHaveText('3');
  await expect(cell(page, 'B2')).toHaveText('3');
  await expect(cell(page, 'G1')).toHaveText('Keep');

  await clickCell(page, 'E2');
  await expect(formulaBar(page)).toHaveValue('=D1+$B$1');
});

test('REQ-3-2-1#2: Cut and move a range', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCell(page, 'G1', 'Keep');
  await setCell(page, 'A1', 'A');
  await setCell(page, 'B1', 'B');
  await setCell(page, 'A2', 'C');
  await setCell(page, 'B2', 'D');

  await dragRange(page, 'A1', 'B2');
  await page.keyboard.press('Control+X');
  await clickCell(page, 'D1');
  await page.keyboard.press('Control+V');

  await expect(cell(page, 'D1')).toHaveText('A');
  await expect(cell(page, 'E1')).toHaveText('B');
  await expect(cell(page, 'D2')).toHaveText('C');
  await expect(cell(page, 'E2')).toHaveText('D');
  await expect(cell(page, 'A1')).toHaveText('');
  await expect(cell(page, 'B1')).toHaveText('');
  await expect(cell(page, 'A2')).toHaveText('');
  await expect(cell(page, 'B2')).toHaveText('');
  await expect(cell(page, 'G1')).toHaveText('Keep');

  await reloadEditor(page);
  await expect(cell(page, 'D1')).toHaveText('A');
  await expect(cell(page, 'E1')).toHaveText('B');
  await expect(cell(page, 'D2')).toHaveText('C');
  await expect(cell(page, 'E2')).toHaveText('D');
  await expect(cell(page, 'A1')).toHaveText('');
  await expect(cell(page, 'B1')).toHaveText('');
  await expect(cell(page, 'A2')).toHaveText('');
  await expect(cell(page, 'B2')).toHaveText('');
  await expect(cell(page, 'G1')).toHaveText('Keep');
});
