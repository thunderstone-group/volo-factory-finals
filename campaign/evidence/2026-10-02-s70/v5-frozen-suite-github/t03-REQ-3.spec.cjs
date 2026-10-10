const { test, expect } = require('@playwright/test');

const PASSWORD = 'Valid-password-123!';
const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Sign in from the home page through the documented account-access flow.
async function signIn(page, username) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).first().click();
  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  await expect(page.getByText(username, { exact: true }).first()).toBeVisible();
}

// Enter a query in the top global search control from the home page and press Enter.
async function searchFromHome(page, query) {
  await page.goto('/');
  const box = page.getByRole('searchbox', { name: 'Search', exact: true }).first();
  await expect(box).toBeVisible();
  await box.fill(query);
  await box.press('Enter');
}

// Locate a repository through its result link and confirm its overview heading.
async function openRepositoryViaSearch(page, name) {
  await searchFromHome(page, name);
  const result = page.getByRole('link', { name, exact: true }).first();
  await expect(result).toBeVisible();
  await result.click();
  await expect(
    page.getByRole('heading', { name: new RegExp(esc(name)) }).first()
  ).toBeVisible();
}

test('REQ-3-1: REQ-3-1: Search for and Locate Repositories - Scenario 1', async ({ page }) => {
  await page.goto('/');

  const search = page.getByRole('searchbox', { name: 'Search', exact: true }).first();
  await expect(search).toBeVisible();
  await search.fill('acme-docs');
  await search.press('Enter');

  const result = page.getByRole('link', { name: 'acme-docs', exact: true }).first();
  await expect(result).toBeVisible();
  await result.click();

  await expect(
    page.getByRole('heading', { name: /acme-docs/ }).first()
  ).toBeVisible();
});

test('REQ-3-1#2: REQ-3-1: Search for and Locate Repositories - Scenario 2', async ({ page }) => {
  await page.goto('/');

  const search = page.getByRole('searchbox', { name: 'Search', exact: true }).first();
  await expect(search).toBeVisible();
  await search.fill('secret-research');
  await search.press('Enter');

  await expect(
    page.getByRole('link', { name: 'secret-research', exact: true })
  ).toHaveCount(0);
});

test('REQ-3-1#3: REQ-3-1: Search for and Locate Repositories - Scenario 3', async ({ page }) => {
  await page.goto('/');

  const search = page.getByRole('searchbox', { name: 'Search', exact: true }).first();
  await expect(search).toBeVisible();
  await search.fill('no-such-repository');
  await search.press('Enter');

  await expect(
    page.getByText(/No results|No repositories/).first()
  ).toBeVisible();
});

test('REQ-3-1#4: REQ-3-1: Search for and Locate Repositories - Scenario 4', async ({ page }) => {
  await page.goto('/');

  const search = page.getByRole('searchbox', { name: 'Search', exact: true }).first();
  await expect(search).toBeVisible();
  await search.fill('acme-docs');
  await search.press('Enter');

  const result = page.getByRole('link', { name: 'acme-docs', exact: true }).first();
  await expect(result).toBeVisible();
  await result.click();

  await expect(
    page.getByRole('heading', { name: /acme-docs/ }).first()
  ).toBeVisible();

  await page.reload();

  await expect(
    page.getByRole('heading', { name: /acme-docs/ }).first()
  ).toBeVisible();
});

test('REQ-3-2-1: REQ-3-2-1: Create a Repository with Owner, Visibility, and Initialization Options - Scenario 1', async ({ page }) => {
  const name = 'pw-repo-' + u();

  await signIn(page, 'repo-owner');

  // The personal namespace is selected by default, so only the name/options are entered.
  await page.getByRole('link', { name: 'New repository', exact: true }).first().click();
  await page.getByLabel('Repository name', { exact: true }).fill(name);
  await page.getByLabel('Description', { exact: true }).fill('Repository created by Playwright');
  await page.getByRole('radio', { name: 'Private', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Add a README file', exact: true }).check();
  await page.getByRole('button', { name: 'Create repository', exact: true }).first().click();

  await expect(
    page.getByRole('heading', { name: new RegExp(esc(name)) }).first()
  ).toBeVisible();
  await expect(page.getByText('Private', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'README.md', exact: true }).first()).toBeVisible();

  await page.reload();

  await expect(
    page.getByRole('heading', { name: new RegExp(esc(name)) }).first()
  ).toBeVisible();
  await expect(page.getByText('Private', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'README.md', exact: true }).first()).toBeVisible();

  // The repository is discoverable for its owner.
  await searchFromHome(page, name);
  await expect(page.getByRole('link', { name, exact: true }).first()).toBeVisible();
});

test('REQ-3-2-1#2: REQ-3-2-1: Create a Repository with Owner, Visibility, and Initialization Options - Scenario 2', async ({ page }) => {
  await signIn(page, 'repo-owner');

  await page.getByRole('link', { name: 'New repository', exact: true }).first().click();
  await page.getByLabel('Repository name', { exact: true }).fill('acme-docs');
  await page.getByRole('button', { name: 'Create repository', exact: true }).first().click();

  await expect(page.getByText(/already exists/i).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /acme-docs/ })).toHaveCount(0);
});

test('REQ-3-2-1#3: REQ-3-2-1: Create a Repository with Owner, Visibility, and Initialization Options - Scenario 3', async ({ page }) => {
  await signIn(page, 'repo-owner');

  await page.getByRole('link', { name: 'New repository', exact: true }).first().click();
  await page.getByRole('button', { name: 'Create repository', exact: true }).first().click();

  await expect(page.getByText(/required/i).first()).toBeVisible();
});

test('REQ-3-2-2: REQ-3-2-2: Fork a Repository into Another Namespace - Scenario 1', async ({ page }) => {
  const forkName = 'pw-fork-' + u();

  await signIn(page, 'fork-user');
  await openRepositoryViaSearch(page, 'acme-docs');

  await page.getByRole('button', { name: 'Fork', exact: true }).first().click();
  // The form defaults to the signed-in user's personal namespace and an allowed visibility.
  await page.getByLabel('Repository name', { exact: true }).fill(forkName);
  await page.getByRole('button', { name: 'Create fork', exact: true }).first().click();

  await expect(
    page.getByRole('heading', { name: new RegExp(esc(forkName)) }).first()
  ).toBeVisible();
  await expect(page.getByText(/Forked from/).first()).toBeVisible();

  await page.reload();

  await expect(
    page.getByRole('heading', { name: new RegExp(esc(forkName)) }).first()
  ).toBeVisible();
  await expect(page.getByText(/Forked from/).first()).toBeVisible();

  // The fork also exists in the target owner's repository list.
  await searchFromHome(page, forkName);
  await expect(page.getByRole('link', { name: forkName, exact: true }).first()).toBeVisible();
});

test('REQ-3-2-2#2: REQ-3-2-2: Fork a Repository into Another Namespace - Scenario 2', async ({ page }) => {
  await signIn(page, 'fork-user');
  await openRepositoryViaSearch(page, 'acme-docs');

  await page.getByRole('button', { name: 'Fork', exact: true }).first().click();
  await page.getByLabel('Repository name', { exact: true }).fill('acme-docs-fork');
  await page.getByRole('button', { name: 'Create fork', exact: true }).first().click();

  await expect(page.getByText(/already exists/i).first()).toBeVisible();
});

test('REQ-3-2-3: REQ-3-2-3: Copy a Repository Clone Value - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await openRepositoryViaSearch(page, 'acme-docs');

  await page.getByRole('button', { name: 'Code', exact: true }).first().click();
  await page.getByRole('tab', { name: 'HTTPS', exact: true }).first().click();
  await page.getByRole('button', { name: /copy/i }).first().click();

  await expect(page.getByText(/Copied/).first()).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /acme-docs/ }).first()
  ).toBeVisible();
});

test('REQ-3-2-3#2: REQ-3-2-3: Copy a Repository Clone Value - Scenario 2', async ({ page }) => {
  await page.goto('/');
  await openRepositoryViaSearch(page, 'acme-docs');

  await page.getByRole('button', { name: 'Code', exact: true }).first().click();
  await page.getByRole('tab', { name: 'SSH', exact: true }).first().click();
  await page.getByRole('button', { name: /copy/i }).first().click();

  await expect(page.getByText(/Copied/).first()).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /acme-docs/ }).first()
  ).toBeVisible();
});

test('REQ-3-3: REQ-3-3: View a Public Repository Overview - Scenario 1', async ({ page }) => {
  await page.goto('/');

  const entry = page.getByRole('link', { name: 'acme-docs', exact: true }).first();
  await expect(entry).toBeVisible();
  await entry.click();

  await expect(
    page.getByRole('heading', { name: /acme-docs/ }).first()
  ).toBeVisible();
  await expect(page.getByText('Public', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Code', exact: true }).first()).toBeVisible();

  await page.reload();

  await expect(
    page.getByRole('heading', { name: /acme-docs/ }).first()
  ).toBeVisible();
});

test('REQ-3-4: REQ-3-4: Change Repository Visibility with Permission Checks - Scenario 1', async ({ page }) => {
  await signIn(page, 'visibility-admin');
  await openRepositoryViaSearch(page, 'visibility-demo');

  await page.getByRole('link', { name: 'Settings', exact: true }).first().click();
  await page.getByRole('link', { name: 'General', exact: true }).first().click();
  await page.getByRole('button', { name: 'Change visibility', exact: true }).first().click();
  await page.getByRole('radio', { name: 'Public', exact: true }).check();
  await page.getByRole('button', { name: 'Confirm visibility', exact: true }).first().click();

  await openRepositoryViaSearch(page, 'visibility-demo');
  await expect(page.getByText('Public', { exact: true }).first()).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /visibility-demo/ }).first()
  ).toBeVisible();

  // Visitor without a session can still reach the now public repository.
  await page.context().clearCookies();
  await page.goto('/');
  await openRepositoryViaSearch(page, 'visibility-demo');
  await expect(
    page.getByRole('heading', { name: /visibility-demo/ }).first()
  ).toBeVisible();
});

test('REQ-3-4#2: REQ-3-4: Change Repository Visibility with Permission Checks - Scenario 2', async ({ page }) => {
  await signIn(page, 'collaborator');
  await openRepositoryViaSearch(page, 'visibility-demo');

  const settings = page.getByRole('link', { name: 'Settings', exact: true }).first();
  if (await settings.isVisible()) {
    await settings.click();
  }

  const changeVisibility = page.getByRole('button', { name: 'Change visibility', exact: true });
  if ((await changeVisibility.count()) > 0) {
    await expect(changeVisibility.first()).toBeDisabled();
  } else {
    await expect(changeVisibility).toHaveCount(0);
  }
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

