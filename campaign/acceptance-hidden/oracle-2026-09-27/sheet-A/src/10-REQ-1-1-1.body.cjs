// REQ-1-1-1 View and Open a Workbook

// Reads the "Last updated: <value>" text shown in the home-page record that holds the given workbook link.
async function lastUpdatedOnHome(page, name) {
  await expect(link(page, name)).toBeVisible();
  const record = link(page, name).locator('xpath=ancestor::*[contains(normalize-space(.), "Last updated:")][1]');
  const label = record.getByText(/Last updated:\s*\S/);
  const raw = (await label.innerText()).replace(/\s+/g, ' ').trim();
  return raw.match(/Last updated:\s*\S.*$/)[0];
}

test('REQ-1-1-1 S1: 从首页打开已保存工作簿，并通过稳定 URL 恢复状态', async ({ page, browser }) => {
  await page.goto('/');
  const lastUpdated = await lastUpdatedOnHome(page, 'Q3 Sales');
  await link(page, 'Q3 Sales').click();

  await expect(heading(page, 'Q3 Sales')).toBeVisible();
  await expect(page.getByText(lastUpdated)).toBeVisible();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Region');
  const url = page.url();

  // Refreshing the editor entry keeps the same address and the same workbook.
  await page.reload();
  await expect(page).toHaveURL(url);
  await expect(heading(page, 'Q3 Sales')).toBeVisible();
  await expect(tab(page, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
  await expect(cell(page, 'A1')).toHaveText('Region');

  // A later browser session opens the same address directly, without the home page.
  const later = await browser.newContext();
  try {
    const page2 = await later.newPage();
    await page2.goto(url);
    await expect(heading(page2, 'Q3 Sales')).toBeVisible();
    await expect(tab(page2, 'Sheet1')).toHaveAttribute('aria-selected', 'true');
    await expect(cell(page2, 'A1')).toHaveText('Region');
  } finally {
    await later.close();
  }
});

test('REQ-1-1-1 S2: 从首页打开指定工作簿时不会带入其他工作簿数据', async ({ page }) => {
  const id = uniq();
  const other = `Other ${id}`;
  const marker = `Marker ${id}`;
  await createWorkbook(page, other);
  await setCell(page, 'A1', marker);
  await setCell(page, 'B2', '4242');
  await expect(cell(page, 'A1')).toHaveText(marker);
  await expect(cell(page, 'B2')).toHaveText('4242');

  // Open the seeded workbook: only its own data.
  await page.goto('/');
  await link(page, 'Q3 Sales').click();
  await expect(cell(page, 'A1')).toHaveText('Region');
  await expect(page.getByRole('gridcell').filter({ hasText: marker })).toHaveCount(0);
  await expect(cell(page, 'B2')).not.toHaveText('4242');

  // Open the other workbook: only its own data.
  await page.goto('/');
  await link(page, other).click();
  await expect(cell(page, 'A1')).toHaveText(marker);
  await expect(cell(page, 'B2')).toHaveText('4242');
  await expect(page.getByRole('gridcell').filter({ hasText: /^Region$/ })).toHaveCount(0);
});
