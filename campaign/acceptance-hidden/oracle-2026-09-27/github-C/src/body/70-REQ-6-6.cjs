
// REQ-6-6 Close or Reopen a Pull Request Without Merging. Target: seeded `Draft onboarding update`
// (author alice-dev, unmerged; no main <- feature-search PR can be opened any more once REQ-6-5 S1 merged it).

test('REQ-6-6: Close or Reopen a Pull Request Without Merging - Scenario 1', async ({ page }) => {
  // intent: 作者关闭并重新打开拉取请求，状态转换保留在活动记录中
  const PR = 'Draft onboarding update';
  await signIn(page, 'alice-dev');
  await openPR(page, PR, null);
  await page.getByRole('button', { name: 'Close pull request', exact: true }).click();
  await expect(page.getByText('Closed', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reopen pull request', exact: true }).click();
  await expect(page.getByText('Open', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: PR, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close pull request', exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true })).toBeVisible();
  await expect(page.getByText('draft-feature').first()).toBeVisible(); // branches and discussion stay viewable
});

test('REQ-6-6: Close or Reopen a Pull Request Without Merging - Scenario 2', async ({ page }) => {
  // intent: 非作者且非维护者不能关闭或重新打开拉取请求
  // bob-reviewer (Write) is neither author nor maintainer of `Draft onboarding update`.
  const PR = 'Draft onboarding update';
  await signIn(page, 'bob-reviewer');
  await openPR(page, PR, null);
  const status = page.getByText('Open', { exact: true }).or(page.getByText('Draft', { exact: true })).first();
  await expect(status).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close pull request', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reopen pull request', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: PR, exact: true })).toBeVisible();
  await expect(status).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close pull request', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reopen pull request', exact: true })).toHaveCount(0);
});
