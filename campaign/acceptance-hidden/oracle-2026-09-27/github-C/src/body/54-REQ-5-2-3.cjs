
// REQ-5-2-3 Comment on an Issue Discussion (commenter alice-dev on seed issue `Improve onboarding`).
// Contract: editor labeled "Comment", submit button "Comment", discussion/activity entries are articles.

test('REQ-5-2-3: Comment on an Issue Discussion - Scenario 1', async ({ page }) => {
  // intent: 已登录用户发布非空评论后，评论和作者持久化在时间线中
  const body = `pw-comment-${uid()}`;
  await signIn(page, 'alice-dev');
  await openIssue(page, 'Improve onboarding');
  await page.getByRole('textbox', { name: 'Comment', exact: true }).fill(body);
  await page.getByRole('button', { name: 'Comment', exact: true }).click();
  await expect(page.getByText(body, { exact: true })).toBeVisible();
  // the discussion entry (innermost article) holding the body also names its author
  const entry = page.getByRole('article').filter({ hasText: body }).filter({ hasNot: page.getByRole('article') });
  await expect(entry).toBeVisible();
  await expect(entry).toContainText('alice-dev');
  await page.reload();
  await expect(page.getByText(body, { exact: true })).toBeVisible();
  await expect(entry).toBeVisible();
  await expect(entry).toContainText('alice-dev');
});

test('REQ-5-2-3: Comment on an Issue Discussion - Scenario 2', async ({ page }) => {
  // intent: 空白或纯空格评论不会新增时间线记录
  await signIn(page, 'alice-dev');
  await openIssue(page, 'Improve onboarding');
  const box = page.getByRole('textbox', { name: 'Comment', exact: true });
  await expect(box).toBeVisible();
  await expect(page.getByText('Describe the onboarding improvement.', { exact: true })).toBeVisible();
  const articles = page.getByRole('article');
  const before = await stableCount(page, articles);
  await box.fill('   ');
  const submit = page.getByRole('button', { name: 'Comment', exact: true });
  // either the button is disabled for blank input, or activating it shows "Comment is required"
  if (await submit.isEnabled()) {
    await submit.click();
    await expect(page.getByText('Comment is required', { exact: true })).toBeVisible();
  }
  await expect(articles).toHaveCount(before);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await expect(page.getByText('Describe the onboarding improvement.', { exact: true })).toBeVisible();
  await expect(articles).toHaveCount(before);
});
