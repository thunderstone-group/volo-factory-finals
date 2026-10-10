// End-to-end acceptance tests for the GitHub collaboration platform - REQ-6
// (change review and merge control).  Only flows, pages, controls and values
// stated by the requirements document are used.
const { test, expect } = require('@playwright/test');

const SEED_PASSWORD = 'Valid-password-123!';
const SEED_USER = 'alice-dev';
const ORG = 'Acme Demo';
const REPO = 'acme-docs';
const PUBLIC_PR = 'Improve onboarding';
const SECOND_PR = 'Fix search';
const MAIN = 'main';
const FEATURE = 'feature-search';
const SECRET_REPO = 'secret-research';

const unique = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ------------------------------------------------------------------ helpers */

async function signIn(page, username = SEED_USER, password = SEED_PASSWORD) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
}

async function signOut(page) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm sign out', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
}

async function register(page, username, password) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(`${username}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByLabel('Username or email', { exact: true })).toBeVisible();
}

async function openRepository(page, repoName = REPO) {
  await page.goto('/');
  const search = page.getByRole('searchbox', { name: 'Search', exact: true });
  await search.fill(repoName);
  await search.press('Enter');
  await page.getByRole('link', { name: repoName, exact: true }).first().click();
}

async function openPullRequests(page, repoName = REPO) {
  await openRepository(page, repoName);
  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
}

async function openPullRequest(page, title, repoName = REPO) {
  await openPullRequests(page, repoName);
  await page.getByRole('link', { name: title, exact: true }).click();
}

async function openComparePage(page, repoName = REPO) {
  await openPullRequests(page, repoName);
  await page.getByRole('link', { name: 'New pull request', exact: true }).click();
}

async function selectBranches(page, base, compare) {
  await page.getByRole('combobox', { name: 'base', exact: true }).selectOption(base);
  await page.getByRole('combobox', { name: 'compare', exact: true }).selectOption(compare);
  await page.getByRole('button', { name: 'Compare changes', exact: true }).click();
}

async function switchBranch(page, from, to) {
  await page.getByRole('button', { name: `Branch ${from}`, exact: true }).click();
  await page.getByRole('textbox', { name: 'Find branch', exact: true }).fill(to);
  await page.getByRole('option', { name: to, exact: true }).click();
}

async function createBranch(page, from, name) {
  await page.getByRole('button', { name: `Branch ${from}`, exact: true }).click();
  await page.getByRole('textbox', { name: 'Find branch', exact: true }).fill(name);
  await page.getByRole('option', { name: `Create branch: ${name}`, exact: true }).click();
}

// registers a fresh account, makes it an organization member and grants it the
// Write repository role through the documented People / Manage-access flows.
async function provisionWriter(page) {
  const username = `pw-writer-${unique()}`;
  const password = 'Review-pass-123!';
  await register(page, username, password);
  await signIn(page);

  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Your organizations', exact: true }).click();
  await page.getByRole('link', { name: ORG, exact: true }).click();
  await page.getByRole('link', { name: 'People', exact: true }).click();
  await page.getByRole('button', { name: 'Add member', exact: true }).first().click();
  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await page.getByRole('button', { name: 'Add member', exact: true }).last().click();

  await openRepository(page);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Manage access', exact: true }).click();
  await page.getByRole('button', { name: 'Add people or teams', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search', exact: true }).fill(username);
  await page.getByRole('option', { name: username }).click();
  await page.getByRole('combobox', { name: 'Role', exact: true }).click();
  await page.getByRole('option', { name: 'Write', exact: true }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  await signOut(page);
  return { username, password };
}

// registers a fresh signed-in account with no repository / organization role.
async function provisionReader(page) {
  const username = `pw-reader-${unique()}`;
  const password = 'Review-pass-123!';
  await register(page, username, password);
  return { username, password };
}

async function submitReview(page, decision, summary) {
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await page.getByRole('button', { name: 'Review changes', exact: true }).click();
  if (summary) {
    await page.getByLabel('Summary', { exact: true }).fill(summary);
  }
  await page.getByRole('radio', { name: decision, exact: true }).check();
  await page.getByRole('button', { name: 'Submit review', exact: true }).click();
}

/* ------------------------------------------------------------------- tests */

test('REQ-6-1: REQ-6-1: Protect Branches with Review and Status-Check Requirements - Scenario 1', async ({ page }) => {
  await signIn(page);
  await openRepository(page);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Branches', exact: true }).click();

  await page.getByRole('button', { name: 'Add branch protection rule', exact: true }).click();
  await page.getByLabel('Branch name pattern', { exact: true }).fill(MAIN);
  await page.getByRole('checkbox', { name: 'Require 1 approval', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Require status check test', exact: true }).check();
  await page.getByRole('button', { name: 'Create', exact: true }).click();

  await expect(page.getByText(MAIN, { exact: true }).first()).toBeVisible();
  await expect(page.getByText('1 approval', { exact: true })).toBeVisible();
  await expect(page.getByText('Require status check test', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText('1 approval', { exact: true })).toBeVisible();
  await expect(page.getByText('Require status check test', { exact: true })).toBeVisible();

  // the Admin updates the required check on the Open PR targeting main
  await openPullRequest(page, PUBLIC_PR);
  await page.getByRole('combobox', { name: 'test status', exact: true }).click();
  await page.getByRole('option', { name: 'success', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('test: success', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText('test: success', { exact: true })).toBeVisible();
});

test('REQ-6-1#2: REQ-6-1: Protect Branches with Review and Status-Check Requirements - Scenario 2', async ({ page }) => {
  // a non-Admin collaborator: created here with the Write repository role
  const writer = await provisionWriter(page);
  await signIn(page, writer.username, writer.password);

  await openRepository(page);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Branches', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Add branch protection rule', exact: true })).toHaveCount(0);
});

test('REQ-6-1#3: REQ-6-1: Protect Branches with Review and Status-Check Requirements - Scenario 3', async ({ page }) => {
  await signIn(page);
  await openPullRequest(page, PUBLIC_PR);

  await expect(page.getByRole('combobox', { name: 'test status', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'test status', exact: true }).click();
  await page.getByRole('option', { name: 'success', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText('test: success', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('test: success', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: PUBLIC_PR, exact: true })).toBeVisible();
});

test('REQ-6-2-1: REQ-6-2-1: List and Filter Repository Pull Requests - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await openPullRequests(page);

  await page.getByRole('link', { name: 'Open', exact: true }).click();
  const openPr = page.getByRole('link', { name: PUBLIC_PR, exact: true });
  await expect(openPr).toBeVisible();

  await page.reload();
  await expect(page.getByRole('link', { name: PUBLIC_PR, exact: true })).toBeVisible();

  await page.getByRole('link', { name: PUBLIC_PR, exact: true }).click();
  await expect(page.getByRole('heading', { name: PUBLIC_PR, exact: true })).toBeVisible();

  await openPullRequests(page);
  await page.getByRole('link', { name: 'Closed', exact: true }).click();
  await expect(page.getByRole('link', { name: PUBLIC_PR, exact: true })).toHaveCount(0);
});

test('REQ-6-2-1#2: REQ-6-2-1: List and Filter Repository Pull Requests - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openPullRequests(page);

  await expect(page.getByRole('link', { name: 'Open', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: PUBLIC_PR, exact: true })).toBeVisible();

  await page.getByRole('link', { name: PUBLIC_PR, exact: true }).click();
  await expect(page.getByRole('heading', { name: PUBLIC_PR, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Conversation', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Commits', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Files changed', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: PUBLIC_PR, exact: true })).toBeVisible();
});

test('REQ-6-2-1#3: REQ-6-2-1: List and Filter Repository Pull Requests - Scenario 3', async ({ page }) => {
  await signIn(page);
  await openPullRequests(page);

  await page.getByRole('link', { name: 'Open', exact: true }).click();
  await expect(page.getByRole('link', { name: PUBLIC_PR, exact: true })).toBeVisible();
  await page.getByRole('link', { name: PUBLIC_PR, exact: true }).click();
  await expect(page.getByRole('heading', { name: PUBLIC_PR, exact: true })).toBeVisible();

  await openPullRequests(page);
  await expect(page.getByRole('link', { name: 'Closed', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Merged', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Draft', exact: true })).toBeVisible();
});

test('REQ-6-2-2: REQ-6-2-2: Compare Branches Before Opening a Pull Request - Scenario 1', async ({ page }) => {
  await signIn(page);
  await openComparePage(page);
  await selectBranches(page, MAIN, FEATURE);

  await expect(page.getByRole('combobox', { name: 'base', exact: true })).toHaveValue(MAIN);
  await expect(page.getByRole('combobox', { name: 'compare', exact: true })).toHaveValue(FEATURE);
  await expect(page.getByText('src/search.ts', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create pull request', exact: true })).toBeEnabled();

  await page.getByRole('combobox', { name: 'compare', exact: true }).selectOption(MAIN);
  await expect(page.getByText('No changes', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create pull request', exact: true })).toBeDisabled();
});

test('REQ-6-2-2#2: REQ-6-2-2: Compare Branches Before Opening a Pull Request - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openComparePage(page);
  await selectBranches(page, MAIN, MAIN);

  await expect(page.getByText('No changes', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create pull request', exact: true })).toBeDisabled();
});

test('REQ-6-2-3: REQ-6-2-3: Create a Pull Request from Comparison Results - Scenario 1', async ({ page }) => {
  const title = `pw-pr-${unique()}`;

  await signIn(page);
  await openComparePage(page);
  await selectBranches(page, MAIN, FEATURE);

  await page.getByRole('button', { name: 'Create pull request', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Create pull request', exact: true }).click();
  await expect(page.getByText('Title is required', { exact: true })).toBeVisible();

  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Description', { exact: true }).fill('Created by Playwright');
  await page.getByRole('button', { name: 'Create pull request', exact: true }).click();

  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();

  await openPullRequests(page);
  await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();
});

test('REQ-6-2-3#2: REQ-6-2-3: Create a Pull Request from Comparison Results - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openComparePage(page);

  await expect(page.getByRole('combobox', { name: 'base', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'compare', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Compare changes', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('combobox', { name: 'base', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Compare changes', exact: true })).toBeVisible();
});

test('REQ-6-2-4: REQ-6-2-4: Create a Draft Pull Request - Scenario 1', async ({ page }) => {
  const branch = `pw-draft-${unique()}`;
  const title = `Draft update ${branch}`;

  await signIn(page);
  await openRepository(page);
  await page.getByRole('link', { name: 'Code', exact: true }).click();
  await switchBranch(page, MAIN, FEATURE);
  await createBranch(page, FEATURE, branch);

  await openComparePage(page);
  await selectBranches(page, MAIN, branch);

  await page.getByRole('button', { name: 'Create draft pull request', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Description', { exact: true }).fill('Draft created by Playwright');
  await page.getByRole('button', { name: 'Create draft pull request', exact: true }).click();

  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Merge pull request', exact: true })).toBeDisabled();

  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible();
});

test('REQ-6-2-4#2: REQ-6-2-4: Create a Draft Pull Request - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openPullRequest(page, 'Draft onboarding update');

  await expect(page.getByRole('heading', { name: 'Draft onboarding update', exact: true })).toBeVisible();
  await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Ready for review', exact: true }).click();
  const confirm = page.getByRole('button', { name: 'Confirm', exact: true });
  if (await confirm.count()) {
    await confirm.click();
  }

  await expect(page.getByText('Draft', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Draft onboarding update', exact: true })).toBeVisible();
  await expect(page.getByText('Draft', { exact: true })).toHaveCount(0);
});

test('REQ-6-3-1: REQ-6-3-1: View Pull Request Overview and Commits - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await openPullRequest(page, PUBLIC_PR);

  await expect(page.getByRole('heading', { name: PUBLIC_PR, exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Conversation', exact: true }).click();
  await expect(page.getByRole('heading', { name: PUBLIC_PR, exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Commits', exact: true }).click();
  await expect(page.getByText('Commit summary', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await expect(page.getByText('src/search.ts', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: PUBLIC_PR, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Commits', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Files changed', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Conversation', exact: true })).toBeVisible();
});

test('REQ-6-3-1#2: REQ-6-3-1: View Pull Request Overview and Commits - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openPullRequest(page, PUBLIC_PR);

  await expect(page.getByRole('heading', { name: PUBLIC_PR, exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Commits', exact: true }).click();
  await expect(page.getByText('Commit summary', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: PUBLIC_PR, exact: true })).toBeVisible();
});

test('REQ-6-3-1#3: REQ-6-3-1: View Pull Request Overview and Commits - Scenario 3', async ({ page }) => {
  await signIn(page);
  await openPullRequest(page, PUBLIC_PR);

  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await expect(page.getByText('Changed files', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('src/search.ts', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Conversation', exact: true }).click();
  await expect(page.getByRole('heading', { name: PUBLIC_PR, exact: true })).toBeVisible();
});

test('REQ-6-3-2: REQ-6-3-2: Inspect Changed Files and Aggregate Diff - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await openPullRequest(page, PUBLIC_PR);

  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await expect(page.getByText('src/search.ts', { exact: true })).toBeVisible();
  await expect(page.getByText(/\d+ additions, \d+ deletions/)).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: PUBLIC_PR, exact: true })).toBeVisible();
  await expect(page.getByText('src/search.ts', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Conversation', exact: true }).click();
  await expect(page.getByRole('heading', { name: PUBLIC_PR, exact: true })).toBeVisible();
});

test('REQ-6-3-3: REQ-6-3-3: Add Review Comments to Changed Code Lines - Scenario 1', async ({ page }) => {
  // non-author collaborator with Write access, built through the documented flows
  const reviewer = await provisionWriter(page);
  const body = `Inline comment ${unique()}`;

  await signIn(page, reviewer.username, reviewer.password);
  await openPullRequest(page, PUBLIC_PR);
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();

  await page.getByRole('button', { name: 'Add comment', exact: true }).first().click();
  await page.getByLabel('Comment', { exact: true }).fill(body);
  await page.getByRole('button', { name: 'Add single comment', exact: true }).click();

  await expect(page.getByText(body, { exact: true })).toBeVisible();
  await expect(page.getByText(reviewer.username, { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText(body, { exact: true })).toBeVisible();
});

test('REQ-6-3-3#2: REQ-6-3-3: Add Review Comments to Changed Code Lines - Scenario 2', async ({ page }) => {
  const reviewer = await provisionWriter(page);
  const body = `Pending comment ${unique()}`;

  await signIn(page, reviewer.username, reviewer.password);
  await openPullRequest(page, PUBLIC_PR);
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();

  await page.getByRole('button', { name: 'Add comment', exact: true }).first().click();
  await page.getByLabel('Comment', { exact: true }).fill(body);
  await page.getByRole('button', { name: 'Start a review', exact: true }).click();

  await expect(page.getByText('Pending review', { exact: true })).toBeVisible();
  await expect(page.getByText(body, { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText('Pending review', { exact: true })).toBeVisible();
});

test('REQ-6-3-4: REQ-6-3-4: Submit a Pull Request Review - Scenario 1', async ({ page }) => {
  const reviewer = await provisionWriter(page);
  const summary = `Looks good ${unique()}`;

  await signIn(page, reviewer.username, reviewer.password);
  await openPullRequest(page, PUBLIC_PR);
  await submitReview(page, 'Approve', summary);

  await expect(page.getByText('Approved', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText('Approved', { exact: true })).toBeVisible();
});

test('REQ-6-3-4#2: REQ-6-3-4: Submit a Pull Request Review - Scenario 2', async ({ page }) => {
  const reviewer = await provisionWriter(page);
  const summary = `Please rework ${unique()}`;

  await signIn(page, reviewer.username, reviewer.password);
  await openPullRequest(page, PUBLIC_PR);
  await submitReview(page, 'Request changes', summary);

  await expect(page.getByText('Changes requested', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText('Changes requested', { exact: true })).toBeVisible();
  await expect(page.getByText(summary, { exact: true })).toBeVisible();
});

test('REQ-6-4: REQ-6-4: Request or Remove Pull Request Reviewers - Scenario 1', async ({ page }) => {
  await signIn(page);
  await openPullRequest(page, PUBLIC_PR);

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

test('REQ-6-5: REQ-6-5: Merge an Eligible Pull Request - Scenario 1', async ({ page }) => {
  const reviewer = await provisionWriter(page);
  const branch = `pw-merge-${unique()}`;
  const title = `Merge candidate ${branch}`;

  // the repository admin creates a fresh Open PR targeting main
  await signIn(page);
  await openRepository(page);
  await page.getByRole('link', { name: 'Code', exact: true }).click();
  await switchBranch(page, MAIN, FEATURE);
  await createBranch(page, FEATURE, branch);

  await openComparePage(page);
  await selectBranches(page, MAIN, branch);
  await page.getByRole('button', { name: 'Create pull request', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByRole('button', { name: 'Create pull request', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await signOut(page);

  // a non-author collaborator approves the current compare commit
  await signIn(page, reviewer.username, reviewer.password);
  await openPullRequest(page, title);
  await submitReview(page, 'Approve', `Approved ${unique()}`);
  await expect(page.getByText('Approved', { exact: true })).toBeVisible();
  await signOut(page);

  // the admin satisfies the required check and merges
  await signIn(page);
  await openPullRequest(page, title);
  await page.getByRole('combobox', { name: 'test status', exact: true }).click();
  await page.getByRole('option', { name: 'success', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('test: success', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Merge pull request', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm merge', exact: true }).click();
  await expect(page.getByText('Merged', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('Merged', { exact: true }).first()).toBeVisible();
});

test('REQ-6-5#2: REQ-6-5: Merge an Eligible Pull Request - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openPullRequest(page, PUBLIC_PR);

  await expect(page.getByRole('heading', { name: PUBLIC_PR, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Merge pull request', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Merge pull request', exact: true })).toBeDisabled();

  await page.reload();
  await expect(page.getByRole('heading', { name: PUBLIC_PR, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Merge pull request', exact: true })).toBeDisabled();
});

test('REQ-6-6: REQ-6-6: Close or Reopen a Pull Request Without Merging - Scenario 1', async ({ page }) => {
  await signIn(page);
  await openPullRequest(page, PUBLIC_PR);

  await expect(page.getByRole('heading', { name: PUBLIC_PR, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close pull request', exact: true }).click();
  await expect(page.getByText('Closed', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Reopen pull request', exact: true }).click();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: PUBLIC_PR, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close pull request', exact: true })).toBeVisible();
});

test('REQ-6-6#2: REQ-6-6: Close or Reopen a Pull Request Without Merging - Scenario 2', async ({ page }) => {
  // a signed-in viewer who is neither the author nor a maintainer (no repository role)
  const viewer = await provisionReader(page);
  await signIn(page, viewer.username, viewer.password);

  await openPullRequest(page, PUBLIC_PR);
  await expect(page.getByRole('heading', { name: PUBLIC_PR, exact: true })).toBeVisible();

  await expect(page.getByRole('button', { name: 'Close pull request', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reopen pull request', exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Close pull request', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reopen pull request', exact: true })).toHaveCount(0);
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

