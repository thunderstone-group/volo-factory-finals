const { test, expect } = require('@playwright/test');

// REQ-4-2-3 Search Code Within a Repository.
// Visitor on public `acme-docs`. The repository page exposes one searchbox "Search"; after Enter, a
// unique link "Code" selects code results (it must stay on the results, not lead back to the
// repository). Seeds: query `search flow` matches `README.md`, with the query visible as a complete text
// value (exact text match); query `no-such-token` matches nothing and shows "No code results".

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

// From the repository page: search box at the top -> Enter -> "Code" results type.
async function searchCode(page, query) {
  await searchFor(page, query);
  await page.getByRole('link', { name: 'Code', exact: true }).click();
}

test('REQ-4-2-3: Search Code Within a Repository - Scenario 1', async ({ page }) => {
  // 用户在仓库范围搜索代码并打开匹配文件
  await page.goto('/');
  await openCodePage(page, 'acme-docs');
  await searchCode(page, 'search flow');
  const result = page.getByRole('link', { name: 'README.md', exact: true });
  await expect(result).toBeVisible();
  await expect(visible(page.getByText('search flow', { exact: true }))).not.toHaveCount(0);
  // nothing from the private repository leaks into repository-scoped results
  await expect(page.getByText('secret-research')).toHaveCount(0);
  await result.click();
  await expect(visible(page.getByText('search flow', { exact: true }))).not.toHaveCount(0);
  await expect(visible(page.getByText('README.md'))).not.toHaveCount(0);
});

test('REQ-4-2-3: Search Code Within a Repository - Scenario 2', async ({ page }) => {
  // 仓库代码无匹配项时显示空结果且保持仓库搜索范围
  await page.goto('/');
  await openCodePage(page, 'acme-docs');
  await searchCode(page, 'no-such-token');
  await expect(page.getByText('No code results')).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Search', exact: true })).toHaveValue('no-such-token');
  // no file opened, no stale match
  await expect(page.getByRole('link', { name: 'README.md', exact: true })).toHaveCount(0);
});

test('REQ-4-2-3: Search Code Within a Repository - Scenario 3', async ({ page }) => {
  // 代码搜索结果在刷新后仍然保留当前文件上下文
  await page.goto('/');
  await openCodePage(page, 'acme-docs');
  await searchCode(page, 'search flow');
  const result = page.getByRole('link', { name: 'README.md', exact: true });
  const match = visible(page.getByText('search flow', { exact: true }));
  await expect(result).toBeVisible();
  await expect(match).not.toHaveCount(0);
  await page.reload();
  await expect(result).toBeVisible();
  await expect(match).not.toHaveCount(0);
});

test('REQ-4-2-3: Search Code Within a Repository - Scenario 4', async ({ page }) => {
  // 空代码搜索在返回代码页后仍保持空结果
  await page.goto('/');
  await openCodePage(page, 'acme-docs');
  await searchCode(page, 'no-such-token');
  await expect(page.getByText('No code results')).toBeVisible();
  // return to the repository and repeat the same search
  await page.goto('/');
  await openCodePage(page, 'acme-docs');
  await searchCode(page, 'no-such-token');
  await expect(page.getByText('No code results')).toBeVisible();
  await expect(page.getByRole('link', { name: 'README.md', exact: true })).toHaveCount(0);
  await expect(page.getByRole('searchbox', { name: 'Search', exact: true })).toHaveValue('no-such-token');
});
