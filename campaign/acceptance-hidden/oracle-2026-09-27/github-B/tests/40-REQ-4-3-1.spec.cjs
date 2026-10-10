const { test, expect } = require('@playwright/test');

// REQ-4-3-1 List and Switch Repository Branches.
// Visitor on public `alice-dev/acme-docs`. Selector: unique button "Branch <current>", textbox
// "Find branch", options named exactly by branch name, "No matching branch" empty state, Escape closes.
// Seeds: active `main`; `feature-search` contains `main-only.md`, which is absent from `main`.

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

test('REQ-4-3-1: List and Switch Repository Branches - Scenario 1', async ({ page }) => {
  // 用户从分支选择器切换分支，浏览上下文随之变化
  await page.goto('/');
  await openCodePage(page, 'acme-docs');
  await expect(page.getByRole('link', { name: 'main-only.md', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Branch main', exact: true }).click();
  await expect(page.getByRole('option', { name: 'main', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Find branch', exact: true }).fill('feature-search');
  await page.getByRole('option', { name: 'feature-search', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Branch feature-search', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'main-only.md', exact: true })).toBeVisible();

  // selecting main again restores its file list
  await page.getByRole('button', { name: 'Branch feature-search', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find branch', exact: true }).fill('main');
  await page.getByRole('option', { name: 'main', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'main-only.md', exact: true })).toHaveCount(0);
});

test('REQ-4-3-1: List and Switch Repository Branches - Scenario 2', async ({ page }) => {
  // 分支搜索无匹配项时保持当前活动分支不变
  await page.goto('/');
  await openCodePage(page, 'acme-docs');
  await page.getByRole('button', { name: 'Branch main', exact: true }).click();
  const find = page.getByRole('textbox', { name: 'Find branch', exact: true });
  await find.fill('no-such-branch-zq');
  await expect(page.getByText('No matching branch')).toBeVisible();
  await expect(page.getByRole('option', { name: 'main', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(find).toBeHidden();
  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();
});
