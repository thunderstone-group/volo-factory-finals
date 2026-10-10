const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function signInAsAlice(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).first().click();
  await page.getByLabel('Username or email', { exact: true }).fill('alice-dev');
  await page.getByLabel('Password', { exact: true }).fill('Valid-password-123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
}

async function searchGlobal(page, query) {
  const box = page.getByRole('searchbox', { name: 'Search', exact: true });
  await box.fill(query);
  await box.press('Enter');
}

async function searchRepositories(page, query) {
  await searchGlobal(page, query);
  await page.getByRole('link', { name: 'Repositories', exact: true }).click();
}

test('REQ-3-1: Search for and Locate Repositories - Scenario 1', async ({ page }) => {
  await page.goto('/');

  await searchRepositories(page, 'acme-docs');
  await expect(page.getByRole('link', { name: 'acme-docs', exact: true })).toBeVisible();
  await expect(page.getByText('alice-dev/acme-docs', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'secret-research', exact: true })).toHaveCount(0);

  await page.getByRole('link', { name: 'acme-docs', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'alice-dev/acme-docs', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'alice-dev/acme-docs', exact: true })).toBeVisible();

  await page.goto('/');
  await searchGlobal(page, 'no-such-token-repo-xyz');
  await expect(page.getByText('No results', { exact: true })).toBeVisible();

  await page.goto('/');
  await searchRepositories(page, 'secret-research');
  await expect(page.getByRole('link', { name: 'secret-research', exact: true })).toHaveCount(0);
});

test('REQ-3-1#2: REQ-3-1: Search for and Locate Repositories - Scenario 2', async ({ page }) => {
  await signInAsAlice(page);

  await searchRepositories(page, 'acme-docs');
  await expect(page.getByRole('link', { name: 'acme-docs', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'acme-docs', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'alice-dev/acme-docs', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'alice-dev/acme-docs', exact: true })).toBeVisible();

  await page.goto('/');
  await searchRepositories(page, 'secret-research');
  await expect(page.getByRole('link', { name: 'secret-research', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'secret-research', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'alice-dev/secret-research', exact: true })).toBeVisible();
});

test('REQ-3-1#3: REQ-3-1: Search for and Locate Repositories - Scenario 3', async ({ page }) => {
  await signInAsAlice(page);

  await searchGlobal(page, 'no-such-token-repo-xyz');
  await expect(page.getByText('No results', { exact: true })).toBeVisible();

  await page.goto('/');
  await searchGlobal(page, 'no-such-token-repo-xyz');
  await expect(page.getByText('No results', { exact: true })).toBeVisible();
});

test('REQ-3-1#4: REQ-3-1: Search for and Locate Repositories - Scenario 4', async ({ page }) => {
  await signInAsAlice(page);

  await searchRepositories(page, 'secret-research');
  await expect(page.getByRole('link', { name: 'secret-research', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'secret-research', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'alice-dev/secret-research', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'alice-dev/secret-research', exact: true })).toBeVisible();
});

test('REQ-3-2-1: Create a Repository with Owner, Visibility, and Initialization Options - Scenario 1', async ({ page }) => {
  await signInAsAlice(page);

  const repo = `pw-repo-${u()}`;
  await page.getByRole('link', { name: 'New repository', exact: true }).first().click();
  await page.getByLabel('Repository name', { exact: true }).fill(repo);
  await page.getByLabel('Description', { exact: true }).fill('Repository created by Playwright');
  await page.getByRole('radio', { name: 'Private', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Add a README file', exact: true }).check();
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();

  await expect(page.getByRole('heading', { name: `alice-dev/${repo}`, exact: true })).toBeVisible();
  await expect(page.getByText('Private', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Repository created by Playwright', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'README.md', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: `alice-dev/${repo}`, exact: true })).toBeVisible();
  await expect(page.getByText('Private', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Repository created by Playwright', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'README.md', exact: true })).toBeVisible();
});

test('REQ-3-2-1#2: REQ-3-2-1: Create a Repository with Owner, Visibility, and Initialization Options - Scenario 2', async ({ page }) => {
  await signInAsAlice(page);

  const repo = `pw-repo-${u()}`;
  await page.getByRole('link', { name: 'New repository', exact: true }).first().click();
  await page.getByLabel('Repository name', { exact: true }).fill(repo);
  await page.getByRole('radio', { name: 'Public', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Add a README file', exact: true }).check();
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();

  await expect(page.getByRole('heading', { name: `alice-dev/${repo}`, exact: true })).toBeVisible();
  await expect(page.getByText('Public', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'README.md', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: `alice-dev/${repo}`, exact: true })).toBeVisible();
  await expect(page.getByText('Public', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'README.md', exact: true })).toBeVisible();
});

test('REQ-3-2-1#3: REQ-3-2-1: Create a Repository with Owner, Visibility, and Initialization Options - Scenario 3', async ({ page }) => {
  await signInAsAlice(page);

  const repo = `pw-repo-${u()}`;
  await page.getByRole('link', { name: 'New repository', exact: true }).first().click();
  await page.getByLabel('Repository name', { exact: true }).fill(repo);
  await page.getByRole('radio', { name: 'Private', exact: true }).check();
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();

  await expect(page.getByRole('heading', { name: `alice-dev/${repo}`, exact: true })).toBeVisible();

  await page.goto('/');
  await page.getByRole('link', { name: 'New repository', exact: true }).first().click();
  await page.getByLabel('Repository name', { exact: true }).fill(repo);
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Create repository', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: `alice-dev/${repo}`, exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Create repository', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: `alice-dev/${repo}`, exact: true })).toHaveCount(0);
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

