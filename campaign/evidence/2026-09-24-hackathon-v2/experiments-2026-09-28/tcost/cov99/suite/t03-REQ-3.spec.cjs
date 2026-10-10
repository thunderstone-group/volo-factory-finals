const { test, expect } = require('@playwright/test');

const grid = (page) => page.getByRole('grid', { name: 'Worksheet grid', exact: true });
const cell = (page, coord) => grid(page).getByRole('gridcell', { name: coord, exact: true });
const tab = (page, name) => page.getByRole('tab', { name, exact: true });
const formulaBar = (page) => page.getByLabel('Formula bar', { exact: true });
const menuItem = (page, name) => page.getByRole('menuitem', { name, exact: true });

async function createBlankWorkbook(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
}

async function setCell(page, coord, value) {
  await cell(page, coord).dblclick();
  const editor = page.getByRole('textbox', { name: `Edit ${coord}`, exact: true });
  await expect(editor).toBeVisible();
  await editor.fill(String(value));
  await editor.press('Enter');
}

async function setCellViaFormulaBar(page, coord, value) {
  await cell(page, coord).click();
  const fb = formulaBar(page);
  await fb.fill(String(value));
  await fb.press('Enter');
}

async function dragSelect(page, start, end) {
  const from = await cell(page, start).boundingBox();
  const to = await cell(page, end).boundingBox();
  if (!from || !to) throw new Error('Could not locate cells for drag selection');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 5 });
  await page.mouse.up();
}

async function openDataMenuItem(page, name) {
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await menuItem(page, name).click();
}

async function setNumberValidation(page, startCoord, endCoord, min, max) {
  await dragSelect(page, startCoord, endCoord);
  await openDataMenuItem(page, 'Data validation');
  const dlg = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await expect(dlg).toBeVisible();
  await dlg.getByLabel('Rule type', { exact: true }).click();
  await page.getByRole('option', { name: 'Number range', exact: true }).click();
  await dlg.getByLabel('Minimum', { exact: true }).fill(String(min));
  await dlg.getByLabel('Maximum', { exact: true }).fill(String(max));
  await dlg.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dlg).toBeHidden();
}

async function paste(page, startCoord, text, viaContextMenu = false) {
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
  if (viaContextMenu) {
    await cell(page, startCoord).click({ button: 'right' });
    await menuItem(page, 'Paste').click();
  } else {
    await cell(page, startCoord).click();
    await page.keyboard.press('Control+v');
  }
}

test('REQ-3-1-1: REQ-3-1-1 -the requested workflow,the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCellViaFormulaBar(page, 'A1', 'Old');
  await setCellViaFormulaBar(page, 'B1', '1');

  await cell(page, 'A1').dblclick();
  const editA1 = page.getByRole('textbox', { name: 'Edit A1', exact: true });
  await expect(editA1).toBeVisible();
  await editA1.fill('Pen');
  await editA1.press('Enter');
  await expect(cell(page, 'A1')).toHaveText('Pen');
  await cell(page, 'A1').click();
  await expect(formulaBar(page)).toHaveValue('Pen');

  await cell(page, 'B1').click();
  await formulaBar(page).fill('4');
  await formulaBar(page).press('Enter');
  await cell(page, 'B1').click();
  await expect(cell(page, 'B1')).toHaveText('4');
  await expect(formulaBar(page)).toHaveValue('4');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('Pen');
  await expect(cell(page, 'B1')).toHaveText('4');
  await cell(page, 'A1').click();
  await expect(formulaBar(page)).toHaveValue('Pen');
});

test('REQ-3-1-1#2: REQ-3-1-1 -Escape the requested workflow,the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCellViaFormulaBar(page, 'A1', 'Original');

  await cell(page, 'A1').dblclick();
  const edit = page.getByRole('textbox', { name: 'Edit A1', exact: true });
  await edit.fill('Changed');
  await edit.press('Escape');
  await expect(edit).not.toBeVisible();
  await expect(cell(page, 'A1')).toHaveText('Original');
  await cell(page, 'A1').click();
  await expect(formulaBar(page)).toHaveValue('Original');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('Original');
});

test('REQ-3-1-1#3: REQ-3-1-1 -the requested workflow, the requested workflow, the requested workflow, the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCellViaFormulaBar(page, 'A1', '2');
  await setCellViaFormulaBar(page, 'B1', '3');

  await cell(page, 'C1').click();
  await formulaBar(page).fill('=A1+B1');
  await cell(page, 'D1').click();
  await expect(cell(page, 'C1')).toHaveText('5');
  await cell(page, 'C1').click();
  await expect(formulaBar(page)).toHaveValue('=A1+B1');

  await cell(page, 'D1').click();
  await formulaBar(page).fill('=C1*2');
  await formulaBar(page).press('Enter');
  await expect(cell(page, 'D1')).toHaveText('10');

  await cell(page, 'A1').dblclick();
  const editA1 = page.getByRole('textbox', { name: 'Edit A1', exact: true });
  await editA1.fill('10');
  await editA1.press('Enter');
  await expect(cell(page, 'C1')).toHaveText('13');
  await expect(cell(page, 'D1')).toHaveText('26');

  await page.reload();
  await expect(cell(page, 'C1')).toHaveText('13');
  await expect(cell(page, 'D1')).toHaveText('26');
  await cell(page, 'C1').click();
  await expect(formulaBar(page)).toHaveValue('=A1+B1');
});

test('REQ-3-1-1#4: REQ-3-1-1 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await cell(page, 'A1').dblclick();
  const editA1 = page.getByRole('textbox', { name: 'Edit A1', exact: true });
  await editA1.fill('true');
  await editA1.press('Enter');

  await cell(page, 'B1').dblclick();
  const editB1 = page.getByRole('textbox', { name: 'Edit B1', exact: true });
  await editB1.fill('2024-01-01');
  await editB1.press('Enter');

  await expect(cell(page, 'A1')).toHaveText('true');
  await expect(cell(page, 'B1')).toHaveText('2024-01-01');
  await cell(page, 'A1').click();
  await expect(formulaBar(page)).toHaveValue('true');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('true');
  await expect(cell(page, 'B1')).toHaveText('2024-01-01');
});

test('REQ-3-1-2: REQ-3-1-2 -the requested workflow B2 the requested workflow,the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCellViaFormulaBar(page, 'B2', 'oldB2');
  await setCellViaFormulaBar(page, 'C2', 'oldC2');
  await setCellViaFormulaBar(page, 'B3', 'oldB3');
  await setCellViaFormulaBar(page, 'C3', 'oldC3');
  await setCellViaFormulaBar(page, 'A1', 'keep');

  await paste(page, 'B2', 'X\tY\n1\t');

  await expect(cell(page, 'B2')).toHaveText('X');
  await expect(cell(page, 'C2')).toHaveText('Y');
  await expect(cell(page, 'B3')).toHaveText('1');
  await expect(cell(page, 'C3')).toHaveText('');
  await expect(cell(page, 'A1')).toHaveText('keep');

  await page.reload();
  await expect(cell(page, 'B2')).toHaveText('X');
  await expect(cell(page, 'C2')).toHaveText('Y');
  await expect(cell(page, 'B3')).toHaveText('1');
  await expect(cell(page, 'C3')).toHaveText('');
});

test('REQ-3-1-2#2: REQ-3-1-2 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCellViaFormulaBar(page, 'A1', 'keep');

  await paste(page, 'A1', 'a\tb\nc\td', true);

  await expect(cell(page, 'A1')).toHaveText('a');
  await expect(cell(page, 'B1')).toHaveText('b');
  await expect(cell(page, 'A2')).toHaveText('c');
  await expect(cell(page, 'B2')).toHaveText('d');
  await expect(cell(page, 'C1')).toHaveText('');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('a');
  await expect(cell(page, 'B1')).toHaveText('b');
  await expect(cell(page, 'A2')).toHaveText('c');
  await expect(cell(page, 'B2')).toHaveText('d');
});

test('REQ-3-1-2#3: REQ-3-1-2 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCellViaFormulaBar(page, 'A1', '1');
  await setCellViaFormulaBar(page, 'B1', '2');
  await setCellViaFormulaBar(page, 'A2', '3');
  await setCellViaFormulaBar(page, 'B2', '=A1+B1');
  await setCellViaFormulaBar(page, 'C1', '=B1*2');

  await paste(page, 'A1', '5\t6\n7\t8');

  await expect(cell(page, 'A1')).toHaveText('5');
  await expect(cell(page, 'B1')).toHaveText('6');
  await expect(cell(page, 'A2')).toHaveText('7');
  await expect(cell(page, 'B2')).toHaveText('8');
  await expect(cell(page, 'C1')).toHaveText('12');
  await cell(page, 'B2').click();
  await expect(formulaBar(page)).toHaveValue('8');
  await cell(page, 'C1').click();
  await expect(formulaBar(page)).toHaveValue('=B1*2');

  await page.reload();
  await expect(cell(page, 'C1')).toHaveText('12');
  await expect(cell(page, 'B2')).toHaveText('8');
  await cell(page, 'C1').click();
  await expect(formulaBar(page)).toHaveValue('=B1*2');
});

test('REQ-3-1-2#4: REQ-3-1-2 -the requested workflow A1 the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCellViaFormulaBar(page, 'D1', 'outside');

  await paste(page, 'A1', 'Red\t\nBlue\t42');

  await expect(cell(page, 'A1')).toHaveText('Red');
  await expect(cell(page, 'B1')).toHaveText('');
  await expect(cell(page, 'A2')).toHaveText('Blue');
  await expect(cell(page, 'B2')).toHaveText('42');
  await expect(cell(page, 'D1')).toHaveText('outside');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('Red');
  await expect(cell(page, 'B1')).toHaveText('');
  await expect(cell(page, 'A2')).toHaveText('Blue');
  await expect(cell(page, 'B2')).toHaveText('42');
  await expect(cell(page, 'D1')).toHaveText('outside');
});

test('REQ-3-1-2#5: REQ-3-1-2 -the requested workflow C3 the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCellViaFormulaBar(page, 'C3', '50');
  await setCellViaFormulaBar(page, 'D3', '60');
  await setCellViaFormulaBar(page, 'C4', '70');
  await setCellViaFormulaBar(page, 'D4', '80');
  await setNumberValidation(page, 'C3', 'D4', 0, 100);

  await paste(page, 'C3', '101\t102\n103\t104');

  await expect(page.getByText('Please enter a number from 0 to 100', { exact: true })).toBeVisible();
  await expect(cell(page, 'C3')).toHaveText('50');
  await expect(cell(page, 'D3')).toHaveText('60');
  await expect(cell(page, 'C4')).toHaveText('70');
  await expect(cell(page, 'D4')).toHaveText('80');

  await page.reload();
  await expect(cell(page, 'C3')).toHaveText('50');
  await expect(cell(page, 'D3')).toHaveText('60');
  await expect(cell(page, 'C4')).toHaveText('70');
  await expect(cell(page, 'D4')).toHaveText('80');
});

test('REQ-3-1-3: REQ-3-1-3 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await expect(grid(page)).toHaveAttribute('aria-multiselectable', 'true');

  await cell(page, 'A1').click();
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'B1')).toHaveAttribute('aria-selected', 'false');

  await dragSelect(page, 'A1', 'B2');
  for (const coord of ['A1', 'B1', 'A2', 'B2']) {
    await expect(cell(page, coord)).toHaveAttribute('aria-selected', 'true');
  }
  for (const coord of ['C1', 'D1', 'C2']) {
    await expect(cell(page, coord)).toHaveAttribute('aria-selected', 'false');
  }

  await page.reload();
  for (const coord of ['A1', 'B1', 'A2', 'B2']) {
    await expect(cell(page, coord)).toHaveAttribute('aria-selected', 'true');
  }
  for (const coord of ['C1', 'D1', 'C2']) {
    await expect(cell(page, coord)).toHaveAttribute('aria-selected', 'false');
  }
});

test('REQ-3-1-3#2: REQ-3-1-3 -the requested workflow,the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);

  await dragSelect(page, 'A1', 'B2');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');

  await cell(page, 'C1').click();
  await expect(cell(page, 'C1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'false');

  await dragSelect(page, 'A1', 'B2');
  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
  await expect(tab(page, 'Sheet2')).toHaveAttribute('aria-selected', 'true');

  await tab(page, 'Sheet1').click();
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'B2')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'C1')).toHaveAttribute('aria-selected', 'false');
});

test('REQ-3-2-1: REQ-3-2-1 -the requested workflow A1:B2 the requested workflow D1:E2,the requested workflow, the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCellViaFormulaBar(page, 'A1', 'Item');
  await setCellViaFormulaBar(page, 'B1', 'Qty');
  await setCellViaFormulaBar(page, 'A2', 'Pen');
  await setCellViaFormulaBar(page, 'B2', '4');

  await dragSelect(page, 'A1', 'B2');
  await page.keyboard.press('Control+c');
  await cell(page, 'D1').click();
  await page.keyboard.press('Control+v');

  await expect(cell(page, 'D1')).toHaveText('Item');
  await expect(cell(page, 'E1')).toHaveText('Qty');
  await expect(cell(page, 'D2')).toHaveText('Pen');
  await expect(cell(page, 'E2')).toHaveText('4');
  await expect(cell(page, 'A1')).toHaveText('Item');
  await expect(cell(page, 'B2')).toHaveText('4');

  await page.reload();
  await expect(cell(page, 'D1')).toHaveText('Item');
  await expect(cell(page, 'E1')).toHaveText('Qty');
  await expect(cell(page, 'D2')).toHaveText('Pen');
  await expect(cell(page, 'E2')).toHaveText('4');
});

test('REQ-3-2-1#2: REQ-3-2-1 -the requested workflow A1:B2 the requested workflow D1:E2,the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCellViaFormulaBar(page, 'A1', 'a');
  await setCellViaFormulaBar(page, 'B1', 'b');
  await setCellViaFormulaBar(page, 'A2', 'c');
  await setCellViaFormulaBar(page, 'B2', 'd');

  await dragSelect(page, 'A1', 'B2');
  await page.keyboard.press('Control+x');
  await cell(page, 'D1').click();
  await page.keyboard.press('Control+v');

  await expect(cell(page, 'D1')).toHaveText('a');
  await expect(cell(page, 'E1')).toHaveText('b');
  await expect(cell(page, 'D2')).toHaveText('c');
  await expect(cell(page, 'E2')).toHaveText('d');
  await expect(cell(page, 'A1')).toHaveText('');
  await expect(cell(page, 'B1')).toHaveText('');
  await expect(cell(page, 'A2')).toHaveText('');
  await expect(cell(page, 'B2')).toHaveText('');

  await page.reload();
  await expect(cell(page, 'D1')).toHaveText('a');
  await expect(cell(page, 'E1')).toHaveText('b');
  await expect(cell(page, 'D2')).toHaveText('c');
  await expect(cell(page, 'E2')).toHaveText('d');
  await expect(cell(page, 'A1')).toHaveText('');
  await expect(cell(page, 'B2')).toHaveText('');
});

test('REQ-3-2-1#3: REQ-3-2-1 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCellViaFormulaBar(page, 'A1', '2');
  await setCellViaFormulaBar(page, 'B1', '3');
  await setCellViaFormulaBar(page, 'A2', '=A1*$B$1');
  await setCellViaFormulaBar(page, 'B2', '=A1+B1');

  await dragSelect(page, 'A1', 'B2');
  await page.keyboard.press('Control+c');
  await cell(page, 'D1').click();
  await page.keyboard.press('Control+v');

  await expect(cell(page, 'D2')).toHaveText('6');
  await expect(cell(page, 'E2')).toHaveText('5');
  await cell(page, 'D2').click();
  await expect(formulaBar(page)).toHaveValue('=D1*$B$1');
  await cell(page, 'E2').click();
  await expect(formulaBar(page)).toHaveValue('=D1+E1');
  await cell(page, 'A2').click();
  await expect(formulaBar(page)).toHaveValue('=A1*$B$1');
  await cell(page, 'B2').click();
  await expect(formulaBar(page)).toHaveValue('=A1+B1');

  await page.reload();
  await expect(cell(page, 'D2')).toHaveText('6');
  await expect(cell(page, 'E2')).toHaveText('5');
  await cell(page, 'D2').click();
  await expect(formulaBar(page)).toHaveValue('=D1*$B$1');
});

test('REQ-3-2-1#4: REQ-3-2-1 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCellViaFormulaBar(page, 'A1', '101');
  await setCellViaFormulaBar(page, 'B1', '102');
  await setCellViaFormulaBar(page, 'A2', '103');
  await setCellViaFormulaBar(page, 'B2', '104');
  await setCellViaFormulaBar(page, 'D1', '50');
  await setCellViaFormulaBar(page, 'E1', '60');
  await setCellViaFormulaBar(page, 'D2', '70');
  await setCellViaFormulaBar(page, 'E2', '80');
  await setNumberValidation(page, 'D1', 'E2', 0, 100);

  await dragSelect(page, 'A1', 'B2');
  await page.keyboard.press('Control+c');
  await cell(page, 'D1').click();
  await page.keyboard.press('Control+v');

  await expect(page.getByText('Please enter a number from 0 to 100', { exact: true })).toBeVisible();
  await expect(cell(page, 'D1')).toHaveText('50');
  await expect(cell(page, 'E1')).toHaveText('60');
  await expect(cell(page, 'D2')).toHaveText('70');
  await expect(cell(page, 'E2')).toHaveText('80');
  await expect(cell(page, 'A1')).toHaveText('101');

  await page.reload();
  await expect(cell(page, 'D1')).toHaveText('50');
  await expect(cell(page, 'E1')).toHaveText('60');
  await expect(cell(page, 'D2')).toHaveText('70');
  await expect(cell(page, 'E2')).toHaveText('80');
});

test('REQ-3-2-2: REQ-3-2-2 -the requested workflow,the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCellViaFormulaBar(page, 'A1', 'old');
  await setCellViaFormulaBar(page, 'A1', 'new');
  await expect(cell(page, 'A1')).toHaveText('new');

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(cell(page, 'A1')).toHaveText('old');

  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(cell(page, 'A1')).toHaveText('new');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('new');
});

test('REQ-3-2-2#2: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCellViaFormulaBar(page, 'A1', 'old');
  await paste(page, 'A1', 'X');
  await expect(cell(page, 'A1')).toHaveText('X');

  await page.keyboard.press('Control+z');
  await expect(cell(page, 'A1')).toHaveText('old');

  await page.keyboard.press('Control+y');
  await expect(cell(page, 'A1')).toHaveText('X');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('X');
});

test('REQ-3-2-2#3: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCellViaFormulaBar(page, 'A1', 'start');
  await setCellViaFormulaBar(page, 'A1', 'first');
  await setCellViaFormulaBar(page, 'A1', 'second');

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(cell(page, 'A1')).toHaveText('first');

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(cell(page, 'A1')).toHaveText('start');

  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(cell(page, 'A1')).toHaveText('first');

  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(cell(page, 'A1')).toHaveText('second');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('second');
});

test('REQ-3-2-2#4: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCellViaFormulaBar(page, 'A2', 'data');

  await page.getByRole('rowheader', { name: '2', exact: true }).click({ button: 'right' });
  await menuItem(page, 'Insert 1 row above').click();

  await expect(cell(page, 'A2')).toHaveText('');
  await expect(cell(page, 'A3')).toHaveText('data');

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(cell(page, 'A2')).toHaveText('data');
  await expect(cell(page, 'A3')).toHaveText('');

  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(cell(page, 'A2')).toHaveText('');
  await expect(cell(page, 'A3')).toHaveText('data');

  await page.reload();
  await expect(cell(page, 'A2')).toHaveText('');
  await expect(cell(page, 'A3')).toHaveText('data');
});

test('REQ-3-2-2#5: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCellViaFormulaBar(page, 'A1', 'a');
  await setCellViaFormulaBar(page, 'B1', 'b');
  await setCellViaFormulaBar(page, 'A2', 'c');
  await setCellViaFormulaBar(page, 'B2', 'd');

  await dragSelect(page, 'A1', 'B2');
  await page.keyboard.press('Control+x');
  await cell(page, 'D1').click();
  await page.keyboard.press('Control+v');

  await expect(cell(page, 'D1')).toHaveText('a');
  await expect(cell(page, 'A1')).toHaveText('');

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(cell(page, 'A1')).toHaveText('a');
  await expect(cell(page, 'B2')).toHaveText('d');
  await expect(cell(page, 'D1')).toHaveText('');

  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(cell(page, 'A1')).toHaveText('');
  await expect(cell(page, 'D1')).toHaveText('a');
  await expect(cell(page, 'E2')).toHaveText('d');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('');
  await expect(cell(page, 'D1')).toHaveText('a');
  await expect(cell(page, 'E2')).toHaveText('d');
});

test('REQ-3-2-2#6: REQ-3-2-2 -the requested workflow', async ({ page, context }) => {
  await createBlankWorkbook(page);
  await setCellViaFormulaBar(page, 'A1', 'one');

  const page2 = await context.newPage();
  await createBlankWorkbook(page2);
  await setCellViaFormulaBar(page2, 'B1', 'two');

  await page.bringToFront();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(cell(page, 'A1')).toHaveText('');

  await page2.bringToFront();
  await expect(cell(page2, 'B1')).toHaveText('two');
});

test('REQ-3-2-2#7: REQ-3-2-2 -the requested workflow', async ({ page }) => {
  await createBlankWorkbook(page);
  await setCellViaFormulaBar(page, 'A1', 'old');
  await setCellViaFormulaBar(page, 'A1', 'branch1');

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(cell(page, 'A1')).toHaveText('old');

  await setCellViaFormulaBar(page, 'A1', 'new');
  await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeDisabled();

  await page.keyboard.press('Control+y');
  await expect(cell(page, 'A1')).toHaveText('new');

  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('new');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

