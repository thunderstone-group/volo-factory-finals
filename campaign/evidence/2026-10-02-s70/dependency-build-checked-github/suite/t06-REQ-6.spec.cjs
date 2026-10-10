const { test, expect } = require('@playwright/test');

const EMAIL = 'alice.dev@example.test';
const PASSWORD = 'Valid-password-123!';
const uniq = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ---------------------------------------------------------------- helpers

async function signIn(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
}

async function openRepo(page, name) {
  await page.goto('/');
  await page.getByRole('searchbox', { name: 'Search', exact: true }).fill(name);
  await page.keyboard.press('Enter');
  await page.getByRole('link', { name: name, exact: true }).click();
  await expect(page.getByRole('heading', { name: name })).toBeVisible();
}

async function openPullRequests(page, repoName) {
  await openRepo(page, repoName);
  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
}

async function newRepository(page, name) {
  await page.goto('/');
  await page.getByRole('link', { name: 'New repository', exact: true }).click();
  await page.getByLabel('Repository name', { exact: true }).fill(name);
  await page.getByRole('radio', { name: 'Private', exact: true }).check();
  await page.getByLabel('Add a README file', { exact: true }).check();
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();
  await expect(page.getByRole('heading', { name: name })).toBeVisible();
}

async function createBranch(page, from, name) {
  await page.getByRole('button', { name: `Branch ${from}`, exact: true }).click();
  await page.getByRole('textbox', { name: 'Find branch', exact: true }).fill(name);
  await page.getByRole('option', { name: `Create branch: ${name}`, exact: true }).click();
  await expect(page.getByRole('button', { name: `Branch ${name}`, exact: true })).toBeVisible();
}

async function createFile(page, path, content, message) {
  await page.getByRole('button', { name: 'Add file', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Create new file', exact: true }).click();
  await page.getByLabel('File name', { exact: true }).fill(path);
  await page.getByRole('textbox', { name: 'File contents', exact: true }).fill(content);
  await page.getByLabel('Commit message', { exact: true }).fill(message);
  await page.getByRole('button', { name: 'Commit changes', exact: true }).click();
}

// from the Pull requests list page
async function compareBranches(page, base, compare) {
  await page.getByRole('link', { name: 'New pull request', exact: true }).click();
  await page.getByRole('combobox', { name: 'base', exact: true }).selectOption(base);
  await page.getByRole('combobox', { name: 'compare', exact: true }).selectOption(compare);
  await page.getByRole('button', { name: 'Compare changes', exact: true }).click();
}

async function createPullRequest(page, { base, compare, title }) {
  await compareBranches(page, base, compare);
  await page.getByRole('button', { name: 'Create pull request', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByRole('button', { name: 'Create pull request', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}

async function addBranchProtectionRule(page, pattern, { approval = false, statusCheck = false } = {}) {
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Branches', exact: true }).click();
  await page.getByRole('button', { name: 'Add branch protection rule', exact: true }).click();
  await page.getByLabel('Branch name pattern', { exact: true }).fill(pattern);
  if (approval) await page.getByRole('checkbox', { name: 'Require 1 approval', exact: true }).check();
  if (statusCheck) await page.getByRole('checkbox', { name: 'Require status check test', exact: true }).check();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
}

// ---------------------------------------------------------------- REQ-6-1

test('REQ-6-1: REQ-6-1: Protect Branches with Review and Status-Check Requirements - Scenario 1', async ({ page }) => {
  const id = uniq();
  const repo = `pw-protect-${id}`;
  const branch = `pw-feature-${id}`;
  const title = `pw-pr-${id}`;

  await signIn(page);
  await newRepository(page, repo);
  await createBranch(page, 'main', branch);
  await createFile(page, 'src/search.ts', 'export const search = "flow";', `Add src/search.ts on ${branch}`);
  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await createPullRequest(page, { base: 'main', compare: branch, title });

  await addBranchProtectionRule(page, 'main', { approval: true, statusCheck: true });
  await expect(page.getByText('main', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('1 approval', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Require status check test', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('1 approval', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Require status check test', { exact: true }).first()).toBeVisible();

  await openPullRequests(page, repo);
  await page.getByRole('link', { name: title, exact: true }).click();
  await page.getByRole('link', { name: 'Checks', exact: true }).click();
  await expect(page.getByText('test: pending', { exact: true }).first()).toBeVisible();
  await page.getByRole('combobox', { name: 'test status', exact: true }).click();
  await page.getByRole('option', { name: 'success', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('test: success', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('test: success', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Merge pull request', exact: true })).toBeDisabled();
});

// SKIP: the GIVEN needs a signed-in non-Admin collaborator on the repository, but the requirements give no credentials for such an account and no flow that grants repository access without an Admin/Owner session.
test.skip('REQ-6-1#2: REQ-6-1: Protect Branches with Review and Status-Check Requirements - Scenario 2', () => {});

test('REQ-6-1#3: REQ-6-1: Protect Branches with Review and Status-Check Requirements - Scenario 3', async ({ page }) => {
  const id = uniq();
  const repo = `pw-checks-${id}`;
  const branch = `pw-feature-${id}`;
  const title = `pw-pr-${id}`;

  await signIn(page);
  await newRepository(page, repo);
  await createBranch(page, 'main', branch);
  await createFile(page, 'src/search.ts', 'export const search = "flow";', `Add src/search.ts on ${branch}`);
  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await createPullRequest(page, { base: 'main', compare: branch, title });

  // the Open PR must target a protected branch
  await addBranchProtectionRule(page, 'main', { statusCheck: true });
  await expect(page.getByText('Require status check test', { exact: true }).first()).toBeVisible();

  await openPullRequests(page, repo);
  await page.getByRole('link', { name: title, exact: true }).click();
  await page.getByRole('link', { name: 'Checks', exact: true }).click();
  await expect(page.getByText('test: pending', { exact: true }).first()).toBeVisible();
  await page.getByRole('combobox', { name: 'test status', exact: true }).click();
  await page.getByRole('option', { name: 'success', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('test: success', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('test: success', { exact: true }).first()).toBeVisible();
});

// ---------------------------------------------------------------- REQ-6-2-1

test('REQ-6-2-1: REQ-6-2-1: List and Filter Repository Pull Requests - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await openPullRequests(page, 'acme-docs');

  await page.getByRole('link', { name: 'Open', exact: true }).first().click();
  await expect(page.getByRole('link', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Improve onboarding', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();

  await page.goBack();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Improve onboarding', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Closed', exact: true }).first().click();
  await expect(page.getByRole('link', { name: 'Improve onboarding', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Fix search', exact: true })).toBeVisible();
});

test('REQ-6-2-1#2: REQ-6-2-1: List and Filter Repository Pull Requests - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openPullRequests(page, 'acme-docs');
  await expect(page.getByRole('link', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open', exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Improve onboarding', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
});

test('REQ-6-2-1#3: REQ-6-2-1: List and Filter Repository Pull Requests - Scenario 3', async ({ page }) => {
  await signIn(page);
  await openPullRequests(page, 'acme-docs');
  await expect(page.getByRole('link', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Closed', exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Improve onboarding', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
});

// ---------------------------------------------------------------- REQ-6-2-2

test('REQ-6-2-2: REQ-6-2-2: Compare Branches Before Opening a Pull Request - Scenario 1', async ({ page }) => {
  const id = uniq();
  const repo = `pw-compare-${id}`;

  await signIn(page);
  await newRepository(page, repo);
  await createBranch(page, 'main', 'feature-search');
  await createFile(page, 'src/search.ts', 'export const search = "flow";', 'Add src/search.ts');

  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await compareBranches(page, 'main', 'feature-search');
  await expect(page.getByText('src/search.ts', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create pull request', exact: true })).toBeEnabled();

  await page.getByRole('combobox', { name: 'compare', exact: true }).selectOption('main');
  await expect(page.getByText('No changes', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create pull request', exact: true })).toBeDisabled();
});

test('REQ-6-2-2#2: REQ-6-2-2: Compare Branches Before Opening a Pull Request - Scenario 2', async ({ page }) => {
  const id = uniq();
  const repo = `pw-compare2-${id}`;

  await signIn(page);
  await newRepository(page, repo);
  await createBranch(page, 'main', 'feature-search');
  await createFile(page, 'src/search.ts', 'export const search = "flow";', 'Add src/search.ts');

  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await page.getByRole('link', { name: 'New pull request', exact: true }).click();
  await page.getByRole('combobox', { name: 'base', exact: true }).selectOption('main');
  await page.getByRole('combobox', { name: 'compare', exact: true }).selectOption('main');
  await page.getByRole('button', { name: 'Compare changes', exact: true }).click();
  await expect(page.getByText('No changes', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create pull request', exact: true })).toBeDisabled();
});

// ---------------------------------------------------------------- REQ-6-2-3

test('REQ-6-2-3: REQ-6-2-3: Create a Pull Request from Comparison Results - Scenario 1', async ({ page }) => {
  const id = uniq();
  const repo = `pw-createpr-${id}`;
  const title = `pw-pr-${id}`;

  await signIn(page);
  await newRepository(page, repo);
  await createBranch(page, 'main', 'feature-search');
  await createFile(page, 'src/search.ts', 'export const search = "flow";', 'Add src/search.ts');

  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await compareBranches(page, 'main', 'feature-search');
  await page.getByRole('button', { name: 'Create pull request', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Description', { exact: true }).fill('Pull request created by Playwright');
  await page.getByRole('button', { name: 'Create pull request', exact: true }).click();

  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('alice-dev', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();
});

test('REQ-6-2-3#2: REQ-6-2-3: Create a Pull Request from Comparison Results - Scenario 2', async ({ page }) => {
  const id = uniq();
  const repo = `pw-createpr2-${id}`;
  const title = `pw-pr-${id}`;

  await signIn(page);
  await newRepository(page, repo);
  await createBranch(page, 'main', 'feature-search');
  await createFile(page, 'src/search.ts', 'export const search = "flow";', 'Add src/search.ts');

  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await createPullRequest(page, { base: 'main', compare: 'feature-search', title });
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();
});

// ---------------------------------------------------------------- REQ-6-2-4

test('REQ-6-2-4: REQ-6-2-4: Create a Draft Pull Request - Scenario 1', async ({ page }) => {
  const id = uniq();
  const repo = `pw-draft-${id}`;
  const title = `pw-draft-pr-${id}`;

  await signIn(page);
  await newRepository(page, repo);
  await createBranch(page, 'main', 'feature-search');
  await createFile(page, 'src/search.ts', 'export const search = "flow";', 'Add src/search.ts');

  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await compareBranches(page, 'main', 'feature-search');
  await page.getByRole('button', { name: 'Create draft pull request', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByRole('button', { name: 'Create draft pull request', exact: true }).click();

  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('feature-search', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Merge pull request', exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible();
});

test('REQ-6-2-4#2: REQ-6-2-4: Create a Draft Pull Request - Scenario 2', async ({ page }) => {
  const id = uniq();
  const repo = `pw-ready-${id}`;

  await signIn(page);
  await newRepository(page, repo);
  await createBranch(page, 'main', 'draft-feature');
  await createFile(page, 'src/search.ts', 'export const search = "flow";', 'Add src/search.ts');

  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await compareBranches(page, 'main', 'draft-feature');
  await page.getByRole('button', { name: 'Create draft pull request', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Draft onboarding update');
  await page.getByRole('button', { name: 'Create draft pull request', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Draft onboarding update', exact: true })).toBeVisible();
  await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('draft-feature', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('main', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ready for review', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Ready for review', exact: true }).click();
  try {
    await page.getByRole('button', { name: 'Confirm', exact: true }).click({ timeout: 2000 });
  } catch (e) {
    // no confirmation dialog is used for this transition
  }

  await expect(page.getByText('Draft', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Draft onboarding update', exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Draft', { exact: true })).toHaveCount(0);
});

// ---------------------------------------------------------------- REQ-6-3-1

test('REQ-6-3-1: REQ-6-3-1: View Pull Request Overview and Commits - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await openPullRequests(page, 'acme-docs');
  await page.getByRole('link', { name: 'Improve onboarding', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Commits', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await expect(page.getByText('src/search.ts', { exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Conversation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Commits', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Files changed', exact: true })).toBeVisible();
});

test('REQ-6-3-1#2: REQ-6-3-1: View Pull Request Overview and Commits - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openPullRequests(page, 'acme-docs');
  await page.getByRole('link', { name: 'Improve onboarding', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Commits', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await expect(page.getByText('src/search.ts', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('src/search.ts', { exact: true }).first()).toBeVisible();
});

test('REQ-6-3-1#3: REQ-6-3-1: View Pull Request Overview and Commits - Scenario 3', async ({ page }) => {
  await signIn(page);
  await openPullRequests(page, 'acme-docs');
  await page.getByRole('link', { name: 'Improve onboarding', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Conversation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Commits', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
});

// ---------------------------------------------------------------- REQ-6-3-2

test('REQ-6-3-2: REQ-6-3-2: Inspect Changed Files and Aggregate Diff - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await openPullRequests(page, 'acme-docs');
  await page.getByRole('link', { name: 'Improve onboarding', exact: true }).click();
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();

  await expect(page.getByText('src/search.ts', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/\d+ additions, \d+ deletions/).first()).toBeVisible();

  await page.getByRole('link', { name: 'Conversation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await expect(page.getByText('src/search.ts', { exact: true }).first()).toBeVisible();
});

// ---------------------------------------------------------------- REQ-6-3-3

// SKIP: the GIVEN requires a signed-in reviewer who is not the PR author and has Write permission; no credentials for such an account are given and a second account cannot be given repository access in this session.
test.skip('REQ-6-3-3: REQ-6-3-3: Add Review Comments to Changed Code Lines - Scenario 1', () => {});

// SKIP: the GIVEN requires a signed-in reviewer who is not the PR author and has Write permission; no credentials for such an account are given and a second account cannot be given repository access in this session.
test.skip('REQ-6-3-3#2: REQ-6-3-3: Add Review Comments to Changed Code Lines - Scenario 2', () => {});

// ---------------------------------------------------------------- REQ-6-3-4

// SKIP: the GIVEN requires a signed-in reviewer who is not the PR author and has Write permission; no credentials for such an account are given and a second account cannot be given repository access in this session.
test.skip('REQ-6-3-4: REQ-6-3-4: Submit a Pull Request Review - Scenario 1', () => {});

// SKIP: the GIVEN requires a signed-in reviewer who is not the PR author and has Write permission; no credentials for such an account are given and a second account cannot be given repository access in this session.
test.skip('REQ-6-3-4#2: REQ-6-3-4: Submit a Pull Request Review - Scenario 2', () => {});

// ---------------------------------------------------------------- REQ-6-4

// SKIP: the GIVEN requires an eligible reviewer account (non-author with Write or higher) in the repository; the requirements give no credentials for `bob-reviewer` and no flow grants a second account repository access in this session.
test.skip('REQ-6-4: REQ-6-4: Request or Remove Pull Request Reviewers - Scenario 1', () => {});

// ---------------------------------------------------------------- REQ-6-5

// SKIP: merge eligibility requires 1 valid non-author Approve on the current compare commit, which needs a signed-in reviewer account whose credentials the requirements do not give.
test.skip('REQ-6-5: REQ-6-5: Merge an Eligible Pull Request - Scenario 1', () => {});

// SKIP: merge eligibility requires 1 valid non-author Approve on the current compare commit, which needs a signed-in reviewer account whose credentials the requirements do not give.
test.skip('REQ-6-5#2: REQ-6-5: Merge an Eligible Pull Request - Scenario 2', () => {});

// ---------------------------------------------------------------- REQ-6-6

test('REQ-6-6: REQ-6-6: Close or Reopen a Pull Request Without Merging - Scenario 1', async ({ page }) => {
  const id = uniq();
  const repo = `pw-close-${id}`;
  const branch = `pw-feature-${id}`;
  const title = `pw-pr-${id}`;

  await signIn(page);
  await newRepository(page, repo);
  await createBranch(page, 'main', branch);
  await createFile(page, 'src/search.ts', 'export const search = "flow";', `Add src/search.ts on ${branch}`);
  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await createPullRequest(page, { base: 'main', compare: branch, title });

  await page.getByRole('button', { name: 'Close pull request', exact: true }).click();
  await expect(page.getByText('Closed', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Reopen pull request', exact: true }).click();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close pull request', exact: true })).toBeVisible();
});

// SKIP: the GIVEN needs a signed-in viewer who is neither the PR author nor a maintainer; no credentials for such an account are given and no flow grants a second account read access in this session.
test.skip('REQ-6-6#2: REQ-6-6: Close or Reopen a Pull Request Without Merging - Scenario 2', () => {});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

