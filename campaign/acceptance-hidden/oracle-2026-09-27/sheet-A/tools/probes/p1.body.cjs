async function dumpText(page, label) {
  const alerts = await page.getByRole('alert').allInnerTexts().catch(() => []);
  const body = (await page.locator('body').innerText()).replace(/\n+/g, ' | ').slice(0, 600);
  console.log(`[${label}] alerts=${JSON.stringify(alerts)}\n   body=${body}`);
}
test('probe validation', async ({ page }) => {
  test.setTimeout(30000);
  await createWorkbook(page);
  await setCells(page, [['B1', 'Score'], ['B2', '50']]);
  await addNumberRule(page, 'B2', 'B2', 0, 100);
  await setCell(page, 'B2', '101');
  await page.waitForTimeout(500);
  await dumpText(page, 'after 101 in B2');
  console.log('B2 text', await cell(page, 'B2').innerText());
});
test('probe dropdown', async ({ page }) => {
  test.setTimeout(30000);
  await createWorkbook(page);
  await setCells(page, [['C1', 'Status'], ['C2', 'Open'], ['C3', 'Closed']]);
  await selectRange(page, 'C2', 'C3');
  await dataMenu(page, 'Data validation');
  const dlg = dialog(page, 'Data validation');
  console.log('dialog html', (await dlg.innerHTML()).slice(0, 1500));
  await choose(page, dlg, 'Rule type', 'Dropdown');
  await dlg.getByRole('textbox', { name: 'Allowed values', exact: true }).fill('Open, Closed');
  await btn(dlg, 'Save').click();
  await page.waitForTimeout(500);
  await dumpText(page, 'after dropdown save');
  const names = await page.getByRole('button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') || e.textContent.trim()));
  console.log('buttons', JSON.stringify(names));
});
test('probe pivot', async ({ page }) => {
  test.setTimeout(30000);
  await createWorkbook(page);
  await setCells(page, [['A1', 'Region'], ['B1', 'Sales'], ['A2', 'East'], ['B2', '1200'], ['A3', 'North'], ['B3', '800']]);
  await createPivot(page, 'A1', 'B3', { rows: 'Region', values: 'Sales', summarize: 'SUM' });
  await page.waitForTimeout(800);
  await dumpText(page, 'after pivot apply');
  const tabs = await page.getByRole('tab').allInnerTexts();
  console.log('tabs', JSON.stringify(tabs));
  const region = page.getByRole('region', { name: 'Pivot table editor', exact: true });
  console.log('editor html', (await region.innerHTML()).slice(0, 2000));
});
test('probe inline enter', async ({ page }) => {
  test.setTimeout(30000);
  await createWorkbook(page);
  await cell(page, 'A1').dblclick();
  const editor = page.getByRole('textbox', { name: 'Edit A1', exact: true });
  await editor.fill('Hello');
  await editor.press('Enter');
  await page.waitForTimeout(500);
  console.log('editor visible after Enter:', await editor.isVisible(), 'A1 text:', await cell(page, 'A1').innerText());
  const editors = await page.getByRole('textbox').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  console.log('textboxes', JSON.stringify(editors));
  await cell(page, 'A1').dblclick();
  const ed2 = page.getByRole('textbox', { name: 'Edit A1', exact: true });
  await ed2.fill('World');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  console.log('after keyboard Enter visible:', await ed2.isVisible(), 'A1:', await cell(page, 'A1').innerText());
});
