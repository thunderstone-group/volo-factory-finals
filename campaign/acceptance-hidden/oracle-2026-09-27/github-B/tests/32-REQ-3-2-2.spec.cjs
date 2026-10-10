const { test, expect } = require('@playwright/test');

// REQ-3-2-2 Fork a Repository into Another Namespace.
// Source: public `acme-docs` (owner namespace not assumed); forking user: seed account alice-dev (personal namespace);
// conflict seed: existing `acme-docs-fork` in that namespace. Controls: button "Fork",
// field "Repository name", button "Create fork"; success shows "Forked from <source>" with a source link.

const OWNER = 'alice-dev';
const PASSWORD = 'Valid-password-123!';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const visible = (locator) => locator.filter({ visible: true });

async function signIn(page, username = OWNER, password = PASSWORD) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toHaveCount(0);
  await expect(visible(page.getByText(username))).not.toHaveCount(0);
}

async function searchFor(page, query) {
  const box = page.getByRole('searchbox', { name: 'Search', exact: true });
  await box.fill(query);
  await box.press('Enter');
}

// Global search -> result link -> repository overview.
async function openRepo(page, name) {
  await searchFor(page, name);
  const link = page.getByRole('link', { name, exact: true });
  await expect(link).toBeVisible();
  const before = page.url();
  await link.click();
  await page.waitForURL((u) => u.toString() !== before);
  await expect(visible(page.getByRole('heading', { name }))).not.toHaveCount(0);
}

function nextWrite(page) {
  return page
    .waitForResponse((r) => r.request().method() !== 'GET', { timeout: 3000 })
    .catch(() => null);
}

test('REQ-3-2-2: Fork a Repository into Another Namespace - Scenario 1', async ({ page }) => {
  // 用户将可访问仓库 Fork 到个人命名空间后可查看来源链接
  const forkName = `acme-docs-fork-${uid()}`;
  await signIn(page);
  await openRepo(page, 'acme-docs');
  await page.getByRole('button', { name: 'Fork', exact: true }).click();
  await page.getByLabel('Repository name', { exact: true }).fill(forkName);
  await page.getByRole('button', { name: 'Create fork', exact: true }).click();

  const heading = page.getByRole('heading', { name: forkName });
  // "Forked from <source repository name>"; the source may be shown as acme-docs or <owner>/acme-docs
  const forkedFrom = page.getByText(/Forked from\s+(.+\/\s*)?acme-docs(?![\w.-])/);
  const sourceLink = page.getByRole('link', { name: /^(.+\/\s*)?acme-docs$/ });
  await expect(heading).toBeVisible();
  await expect(forkedFrom).toBeVisible();
  await expect(sourceLink).toBeVisible();

  await page.reload();
  await expect(heading).toBeVisible();
  await expect(forkedFrom).toBeVisible();
  await expect(sourceLink).toBeVisible();
});

test('REQ-3-2-2: Fork a Repository into Another Namespace - Scenario 2', async ({ page }) => {
  // 目标命名空间已有同名 Fork 时不创建第二个 Fork
  await signIn(page);
  const workspaceUrl = page.url();
  await searchFor(page, 'acme-docs-fork');
  const existing = page.getByRole('link', { name: 'acme-docs-fork', exact: true });
  await expect(existing).not.toHaveCount(0);
  const before = await existing.count();

  await page.goto(workspaceUrl);
  await openRepo(page, 'acme-docs');
  await page.getByRole('button', { name: 'Fork', exact: true }).click();
  await page.getByLabel('Repository name', { exact: true }).fill('acme-docs-fork');
  const answered = nextWrite(page);
  await page.getByRole('button', { name: 'Create fork', exact: true }).click();
  await answered;
  // rejected: stays on the fork form, no fork overview opened
  await expect(page.getByRole('button', { name: 'Create fork', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'acme-docs-fork' })).toHaveCount(0);
  // no second acme-docs-fork was created
  await page.goto(workspaceUrl);
  await page.reload();
  await searchFor(page, 'acme-docs-fork');
  await expect(existing).not.toHaveCount(0);
  expect(await existing.count()).toBe(before);
});
