
// REQ-5-3-3 Assign Issues and Pull Requests to a Milestone (alice-dev; seeded milestone `Q3 launch`).

test('REQ-5-3-3: Assign Issues and Pull Requests to a Milestone - Scenario 1', async ({ page }) => {
  // intent: 用户将议题归入当前仓库里程碑，关联在重新打开后仍存在
  const sfx = uid();
  const title = `pw-milestone-${sfx}`;
  await signIn(page, 'alice-dev');
  await createIssue(page, title, `Milestone target ${sfx}`);
  const milestone = page.getByRole('button', { name: 'Milestone', exact: true });
  const option = page.getByRole('option', { name: 'Q3 launch', exact: true });
  await expect(milestone).toBeVisible();
  const meta = await metadataRegion(page);
  await milestone.click();
  await option.click(); // saves immediately and closes the picker
  await expect(option).toHaveCount(0);
  await expectShown(meta, 'Q3 launch');
  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expectShown(meta, 'Q3 launch');
});
