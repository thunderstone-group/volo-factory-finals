const { test, expect } = require('@playwright/test');

test.setTimeout(15000);

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function isVisible(locator) {
  try {
    await locator.first().waitFor({ state: 'visible', timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

async function signIn(page, username = 'alice-dev', password = 'Valid-password-123!') {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
}

async function createNonAdminAndSignIn(page) {
  const username = 'viewer-' + u().slice(0, 8);
  const password = 'Valid-password-123!';
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(`${username}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
}

async function openRepository(page, repoName = 'acme-docs') {
  await page.goto('/');
  const search = page.getByRole('searchbox', { name: 'Search', exact: true });
  await search.fill(repoName);
  await search.press('Enter');
  await page.getByRole('link', { name: repoName, exact: true }).first().click();
  await expect(page.getByRole('heading', { name: new RegExp(repoName) })).toBeVisible();
}

async function ensureBranchProtectionRule(page, branchName = 'main') {
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Branches', exact: true }).click();
  const addButton = page.getByRole('button', { name: 'Add branch protection rule', exact: true });
  if (await addButton.count()) {
    await addButton.click();
    await page.getByLabel('Branch name pattern', { exact: true }).fill(branchName);
    await page.getByRole('checkbox', { name: 'Require 1 approval', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Require status check test', exact: true }).check();
    await page.getByRole('button', { name: 'Create', exact: true }).click();
  }
}

async function createBranchAndOpenPR(page, branchName, title) {
  await openRepository(page);
  await page.getByRole('button', { name: 'Branch main', exact: true }).click();
  await page.getByLabel('Find branch', { exact: true }).fill(branchName);
  await page.getByRole('option', { name: `Create branch: ${branchName}`, exact: true }).click();
  await expect(page.getByRole('button', { name: `Branch ${branchName}`, exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Add file', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Create new file', exact: true }).click();
  await page.getByLabel('File name', { exact: true }).fill(`${branchName}.md`);
  await page.getByLabel('File contents', { exact: true }).fill(`Content for ${branchName}`);
  await page.getByLabel('Commit message', { exact: true }).fill(`Add ${branchName}`);
  await page.getByRole('button', { name: 'Commit changes', exact: true }).click();
  await expect(page.getByText(`Content for ${branchName}`, { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await page.getByRole('link', { name: 'New pull request', exact: true }).click();
  await page.getByRole('combobox', { name: 'base', exact: true }).selectOption({ label: 'main' });
  await page.getByRole('combobox', { name: 'compare', exact: true }).selectOption({ label: branchName });
  await page.getByRole('button', { name: 'Compare changes', exact: true }).click();
  await page.getByRole('button', { name: 'Create pull request', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByRole('button', { name: 'Create pull request', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}

test('REQ-6-1: Protect Branches with Review and Status-Check Requirements - Scenario 1', async ({ page }) => {
  await signIn(page);
  await openRepository(page);
  await ensureBranchProtectionRule(page, 'main');
  await expect(page.getByText('1 approval', { exact: true })).toBeVisible();
  await expect(page.getByText('Require status check test', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  const prLink = page.getByRole('link', { name: 'Improve onboarding', exact: true });
  if (await isVisible(prLink)) {
    await prLink.first().click();
  } else {
    await createBranchAndOpenPR(page, 'pw-pr-' + u(), 'Protection check PR ' + u());
  }

  await page.getByRole('link', { name: 'Checks', exact: true }).click();
  await expect(page.getByText('test: pending', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'test status', exact: true }).selectOption({ label: 'success' });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('test: success', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('test: success', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Branches', exact: true }).click();
  await expect(page.getByText('1 approval', { exact: true })).toBeVisible();
  await expect(page.getByText('Require status check test', { exact: true })).toBeVisible();
});

test('REQ-6-1: Protect Branches with Review and Status-Check Requirements - Scenario 2', async ({ page }) => {
  await createNonAdminAndSignIn(page);
  await openRepository(page);

  const settings = page.getByRole('link', { name: 'Settings', exact: true });
  if (await settings.count()) {
    await settings.click();
    const branches = page.getByRole('link', { name: 'Branches', exact: true });
    if (await branches.count()) {
      await branches.click();
    }
  }

  await expect(page.getByRole('button', { name: 'Add branch protection rule', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Add branch protection rule', exact: true })).toHaveCount(0);
});

test('REQ-6-1: Protect Branches with Review and Status-Check Requirements - Scenario 3', async ({ page }) => {
  await signIn(page);
  await openRepository(page);
  await ensureBranchProtectionRule(page, 'main');
  await openRepository(page);

  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await page.getByRole('link', { name: 'Open', exact: true }).click();

  const fixSearch = page.getByRole('link', { name: 'Fix search', exact: true });
  if (await isVisible(fixSearch)) {
    await fixSearch.first().click();
  } else {
    await createBranchAndOpenPR(page, 'pw-branch-' + u(), 'Check status PR ' + u());
  }

  await page.getByRole('link', { name: 'Checks', exact: true }).click();
  await expect(page.getByText('test: pending', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'test status', exact: true }).selectOption({ label: 'success' });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('test: success', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('test: success', { exact: true })).toBeVisible();
});

test('REQ-6-2-1: List and Filter Repository Pull Requests - Scenario 1', async ({ page }) => {
  await openRepository(page);
  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await page.getByRole('link', { name: 'Open', exact: true }).click();

  await expect(page.getByRole('link', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Improve onboarding', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await page.getByRole('link', { name: 'Closed', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Improve onboarding', exact: true })).toHaveCount(0);
});

test('REQ-6-2-1: List and Filter Repository Pull Requests - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openRepository(page);
  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await expect(page.getByRole('link', { name: 'New pull request', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'New pull request', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open', exact: true })).toBeVisible();
});

test('REQ-6-2-1: List and Filter Repository Pull Requests - Scenario 3', async ({ page }) => {
  await signIn(page);
  await openRepository(page);
  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Closed', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Closed', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open', exact: true })).toBeVisible();
});

test('REQ-6-2-2: Compare Branches Before Opening a Pull Request - Scenario 1', async ({ page }) => {
  await signIn(page);
  await openRepository(page);
  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await page.getByRole('link', { name: 'New pull request', exact: true }).click();

  await page.getByRole('combobox', { name: 'base', exact: true }).selectOption({ label: 'main' });
  await page.getByRole('combobox', { name: 'compare', exact: true }).selectOption({ label: 'feature-search' });
  await page.getByRole('button', { name: 'Compare changes', exact: true }).click();

  await expect(page.getByText('src/search.ts', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create pull request', exact: true })).toBeEnabled();

  await page.getByRole('combobox', { name: 'compare', exact: true }).selectOption({ label: 'main' });
  await expect(page.getByText('No changes', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create pull request', exact: true })).toBeDisabled();
});

test('REQ-6-2-2: Compare Branches Before Opening a Pull Request - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openRepository(page);
  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await page.getByRole('link', { name: 'New pull request', exact: true }).click();

  await page.getByRole('combobox', { name: 'base', exact: true }).selectOption({ label: 'main' });
  await page.getByRole('combobox', { name: 'compare', exact: true }).selectOption({ label: 'main' });
  await page.getByRole('button', { name: 'Compare changes', exact: true }).click();

  await expect(page.getByText('No changes', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create pull request', exact: true })).toBeDisabled();
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

