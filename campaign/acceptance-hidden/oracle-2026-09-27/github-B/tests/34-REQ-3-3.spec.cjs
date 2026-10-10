const { test, expect } = require('@playwright/test');

// REQ-3-3 View a Public Repository Overview.
// Visitor opens the seeded public repository `acme-docs` from global search results. The heading must
// contain "owner/repository name"; the owner namespace is ambiguous in the requirements (alice-dev per
// REQ-3 seeds, organization Acme Demo per REQ-2 seeds), so any "<owner>/acme-docs" is accepted.

async function searchFor(page, query) {
  const box = page.getByRole('searchbox', { name: 'Search', exact: true });
  await box.fill(query);
  await box.press('Enter');
}

test('REQ-3-3: View a Public Repository Overview - Scenario 1', async ({ page }) => {
  // 访客打开公共仓库概览可查看身份、可见性和内容入口
  await page.goto('/');
  await searchFor(page, 'acme-docs');
  await page.getByRole('link', { name: 'acme-docs', exact: true }).click();

  const heading = page.getByRole('heading', { name: /\S\s*\/\s*acme-docs(?![\w.-])/ });
  await expect(heading).toBeVisible();
  await expect(page.getByText('Public', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Code', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Issues', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Pull requests', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'README.md', exact: true })).toBeVisible();

  await page.reload();
  await expect(heading).toBeVisible();
  await expect(page.getByText('Public', { exact: true })).toBeVisible();
});
