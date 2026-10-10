const { test, expect } = require('@playwright/test');

const ADMIN_USER = 'alice-dev';
const ADMIN_PASSWORD = 'Valid-password-123!';
const PUBLIC_REPO = 'acme-docs';
const OPEN_PR = 'Improve onboarding';
const SECOND_PR = 'Fix search';

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function signIn(page, username, password) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
}

async function signInAsAlice(page) {
  await signIn(page, ADMIN_USER, ADMIN_PASSWORD);
}

async function registerAndSignIn(page) {
  const username = 'pw-user-' + u();
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
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
  return username;
}

async function openRepository(page, repoName = PUBLIC_REPO) {
  await page.goto('/');
  const search = page.getByRole('searchbox', { name: 'Search', exact: true });
  await search.fill(repoName);
  await search.press('Enter');
  await page.getByRole('link', { name: repoName, exact: true }).first().click();
  await expect(page.getByRole('heading', { name: /acme-docs/ })).toBeVisible();
}

async function openPR(page, title) {
  await openRepository(page);
  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await page.getByRole('link', { name: title, exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}

async function openComparison(page, baseBranch = 'main', compareBranch = 'feature-search') {
  await openRepository(page);
  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await page.getByRole('link', { name: 'New pull request', exact: true }).click();
  await page.getByRole('combobox', { name: 'base', exact: true }).selectOption({ label: baseBranch });
  await page.getByRole('combobox', { name: 'compare', exact: true }).selectOption({ label: compareBranch });
  await page.getByRole('button', { name: 'Compare changes', exact: true }).click();
}

test('REQ-6-1: Protect Branches with Review and Status-Check Requirements - Scenario 1', async ({ page }) => {
  await signInAsAlice(page);
  await openRepository(page);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Branches', exact: true }).click();
  await page.getByRole('button', { name: 'Add branch protection rule', exact: true }).click();
  await page.getByLabel('Branch name pattern', { exact: true }).fill('main');
  await page.getByRole('checkbox', { name: 'Require 1 approval', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Require status check test', exact: true }).check();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByText('1 approval', { exact: true })).toBeVisible();
  await expect(page.getByText('Require status check test', { exact: true })).toBeVisible();

  await openPR(page, OPEN_PR);
  await page.getByRole('link', { name: 'Checks', exact: true }).click();
  await expect(page.getByText('test: pending', { exact: true })).toBeVisible();
  await page.getByLabel('test status', { exact: true }).selectOption({ label: 'success' });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('test: success', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('test: success', { exact: true })).toBeVisible();
});

test('REQ-6-1: Protect Branches with Review and Status-Check Requirements - Scenario 2', async ({ page }) => {
  await registerAndSignIn(page);
  await openRepository(page);
  const settings = page.getByRole('link', { name: 'Settings', exact: true });
  if (await settings.count()) {
    await settings.click();
    await page.getByRole('link', { name: 'Branches', exact: true }).click();
  }
  await expect(page.getByRole('button', { name: 'Add branch protection rule', exact: true })).toHaveCount(0);
});

test('REQ-6-1: Protect Branches with Review and Status-Check Requirements - Scenario 3', async ({ page }) => {
  await signInAsAlice(page);
  await openPR(page, SECOND_PR);
  await page.getByRole('link', { name: 'Checks', exact: true }).click();
  await expect(page.getByText('test: pending', { exact: true })).toBeVisible();
  await page.getByLabel('test status', { exact: true }).selectOption({ label: 'success' });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('test: success', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('test: success', { exact: true })).toBeVisible();
});

test('REQ-6-2-1: List and Filter Repository Pull Requests - Scenario 1', async ({ page }) => {
  await openRepository(page);
  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await page.getByRole('link', { name: 'Open', exact: true }).click();
  await expect(page.getByRole('link', { name: OPEN_PR, exact: true })).toBeVisible();
  await page.getByRole('link', { name: OPEN_PR, exact: true }).click();
  await expect(page.getByRole('heading', { name: OPEN_PR, exact: true })).toBeVisible();
  await page.goBack();
  await page.getByRole('link', { name: 'Closed', exact: true }).click();
  await expect(page.getByRole('link', { name: OPEN_PR, exact: true })).toHaveCount(0);
});

test('REQ-6-2-1: List and Filter Repository Pull Requests - Scenario 2', async ({ page }) => {
  await signInAsAlice(page);
  await openRepository(page);
  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await page.getByRole('link', { name: 'Open', exact: true }).click();
  await expect(page.getByRole('link', { name: OPEN_PR, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: OPEN_PR, exact: true })).toBeVisible();
});

test('REQ-6-2-1: List and Filter Repository Pull Requests - Scenario 3', async ({ page }) => {
  await signInAsAlice(page);
  await openRepository(page);
  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await page.getByRole('link', { name: 'Closed', exact: true }).click();
  await expect(page.getByRole('link', { name: OPEN_PR, exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('link', { name: OPEN_PR, exact: true })).toHaveCount(0);
});

test('REQ-6-2-2: Compare Branches Before Opening a Pull Request - Scenario 1', async ({ page }) => {
  await signInAsAlice(page);
  await openComparison(page);
  await expect(page.getByText('src/search.ts', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create pull request', exact: true })).toBeEnabled();
  await page.getByRole('combobox', { name: 'compare', exact: true }).selectOption({ label: 'main' });
  await expect(page.getByText('No changes', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create pull request', exact: true })).toBeDisabled();
});

test('REQ-6-2-2: Compare Branches Before Opening a Pull Request - Scenario 2', async ({ page }) => {
  await signInAsAlice(page);
  await openComparison(page);
  await page.getByRole('combobox', { name: 'compare', exact: true }).selectOption({ label: 'main' });
  await expect(page.getByText('No changes', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create pull request', exact: true })).toBeDisabled();
});

test('REQ-6-2-3: Create a Pull Request from Comparison Results - Scenario 1', async ({ page }) => {
  await signInAsAlice(page);
  await openComparison(page);
  await page.getByRole('button', { name: 'Create pull request', exact: true }).click();
  const title = 'pw-pr-' + u();
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Description', { exact: true }).fill('Created by Playwright');
  await page.getByRole('button', { name: 'Create pull request', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
});

test('REQ-6-2-3: Create a Pull Request from Comparison Results - Scenario 2', async ({ page }) => {
  await signInAsAlice(page);
  await openComparison(page);
  await page.getByRole('button', { name: 'Create pull request', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Create pull request', exact: true }).click();
  await expect(page.getByText('Title is required', { exact: true })).toBeVisible();
});

test('REQ-6-2-4: Create a Draft Pull Request - Scenario 1', async ({ page }) => {
  await signInAsAlice(page);
  await openComparison(page);
  await page.getByRole('button', { name: 'Create draft pull request', exact: true }).click();
  const title = 'pw-draft-' + u();
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByRole('button', { name: 'Create draft pull request', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText('Draft', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Merge pull request', exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.getByText('Draft', { exact: true })).toBeVisible();
});

test('REQ-6-2-4: Create a Draft Pull Request - Scenario 2', async ({ page }) => {
  await signInAsAlice(page);
  await openPR(page, 'Draft onboarding update');
  await expect(page.getByText('Draft', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ready for review', exact: true }).click();
  const confirm = page.getByRole('button', { name: 'Confirm', exact: true });
  if (await confirm.count()) {
    await confirm.click();
  }
  await expect(page.getByText('Draft', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Open', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Open', { exact: true })).toBeVisible();
  await expect(page.getByText('Draft', { exact: true })).toHaveCount(0);
});

test('REQ-6-3-1: View Pull Request Overview and Commits - Scenario 1', async ({ page }) => {
  await openPR(page, OPEN_PR);
  await page.getByRole('link', { name: 'Conversation', exact: true }).click();
  await expect(page.getByRole('heading', { name: OPEN_PR, exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Commits', exact: true }).click();
  await expect(page.getByRole('heading', { name: OPEN_PR, exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await expect(page.getByRole('heading', { name: OPEN_PR, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: OPEN_PR, exact: true })).toBeVisible();
});

test('REQ-6-3-1: View Pull Request Overview and Commits - Scenario 2', async ({ page }) => {
  await signInAsAlice(page);
  await openPR(page, OPEN_PR);
  await page.reload();
  await expect(page.getByRole('heading', { name: OPEN_PR, exact: true })).toBeVisible();
});

test('REQ-6-3-1: View Pull Request Overview and Commits - Scenario 3', async ({ page }) => {
  await signInAsAlice(page);
  await openPR(page, OPEN_PR);
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: OPEN_PR, exact: true })).toBeVisible();
});

test('REQ-6-3-2: Inspect Changed Files and Aggregate Diff - Scenario 1', async ({ page }) => {
  await openPR(page, OPEN_PR);
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await expect(page.getByText('src/search.ts', { exact: true })).toBeVisible();
  await expect(page.getByText(/\d+ additions?/)).toBeVisible();
  await expect(page.getByText(/\d+ deletions?/)).toBeVisible();
  await page.reload();
  await expect(page.getByText('src/search.ts', { exact: true })).toBeVisible();
});

test('REQ-6-3-3: Add Review Comments to Changed Code Lines - Scenario 1', async ({ page }) => {
  await signInAsAlice(page);
  await openPR(page, SECOND_PR);
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await page.getByRole('button', { name: 'Add comment', exact: true }).first().click();
  await page.getByLabel('Comment', { exact: true }).fill('Inline review comment');
  await page.getByRole('button', { name: 'Add single comment', exact: true }).click();
  await expect(page.getByText('Inline review comment', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Inline review comment', { exact: true })).toBeVisible();
});

test('REQ-6-3-3: Add Review Comments to Changed Code Lines - Scenario 2', async ({ page }) => {
  await signInAsAlice(page);
  await openPR(page, SECOND_PR);
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await page.getByRole('button', { name: 'Add comment', exact: true }).first().click();
  await page.getByLabel('Comment', { exact: true }).fill('Pending inline note');
  await page.getByRole('button', { name: 'Start a review', exact: true }).click();
  await expect(page.getByText('Pending inline note', { exact: true })).toBeVisible();
  await expect(page.getByText('Pending review', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Pending inline note', { exact: true })).toBeVisible();
});

test('REQ-6-3-4: Submit a Pull Request Review - Scenario 1', async ({ page }) => {
  await signInAsAlice(page);
  await openPR(page, SECOND_PR);
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await page.getByRole('button', { name: 'Review changes', exact: true }).click();
  await page.getByLabel('Summary', { exact: true }).fill('Approved by Playwright');
  await page.getByRole('radio', { name: 'Approve', exact: true }).check();
  await page.getByRole('button', { name: 'Submit review', exact: true }).click();
  await expect(page.getByText('Approved', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Approved', { exact: true })).toBeVisible();
});

test('REQ-6-3-4: Submit a Pull Request Review - Scenario 2', async ({ page }) => {
  await signInAsAlice(page);
  await openPR(page, OPEN_PR);
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await page.getByRole('button', { name: 'Review changes', exact: true }).click();
  await page.getByLabel('Summary', { exact: true }).fill('Please split this change');
  await page.getByRole('radio', { name: 'Request changes', exact: true }).check();
  await page.getByRole('button', { name: 'Submit review', exact: true }).click();
  await expect(page.getByText('Changes requested', { exact: true })).toBeVisible();
  await expect(page.getByText('Please split this change', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Changes requested', { exact: true })).toBeVisible();
});

test('REQ-6-4: Request or Remove Pull Request Reviewers - Scenario 1', async ({ page }) => {
  await signInAsAlice(page);
  await openPR(page, OPEN_PR);
  await page.getByRole('button', { name: 'Reviewers', exact: true }).click();
  await page.getByLabel('Search', { exact: true }).fill('bob-reviewer');
  await page.getByRole('option', { name: 'bob-reviewer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove bob-reviewer', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove bob-reviewer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove bob-reviewer', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Remove bob-reviewer', exact: true })).toHaveCount(0);
});

test('REQ-6-5: Merge an Eligible Pull Request - Scenario 1', async ({ page }) => {
  await signInAsAlice(page);
  await openPR(page, SECOND_PR);
  await expect(page.getByRole('button', { name: 'Merge pull request', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Merge pull request', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm merge', exact: true }).click();
  await expect(page.getByText('Merged', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Merged', { exact: true })).toBeVisible();
});

test('REQ-6-5: Merge an Eligible Pull Request - Scenario 2', async ({ page }) => {
  await signInAsAlice(page);
  await openPR(page, OPEN_PR);
  await expect(page.getByRole('button', { name: 'Merge pull request', exact: true })).toBeDisabled();
  await expect(page.getByText('Review required by branch protection', { exact: true })).toBeVisible();
});

test('REQ-6-6: Close or Reopen a Pull Request Without Merging - Scenario 1', async ({ page }) => {
  await signInAsAlice(page);
  await openPR(page, OPEN_PR);
  await page.getByRole('button', { name: 'Close pull request', exact: true }).click();
  await expect(page.getByText('Closed', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reopen pull request', exact: true }).click();
  await expect(page.getByText('Open', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Open', { exact: true })).toBeVisible();
});

test('REQ-6-6: Close or Reopen a Pull Request Without Merging - Scenario 2', async ({ page }) => {
  await registerAndSignIn(page);
  await openPR(page, OPEN_PR);
  await expect(page.getByRole('button', { name: 'Close pull request', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reopen pull request', exact: true })).toHaveCount(0);
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

