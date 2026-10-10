
// REQ-6-2-3 Create a Pull Request from Comparison Results (alice-dev; main <- feature-search).

test('REQ-6-2-3: Create a Pull Request from Comparison Results - Scenario 1', async ({ page }) => {
  // intent: 协作者基于有效比较创建打开状态的拉取请求
  const title = `pw-pr-${uid()}`;
  const description = `PR body ${uid()}`;
  await signIn(page, 'alice-dev');
  await openCompare(page, 'main', 'feature-search');
  await page.getByRole('button', { name: 'Create pull request', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Description', { exact: true }).fill(description);
  // the form's submit is the only active "Create pull request" button now
  await page.getByRole('button', { name: 'Create pull request', exact: true }).click();
  const heading = page.getByRole('heading', { name: title, exact: true });
  try {
    await expect(heading).toBeVisible();
    await expect(page.getByText('Open', { exact: true })).toBeVisible();
    await expect(page.getByText(description, { exact: true })).toBeVisible();
    await page.reload();
    await expect(heading).toBeVisible();
    await expect(page.getByText('Open', { exact: true })).toBeVisible();
    // the PR list finds it as well
    await page.goto('/');
    await openPRs(page);
    await page.getByRole('link', { name: title, exact: true }).click();
    await expect(heading).toBeVisible();
  } finally {
    await bestEffortClosePR(page);
  }
});

test('REQ-6-2-3: Create a Pull Request from Comparison Results - Scenario 2', async ({ page }) => {
  // intent: 空白标题不会从比较结果创建拉取请求
  await signIn(page, 'alice-dev');
  await openPRs(page);
  await expect(page.getByRole('link', { name: 'Fix search', exact: true }).or(page.getByRole('link', { name: 'Improve onboarding', exact: true })).first()).toBeVisible(); // list rows rendered
  const linksBefore = await stableCount(page, page.getByRole('link'));
  await page.getByRole('link', { name: 'New pull request', exact: true }).click();
  await page.getByRole('combobox', { name: 'base', exact: true }).selectOption('main');
  await page.getByRole('combobox', { name: 'compare', exact: true }).selectOption('feature-search');
  await page.getByRole('button', { name: 'Compare changes', exact: true }).click();
  await page.getByRole('button', { name: 'Create pull request', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Create pull request', exact: true }).click();
  await expect(page.getByText('Title is required', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Title', { exact: true })).toBeVisible();
  // no PR row was added
  await page.goto('/');
  await openPRs(page);
  await expect(page.getByRole('link', { name: 'Fix search', exact: true }).or(page.getByRole('link', { name: 'Improve onboarding', exact: true })).first()).toBeVisible();
  await expect(page.getByRole('link')).toHaveCount(linksBefore);
});
