// End-to-end acceptance tests for REQ-4 (Code and Version Control).
const { test, expect } = require('@playwright/test');

const PASSWORD = 'Valid-password-123!';
const SEED_USER = 'alice-dev';
const REPO = 'acme-docs';
const README = 'README.md';
const COMMIT_MESSAGE = 'Document search flow';
const CODE_TERM = 'search flow';
const ABSENT_TERM = 'no-such-token';

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// Sign in through the home page "Sign in" entry.
async function signIn(page, username = SEED_USER, password = PASSWORD) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

// Register a brand new account (unique) and sign in with it.
async function registerAndSignIn(page) {
  const username = `pw-user-${u()}`;
  const email = `${username}@example.test`;
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password', { exact: true }).fill(PASSWORD);
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

// Locate a repository through the top global search and open its overview.
async function openRepository(page, name = REPO) {
  await page.goto('/');
  const search = page.getByRole('searchbox', { name: 'Search', exact: true }).first();
  await search.fill(name);
  await search.press('Enter');
  await page.getByRole('link', { name, exact: true }).first().click();
}

// Open the repository Code page (default branch).
async function openCodePage(page, name = REPO) {
  await openRepository(page, name);
  await page.getByRole('link', { name: 'Code', exact: true }).first().click();
}

function branchButton(page, branch) {
  return page.getByRole('button', { name: `Branch ${branch}`, exact: true });
}

// Open the "Add file" -> "Create new file" editor from the Code page.
async function openNewFileEditor(page) {
  await page.getByRole('button', { name: 'Add file', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Create new file', exact: true }).click();
}

test('REQ-4-1: REQ-4-1: Browse Repository Files and Directories - Scenario 1', async ({ page }) => {
  await openCodePage(page);
  await expect(branchButton(page, 'main')).toBeVisible();
  await page.getByRole('link', { name: README, exact: true }).first().click();
  await expect(page.getByText(README).first()).toBeVisible();
  await expect(page.getByText(CODE_TERM).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(CODE_TERM).first()).toBeVisible();
  await expect(page.getByText(README).first()).toBeVisible();
});

test('REQ-4-2-1: REQ-4-2-1: View Repository Commit History - Scenario 1', async ({ page }) => {
  await openCodePage(page);
  await page.getByRole('link', { name: 'Commits' }).first().click();
  await expect(page.getByText(COMMIT_MESSAGE, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/\bago\b/).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(COMMIT_MESSAGE, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/\bago\b/).first()).toBeVisible();
});

test('REQ-4-2-2: REQ-4-2-2: Inspect Commit and Revision Differences - Scenario 1', async ({ page }) => {
  await openCodePage(page);
  await page.getByRole('link', { name: 'Commits' }).first().click();
  await page.getByText(COMMIT_MESSAGE, { exact: true }).first().click();
  await expect(page.getByText('src/search.ts', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Changed files').first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('src/search.ts', { exact: true }).first()).toBeVisible();
});

test('REQ-4-2-3: REQ-4-2-3: Search Code Within a Repository - Scenario 1', async ({ page }) => {
  await openCodePage(page);
  const search = page.getByRole('searchbox', { name: 'Search', exact: true }).first();
  await search.fill(CODE_TERM);
  await search.press('Enter');
  await page.getByRole('link', { name: 'Code', exact: true }).first().click();
  await expect(page.getByText(CODE_TERM).first()).toBeVisible();
  await expect(page.getByRole('link', { name: README, exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: README, exact: true }).first().click();
  await expect(page.getByText(CODE_TERM).first()).toBeVisible();
});

test('REQ-4-2-3#2: REQ-4-2-3: Search Code Within a Repository - Scenario 2', async ({ page }) => {
  await openCodePage(page);
  const search = page.getByRole('searchbox', { name: 'Search', exact: true }).first();
  await search.fill(ABSENT_TERM);
  await search.press('Enter');
  await page.getByRole('link', { name: 'Code', exact: true }).first().click();
  await expect(page.getByText('No code results', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('No code results', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Search', exact: true }).first()).toHaveValue(ABSENT_TERM);
  await openCodePage(page);
  const again = page.getByRole('searchbox', { name: 'Search', exact: true }).first();
  await again.fill(ABSENT_TERM);
  await again.press('Enter');
  await page.getByRole('link', { name: 'Code', exact: true }).first().click();
  await expect(page.getByText('No code results', { exact: true }).first()).toBeVisible();
});

test('REQ-4-2-3#3: REQ-4-2-3: Search Code Within a Repository - Scenario 3', async ({ page }) => {
  await signIn(page);
  await openCodePage(page);
  const search = page.getByRole('searchbox', { name: 'Search', exact: true }).first();
  await search.fill(CODE_TERM);
  await search.press('Enter');
  await page.getByRole('link', { name: 'Code', exact: true }).first().click();
  await expect(page.getByRole('link', { name: README, exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: README, exact: true }).first().click();
  await expect(page.getByText(CODE_TERM).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(CODE_TERM).first()).toBeVisible();
});

test('REQ-4-2-3#4: REQ-4-2-3: Search Code Within a Repository - Scenario 4', async ({ page }) => {
  await signIn(page);
  await openCodePage(page);
  const search = page.getByRole('searchbox', { name: 'Search', exact: true }).first();
  await search.fill(CODE_TERM);
  await search.press('Enter');
  await page.getByRole('link', { name: 'Code', exact: true }).first().click();
  await expect(page.getByRole('link', { name: README, exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: README, exact: true }).first()).toBeVisible();
});

test('REQ-4-3-1: REQ-4-3-1: List and Switch Repository Branches - Scenario 1', async ({ page }) => {
  await openCodePage(page);
  await expect(branchButton(page, 'main')).toBeVisible();
  await branchButton(page, 'main').click();
  const findBranch = page.getByRole('textbox', { name: 'Find branch', exact: true });
  await findBranch.fill('feature-search');
  await page.getByRole('option', { name: 'feature-search', exact: true }).click();
  await expect(branchButton(page, 'feature-search')).toBeVisible();
  await expect(page.getByRole('link', { name: 'main-only.md', exact: true })).toBeVisible();
  await branchButton(page, 'feature-search').click();
  await page.getByRole('option', { name: 'main', exact: true }).click();
  await expect(branchButton(page, 'main')).toBeVisible();
  await expect(page.getByRole('link', { name: 'main-only.md', exact: true })).toHaveCount(0);
});

test('REQ-4-3-1#2: REQ-4-3-1: List and Switch Repository Branches - Scenario 2', async ({ page }) => {
  await openCodePage(page);
  await expect(branchButton(page, 'main')).toBeVisible();
  await branchButton(page, 'main').click();
  const findBranch = page.getByRole('textbox', { name: 'Find branch', exact: true });
  await findBranch.fill(`no-such-branch-${u()}`);
  await expect(page.getByText('No matching branch', { exact: true }).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(branchButton(page, 'main')).toBeVisible();
  await page.reload();
  await expect(branchButton(page, 'main')).toBeVisible();
});

test('REQ-4-3-2: REQ-4-3-2: Create a Branch from an Existing Revision - Scenario 1', async ({ page }) => {
  await signIn(page);
  await openCodePage(page);
  await expect(branchButton(page, 'main')).toBeVisible();
  await branchButton(page, 'main').click();
  const findBranch = page.getByRole('textbox', { name: 'Find branch', exact: true });
  await findBranch.fill('feature/api-v2');
  await page.getByRole('option', { name: 'Create branch: feature/api-v2', exact: true }).click();
  await expect(branchButton(page, 'feature/api-v2')).toBeVisible();
  await page.reload();
  await expect(branchButton(page, 'feature/api-v2')).toBeVisible();
  await branchButton(page, 'feature/api-v2').click();
  await findBranch.fill('invalid..branch');
  await expect(page.getByText('Invalid branch', { exact: true }).first()).toBeVisible();
  await page.keyboard.press('Escape');
});

test('REQ-4-3-2#2: REQ-4-3-2: Create a Branch from an Existing Revision - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openCodePage(page);
  const branch = `pw-branch-${u()}`;
  await branchButton(page, 'main').click();
  await page.getByRole('textbox', { name: 'Find branch', exact: true }).fill(branch);
  await page.getByRole('option', { name: `Create branch: ${branch}`, exact: true }).click();
  await expect(branchButton(page, branch)).toBeVisible();
  await page.reload();
  await expect(branchButton(page, branch)).toBeVisible();
});

test('REQ-4-3-3: REQ-4-3-3: Change the Repository Default Branch - Scenario 1', async ({ page }) => {
  await signIn(page);
  await openCodePage(page);
  await expect(branchButton(page, 'main')).toBeVisible();
  await page.getByRole('link', { name: 'Settings', exact: true }).first().click();
  await page.getByRole('link', { name: 'Branches', exact: true }).first().click();
  const defaultBranch = page.getByRole('combobox', { name: 'Default branch', exact: true });
  await expect(defaultBranch).toBeVisible();
  await defaultBranch.selectOption({ label: 'release' });
  await page.getByRole('button', { name: 'Update', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await openCodePage(page);
  await expect(branchButton(page, 'release')).toBeVisible();
  await page.reload();
  await expect(branchButton(page, 'release')).toBeVisible();
  await branchButton(page, 'release').click();
  await expect(page.getByRole('option', { name: 'main', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  // restore the seeded default branch for the following tests
  await page.getByRole('link', { name: 'Settings', exact: true }).first().click();
  await page.getByRole('link', { name: 'Branches', exact: true }).first().click();
  await page.getByRole('combobox', { name: 'Default branch', exact: true }).selectOption({ label: 'main' });
  await page.getByRole('button', { name: 'Update', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await openCodePage(page);
  await expect(branchButton(page, 'main')).toBeVisible();
});

test('REQ-4-3-3#2: REQ-4-3-3: Change the Repository Default Branch - Scenario 2', async ({ page }) => {
  await registerAndSignIn(page);
  await openCodePage(page);
  const settings = page.getByRole('link', { name: 'Settings', exact: true });
  if (await settings.first().isVisible()) {
    await settings.first().click();
    const branches = page.getByRole('link', { name: 'Branches', exact: true });
    if (await branches.first().isVisible()) {
      await branches.first().click();
    }
  }
  await expect(page.getByRole('combobox', { name: 'Default branch', exact: true })).toHaveCount(0);
  await openCodePage(page);
  await expect(branchButton(page, 'main')).toBeVisible();
});

test('REQ-4-4: REQ-4-4: Manage Repository Files Through the Web Interface - Scenario 1', async ({ page }) => {
  await signIn(page);
  await openCodePage(page);
  const path = `docs/guide-${u()}.md`;
  const content = `guide content ${u()}`;
  const message = `Add ${path}`;
  await openNewFileEditor(page);
  await page.getByLabel('File name', { exact: true }).fill(path);
  await page.getByLabel('File contents', { exact: true }).fill(content);
  await page.getByLabel('Commit message', { exact: true }).fill(message);
  await page.getByRole('button', { name: 'Commit changes', exact: true }).click();
  await expect(page.getByText(content, { exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Commits' }).first().click();
  await expect(page.getByText(message, { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(message, { exact: true }).first()).toBeVisible();
  await openCodePage(page);
  await openNewFileEditor(page);
  await page.getByLabel('File name', { exact: true }).fill('../invalid.md');
  await page.getByLabel('File contents', { exact: true }).fill('must not be saved');
  await page.getByRole('button', { name: 'Commit changes', exact: true }).click();
  await expect(
    page
      .getByText('Invalid file path', { exact: true })
      .or(page.getByText('Commit message is required', { exact: true }))
      .first()
  ).toBeVisible();
});

test('REQ-4-4#2: REQ-4-4: Manage Repository Files Through the Web Interface - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openCodePage(page);
  const path = `docs/note-${u()}.md`;
  const content = `note content ${u()}`;
  await openNewFileEditor(page);
  await page.getByLabel('File name', { exact: true }).fill(path);
  await page.getByLabel('File contents', { exact: true }).fill(content);
  await page.getByLabel('Commit message', { exact: true }).fill(`Add ${path}`);
  await page.getByRole('button', { name: 'Commit changes', exact: true }).click();
  await expect(page.getByText(content, { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(content, { exact: true }).first()).toBeVisible();
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

