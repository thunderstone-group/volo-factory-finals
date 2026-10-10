
// REQ-5-3-2 Apply Labels to an Issue (alice-dev; repository labels `bug`, `documentation`).

test('REQ-5-3-2: Apply Labels to an Issue - Scenario 1', async ({ page }) => {
  // intent: 用户为议题应用当前仓库标签，重新打开后标签仍可见
  const sfx = uid();
  const title = `pw-label-${sfx}`;
  await signIn(page, 'alice-dev');
  await createIssue(page, title, `Label target ${sfx}`);
  const labels = page.getByRole('button', { name: 'Labels', exact: true });
  const bug = page.getByRole('option', { name: 'bug', exact: true });
  await expect(labels).toBeVisible();
  const meta = await metadataRegion(page);

  await labels.click();
  await expect(page.getByRole('option', { name: 'documentation', exact: true })).toBeVisible();
  await bug.click(); // saves immediately and closes the picker
  await expect(bug).toHaveCount(0);
  await expectShown(meta, 'bug');
  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expectShown(meta, 'bug');

  // reopening and selecting the same option removes the association
  await labels.click();
  await bug.click();
  await expect(bug).toHaveCount(0);
  await expectNotShown(meta, 'bug');
  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(labels).toBeVisible();
  await expectNotShown(meta, 'bug');
});
