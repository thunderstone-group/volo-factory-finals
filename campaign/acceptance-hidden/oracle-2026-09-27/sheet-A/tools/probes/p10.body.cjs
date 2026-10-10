test('probe dropdown rule', async ({ page }) => {
  test.setTimeout(40000);
  await createWorkbook(page);
  await setCells(page, [['C1', 'Status'], ['C2', 'Open'], ['C3', 'Closed']]);
  await expect(cell(page, 'C3')).toHaveText('Closed');
  await addDropdownRule(page, 'C2', 'C3', 'Open, Closed');
  await page.waitForTimeout(500);
  const names = await page.getByRole('button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') || e.textContent.trim()).filter((n) => /dropdown|Open|▾|▼/i.test(n)));
  console.log('W1 dropdown-ish buttons', JSON.stringify(names));
  await setCell(page, 'C2', 'Maybe');
  await page.waitForTimeout(400);
  const body = await page.locator('body').innerText();
  console.log('W2 invalid value Maybe => C2 =', JSON.stringify(await cell(page, 'C2').innerText()), '| msg:', (body.match(/Please[^\n]*/) || ['none'])[0]);
  await cell(page, 'C2').click();
  await dataMenu(page, 'Data validation');
  const dlg = dialog(page, 'Data validation');
  const vals = await dlg.locator('input, select, [role=combobox]').evaluateAll((els) => els.map((e) => `${e.getAttribute('aria-label') || e.id || e.name}=${e.value ?? e.textContent}`));
  console.log('W3 reopened', JSON.stringify(vals));
});
