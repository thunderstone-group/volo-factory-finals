const { test, expect } = require('@playwright/test');

async function signIn(page, username = 'alice-dev', password = 'Valid-password-123!') {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
}

async function openRepository(page, repoName = 'acme-docs') {
  await page.goto('/');
  const search = page.getByRole('searchbox', { name: 'Search', exact: true });
  await search.fill(repoName);
  await search.press('Enter');
  const result = page.getByRole('link', { name: repoName, exact: true });
  await expect(result.first()).toBeVisible();
  await result.first().click();
  await expect(page.getByRole('heading', { name: new RegExp(repoName) }).first()).toBeVisible();
}

async function openCode(page) {
  await page.getByRole('link', { name: 'Code', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Branch / })).toBeVisible();
}

async function switchBranch(page, branchName) {
  await page.getByRole('button', { name: /^Branch / }).click();
  await page.getByLabel('Find branch', { exact: true }).fill(branchName);
  const option = page.getByRole('option', { name: branchName, exact: true });
  await expect(option).toBeVisible();
  await option.click();
  await expect(page.getByRole('button', { name: `Branch ${branchName}`, exact: true })).toBeVisible();
}

async function openCodeSearch(page, query, path) {
  const search = page.getByRole('searchbox', { name: 'Search', exact: true });
  await search.fill(query);
  await search.press('Enter');
  await page.getByRole('link', { name: 'Code', exact: true }).click();
  if (path !== undefined) {
    await page.getByLabel('Path', { exact: true }).fill(path);
  }
}

test('REQ-4-1: REQ-4-1: Browse Repository Files and Directories - Scenario 1', async ({ page }) => {
  await openRepository(page);
  await openCode(page);

  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'src', exact: true }).click();
  await expect(page.getByRole('link', { name: 'src', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'search.ts', exact: true }).click();
  await expect(page.getByText('src/search.ts', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();

  await page.goBack();
  await switchBranch(page, 'feature-search');

  await expect(page.getByRole('link', { name: 'search.ts', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Branch feature-search', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('link', { name: 'search.ts', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Branch feature-search', exact: true })).toBeVisible();
});

test('REQ-4-2-1: REQ-4-2-1: View Repository Commit History - Scenario 1', async ({ page }) => {
  await openRepository(page);
  await openCode(page);

  await page.getByRole('link', { name: 'src', exact: true }).click();
  await page.getByRole('link', { name: 'search.ts', exact: true }).click();
  await page.getByRole('link', { name: /Commits/ }).first().click();

  await expect(page.getByText('Document search flow', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/ago/).first()).toBeVisible();

  await page.getByText('Document search flow', { exact: true }).first().click();
  await expect(page.getByText('Changed files', { exact: true })).toBeVisible();

  await page.goBack();
  await page.reload();
  await expect(page.getByText('Document search flow', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/ago/).first()).toBeVisible();
});

test('REQ-4-2-2: REQ-4-2-2: Inspect Commit and Revision Differences - Scenario 1', async ({ page }) => {
  await openRepository(page);
  await openCode(page);

  await page.getByRole('link', { name: /Commits/ }).first().click();
  await page.getByText('Document search flow', { exact: true }).first().click();

  await expect(page.getByText('src/search.ts', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Changed files', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText('src/search.ts', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Changed files', { exact: true })).toBeVisible();
});

test('REQ-4-2-3: REQ-4-2-3: Search Code Within a Repository - Scenario 1', async ({ page }) => {
  await openRepository(page);
  await openCodeSearch(page, 'search flow', 'src/');

  await expect(page.getByRole('link', { name: 'search.ts', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'search.ts', exact: true }).click();
  await expect(page.getByText('src/search.ts', { exact: true }).first()).toBeVisible();

  await page.goBack();
  await page.getByLabel('Path', { exact: true }).fill('');

  await expect(page.getByRole('link', { name: 'README.md', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'search.ts', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'secret-research', exact: true })).toHaveCount(0);
});

test('REQ-4-2-3#2: REQ-4-2-3: Search Code Within a Repository - Scenario 2', async ({ page }) => {
  await openRepository(page);
  await openCodeSearch(page, 'no-such-token');

  await expect(page.getByText('No code results', { exact: true })).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Search', exact: true })).toHaveValue('no-such-token');

  await page.reload();
  await expect(page.getByText('No code results', { exact: true })).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Search', exact: true })).toHaveValue('no-such-token');

  await page.goto('/');
  await openRepository(page);
  await openCodeSearch(page, 'no-such-token');
  await expect(page.getByText('No code results', { exact: true })).toBeVisible();
});

test('REQ-4-2-3#3: REQ-4-2-3: Search Code Within a Repository - Scenario 3', async ({ page }) => {
  await signIn(page);
  await openRepository(page);
  await openCodeSearch(page, 'search flow');

  await expect(page.getByRole('link', { name: 'README.md', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('link', { name: 'README.md', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
});

test('REQ-4-2-3#4: REQ-4-2-3: Search Code Within a Repository - Scenario 4', async ({ page }) => {
  await signIn(page);
  await openRepository(page);
  await openCodeSearch(page, 'no-such-token');

  await expect(page.getByText('No code results', { exact: true })).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Search', exact: true })).toHaveValue('no-such-token');

  await page.reload();
  await expect(page.getByText('No code results', { exact: true })).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Search', exact: true })).toHaveValue('no-such-token');
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

