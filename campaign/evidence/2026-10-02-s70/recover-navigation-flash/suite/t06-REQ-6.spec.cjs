const { test, expect } = require('@playwright/test');

const PASSWORD = 'Valid-password-123!';
const USERNAME = 'alice-dev';
const REPO = 'acme-docs';
const OPEN_PR = 'Improve onboarding';
const CLOSED_PR = 'Fix search';
const DRAFT_PR = 'Draft onboarding update';
const REVIEWER = 'bob-reviewer';

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function signIn(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(USERNAME);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
}

async function openRepository(page) {
  await page.goto('/');
  const search = page.getByRole('searchbox', { name: 'Search', exact: true });
  await search.fill(REPO);
  await search.press('Enter');
  await page.getByRole('link', { name: REPO, exact: true }).first().click();
}

async function openPullRequests(page) {
  await openRepository(page);
  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
}

async function openPullRequest(page, title) {
  await openPullRequests(page);
  await page.getByRole('link', { name: title, exact: true }).first().click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}

// REQ-6-1

test('REQ-6-1: REQ-6-1: Protect Branches with Review and Status-Check Requirements - Scenario 1', async ({ page }) => {
  await signIn(page);
  await openRepository(page);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Branches', exact: true }).click();

  await page.getByRole('button', { name: 'Add branch protection rule', exact: true }).click();
  await page.getByLabel('Branch name pattern', { exact: true }).fill('main');
  await page.getByRole('checkbox', { name: 'Require 1 approval', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Require status check test', exact: true }).check();
  await page.getByRole('button', { name: 'Create', exact: true }).click();

  await expect(page.getByText('main', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('1 approval', { exact: true })).toBeVisible();
  await expect(page.getByText('Require status check test', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText('1 approval', { exact: true })).toBeVisible();
  await expect(page.getByText('Require status check test', { exact: true })).toBeVisible();

  await openPullRequest(page, OPEN_PR);
  await page.getByRole('combobox', { name: 'test status', exact: true }).click();
  await page.getByRole('option', { name: 'success', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('test: success', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText('test: success', { exact: true })).toBeVisible();
});

test('REQ-6-1#2: REQ-6-1: Protect Branches with Review and Status-Check Requirements - Scenario 2', async ({ page }) => {
  const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const username = 'pw-reader-' + u();
  const password = 'Valid-password-123!';

  async function signInAs(name, pass) {
    await page.goto('/');
    const menu = page.getByRole('button', { name: 'Account menu', exact: true });
    if (await menu.count()) {
      await menu.click();
      await page.getByRole('link', { name: 'Sign out', exact: true }).click();
      await page.getByRole('button', { name: 'Confirm sign out', exact: true }).click();
    }
    await page.getByRole('link', { name: 'Sign in', exact: true }).click();
    await page.getByLabel('Username or email', { exact: true }).fill(name);
    await page.getByLabel('Password', { exact: true }).fill(pass);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
  }

  async function openRepo() {
    await page.goto('/');
    await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('acme-docs');
    await page.getByRole('searchbox', { name: 'Search', exact: true }).press('Enter');
    await page.getByRole('link', { name: 'acme-docs', exact: true }).first().click();
  }

  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(username + '@example.test');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();

  await signInAs('alice-dev', password);
  await openRepo();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Manage access', exact: true }).click();
  await page.getByRole('button', { name: 'Add people or teams', exact: true }).click();
  await page.getByLabel('Search', { exact: true }).fill(username);
  await page.getByRole('option', { name: username, exact: true }).click();
  await page.getByRole('combobox', { name: 'Role', exact: true }).click();
  await page.getByRole('option', { name: 'Read', exact: true }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText(username, { exact: true })).toBeVisible();

  await signInAs(username, password);
  await openRepo();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Branches', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add branch protection rule', exact: true })).toHaveCount(0);
});

test('REQ-6-1#3: REQ-6-1: Protect Branches with Review and Status-Check Requirements - Scenario 3', async ({ page }) => {
  await signIn(page);
  await openPullRequest(page, OPEN_PR);

  await page.getByRole('combobox', { name: 'test status', exact: true }).click();
  await page.getByRole('option', { name: 'success', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText('test: success', { exact: true })).toBeVisible();
  await expect(page.getByText(USERNAME, { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('test: success', { exact: true })).toBeVisible();
});

// REQ-6-2-1

test('REQ-6-2-1: REQ-6-2-1: List and Filter Repository Pull Requests - Scenario 1', async ({ page }) => {
  await openPullRequests(page);

  await page.getByRole('link', { name: 'Open', exact: true }).click();
  await expect(page.getByRole('link', { name: OPEN_PR, exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('link', { name: OPEN_PR, exact: true }).first()).toBeVisible();

  await page.getByRole('link', { name: OPEN_PR, exact: true }).first().click();
  await expect(page.getByRole('heading', { name: OPEN_PR, exact: true })).toBeVisible();

  await openPullRequests(page);
  await page.getByRole('link', { name: 'Closed', exact: true }).click();
  await expect(page.getByRole('link', { name: OPEN_PR, exact: true })).toBeHidden();
  await expect(page.getByRole('link', { name: CLOSED_PR, exact: true }).first()).toBeVisible();
});

test('REQ-6-2-1#2: REQ-6-2-1: List and Filter Repository Pull Requests - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openPullRequests(page);
  await expect(page.getByRole('link', { name: 'New pull request', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('link', { name: 'New pull request', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open', exact: true })).toBeVisible();
});

test('REQ-6-2-1#3: REQ-6-2-1: List and Filter Repository Pull Requests - Scenario 3', async ({ page }) => {
  await signIn(page);
  await openPullRequests(page);
  await page.getByRole('link', { name: 'Open', exact: true }).click();
  await expect(page.getByRole('link', { name: 'New pull request', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('link', { name: OPEN_PR, exact: true }).first()).toBeVisible();
});

// REQ-6-2-2

test('REQ-6-2-2: REQ-6-2-2: Compare Branches Before Opening a Pull Request - Scenario 1', async ({ page }) => {
  await signIn(page);
  await openPullRequests(page);
  await page.getByRole('link', { name: 'New pull request', exact: true }).click();

  await page.getByRole('combobox', { name: 'base', exact: true }).selectOption({ label: 'main' });
  await page.getByRole('combobox', { name: 'compare', exact: true }).selectOption({ label: 'feature-search' });
  await page.getByRole('button', { name: 'Compare changes', exact: true }).click();

  await expect(page.getByText('src/search.ts', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create pull request', exact: true })).toBeEnabled();

  await page.getByRole('combobox', { name: 'compare', exact: true }).selectOption({ label: 'main' });
  await expect(page.getByText('No changes', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create pull request', exact: true })).toBeDisabled();
});

test('REQ-6-2-2#2: REQ-6-2-2: Compare Branches Before Opening a Pull Request - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openPullRequests(page);
  await page.getByRole('link', { name: 'New pull request', exact: true }).click();

  await page.getByRole('combobox', { name: 'base', exact: true }).selectOption({ label: 'main' });
  await page.getByRole('combobox', { name: 'compare', exact: true }).selectOption({ label: 'main' });
  await page.getByRole('button', { name: 'Compare changes', exact: true }).click();

  await expect(page.getByText('No changes', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create pull request', exact: true })).toBeDisabled();
});

// REQ-6-2-3

test('REQ-6-2-3: REQ-6-2-3: Create a Pull Request from Comparison Results - Scenario 1', async ({ page }) => {
  await signIn(page);
  await openPullRequests(page);
  await page.getByRole('link', { name: 'New pull request', exact: true }).click();

  await page.getByRole('combobox', { name: 'base', exact: true }).selectOption({ label: 'main' });
  await page.getByRole('combobox', { name: 'compare', exact: true }).selectOption({ label: 'feature-search' });
  await page.getByRole('button', { name: 'Compare changes', exact: true }).click();

  await page.getByRole('button', { name: 'Create pull request', exact: true }).click();
  const title = 'Comparison result ' + u();
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Description', { exact: true }).fill('Created from comparison results.');
  await page.getByRole('button', { name: 'Create pull request', exact: true }).click();

  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(USERNAME, { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
});

test('REQ-6-2-3#2: REQ-6-2-3: Create a Pull Request from Comparison Results - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openPullRequests(page);
  await expect(page.getByRole('link', { name: 'New pull request', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'New pull request', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'base', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'compare', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('combobox', { name: 'base', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'compare', exact: true })).toBeVisible();
});

// REQ-6-2-4

test('REQ-6-2-4: REQ-6-2-4: Create a Draft Pull Request - Scenario 1', async ({ page }) => {
  await signIn(page);
  await openPullRequests(page);
  await page.getByRole('link', { name: 'New pull request', exact: true }).click();

  await page.getByRole('combobox', { name: 'base', exact: true }).selectOption({ label: 'main' });
  await page.getByRole('combobox', { name: 'compare', exact: true }).selectOption({ label: 'release' });
  await page.getByRole('button', { name: 'Compare changes', exact: true }).click();

  await page.getByRole('button', { name: 'Create draft pull request', exact: true }).click();
  const title = 'Draft change ' + u();
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Description', { exact: true }).fill('Draft created for review.');
  await page.getByRole('button', { name: 'Create draft pull request', exact: true }).click();

  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Merge pull request', exact: true })).toBeDisabled();

  await page.reload();
  await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Merge pull request', exact: true })).toBeDisabled();
});

test('REQ-6-2-4#2: REQ-6-2-4: Create a Draft Pull Request - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openPullRequest(page, DRAFT_PR);
  await expect(page.getByRole('button', { name: 'Ready for review', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Ready for review', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click({ timeout: 2000 }).catch(() => {});

  await expect(page.getByText('Draft', { exact: true })).toBeHidden();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('Draft', { exact: true })).toBeHidden();
  await expect(page.getByRole('heading', { name: DRAFT_PR, exact: true })).toBeVisible();
});

// REQ-6-3-1

test('REQ-6-3-1: REQ-6-3-1: View Pull Request Overview and Commits - Scenario 1', async ({ page }) => {
  await openPullRequest(page, OPEN_PR);

  await page.getByRole('link', { name: 'Conversation', exact: true }).click();
  await expect(page.getByRole('heading', { name: OPEN_PR, exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Commits', exact: true }).click();
  await expect(page.getByRole('heading', { name: OPEN_PR, exact: true })).toBeVisible();
  await expect(page.getByText('Commit summary', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await expect(page.getByRole('heading', { name: OPEN_PR, exact: true })).toBeVisible();
  await expect(page.getByText('Changed files', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: OPEN_PR, exact: true })).toBeVisible();
});

test('REQ-6-3-1#2: REQ-6-3-1: View Pull Request Overview and Commits - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openPullRequest(page, OPEN_PR);
  await page.getByRole('link', { name: 'Commits', exact: true }).click();
  await expect(page.getByRole('heading', { name: OPEN_PR, exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: OPEN_PR, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Conversation', exact: true })).toBeVisible();
});

test('REQ-6-3-1#3: REQ-6-3-1: View Pull Request Overview and Commits - Scenario 3', async ({ page }) => {
  await signIn(page);
  await openPullRequest(page, OPEN_PR);
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await expect(page.getByRole('heading', { name: OPEN_PR, exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: OPEN_PR, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Commits', exact: true })).toBeVisible();
});

// REQ-6-3-2

test('REQ-6-3-2: REQ-6-3-2: Inspect Changed Files and Aggregate Diff - Scenario 1', async ({ page }) => {
  await openPullRequest(page, OPEN_PR);

  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await expect(page.getByText('Changed files', { exact: true })).toBeVisible();
  await expect(page.getByText('src/search.ts', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('src/search.ts', { exact: true }).first()).toBeVisible();

  await page.getByRole('link', { name: 'Conversation', exact: true }).click();
  await expect(page.getByRole('heading', { name: OPEN_PR, exact: true })).toBeVisible();
});

// REQ-6-3-3

test('REQ-6-3-3: REQ-6-3-3: Add Review Comments to Changed Code Lines - Scenario 1', async ({ page }) => {
  const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const username = 'pw-review-' + u();
  const password = 'Valid-password-123!';
  const body = 'Inline comment ' + u();

  async function signInAs(name, pass) {
    await page.goto('/');
    const menu = page.getByRole('button', { name: 'Account menu', exact: true });
    if (await menu.count()) {
      await menu.click();
      await page.getByRole('link', { name: 'Sign out', exact: true }).click();
      await page.getByRole('button', { name: 'Confirm sign out', exact: true }).click();
    }
    await page.getByRole('link', { name: 'Sign in', exact: true }).click();
    await page.getByLabel('Username or email', { exact: true }).fill(name);
    await page.getByLabel('Password', { exact: true }).fill(pass);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
  }

  async function openRepo() {
    await page.goto('/');
    await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('acme-docs');
    await page.getByRole('searchbox', { name: 'Search', exact: true }).press('Enter');
    await page.getByRole('link', { name: 'acme-docs', exact: true }).first().click();
  }

  async function openPr() {
    await openRepo();
    await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
    await page.getByRole('link', { name: 'Improve onboarding', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  }

  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(username + '@example.test');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();

  await signInAs('alice-dev', password);
  await openRepo();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Manage access', exact: true }).click();
  await page.getByRole('button', { name: 'Add people or teams', exact: true }).click();
  await page.getByLabel('Search', { exact: true }).fill(username);
  await page.getByRole('option', { name: username, exact: true }).click();
  await page.getByRole('combobox', { name: 'Role', exact: true }).click();
  await page.getByRole('option', { name: 'Write', exact: true }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText(username, { exact: true })).toBeVisible();

  await signInAs(username, password);
  await openPr();
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await page.getByRole('button', { name: 'Add comment', exact: true }).first().click();
  await page.getByLabel('Comment', { exact: true }).fill(body);
  await page.getByRole('button', { name: 'Add single comment', exact: true }).click();
  await expect(page.getByText(body, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(body, { exact: true })).toBeVisible();
});

test('REQ-6-3-3#2: REQ-6-3-3: Add Review Comments to Changed Code Lines - Scenario 2', async ({ page }) => {
  const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const username = 'pw-review-' + u();
  const password = 'Valid-password-123!';
  const body = 'Pending comment ' + u();

  async function signInAs(name, pass) {
    await page.goto('/');
    const menu = page.getByRole('button', { name: 'Account menu', exact: true });
    if (await menu.count()) {
      await menu.click();
      await page.getByRole('link', { name: 'Sign out', exact: true }).click();
      await page.getByRole('button', { name: 'Confirm sign out', exact: true }).click();
    }
    await page.getByRole('link', { name: 'Sign in', exact: true }).click();
    await page.getByLabel('Username or email', { exact: true }).fill(name);
    await page.getByLabel('Password', { exact: true }).fill(pass);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
  }

  async function openRepo() {
    await page.goto('/');
    await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('acme-docs');
    await page.getByRole('searchbox', { name: 'Search', exact: true }).press('Enter');
    await page.getByRole('link', { name: 'acme-docs', exact: true }).first().click();
  }

  async function openPr() {
    await openRepo();
    await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
    await page.getByRole('link', { name: 'Improve onboarding', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  }

  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(username + '@example.test');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();

  await signInAs('alice-dev', password);
  await openRepo();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Manage access', exact: true }).click();
  await page.getByRole('button', { name: 'Add people or teams', exact: true }).click();
  await page.getByLabel('Search', { exact: true }).fill(username);
  await page.getByRole('option', { name: username, exact: true }).click();
  await page.getByRole('combobox', { name: 'Role', exact: true }).click();
  await page.getByRole('option', { name: 'Write', exact: true }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText(username, { exact: true })).toBeVisible();

  await signInAs(username, password);
  await openPr();
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await page.getByRole('button', { name: 'Add comment', exact: true }).first().click();
  await page.getByLabel('Comment', { exact: true }).fill(body);
  await page.getByRole('button', { name: 'Start a review', exact: true }).click();
  await expect(page.getByText(body, { exact: true })).toBeVisible();
  await expect(page.getByText('Pending review', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(body, { exact: true })).toBeVisible();
  await expect(page.getByText('Pending review', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Conversation', exact: true }).click();
  await expect(page.getByText(body, { exact: true })).toBeHidden();
});

// REQ-6-3-4

test('REQ-6-3-4: REQ-6-3-4: Submit a Pull Request Review - Scenario 1', async ({ page }) => {
  const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const username = 'pw-review-' + u();
  const password = 'Valid-password-123!';

  async function signInAs(name, pass) {
    await page.goto('/');
    const menu = page.getByRole('button', { name: 'Account menu', exact: true });
    if (await menu.count()) {
      await menu.click();
      await page.getByRole('link', { name: 'Sign out', exact: true }).click();
      await page.getByRole('button', { name: 'Confirm sign out', exact: true }).click();
    }
    await page.getByRole('link', { name: 'Sign in', exact: true }).click();
    await page.getByLabel('Username or email', { exact: true }).fill(name);
    await page.getByLabel('Password', { exact: true }).fill(pass);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
  }

  async function openRepo() {
    await page.goto('/');
    await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('acme-docs');
    await page.getByRole('searchbox', { name: 'Search', exact: true }).press('Enter');
    await page.getByRole('link', { name: 'acme-docs', exact: true }).first().click();
  }

  async function openPr() {
    await openRepo();
    await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
    await page.getByRole('link', { name: 'Improve onboarding', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  }

  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(username + '@example.test');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();

  await signInAs('alice-dev', password);
  await openRepo();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Manage access', exact: true }).click();
  await page.getByRole('button', { name: 'Add people or teams', exact: true }).click();
  await page.getByLabel('Search', { exact: true }).fill(username);
  await page.getByRole('option', { name: username, exact: true }).click();
  await page.getByRole('combobox', { name: 'Role', exact: true }).click();
  await page.getByRole('option', { name: 'Write', exact: true }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText(username, { exact: true })).toBeVisible();

  await signInAs(username, password);
  await openPr();
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await page.getByRole('button', { name: 'Review changes', exact: true }).click();
  await page.getByLabel('Summary', { exact: true }).fill('Looks good');
  await page.getByRole('radio', { name: 'Approve', exact: true }).check();
  await page.getByRole('button', { name: 'Submit review', exact: true }).click();
  await expect(page.getByText('Approved', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('Approved', { exact: true }).first()).toBeVisible();
});

test('REQ-6-3-4#2: REQ-6-3-4: Submit a Pull Request Review - Scenario 2', async ({ page }) => {
  const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const username = 'pw-review-' + u();
  const password = 'Valid-password-123!';
  const summary = 'Needs changes';

  async function signInAs(name, pass) {
    await page.goto('/');
    const menu = page.getByRole('button', { name: 'Account menu', exact: true });
    if (await menu.count()) {
      await menu.click();
      await page.getByRole('link', { name: 'Sign out', exact: true }).click();
      await page.getByRole('button', { name: 'Confirm sign out', exact: true }).click();
    }
    await page.getByRole('link', { name: 'Sign in', exact: true }).click();
    await page.getByLabel('Username or email', { exact: true }).fill(name);
    await page.getByLabel('Password', { exact: true }).fill(pass);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
  }

  async function openRepo() {
    await page.goto('/');
    await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('acme-docs');
    await page.getByRole('searchbox', { name: 'Search', exact: true }).press('Enter');
    await page.getByRole('link', { name: 'acme-docs', exact: true }).first().click();
  }

  async function openPr() {
    await openRepo();
    await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
    await page.getByRole('link', { name: 'Improve onboarding', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  }

  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(username + '@example.test');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();

  await signInAs('alice-dev', password);
  await openRepo();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Manage access', exact: true }).click();
  await page.getByRole('button', { name: 'Add people or teams', exact: true }).click();
  await page.getByLabel('Search', { exact: true }).fill(username);
  await page.getByRole('option', { name: username, exact: true }).click();
  await page.getByRole('combobox', { name: 'Role', exact: true }).click();
  await page.getByRole('option', { name: 'Write', exact: true }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText(username, { exact: true })).toBeVisible();

  await signInAs(username, password);
  await openPr();
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await page.getByRole('button', { name: 'Review changes', exact: true }).click();
  await page.getByLabel('Summary', { exact: true }).fill(summary);
  await page.getByRole('radio', { name: 'Request changes', exact: true }).check();
  await page.getByRole('button', { name: 'Submit review', exact: true }).click();
  await expect(page.getByText('Changes requested', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(summary, { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('Changes requested', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(summary, { exact: true }).first()).toBeVisible();
});

// REQ-6-4

test('REQ-6-4: REQ-6-4: Request or Remove Pull Request Reviewers - Scenario 1', async ({ page }) => {
  await signIn(page);
  await openPullRequest(page, OPEN_PR);

  await page.getByRole('button', { name: 'Reviewers', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search', exact: true }).fill(REVIEWER);
  await page.getByRole('option', { name: REVIEWER, exact: true }).click();

  await expect(page.getByRole('button', { name: `Remove ${REVIEWER}`, exact: true })).toBeVisible();

  await page.getByRole('button', { name: `Remove ${REVIEWER}`, exact: true }).click();
  await expect(page.getByRole('button', { name: `Remove ${REVIEWER}`, exact: true })).toBeHidden();

  await page.reload();
  await expect(page.getByRole('button', { name: `Remove ${REVIEWER}`, exact: true })).toBeHidden();
});

// REQ-6-5

test('REQ-6-5: REQ-6-5: Merge an Eligible Pull Request - Scenario 1', async ({ page }) => {
  const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const password = 'Valid-password-123!';
  const reviewer = 'pw-review-' + u();
  const repoName = 'pw-repo-' + u();
  const branch = 'pw-branch-' + u();
  const fileName = 'pw-file-' + u() + '.md';
  const prTitle = 'Eligible PR ' + u();

  async function signInAs(name, pass) {
    await page.goto('/');
    const menu = page.getByRole('button', { name: 'Account menu', exact: true });
    if (await menu.count()) {
      await menu.click();
      await page.getByRole('link', { name: 'Sign out', exact: true }).click();
      await page.getByRole('button', { name: 'Confirm sign out', exact: true }).click();
    }
    await page.getByRole('link', { name: 'Sign in', exact: true }).click();
    await page.getByLabel('Username or email', { exact: true }).fill(name);
    await page.getByLabel('Password', { exact: true }).fill(pass);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
  }

  async function openRepo() {
    await page.goto('/');
    await page.getByRole('searchbox', { name: 'Search', exact: true }).fill(repoName);
    await page.getByRole('searchbox', { name: 'Search', exact: true }).press('Enter');
    await page.getByRole('link', { name: repoName, exact: true }).first().click();
  }

  async function openPr() {
    await openRepo();
    await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
    await page.getByRole('link', { name: prTitle, exact: true }).first().click();
    await expect(page.getByRole('heading', { name: prTitle, exact: true })).toBeVisible();
  }

  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(reviewer);
  await page.getByLabel('Email', { exact: true }).fill(reviewer + '@example.test');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();

  await signInAs('alice-dev', password);
  await page.goto('/');
  await page.getByRole('link', { name: 'New repository', exact: true }).click();
  await page.getByLabel('Repository name', { exact: true }).fill(repoName);
  await page.getByLabel('Description', { exact: true }).fill('Merge eligibility test');
  await page.getByRole('radio', { name: 'Public', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Add a README file', exact: true }).check();
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();
  await expect(page.getByRole('heading', { name: new RegExp(repoName) })).toBeVisible();

  await openRepo();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Manage access', exact: true }).click();
  await page.getByRole('button', { name: 'Add people or teams', exact: true }).click();
  await page.getByLabel('Search', { exact: true }).fill(reviewer);
  await page.getByRole('option', { name: reviewer, exact: true }).click();
  await page.getByRole('combobox', { name: 'Role', exact: true }).click();
  await page.getByRole('option', { name: 'Write', exact: true }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText(reviewer, { exact: true })).toBeVisible();

  await openRepo();
  await page.getByRole('button', { name: 'Branch main', exact: true }).click();
  await page.getByLabel('Find branch', { exact: true }).fill(branch);
  await page.getByRole('option', { name: 'Create branch: ' + branch, exact: true }).click();
  await expect(page.getByRole('button', { name: 'Branch ' + branch, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add file', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Create new file', exact: true }).click();
  await page.getByLabel('File name', { exact: true }).fill(fileName);
  await page.getByLabel('File contents', { exact: true }).fill('Content for eligible PR.');
  await page.getByLabel('Commit message', { exact: true }).fill('Add ' + fileName);
  await page.getByRole('button', { name: 'Commit changes', exact: true }).click();
  await expect(page.getByText('Content for eligible PR.', { exact: true })).toBeVisible();

  await openRepo();
  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await page.getByRole('link', { name: 'New pull request', exact: true }).click();
  await page.getByRole('combobox', { name: 'base', exact: true }).selectOption({ label: 'main' });
  await page.getByRole('combobox', { name: 'compare', exact: true }).selectOption({ label: branch });
  await page.getByRole('button', { name: 'Compare changes', exact: true }).click();
  await page.getByRole('button', { name: 'Create pull request', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(prTitle);
  await page.getByLabel('Description', { exact: true }).fill('Eligible merge test.');
  await page.getByRole('button', { name: 'Create pull request', exact: true }).click();
  await expect(page.getByRole('heading', { name: prTitle, exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Branches', exact: true }).click();
  await page.getByRole('button', { name: 'Add branch protection rule', exact: true }).click();
  await page.getByLabel('Branch name pattern', { exact: true }).fill('main');
  await page.getByRole('checkbox', { name: 'Require 1 approval', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Require status check test', exact: true }).check();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByText('1 approval', { exact: true })).toBeVisible();
  await expect(page.getByText('Require status check test', { exact: true })).toBeVisible();

  await openPr();
  await page.getByRole('combobox', { name: 'test status', exact: true }).click();
  await page.getByRole('option', { name: 'success', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('test: success', { exact: true })).toBeVisible();

  await signInAs(reviewer, password);
  await openPr();
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await page.getByRole('button', { name: 'Review changes', exact: true }).click();
  await page.getByLabel('Summary', { exact: true }).fill('Approved by reviewer.');
  await page.getByRole('radio', { name: 'Approve', exact: true }).check();
  await page.getByRole('button', { name: 'Submit review', exact: true }).click();
  await expect(page.getByText('Approved', { exact: true }).first()).toBeVisible();

  await signInAs('alice-dev', password);
  await openPr();
  await page.getByRole('button', { name: 'Merge pull request', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm merge', exact: true }).click();
  await expect(page.getByText('Merged', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('Merged', { exact: true }).first()).toBeVisible();
});

test('REQ-6-5#2: REQ-6-5: Merge an Eligible Pull Request - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openPullRequest(page, OPEN_PR);
  await expect(page.getByRole('button', { name: 'Merge pull request', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Merge pull request', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: OPEN_PR, exact: true })).toBeVisible();
});

// REQ-6-6

test('REQ-6-6: REQ-6-6: Close or Reopen a Pull Request Without Merging - Scenario 1', async ({ page }) => {
  await signIn(page);
  await openPullRequest(page, OPEN_PR);

  await page.getByRole('button', { name: 'Close pull request', exact: true }).click();
  await expect(page.getByText('Closed', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Reopen pull request', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Close pull request', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Close pull request', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: OPEN_PR, exact: true })).toBeVisible();
});

test('REQ-6-6#2: REQ-6-6: Close or Reopen a Pull Request Without Merging - Scenario 2', async ({ page }) => {
  const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const username = 'pw-reader-' + u();
  const password = 'Valid-password-123!';

  async function signInAs(name, pass) {
    await page.goto('/');
    const menu = page.getByRole('button', { name: 'Account menu', exact: true });
    if (await menu.count()) {
      await menu.click();
      await page.getByRole('link', { name: 'Sign out', exact: true }).click();
      await page.getByRole('button', { name: 'Confirm sign out', exact: true }).click();
    }
    await page.getByRole('link', { name: 'Sign in', exact: true }).click();
    await page.getByLabel('Username or email', { exact: true }).fill(name);
    await page.getByLabel('Password', { exact: true }).fill(pass);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
  }

  async function openRepo() {
    await page.goto('/');
    await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('acme-docs');
    await page.getByRole('searchbox', { name: 'Search', exact: true }).press('Enter');
    await page.getByRole('link', { name: 'acme-docs', exact: true }).first().click();
  }

  async function openPr() {
    await openRepo();
    await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
    await page.getByRole('link', { name: 'Improve onboarding', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  }

  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(username + '@example.test');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();

  await signInAs('alice-dev', password);
  await openRepo();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Manage access', exact: true }).click();
  await page.getByRole('button', { name: 'Add people or teams', exact: true }).click();
  await page.getByLabel('Search', { exact: true }).fill(username);
  await page.getByRole('option', { name: username, exact: true }).click();
  await page.getByRole('combobox', { name: 'Role', exact: true }).click();
  await page.getByRole('option', { name: 'Read', exact: true }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText(username, { exact: true })).toBeVisible();

  await signInAs(username, password);
  await openPr();
  await expect(page.getByRole('button', { name: 'Close pull request', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reopen pull request', exact: true })).toHaveCount(0);
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });