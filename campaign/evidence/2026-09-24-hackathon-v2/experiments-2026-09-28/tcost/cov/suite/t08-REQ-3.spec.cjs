const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const grid = (page) => page.getByRole('grid', { name: 'Worksheet grid', exact: true });
const cell = (page, coord) => grid(page).getByRole('gridcell', { name: coord, exact: true });
const formulaBar = (page) => page.getByLabel('Formula bar', { exact: true });

async function createWorkbook(page, name) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(grid(page)).toBeVisible();

  await page.getByRole('button', { name: 'Rename workbook', exact: true }).click();
  await page.getByLabel('Workbook name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByLabel('Workbook name', { exact: true })).toBeHidden();
  await expect(grid(page)).toBeVisible();
}

async function setCell(page, coord, value) {
  await cell(page, coord).click();
  await formulaBar(page).fill(value);
  await formulaBar(page).press('Enter');
}

async function selectRange(page, start, end) {
  const startCell = cell(page, start);
  const endCell = cell(page, end);
  await startCell.scrollIntoViewIfNeeded();
  await endCell.scrollIntoViewIfNeeded();

  const startBox = await startCell.boundingBox();
  const endBox = await endCell.boundingBox();
  if (!startBox || !endBox) {
    throw new Error(`Range cells not visible: ${start} to ${end}`);
  }

  await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(endBox.x + endBox.width / 2, endBox.y + endBox.height / 2, { steps: 5 });
  await page.mouse.up();
}

async function chooseOption(page, scope, label, optionText) {
  await scope.getByLabel(label, { exact: true }).click();
  await page.getByRole('option', { name: optionText, exact: true }).click();
}

async function setNumberValidation(page, start, end, min, max) {
  await selectRange(page, start, end);
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Data validation', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await expect(dialog).toBeVisible();
  await chooseOption(page, dialog, 'Rule type', 'Number range');
  await dialog.getByLabel('Minimum', { exact: true }).fill(String(min));
  await dialog.getByLabel('Maximum', { exact: true }).fill(String(max));
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

async function expectSelection(page, selected, unselected) {
  await expect(grid(page)).toHaveAttribute('aria-multiselectable', 'true');
  for (const coord of selected) {
    await expect(cell(page, coord)).toHaveAttribute('aria-selected', 'true');
  }
  for (const coord of unselected) {
    await expect(cell(page, coord)).toHaveAttribute('aria-selected', 'false');
  }
}

async function pasteViaContextMenu(page, coord, text) {
  await cell(page, coord).click();
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
  await cell(page, coord).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Paste', exact: true }).click();
}

async function pasteViaKeyboard(page, coord, text) {
  await cell(page, coord).click();
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
  await page.keyboard.press('Control+V');
}

test('REQ-3-1-2: REQ-3-1-2 -the requested workflow B2 the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbook(page, `PasteCtx${u()}`);

  await setCell(page, 'B2', '4');
  await setCell(page, 'C2', '=B2*2');
  await setCell(page, 'C4', '=C2+C3');
  await setCell(page, 'D2', 'keep');

  await pasteViaContextMenu(page, 'B2', 'East\t1200\nNorth\t800');

  await expect(cell(page, 'B2')).toHaveText('East');
  await expect(cell(page, 'C2')).toHaveText('1200');
  await expect(cell(page, 'B3')).toHaveText('North');
  await expect(cell(page, 'C3')).toHaveText('800');
  await expect(cell(page, 'D2')).toHaveText('keep');
  await expect(cell(page, 'C4')).toHaveText('2000');

  await cell(page, 'C2').click();
  await expect(formulaBar(page)).toHaveValue('1200');
  await cell(page, 'C4').click();
  await expect(formulaBar(page)).toHaveValue('=C2+C3');

  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(cell(page, 'B2')).toHaveText('East');
  await expect(cell(page, 'C2')).toHaveText('1200');
  await expect(cell(page, 'B3')).toHaveText('North');
  await expect(cell(page, 'C3')).toHaveText('800');
  await expect(cell(page, 'C4')).toHaveText('2000');
});

test('REQ-3-1-2#2: REQ-3-1-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page, `PasteVal${u()}`);

  await setCell(page, 'D1', '10');
  await setCell(page, 'E1', '20');
  await setCell(page, 'D2', '30');
  await setCell(page, 'E2', '40');
  await setNumberValidation(page, 'D1', 'E2', 0, 100);

  await pasteViaKeyboard(page, 'D1', '200\t5\n5\t200');

  await expect(page.getByText('Please enter a number from 0 to 100', { exact: true })).toBeVisible();
  await expect(cell(page, 'D1')).toHaveText('10');
  await expect(cell(page, 'E1')).toHaveText('20');
  await expect(cell(page, 'D2')).toHaveText('30');
  await expect(cell(page, 'E2')).toHaveText('40');

  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(cell(page, 'D1')).toHaveText('10');
  await expect(cell(page, 'E1')).toHaveText('20');
  await expect(cell(page, 'D2')).toHaveText('30');
  await expect(cell(page, 'E2')).toHaveText('40');
});

test('REQ-3-1-2#3: REQ-3-1-2 -the requested workflow', async ({ page }) => {
  await createWorkbook(page, `PasteCalc${u()}`);

  await setCell(page, 'A1', '1');
  await setCell(page, 'A2', '2');
  await setCell(page, 'D1', '=A1+A2');
  await setCell(page, 'F1', '=D1*2');
  await expect(cell(page, 'F1')).toHaveText('6');

  await pasteViaKeyboard(page, 'D1', '10\t20\n30\t40');

  await expect(cell(page, 'D1')).toHaveText('10');
  await expect(cell(page, 'E1')).toHaveText('20');
  await expect(cell(page, 'D2')).toHaveText('30');
  await expect(cell(page, 'E2')).toHaveText('40');
  await expect(cell(page, 'F1')).toHaveText('20');
  await expect(cell(page, 'A1')).toHaveText('1');
  await expect(cell(page, 'A2')).toHaveText('2');

  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(cell(page, 'D1')).toHaveText('10');
  await expect(cell(page, 'E1')).toHaveText('20');
  await expect(cell(page, 'D2')).toHaveText('30');
  await expect(cell(page, 'E2')).toHaveText('40');
  await expect(cell(page, 'F1')).toHaveText('20');
});

test('REQ-3-1-2#4: REQ-3-1-2 -the requested workflow A1 the requested workflow', async ({ page }) => {
  await createWorkbook(page, `PasteA1${u()}`);

  await setCell(page, 'A1', '=1+1');
  await setCell(page, 'B1', 'old');
  await setCell(page, 'A2', 'old');
  await setCell(page, 'B2', 'old');
  await setCell(page, 'C1', 'keep');

  await pasteViaContextMenu(page, 'A1', 'alpha\tbeta\ngamma\tdelta');

  await expect(cell(page, 'A1')).toHaveText('alpha');
  await expect(cell(page, 'B1')).toHaveText('beta');
  await expect(cell(page, 'A2')).toHaveText('gamma');
  await expect(cell(page, 'B2')).toHaveText('delta');
  await expect(cell(page, 'C1')).toHaveText('keep');

  await cell(page, 'A1').click();
  await expect(formulaBar(page)).toHaveValue('alpha');

  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(cell(page, 'A1')).toHaveText('alpha');
  await expect(cell(page, 'B1')).toHaveText('beta');
  await expect(cell(page, 'A2')).toHaveText('gamma');
  await expect(cell(page, 'B2')).toHaveText('delta');
  await expect(cell(page, 'C1')).toHaveText('keep');
});

test('REQ-3-1-2#5: REQ-3-1-2 -the requested workflow C3 the requested workflow', async ({ page }) => {
  await createWorkbook(page, `PasteC3${u()}`);

  await setCell(page, 'C3', 'old');
  await setCell(page, 'D3', 'old');
  await setCell(page, 'C4', 'old');
  await setCell(page, 'D4', 'old');
  await setCell(page, 'E3', 'keep');

  await pasteViaKeyboard(page, 'C3', 'alpha\t\n\tbeta');

  await expect(cell(page, 'C3')).toHaveText('alpha');
  await expect(cell(page, 'D3')).toHaveText(/^\s*$/);
  await expect(cell(page, 'C4')).toHaveText(/^\s*$/);
  await expect(cell(page, 'D4')).toHaveText('beta');
  await expect(cell(page, 'E3')).toHaveText('keep');

  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(cell(page, 'C3')).toHaveText('alpha');
  await expect(cell(page, 'D3')).toHaveText(/^\s*$/);
  await expect(cell(page, 'C4')).toHaveText(/^\s*$/);
  await expect(cell(page, 'D4')).toHaveText('beta');
  await expect(cell(page, 'E3')).toHaveText('keep');
});

test('REQ-3-1-3: REQ-3-1-3 -the requested workflow', async ({ page }) => {
  await createWorkbook(page, `SelectRect${u()}`);

  await selectRange(page, 'A1', 'B2');
  await expectSelection(page, ['A1', 'A2', 'B1', 'B2'], ['C1', 'A3']);

  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expectSelection(page, ['A1', 'A2', 'B1', 'B2'], ['C1', 'A3']);

  await cell(page, 'C1').click();
  await expectSelection(page, ['C1'], ['A1', 'A2', 'B1', 'B2']);
});

test('REQ-3-1-3#2: REQ-3-1-3 -the requested workflow,the requested workflow', async ({ page }) => {
  await createWorkbook(page, `SelectInd${u()}`);

  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Sheet2', exact: true })).toHaveAttribute('aria-selected', 'true');

  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await selectRange(page, 'B2', 'C3');
  await expectSelection(page, ['B2', 'B3', 'C2', 'C3'], ['D2', 'A2', 'B1', 'C4']);

  await page.getByRole('tab', { name: 'Sheet2', exact: true }).click();
  await expect(cell(page, 'A1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'B2')).toHaveAttribute('aria-selected', 'false');

  await page.getByRole('tab', { name: 'Sheet1', exact: true }).click();
  await expectSelection(page, ['B2', 'B3', 'C2', 'C3'], ['D2', 'A2', 'B1', 'C4']);

  await selectRange(page, 'D4', 'E5');
  await expectSelection(page, ['D4', 'D5', 'E4', 'E5'], ['B2', 'B3', 'C2', 'C3']);
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

