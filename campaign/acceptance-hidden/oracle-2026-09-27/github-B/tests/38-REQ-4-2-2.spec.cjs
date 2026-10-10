const { test, expect } = require('@playwright/test');

// REQ-4-2-2 Inspect Commit and Revision Differences.
// Visitor opens the seeded commit `Document search flow` of public `alice-dev/acme-docs` from its
// history (assumption: this is the seeded commit whose changed files include `src/search.ts`).
// The diff shows the path `src/search.ts` as an exact text value, a "Changed files" summary and a
// numeric additions/deletions summary (format not published: "+N"/"-N" or "N additions"/"N deletions").

const visible = (locator) => locator.filter({ visible: true });

async function searchFor(page, query) {
  const box = page.getByRole('searchbox', { name: 'Search', exact: true });
  await box.fill(query);
  await box.press('Enter');
}

async function openRepo(page, name) {
  await searchFor(page, name);
  const link = page.getByRole('link', { name, exact: true });
  await expect(link).toBeVisible();
  const before = page.url();
  await link.click();
  await page.waitForURL((u) => u.toString() !== before);
  await expect(visible(page.getByRole('heading', { name }))).not.toHaveCount(0);
}

// REQ-4 works on the repository "Code" page: overview -> repository navigation link "Code".
async function openCodePage(page, name) {
  await openRepo(page, name);
  await page.getByRole('link', { name: 'Code', exact: true }).click();
}

async function expectDiffSummary(page) {
  await expect(visible(page.getByText('src/search.ts', { exact: true }))).not.toHaveCount(0);
  await expect(visible(page.getByText('Changed files'))).not.toHaveCount(0);
  await expect(visible(page.getByText(/(^|\s)\+\d+(\s|$)|\b\d+\s+additions?\b/i))).not.toHaveCount(0);
  await expect(visible(page.getByText(/(^|\s)[-−]\d+(\s|$)|\b\d+\s+deletions?\b/i))).not.toHaveCount(0);
}

test('REQ-4-2-2: Inspect Commit and Revision Differences - Scenario 1', async ({ page }) => {
  // 用户打开提交后可查看变更文件和新增/删除差异
  await page.goto('/');
  await openCodePage(page, 'acme-docs');
  await page.getByRole('link', { name: 'Commits' }).click();
  await page.getByRole('link', { name: 'Document search flow', exact: true }).click();
  await expectDiffSummary(page);
  // read-only view: refreshing shows the same comparison
  await page.reload();
  await expectDiffSummary(page);
});
