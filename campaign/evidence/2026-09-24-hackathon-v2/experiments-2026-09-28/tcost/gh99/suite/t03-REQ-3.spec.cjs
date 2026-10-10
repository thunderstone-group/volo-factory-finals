const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function signIn(page, username, password) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
}

async function openRepository(page, repoName) {
  await page.goto('/');
  const search = page.getByRole('searchbox', { name: 'Search', exact: true });
  await search.fill(repoName);
  await search.press('Enter');
  await page.getByRole('link', { name: repoName, exact: true }).click();
}

async function searchRepositories(page, query) {
  await page.goto('/');
  const search = page.getByRole('searchbox', { name: 'Search', exact: true });
  await search.fill(query);
  await search.press('Enter');
  await page.getByRole('link', { name: 'Repositories', exact: true }).click();
}

async function createRepository(page, { name, description, visibility = 'Public', readme = false }) {
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
  await expect(page.getByRole('heading', { name: `alice-dev/${name}`, exact: true })).toBeVisible();
}

async function createFork(page, name) {
  await page.getByRole('button', { name: 'Fork', exact: true }).click();
  await page.getByLabel('Repository name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Create fork', exact: true }).click();
}

test('REQ-3-1: REQ-3-1: Search for and Locate Repositories - Scenario 1', async ({ page }) => {
  await searchRepositories(page, 'acme');

  const publicResult = page.getByRole('link', { name: 'acme-docs', exact: true });
  await expect(publicResult).toBeVisible();
  await expect(page.getByText('alice-dev/acme-docs', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'secret-research', exact: true })).toHaveCount(0);

  await publicResult.click();
  await expect(page.getByRole('heading', { name: 'alice-dev/acme-docs', exact: true })).toBeVisible();

  await searchRepositories(page, 'secret-research');
  await expect(page.getByRole('link', { name: 'secret-research', exact: true })).toHaveCount(0);
  await expect(page.getByText('No results', { exact: true })).toBeVisible();
});

test('REQ-3-1#2: REQ-3-1: Search for and Locate Repositories - Scenario 2', async ({ page }) => {
  await signIn(page, 'alice-dev', 'Valid-password-123!');
  await searchRepositories(page, 'acme-docs');

  await expect(page.getByRole('link', { name: 'acme-docs', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'acme-docs', exact: true })).toBeVisible();
});

test('REQ-3-1#3: REQ-3-1: Search for and Locate Repositories - Scenario 3', async ({ page }) => {
  await signIn(page, 'alice-dev', 'Valid-password-123!');
  await searchRepositories(page, 'secret-research');

  await expect(page.getByRole('link', { name: 'secret-research', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'secret-research', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'alice-dev/secret-research', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'alice-dev/secret-research', exact: true })).toBeVisible();
});

test('REQ-3-1#4: REQ-3-1: Search for and Locate Repositories - Scenario 4', async ({ page }) => {
  await signIn(page, 'alice-dev', 'Valid-password-123!');
  await openRepository(page, 'acme-docs');

  await expect(page.getByRole('heading', { name: 'alice-dev/acme-docs', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'alice-dev/acme-docs', exact: true })).toBeVisible();
});

test('REQ-3-2-1: REQ-3-2-1: Create a Repository with Owner, Visibility, and Initialization Options - Scenario 1', async ({ page }) => {
  const repoName = 'pw-repo-' + u();
  await signIn(page, 'alice-dev', 'Valid-password-123!');
  await createRepository(page, {
    name: repoName,
    description: 'Repository created by Playwright',
    visibility: 'Private',
    readme: true,
  });

  await expect(page.getByText('Repository created by Playwright', { exact: true })).toBeVisible();
  await expect(page.getByText('Private', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'README.md', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: `alice-dev/${repoName}`, exact: true })).toBeVisible();
  await expect(page.getByText('Private', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'README.md', exact: true })).toBeVisible();
});

test('REQ-3-2-1#2: REQ-3-2-1: Create a Repository with Owner, Visibility, and Initialization Options - Scenario 2', async ({ page }) => {
  const repoName = 'pw-repo-' + u();
  await signIn(page, 'alice-dev', 'Valid-password-123!');
  await createRepository(page, {
    name: repoName,
    description: 'Repository created by Playwright',
    visibility: 'Public',
    readme: true,
  });

  await expect(page.getByText('Public', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: `alice-dev/${repoName}`, exact: true })).toBeVisible();
  await expect(page.getByText('Public', { exact: true })).toBeVisible();
});

test('REQ-3-2-1#3: REQ-3-2-1: Create a Repository with Owner, Visibility, and Initialization Options - Scenario 3', async ({ page }) => {
  const repoName = 'pw-repo-' + u();
  await signIn(page, 'alice-dev', 'Valid-password-123!');
  await createRepository(page, {
    name: repoName,
    description: 'Repository created by Playwright',
    visibility: 'Private',
    readme: false,
  });

  await expect(page.getByText('Private', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: `alice-dev/${repoName}`, exact: true })).toBeVisible();
  await expect(page.getByText('Private', { exact: true })).toBeVisible();
});

test('REQ-3-2-2: REQ-3-2-2: Fork a Repository into Another Namespace - Scenario 1', async ({ page }) => {
  const forkName = 'pw-fork-' + u();
  await signIn(page, 'alice-dev', 'Valid-password-123!');
  await openRepository(page, 'acme-docs');
  await createFork(page, forkName);

  await expect(page.getByRole('heading', { name: `alice-dev/${forkName}`, exact: true })).toBeVisible();
  await expect(page.getByText('Forked from acme-docs', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: `alice-dev/${forkName}`, exact: true })).toBeVisible();
  await expect(page.getByText('Forked from acme-docs', { exact: true })).toBeVisible();
});

test('REQ-3-2-2#2: REQ-3-2-2: Fork a Repository into Another Namespace - Scenario 2', async ({ page }) => {
  const forkName = 'pw-fork-' + u();
  await signIn(page, 'alice-dev', 'Valid-password-123!');
  await openRepository(page, 'acme-docs');
  await createFork(page, forkName);

  await expect(page.getByRole('heading', { name: `alice-dev/${forkName}`, exact: true })).toBeVisible();
  await expect(page.getByText('Forked from acme-docs', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: `alice-dev/${forkName}`, exact: true })).toBeVisible();
  await expect(page.getByText('Forked from acme-docs', { exact: true })).toBeVisible();
});

test('REQ-3-2-3: REQ-3-2-3: Copy a Repository Clone Value - Scenario 1', async ({ page }) => {
  await openRepository(page, 'acme-docs');

  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await page.getByRole('tab', { name: 'HTTPS', exact: true }).click();
  await page.getByRole('button', { name: 'Copy clone value', exact: true }).click();

  await expect(page.getByText('Copied', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'alice-dev/acme-docs', exact: true })).toBeVisible();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain('acme-docs');
});

test('REQ-3-2-3#2: REQ-3-2-3: Copy a Repository Clone Value - Scenario 2', async ({ page }) => {
  await signIn(page, 'alice-dev', 'Valid-password-123!');
  await openRepository(page, 'acme-docs');

  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await page.getByRole('tab', { name: 'SSH', exact: true }).click();
  await page.getByRole('button', { name: 'Copy clone value', exact: true }).click();

  await expect(page.getByText('Copied', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'alice-dev/acme-docs', exact: true })).toBeVisible();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain('acme-docs');
});

test('REQ-3-3: REQ-3-3: View a Public Repository Overview - Scenario 1', async ({ page }) => {
  await openRepository(page, 'acme-docs');

  await expect(page.getByRole('heading', { name: 'alice-dev/acme-docs', exact: true })).toBeVisible();
  await expect(page.getByText('Public', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Code', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Issues', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Pull requests', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'README.md', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'README.md', exact: true }).click();
  await expect(page.getByText('README.md', { exact: true }).first()).toBeVisible();

  await searchRepositories(page, 'secret-research');
  await expect(page.getByRole('link', { name: 'secret-research', exact: true })).toHaveCount(0);
  await expect(page.getByText('No results', { exact: true })).toBeVisible();
});

test('REQ-3-4: REQ-3-4: Change Repository Visibility with Permission Checks - Scenario 1', async ({ page }) => {
  const repoName = 'pw-public-' + u();
  await signIn(page, 'alice-dev', 'Valid-password-123!');
  await createRepository(page, {
    name: repoName,
    description: 'Repository created by Playwright',
    visibility: 'Private',
    readme: true,
  });

  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'General', exact: true }).click();
  await page.getByRole('button', { name: 'Change visibility', exact: true }).click();
  await page.getByRole('radio', { name: 'Public', exact: true }).check();
  await page.getByRole('button', { name: 'Confirm visibility', exact: true }).click();

  await page.getByRole('link', { name: 'Code', exact: true }).click();
  await expect(page.getByText('Public', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Public', { exact: true })).toBeVisible();
});

test('REQ-3-4#2: REQ-3-4: Change Repository Visibility with Permission Checks - Scenario 2', async ({ page }) => {
  await signIn(page, 'alice-dev', 'Valid-password-123!');
  await openRepository(page, 'acme-docs');

  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'General', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Change visibility', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Change visibility', exact: true })).toBeVisible();
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

