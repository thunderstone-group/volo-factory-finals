const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const SEED_USER = 'alice-dev';
const SEED_PASSWORD = 'Valid-password-123!';

async function signIn(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(SEED_USER);
  await page.getByLabel('Password', { exact: true }).fill(SEED_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
}

async function globalSearch(page, query) {
  const box = page.getByRole('searchbox', { name: 'Search', exact: true });
  await box.fill(query);
  await box.press('Enter');
}

async function searchAndOpenRepository(page, name) {
  await globalSearch(page, name);
  await page.getByRole('link', { name, exact: true }).click();
  await expect(page.getByRole('heading', { name: new RegExp(name) }).first()).toBeVisible();
}

async function createRepository(page, { name, description, visibility, readme }) {
  await page.goto('/');
  await page.getByRole('link', { name: 'New repository', exact: true }).click();
  await page.getByLabel('Repository name', { exact: true }).fill(name);
  if (description) {
    await page.getByLabel('Description', { exact: true }).fill(description);
  }
  await page.getByRole('radio', { name: visibility, exact: true }).check();
  if (readme) {
    await page.getByRole('checkbox', { name: 'Add a README file', exact: true }).check();
  }
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();
  await expect(page.getByRole('heading', { name: new RegExp(name) }).first()).toBeVisible();
}

test('REQ-3-1: Search for and Locate Repositories - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await globalSearch(page, 'acme-docs');
  await page.getByRole('link', { name: 'Repositories', exact: true }).first().click();

  const publicResult = page.getByRole('link', { name: 'acme-docs', exact: true });
  await expect(publicResult).toBeVisible();
  await expect(page.getByRole('link', { name: 'secret-research', exact: true })).toHaveCount(0);

  await publicResult.click();
  await expect(page.getByRole('heading', { name: /acme-docs/ }).first()).toBeVisible();
  await expect(page.getByText('Public', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: /acme-docs/ }).first()).toBeVisible();

  // A new query must not retain the previous results and must never expose the
  // unauthorized private repository to a visitor.
  await page.goto('/');
  await globalSearch(page, 'secret-research');
  await expect(page.getByRole('link', { name: 'acme-docs', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'secret-research', exact: true })).toHaveCount(0);
  await expect(page.getByText('No results', { exact: true })).toBeVisible();
});

test('REQ-3-1: Search for and Locate Repositories - Scenario 2', async ({ page }) => {
  await signIn(page);
  await searchAndOpenRepository(page, 'acme-docs');
  await expect(page.getByText('Public', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: /acme-docs/ }).first()).toBeVisible();
  await expect(page.getByText('Public', { exact: true }).first()).toBeVisible();
});

test('REQ-3-1: Search for and Locate Repositories - Scenario 3', async ({ page }) => {
  await signIn(page);
  await globalSearch(page, 'acme-docs');
  const result = page.getByRole('link', { name: 'acme-docs', exact: true });
  await expect(result).toBeVisible();
  await result.click();
  await expect(page.getByRole('heading', { name: /acme-docs/ }).first()).toBeVisible();

  // returning home and repeating the same query shows the same repository again
  await page.goto('/');
  await globalSearch(page, 'acme-docs');
  await expect(page.getByRole('link', { name: 'acme-docs', exact: true })).toBeVisible();
});

test('REQ-3-1: Search for and Locate Repositories - Scenario 4', async ({ page }) => {
  await signIn(page);
  const query = `no-match-${u()}`;

  await globalSearch(page, query);
  await expect(page.getByText('No results', { exact: true })).toBeVisible();

  await page.goto('/');
  await globalSearch(page, query);
  await expect(page.getByText('No results', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'acme-docs', exact: true })).toHaveCount(0);
});

test('REQ-3-2-1: Create a Repository with Owner, Visibility, and Initialization Options - Scenario 1', async ({ page }) => {
  await signIn(page);
  const name = `pw-repo-${u()}`;

  await createRepository(page, {
    name,
    description: 'Repository created by Playwright',
    visibility: 'Private',
    readme: true,
  });
  await expect(page.getByText('Private', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'README.md', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: new RegExp(name) }).first()).toBeVisible();
  await expect(page.getByText('Private', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'README.md', exact: true })).toBeVisible();

  // duplicate name for the same namespace: stays on the form
  await page.goto('/');
  await page.getByRole('link', { name: 'New repository', exact: true }).click();
  await page.getByLabel('Repository name', { exact: true }).fill(name);
  await page.getByRole('radio', { name: 'Private', exact: true }).check();
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Create repository', exact: true })).toBeVisible();
});

test('REQ-3-2-1: Create a Repository with Owner, Visibility, and Initialization Options - Scenario 2', async ({ page }) => {
  await signIn(page);
  const name = `pw-pub-${u()}`;

  await createRepository(page, {
    name,
    description: 'Public repository created by Playwright',
    visibility: 'Public',
    readme: true,
  });
  await expect(page.getByText('Public', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'README.md', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: new RegExp(name) }).first()).toBeVisible();
  await expect(page.getByText('Public', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'README.md', exact: true })).toBeVisible();
});

test('REQ-3-2-1: Create a Repository with Owner, Visibility, and Initialization Options - Scenario 3', async ({ page }) => {
  await signIn(page);
  const name = `pw-plain-${u()}`;

  await createRepository(page, {
    name,
    description: 'Repository without initialization',
    visibility: 'Private',
    readme: false,
  });
  await expect(page.getByText('Private', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: new RegExp(name) }).first()).toBeVisible();
  await expect(page.getByText('Private', { exact: true }).first()).toBeVisible();
});

test('REQ-3-2-2: Fork a Repository into Another Namespace - Scenario 1', async ({ page }) => {
  await signIn(page);
  const forkName = `acme-docs-fork-${u()}`;

  await searchAndOpenRepository(page, 'acme-docs');
  await page.getByRole('button', { name: 'Fork', exact: true }).click();
  await page.getByLabel('Repository name', { exact: true }).fill(forkName);
  await page.getByRole('button', { name: 'Create fork', exact: true }).click();

  await expect(page.getByRole('heading', { name: new RegExp(forkName) }).first()).toBeVisible();
  await expect(page.getByText(/Forked from/).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'README.md', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: new RegExp(forkName) }).first()).toBeVisible();
  await expect(page.getByText(/Forked from/).first()).toBeVisible();

  // conflicting name in the target namespace: no fork is created
  await searchAndOpenRepository(page, 'acme-docs');
  await page.getByRole('button', { name: 'Fork', exact: true }).click();
  await page.getByLabel('Repository name', { exact: true }).fill(forkName);
  await page.getByRole('button', { name: 'Create fork', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Create fork', exact: true })).toBeVisible();
});

test('REQ-3-2-2: Fork a Repository into Another Namespace - Scenario 2', async ({ page }) => {
  await signIn(page);
  const forkName = `pw-fork-${u()}`;

  await searchAndOpenRepository(page, 'acme-docs');
  await page.getByRole('button', { name: 'Fork', exact: true }).click();
  await page.getByLabel('Repository name', { exact: true }).fill(forkName);
  await page.getByRole('button', { name: 'Create fork', exact: true }).click();

  await expect(page.getByRole('heading', { name: new RegExp(forkName) }).first()).toBeVisible();
  await expect(page.getByText(/Forked from/).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: new RegExp(forkName) }).first()).toBeVisible();
  await expect(page.getByText(/Forked from/).first()).toBeVisible();
});

test('REQ-3-2-3: Copy a Repository Clone Value - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await searchAndOpenRepository(page, 'acme-docs');

  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await page.getByRole('tab', { name: 'HTTPS', exact: true }).click();
  await page.getByRole('button', { name: 'Copy clone value', exact: true }).click();
  await expect(page.getByText('Copied', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /acme-docs/ }).first()).toBeVisible();

  await page.getByRole('tab', { name: 'SSH', exact: true }).click();
  await page.getByRole('button', { name: 'Copy clone value', exact: true }).click();
  await expect(page.getByText('Copied', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /acme-docs/ }).first()).toBeVisible();

  // closing and reopening the popover keeps the selected protocol and the heading
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'SSH', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /acme-docs/ }).first()).toBeVisible();
});

test('REQ-3-2-3: Copy a Repository Clone Value - Scenario 2', async ({ page }) => {
  await signIn(page);
  await searchAndOpenRepository(page, 'acme-docs');

  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await page.getByRole('tab', { name: 'HTTPS', exact: true }).click();
  await page.getByRole('button', { name: 'Copy clone value', exact: true }).click();
  await expect(page.getByText('Copied', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /acme-docs/ }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: /acme-docs/ }).first()).toBeVisible();
});

test('REQ-3-3: View a Public Repository Overview - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await searchAndOpenRepository(page, 'acme-docs');

  await expect(page.getByRole('heading', { name: /acme-docs/ }).first()).toBeVisible();
  await expect(page.getByText('Public', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'README.md', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Code', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Issues', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Pull requests', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: /acme-docs/ }).first()).toBeVisible();
  await expect(page.getByText('Public', { exact: true }).first()).toBeVisible();

  // the file list opens a file-content page
  await page.getByRole('link', { name: 'README.md', exact: true }).click();
  await expect(page.getByText('README.md', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('README.md', { exact: true }).first()).toBeVisible();

  // the private repository is not exposed to a visitor
  await page.goto('/');
  await globalSearch(page, 'secret-research');
  await expect(page.getByRole('link', { name: 'secret-research', exact: true })).toHaveCount(0);
  await expect(page.getByText('No results', { exact: true })).toBeVisible();
});

test('REQ-3-4: Change Repository Visibility with Permission Checks - Scenario 1', async ({ page, browser }) => {
  await signIn(page);
  const name = `pw-vis-${u()}`;

  await createRepository(page, {
    name,
    description: 'Ready for public display',
    visibility: 'Private',
    readme: true,
  });
  const repoUrl = page.url();
  await expect(page.getByText('Private', { exact: true }).first()).toBeVisible();

  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'General', exact: true }).click();
  await page.getByRole('button', { name: 'Change visibility', exact: true }).click();
  await page.getByRole('radio', { name: 'Public', exact: true }).check();
  await page.getByRole('button', { name: 'Confirm visibility', exact: true }).click();

  await page.goto(repoUrl);
  await expect(page.getByText('Public', { exact: true }).first()).toBeVisible();

  // an unauthenticated visitor can now open the same address
  const visitorContext = await browser.newContext();
  const visitor = await visitorContext.newPage();
  await visitor.goto(repoUrl);
  await expect(visitor.getByRole('heading', { name: new RegExp(name) }).first()).toBeVisible();
  await visitorContext.close();

  await page.reload();
  await expect(page.getByText('Public', { exact: true }).first()).toBeVisible();
});

test('REQ-3-4: Change Repository Visibility with Permission Checks - Scenario 2', async ({ page }) => {
  await signIn(page);
  const name = `pw-vis2-${u()}`;

  await createRepository(page, {
    name,
    description: 'Second visibility scenario',
    visibility: 'Private',
    readme: true,
  });
  const repoUrl = page.url();
  await expect(page.getByText('Private', { exact: true }).first()).toBeVisible();

  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'General', exact: true }).click();
  await page.getByRole('button', { name: 'Change visibility', exact: true }).click();
  await page.getByRole('radio', { name: 'Public', exact: true }).check();
  await page.getByRole('button', { name: 'Confirm visibility', exact: true }).click();

  await page.goto(repoUrl);
  await page.reload();
  await expect(page.getByRole('heading', { name: new RegExp(name) }).first()).toBeVisible();
  await expect(page.getByText('Public', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'README.md', exact: true })).toBeVisible();
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

