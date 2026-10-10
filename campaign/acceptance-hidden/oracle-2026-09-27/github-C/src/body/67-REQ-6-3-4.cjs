
// REQ-6-3-4 Submit a Pull Request Review (non-author Write reviewer bob-reviewer).
// Approve goes to the seeded Open PR `Fix search` (merged later in REQ-6-5 S1);
// Request changes goes to a separate fresh PR so it cannot block that merge.

test('REQ-6-3-4: Submit a Pull Request Review - Scenario 1', async ({ page }) => {
  // intent: 评审者提交批准决定后，拉取请求显示该评审状态
  await signIn(page, 'bob-reviewer');
  await openPR(page, 'Fix search');
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await page.getByRole('button', { name: 'Review changes', exact: true }).click();
  await page.getByRole('radio', { name: 'Approve', exact: true }).check();
  await page.getByRole('button', { name: 'Submit review', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Submit review', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Conversation', exact: true }).click();
  await expect(page.getByText('Approved', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Fix search', exact: true })).toBeVisible();
  await expect(page.getByText('Approved', { exact: true }).first()).toBeVisible();
});

test('REQ-6-3-4: Submit a Pull Request Review - Scenario 2', async ({ page, browser }, testInfo) => {
  // intent: 评审者请求修改时保存评审意见和 Changes requested 状态
  const title = `pw-review-pr-${uid()}`;
  const summary = `pw-changes-${uid()}`;
  await signIn(page, 'alice-dev');
  await createPR(page, title);
  const reviewer = await otherSession(browser, testInfo, 'bob-reviewer');
  try {
    const rp = reviewer.page;
    await openPR(rp, title);
    await rp.getByRole('link', { name: 'Files changed', exact: true }).click();
    await rp.getByRole('button', { name: 'Review changes', exact: true }).click();
    await rp.getByLabel('Summary', { exact: true }).fill(summary);
    await rp.getByRole('radio', { name: 'Request changes', exact: true }).check();
    await rp.getByRole('button', { name: 'Submit review', exact: true }).click();
    await expect(rp.getByRole('button', { name: 'Submit review', exact: true })).toHaveCount(0);
    await rp.getByRole('link', { name: 'Conversation', exact: true }).click();
    await expect(rp.getByText('Changes requested', { exact: true }).first()).toBeVisible();
    await expect(rp.getByText(summary, { exact: true }).first()).toBeVisible();
    await rp.reload();
    await expect(rp.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(rp.getByText('Changes requested', { exact: true }).first()).toBeVisible();
    await expect(rp.getByText(summary, { exact: true }).first()).toBeVisible();
  } finally {
    await reviewer.context.close();
    await bestEffortClosePR(page);
  }
});
