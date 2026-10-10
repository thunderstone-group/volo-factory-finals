async function snapshotText(page) {
  return (await page.locator('body').innerText()).replace(/\n+/g, ' | ').replace(/( \| [A-Z]?\d*){8,}/g, ' …').slice(0, 700);
}
test('probe validation shift', async ({ page }) => {
  test.setTimeout(40000);
  await createWorkbook(page);
  await setCells(page, [['B1', 'Score'], ['B2', '50']]);
  await expect(cell(page, 'B2')).toHaveText('50');
  await addNumberRule(page, 'B2', 'B2', 0, 100);
  await setCell(page, 'B2', '101');
  await page.waitForTimeout(300);
  console.log('P1 before insert, 101 into B2 =>', JSON.stringify(await cell(page, 'B2').innerText()), '|', await snapshotText(page));
  await page.getByRole('rowheader', { name: '2', exact: true }).click({ button: 'right' });
  await menuItem(page, 'Insert 1 row above').click();
  await page.waitForTimeout(300);
  await setCell(page, 'B2', '101');
  await page.waitForTimeout(300);
  console.log('P2 after insert, 101 into B2 =>', JSON.stringify(await cell(page, 'B2').innerText()), '|', await snapshotText(page));
  await setCell(page, 'B3', '101');
  await page.waitForTimeout(300);
  console.log('P3 101 into B3 =>', JSON.stringify(await cell(page, 'B3').innerText()), '|', await snapshotText(page));
});
test('probe drag select', async ({ page }) => {
  test.setTimeout(40000);
  await createWorkbook(page);
  await selectRange(page, 'A1', 'B3');
  const sel = await page.getByRole('gridcell', { selected: true }).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  console.log('P4 after my drag A1-B3 selected =', JSON.stringify(sel));
  await cell(page, 'A1').dragTo(cell(page, 'B3'));
  const sel2 = await page.getByRole('gridcell', { selected: true }).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  console.log('P5 after dragTo A1-B3 selected =', JSON.stringify(sel2));
  await cell(page, 'A1').click();
  await cell(page, 'B3').click({ modifiers: ['Shift'] });
  const sel3 = await page.getByRole('gridcell', { selected: true }).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  console.log('P6 after shift-click A1,B3 selected =', JSON.stringify(sel3));
});
test('probe formula race', async ({ page }) => {
  test.setTimeout(40000);
  await createWorkbook(page);
  await setCell(page, 'A1', '2'); await expect(cell(page, 'A1')).toHaveText('2');
  await setCell(page, 'B1', '3'); await expect(cell(page, 'B1')).toHaveText('3');
  await setCell(page, 'C1', '=A1+B1');
  await page.waitForTimeout(500);
  console.log('P7 with waits C1 =', JSON.stringify(await cell(page, 'C1').innerText()));
  await setCell(page, 'A2', '2');
  await setCell(page, 'B2', '3');
  await setCell(page, 'C2', '=A2+B2');
  await page.waitForTimeout(800);
  console.log('P8 no waits C2 =', JSON.stringify(await cell(page, 'C2').innerText()));
  await page.reload();
  await expect(cell(page, 'A1')).toHaveText('2');
  console.log('P9 after reload C1 =', JSON.stringify(await cell(page, 'C1').innerText()), 'C2 =', JSON.stringify(await cell(page, 'C2').innerText()));
});
