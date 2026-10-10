const { test, expect } = require('@playwright/test');

// REQ-4-1 Browse Repository Files and Directories.
// Visitor on public `alice-dev/acme-docs`, default branch `main`. The requirement names no seed
// directory; the only known nested text file is `src/search.ts` (REQ-4-2-2 / REQ-4-2-3 seeds), so
// the test walks `src` -> `search.ts`. Its expected content is not published, so the test checks
// that the file view shows non-empty readable text and that reload keeps URL, branch and content.

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

// Text of the rendered file body: the longest visible pre/code/textarea/table text on the file page
// (code viewers render into one of these; the longest one is the file, not inline chrome such as a branch tag).
async function fileBodyText(page) {
  const texts = (await visible(page.locator('pre, code, textarea, table')).allInnerTexts()).map((t) => t.trim());
  return texts.sort((a, b) => b.length - a.length)[0] || '';
}

test('REQ-4-1: Browse Repository Files and Directories - Scenario 1', async ({ page }) => {
  // 用户可逐级浏览目录并查看所选分支中的文件内容
  await page.goto('/');
  await openCodePage(page, 'acme-docs');

  await page.getByRole('link', { name: 'src', exact: true }).click();
  const fileLink = page.getByRole('link', { name: 'search.ts', exact: true });
  await expect(fileLink).toBeVisible();
  await expect(visible(page.getByText('main', { exact: true }).or(page.getByRole('button', { name: 'Branch main', exact: true })))).not.toHaveCount(0);

  await fileLink.click();
  await expect(visible(page.getByText('search.ts'))).not.toHaveCount(0);
  let content = '';
  // readable content: the expected text is not published, so require a non-trivial body (>= 10 characters)
  await expect.poll(async () => (content = await fileBodyText(page)).length).toBeGreaterThanOrEqual(10);
  const fileUrl = page.url();

  await page.reload();
  expect(page.url()).toBe(fileUrl);
  await expect(visible(page.getByText('search.ts'))).not.toHaveCount(0);
  await expect(visible(page.getByText('main', { exact: true }).or(page.getByRole('button', { name: 'Branch main', exact: true })))).not.toHaveCount(0);
  await expect.poll(() => fileBodyText(page)).toBe(content);
});
