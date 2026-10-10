
// REQ-5-1-1 List and Filter Repository Issues (visitor on public acme-docs).
// Seeds: open issue `Improve onboarding`, closed issue `Legacy welcome text`.

test('REQ-5-1-1: List and Filter Repository Issues - Scenario 1', async ({ page }) => {
  // intent: 用户按状态和关键词筛选议题，筛选不改变原议题
  await page.goto('/');
  await openIssues(page);
  await page.getByRole('link', { name: 'Open', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search issues', exact: true }).fill('Improve onboarding');
  const openIssue = page.getByRole('link', { name: 'Improve onboarding', exact: true });
  const closedIssue = page.getByRole('link', { name: 'Legacy welcome text', exact: true });
  await expect(openIssue).toBeVisible();
  await expect(closedIssue).toHaveCount(0);
  // "Open plus the known open title ... continues to show it after reload"
  await page.reload();
  await expect(openIssue).toBeVisible();
  await expect(closedIssue).toHaveCount(0);
  // filtering changed nothing: the issue still opens as the same Open issue
  await openIssue.click();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true })).toBeVisible();
});

test('REQ-5-1-1: List and Filter Repository Issues - Scenario 2', async ({ page }) => {
  // intent: 按关闭状态筛选时只显示匹配的已关闭议题
  await page.goto('/');
  await openIssues(page);
  await page.getByRole('link', { name: 'Closed', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search issues', exact: true }).fill('Legacy welcome text');
  const closedIssue = page.getByRole('link', { name: 'Legacy welcome text', exact: true });
  const openIssue = page.getByRole('link', { name: 'Improve onboarding', exact: true });
  await expect(closedIssue).toBeVisible();
  await expect(openIssue).toHaveCount(0);
  // "refreshing retains the chosen filter context and matching results"
  await page.reload();
  await expect(closedIssue).toBeVisible();
  await expect(openIssue).toHaveCount(0);
  // issue data unchanged: it is still Closed
  await closedIssue.click();
  await expect(page.getByRole('heading', { name: 'Legacy welcome text', exact: true })).toBeVisible();
  await expect(page.getByText('Closed', { exact: true })).toBeVisible();
});
