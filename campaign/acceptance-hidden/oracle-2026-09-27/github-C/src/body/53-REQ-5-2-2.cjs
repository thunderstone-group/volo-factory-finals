
// REQ-5-2-2 Edit an Issue Title and Description (editor alice-dev, Admin).

test('REQ-5-2-2: Edit an Issue Title and Description - Scenario 1', async ({ page }) => {
  // intent: 有编辑权限的用户保存新标题和描述，重新打开后仍显示新值
  // A fresh issue is edited so the shared seeds keep their titles.
  const sfx = uid();
  const title = `pw-edit-${sfx}`;
  const newTitle = `pw-edited-${sfx}`;
  const newDescription = `Updated description ${sfx}`;
  await signIn(page, 'alice-dev');
  await createIssue(page, title, `Original description ${sfx}`);
  await page.getByRole('button', { name: 'Edit issue title', exact: true }).click();
  await page.getByLabel('Issue title', { exact: true }).fill(newTitle);
  await page.getByRole('button', { name: 'Save issue title', exact: true }).click();
  await expect(page.getByRole('heading', { name: newTitle, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit issue description', exact: true }).click();
  await page.getByLabel('Issue description', { exact: true }).fill(newDescription);
  await page.getByRole('button', { name: 'Save issue description', exact: true }).click();
  await expect(page.getByText(newDescription, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: newTitle, exact: true })).toBeVisible();
  await expect(page.getByText(newDescription, { exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true })).toBeVisible();
  // the issue-list summary shows the new title only
  await page.getByRole('link', { name: 'Issues', exact: true }).click();
  await expect(page.getByRole('link', { name: newTitle, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: title, exact: true })).toHaveCount(0);
});

test('REQ-5-2-2: Edit an Issue Title and Description - Scenario 2', async ({ page }) => {
  // intent: 空白标题保存失败且重新打开后仍保留原标题 (seed `Original issue title`)
  await signIn(page, 'alice-dev');
  await openIssue(page, 'Original issue title');
  await page.getByRole('button', { name: 'Edit issue title', exact: true }).click();
  await page.getByLabel('Issue title', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Save issue title', exact: true }).click();
  await expect(page.getByText('Title is required', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Original issue title', exact: true })).toBeVisible();
});
