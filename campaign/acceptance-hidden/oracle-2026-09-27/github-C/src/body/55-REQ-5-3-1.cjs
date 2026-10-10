
// REQ-5-3-1 Assign or Unassign Issue Participants (alice-dev, Admin; eligible member bob-reviewer).

test('REQ-5-3-1: Assign or Unassign Issue Participants - Scenario 1', async ({ page }) => {
  // intent: 用户分配并取消分配可用成员，议题元数据会同步更新
  const sfx = uid();
  const title = `pw-assign-${sfx}`;
  await signIn(page, 'alice-dev');
  await createIssue(page, title, `Assignment target ${sfx}`);
  const assignees = page.getByRole('button', { name: 'Assignees', exact: true });
  const option = page.getByRole('option', { name: 'bob-reviewer', exact: true });
  await expect(assignees).toBeVisible();
  const meta = await metadataRegion(page);

  await assignees.click();
  await page.getByRole('textbox', { name: 'Search assignees', exact: true }).fill('bob-reviewer');
  await option.click(); // saves immediately and closes the selector
  await expect(option).toHaveCount(0);
  await expectShown(meta, 'bob-reviewer');
  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expectShown(meta, 'bob-reviewer');

  // reopening shows the selected member without another search; clicking it again unassigns
  await assignees.click();
  await option.click();
  await expect(option).toHaveCount(0);
  await expectNotShown(meta, 'bob-reviewer');
  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(assignees).toBeVisible();
  await expectNotShown(meta, 'bob-reviewer');
});
