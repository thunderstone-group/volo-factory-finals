async function tryPaste(page, how, target) {
  await putOnClipboard(page, `X-${how}`);
  await cell(page, target).click();
  const info = await page.evaluate(() => ({ platform: navigator.platform, active: document.activeElement && (document.activeElement.getAttribute('aria-label') || document.activeElement.tagName) }));
  if (how === 'ctrl') await page.keyboard.press('Control+V');
  if (how === 'meta') await page.keyboard.press('Meta+V');
  if (how === 'synthetic') await page.evaluate(() => {
    const data = new DataTransfer(); data.setData('text/plain', 'X-synthetic');
    (document.activeElement || document.body).dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true, composed: true }));
  });
  await page.waitForTimeout(600);
  console.log(how, JSON.stringify(info), '=>', JSON.stringify(await cell(page, target).innerText()));
}
test('probe paste modes', async ({ page }) => {
  test.setTimeout(40000);
  await createWorkbook(page);
  await tryPaste(page, 'ctrl', 'A1');
  await tryPaste(page, 'synthetic', 'A2');
  await tryPaste(page, 'meta', 'A3');
  await putOnClipboard(page, 'X-menu');
  await cell(page, 'A4').click();
  await cell(page, 'A4').click({ button: 'right' });
  const items = await page.getByRole('menuitem').allInnerTexts();
  console.log('context menu items', JSON.stringify(items));
});
test('probe delete pivot source', async ({ page }) => {
  test.setTimeout(40000);
  await createWorkbook(page);
  await setCells(page, [['A1', 'Region'], ['B1', 'Sales'], ['A2', 'East'], ['B2', '1200'], ['A3', 'North'], ['B3', '800']]);
  await createPivot(page, 'A1', 'B3', { rows: 'Region', values: 'Sales', summarize: 'SUM' });
  await expect(cell(page, 'B4')).toHaveText('2000');
  await tab(page, 'Sheet1').click();
  await sheetMenu(page, 'Sheet1', 'Delete');
  await page.waitForTimeout(800);
  const dialogs = await page.getByRole('dialog').allInnerTexts();
  const alerts = await page.getByRole('alert').allInnerTexts();
  console.log('dialogs', JSON.stringify(dialogs), 'alerts', JSON.stringify(alerts));
  console.log('body', (await page.locator('body').innerText()).replace(/\n+/g, ' | ').slice(0, 500));
});
