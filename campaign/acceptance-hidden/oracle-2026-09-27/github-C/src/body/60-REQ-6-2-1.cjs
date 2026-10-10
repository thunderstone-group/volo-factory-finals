
// REQ-6-2-1 List and Filter Repository Pull Requests (visitor; seeded Open PR `Fix search`).
// Assumption: of the two seeded PRs, `Fix search` is the public Open PR (it carries the `src/search.ts` change used
// by REQ-6-3-2) and `Improve onboarding` is the Closed one of the filtering scenario.

const OPEN_PR = 'Fix search';

test('REQ-6-2-1: List and Filter Repository Pull Requests - Scenario 1', async ({ page }) => {
  // intent: 用户按打开状态筛选拉取请求并打开目标提案
  await page.goto('/');
  await openPRs(page);
  const pr = page.getByRole('link', { name: OPEN_PR, exact: true });
  await page.getByRole('link', { name: 'Open', exact: true }).click();
  await expect(pr).toBeVisible();
  await page.getByRole('link', { name: 'Closed', exact: true }).click();
  await expect(pr).toHaveCount(0);
  await page.getByRole('link', { name: 'Open', exact: true }).click();
  await pr.click();
  await expect(page.getByRole('heading', { name: OPEN_PR, exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true })).toBeVisible();
});

test('REQ-6-2-1: List and Filter Repository Pull Requests - Scenario 2', async ({ page }) => {
  // intent: 打开状态筛选在刷新后仍保持相同提案可见
  await page.goto('/');
  await openPRs(page);
  const pr = page.getByRole('link', { name: OPEN_PR, exact: true });
  await page.getByRole('link', { name: 'Open', exact: true }).click();
  await expect(pr).toBeVisible();
  await page.reload();
  await expect(pr).toBeVisible();
  await pr.click();
  await expect(page.getByRole('heading', { name: OPEN_PR, exact: true })).toBeVisible();
});

test('REQ-6-2-1: List and Filter Repository Pull Requests - Scenario 3', async ({ page }) => {
  // intent: 离开后重新进入拉取请求列表仍能找到打开状态提案
  await page.goto('/');
  await openPRs(page);
  const pr = page.getByRole('link', { name: OPEN_PR, exact: true });
  await page.getByRole('link', { name: 'Open', exact: true }).click();
  await expect(pr).toBeVisible();
  const listUrl = page.url();
  await page.goto('/');
  await expect(page.getByRole('searchbox', { name: 'Search', exact: true })).toBeVisible();
  await page.goto(listUrl);
  await page.getByRole('link', { name: 'Open', exact: true }).click();
  await expect(pr).toBeVisible();
  await pr.click();
  await expect(page.getByRole('heading', { name: OPEN_PR, exact: true })).toBeVisible();
});
