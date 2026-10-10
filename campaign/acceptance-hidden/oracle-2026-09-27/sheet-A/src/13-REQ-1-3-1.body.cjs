// REQ-1-3-1 Import CSV to Create a Workbook
// S2-S4 intents were never returned by the platform (unknown); they are inferred from the description.

test('REQ-1-3-1 S1: 导入 UTF-8 CSV，并在刷新后保持原始行列与特殊字段', async ({ page }) => {
  const name = `utf8-import-${uniq()}`;
  const csv = 'Region,Sales,Note,Empty,备注\n'
    + 'East,1200,"Contains, comma",,华东区\n'
    + 'North,800,"Say ""hi""",,"第一行\n第二行"\n';
  await importCsv(page, `${name}.csv`, csv);

  const expectImported = async () => {
    await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
    await expectCells(page, {
      A1: 'Region', B1: 'Sales', C1: 'Note', D1: 'Empty', E1: '备注',
      A2: 'East', B2: '1200', C2: 'Contains, comma', D2: '', E2: '华东区',
      A3: 'North', B3: '800', C3: 'Say "hi"', D3: '',
      A4: '', F1: '',
    });
    await expect(cell(page, 'E3')).toHaveText('第一行 第二行', { useInnerText: true });
  };
  await expectImported();
  await page.reload();
  await expectImported();
  await page.goto('/');
  await expect(link(page, name)).toBeVisible();
});

test('REQ-1-3-1 S2: （推断）未闭合引号的无效 CSV 被拒绝，首页不出现该工作簿且不显示部分结果', async ({ page }) => {
  const name = `invalid-csv-${uniq()}`;
  await importCsv(page, `${name}.csv`, 'Region,Note\nEast,"unclosed field\nNorth,800\n');
  await expect(message(page, 'Invalid CSV file format. Import failed.')).toBeVisible();
  await expect(page.getByRole('gridcell')).toHaveCount(0);

  await page.goto('/');
  await expect(link(page, 'Q3 Sales')).toBeVisible();
  await expect(link(page, name)).toHaveCount(0);
});

test('REQ-1-3-1 S3: （推断）多点号文件名只去掉末尾 .csv，首行保持普通数据，重新打开后行列不变', async ({ page }) => {
  const name = `q3.sales.${uniq()}`;
  await importCsv(page, `${name}.csv`, 'Region,Sales\nEast,1200\nNorth,800\n');
  const expected = { A1: 'Region', B1: 'Sales', A2: 'East', B2: '1200', A3: 'North', B3: '800', A4: '', C1: '' };
  await expectCells(page, expected);

  await page.goto('/');
  await expect(link(page, name)).toBeVisible();
  await expect(link(page, `${name}.csv`)).toHaveCount(0);
  await link(page, name).click();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expectCells(page, expected);
});

test('REQ-1-3-1 S4: （推断）CRLF 行尾、字段内换行和整行空字段的 CSV 导入后行列对齐，重新打开后保持', async ({ page }) => {
  const name = `crlf-import-${uniq()}`;
  const csv = 'City,备注,Count\r\n'
    + '"Shanghai, CN","第一行\r\n第二行",3\r\n'
    + ',,\r\n'
    + 'Beijing,"引号""测试""",\r\n';
  await importCsv(page, `${name}.csv`, csv);

  const expectImported = async () => {
    await expectCells(page, {
      A1: 'City', B1: '备注', C1: 'Count', D1: '',
      A2: 'Shanghai, CN', C2: '3',
      A3: '', B3: '', C3: '',
      A4: 'Beijing', B4: '引号"测试"', C4: '',
      A5: '',
    });
    await expect(cell(page, 'B2')).toHaveText('第一行 第二行', { useInnerText: true });
  };
  await expectImported();
  await reopenFromHome(page, name);
  await expectImported();
});
