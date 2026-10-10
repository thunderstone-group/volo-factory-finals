
// REQ-6-5 Merge an Eligible Pull Request (alice-dev, repository Admin).
// Eligibility is built by the preceding scenarios in document order: REQ-6-1 S1 protects `main`,
// REQ-6-3-4 S1 records bob-reviewer's approval on `Fix search`; S1 sets `test` to success if still pending.

test('REQ-6-5: Merge an Eligible Pull Request - Scenario 1', async ({ page }) => {
  // intent: 维护者合并满足条件的拉取请求后，详情显示 merged 状态
  const PR = 'Fix search';
  await signIn(page, 'alice-dev');
  await openPR(page, PR);
  const merge = page.getByRole('button', { name: 'Merge pull request', exact: true });
  await expect(merge).toBeVisible();
  const pending = page.getByText('test: pending', { exact: true });
  if (await pending.isVisible()) {
    await page.getByRole('combobox', { name: 'test status', exact: true }).click();
    await page.getByRole('option', { name: 'success', exact: true }).click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('test: success', { exact: true })).toBeVisible();
  }
  await expect(merge).toBeEnabled();
  await merge.click();
  await page.getByRole('button', { name: 'Confirm merge', exact: true }).click();
  await expect(page.getByText('Merged', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: PR, exact: true })).toBeVisible();
  await expect(page.getByText('Merged', { exact: true })).toBeVisible();
  await expect(merge).toHaveCount(0);
});

test('REQ-6-5: Merge an Eligible Pull Request - Scenario 2', async ({ page }) => {
  // intent: 未满足评审或保护规则时不能合并拉取请求
  // Blocked PR: seeded `Draft onboarding update` (draft-feature -> protected main), no approval. It became Open in
  // REQ-6-2-4 S2; if it is still a Draft, its author first marks it ready so only the review requirement is unmet.
  const PR = 'Draft onboarding update';
  await signIn(page, 'alice-dev');
  await openPR(page, PR, null);
  const ready = page.getByRole('button', { name: 'Ready for review', exact: true });
  const merge = page.getByRole('button', { name: 'Merge pull request', exact: true });
  await expect(merge.or(ready).first()).toBeVisible();
  if (await ready.isVisible()) {
    await ready.click();
    const confirm = page.getByRole('button', { name: 'Confirm', exact: true });
    await expect(confirm.or(merge).first()).toBeVisible();
    if (await confirm.isVisible()) await confirm.click();
  }
  const reason = page.getByText('Review required by branch protection', { exact: true });
  await expect(merge).toBeVisible();
  await expect(merge).toBeDisabled();
  await expect(reason).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: PR, exact: true })).toBeVisible();
  await expect(merge).toBeDisabled();
  await expect(reason).toBeVisible();
  await expect(page.getByText('Open', { exact: true })).toBeVisible();
});
