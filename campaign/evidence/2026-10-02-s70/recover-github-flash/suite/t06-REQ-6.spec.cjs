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

test.skip('REQ-6-1#2: REQ-6-1: Protect Branches with Review and Status-Check Requirements - Scenario 2', () => {
  // Skipped: the scenario needs a signed-in non-Admin repository collaborator, a seed account whose credentials the requirements do not give.
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

test.skip('REQ-6-3-3: REQ-6-3-3: Add Review Comments to Changed Code Lines - Scenario 1', () => {
  // Skipped: the scenario needs a signed-in non-author Write reviewer, a seed account whose credentials the requirements do not give.
});

test.skip('REQ-6-3-3#2: REQ-6-3-3: Add Review Comments to Changed Code Lines - Scenario 2', () => {
  // Skipped: the scenario needs a signed-in non-author Write reviewer, a seed account whose credentials the requirements do not give.
});

// REQ-6-3-4

test.skip('REQ-6-3-4: REQ-6-3-4: Submit a Pull Request Review - Scenario 1', () => {
  // Skipped: the scenario needs a signed-in non-author Write reviewer without an existing decision, a seed account whose credentials the requirements do not give.
});

test.skip('REQ-6-3-4#2: REQ-6-3-4: Submit a Pull Request Review - Scenario 2', () => {
  // Skipped: the scenario needs a signed-in non-author Write reviewer, a seed account whose credentials the requirements do not give.
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

test.skip('REQ-6-5: REQ-6-5: Merge an Eligible Pull Request - Scenario 1', () => {
  // Skipped: the eligible PR carrying a pre-existing non-author Approve is an unnamed seed record that cannot be located or rebuilt without the reviewer account's credentials.
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

test.skip('REQ-6-6#2: REQ-6-6: Close or Reopen a Pull Request Without Merging - Scenario 2', () => {
  // Skipped: the scenario needs a signed-in viewer who is neither the PR author nor a maintainer, a seed account whose credentials the requirements do not give.
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });