// Acceptance tests for REQ-3 (Repository Asset Management).
// Every GIVEN state comes from the seed data named in the requirements or from
// flows the requirements describe; no test relies on another test having run.
const { test, expect } = require('@playwright/test');

const PASSWORD = 'Valid-password-123!';

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// Signs in through the home-page "Sign in" link and waits for the workspace.
async function signIn(page, identifier, username) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(identifier);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText(username, { exact: true }).first()).toBeVisible();
}

// The top global search control (REQ-3-1): fill and press Enter, no extra submit.
async function searchFromTop(page, query) {
  const box = page.getByRole('searchbox', { name: 'Search', exact: true });
  await expect(box).toBeVisible();
  await box.fill(query);
  await box.press('Enter');
}

// Opens a repository overview: clicks a visible entry named exactly <name> when the
// current page offers one, otherwise uses the documented top "Search" box (REQ-3-1).
async function openRepository(page, name) {
  const entry = page.getByRole('link', { name, exact: true }).first();
  if (await entry.isVisible()) {
    await entry.click();
    return;
  }
  await searchFromTop(page, name);
  await page.getByRole('link', { name, exact: true }).first().click();
}

test('REQ-3-1: REQ-3-1: Search for and Locate Repositories - Scenario 1', async ({ page }) => {
  await page.goto('/');

  const search = page.getByRole('searchbox', { name: 'Search', exact: true });
  await expect(search).toBeVisible();
  await search.fill('acme-docs');
  await search.press('Enter');

  const result = page.getByRole('link', { name: 'acme-docs', exact: true });
  await expect(result.first()).toBeVisible();
  await result.first().click();

  await expect(page.getByRole('heading', { name: /acme-docs/ }).first()).toBeVisible();
});

test('REQ-3-1#2: REQ-3-1: Search for and Locate Repositories - Scenario 2', async ({ page }) => {
  await page.goto('/');

  const search = page.getByRole('searchbox', { name: 'Search', exact: true });
  await expect(search).toBeVisible();
  await search.fill('secret-research');
  await search.press('Enter');

  // give the (client-side) result list time to render before asserting absence
  await page.waitForTimeout(1000);
  await expect(page.getByRole('link', { name: 'secret-research', exact: true })).toHaveCount(0);
});

test('REQ-3-1#3: REQ-3-1: Search for and Locate Repositories - Scenario 3', async ({ page }) => {
  await page.goto('/');

  const search = page.getByRole('searchbox', { name: 'Search', exact: true });
  await expect(search).toBeVisible();
  await search.fill('no-such-repository');
  await search.press('Enter');

  await expect(page.getByText(/No results|No repositories/).first()).toBeVisible();
});

test('REQ-3-1#4: REQ-3-1: Search for and Locate Repositories - Scenario 4', async ({ page }) => {
  await page.goto('/');

  const search = page.getByRole('searchbox', { name: 'Search', exact: true });
  await expect(search).toBeVisible();
  await search.fill('acme-docs');
  await search.press('Enter');

  const result = page.getByRole('link', { name: 'acme-docs', exact: true });
  await expect(result.first()).toBeVisible();
  await result.first().click();

  await expect(page.getByRole('heading', { name: /acme-docs/ }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: /acme-docs/ }).first()).toBeVisible();
});

test('REQ-3-2-1: REQ-3-2-1: Create a Repository with Owner, Visibility, and Initialization Options - Scenario 1', async ({ page }) => {
  const name = `pw-repo-${u()}`;

  // repo-owner owns the personal namespace, which is the default Owner of the form
  await signIn(page, 'repo-owner@example.test', 'repo-owner');
  await page.getByRole('link', { name: 'New repository', exact: true }).click();

  await page.getByLabel('Repository name', { exact: true }).fill(name);
  await page.getByLabel('Description', { exact: true }).fill('Repository created by Playwright');
  await page.getByRole('radio', { name: 'Private', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Add a README file', exact: true }).check();
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();

  await expect(page.getByRole('heading', { name: new RegExp(name) }).first()).toBeVisible();
  await expect(page.getByText('Private', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Repository created by Playwright').first()).toBeVisible();
  await expect(page.getByRole('link', { name: /README/ }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: new RegExp(name) }).first()).toBeVisible();
  await expect(page.getByText('Private', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Repository created by Playwright').first()).toBeVisible();
  await expect(page.getByRole('link', { name: /README/ }).first()).toBeVisible();
});

test('REQ-3-2-1#2: REQ-3-2-1: Create a Repository with Owner, Visibility, and Initialization Options - Scenario 2', async ({ page }) => {
  await signIn(page, 'repo-owner@example.test', 'repo-owner');
  await page.getByRole('link', { name: 'New repository', exact: true }).click();

  // "acme-docs" already exists in this default personal namespace
  await page.getByLabel('Repository name', { exact: true }).fill('acme-docs');
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();

  await expect(page.getByText(/already exists/i).first()).toBeVisible();
  await expect(page.getByLabel('Repository name', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /acme-docs/ })).toHaveCount(0);
});

test('REQ-3-2-1#3: REQ-3-2-1: Create a Repository with Owner, Visibility, and Initialization Options - Scenario 3', async ({ page }) => {
  await signIn(page, 'repo-owner@example.test', 'repo-owner');
  await page.getByRole('link', { name: 'New repository', exact: true }).click();

  // "Repository name" is left empty
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();

  await expect(page.getByText(/required/i).first()).toBeVisible();
  await expect(page.getByLabel('Repository name', { exact: true })).toBeVisible();
});

test('REQ-3-2-2: REQ-3-2-2: Fork a Repository into Another Namespace - Scenario 1', async ({ page }) => {
  const forkName = `pw-fork-${u()}`;

  await signIn(page, 'fork-user@example.test', 'fork-user');
  await openRepository(page, 'acme-docs');

  await page.getByRole('button', { name: 'Fork', exact: true }).click();
  // the form defaults to the personal namespace and an allowed visibility
  await page.getByLabel('Repository name', { exact: true }).fill(forkName);
  await page.getByRole('button', { name: 'Create fork', exact: true }).click();

  await expect(page.getByRole('heading', { name: new RegExp(forkName) }).first()).toBeVisible();
  await expect(page.getByText(/Forked from/).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'acme-docs', exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: new RegExp(forkName) }).first()).toBeVisible();
  await expect(page.getByText(/Forked from/).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'acme-docs', exact: true }).first()).toBeVisible();
});

test('REQ-3-2-2#2: REQ-3-2-2: Fork a Repository into Another Namespace - Scenario 2', async ({ page }) => {
  await signIn(page, 'fork-user@example.test', 'fork-user');
  await openRepository(page, 'acme-docs');

  await page.getByRole('button', { name: 'Fork', exact: true }).click();
  // fork-user's personal namespace already contains the fork "acme-docs-fork"
  await page.getByLabel('Repository name', { exact: true }).fill('acme-docs-fork');
  await page.getByRole('button', { name: 'Create fork', exact: true }).click();

  await expect(page.getByText(/already exists/i).first()).toBeVisible();
});

test('REQ-3-2-3: REQ-3-2-3: Copy a Repository Clone Value - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await openRepository(page, 'acme-docs');
  await expect(page.getByRole('heading', { name: /acme-docs/ }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await page.getByRole('tab', { name: 'HTTPS', exact: true }).click();
  await page.getByRole('button', { name: /copy/i }).first().click();

  await expect(page.getByText('Copied', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /acme-docs/ }).first()).toBeVisible();

  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied.length).toBeGreaterThan(0);
});

test('REQ-3-2-3#2: REQ-3-2-3: Copy a Repository Clone Value - Scenario 2', async ({ page }) => {
  await page.goto('/');
  await openRepository(page, 'acme-docs');
  await expect(page.getByRole('heading', { name: /acme-docs/ }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await page.getByRole('tab', { name: 'SSH', exact: true }).click();
  await page.getByRole('button', { name: /copy/i }).first().click();

  await expect(page.getByText('Copied', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /acme-docs/ }).first()).toBeVisible();

  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied.length).toBeGreaterThan(0);
});

test('REQ-3-3: REQ-3-3: View a Public Repository Overview - Scenario 1', async ({ page }) => {
  await page.goto('/');

  // opens the visible acme-docs repository entry from the home page
  await openRepository(page, 'acme-docs');

  await expect(page.getByRole('heading', { name: /acme-docs/ }).first()).toBeVisible();
  await expect(page.getByText('Public', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Code', exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: /acme-docs/ }).first()).toBeVisible();
});

test('REQ-3-4: REQ-3-4: Change Repository Visibility with Permission Checks - Scenario 1', async ({ page }) => {
  await signIn(page, 'visibility-admin@example.test', 'visibility-admin');
  await openRepository(page, 'visibility-demo');
  await expect(page.getByRole('heading', { name: /visibility-demo/ }).first()).toBeVisible();

  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'General', exact: true }).click();
  await page.getByRole('button', { name: 'Change visibility', exact: true }).click();
  await page.getByRole('radio', { name: 'Public', exact: true }).check();
  await page.getByRole('button', { name: 'Confirm visibility', exact: true }).click();

  // back to the repository overview to read its visibility marker
  await page.getByRole('link', { name: 'Code', exact: true }).first().click();
  await expect(page.getByText('Public', { exact: true }).first()).toBeVisible();

  // the change is persisted for the later collaborator check and for visitors
  await page.context().clearCookies();
  await page.goto('/');
  await openRepository(page, 'visibility-demo');
  await expect(page.getByRole('heading', { name: /visibility-demo/ }).first()).toBeVisible();
});

test('REQ-3-4#2: REQ-3-4: Change Repository Visibility with Permission Checks - Scenario 2', async ({ page }) => {
  await signIn(page, 'collaborator@example.test', 'collaborator');
  await openRepository(page, 'visibility-demo');

  const settings = page.getByRole('link', { name: 'Settings', exact: true });
  if (await settings.first().isVisible()) {
    await settings.first().click();
  }

  await expect(page.getByRole('button', { name: 'Change visibility', exact: true })).toHaveCount(0);
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

