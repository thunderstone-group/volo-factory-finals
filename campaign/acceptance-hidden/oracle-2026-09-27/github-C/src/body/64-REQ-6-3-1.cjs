
// REQ-6-3-1 View Pull Request Overview and Commits (visitor; seeded public Open PR `Fix search`).

const PR = 'Fix search';

test('REQ-6-3-1: View Pull Request Overview and Commits - Scenario 1', async ({ page }) => {
  // intent: 评审者可在拉取请求查看概览、提交和变更文件上下文
  await page.goto('/');
  await openPR(page, PR);
  const heading = page.getByRole('heading', { name: PR, exact: true });
  await page.getByRole('link', { name: 'Conversation', exact: true }).click();
  await expect(heading).toBeVisible();
  await expect(page.getByText('Open', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Commits', exact: true }).click();
  await expect(page.getByText('Commit summary', { exact: true })).toBeVisible();
  await expect(heading).toBeVisible();
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await expect(page.getByText('Changed files', { exact: true })).toBeVisible();
  await expect(heading).toBeVisible();
  await page.reload();
  await expect(heading).toBeVisible();
  await expect(page.getByText('Changed files', { exact: true })).toBeVisible();
});

test('REQ-6-3-1: View Pull Request Overview and Commits - Scenario 2', async ({ page }) => {
  // intent: 拉取请求详情在刷新后仍保留标题和标签页入口
  await page.goto('/');
  await openPR(page, PR);
  const tabs = ['Conversation', 'Commits', 'Files changed'].map((name) => page.getByRole('link', { name, exact: true }));
  for (const tab of tabs) await expect(tab).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: PR, exact: true })).toBeVisible();
  for (const tab of tabs) await expect(tab).toBeVisible();
  await page.getByRole('link', { name: 'Commits', exact: true }).click();
  await expect(page.getByText('Commit summary', { exact: true })).toBeVisible();
});

test('REQ-6-3-1: View Pull Request Overview and Commits - Scenario 3', async ({ page }) => {
  // intent: 离开后重新打开同一拉取请求仍能查看概览和变更文件 (reopen the same address)
  await page.goto('/');
  await openPR(page, PR);
  const prUrl = page.url();
  await page.goto('/');
  await expect(page.getByRole('searchbox', { name: 'Search', exact: true })).toBeVisible();
  await page.goto(prUrl);
  await expect(page.getByRole('heading', { name: PR, exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await expect(page.getByText('Changed files', { exact: true })).toBeVisible();
  await expect(page.getByText('src/search.ts', { exact: true })).toBeVisible();
});
