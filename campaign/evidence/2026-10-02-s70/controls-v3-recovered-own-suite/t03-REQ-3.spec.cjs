const { test, expect } = require('@playwright/test');

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const EMAIL = 'alice.dev@example.test';
const PASSWORD = 'Valid-password-123!';

const headingWith = (page, text) =>
  page.getByRole('heading', { name: new RegExp(esc(text)) }).first();

async function signIn(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
}

async function searchFor(page, query) {
  await page.goto('/');
  const box = page.getByRole('searchbox', { name: 'Search', exact: true });
  await box.fill(query);
  await box.press('Enter');
  return page.getByRole('searchbox', { name: 'Search', exact: true });
}

async function openRepositoryByName(page, name) {
  await searchFor(page, name);
  await page.getByRole('link', { name, exact: true }).first().click();
  await expect(headingWith(page, name)).toBeVisible();
}

async function startNewRepository(page) {
  const link = page.getByRole('link', { name: 'New repository', exact: true });
  if ((await link.count()) === 0) {
    await page.goto('/');
  }
  await link.first().click();
}

async function signOut(page) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm sign out', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
}

/* ------------------------------------------------------------------ */
/* REQ-3-1  Search for and Locate Repositories                         */
/* ------------------------------------------------------------------ */

test('REQ-3-1: REQ-3-1: Search for and Locate Repositories - Scenario 1', async ({ page }) => {
  await page.goto('/');
  const box = page.getByRole('searchbox', { name: 'Search', exact: true });
  await box.fill('acme-docs');
  await box.press('Enter');

  await page.getByRole('link', { name: 'Repositories', exact: true }).click();
  await expect(page.getByRole('link', { name: 'acme-docs', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'secret-research', exact: true })).toHaveCount(0);

  await page.getByRole('link', { name: 'acme-docs', exact: true }).first().click();
  await expect(headingWith(page, 'acme-docs')).toBeVisible();
  await page.reload();
  await expect(headingWith(page, 'acme-docs')).toBeVisible();

  // clearing / replacing the term does not retain the old results
  await page.goto('/');
  const other = page.getByRole('searchbox', { name: 'Search', exact: true });
  await other.fill(`no-such-repo-${u()}`);
  await other.press('Enter');
  await expect(page.getByText('No results', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'acme-docs', exact: true })).toHaveCount(0);

  // the unauthorized private repository is never exposed
  await page.goto('/');
  const priv = page.getByRole('searchbox', { name: 'Search', exact: true });
  await priv.fill('secret-research');
  await priv.press('Enter');
  await expect(page.getByRole('link', { name: 'secret-research', exact: true })).toHaveCount(0);
});

test('REQ-3-1#2: REQ-3-1: Search for and Locate Repositories - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openRepositoryByName(page, 'acme-docs');
  await page.reload();
  await expect(headingWith(page, 'acme-docs')).toBeVisible();
});

test('REQ-3-1#3: REQ-3-1: Search for and Locate Repositories - Scenario 3', async ({ page }) => {
  await signIn(page);

  const box = page.getByRole('searchbox', { name: 'Search', exact: true });
  await box.fill('acme-docs');
  await box.press('Enter');
  await expect(page.getByRole('link', { name: 'acme-docs', exact: true }).first()).toBeVisible();

  await box.fill(`nothing-here-${u()}`);
  await box.press('Enter');
  await expect(page.getByRole('link', { name: 'acme-docs', exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('link', { name: 'acme-docs', exact: true })).toHaveCount(0);
});

test('REQ-3-1#4: REQ-3-1: Search for and Locate Repositories - Scenario 4', async ({ page }) => {
  await signIn(page);
  const query = `no-code-token-${u()}`;

  const box = page.getByRole('searchbox', { name: 'Search', exact: true });
  await box.fill(query);
  await box.press('Enter');
  await expect(page.getByText('No results', { exact: true }).first()).toBeVisible();

  // return home and repeat the same query
  await page.goto('/');
  const again = page.getByRole('searchbox', { name: 'Search', exact: true });
  await again.fill(query);
  await again.press('Enter');
  await expect(page.getByText('No results', { exact: true }).first()).toBeVisible();
});

/* ------------------------------------------------------------------ */
/* REQ-3-2-1  Create a Repository                                      */
/* ------------------------------------------------------------------ */

test('REQ-3-2-1: REQ-3-2-1: Create a Repository with Owner, Visibility, and Initialization Options - Scenario 1', async ({ page }) => {
  await signIn(page);
  const name = `pw-repo-${u()}`;

  await startNewRepository(page);
  await page.getByLabel('Repository name', { exact: true }).fill(name);
  await page.getByLabel('Description', { exact: true }).fill('Repository created by Playwright');
  await page.getByRole('radio', { name: 'Private', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Add a README file', exact: true }).check();
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();

  await expect(headingWith(page, name)).toBeVisible();
  await expect(page.getByText('Private', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /README/ }).first()).toBeVisible();

  await page.reload();
  await expect(headingWith(page, name)).toBeVisible();
  await expect(page.getByText('Private', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /README/ }).first()).toBeVisible();

  // duplicate name stays on the form and does not open the existing repository
  await page.goto('/');
  await startNewRepository(page);
  await page.getByLabel('Repository name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Create repository', exact: true })).toBeVisible();

  // empty name stays on the form as well
  await page.getByLabel('Repository name', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Create repository', exact: true })).toBeVisible();
});

test('REQ-3-2-1#2: REQ-3-2-1: Create a Repository with Owner, Visibility, and Initialization Options - Scenario 2', async ({ page }) => {
  await signIn(page);
  const name = `pw-pub-${u()}`;

  await startNewRepository(page);
  await page.getByLabel('Repository name', { exact: true }).fill(name);
  await page.getByRole('radio', { name: 'Public', exact: true }).check();
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();

  await expect(headingWith(page, name)).toBeVisible();
  await expect(page.getByText('Public', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(headingWith(page, name)).toBeVisible();
  await expect(page.getByText('Public', { exact: true }).first()).toBeVisible();
});

test('REQ-3-2-1#3: REQ-3-2-1: Create a Repository with Owner, Visibility, and Initialization Options - Scenario 3', async ({ page }) => {
  await signIn(page);
  await startNewRepository(page);

  await expect(page.getByLabel('Owner', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Repository name', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Description', { exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Public', exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Private', exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Add a README file', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create repository', exact: true })).toBeVisible();

  const name = `pw-form-${u()}`;
  await page.getByLabel('Repository name', { exact: true }).fill(name);
  await page.getByRole('radio', { name: 'Private', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Add a README file', exact: true }).check();
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();

  await expect(headingWith(page, name)).toBeVisible();
  await expect(page.getByText('Private', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(headingWith(page, name)).toBeVisible();
});

/* ------------------------------------------------------------------ */
/* REQ-3-2-2  Fork a Repository                                        */
/* ------------------------------------------------------------------ */

test('REQ-3-2-2: REQ-3-2-2: Fork a Repository into Another Namespace - Scenario 1', async ({ page }) => {
  await signIn(page);
  await openRepositoryByName(page, 'acme-docs');

  const fork = `pw-fork-${u()}`;
  await page.getByRole('button', { name: 'Fork', exact: true }).click();
  await page.getByLabel('Repository name', { exact: true }).fill(fork);
  await page.getByRole('button', { name: 'Create fork', exact: true }).click();

  await expect(headingWith(page, fork)).toBeVisible();
  await expect(page.getByText(/Forked from .*acme-docs/).first()).toBeVisible();

  await page.reload();
  await expect(headingWith(page, fork)).toBeVisible();
  await expect(page.getByText(/Forked from .*acme-docs/).first()).toBeVisible();
});

test('REQ-3-2-2#2: REQ-3-2-2: Fork a Repository into Another Namespace - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openRepositoryByName(page, 'acme-docs');

  await page.getByRole('button', { name: 'Fork', exact: true }).click();
  await page.getByLabel('Repository name', { exact: true }).fill('acme-docs-fork');
  await page.getByRole('button', { name: 'Create fork', exact: true }).click();

  // the conflicting name creates no fork: the fork form is still the active view
  await expect(page.getByRole('button', { name: 'Create fork', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Create fork', exact: true })).toBeVisible();
});

/* ------------------------------------------------------------------ */
/* REQ-3-2-3  Copy a Repository Clone Value                            */
/* ------------------------------------------------------------------ */

test('REQ-3-2-3: REQ-3-2-3: Copy a Repository Clone Value - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await openRepositoryByName(page, 'acme-docs');

  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await page.getByRole('tab', { name: 'HTTPS', exact: true }).click();
  await page.getByRole('button', { name: 'Copy clone value', exact: true }).click();
  await expect(page.getByText('Copied', { exact: true }).first()).toBeVisible();
  await expect(headingWith(page, 'acme-docs')).toBeVisible();

  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'HTTPS', exact: true })).toBeVisible();
  await expect(headingWith(page, 'acme-docs')).toBeVisible();
});

test('REQ-3-2-3#2: REQ-3-2-3: Copy a Repository Clone Value - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openRepositoryByName(page, 'acme-docs');

  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await page.getByRole('tab', { name: 'SSH', exact: true }).click();
  await page.getByRole('button', { name: 'Copy clone value', exact: true }).click();
  await expect(page.getByText('Copied', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(headingWith(page, 'acme-docs')).toBeVisible();
  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'SSH', exact: true })).toBeVisible();
});

/* ------------------------------------------------------------------ */
/* REQ-3-3  View a Public Repository Overview                          */
/* ------------------------------------------------------------------ */

test('REQ-3-3: REQ-3-3: View a Public Repository Overview - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await openRepositoryByName(page, 'acme-docs');

  await expect(page.getByText('Public', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Code', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Issues', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Pull requests', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'README.md', exact: true }).first().click();
  await expect(page.getByText('README.md', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('README.md', { exact: true }).first()).toBeVisible();

  // an unauthorized private repository is not exposed through search
  await page.goto('/');
  const box = page.getByRole('searchbox', { name: 'Search', exact: true });
  await box.fill('secret-research');
  await box.press('Enter');
  await expect(page.getByRole('link', { name: 'secret-research', exact: true })).toHaveCount(0);
});

/* ------------------------------------------------------------------ */
/* REQ-3-4  Change Repository Visibility                               */
/* ------------------------------------------------------------------ */

test('REQ-3-4: REQ-3-4: Change Repository Visibility with Permission Checks - Scenario 1', async ({ page }) => {
  await signIn(page);
  const name = `pw-vis-${u()}`;

  await startNewRepository(page);
  await page.getByLabel('Repository name', { exact: true }).fill(name);
  await page.getByLabel('Description', { exact: true }).fill('Repository created by Playwright');
  await page.getByRole('radio', { name: 'Private', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Add a README file', exact: true }).check();
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();
  await expect(headingWith(page, name)).toBeVisible();
  await expect(page.getByText('Private', { exact: true }).first()).toBeVisible();

  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'General', exact: true }).click();
  await page.getByRole('button', { name: 'Change visibility', exact: true }).click();

  const dialog = page.getByRole('dialog');
  const scope = (await dialog.count()) > 0 ? dialog : page;
  await scope.getByRole('radio', { name: 'Public', exact: true }).first().check();
  const nameBox = scope.getByRole('textbox');
  if ((await nameBox.count()) > 0) {
    await nameBox.first().fill(name);
  }
  await scope.getByRole('button', { name: 'Confirm visibility', exact: true }).click();

  await openRepositoryByName(page, name);
  await expect(page.getByText('Public', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('Public', { exact: true }).first()).toBeVisible();

  // an unauthenticated visitor now finds and reaches the repository
  await signOut(page);
  await page.goto('/');
  const box = page.getByRole('searchbox', { name: 'Search', exact: true });
  await box.fill(name);
  await box.press('Enter');
  await expect(page.getByRole('link', { name, exact: true }).first()).toBeVisible();
});

test('REQ-3-4#2: REQ-3-4: Change Repository Visibility with Permission Checks - Scenario 2', async ({ page }) => {
  await signIn(page);
  const name = `pw-vis2-${u()}`;

  await startNewRepository(page);
  await page.getByLabel('Repository name', { exact: true }).fill(name);
  await page.getByRole('radio', { name: 'Private', exact: true }).check();
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();

  await expect(headingWith(page, name)).toBeVisible();
  await expect(page.getByText('Private', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(headingWith(page, name)).toBeVisible();
  await expect(page.getByText('Private', { exact: true }).first()).toBeVisible();

  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'General', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Change visibility', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Change visibility', exact: true })).toBeVisible();
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

