
// REQ-6-3-2 Inspect Changed Files and Aggregate Diff (visitor; public Open PR `Fix search` touching `src/search.ts`).

test('REQ-6-3-2: Inspect Changed Files and Aggregate Diff - Scenario 1', async ({ page }) => {
  // intent: 访客查看拉取请求差异时可看到文件路径和增删行汇总
  const PR = 'Fix search';
  await page.goto('/');
  await openPR(page, PR);
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  const path = page.getByText('src/search.ts', { exact: true });
  const aggregate = page.getByText(/\b\d+ additions, \d+ deletions\b/);
  await expect(path).toBeVisible();
  await expect(aggregate).toBeVisible();
  await page.reload();
  await expect(path).toBeVisible();
  await expect(aggregate).toBeVisible();
  await page.getByRole('link', { name: 'Conversation', exact: true }).click();
  await expect(page.getByRole('heading', { name: PR, exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true })).toBeVisible();
});
