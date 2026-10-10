const { test, expect } = require('@playwright/test');

// REQ-4-3-2 Create a Branch from an Existing Revision.
// Writer = seed owner alice-dev on `alice-dev/acme-docs` (main). Typing a valid unused name shows
// option "Create branch: <name>"; selecting it creates and switches without a second confirmation.
// `invalid..branch` immediately shows "Invalid branch" and cannot create a reference.

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

test('REQ-4-3-2: Create a Branch from an Existing Revision - Scenario 1', async ({ page }) => {
  // 有协作权限的用户从现有修订创建并切换到新分支
  const branch = `pw-branch-${uid()}`;
  await signIn(page);
  await openCodePage(page, 'acme-docs');
  await page.getByRole('button', { name: 'Branch main', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find branch', exact: true }).fill(branch);
  await page.getByRole('option', { name: `Create branch: ${branch}`, exact: true }).click();

  const selector = page.getByRole('button', { name: `Branch ${branch}`, exact: true });
  await expect(selector).toBeVisible();
  // based on main's head: main's files, not feature-search's
  await expect(page.getByRole('link', { name: 'README.md', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'main-only.md', exact: true })).toHaveCount(0);

  await page.reload();
  await expect(selector).toBeVisible();
  await selector.click();
  await page.getByRole('textbox', { name: 'Find branch', exact: true }).fill(branch);
  await expect(page.getByRole('option', { name: branch, exact: true })).toBeVisible();
});

test('REQ-4-3-2: Create a Branch from an Existing Revision - Scenario 2', async ({ page }) => {
  // 非法分支名不会创建分支
  await signIn(page);
  await openCodePage(page, 'acme-docs');
  await page.getByRole('button', { name: 'Branch main', exact: true }).click();
  const find = page.getByRole('textbox', { name: 'Find branch', exact: true });
  await find.fill('invalid..branch');
  await expect(page.getByText('Invalid branch')).toBeVisible();
  await expect(page.getByRole('option', { name: 'Create branch: invalid..branch', exact: true })).toHaveCount(0);
  await find.press('Enter');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();

  // after reload the reference still does not exist
  await page.reload();
  await page.getByRole('button', { name: 'Branch main', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find branch', exact: true }).fill('invalid..branch');
  await expect(page.getByText('Invalid branch')).toBeVisible();
  await expect(page.getByRole('option', { name: 'invalid..branch', exact: true })).toHaveCount(0);
});
