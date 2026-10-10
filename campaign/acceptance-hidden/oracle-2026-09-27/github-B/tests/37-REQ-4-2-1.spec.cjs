const { test, expect } = require('@playwright/test');

// REQ-4-2-1 View Repository Commit History.
// Visitor on public `alice-dev/acme-docs`; one history link named "Commits" (a count may accompany
// the label). The seeded commit `Document search flow` by `alice-dev` must show message, author and
// a relative time containing "ago" on the branch history, without selecting a file scope first.

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

test('REQ-4-2-1: View Repository Commit History - Scenario 1', async ({ page }) => {
  // 用户可查看分支提交历史中的消息、作者和时间
  await page.goto('/');
  await openCodePage(page, 'acme-docs');
  await page.getByRole('link', { name: 'Commits' }).click();

  const message = page.getByText('Document search flow', { exact: true });
  await expect(message).toBeVisible();
  await expect(visible(page.getByText('alice-dev', { exact: true }))).not.toHaveCount(0);
  await expect(visible(page.getByText(/\bago\b/))).not.toHaveCount(0);

  // refreshing the history page keeps the same records
  await page.reload();
  await expect(message).toBeVisible();
  await expect(visible(page.getByText('alice-dev', { exact: true }))).not.toHaveCount(0);
});
