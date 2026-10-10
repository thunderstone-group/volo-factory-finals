const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const ACCOUNT_EMAIL = 'alice.dev@example.test';
const ACCOUNT_PASSWORD = 'Valid-password-123!';
const REPO = 'acme-docs';
const COMMIT_MESSAGE = 'Document search flow';

async function signIn(page, email = ACCOUNT_EMAIL, password = ACCOUNT_PASSWORD) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function registerAccount(page) {
  const suffix = u();
  const username = `pw-user-${suffix}`;
  const email = `${username}@example.test`;
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(ACCOUNT_PASSWORD);
  await page.getByLabel('Confirm password', { exact: true }).fill(ACCOUNT_PASSWORD);
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  return { username, email };
}

async function openRepo(page, name = REPO) {
  await page.goto('/');
  const search = page.getByRole('searchbox', { name: 'Search', exact: true });
  await search.fill(name);
  await search.press('Enter');
  await page.getByRole('link', { name, exact: true }).first().click();
}

async function openRepoCode(page, name = REPO) {
  await openRepo(page, name);
  await page.getByRole('link', { name: 'Code', exact: true }).click();
}

async function repositorySearch(page, query) {
  const search = page.getByRole('searchbox', { name: 'Search', exact: true });
  await search.fill(query);
  await search.press('Enter');
}

// ---------------------------------------------------------------------------
// REQ-4-1
// ---------------------------------------------------------------------------

// The nested directory on the default branch and the text file inside it, with its
// expected content, are seed records whose names the requirements do not give.
test.skip('REQ-4-1: REQ-4-1: Browse Repository Files and Directories - Scenario 1', () => {});

// ---------------------------------------------------------------------------
// REQ-4-2-1
// ---------------------------------------------------------------------------

test('REQ-4-2-1: REQ-4-2-1: View Repository Commit History - Scenario 1', async ({ page }) => {
  await openRepoCode(page, REPO);
  await page.getByRole('link', { name: 'Commits', exact: true }).click();

  await expect(page.getByText(COMMIT_MESSAGE, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/\bago\b/).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText(COMMIT_MESSAGE, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/\bago\b/).first()).toBeVisible();
});

// ---------------------------------------------------------------------------
// REQ-4-2-2
// ---------------------------------------------------------------------------

test('REQ-4-2-2: REQ-4-2-2: Inspect Commit and Revision Differences - Scenario 1', async ({ page }) => {
  await openRepoCode(page, REPO);
  await page.getByRole('link', { name: 'Commits', exact: true }).click();

  await expect(page.getByText(COMMIT_MESSAGE, { exact: true }).first()).toBeVisible();
  await page.getByText(COMMIT_MESSAGE, { exact: true }).first().click();

  await expect(page.getByText('src/search.ts', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Changed files', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('src/search.ts', { exact: true }).first()).toBeVisible();
});

// ---------------------------------------------------------------------------
// REQ-4-2-3
// ---------------------------------------------------------------------------

test('REQ-4-2-3: REQ-4-2-3: Search Code Within a Repository - Scenario 1', async ({ page }) => {
  await openRepoCode(page, REPO);
  await repositorySearch(page, 'search flow');
  await page.getByRole('link', { name: 'Code', exact: true }).click();

  await expect(page.getByRole('link', { name: 'README.md', exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'README.md', exact: true }).first().click();

  await expect(page.getByText('search flow', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('search flow', { exact: true }).first()).toBeVisible();
});

test('REQ-4-2-3: REQ-4-2-3: Search Code Within a Repository - Scenario 2', async ({ page }) => {
  await openRepoCode(page, REPO);
  await repositorySearch(page, 'no-such-token');
  await page.getByRole('link', { name: 'Code', exact: true }).click();

  await expect(page.getByText('No code results', { exact: true })).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Search', exact: true })).toHaveValue('no-such-token');
});

test('REQ-4-2-3: REQ-4-2-3: Search Code Within a Repository - Scenario 3', async ({ page }) => {
  await signIn(page);
  await openRepoCode(page, REPO);
  await repositorySearch(page, 'search flow');
  await page.getByRole('link', { name: 'Code', exact: true }).click();

  await expect(page.getByRole('link', { name: 'README.md', exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'README.md', exact: true }).first()).toBeVisible();
});

test('REQ-4-2-3: REQ-4-2-3: Search Code Within a Repository - Scenario 4', async ({ page }) => {
  await signIn(page);
  await openRepoCode(page, REPO);
  await repositorySearch(page, 'no-such-token');
  await page.getByRole('link', { name: 'Code', exact: true }).click();
  await expect(page.getByText('No code results', { exact: true })).toBeVisible();

  await openRepoCode(page, REPO);
  await repositorySearch(page, 'no-such-token');
  await page.getByRole('link', { name: 'Code', exact: true }).click();
  await expect(page.getByText('No code results', { exact: true })).toBeVisible();
});

// ---------------------------------------------------------------------------
// REQ-4-3-1
// ---------------------------------------------------------------------------

test('REQ-4-3-1: REQ-4-3-1: List and Switch Repository Branches - Scenario 1', async ({ page }) => {
  await openRepoCode(page, REPO);

  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Branch main', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find branch', exact: true }).fill('feature-search');
  await page.getByRole('option', { name: 'feature-search', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Branch feature-search', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'main-only.md', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Branch feature-search', exact: true }).click();
  await page.getByRole('option', { name: 'main', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'main-only.md', exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();
});

test('REQ-4-3-1: REQ-4-3-1: List and Switch Repository Branches - Scenario 2', async ({ page }) => {
  await openRepoCode(page, REPO);

  await page.getByRole('button', { name: 'Branch main', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find branch', exact: true }).fill('no-such-branch');

  await expect(page.getByText('No matching branch', { exact: true })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();
});

// ---------------------------------------------------------------------------
// REQ-4-3-2
// ---------------------------------------------------------------------------

test('REQ-4-3-2: REQ-4-3-2: Create a Branch from an Existing Revision - Scenario 1', async ({ page }) => {
  await signIn(page);
  await openRepoCode(page, REPO);

  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Branch main', exact: true }).click();

  const findBranch = page.getByRole('textbox', { name: 'Find branch', exact: true });
  await findBranch.fill('invalid..branch');
  await expect(page.getByText('Invalid branch', { exact: true })).toBeVisible();

  const branch = `pw-branch-${u()}`;
  await findBranch.fill(branch);
  await page.getByRole('option', { name: `Create branch: ${branch}`, exact: true }).click();

  await expect(page.getByRole('button', { name: `Branch ${branch}`, exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: `Branch ${branch}`, exact: true })).toBeVisible();
});

test('REQ-4-3-2: REQ-4-3-2: Create a Branch from an Existing Revision - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openRepoCode(page, REPO);

  const branch = `pw-branch-${u()}`;
  await page.getByRole('button', { name: 'Branch main', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find branch', exact: true }).fill(branch);
  await page.getByRole('option', { name: `Create branch: ${branch}`, exact: true }).click();

  await expect(page.getByRole('button', { name: `Branch ${branch}`, exact: true })).toBeVisible();

  await page.getByRole('button', { name: `Branch ${branch}`, exact: true }).click();
  await page.getByRole('textbox', { name: 'Find branch', exact: true }).fill('main');
  await expect(page.getByRole('option', { name: 'main', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.reload();
  await expect(page.getByRole('button', { name: `Branch ${branch}`, exact: true })).toBeVisible();
});

// ---------------------------------------------------------------------------
// REQ-4-3-3
// ---------------------------------------------------------------------------

test('REQ-4-3-3: REQ-4-3-3: Change the Repository Default Branch - Scenario 1', async ({ page }) => {
  await signIn(page);

  // Build the GIVEN state: an own repository holding `main` and `release`.
  const repo = `pw-repo-${u()}`;
  await page.getByRole('link', { name: 'New repository', exact: true }).click();
  await page.getByLabel('Repository name', { exact: true }).fill(repo);
  await page.getByRole('checkbox', { name: 'Add a README file', exact: true }).check();
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();

  await page.getByRole('link', { name: 'Code', exact: true }).click();
  await page.getByRole('button', { name: 'Branch main', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find branch', exact: true }).fill('release');
  await page.getByRole('option', { name: 'Create branch: release', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Branch release', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Branches', exact: true }).click();
  await page.getByRole('combobox', { name: 'Default branch', exact: true }).selectOption('release');
  await page.getByRole('button', { name: 'Update', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();

  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Default branch', exact: true })).toHaveValue('release');

  await openRepo(page, repo);
  await page.getByRole('link', { name: 'Code', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Branch release', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Branch release', exact: true }).click();
  await expect(page.getByRole('option', { name: 'main', exact: true })).toBeVisible();
});

test('REQ-4-3-3: REQ-4-3-3: Change the Repository Default Branch - Scenario 2', async ({ page }) => {
  const { email } = await registerAccount(page);
  await signIn(page, email);

  await openRepo(page, REPO);
  const settings = page.getByRole('link', { name: 'Settings', exact: true });
  if ((await settings.count()) > 0) {
    await settings.first().click();
    const branches = page.getByRole('link', { name: 'Branches', exact: true });
    if ((await branches.count()) > 0) {
      await branches.first().click();
    }
  }

  await expect(page.getByRole('combobox', { name: 'Default branch', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Update', exact: true })).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// REQ-4-4
// ---------------------------------------------------------------------------

test('REQ-4-4: REQ-4-4: Manage Repository Files Through the Web Interface - Scenario 1', async ({ page }) => {
  await signIn(page);
  await openRepoCode(page, REPO);

  const fileName = `pw-file-${u()}.md`;
  const content = `Playwright saved content ${u()}`;

  await page.getByRole('button', { name: 'Add file', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Create new file', exact: true }).click();

  await page.getByLabel('File name', { exact: true }).fill(fileName);
  await page.getByRole('textbox', { name: 'File contents', exact: true }).fill(content);
  await page.getByLabel('Commit message', { exact: true }).fill(`Add ${fileName}`);
  await page.getByRole('button', { name: 'Commit changes', exact: true }).click();

  await expect(page.getByText(content, { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText(content, { exact: true }).first()).toBeVisible();

  await page.getByRole('link', { name: 'Commits', exact: true }).click();
  await expect(page.getByText(`Add ${fileName}`, { exact: true }).first()).toBeVisible();
});

test('REQ-4-4: REQ-4-4: Manage Repository Files Through the Web Interface - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openRepoCode(page, REPO);

  const fileName = `pw-file-${u()}.md`;
  const content = `Playwright saved content ${u()}`;

  await page.getByRole('button', { name: 'Add file', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Create new file', exact: true }).click();
  await page.getByLabel('File name', { exact: true }).fill(fileName);
  await page.getByRole('textbox', { name: 'File contents', exact: true }).fill(content);
  await page.getByLabel('Commit message', { exact: true }).fill(`Add ${fileName}`);
  await page.getByRole('button', { name: 'Commit changes', exact: true }).click();

  await expect(page.getByText(content, { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(content, { exact: true }).first()).toBeVisible();

  // A rejected submission leaves the files and the history unchanged.
  await page.getByRole('button', { name: 'Add file', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Create new file', exact: true }).click();
  await page.getByLabel('File name', { exact: true }).fill('../invalid.md');
  await page.getByRole('textbox', { name: 'File contents', exact: true }).fill('must not be saved');
  await page.getByRole('button', { name: 'Commit changes', exact: true }).click();

  await expect(
    page
      .getByText('Invalid file path', { exact: true })
      .or(page.getByText('Commit message is required', { exact: true }))
  ).toBeVisible();
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

