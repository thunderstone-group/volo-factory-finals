const { test, expect } = require('@playwright/test');

const PASSWORD = 'Valid-password-123!';
const uniq = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function signIn(page, username = 'alice-dev') {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function openRepo(page, name) {
  await page.goto('/');
  const box = page.getByRole('searchbox', { name: 'Search', exact: true });
  await box.fill(name);
  await box.press('Enter');
  await page.getByRole('link', { name, exact: true }).click();
}

async function openPullRequests(page, repo = 'acme-docs') {
  await openRepo(page, repo);
  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
}

async function openOpenPr(page, title) {
  await openPullRequests(page);
  await page.getByRole('link', { name: 'Open', exact: true }).click();
  await page.getByRole('link', { name: title, exact: true }).click();
}

test('REQ-6-1: REQ-6-1: Protect Branches with Review and Status-Check Requirements - Scenario 1', async ({ page }) => {
  await signIn(page);
  await openRepo(page, 'acme-docs');
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Branches', exact: true }).click();
  await page.getByRole('button', { name: 'Add branch protection rule', exact: true }).click();
  await page.getByLabel('Branch name pattern', { exact: true }).fill('main');
  await page.getByRole('checkbox', { name: 'Require 1 approval', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Require status check test', exact: true }).check();
  await page.getByRole('button', { name: 'Create', exact: true }).click();

  await expect(page.getByText('main', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('1 approval', { exact: true })).toBeVisible();
  await expect(page.getByText('Require status check test', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('1 approval', { exact: true })).toBeVisible();

  await openOpenPr(page, 'Improve onboarding');
  await page.getByRole('link', { name: 'Checks', exact: true }).click();
  await page.getByRole('combobox', { name: 'test status', exact: true }).click();
  await page.getByRole('option', { name: 'success', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('test: success', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText('test: success', { exact: true })).toBeVisible();
});

// Requires a seeded non-Admin collaborator account whose credentials the requirements do not give.
test.skip('REQ-6-1#2: REQ-6-1: Protect Branches with Review and Status-Check Requirements - Scenario 2', () => {});

test('REQ-6-1#3: REQ-6-1: Protect Branches with Review and Status-Check Requirements - Scenario 3', async ({ page }) => {
  await signIn(page);
  await openOpenPr(page, 'Improve onboarding');
  await page.getByRole('link', { name: 'Checks', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'test status', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'test status', exact: true }).click();
  await page.getByRole('option', { name: 'success', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('test: success', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText('test: success', { exact: true })).toBeVisible();
});

test('REQ-6-2-1: REQ-6-2-1: List and Filter Repository Pull Requests - Scenario 1', async ({ page }) => {
  await openPullRequests(page);
  await page.getByRole('link', { name: 'Open', exact: true }).click();
  const openPr = page.getByRole('link', { name: 'Improve onboarding', exact: true });
  await expect(openPr).toBeVisible();

  await page.reload();
  await expect(openPr).toBeVisible();

  await openPr.click();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();

  await openPullRequests(page);
  await page.getByRole('link', { name: 'Closed', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Improve onboarding', exact: true })).toHaveCount(0);
});

test('REQ-6-2-1#2: REQ-6-2-1: List and Filter Repository Pull Requests - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openPullRequests(page);
  await page.getByRole('link', { name: 'Open', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Improve onboarding', exact: true })).toBeVisible();
});

test('REQ-6-2-1#3: REQ-6-2-1: List and Filter Repository Pull Requests - Scenario 3', async ({ page }) => {
  await signIn(page);
  await openPullRequests(page);
  await page.getByRole('link', { name: 'Open', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Improve onboarding', exact: true })).toBeVisible();
});

test('REQ-6-2-2: REQ-6-2-2: Compare Branches Before Opening a Pull Request - Scenario 1', async ({ page }) => {
  await signIn(page);
  await openPullRequests(page);
  await page.getByRole('link', { name: 'New pull request', exact: true }).click();

  const base = page.getByRole('combobox', { name: 'base', exact: true });
  const compare = page.getByRole('combobox', { name: 'compare', exact: true });
  await base.selectOption('main');
  await compare.selectOption('feature-search');
  await page.getByRole('button', { name: 'Compare changes', exact: true }).click();

  await expect(page.getByText('src/search.ts', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create pull request', exact: true })).toBeEnabled();

  await compare.selectOption('main');
  await expect(page.getByText('No changes', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create pull request', exact: true })).toBeDisabled();
});

test('REQ-6-2-2#2: REQ-6-2-2: Compare Branches Before Opening a Pull Request - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openPullRequests(page);
  await page.getByRole('link', { name: 'New pull request', exact: true }).click();

  await page.getByRole('combobox', { name: 'base', exact: true }).selectOption('main');
  await page.getByRole('combobox', { name: 'compare', exact: true }).selectOption('main');
  await page.getByRole('button', { name: 'Compare changes', exact: true }).click();

  await expect(page.getByText('No changes', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create pull request', exact: true })).toBeDisabled();
});

test('REQ-6-2-3: REQ-6-2-3: Create a Pull Request from Comparison Results - Scenario 1', async ({ page }) => {
  const title = 'PW pull request ' + uniq();
  await signIn(page);
  await openPullRequests(page);
  await page.getByRole('link', { name: 'New pull request', exact: true }).click();
  await page.getByRole('combobox', { name: 'base', exact: true }).selectOption('main');
  await page.getByRole('combobox', { name: 'compare', exact: true }).selectOption('feature-search');
  await page.getByRole('button', { name: 'Compare changes', exact: true }).click();
  await expect(page.getByText('src/search.ts', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Create pull request', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Description', { exact: true }).fill('Created by Playwright');
  await page.getByRole('button', { name: 'Create pull request', exact: true }).click();

  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();

  await openPullRequests(page);
  await page.getByRole('link', { name: 'Open', exact: true }).click();
  await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();
});

test('REQ-6-2-3#2: REQ-6-2-3: Create a Pull Request from Comparison Results - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openPullRequests(page);
  await page.getByRole('link', { name: 'New pull request', exact: true }).click();
  await page.getByRole('combobox', { name: 'base', exact: true }).selectOption('main');
  await page.getByRole('combobox', { name: 'compare', exact: true }).selectOption('feature-search');
  await page.getByRole('button', { name: 'Compare changes', exact: true }).click();
  await expect(page.getByText('src/search.ts', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create pull request', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Create pull request', exact: true })).toBeVisible();
});

test('REQ-6-2-4: REQ-6-2-4: Create a Draft Pull Request - Scenario 1', async ({ page }) => {
  const branch = 'pw-branch-' + uniq();
  const title = 'PW draft ' + uniq();
  await signIn(page);
  await openRepo(page, 'acme-docs');

  await page.getByRole('button', { name: 'Branch main', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find branch', exact: true }).fill('feature-search');
  await page.getByRole('option', { name: 'feature-search', exact: true }).click();

  await page.getByRole('button', { name: 'Branch feature-search', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find branch', exact: true }).fill(branch);
  await page.getByRole('option', { name: 'Create branch: ' + branch, exact: true }).click();

  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await page.getByRole('link', { name: 'New pull request', exact: true }).click();
  await page.getByRole('combobox', { name: 'base', exact: true }).selectOption('main');
  await page.getByRole('combobox', { name: 'compare', exact: true }).selectOption(branch);
  await page.getByRole('button', { name: 'Compare changes', exact: true }).click();

  await page.getByRole('button', { name: 'Create draft pull request', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByRole('button', { name: 'Create draft pull request', exact: true }).click();

  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Merge pull request', exact: true })).toBeDisabled();

  await page.reload();
  await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible();
});

test('REQ-6-2-4#2: REQ-6-2-4: Create a Draft Pull Request - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openPullRequests(page);
  await page.getByRole('link', { name: 'Draft onboarding update', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Draft onboarding update', exact: true })).toBeVisible();
  await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Ready for review', exact: true }).click();
  const confirm = page.getByRole('button', { name: 'Confirm', exact: true });
  if (await confirm.count()) {
    await confirm.click();
  }

  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Draft onboarding update', exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
});

test('REQ-6-3-1: REQ-6-3-1: View Pull Request Overview and Commits - Scenario 1', async ({ page }) => {
  await openOpenPr(page, 'Improve onboarding');
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Conversation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Commits', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await expect(page.getByText('src/search.ts', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
});

test('REQ-6-3-1#2: REQ-6-3-1: View Pull Request Overview and Commits - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openOpenPr(page, 'Improve onboarding');
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Conversation', exact: true }).click();
  await page.getByRole('link', { name: 'Commits', exact: true }).click();
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
});

test('REQ-6-3-1#3: REQ-6-3-1: View Pull Request Overview and Commits - Scenario 3', async ({ page }) => {
  await signIn(page);
  await openOpenPr(page, 'Improve onboarding');
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Conversation', exact: true }).click();
  await page.getByRole('link', { name: 'Commits', exact: true }).click();
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
});

test('REQ-6-3-2: REQ-6-3-2: Inspect Changed Files and Aggregate Diff - Scenario 1', async ({ page }) => {
  await openOpenPr(page, 'Improve onboarding');
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await expect(page.getByText('src/search.ts', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Conversation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
});

// Requires a non-author reviewer account (bob-reviewer) whose credentials the requirements do not give.
test.skip('REQ-6-3-3: REQ-6-3-3: Add Review Comments to Changed Code Lines - Scenario 1', () => {});

// Requires a non-author reviewer account (bob-reviewer) whose credentials the requirements do not give.
test.skip('REQ-6-3-3#2: REQ-6-3-3: Add Review Comments to Changed Code Lines - Scenario 2', () => {});

// Requires a non-author reviewer account (bob-reviewer) whose credentials the requirements do not give.
test.skip('REQ-6-3-4: REQ-6-3-4: Submit a Pull Request Review - Scenario 1', () => {});

// Requires a non-author reviewer account (bob-reviewer) whose credentials the requirements do not give.
test.skip('REQ-6-3-4#2: REQ-6-3-4: Submit a Pull Request Review - Scenario 2', () => {});

test('REQ-6-4: REQ-6-4: Request or Remove Pull Request Reviewers - Scenario 1', async ({ page }) => {
  await signIn(page);
  await openOpenPr(page, 'Improve onboarding');

  await page.getByRole('button', { name: 'Reviewers', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search', exact: true }).fill('bob-reviewer');
  await page.getByRole('option', { name: 'bob-reviewer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove bob-reviewer', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Remove bob-reviewer', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Remove bob-reviewer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove bob-reviewer', exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Remove bob-reviewer', exact: true })).toHaveCount(0);
});

// Requires an eligible PR with a non-author Approve from a reviewer account whose credentials the requirements do not give.
test.skip('REQ-6-5: REQ-6-5: Merge an Eligible Pull Request - Scenario 1', () => {});

test('REQ-6-5#2: REQ-6-5: Merge an Eligible Pull Request - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openOpenPr(page, 'Improve onboarding');
  await expect(page.getByRole('button', { name: 'Merge pull request', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Merge pull request', exact: true })).toBeVisible();
});

test('REQ-6-6: REQ-6-6: Close or Reopen a Pull Request Without Merging - Scenario 1', async ({ page }) => {
  await signIn(page);
  await openOpenPr(page, 'Improve onboarding');
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Close pull request', exact: true }).click();
  await expect(page.getByText('Closed', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Reopen pull request', exact: true }).click();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Close pull request', exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
});

// Requires a signed-in Read viewer account whose credentials the requirements do not give.
test.skip('REQ-6-6#2: REQ-6-6: Close or Reopen a Pull Request Without Merging - Scenario 2', () => {});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

