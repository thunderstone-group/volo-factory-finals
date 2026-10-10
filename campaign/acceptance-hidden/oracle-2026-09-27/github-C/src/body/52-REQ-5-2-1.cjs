
// REQ-5-2-1 Create a Repository Issue (alice-dev owns acme-docs).

test('REQ-5-2-1: Create a Repository Issue - Scenario 1', async ({ page }) => {
  // intent: 已登录用户创建非空议题后，详情和列表均可找到该议题
  const title = `pw-issue-${uid()}`;
  const description = `Issue body ${uid()}`;
  await signIn(page, 'alice-dev');
  await openIssues(page);
  await page.getByRole('link', { name: 'New issue', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Description', { exact: true }).fill(description);
  await page.getByRole('button', { name: 'Submit new issue', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText(description, { exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true })).toBeVisible();
  // "reopening the Issues page entry shows a title link with the same exact name"
  await page.getByRole('link', { name: 'Issues', exact: true }).click();
  await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();
});

test('REQ-5-2-1: Create a Repository Issue - Scenario 2', async ({ page }) => {
  // intent: 空白标题不会创建议题 (three spaces, empty description -> "Title is required", nothing added)
  await signIn(page, 'alice-dev');
  await openIssues(page);
  await expect(page.getByRole('link', { name: 'Improve onboarding', exact: true })).toBeVisible();
  const linksBefore = await stableCount(page, page.getByRole('link'));
  await page.getByRole('link', { name: 'New issue', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Submit new issue', exact: true }).click();
  await expect(page.getByText('Title is required', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit new issue', exact: true })).toBeVisible();
  // the Issues list gained no row (reopened from the home page: the form page need not carry repository navigation)
  await page.goto('/');
  await openIssues(page);
  await expect(page.getByRole('link', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await expect(page.getByRole('link')).toHaveCount(linksBefore);
});
