const { test, expect } = require('@playwright/test');

// REQ-3-1 Search for and Locate Repositories.
// Seeds: public `acme-docs`, private `secret-research` (not visible to visitors). The owner namespace of
// acme-docs is ambiguous in the requirements (REQ-3 seeds say owner alice-dev, REQ-2 seeds list it under
// organization Acme Demo), so owner/name metadata is checked as "<some owner>/acme-docs".
// All four scenarios run as an unauthenticated visitor: the intents say 访客, and the
// description ("Visitors or signed-in users can search ... A query with no matching
// repository displays “No results”, including when the visitor returns home ...") is visitor-centred.

const visible = (locator) => locator.filter({ visible: true });
// "<owner>/acme-docs" with any owner, not followed by more name characters (so not acme-docs-fork)
const OWNER_SLASH_ACME_DOCS = /\S\s*\/\s*acme-docs(?![\w.-])/;

async function searchFor(page, query) {
  const box = page.getByRole('searchbox', { name: 'Search', exact: true });
  await box.fill(query);
  await box.press('Enter');
}

test('REQ-3-1: Search for and Locate Repositories - Scenario 1', async ({ page }) => {
  // 访客搜索可见仓库并从结果打开仓库概览
  await page.goto('/');
  await searchFor(page, 'acme-docs');
  const result = page.getByRole('link', { name: 'acme-docs', exact: true });
  await expect(result).toBeVisible();
  // the result also displays its owner/name metadata
  await expect(visible(page.getByText(OWNER_SLASH_ACME_DOCS))).not.toHaveCount(0);
  await expect(page.getByRole('link', { name: 'secret-research' })).toHaveCount(0);
  await result.click();
  const heading = page.getByRole('heading', { name: 'acme-docs' });
  await expect(heading).toBeVisible();
  await page.reload();
  await expect(heading).toBeVisible();
});

test('REQ-3-1: Search for and Locate Repositories - Scenario 2', async ({ page }) => {
  // 访客搜索时不会得到无权访问的私有仓库结果
  await page.goto('/');
  await searchFor(page, 'secret-research');
  // for a visitor the private repository is not a match, so the empty state is shown
  await expect(page.getByText('No results')).toBeVisible();
  await expect(page.getByRole('link', { name: 'secret-research' })).toHaveCount(0);
  await expect(page.getByText(/\/\s*secret-research/)).toHaveCount(0);
});

test('REQ-3-1: Search for and Locate Repositories - Scenario 3', async ({ page }) => {
  // 无匹配搜索显示空结果而不会展示无关仓库
  const query = 'no-such-repository-zq';
  await page.goto('/');
  await searchFor(page, query);
  await expect(page.getByText('No results')).toBeVisible();
  await expect(page.getByRole('link', { name: 'acme-docs', exact: true })).toHaveCount(0);
  // return home and repeat the same query: same empty state, no stale matches
  await page.goto('/');
  await searchFor(page, query);
  await expect(page.getByText('No results')).toBeVisible();
  await expect(page.getByRole('link', { name: 'acme-docs', exact: true })).toHaveCount(0);
});

test('REQ-3-1: Search for and Locate Repositories - Scenario 4', async ({ page }) => {
  // 公开仓库搜索结果在刷新后仍然可见
  await page.goto('/');
  await searchFor(page, 'acme-docs');
  const result = page.getByRole('link', { name: 'acme-docs', exact: true });
  await expect(result).toBeVisible();
  await page.reload();
  await expect(result).toBeVisible();
  await expect(visible(page.getByText(OWNER_SLASH_ACME_DOCS))).not.toHaveCount(0);
  await result.click();
  await expect(page.getByRole('heading', { name: 'acme-docs' })).toBeVisible();
});
