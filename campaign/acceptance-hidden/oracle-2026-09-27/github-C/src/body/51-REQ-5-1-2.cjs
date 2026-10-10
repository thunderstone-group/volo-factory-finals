
// REQ-5-1-2 View an Issue and Its Discussion. Seed: open issue `Improve onboarding`,
// description `Describe the onboarding improvement.` (visitor: read-only view of a public repository).

const ISSUE = 'Improve onboarding';
const ISSUE_DESCRIPTION = 'Describe the onboarding improvement.';

test('REQ-5-1-2: View an Issue and Its Discussion - Scenario 1', async ({ page }) => {
  // intent: 用户打开议题详情可查看标题、描述、状态和讨论
  await page.goto('/');
  await openIssue(page, ISSUE);
  const heading = page.getByRole('heading', { name: ISSUE, exact: true });
  await expect(page.getByText('Open', { exact: true })).toBeVisible();
  await expect(page.getByText(ISSUE_DESCRIPTION, { exact: true })).toBeVisible();
  // "the bottom displays sections or records containing “Comment” or “Activity” text"
  await expect(page.getByText(/Comment|Activity/).first()).toBeVisible();
  await page.reload();
  await expect(heading).toBeVisible();
  await expect(page.getByText('Open', { exact: true })).toBeVisible();
  await expect(page.getByText(ISSUE_DESCRIPTION, { exact: true })).toBeVisible();
});

test('REQ-5-1-2: View an Issue and Its Discussion - Scenario 2', async ({ page }) => {
  // intent: 议题详情在刷新后仍保持标题和描述可见
  await page.goto('/');
  await openIssue(page, ISSUE);
  await expect(page.getByText(ISSUE_DESCRIPTION, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: ISSUE, exact: true })).toBeVisible();
  await expect(page.getByText(ISSUE_DESCRIPTION, { exact: true })).toBeVisible();
});

test('REQ-5-1-2: View an Issue and Its Discussion - Scenario 3', async ({ page }) => {
  // intent: 离开后重新打开议题仍显示同一详情 (leave, then directly reopen the recorded issue address)
  await page.goto('/');
  await openIssue(page, ISSUE);
  await expect(page.getByText(ISSUE_DESCRIPTION, { exact: true })).toBeVisible();
  const issueUrl = page.url();
  await page.goto('/');
  await expect(page.getByRole('searchbox', { name: 'Search', exact: true })).toBeVisible();
  await page.goto(issueUrl);
  await expect(page.getByRole('heading', { name: ISSUE, exact: true })).toBeVisible();
  await expect(page.getByText(ISSUE_DESCRIPTION, { exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true })).toBeVisible();
});
