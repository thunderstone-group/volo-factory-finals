
// REQ-6-2-4 Create a Draft Pull Request.

test('REQ-6-2-4: Create a Draft Pull Request - Scenario 1', async ({ page }) => {
  // intent: 协作者创建草稿拉取请求后显示 Draft 且不可合并
  const title = `pw-draft-${uid()}`;
  await signIn(page, 'alice-dev');
  await openCompare(page, 'main', 'feature-search');
  await page.getByRole('button', { name: 'Create draft pull request', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Description', { exact: true }).fill(`Draft body ${uid()}`);
  await page.getByRole('button', { name: 'Create draft pull request', exact: true }).click();
  const heading = page.getByRole('heading', { name: title, exact: true });
  const merge = page.getByRole('button', { name: 'Merge pull request', exact: true });
  try {
    await expect(heading).toBeVisible();
    await expect(page.getByText('Draft', { exact: true })).toBeVisible();
    await expect(merge).toBeVisible();
    await expect(merge).toBeDisabled();
    await page.reload();
    await expect(heading).toBeVisible();
    await expect(page.getByText('Draft', { exact: true })).toBeVisible();
    await expect(merge).toBeDisabled();
  } finally {
    await bestEffortClosePR(page);
  }
});

test('REQ-6-2-4: Create a Draft Pull Request - Scenario 2', async ({ page }) => {
  // intent: PR 作者可将草稿标记为可评审且不改变其内容
  // Seed: Draft PR `Draft onboarding update`, draft-feature -> main, author assumed to be alice-dev.
  const title = 'Draft onboarding update';
  await signIn(page, 'alice-dev');
  await openPR(page, title, null);
  await expect(page.getByText('Draft', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ready for review', exact: true }).click();
  const confirm = page.getByRole('button', { name: 'Confirm', exact: true });
  const open = page.getByText('Open', { exact: true });
  await expect(confirm.or(open).first()).toBeVisible();
  if (await confirm.isVisible()) await confirm.click();
  await expect(open).toBeVisible();
  await expect(page.getByText('Draft', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText('draft-feature')).toBeVisible(); // branch shown verbatim (may share a line with main)
  await expect(page.getByText(/ready for review/i)).toBeVisible(); // the status event
  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(open).toBeVisible();
  await expect(page.getByText('Draft', { exact: true })).toHaveCount(0);
});
