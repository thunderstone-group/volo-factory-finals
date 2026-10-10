
// REQ-6-2-2 Compare Branches Before Opening a Pull Request (contributor alice-dev; main <- feature-search,
// known changed file `src/search.ts`).

const COMMIT_COUNT = /\b\d+\s+commits?\b/i;

test('REQ-6-2-2: Compare Branches Before Opening a Pull Request - Scenario 1', async ({ page }) => {
  // intent: 协作者比较两个不同分支后可查看提交数、文件和差异摘要
  await signIn(page, 'alice-dev');
  await openPRs(page);
  await page.getByRole('link', { name: 'New pull request', exact: true }).click();
  await page.getByRole('combobox', { name: 'base', exact: true }).selectOption('main');
  await page.getByRole('combobox', { name: 'compare', exact: true }).selectOption('feature-search');
  await page.getByRole('button', { name: 'Compare changes', exact: true }).click();
  await expect(page.getByText('src/search.ts', { exact: true })).toBeVisible();
  await expect(page.getByText('Commit summary', { exact: true })).toBeVisible();
  await expect(page.getByText(COMMIT_COUNT).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create pull request', exact: true })).toBeEnabled();
});

test('REQ-6-2-2: Compare Branches Before Opening a Pull Request - Scenario 2', async ({ page }) => {
  // intent: 基础分支和比较分支相同时不能创建拉取请求
  await signIn(page, 'alice-dev');
  await openPRs(page);
  await page.getByRole('link', { name: 'New pull request', exact: true }).click();
  await page.getByRole('combobox', { name: 'base', exact: true }).selectOption('main');
  await page.getByRole('combobox', { name: 'compare', exact: true }).selectOption('main');
  const create = page.getByRole('button', { name: 'Create pull request', exact: true });
  // shown immediately, before Compare changes is clicked
  await expect(page.getByText('No changes', { exact: true })).toBeVisible();
  await expect(create).toBeDisabled();
  await page.getByRole('button', { name: 'Compare changes', exact: true }).click();
  await expect(page.getByText('No changes', { exact: true })).toBeVisible();
  await expect(create).toBeDisabled();
});
