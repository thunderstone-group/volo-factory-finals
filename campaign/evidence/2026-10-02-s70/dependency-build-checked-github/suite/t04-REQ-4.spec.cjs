const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// Seed data stated by the requirements (never mutated destructively):
//   repository `acme-docs` (public), private repository `secret-research`,
//   owner `alice-dev`, branches `main` and `feature-search`,
//   file `README.md`, commit `Document search flow`, changed path `src/search.ts`,
//   account `alice-dev` / password `Valid-password-123!`.
// Records needed by a mutation scenario are created through the UI instead.
// ---------------------------------------------------------------------------

const PASSWORD = 'Valid-password-123!';

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function signIn(page, usernameOrEmail, password = PASSWORD) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(usernameOrEmail);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
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
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
}

// Locate a repository through the global search box (never a guessed URL).
async function openRepo(page, name) {
  await page.goto('/');
  const box = page.getByRole('searchbox', { name: 'Search', exact: true });
  await box.click();
  await box.fill(name);
  await box.press('Enter');
  await page.getByRole('link', { name, exact: true }).first().click();
}

// Create a repository in the signed-in user's default personal namespace.
async function createRepository(page, name, { isPrivate = true, readme = true } = {}) {
  await page.goto('/');
  await page.getByRole('link', { name: 'New repository', exact: true }).click();
  await page.getByLabel('Repository name', { exact: true }).fill(name);
  await page.getByRole('radio', { name: isPrivate ? 'Private' : 'Public', exact: true }).check();
  if (readme) {
    await page.getByRole('checkbox', { name: 'Add a README file', exact: true }).check();
  }
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Code', exact: true })).toBeVisible();
}

async function openBranchSelector(page, currentBranch) {
  await page.getByRole('button', { name: `Branch ${currentBranch}`, exact: true }).click();
}

async function switchBranch(page, currentBranch, targetBranch) {
  await openBranchSelector(page, currentBranch);
  await page.getByRole('textbox', { name: 'Find branch', exact: true }).fill(targetBranch);
  await page.getByRole('option', { name: targetBranch, exact: true }).click();
}

async function createBranch(page, fromBranch, newBranch) {
  await openBranchSelector(page, fromBranch);
  await page.getByRole('textbox', { name: 'Find branch', exact: true }).fill(newBranch);
  await page.getByRole('option', { name: `Create branch: ${newBranch}`, exact: true }).click();
}

async function openCreateNewFileForm(page) {
  await page.getByRole('button', { name: 'Add file', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Create new file', exact: true }).click();
}

// ---------------------------------------------------------------------------
// REQ-4-1 Browse Repository Files and Directories
// ---------------------------------------------------------------------------

test('REQ-4-1: REQ-4-1: Browse Repository Files and Directories - Scenario 1', async ({ page }) => {
  await openRepo(page, 'acme-docs');
  await page.getByRole('link', { name: 'Code', exact: true }).click();

  // default branch and root listing
  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();

  // nested directory, then the text file immediately inside it
  await page.getByRole('link', { name: 'src', exact: true }).click();
  await expect(page.getByRole('link', { name: 'search.ts', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'search.ts', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();

  // refreshing the file page keeps the same branch/path
  await page.reload();
  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();
});

// ---------------------------------------------------------------------------
// REQ-4-2-1 View Repository Commit History
// ---------------------------------------------------------------------------

test('REQ-4-2-1: REQ-4-2-1: View Repository Commit History - Scenario 1', async ({ page }) => {
  await openRepo(page, 'acme-docs');
  await page.getByRole('link', { name: 'Commits', exact: true }).click();

  await expect(page.getByText('Document search flow', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/\bago\b/).first()).toBeVisible();

  // refresh keeps order/content
  await page.reload();
  await expect(page.getByText('Document search flow', { exact: true }).first()).toBeVisible();

  // open the commit detail
  await page.getByRole('link', { name: 'Document search flow', exact: true }).first().click();
  await expect(page.getByText('Document search flow', { exact: true }).first()).toBeVisible();
});

// ---------------------------------------------------------------------------
// REQ-4-2-2 Inspect Commit and Revision Differences
// ---------------------------------------------------------------------------

test('REQ-4-2-2: REQ-4-2-2: Inspect Commit and Revision Differences - Scenario 1', async ({ page }) => {
  await openRepo(page, 'acme-docs');
  await page.getByRole('link', { name: 'Commits', exact: true }).click();
  await page.getByRole('link', { name: 'Document search flow', exact: true }).first().click();

  await expect(page.getByText('src/search.ts', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Changed files', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/\d+ additions?, \d+ deletions?/).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('src/search.ts', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Changed files', { exact: true }).first()).toBeVisible();
});

// ---------------------------------------------------------------------------
// REQ-4-2-3 Search Code Within a Repository
// ---------------------------------------------------------------------------

test('REQ-4-2-3: REQ-4-2-3: Search Code Within a Repository - Scenario 1', async ({ page }) => {
  await openRepo(page, 'acme-docs');
  const box = page.getByRole('searchbox', { name: 'Search', exact: true });
  await box.click();
  await box.fill('search flow');
  await box.press('Enter');

  await page.getByRole('link', { name: 'Code', exact: true }).click();

  // matching file paths / snippets within the current repository
  await expect(page.getByText('src/search.ts', { exact: true }).first()).toBeVisible();

  await page.getByRole('link', { name: 'README.md', exact: true }).first().click();
  await expect(page.getByText('search flow', { exact: true }).first()).toBeVisible();
});

test('REQ-4-2-3#2: REQ-4-2-3: Search Code Within a Repository - Scenario 2', async ({ page }) => {
  await openRepo(page, 'acme-docs');
  const box = page.getByRole('searchbox', { name: 'Search', exact: true });
  await box.click();
  await box.fill('no-such-token');
  await box.press('Enter');
  await page.getByRole('link', { name: 'Code', exact: true }).click();

  await expect(page.getByText('No code results', { exact: true })).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Search', exact: true })).toHaveValue('no-such-token');

  // returning to the repository and repeating the search gives the same empty state
  await openRepo(page, 'acme-docs');
  const boxAgain = page.getByRole('searchbox', { name: 'Search', exact: true });
  await boxAgain.click();
  await boxAgain.fill('no-such-token');
  await boxAgain.press('Enter');
  await page.getByRole('link', { name: 'Code', exact: true }).click();
  await expect(page.getByText('No code results', { exact: true })).toBeVisible();
});

test('REQ-4-2-3#3: REQ-4-2-3: Search Code Within a Repository - Scenario 3', async ({ page }) => {
  await signIn(page, 'alice-dev');
  await openRepo(page, 'acme-docs');

  const box = page.getByRole('searchbox', { name: 'Search', exact: true });
  await box.click();
  await box.fill('search flow');
  await box.press('Enter');
  await page.getByRole('link', { name: 'Code', exact: true }).click();

  await page.getByRole('link', { name: 'README.md', exact: true }).first().click();
  await expect(page.getByText('search flow', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'README.md', exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('search flow', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'README.md', exact: true }).first()).toBeVisible();
});

test('REQ-4-2-3#4: REQ-4-2-3: Search Code Within a Repository - Scenario 4', async ({ page }) => {
  await signIn(page, 'alice-dev');
  await openRepo(page, 'acme-docs');

  const box = page.getByRole('searchbox', { name: 'Search', exact: true });
  await box.click();
  await box.fill('search flow');
  await box.press('Enter');
  await page.getByRole('link', { name: 'Code', exact: true }).click();

  // open the matching file that lives under the src/ path
  await page.getByRole('link', { name: 'search.ts', exact: true }).first().click();
  await expect(page.getByText('search flow', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('search flow', { exact: true }).first()).toBeVisible();
});

// ---------------------------------------------------------------------------
// REQ-4-3-1 List and Switch Repository Branches
// ---------------------------------------------------------------------------

test('REQ-4-3-1: REQ-4-3-1: List and Switch Repository Branches - Scenario 1', async ({ page }) => {
  await openRepo(page, 'acme-docs');
  await page.getByRole('link', { name: 'Code', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();

  await switchBranch(page, 'main', 'feature-search');
  await expect(page.getByRole('button', { name: 'Branch feature-search', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'main-only.md', exact: true })).toBeVisible();

  // the selector lists both branches and marks the current one
  await openBranchSelector(page, 'feature-search');
  await expect(page.getByRole('option', { name: 'main', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'feature-search', exact: true })).toBeVisible();
  await page.getByRole('option', { name: 'main', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();
});

test('REQ-4-3-1#2: REQ-4-3-1: List and Switch Repository Branches - Scenario 2', async ({ page }) => {
  await openRepo(page, 'acme-docs');
  await page.getByRole('link', { name: 'Code', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();

  await openBranchSelector(page, 'main');
  await page.getByRole('textbox', { name: 'Find branch', exact: true }).fill('zz-missing-branch');
  await expect(page.getByText('No matching branch', { exact: true })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();
});

// ---------------------------------------------------------------------------
// REQ-4-3-2 Create a Branch from an Existing Revision
// ---------------------------------------------------------------------------

test('REQ-4-3-2: REQ-4-3-2: Create a Branch from an Existing Revision - Scenario 1', async ({ page }) => {
  await signIn(page, 'alice-dev');
  await openRepo(page, 'acme-docs');
  await page.getByRole('link', { name: 'Code', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();

  await createBranch(page, 'main', 'feature/api-v2');
  await expect(page.getByRole('button', { name: 'Branch feature/api-v2', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Branch feature/api-v2', exact: true })).toBeVisible();

  // the original main branch is still offered
  await openBranchSelector(page, 'feature/api-v2');
  await expect(page.getByRole('option', { name: 'main', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
});

test('REQ-4-3-2#2: REQ-4-3-2: Create a Branch from an Existing Revision - Scenario 2', async ({ page }) => {
  const newBranch = `pw-branch-${u()}`;
  await signIn(page, 'alice-dev');
  await openRepo(page, 'acme-docs');
  await page.getByRole('link', { name: 'Code', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();

  // invalid name is rejected immediately, without creating a reference
  await openBranchSelector(page, 'main');
  await page.getByRole('textbox', { name: 'Find branch', exact: true }).fill('invalid..branch');
  await expect(page.getByText('Invalid branch', { exact: true })).toBeVisible();

  // a valid unused name offers the create entry as the user types
  await page.getByRole('textbox', { name: 'Find branch', exact: true }).fill(newBranch);
  await page.getByRole('option', { name: `Create branch: ${newBranch}`, exact: true }).click();
  await expect(page.getByRole('button', { name: `Branch ${newBranch}`, exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: `Branch ${newBranch}`, exact: true })).toBeVisible();
});

// ---------------------------------------------------------------------------
// REQ-4-3-3 Change the Repository Default Branch
// ---------------------------------------------------------------------------

test('REQ-4-3-3: REQ-4-3-3: Change the Repository Default Branch - Scenario 1', async ({ page }) => {
  const repo = `pw-default-${u()}`;
  await signIn(page, 'alice-dev');
  await createRepository(page, repo, { isPrivate: true, readme: true });
  await page.getByRole('link', { name: 'Code', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();

  // the second branch the scenario needs, created through the branch selector
  await createBranch(page, 'main', 'release');
  await expect(page.getByRole('button', { name: 'Branch release', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Branches', exact: true }).click();
  await page.getByRole('combobox', { name: 'Default branch', exact: true }).selectOption('release');
  await page.getByRole('button', { name: 'Update', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();

  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Default branch', exact: true })).toHaveValue('release');

  // newly opening the repository shows the new default branch
  await openRepo(page, repo);
  await page.getByRole('link', { name: 'Code', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Branch release', exact: true })).toBeVisible();

  // the old default branch is still offered by the selector
  await openBranchSelector(page, 'release');
  await expect(page.getByRole('option', { name: 'main', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
});

test('REQ-4-3-3#2: REQ-4-3-3: Change the Repository Default Branch - Scenario 2', async ({ page }) => {
  const viewer = `pw-viewer-${u()}`;
  await registerAccount(page, viewer, `${viewer}@example.test`);
  await signIn(page, viewer);

  // a signed-in non-administrator viewing a readable repository
  await openRepo(page, 'acme-docs');
  const settings = page.getByRole('link', { name: 'Settings', exact: true });
  if ((await settings.count()) > 0) {
    await settings.click();
    const branches = page.getByRole('link', { name: 'Branches', exact: true });
    if ((await branches.count()) > 0) {
      await branches.click();
    }
  }

  // no default-branch update control is rendered for this user
  await expect(page.getByRole('combobox', { name: 'Default branch', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Update', exact: true })).toHaveCount(0);

  // the saved default branch is unchanged
  await openRepo(page, 'acme-docs');
  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();
});

// ---------------------------------------------------------------------------
// REQ-4-4 Manage Repository Files Through the Web Interface
// ---------------------------------------------------------------------------

test('REQ-4-4: REQ-4-4: Manage Repository Files Through the Web Interface - Scenario 1', async ({ page }) => {
  const repo = `pw-write-${u()}`;
  await signIn(page, 'alice-dev');
  await createRepository(page, repo, { isPrivate: true, readme: true });
  await page.getByRole('link', { name: 'Code', exact: true }).click();

  await openCreateNewFileForm(page);
  await page.getByLabel('File name', { exact: true }).fill('docs/guide.md');
  await page.getByRole('textbox', { name: 'File contents', exact: true }).fill('Guide content from Playwright');
  await page.getByLabel('Commit message', { exact: true }).fill('Add docs guide');
  await page.getByRole('button', { name: 'Commit changes', exact: true }).click();

  await expect(page.getByText('Guide content from Playwright', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText('Guide content from Playwright', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Commits', exact: true }).click();
  await expect(page.getByText('Add docs guide', { exact: true }).first()).toBeVisible();
});

test('REQ-4-4#2: REQ-4-4: Manage Repository Files Through the Web Interface - Scenario 2', async ({ page }) => {
  const repo = `pw-files-${u()}`;
  await signIn(page, 'alice-dev');
  await createRepository(page, repo, { isPrivate: true, readme: true });
  await page.getByRole('link', { name: 'Code', exact: true }).click();

  // invalid path together with a missing commit message: nothing is saved
  await openCreateNewFileForm(page);
  await page.getByLabel('File name', { exact: true }).fill('../invalid.md');
  await page.getByRole('textbox', { name: 'File contents', exact: true }).fill('must not be saved');
  await page.getByRole('button', { name: 'Commit changes', exact: true }).click();

  await expect(page.getByText('Invalid file path', { exact: true })).toBeVisible();
  await expect(page.getByText('Commit message is required', { exact: true })).toBeVisible();

  // the rejected submission left the file browser and history unchanged
  await openRepo(page, repo);
  await page.getByRole('link', { name: 'Code', exact: true }).click();
  await expect(page.getByRole('link', { name: '../invalid.md', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'README.md', exact: true })).toBeVisible();
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

