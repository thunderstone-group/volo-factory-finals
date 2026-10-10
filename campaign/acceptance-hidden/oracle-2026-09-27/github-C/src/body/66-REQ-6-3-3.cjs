
// REQ-6-3-3 Add Review Comments to Changed Code Lines (non-author Write reviewer bob-reviewer).
// "the first such button in document order targets the first commentable changed line" -> .first() is the contract.

test('REQ-6-3-3: Add Review Comments to Changed Code Lines - Scenario 1', async ({ page }) => {
  // intent: 评审者在变更行添加单条评论后，评论会显示在讨论中 (reviewable Open PR `Fix search`)
  const body = `pw-inline-${uid()}`;
  await signIn(page, 'bob-reviewer');
  await openPR(page, 'Fix search');
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await page.getByRole('button', { name: 'Add comment', exact: true }).first().click();
  await page.getByRole('textbox', { name: 'Comment', exact: true }).fill(body);
  await page.getByRole('button', { name: 'Add single comment', exact: true }).click();
  await expect(page.getByText(body, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(body, { exact: true })).toBeVisible();
});

test('REQ-6-3-3: Add Review Comments to Changed Code Lines - Scenario 2', async ({ page, browser }, testInfo) => {
  // intent: 开始评审时行内评论保持待提交状态而不立即发布
  // "a separate Open PR for the pending-comment scenario": alice-dev opens a fresh PR, bob-reviewer reviews it.
  const title = `pw-pending-pr-${uid()}`;
  const body = `pw-pending-${uid()}`;
  await signIn(page, 'alice-dev');
  await createPR(page, title);
  const reviewer = await otherSession(browser, testInfo, 'bob-reviewer');
  try {
    const rp = reviewer.page;
    await openPR(rp, title);
    await rp.getByRole('link', { name: 'Files changed', exact: true }).click();
    await rp.getByRole('button', { name: 'Add comment', exact: true }).first().click();
    await rp.getByRole('textbox', { name: 'Comment', exact: true }).fill(body);
    await rp.getByRole('button', { name: 'Start a review', exact: true }).click();
    await expect(rp.getByText(body, { exact: true })).toBeVisible();
    await expect(rp.getByText('Pending review', { exact: true })).toBeVisible();
    await rp.reload();
    await expect(rp.getByText(body, { exact: true })).toBeVisible();
    await expect(rp.getByText('Pending review', { exact: true })).toBeVisible();
    // not public before the review is submitted: the PR author does not see it
    await page.reload();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Files changed', exact: true }).click();
    await expect(page.getByText('src/search.ts', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(body, { exact: true })).toHaveCount(0);
    await page.getByRole('link', { name: 'Conversation', exact: true }).click();
    await expect(page.getByText(body, { exact: true })).toHaveCount(0);
  } finally {
    await reviewer.context.close();
    await bestEffortClosePR(page);
  }
});
