
// REQ-6-4 Request or Remove Pull Request Reviewers (author alice-dev on a fresh PR; reviewer bob-reviewer).

test('REQ-6-4: Request or Remove Pull Request Reviewers - Scenario 1', async ({ page }) => {
  // intent: 作者请求并移除评审者后，评审者区域同步更新
  const title = `pw-reviewers-${uid()}`;
  await signIn(page, 'alice-dev');
  await createPR(page, title);
  const heading = page.getByRole('heading', { name: title, exact: true });
  const reviewers = page.getByRole('button', { name: 'Reviewers', exact: true });
  const option = page.getByRole('option', { name: 'bob-reviewer', exact: true });
  const remove = page.getByRole('button', { name: 'Remove bob-reviewer', exact: true });
  try {
    await reviewers.click();
    await page.getByRole('textbox', { name: 'Search', exact: true }).fill('bob-reviewer');
    await option.click(); // saves immediately and closes the picker
    await expect(option).toHaveCount(0);
    await expect(remove).toBeVisible(); // the requested reviewer is listed with its "Remove <username>" button
    await page.reload();
    await expect(heading).toBeVisible();
    await expect(remove).toBeVisible();
    // no automatic approval
    await expect(page.getByText('Approved', { exact: true })).toHaveCount(0);
    await remove.click();
    await expect(remove).toHaveCount(0);
    await page.reload();
    await expect(heading).toBeVisible();
    await expect(reviewers).toBeVisible();
    await expect(remove).toHaveCount(0);
  } finally {
    await bestEffortClosePR(page);
  }
});
