const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const SEED_PASSWORD = 'Valid-password-123!';

async function signIn(page, username = 'alice-dev', password = SEED_PASSWORD) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
}

async function registerUser(page) {
  const username = `pw-user-${u()}`;
  const email = `${username}@example.test`;
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(SEED_PASSWORD);
  await page.getByLabel('Confirm password', { exact: true }).fill(SEED_PASSWORD);
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(SEED_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
  return username;
}

async function openRepository(page, name = 'acme-docs') {
  await page.goto('/');
  const search = page.getByRole('searchbox', { name: 'Search', exact: true });
  await search.fill(name);
  await search.press('Enter');
  await page.getByRole('link', { name, exact: true }).first().click();
  await expect(page.getByRole('heading', { name: new RegExp(name) }).first()).toBeVisible();
}

async function createRepository(page, name) {
  await page.getByRole('link', { name: 'New repository', exact: true }).first().click();
  await page.getByLabel('Repository name', { exact: true }).fill(name);
  await page.getByRole('radio', { name: 'Public', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Add a README file', exact: true }).check();
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();
  await expect(page.getByRole('heading', { name: new RegExp(name) }).first()).toBeVisible();
}

async function createBranch(page, branchName) {
  await page.getByRole('button', { name: 'Branch main', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find branch', exact: true }).fill(branchName);
  await page.getByRole('option', { name: `Create branch: ${branchName}`, exact: true }).click();
  await expect(page.getByRole('button', { name: `Branch ${branchName}`, exact: true })).toBeVisible();
}

async function addFile(page, fileName, content, message) {
  await page.getByRole('button', { name: 'Add file', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Create new file', exact: true }).click();
  await page.getByLabel('File name', { exact: true }).fill(fileName);
  await page.getByLabel('File contents', { exact: true }).fill(content);
  await page.getByLabel('Commit message', { exact: true }).fill(message);
  await page.getByRole('button', { name: 'Commit changes', exact: true }).click();
  await expect(page.getByText(content, { exact: true })).toBeVisible();
}

async function searchCode(page, query) {
  const search = page.getByRole('searchbox', { name: 'Search', exact: true });
  await search.fill(query);
  await search.press('Enter');
  await page.getByRole('link', { name: 'Code', exact: true }).first().click();
}

test('REQ-4-1: Browse Repository Files and Directories - Scenario 1', async ({ page }) => {
  await signIn(page);
  const repo = `pw-browse-${u()}`;
  await createRepository(page, repo);
  const content = `Browse content ${u()}`;
  await addFile(page, 'docs/guide.md', content, 'Add docs/guide.md');

  await page.getByRole('link', { name: 'Code', exact: true }).first().click();
  await page.getByRole('link', { name: 'docs', exact: true }).click();
  await page.getByRole('link', { name: 'guide.md', exact: true }).click();
  await expect(page.getByText(content, { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText(content, { exact: true })).toBeVisible();
});

test('REQ-4-2-1: View Repository Commit History - Scenario 1', async ({ page }) => {
  await openRepository(page, 'acme-docs');
  await page.getByRole('link', { name: /Commits/i }).first().click();
  await expect(page.getByText('Document search flow', { exact: true })).toBeVisible();
  await expect(page.getByText('alice-dev', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/ago/).first()).toBeVisible();

  await page.getByRole('link', { name: 'Code', exact: true }).first().click();
  await page.getByRole('link', { name: 'README.md', exact: true }).click();
  await page.getByRole('link', { name: /Commits/i }).first().click();
  await expect(page.getByText('Document search flow', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText('Document search flow', { exact: true })).toBeVisible();
});

test('REQ-4-2-2: Inspect Commit and Revision Differences - Scenario 1', async ({ page }) => {
  await openRepository(page, 'acme-docs');
  await page.getByRole('link', { name: /Commits/i }).first().click();
  await page.getByRole('link', { name: /Document search flow/ }).first().click();

  await expect(page.getByText('src/search.ts', { exact: true })).toBeVisible();
  await expect(page.getByText(/Changed files/i)).toBeVisible();
  await expect(page.getByText(/additions|deletions/i).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('src/search.ts', { exact: true })).toBeVisible();
});

test('REQ-4-2-3: Search Code Within a Repository - Scenario 1', async ({ page }) => {
  await openRepository(page, 'acme-docs');
  await searchCode(page, 'search flow');

  await expect(page.getByRole('link', { name: 'README.md', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'search.ts', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'search.ts', exact: true }).click();
  await expect(page.getByText('search flow', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('search flow', { exact: true }).first()).toBeVisible();
});

test('REQ-4-2-3: Search Code Within a Repository - Scenario 2', async ({ page }) => {
  await openRepository(page, 'acme-docs');
  await searchCode(page, 'no-such-token');

  await expect(page.getByText('No code results', { exact: true })).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Search', exact: true })).toHaveValue('no-such-token');

  await page.reload();
  await expect(page.getByText('No code results', { exact: true })).toBeVisible();

  await openRepository(page, 'acme-docs');
  await searchCode(page, 'no-such-token');
  await expect(page.getByText('No code results', { exact: true })).toBeVisible();
});

test('REQ-4-2-3: Search Code Within a Repository - Scenario 3', async ({ page }) => {
  await signIn(page);
  await openRepository(page, 'acme-docs');
  await searchCode(page, 'search flow');

  await page.getByRole('link', { name: 'README.md', exact: true }).click();
  await expect(page.getByText('search flow', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText('search flow', { exact: true })).toBeVisible();
});

test('REQ-4-2-3: Search Code Within a Repository - Scenario 4', async ({ page }) => {
  await signIn(page);
  await openRepository(page, 'acme-docs');
  await searchCode(page, 'no-such-token');

  await expect(page.getByText('No code results', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText('No code results', { exact: true })).toBeVisible();
});

test('REQ-4-3-1: List and Switch Repository Branches - Scenario 1', async ({ page }) => {
  await openRepository(page, 'acme-docs');

  await page.getByRole('button', { name: 'Branch main', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find branch', exact: true }).fill('feature-search');
  await page.getByRole('option', { name: 'feature-search', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Branch feature-search', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'main-only.md', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Branch feature-search', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find branch', exact: true }).fill('main');
  await page.getByRole('option', { name: 'main', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'main-only.md', exact: true })).toHaveCount(0);
});

test('REQ-4-3-1: List and Switch Repository Branches - Scenario 2', async ({ page }) => {
  await openRepository(page, 'acme-docs');

  await page.getByRole('button', { name: 'Branch main', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find branch', exact: true }).fill('zzz-no-match');
  await expect(page.getByText('No matching branch', { exact: true })).toBeVisible();

  await page.getByRole('textbox', { name: 'Find branch', exact: true }).press('Escape');
  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();
});

test('REQ-4-3-2: Create a Branch from an Existing Revision - Scenario 1', async ({ page }) => {
  await signIn(page);
  await openRepository(page, 'acme-docs');
  const branch = `pw-branch-${u()}`;

  await page.getByRole('button', { name: 'Branch main', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find branch', exact: true }).fill(branch);
  await page.getByRole('option', { name: `Create branch: ${branch}`, exact: true }).click();

  await expect(page.getByRole('button', { name: `Branch ${branch}`, exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: `Branch ${branch}`, exact: true })).toBeVisible();

  await page.getByRole('button', { name: `Branch ${branch}`, exact: true }).click();
  await page.getByRole('textbox', { name: 'Find branch', exact: true }).fill('invalid..branch');
  await expect(page.getByText('Invalid branch', { exact: true })).toBeVisible();
});

test('REQ-4-3-2: Create a Branch from an Existing Revision - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openRepository(page, 'acme-docs');
  const branch = `pw-branch-${u()}`;

  await page.getByRole('button', { name: 'Branch main', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find branch', exact: true }).fill(branch);
  await page.getByRole('option', { name: `Create branch: ${branch}`, exact: true }).click();

  await expect(page.getByRole('button', { name: `Branch ${branch}`, exact: true })).toBeVisible();
});

test('REQ-4-3-3: Change the Repository Default Branch - Scenario 1', async ({ page }) => {
  await signIn(page);
  const repo = `pw-default-${u()}`;
  await createRepository(page, repo);
  await createBranch(page, 'release');

  await page.getByRole('link', { name: 'Settings', exact: true }).first().click();
  await page.getByRole('link', { name: 'Branches', exact: true }).first().click();
  await page.getByLabel('Default branch', { exact: true }).selectOption('release');
  await page.getByRole('button', { name: 'Update', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();

  await page.getByRole('link', { name: 'Code', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Branch release', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Branch release', exact: true }).click();
  await expect(page.getByRole('option', { name: 'main', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Find branch', exact: true }).press('Escape');

  await page.reload();
  await expect(page.getByRole('button', { name: 'Branch release', exact: true })).toBeVisible();
});

test('REQ-4-3-3: Change the Repository Default Branch - Scenario 2', async ({ page }) => {
  await registerUser(page);
  await openRepository(page, 'acme-docs');

  const settings = page.getByRole('link', { name: 'Settings', exact: true });
  if (await settings.count()) {
    await settings.first().click();
    const branches = page.getByRole('link', { name: 'Branches', exact: true });
    if (await branches.count()) {
      await branches.first().click();
    }
  }

  await expect(page.getByLabel('Default branch', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Update', exact: true })).toHaveCount(0);

  await page.getByRole('link', { name: 'Code', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();
});

test('REQ-4-4: Manage Repository Files Through the Web Interface - Scenario 1', async ({ page }) => {
  await signIn(page);
  await openRepository(page, 'acme-docs');
  const file = `pw-file-${u()}.md`;
  const content = `Unique file content ${u()}`;
  const message = `Add ${file}`;

  await addFile(page, file, content, message);

  await page.getByRole('link', { name: /Commits/i }).first().click();
  await expect(page.getByText(message, { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText(message, { exact: true })).toBeVisible();
});

test('REQ-4-4: Manage Repository Files Through the Web Interface - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openRepository(page, 'acme-docs');
  const file = `pw-file-${u()}.md`;
  const content = `Another file content ${u()}`;
  const message = `Add ${file}`;

  await addFile(page, file, content, message);

  await expect(page.getByText(content, { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText(content, { exact: true })).toBeVisible();
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

