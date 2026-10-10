const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// Seed data stated by the requirements
// ---------------------------------------------------------------------------
const ORG = 'Acme Demo';
const REPO = 'acme-docs';
const ALICE = 'alice-dev';
const ALICE_EMAIL = 'alice.dev@example.test';
const BOB = 'bob-reviewer';
const PASSWORD = 'Valid-password-123!';
const SEEDED_PR_A = 'Improve onboarding';
const SEEDED_PR_B = 'Fix search';
const SEEDED_PRS = new RegExp(`^(${SEEDED_PR_A}|${SEEDED_PR_B})$`);

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ---------------------------------------------------------------------------
// Small helpers (only flows the requirements describe)
// ---------------------------------------------------------------------------
async function signIn(page, username, password = PASSWORD) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function signOut(page) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm sign out', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
}

async function registerAccount(page, username, email) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password', { exact: true }).fill(PASSWORD);
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  // registration enters the sign-in page
  await expect(page.getByLabel('Username or email', { exact: true })).toBeVisible();
}

async function openRepository(page, repo = REPO) {
  await page.goto('/');
  const search = page.getByRole('searchbox', { name: 'Search', exact: true });
  await search.fill(repo);
  await search.press('Enter');
  await page.getByRole('link', { name: repo, exact: true }).first().click();
  await expect(page.getByRole('heading', { name: new RegExp(repo) }).first()).toBeVisible();
}

async function openPullRequests(page, repo = REPO) {
  await openRepository(page, repo);
  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
}

// opens the seeded, visitor-readable Open pull request of the public repository
// and returns its exact persisted title.
async function openSeededOpenPr(page) {
  await openPullRequests(page);
  await page.getByRole('link', { name: 'Open', exact: true }).first().click();
  const link = page.getByRole('link', { name: SEEDED_PRS });
  await expect(link).toHaveCount(1);
  await link.click();
  const heading = page.getByRole('heading', { name: SEEDED_PRS }).first();
  await expect(heading).toBeVisible();
  return (await heading.textContent()).trim();
}

async function clickIfVisible(locator, timeout = 1500) {
  try {
    await locator.click({ timeout });
  } catch (e) {
    // the confirmation step is optional in this flow
  }
}

// --- organization membership / repository role grant (REQ-2 flows) ---------
async function addOrganizationMember(page, username) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: ORG, exact: true }).click();
  await page.getByRole('link', { name: 'People', exact: true }).click();
  await page.getByRole('button', { name: 'Add member', exact: true }).first().click();
  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await page.getByRole('button', { name: 'Add member', exact: true }).last().click();
  await expect(page.getByText(username, { exact: true }).first()).toBeVisible();
}

async function grantRepositoryRole(page, repo, username, role) {
  await openRepository(page, repo);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Manage access', exact: true }).click();
  await page.getByRole('button', { name: 'Add people or teams', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search', exact: true }).fill(username);
  await page.getByRole('option', { name: username, exact: true }).click();
  await page.getByRole('combobox', { name: 'Role', exact: true }).selectOption({ label: role });
  await page.getByRole('button', { name: 'Add', exact: true }).click();
}

// a distinct, non-author collaborator with Write permission the tests create
// for themselves (through registration, membership and a role grant).
async function createWritableReviewer(page) {
  const username = `pw-rev-${u()}`;
  await registerAccount(page, username, `${username}@example.test`);
  await signIn(page, ALICE, PASSWORD);
  await addOrganizationMember(page, username);
  await grantRepositoryRole(page, REPO, username, 'Write');
  await signOut(page);
  await signIn(page, username);
  return username;
}

// --- code, branch and pull-request creation flows --------------------------
async function createBranchWithCommit(page, repo, branch, file, content) {
  await openRepository(page, repo);
  await page.getByRole('button', { name: /^Branch / }).click();
  await page.getByRole('textbox', { name: 'Find branch', exact: true }).fill(branch);
  await page.getByRole('option', { name: `Create branch: ${branch}`, exact: true }).click();
  await page.getByRole('button', { name: 'Add file', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Create new file', exact: true }).click();
  await page.getByLabel('File name', { exact: true }).fill(file);
  await page.getByRole('textbox', { name: 'File contents', exact: true }).fill(content);
  await page.getByLabel('Commit message', { exact: true }).fill(`Add ${file}`);
  await page.getByRole('button', { name: 'Commit changes', exact: true }).click();
  // the created file entry is a link whose exact accessible name is the file name
  await expect(page.getByRole('link', { name: file, exact: true }).first()).toBeVisible();
}

// must be called while a repository page is open
async function createPullRequest(page, compareBranch, title, opts = {}) {
  const { draft = false, description = null } = opts;
  const label = draft ? 'Create draft pull request' : 'Create pull request';
  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await page.getByRole('link', { name: 'New pull request', exact: true }).click();
  await page.getByRole('combobox', { name: 'base', exact: true }).selectOption({ label: 'main' });
  await page.getByRole('combobox', { name: 'compare', exact: true }).selectOption({ label: compareBranch });
  await page.getByRole('button', { name: 'Compare changes', exact: true }).click();
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(title);
  if (description) {
    await page.getByLabel('Description', { exact: true }).fill(description);
  }
  await page.getByRole('button', { name: label, exact: true }).last().click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}

async function protectBranch(page, repo, branchName) {
  await openRepository(page, repo);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Branches', exact: true }).click();
  await page.getByRole('button', { name: 'Add branch protection rule', exact: true }).click();
  await page.getByLabel('Branch name pattern', { exact: true }).fill(branchName);
  await page.getByRole('checkbox', { name: 'Require 1 approval', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Require status check test', exact: true }).check();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
}

async function createRepository(page, repo) {
  await page.getByRole('link', { name: 'New repository', exact: true }).click();
  await page.getByLabel('Repository name', { exact: true }).fill(repo);
  await page.getByRole('checkbox', { name: 'Add a README file', exact: true }).check();
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();
  await expect(page.getByRole('heading', { name: new RegExp(repo) }).first()).toBeVisible();
}

// ===========================================================================
// REQ-6-1
// ===========================================================================
test('REQ-6-1: Protect Branches with Review and Status-Check Requirements - Scenario 1', async ({ page }) => {
  const repo = `pw-protect-${u()}`;

  // GIVEN a repository Admin signed in, with a repository that has no rule yet
  await signIn(page, ALICE);
  await createRepository(page, repo);

  // WHEN the Admin adds a branch protection rule for the exact branch name `main`
  await protectBranch(page, repo, 'main');

  // THEN the settings page displays exactly one rule with both requirements
  await expect(page.getByText('main', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('1 approval', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Require status check test', { exact: true }).first()).toBeVisible();

  // THEN after refreshing the settings page the rule still exists
  await page.reload();
  await expect(page.getByText('main', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('1 approval', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Require status check test', { exact: true }).first()).toBeVisible();
});

test('REQ-6-1#2: Protect Branches with Review and Status-Check Requirements - Scenario 2', async ({ page }) => {
  const username = `pw-nonadmin-${u()}`;

  // GIVEN a signed-in user without repository-administration permission
  await registerAccount(page, username, `${username}@example.test`);
  await signIn(page, username);

  // WHEN the user attempts to reach the branch-protection settings
  await openRepository(page, REPO);
  const settings = page.getByRole('link', { name: 'Settings', exact: true });
  if (await settings.count()) {
    await settings.first().click();
    const branches = page.getByRole('link', { name: 'Branches', exact: true });
    if (await branches.count()) {
      await branches.first().click();
    }
  }

  // THEN the branch-protection controls are unavailable to the non-administrator
  await expect(page.getByRole('button', { name: 'Add branch protection rule', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toHaveCount(0);
});

test('REQ-6-1#3: Protect Branches with Review and Status-Check Requirements - Scenario 3', async ({ page }) => {
  // GIVEN a repository Admin opens the Open PR targeting the protected main branch
  await signIn(page, ALICE);
  await openSeededOpenPr(page);

  // the Checks area is available on arrival and shows test as pending
  await expect(page.getByText('test: pending', { exact: true })).toBeVisible();

  // WHEN the Admin updates test to success in the Checks area and saves
  await page.getByRole('combobox', { name: 'test status', exact: true }).selectOption({ label: 'success' });
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  // THEN the Checks area displays success and identifies the setter
  await expect(page.getByText('test: success', { exact: true })).toBeVisible();
  await expect(page.getByText(ALICE, { exact: true }).first()).toBeVisible();

  // THEN after refreshing the PR detail page the status still corresponds to that commit
  await page.reload();
  await expect(page.getByText('test: success', { exact: true })).toBeVisible();
});

// ===========================================================================
// REQ-6-2-1
// ===========================================================================
test('REQ-6-2-1: List and Filter Repository Pull Requests - Scenario 1', async ({ page }) => {
  // GIVEN a visitor on the public Pull requests page
  await page.goto('/');
  await openPullRequests(page);

  // WHEN the visitor selects Open
  await page.getByRole('link', { name: 'Open', exact: true }).first().click();
  const openRow = page.getByRole('link', { name: SEEDED_PRS });
  await expect(openRow).toHaveCount(1);
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();

  // THEN clicking the title opens that PR's detail page
  await openRow.click();
  const heading = page.getByRole('heading', { name: SEEDED_PRS }).first();
  await expect(heading).toBeVisible();
  const title = (await heading.textContent()).trim();

  // THEN after switching to Closed the Open PR is not displayed
  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await page.getByRole('link', { name: 'Closed', exact: true }).first().click();
  await expect(page.getByRole('link', { name: title, exact: true })).toHaveCount(0);
});

test('REQ-6-2-1#2: List and Filter Repository Pull Requests - Scenario 2', async ({ page }) => {
  // GIVEN the signed-in account opens the public repository's PR list
  await signIn(page, ALICE);
  await openPullRequests(page);

  // WHEN selecting the Open status filter
  await page.getByRole('link', { name: 'Open', exact: true }).first().click();
  await expect(page.getByRole('link', { name: SEEDED_PRS })).toHaveCount(1);

  // THEN reloading the filtered list keeps the same Open PR visible
  await page.reload();
  await expect(page.getByRole('link', { name: SEEDED_PRS })).toHaveCount(1);

  // THEN leaving the page and reopening the list keeps the same result
  await openPullRequests(page);
  await page.getByRole('link', { name: 'Open', exact: true }).first().click();
  const link = page.getByRole('link', { name: SEEDED_PRS });
  await expect(link).toHaveCount(1);
  await link.click();
  await expect(page.getByRole('heading', { name: SEEDED_PRS }).first()).toBeVisible();
});

test('REQ-6-2-1#3: List and Filter Repository Pull Requests - Scenario 3', async ({ page }) => {
  // GIVEN the public PR list is directly accessible to a visitor
  await page.goto('/');
  await openPullRequests(page);
  await expect(page.getByRole('link', { name: 'Open', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Closed', exact: true }).first()).toBeVisible();

  // WHEN the visitor selects Open
  await page.getByRole('link', { name: 'Open', exact: true }).first().click();

  // THEN only the Open PR is listed with its status and the title link opens it
  const link = page.getByRole('link', { name: SEEDED_PRS });
  await expect(link).toHaveCount(1);
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await link.click();
  await expect(page.getByRole('heading', { name: SEEDED_PRS }).first()).toBeVisible();

  // THEN reloading the visible PR keeps it
  await page.reload();
  await expect(page.getByRole('heading', { name: SEEDED_PRS }).first()).toBeVisible();
});

// ===========================================================================
// REQ-6-2-2
// ===========================================================================
test('REQ-6-2-2: Compare Branches Before Opening a Pull Request - Scenario 1', async ({ page }) => {
  await signIn(page, ALICE);
  await openPullRequests(page);

  // WHEN a contributor opens New pull request and compares feature-search against main
  await page.getByRole('link', { name: 'New pull request', exact: true }).click();
  const base = page.getByRole('combobox', { name: 'base', exact: true });
  const compare = page.getByRole('combobox', { name: 'compare', exact: true });
  await base.selectOption({ label: 'main' });
  await compare.selectOption({ label: 'feature-search' });
  await page.getByRole('button', { name: 'Compare changes', exact: true }).click();

  // THEN both branch names, the known changed file, a commit summary and an
  // enabled creation entry are displayed
  const create = page.getByRole('button', { name: 'Create pull request', exact: true });
  await expect(page.getByText('src/search.ts', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Commit summary', { exact: true }).first()).toBeVisible();
  await expect(create.first()).toBeEnabled();

  // THEN selecting the same branch in both fields disables the creation entry
  await compare.selectOption({ label: 'main' });
  await expect(page.getByText('No changes', { exact: true }).first()).toBeVisible();
  await expect(create.first()).toBeDisabled();
});

test('REQ-6-2-2#2: Compare Branches Before Opening a Pull Request - Scenario 2', async ({ page }) => {
  await signIn(page, ALICE);
  await openPullRequests(page);

  await page.getByRole('link', { name: 'New pull request', exact: true }).click();
  const base = page.getByRole('combobox', { name: 'base', exact: true });
  const compare = page.getByRole('combobox', { name: 'compare', exact: true });

  // WHEN the same branch is selected as base and compare
  await base.selectOption({ label: 'main' });
  await compare.selectOption({ label: 'main' });
  await page.getByRole('button', { name: 'Compare changes', exact: true }).click();

  // THEN the system reports that there are no differences and keeps creation disabled
  await expect(page.getByText('No changes', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create pull request', exact: true }).first()).toBeDisabled();
});

// ===========================================================================
// REQ-6-2-3
// ===========================================================================
test('REQ-6-2-3: Create a Pull Request from Comparison Results - Scenario 1', async ({ page }) => {
  const title = `pw-pr-${u()}`;
  const description = 'Pull request created by Playwright from the comparison results.';

  await signIn(page, ALICE);
  await createPullRequest(page, 'feature-search', title, { description });

  // THEN the new PR detail page shows the title, Open status and both branches
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('feature-search', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('main', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(description, { exact: true })).toBeVisible();
  await expect(page.getByText(ALICE, { exact: true }).first()).toBeVisible();

  // THEN refreshing the detail page and the PR list keeps the new PR
  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();
});

test('REQ-6-2-3#2: Create a Pull Request from Comparison Results - Scenario 2', async ({ page }) => {
  const branch = `pw-cmp-${u()}`;
  const file = `pw-cmp-${u()}.md`;

  await signIn(page, ALICE);
  await createBranchWithCommit(page, REPO, branch, file, 'comparable change for the pull request');

  // WHEN the contributor confirms distinct branches and submits a whitespace title
  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await page.getByRole('link', { name: 'New pull request', exact: true }).click();
  await page.getByRole('combobox', { name: 'base', exact: true }).selectOption({ label: 'main' });
  await page.getByRole('combobox', { name: 'compare', exact: true }).selectOption({ label: branch });
  await page.getByRole('button', { name: 'Compare changes', exact: true }).click();
  await page.getByRole('button', { name: 'Create pull request', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Create pull request', exact: true }).last().click();

  // THEN the submission is rejected and no record is created
  await expect(page.getByText('Title is required', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Title', { exact: true })).toBeVisible();
});

// ===========================================================================
// REQ-6-2-4
// ===========================================================================
test('REQ-6-2-4: Create a Draft Pull Request - Scenario 1', async ({ page }) => {
  const branch = `pw-draft-${u()}`;
  const file = `pw-draft-${u()}.md`;
  const title = `pw-draft-pr-${u()}`;

  await signIn(page, ALICE);
  await createBranchWithCommit(page, REPO, branch, file, 'draft change for the pull request');

  // WHEN the collaborator creates a draft pull request from the comparison page
  await createPullRequest(page, branch, title, { draft: true });

  // THEN the detail page shows the Draft marker and cannot be merged
  await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Merge pull request', exact: true }).first()).toBeDisabled();

  // THEN after refresh the draft status and content remain
  await page.reload();
  await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();

  // THEN the PR list also shows the draft status
  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await page.getByRole('link', { name: 'Draft', exact: true }).first().click();
  await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();
});

test('REQ-6-2-4#2: Create a Draft Pull Request - Scenario 2', async ({ page }) => {
  const title = 'Draft onboarding update';

  // GIVEN the author of the draft pull request is signed in
  await signIn(page, ALICE);
  await openPullRequests(page);
  await page.getByRole('link', { name: 'Draft', exact: true }).first().click();
  await page.getByRole('link', { name: title, exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText('draft-feature', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('main', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible();

  // WHEN the author marks the draft ready for review
  await page.getByRole('button', { name: 'Ready for review', exact: true }).click();
  await clickIfVisible(page.getByRole('button', { name: 'Confirm', exact: true }));

  // THEN the same PR is Open and its title and branches are unchanged
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText('draft-feature', { exact: true }).first()).toBeVisible();

  // THEN Open persists on reload
  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
});

// ===========================================================================
// REQ-6-3-1
// ===========================================================================
test('REQ-6-3-1: View Pull Request Overview and Commits - Scenario 1', async ({ page }) => {
  // GIVEN a visitor opens the public Open pull request
  await page.goto('/');
  await openPullRequests(page);
  await page.getByRole('link', { name: 'Open', exact: true }).first().click();
  await page.getByRole('link', { name: SEEDED_PRS }).click();
  await expect(page.getByRole('heading', { name: SEEDED_PRS }).first()).toBeVisible();

  // WHEN the three views are opened in sequence
  await expect(page.getByRole('link', { name: 'Conversation', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Commits', exact: true }).click();
  await expect(page.getByText('Commit summary', { exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await expect(page.getByText('Changed files', { exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Conversation', exact: true }).click();

  // THEN after refreshing the title and the navigation links remain usable
  await page.reload();
  await expect(page.getByRole('heading', { name: SEEDED_PRS }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Commits', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Files changed', exact: true })).toBeVisible();
});

test('REQ-6-3-1#2: View Pull Request Overview and Commits - Scenario 2', async ({ page }) => {
  await signIn(page, ALICE);
  const title = await openSeededOpenPr(page);

  // THEN Conversation, Commits and Files changed all read the same PR
  await expect(page.getByRole('link', { name: 'Conversation', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Commits', exact: true }).click();
  await expect(page.getByText('Commit summary', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await expect(page.getByText('Changed files', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();

  // THEN after refreshing the view the PR data is unchanged
  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
});

test('REQ-6-3-1#3: View Pull Request Overview and Commits - Scenario 3', async ({ page }) => {
  await signIn(page, ALICE);

  // WHEN the signed-in user opens the PR from the list, leaves it and reopens it
  const title = await openSeededOpenPr(page);
  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await page.getByRole('link', { name: 'Open', exact: true }).first().click();
  await page.getByRole('link', { name: title, exact: true }).click();

  // THEN the same pull request is restored with the same navigation
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Commits', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Files changed', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await expect(page.getByText('Changed files', { exact: true }).first()).toBeVisible();
});

// ===========================================================================
// REQ-6-3-2
// ===========================================================================
test('REQ-6-3-2: Inspect Changed Files and Aggregate Diff - Scenario 1', async ({ page }) => {
  // GIVEN a visitor opens the public PR's Files changed view
  await page.goto('/');
  await openPullRequests(page);
  await page.getByRole('link', { name: 'Open', exact: true }).first().click();
  await page.getByRole('link', { name: SEEDED_PRS }).click();
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();

  // THEN the known changed file path and the aggregate statistics are displayed
  await expect(page.getByText('src/search.ts', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/\d+\s+additions?,\s+\d+\s+deletions?/).first()).toBeVisible();

  // THEN refreshing leaves the diff view unchanged
  await page.reload();
  await expect(page.getByText('src/search.ts', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/\d+\s+additions?,\s+\d+\s+deletions?/).first()).toBeVisible();

  // THEN switching back to Conversation keeps the PR state
  await page.getByRole('link', { name: 'Conversation', exact: true }).click();
  await expect(page.getByRole('heading', { name: SEEDED_PRS }).first()).toBeVisible();
  await expect(page.getByText('Merged', { exact: true })).toHaveCount(0);
});

// ===========================================================================
// REQ-6-3-3
// ===========================================================================
test('REQ-6-3-3: Add Review Comments to Changed Code Lines - Scenario 1', async ({ page }) => {
  const reviewer = await createWritableReviewer(page);
  const body = `Inline comment ${u()}`;

  // GIVEN the reviewer opens the PR's Files changed view
  await openSeededOpenPr(page);
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();

  // WHEN the changed-line editor is opened and the comment is published immediately
  await page.getByRole('button', { name: 'Add comment', exact: true }).first().click();
  await page.getByLabel('Comment', { exact: true }).fill(body);
  await page.getByRole('button', { name: 'Add single comment', exact: true }).click();

  // THEN the comment is displayed with its author
  await expect(page.getByText(body, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(reviewer, { exact: true }).first()).toBeVisible();

  // THEN after refresh the comment remains anchored in that diff
  await page.reload();
  await expect(page.getByText(body, { exact: true }).first()).toBeVisible();
});

test('REQ-6-3-3#2: Add Review Comments to Changed Code Lines - Scenario 2', async ({ page }) => {
  await createWritableReviewer(page);
  const body = `Pending comment ${u()}`;

  await openSeededOpenPr(page);
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();

  // WHEN the reviewer starts a review instead of publishing a single comment
  await page.getByRole('button', { name: 'Add comment', exact: true }).first().click();
  await page.getByLabel('Comment', { exact: true }).fill(body);
  await page.getByRole('button', { name: 'Start a review', exact: true }).click();

  // THEN the comment is kept as a pending review draft for its author
  await expect(page.getByText(body, { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Pending review', { exact: true }).first()).toBeVisible();

  // THEN the pending draft is retained after reload
  await page.reload();
  await expect(page.getByText(body, { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Pending review', { exact: true }).first()).toBeVisible();
});

// ===========================================================================
// REQ-6-3-4
// ===========================================================================
test('REQ-6-3-4: Submit a Pull Request Review - Scenario 1', async ({ page }) => {
  const reviewer = await createWritableReviewer(page);

  // GIVEN the reviewer opens the reviewable Open PR
  await openSeededOpenPr(page);
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();

  // WHEN the reviewer approves the changes
  await page.getByRole('button', { name: 'Review changes', exact: true }).click();
  await page.getByRole('radio', { name: 'Approve', exact: true }).check();
  await page.getByRole('button', { name: 'Submit review', exact: true }).click();

  // THEN the decision and its reviewer are displayed
  await expect(page.getByText('Approved', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(reviewer, { exact: true }).first()).toBeVisible();

  // THEN the decision still exists after reload
  await page.reload();
  await expect(page.getByText('Approved', { exact: true }).first()).toBeVisible();
});

test('REQ-6-3-4#2: Submit a Pull Request Review - Scenario 2', async ({ page }) => {
  await createWritableReviewer(page);
  const summary = `Please rework the diff ${u()}`;

  await openSeededOpenPr(page);
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();

  // WHEN the reviewer requests changes with a summary
  await page.getByRole('button', { name: 'Review changes', exact: true }).click();
  await page.getByLabel('Summary', { exact: true }).fill(summary);
  await page.getByRole('radio', { name: 'Request changes', exact: true }).check();
  await page.getByRole('button', { name: 'Submit review', exact: true }).click();

  // THEN the request-changes status and the exact summary are displayed
  await expect(page.getByText('Changes requested', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(summary, { exact: true }).first()).toBeVisible();

  // THEN the decision remains displayed after reload
  await page.reload();
  await expect(page.getByText('Changes requested', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(summary, { exact: true }).first()).toBeVisible();
});

// ===========================================================================
// REQ-6-4
// ===========================================================================
test('REQ-6-4: Request or Remove Pull Request Reviewers - Scenario 1', async ({ page }) => {
  // GIVEN the PR author is signed in on the Open PR detail page
  await signIn(page, ALICE);
  await openSeededOpenPr(page);

  // WHEN an eligible collaborator is searched for and selected under Reviewers
  await page.getByRole('button', { name: 'Reviewers', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search', exact: true }).fill(BOB);
  await page.getByRole('option', { name: BOB, exact: true }).click();

  // THEN the account is shown as a requested reviewer
  await expect(page.getByRole('button', { name: `Remove ${BOB}`, exact: true })).toBeVisible();

  // WHEN the request is removed
  await page.getByRole('button', { name: `Remove ${BOB}`, exact: true }).click();

  // THEN only the final request set remains, also after reload
  await expect(page.getByRole('button', { name: `Remove ${BOB}`, exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: `Remove ${BOB}`, exact: true })).toHaveCount(0);
});

// ===========================================================================
// REQ-6-5
// ===========================================================================
test('REQ-6-5: Merge an Eligible Pull Request - Scenario 1', async ({ page }) => {
  // GIVEN a maintainer signed in on the eligible, Open, non-draft PR
  await signIn(page, ALICE);
  await openSeededOpenPr(page);

  // the only selectable method is Create a merge commit
  await expect(page.getByText('Create a merge commit', { exact: true }).first()).toBeVisible();

  // WHEN the maintainer merges and confirms
  const merge = page.getByRole('button', { name: 'Merge pull request', exact: true });
  await expect(merge.first()).toBeEnabled();
  await merge.first().click();
  await page.getByRole('button', { name: 'Confirm merge', exact: true }).click();

  // THEN the PR displays Merged with the merger
  await expect(page.getByText('Merged', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(ALICE, { exact: true }).first()).toBeVisible();

  // THEN after refreshing the PR the merged status remains
  await page.reload();
  await expect(page.getByText('Merged', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Merge pull request', exact: true })).toHaveCount(0);
});

test('REQ-6-5#2: Merge an Eligible Pull Request - Scenario 2', async ({ page }) => {
  const repo = `pw-merge-${u()}`;
  const branch = `pw-side-${u()}`;
  const file = `pw-side-${u()}.md`;
  const title = `pw-blocked-${u()}`;

  // GIVEN a maintainer with a repository whose main branch requires approval and check success
  await signIn(page, ALICE);
  await createRepository(page, repo);
  await protectBranch(page, repo, 'main');
  await createBranchWithCommit(page, repo, branch, file, 'change for the blocked pull request');

  // WHEN a PR into protected main has neither an approval nor a successful check
  await createPullRequest(page, branch, title);

  // THEN the page displays the required status and the merge entry is disabled
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Merge pull request', exact: true }).first()).toBeDisabled();
  await expect(page.getByText('Review required by branch protection', { exact: true }).first()).toBeVisible();

  // THEN refreshing or reopening leaves the blocked state unchanged
  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText('Review required by branch protection', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Merge pull request', exact: true }).first()).toBeDisabled();
});

// ===========================================================================
// REQ-6-6
// ===========================================================================
test('REQ-6-6: Close or Reopen a Pull Request Without Merging - Scenario 1', async ({ page }) => {
  const branch = `pw-close-${u()}`;
  const file = `pw-close-${u()}.md`;
  const title = `pw-close-pr-${u()}`;

  // GIVEN the author signed in on an unmerged Open PR
  await signIn(page, ALICE);
  await createBranchWithCommit(page, REPO, branch, file, 'change for the close/reopen pull request');
  await createPullRequest(page, branch, title);
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();

  // WHEN the author closes the pull request
  await page.getByRole('button', { name: 'Close pull request', exact: true }).click();

  // THEN the status is Closed
  await expect(page.getByText('Closed', { exact: true }).first()).toBeVisible();

  // WHEN the author reopens the pull request
  await page.getByRole('button', { name: 'Reopen pull request', exact: true }).click();

  // THEN the status is Open again and the discussion still exists
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Conversation', exact: true })).toBeVisible();

  // THEN after reloading, the final Open status remains and Close is available again
  await page.reload();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close pull request', exact: true })).toBeVisible();
});

test('REQ-6-6#2: Close or Reopen a Pull Request Without Merging - Scenario 2', async ({ page }) => {
  const username = `pw-view-${u()}`;

  // GIVEN a viewer who is neither the author nor a maintainer
  await registerAccount(page, username, `${username}@example.test`);
  await signIn(page, username);
  await openPullRequests(page);
  await page.getByRole('link', { name: SEEDED_PRS }).first().click();
  await expect(page.getByRole('heading', { name: SEEDED_PRS }).first()).toBeVisible();

  // THEN no close or reopen operation is available to that user
  await expect(page.getByRole('button', { name: 'Close pull request', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reopen pull request', exact: true })).toHaveCount(0);

  // THEN after reloading the status is unchanged
  await page.reload();
  await expect(page.getByRole('button', { name: 'Close pull request', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reopen pull request', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: SEEDED_PRS }).first()).toBeVisible();
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

