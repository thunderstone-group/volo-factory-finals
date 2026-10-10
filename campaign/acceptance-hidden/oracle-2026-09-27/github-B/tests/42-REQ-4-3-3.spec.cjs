const { test, expect } = require('@playwright/test');

// REQ-4-3-3 Change the Repository Default Branch.
// S1: Admin = seed owner alice-dev on `alice-dev/acme-docs`, which (per the scenario seed) has
//     branches `main` and `release`. Settings -> Branches -> native select "Default branch" ->
//     "Update" -> "Confirm". Reopening the repository shows "Branch release" and still offers `main`.
//     The test restores `main` at the end so later scenarios see the original default branch.
// S2: the non-Admin is a freshly registered account (no seed credentials exist for another user);
//     no "Default branch" combobox or "Update" button may be rendered for it.

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

async function registerAndSignIn(page) {
  const username = `pw-na-${uid()}`;
  const password = 'Valid-password-123!';
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page
    .getByRole('link', { name: 'Create an account', exact: true })
    .or(page.getByRole('button', { name: 'Create an account', exact: true }))
    .click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(`${username}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByLabel('Username or email', { exact: true })).toBeVisible();
  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toHaveCount(0);
  await expect(visible(page.getByText(username))).not.toHaveCount(0);
  return username;
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

async function openBranchSettings(page, repoUrl) {
  await page.goto(repoUrl);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Branches', exact: true }).click();
}

async function setDefaultBranch(page, repoUrl, branch) {
  await openBranchSettings(page, repoUrl);
  await page.getByRole('combobox', { name: 'Default branch', exact: true }).selectOption({ label: branch });
  await page.getByRole('button', { name: 'Update', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toHaveCount(0);
}

test('REQ-4-3-3: Change the Repository Default Branch - Scenario 1', async ({ page }) => {
  // 管理员修改默认分支后，新打开的仓库使用新分支且旧分支保留
  await signIn(page);
  await openCodePage(page, 'acme-docs');
  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();
  const repoUrl = page.url();

  await setDefaultBranch(page, repoUrl, 'release');
  // newly opening the repository uses release; main is still offered
  await page.goto(repoUrl);
  await page.reload();
  const selector = page.getByRole('button', { name: 'Branch release', exact: true });
  await expect(selector).toBeVisible();
  await selector.click();
  await expect(page.getByRole('option', { name: 'main', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  // saved: reopening and refreshing the settings page still shows release
  await openBranchSettings(page, repoUrl);
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Default branch', exact: true }).locator('option:checked')).toHaveText('release');

  // restore the original default so later scenarios start from main
  await setDefaultBranch(page, repoUrl, 'main');
  await page.goto(repoUrl);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();
});

test('REQ-4-3-3: Change the Repository Default Branch - Scenario 2', async ({ page }) => {
  // 没有仓库管理权限的用户不能修改默认分支
  await registerAndSignIn(page);
  await openCodePage(page, 'acme-docs');
  const branchButton = page.getByRole('button', { name: /^Branch \S+$/ });
  await expect(branchButton).toBeVisible();
  const repoUrl = page.url();
  const defaultBefore = await branchButton.evaluate((el) => el.getAttribute('aria-label') || el.textContent.trim());

  const settings = page.getByRole('link', { name: 'Settings', exact: true });
  if ((await settings.count()) > 0) {
    await settings.click();
    await page.waitForTimeout(400);
    const branches = page.getByRole('link', { name: 'Branches', exact: true });
    if ((await branches.count()) > 0) {
      await branches.click();
      await page.waitForTimeout(400);
    }
  }
  await expect(page.getByRole('combobox', { name: 'Default branch' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Update', exact: true })).toHaveCount(0);

  // the saved default branch is unchanged when the repository is reopened
  await page.goto(repoUrl);
  await expect(branchButton).toBeVisible();
  expect(await branchButton.evaluate((el) => el.getAttribute('aria-label') || el.textContent.trim())).toBe(defaultBefore);
});
