
// REQ-6-1 Protect Branches with Review and Status-Check Requirements (repository acme-docs, branch `main`).

// One element (the rule entry) whose text carries the branch name and both requirement summaries.
function ruleEntry(page, branch) {
  return page.getByText(
    new RegExp(`^(?=[\\s\\S]*${branch})(?=[\\s\\S]*1 approval)(?=[\\s\\S]*Require status check test)`),
  );
}

test('REQ-6-1: Protect Branches with Review and Status-Check Requirements - Scenario 1', async ({ page }) => {
  // intent: 管理员保存分支保护规则后，规则在重新打开时仍可见
  await signIn(page, 'alice-dev');
  await openRepo(page);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Branches', exact: true }).click();
  await page.getByRole('button', { name: 'Add branch protection rule', exact: true }).click();
  await page.getByLabel('Branch name pattern', { exact: true }).fill('main');
  await page.getByRole('checkbox', { name: 'Require 1 approval', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Require status check test', exact: true }).check();
  const create = page.getByRole('button', { name: 'Create', exact: true });
  await create.click();
  await expect(create).toHaveCount(0); // saved: the creation form is gone (or became "Save changes")
  await page.reload();
  await expect(ruleEntry(page, 'main').first()).toBeVisible();
  await expect(page.getByText('1 approval', { exact: true })).toBeVisible();
  await expect(page.getByText('Require status check test', { exact: true })).toBeVisible();
  // "... the Admin then updates `test` from pending to success in the PR's Checks area" (Open PR targeting main)
  await page.goto('/');
  await openPR(page, 'Fix search');
  await expect(page.getByText('test: pending', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'test status', exact: true }).click();
  await page.getByRole('option', { name: 'success', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('test: success', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('test: success', { exact: true })).toBeVisible();
});

test('REQ-6-1: Protect Branches with Review and Status-Check Requirements - Scenario 2', async ({ page }) => {
  // intent: 非仓库管理员不能创建或修改分支保护规则 (bob-reviewer: Write, not Admin)
  await signIn(page, 'bob-reviewer');
  await openRepo(page);
  await expect(page.getByRole('link', { name: 'Code', exact: true })).toBeVisible();
  const settings = page.getByRole('link', { name: 'Settings', exact: true });
  if (await settings.isVisible()) {
    await settings.click();
    const branches = page.getByRole('link', { name: 'Branches', exact: true });
    await branches.waitFor({ timeout: 2000 }).catch(() => {});
    if (await branches.isVisible()) {
      await branches.click();
      await page.waitForLoadState('domcontentloaded');
    }
  }
  await expect(page.getByRole('button', { name: 'Add branch protection rule', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Create', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toHaveCount(0);
});

test('REQ-6-1: Protect Branches with Review and Status-Check Requirements - Scenario 3', async ({ page }) => {
  // intent: 管理员将当前比较提交的 test 检查更新为 success 且结果持久化
  // A fresh PR main <- feature-search guarantees a compare commit whose `test` check starts pending.
  const title = `pw-checks-${uid()}`;
  await signIn(page, 'alice-dev');
  await createPR(page, title);
  try {
    await expect(page.getByText('test: pending', { exact: true })).toBeVisible();
    await page.getByRole('combobox', { name: 'test status', exact: true }).click();
    await page.getByRole('option', { name: 'success', exact: true }).click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('test: success', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.getByText('test: success', { exact: true })).toBeVisible();
  } finally {
    await bestEffortClosePR(page);
  }
});
