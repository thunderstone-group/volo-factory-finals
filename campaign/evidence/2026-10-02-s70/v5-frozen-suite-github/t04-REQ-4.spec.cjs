const { test, expect } = require('@playwright/test');

const unique = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function signIn(page, usernameOrEmail, password) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(usernameOrEmail);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function openRepository(page, repoName) {
  await page.goto('/');
  const globalSearch = page
    .getByRole('searchbox', { name: 'Search', exact: true })
    .first();
  await globalSearch.fill(repoName);
  await globalSearch.press('Enter');
  await page.getByRole('link', { name: repoName, exact: true }).first().click();
  await expect(page.getByRole('heading', { name: repoName }).first()).toBeVisible();
}

function repoSearchBox(page) {
  return page
    .getByRole('searchbox', { name: 'Search', exact: true })
    .last();
}

function branchOption(page, name) {
  return page
    .getByRole('option', { name, exact: true })
    .or(page.getByRole('menuitem', { name, exact: true }))
    .or(page.getByRole('button', { name, exact: true }))
    .or(page.getByRole('link', { name, exact: true }));
}

async function clickAddFileThenCreateNewFile(page) {
  await page
    .getByRole('button', { name: 'Add file', exact: true })
    .or(page.getByRole('link', { name: 'Add file', exact: true }))
    .first()
    .click();
  await page.getByText('Create new file', { exact: true }).first().click();
}

test('REQ-4-1: REQ-4-1: Browse Repository Files and Directories - Scenario 1', async ({
  page,
}) => {
  await page.goto('/');
  await openRepository(page, 'acme-docs');

  await page.getByRole('link', { name: 'src', exact: true }).click();
  await page.getByRole('link', { name: 'README.md', exact: true }).click();

  await expect(
    page.getByText('Document search flow', { exact: true }).first()
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByText('Document search flow', { exact: true }).first()
  ).toBeVisible();
});

test('REQ-4-2-1: REQ-4-2-1: View Repository Commit History - Scenario 1', async ({
  page,
}) => {
  await openRepository(page, 'acme-docs');
  await page.getByRole('link', { name: 'Commits', exact: true }).click();

  await expect(
    page.getByText('Document search flow', { exact: true }).first()
  ).toBeVisible();
  await expect(page.getByText('alice-dev', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/ago/i).first()).toBeVisible();
});

test('REQ-4-2-2: REQ-4-2-2: Inspect Commit and Revision Differences - Scenario 1', async ({
  page,
}) => {
  await openRepository(page, 'acme-docs');
  await page.getByRole('link', { name: 'Commits', exact: true }).click();
  await page
    .getByRole('link', { name: 'Document search flow', exact: true })
    .first()
    .click();

  await expect(
    page.getByText('src/search.ts', { exact: true }).first()
  ).toBeVisible();
  await expect(page.getByText('Changed files', { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText(/(\+\d+|\d+\s+addition)/i).first()
  ).toBeVisible();
  await expect(
    page.getByText(/(-\d+|\d+\s+deletion)/i).first()
  ).toBeVisible();
});

test('REQ-4-2-3: REQ-4-2-3: Search Code Within a Repository - Scenario 1', async ({
  page,
}) => {
  await openRepository(page, 'acme-docs');

  const search = repoSearchBox(page);
  await search.fill('search flow');
  await search.press('Enter');
  await page.getByRole('link', { name: 'Code', exact: true }).first().click();
  await page.getByRole('link', { name: 'README.md', exact: true }).first().click();

  await expect(page.getByText('search flow', { exact: true }).first()).toBeVisible();
});

test('REQ-4-2-3#2: REQ-4-2-3: Search Code Within a Repository - Scenario 2', async ({
  page,
}) => {
  await openRepository(page, 'acme-docs');

  const search = repoSearchBox(page);
  await search.fill('no-such-token');
  await search.press('Enter');
  await page.getByRole('link', { name: 'Code', exact: true }).first().click();

  await expect(page.getByText(/no .*result/i).first()).toBeVisible();
  await expect(repoSearchBox(page)).toHaveValue('no-such-token');
});

test('REQ-4-2-3#3: REQ-4-2-3: Search Code Within a Repository - Scenario 3', async ({
  page,
}) => {
  await openRepository(page, 'acme-docs');

  const search = repoSearchBox(page);
  await search.fill('search flow');
  await search.press('Enter');
  await page.getByRole('link', { name: 'Code', exact: true }).first().click();
  await page.getByRole('link', { name: 'README.md', exact: true }).first().click();

  await expect(page.getByText('search flow', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('search flow', { exact: true }).first()).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'README.md', exact: true }).first()
  ).toBeVisible();
});

test('REQ-4-2-3#4: REQ-4-2-3: Search Code Within a Repository - Scenario 4', async ({
  page,
}) => {
  await openRepository(page, 'acme-docs');

  let search = repoSearchBox(page);
  await search.fill('no-such-token');
  await search.press('Enter');
  await page.getByRole('link', { name: 'Code', exact: true }).first().click();
  await expect(page.getByText(/no .*result/i).first()).toBeVisible();

  await openRepository(page, 'acme-docs');
  search = repoSearchBox(page);
  await search.fill('no-such-token');
  await search.press('Enter');
  await page.getByRole('link', { name: 'Code', exact: true }).first().click();
  await expect(page.getByText(/no .*result/i).first()).toBeVisible();
});

test('REQ-4-3-1: REQ-4-3-1: List and Switch Repository Branches - Scenario 1', async ({
  page,
}) => {
  await openRepository(page, 'branch-switch-demo');

  await page.getByRole('button', { name: 'Branch main', exact: true }).click();
  await page.getByLabel('Find branch', { exact: true }).fill('feature-search');
  await branchOption(page, 'feature-search').first().click();

  await expect(
    page.getByRole('button', { name: 'Branch feature-search', exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'main-only.md', exact: true })
  ).toBeVisible();
});

test('REQ-4-3-1#2: REQ-4-3-1: List and Switch Repository Branches - Scenario 2', async ({
  page,
}) => {
  await openRepository(page, 'branch-switch-demo');

  await page.getByRole('button', { name: 'Branch main', exact: true }).click();
  await page.getByLabel('Find branch', { exact: true }).fill('missing-branch');

  await expect(page.getByText('No matching branch', { exact: false }).first()).toBeVisible();

  await page.getByLabel('Find branch', { exact: true }).press('Escape');
  await expect(
    page.getByRole('button', { name: 'Branch main', exact: true })
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Branch main', exact: true })
  ).toBeVisible();
});

test('REQ-4-3-2: REQ-4-3-2: Create a Branch from an Existing Revision - Scenario 1', async ({
  page,
}) => {
  const branchName = `pw-branch-${unique()}`;

  await signIn(page, 'branch-contributor@example.test', 'Valid-password-123!');
  await expect(
    page.getByText('branch-contributor', { exact: true }).first()
  ).toBeVisible();

  await openRepository(page, 'branch-switch-demo');
  await page.getByRole('button', { name: 'Branch main', exact: true }).click();
  await page.getByLabel('Find branch', { exact: true }).fill(branchName);
  await page.getByText(`Create branch: ${branchName}`, { exact: true }).first().click();

  await expect(
    page.getByRole('button', { name: `Branch ${branchName}`, exact: true })
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole('button', { name: `Branch ${branchName}`, exact: true })
  ).toBeVisible();
});

test('REQ-4-3-2#2: REQ-4-3-2: Create a Branch from an Existing Revision - Scenario 2', async ({
  page,
}) => {
  await signIn(page, 'branch-contributor@example.test', 'Valid-password-123!');
  await expect(
    page.getByText('branch-contributor', { exact: true }).first()
  ).toBeVisible();

  await openRepository(page, 'branch-switch-demo');
  await page.getByRole('button', { name: 'Branch main', exact: true }).click();
  await page.getByLabel('Find branch', { exact: true }).fill('invalid..branch');

  await expect(page.getByText('Invalid branch', { exact: false }).first()).toBeVisible();
});

test('REQ-4-3-3: REQ-4-3-3: Change the Repository Default Branch - Scenario 1', async ({
  page,
}) => {
  await signIn(page, 'default-branch-admin@example.test', 'Valid-password-123!');
  await expect(
    page.getByText('default-branch-admin', { exact: true }).first()
  ).toBeVisible();

  await openRepository(page, 'default-branch-demo');
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Branches', exact: true }).click();

  await page.getByLabel('Default branch', { exact: true }).selectOption('release');
  await page.getByRole('button', { name: 'Update', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();

  await openRepository(page, 'default-branch-demo');
  await expect(
    page.getByRole('button', { name: 'Branch release', exact: true })
  ).toBeVisible();

  await page.getByRole('button', { name: 'Branch release', exact: true }).click();
  await expect(branchOption(page, 'main').first()).toBeVisible();
});

test('REQ-4-3-3#2: REQ-4-3-3: Change the Repository Default Branch - Scenario 2', async ({
  page,
}) => {
  await signIn(page, 'default-branch-viewer@example.test', 'Valid-password-123!');
  await expect(
    page.getByText('default-branch-viewer', { exact: true }).first()
  ).toBeVisible();

  await openRepository(page, 'default-branch-demo');

  const settings = page.getByRole('link', { name: 'Settings', exact: true });
  if ((await settings.count()) > 0) {
    await settings.click();
    const branches = page.getByRole('link', { name: 'Branches', exact: true });
    if ((await branches.count()) > 0) {
      await branches.click();
    }
  }

  await expect(page.getByLabel('Default branch', { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Update default branch', exact: true })
  ).toHaveCount(0);
});

test('REQ-4-4: REQ-4-4: Manage Repository Files Through the Web Interface - Scenario 1', async ({
  page,
}) => {
  const fileName = `pw-file-${unique()}.md`;
  const content = `Content for ${fileName}`;
  const commitMessage = `Add ${fileName}`;

  await signIn(page, 'file-contributor@example.test', 'Valid-password-123!');
  await expect(
    page.getByText('file-contributor', { exact: true }).first()
  ).toBeVisible();

  await openRepository(page, 'file-management-demo');
  await clickAddFileThenCreateNewFile(page);

  await page.getByLabel('File name', { exact: true }).fill(fileName);
  await page.getByLabel('File contents', { exact: true }).fill(content);
  await page.getByLabel('Commit message', { exact: true }).fill(commitMessage);
  await page.getByRole('button', { name: 'Commit changes', exact: true }).click();

  await expect(page.getByText(content, { exact: true }).first()).toBeVisible();

  await page.getByRole('link', { name: 'Commits', exact: true }).first().click();
  await expect(
    page.getByText(commitMessage, { exact: true }).first()
  ).toBeVisible();
});

test('REQ-4-4#2: REQ-4-4: Manage Repository Files Through the Web Interface - Scenario 2', async ({
  page,
}) => {
  await signIn(page, 'file-contributor@example.test', 'Valid-password-123!');
  await expect(
    page.getByText('file-contributor', { exact: true }).first()
  ).toBeVisible();

  await openRepository(page, 'file-management-demo');
  await clickAddFileThenCreateNewFile(page);

  await page.getByLabel('File name', { exact: true }).fill('../invalid.md');
  await page.getByLabel('File contents', { exact: true }).fill('must not be saved');
  await page.getByRole('button', { name: 'Commit changes', exact: true }).click();

  await expect(
    page
      .getByText('Invalid file path', { exact: true })
      .or(page.getByText('Commit message is required', { exact: true }))
  ).toBeVisible();
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

