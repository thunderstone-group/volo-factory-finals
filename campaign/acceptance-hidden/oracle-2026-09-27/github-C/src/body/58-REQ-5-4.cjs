
// REQ-5-4 Close or Reopen an Issue.

test('REQ-5-4: Close or Reopen an Issue - Scenario 1', async ({ page }) => {
  // intent: 有权限的用户关闭并重新打开议题，状态转换会记录在活动中
  const sfx = uid();
  const title = `pw-close-${sfx}`;
  const description = `Close target ${sfx}`;
  await signIn(page, 'alice-dev');
  await createIssue(page, title, description);
  await page.getByRole('button', { name: 'Close issue', exact: true }).click();
  await expect(page.getByText('Closed', { exact: true })).toBeVisible();
  await expect(page.getByText('Closed issue')).toBeVisible();
  await page.getByRole('button', { name: 'Reopen issue', exact: true }).click();
  await expect(page.getByText('Open', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Close issue', exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText(description, { exact: true })).toBeVisible();
  await expect(page.getByText('Closed issue')).toBeVisible(); // append-only timeline keeps the event
  await page.getByRole('link', { name: 'Issues', exact: true }).click();
  await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();
});

test('REQ-5-4: Close or Reopen an Issue - Scenario 2', async ({ page }) => {
  // intent: 没有议题管理权限的用户不能关闭或重新打开议题
  // bob-reviewer is the seeded Write collaborator; Write may only view issue status.
  await signIn(page, 'bob-reviewer');
  await openIssue(page, 'Improve onboarding');
  await expect(page.getByText('Open', { exact: true })).toBeVisible();
  await expect(page.getByText('Describe the onboarding improvement.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close issue', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reopen issue', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close issue', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reopen issue', exact: true })).toHaveCount(0);
});
