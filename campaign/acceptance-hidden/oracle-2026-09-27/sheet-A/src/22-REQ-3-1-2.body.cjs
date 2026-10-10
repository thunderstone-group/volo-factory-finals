// REQ-3-1-2 Paste Two-Dimensional Table Data (external clipboard, Ctrl+V or grid context menu "Paste")

test('REQ-3-1-2 S1: 从 B2 原子粘贴二维表格，保留空字段和矩形外数据', async ({ page }) => {
  await createWorkbook(page);
  await setCells(page, [['A1', 'Outside'], ['E4', 'Keep']]);
  await expectCells(page, { A1: 'Outside', E4: 'Keep' });

  await putOnClipboard(page, 'Alpha\t\t3\nBeta\tTwo\t4');
  await cell(page, 'B2').click();
  await pressCtrlV(page);

  const expected = {
    B2: 'Alpha', C2: '', D2: '3',
    B3: 'Beta', C3: 'Two', D3: '4',
    A1: 'Outside', E4: 'Keep', E2: '', B4: '', A2: '',
  };
  await expectCells(page, expected);
  await page.reload();
  await expectCells(page, expected);
});

test('REQ-3-1-2 S2: 粘贴中任一值违反校验时整批拒绝且不留下部分状态', async ({ page }) => {
  await createWorkbook(page);
  await setCells(page, [['B1', 'Name'], ['C1', 'Score'], ['B2', 'Ann'], ['C2', '10'], ['B3', 'Bob'], ['C3', '20']]);
  await expect(cell(page, 'C3')).toHaveText('20');
  await addNumberRule(page, 'C2', 'C3', 0, 100);

  // C3 would receive 101, outside 0..100: the whole rectangle B2:C3 is rejected.
  await putOnClipboard(page, 'Cat\t50\nDan\t101');
  await cell(page, 'B2').click();
  await pressCtrlV(page);

  await expect(message(page, 'Please enter a number from 0 to 100')).toBeVisible();
  const original = { B2: 'Ann', C2: '10', B3: 'Bob', C3: '20' };
  await expectCells(page, original);
  await page.reload();
  await expectCells(page, original);
  await expect(page.getByRole('gridcell').filter({ hasText: /^(Cat|Dan)$/ })).toHaveCount(0);
});

test('REQ-3-1-2 S3: 右键粘贴替换目标公式并重算依赖项', async ({ page }) => {
  await createWorkbook(page);
  await setCells(page, [['A1', '5'], ['B1', '=A1*2'], ['C1', '=B1+1']]);
  await expectCells(page, { B1: '10', C1: '11' });

  await putOnClipboard(page, '7');
  await cell(page, 'B1').click();
  await cell(page, 'B1').click({ button: 'right' });
  await menuItem(page, 'Paste').click();

  await expectCells(page, { A1: '5', B1: '7', C1: '8' });
  await expectFormula(page, 'B1', '7');
  await page.reload();
  await expectCells(page, { A1: '5', B1: '7', C1: '8' });
  await expectFormula(page, 'B1', '7');
  await expectFormula(page, 'C1', '=B1+1');
});

test('REQ-3-1-2 S4: 从 A1 粘贴单行表格并保持外部单元格不变', async ({ page }) => {
  await createWorkbook(page);
  await setCells(page, [['A2', 'Below'], ['D1', 'Right']]);
  await expectCells(page, { A2: 'Below', D1: 'Right' });

  await putOnClipboard(page, 'East\t1200\tOpen');
  await cell(page, 'A1').click();
  await pressCtrlV(page);

  const expected = { A1: 'East', B1: '1200', C1: 'Open', D1: 'Right', A2: 'Below', B2: '', C2: '' };
  await expectCells(page, expected);
  await page.reload();
  await expectCells(page, expected);
});

test('REQ-3-1-2 S5: 从 C3 粘贴两行两列表格并保留源外内容', async ({ page }) => {
  await createWorkbook(page);
  await setCells(page, [['C2', 'Above'], ['B3', 'Left'], ['E3', 'Right'], ['C5', 'Below']]);
  await expectCells(page, { C2: 'Above', B3: 'Left', E3: 'Right', C5: 'Below' });

  await putOnClipboard(page, 'North\t800\nSouth\t500');
  await cell(page, 'C3').click();
  await pressCtrlV(page);

  const expected = {
    C3: 'North', D3: '800', C4: 'South', D4: '500',
    C2: 'Above', B3: 'Left', E3: 'Right', C5: 'Below', B4: '', E4: '', D2: '', D5: '',
  };
  await expectCells(page, expected);
  await page.reload();
  await expectCells(page, expected);
});
