const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function nextSheetName(names) {
  for (let i = 1; ; i++) {
    const candidate = `Sheet${i}`;
    if (!names.includes(candidate)) return candidate;
  }
}

function nextPivotName(names) {
  for (let i = 1; ; i++) {
    const candidate = `Pivot${i}`;
    if (!names.includes(candidate)) return candidate;
  }
}

async function tabNames(page) {
  return page.getByRole('tab').evaluateAll((els) =>
    els.map((el) => (el.getAttribute('aria-label') || el.textContent || '').trim())
  );
}

// REQ-1-2-1 / REQ-1-2-2 / REQ-1-1-1
async function createWorkbook(page, { name } = {}) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New blank workbook', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.getByRole('grid', { name: 'Worksheet grid', exact: true }).waitFor();
  if (name) await renameWorkbook(page, name);
  return { name: name || null, url: page.url() };
}

// REQ-1-2-2
async function renameWorkbook(page, newName) {
  await page.getByRole('button', { name: 'Rename workbook', exact: true }).click();
  const input = page.getByLabel('Workbook name', { exact: true });
  await input.fill(newName);
  await input.press('Enter');
}

// REQ-1-1-1
async function openWorkbook(page, name) {
  await page.goto('/');
  await page.getByRole('link', { name, exact: true }).click();
  await page.getByRole('grid', { name: 'Worksheet grid', exact: true }).waitFor();
  return page.url();
}

// REQ-2-1-1
async function addWorksheet(page) {
  const before = await tabNames(page);
  await page.getByRole('button', { name: 'Add worksheet', exact: true }).click();
  const name = nextSheetName(before);
  await page.getByRole('tab', { name, exact: true }).waitFor();
  return name;
}

// REQ-2-1-3
async function renameWorksheet(page, currentName, newName) {
  await page.getByRole('button', { name: `Worksheet options for ${currentName}`, exact: true }).click();
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  const input = page.getByLabel('Worksheet name', { exact: true });
  await input.fill(newName);
  await input.press('Enter');
  return newName;
}

// REQ-2-1-4
async function deleteWorksheet(page, name, { confirm = true } = {}) {
  await page.getByRole('button', { name: `Worksheet options for ${name}`, exact: true }).click();
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete worksheet', exact: true });
  const appeared = await dialog
    .waitFor({ state: 'visible', timeout: 2000 })
    .then(() => true)
    .catch(() => false);
  if (appeared && confirm) {
    await dialog.getByRole('button', { name: 'Delete worksheet', exact: true }).click();
  }
  return appeared;
}

// REQ-2-1-2
async function switchToSheet(page, name) {
  await page.getByRole('tab', { name, exact: true }).click();
}

// REQ-3-1-1
async function enterCell(page, coord, value) {
  const grid = page.getByRole('grid', { name: 'Worksheet grid', exact: true });
  await grid.getByRole('gridcell', { name: coord, exact: true }).click();
  const bar = page.getByLabel('Formula bar', { exact: true });
  const text = value === undefined || value === null ? '' : String(value);
  await bar.fill(text);
  await bar.press('Enter');
}

// REQ-3-1-1 / REQ-3-1-2 / REQ-4-1-1
async function enterCells(page, data) {
  const entries = Array.isArray(data) ? data : Object.entries(data);
  for (const [coord, value] of entries) {
    await enterCell(page, coord, value);
  }
}

// REQ-3-1-1 / REQ-3-1-3
async function inlineEdit(page, coord, value) {
  await page.getByRole('gridcell', { name: coord, exact: true }).dblclick();
  const editor = page.getByLabel(`Edit ${coord}`, { exact: true });
  await editor.fill(String(value));
  await editor.press('Enter');
}

// REQ-3-1-3
async function selectRange(page, startCoord, endCoord) {
  const grid = page.getByRole('grid', { name: 'Worksheet grid', exact: true });
  const start = await grid.getByRole('gridcell', { name: startCoord, exact: true }).boundingBox();
  const end = await grid.getByRole('gridcell', { name: endCoord, exact: true }).boundingBox();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 8 });
  await page.mouse.up();
}

// REQ-3-2-1
async function copySelection(page) {
  await page.keyboard.press('Control+c');
}

// REQ-3-2-1
async function cutSelection(page) {
  await page.keyboard.press('Control+x');
}

// REQ-3-1-2 / REQ-3-2-1
async function pasteSelection(page) {
  await page.keyboard.press('Control+v');
}

// REQ-3-1-2
async function pasteViaContextMenu(page, coord) {
  await page.getByRole('gridcell', { name: coord, exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Paste', exact: true }).click();
}

// REQ-3-1-2
async function setClipboardText(page, text) {
  await page.evaluate(async (t) => {
    await navigator.clipboard.writeText(t);
  }, text);
}

// REQ-5-1-1 / REQ-5-1-2 / REQ-5-2-1 / REQ-5-3-1
async function chooseOption(scope, label, optionName) {
  await scope.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: optionName, exact: true }).click();
}

// REQ-5 / REQ-5-1 / REQ-5-2 / REQ-5-3
async function dataCommand(page, command) {
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByRole('menuitem', { name: command, exact: true }).click();
}

// REQ-5-1-1
async function sortRange(page, startCoord, endCoord, { sortBy, order, hasHeader = false } = {}) {
  await selectRange(page, startCoord, endCoord);
  await dataCommand(page, 'Sort range');
  const dialog = page.getByRole('dialog', { name: 'Sort range', exact: true });
  await chooseOption(dialog, 'Sort by', sortBy);
  await chooseOption(dialog, 'Order', order);
  if (hasHeader) {
    await dialog.getByRole('checkbox', { name: 'Data has header row', exact: true }).check();
  }
  await dialog.getByRole('button', { name: 'Sort', exact: true }).click();
}

// REQ-5-1-2
async function createFilter(page, startCoord, endCoord) {
  await selectRange(page, startCoord, endCoord);
  await dataCommand(page, 'Create filter');
}

// REQ-5-1-2
async function filterByValues(page, header, values) {
  await page.getByRole('button', { name: `Filter ${header}`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: `Filter ${header}`, exact: true });
  await dialog.getByRole('button', { name: 'Clear selection', exact: true }).click();
  for (const value of values) {
    await dialog.getByRole('checkbox', { name: value, exact: true }).check();
  }
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
}

// REQ-5-1-2
async function filterByCondition(page, header, condition, value) {
  await page.getByRole('button', { name: `Filter ${header}`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: `Filter ${header}`, exact: true });
  await chooseOption(dialog, 'Condition', condition);
  if (value !== undefined) {
    await dialog.getByLabel('Value', { exact: true }).fill(String(value));
  }
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
}

// REQ-5-1-2
async function clearFilter(page) {
  await dataCommand(page, 'Clear filter');
}

// REQ-5-2-1
async function setDataValidation(page, startCoord, endCoord, rule) {
  await selectRange(page, startCoord, endCoord);
  await dataCommand(page, 'Data validation');
  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });

  if (rule.type === 'Dropdown') {
    await chooseOption(dialog, 'Rule type', 'Dropdown');
    await dialog.getByLabel('Allowed values', { exact: true }).fill(rule.allowedValues.join(', '));
  } else if (rule.type === 'Number range') {
    await chooseOption(dialog, 'Rule type', 'Number range');
    await dialog.getByLabel('Minimum', { exact: true }).fill(String(rule.min));
    await dialog.getByLabel('Maximum', { exact: true }).fill(String(rule.max));
  } else {
    throw new Error(`Unsupported validation rule type: ${rule.type}`);
  }

  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
}

// REQ-5-2-1
async function deleteValidationRule(page, startCoord, endCoord) {
  await selectRange(page, startCoord, endCoord);
  await dataCommand(page, 'Data validation');
  const dialog = page.getByRole('dialog', { name: 'Data validation', exact: true });
  await dialog.getByRole('button', { name: 'Delete rule', exact: true }).click();
}

// REQ-5-2-1
async function chooseDropdownOption(page, coord, optionText) {
  await page.getByRole('button', { name: `Open dropdown for ${coord}`, exact: true }).click();
  await page.getByRole('option', { name: optionText, exact: true }).click();
}

// REQ-2-2-1
async function rowCommand(page, rowNumber, command) {
  await page.getByRole('rowheader', { name: String(rowNumber), exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: command, exact: true }).click();
}

async function insertRowAbove(page, rowNumber) {
  await rowCommand(page, rowNumber, 'Insert 1 row above');
}

async function insertRowBelow(page, rowNumber) {
  await rowCommand(page, rowNumber, 'Insert 1 row below');
}

async function deleteRow(page, rowNumber) {
  await rowCommand(page, rowNumber, 'Delete row');
}

// REQ-2-2-2
async function columnCommand(page, columnLetter, command) {
  await page.getByRole('columnheader', { name: columnLetter, exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: command, exact: true }).click();
}

async function insertColumnLeft(page, columnLetter) {
  await columnCommand(page, columnLetter, 'Insert 1 column left');
}

async function insertColumnRight(page, columnLetter) {
  await columnCommand(page, columnLetter, 'Insert 1 column right');
}

async function deleteColumn(page, columnLetter) {
  await columnCommand(page, columnLetter, 'Delete column');
}

// REQ-5-3-1
async function createPivot(page, startCoord, endCoord, { rows, columns, values, summarizeBy } = {}) {
  const before = await tabNames(page);
  const pivotName = nextPivotName(before);

  await selectRange(page, startCoord, endCoord);
  await dataCommand(page, 'Create pivot table');
  const dialog = page.getByRole('dialog', { name: 'Create pivot table', exact: true });
  await dialog.getByRole('radio', { name: 'New worksheet', exact: true }).check();
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();

  const editor = page.getByRole('region', { name: 'Pivot table editor', exact: true });
  await editor.waitFor();
  if (rows) await chooseOption(editor, 'Rows', rows);
  if (columns) await chooseOption(editor, 'Columns', columns);
  if (values) await chooseOption(editor, 'Values', values);
  if (summarizeBy) await chooseOption(editor, 'Summarize by', summarizeBy);
  await editor.getByRole('button', { name: 'Apply', exact: true }).click();

  return pivotName;
}

// REQ-5-3-1
async function refreshPivot(page) {
  await page.getByRole('button', { name: 'Refresh pivot table', exact: true }).click();
}

// REQ-1-3-2
async function exportCsv(page) {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  return downloadPromise;
}

// REQ-1-3-1
async function importCsv(page, { content, fileName = `${u()}.csv`, waitForGrid = true } = {}) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Import CSV', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import CSV', exact: true });
  const safeFileName = /\.csv$/i.test(fileName) ? fileName : `${fileName}.csv`;
  const baseName = safeFileName.replace(/\.csv$/i, '');
  const buffer = Buffer.from(content || '', 'utf8');
  await dialog.getByLabel('CSV file', { exact: true }).setInputFiles({
    name: safeFileName,
    mimeType: 'text/csv',
    buffer,
  });
  await dialog.getByRole('button', { name: 'Confirm import', exact: true }).click();
  if (waitForGrid) {
    await page.getByRole('grid', { name: 'Worksheet grid', exact: true }).waitFor();
  }
  return { name: baseName, url: page.url() };
}

// REQ-3-2-2
async function undo(page) {
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
}

// REQ-3-2-2
async function redo(page) {
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
}

module.exports = {
  // REQ-1-1-1
  u,
  openWorkbook,
  // REQ-1-2-1 / REQ-1-2-2
  createWorkbook,
  renameWorkbook,
  // REQ-2-1-1 / REQ-2-1-2 / REQ-2-1-3 / REQ-2-1-4
  addWorksheet,
  switchToSheet,
  renameWorksheet,
  deleteWorksheet,
  // REQ-3-1-1 / REQ-3-1-3 / REQ-3-1-2
  enterCell,
  enterCells,
  inlineEdit,
  selectRange,
  // REQ-3-2-1
  copySelection,
  cutSelection,
  pasteSelection,
  pasteViaContextMenu,
  setClipboardText,
  // REQ-5-1-1 / REQ-5-1-2 / REQ-5-2-1 / REQ-5-3-1
  chooseOption,
  dataCommand,
  sortRange,
  createFilter,
  filterByValues,
  filterByCondition,
  clearFilter,
  setDataValidation,
  deleteValidationRule,
  chooseDropdownOption,
  // REQ-2-2-1 / REQ-2-2-2
  insertRowAbove,
  insertRowBelow,
  deleteRow,
  insertColumnLeft,
  insertColumnRight,
  deleteColumn,
  // REQ-5-3-1
  createPivot,
  refreshPivot,
  // REQ-1-3-2 / REQ-1-3-1
  exportCsv,
  importCsv,
  // REQ-3-2-2
  undo,
  redo,
};
