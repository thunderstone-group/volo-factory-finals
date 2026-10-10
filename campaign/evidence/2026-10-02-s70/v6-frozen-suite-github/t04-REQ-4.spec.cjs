const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const PASSWORD = 'Valid-password-123!';

// Looks a control up by its exact accessible name across the roles the requirements leave open
// for options/entries that are described only by name (branch options, menu entries, results).
function controlByName(page, name) {
  return page
    .getByRole('link', { name, exact: true })
    .or(page.getByRole('button', { name, exact: true }))
    .or(page.getByRole('menuitem', { name, exact: true }))
    .or(page.getByRole('option', { name, exact: true }))
    .first();
}

async function signIn(page, login) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(login);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
}

// Locates a repository through the documented global search (REQ-3-1) and opens its overview.
async function openRepository(page, repoName) {
  const search = page.getByRole('searchbox', { name: 'Search', exact: true }).first();
  await search.fill(repoName);
  await search.press('Enter');
  await page.getByRole('link', { name: repoName, exact: true }).first().click();
}

// Opens the repository Code page through the repository "Code" navigation link (REQ-3-3, REQ-4-1).
async function openCodePage(page, repoName) {
  await openRepository(page, repoName);
  await page.getByRole('link', { name: 'Code', exact: true }).first().click();
}

// Types into the repository Search box (REQ-4-2-3) and submits with Enter.
async function repositorySearch(page, query) {
  const box = page.getByRole('searchbox', { name: 'Search', exact: true }).last();
  await box.fill(query);
  await box.press('Enter');
}

async function openCodeResults(page) {
  await page
    .getByRole('link', { name: 'Code', exact: true })
    .or(page.getByRole('tab', { name: 'Code', exact: true }))
    .last()
    .click();
}

function noCodeResultsMessage(page) {
  return page.getByText(/no\s+(code\s+)?results/i).first();
}

test('REQ-4-1: Browse Repository Files and Directories - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await openCodePage(page, 'acme-docs');

  const src = page.getByRole('link', { name: 'src', exact: true });
  await expect(src).toBeVisible();
  await src.click();

  const readme = page.getByRole('link', { name: 'README.md', exact: true });
  await expect(readme).toBeVisible();
  await readme.click();

  await expect(page.getByText('Document search flow', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('Document search flow', { exact: true }).first()).toBeVisible();
});

test('REQ-4-2-1: View Repository Commit History - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await openRepository(page, 'acme-docs');

  await page.getByRole('link', { name: /Commits/ }).first().click();

  await expect(page.getByText('Document search flow', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('alice-dev', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/ago/).first()).toBeVisible();
});

test('REQ-4-2-2: Inspect Commit and Revision Differences - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await openRepository(page, 'acme-docs');

  await page.getByRole('link', { name: /Commits/ }).first().click();
  await page.getByRole('link', { name: /Document search flow/ }).first().click();

  await expect(page.getByText('src/search.ts', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Changed files/i).first()).toBeVisible();
  await expect(page.getByText(/\+\d+/).first()).toBeVisible();
  await expect(page.getByText(/-\d+/).first()).toBeVisible();
});

test('REQ-4-2-3: Search Code Within a Repository - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await openCodePage(page, 'acme-docs');

  await repositorySearch(page, 'search flow');
  await openCodeResults(page);
  await page.getByRole('link', { name: 'README.md', exact: true }).first().click();

  await expect(page.getByText('search flow').first()).toBeVisible();
});

test('REQ-4-2-3: Search Code Within a Repository - Scenario 2', async ({ page }) => {
  await page.goto('/');
  await openCodePage(page, 'acme-docs');

  await repositorySearch(page, 'no-such-token');
  await openCodeResults(page);

  await expect(noCodeResultsMessage(page)).toBeVisible();
  await expect(
    page.getByRole('searchbox', { name: 'Search', exact: true }).last()
  ).toHaveValue('no-such-token');
});

test('REQ-4-2-3: Search Code Within a Repository - Scenario 3', async ({ page }) => {
  await page.goto('/');
  await openCodePage(page, 'acme-docs');

  await repositorySearch(page, 'search flow');
  await openCodeResults(page);
  await page.getByRole('link', { name: 'README.md', exact: true }).first().click();

  await expect(page.getByText('search flow').first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('search flow').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'README.md', exact: true }).first()).toBeVisible();
});

test('REQ-4-2-3: Search Code Within a Repository - Scenario 4', async ({ page }) => {
  await page.goto('/');
  await openCodePage(page, 'acme-docs');

  await repositorySearch(page, 'no-such-token');
  await openCodeResults(page);
  await expect(noCodeResultsMessage(page)).toBeVisible();

  await page.goBack();
  await repositorySearch(page, 'no-such-token');
  await openCodeResults(page);
  await expect(noCodeResultsMessage(page)).toBeVisible();
});

test('REQ-4-3-1: List and Switch Repository Branches - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await openCodePage(page, 'branch-switch-demo');

  const mainButton = page.getByRole('button', { name: 'Branch main', exact: true });
  await expect(mainButton).toBeVisible();
  await mainButton.click();

  await page.getByRole('textbox', { name: 'Find branch', exact: true }).fill('feature-search');
  await controlByName(page, 'feature-search').click();

  await expect(
    page.getByRole('button', { name: 'Branch feature-search', exact: true })
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'main-only.md', exact: true })).toBeVisible();
});

test('REQ-4-3-1: List and Switch Repository Branches - Scenario 2', async ({ page }) => {
  await page.goto('/');
  await openCodePage(page, 'branch-switch-demo');

  await page.getByRole('button', { name: 'Branch main', exact: true }).click();

  const findBranch = page.getByRole('textbox', { name: 'Find branch', exact: true });
  await findBranch.fill('missing-branch');
  await expect(page.getByText('No matching branch').first()).toBeVisible();
  await findBranch.press('Escape');

  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();
});

test('REQ-4-3-2: Create a Branch from an Existing Revision - Scenario 1', async ({ page }) => {
  const branchName = `pw-branch-${u()}`;

  await signIn(page, 'branch-contributor@example.test');
  await openCodePage(page, 'branch-switch-demo');

  await page.getByRole('button', { name: 'Branch main', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find branch', exact: true }).fill(branchName);
  await controlByName(page, `Create branch: ${branchName}`).click();

  await expect(page.getByRole('button', { name: `Branch ${branchName}`, exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: `Branch ${branchName}`, exact: true })).toBeVisible();
});

test('REQ-4-3-2: Create a Branch from an Existing Revision - Scenario 2', async ({ page }) => {
  await signIn(page, 'branch-contributor@example.test');
  await openCodePage(page, 'branch-switch-demo');

  await page.getByRole('button', { name: 'Branch main', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find branch', exact: true }).fill('invalid..branch');

  await expect(page.getByText('Invalid branch').first()).toBeVisible();
});

test('REQ-4-3-3: Change the Repository Default Branch - Scenario 1', async ({ page }) => {
  await signIn(page, 'default-branch-admin@example.test');
  await openRepository(page, 'default-branch-demo');

  await page.getByRole('link', { name: 'Settings', exact: true }).first().click();
  await page.getByRole('link', { name: 'Branches', exact: true }).first().click();

  await page.getByLabel('Default branch', { exact: true }).selectOption('release');
  await page.getByRole('button', { name: 'Update', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();

  await page.goto('/');
  await openCodePage(page, 'default-branch-demo');

  const releaseButton = page.getByRole('button', { name: 'Branch release', exact: true });
  await expect(releaseButton).toBeVisible();
  await releaseButton.click();
  await expect(controlByName(page, 'main')).toBeVisible();
});

test('REQ-4-3-3: Change the Repository Default Branch - Scenario 2', async ({ page }) => {
  await signIn(page, 'default-branch-viewer@example.test');
  await openRepository(page, 'default-branch-demo');

  const settings = page.getByRole('link', { name: 'Settings', exact: true });
  if ((await settings.count()) > 0) {
    await settings.first().click();
    const branches = page.getByRole('link', { name: 'Branches', exact: true });
    if ((await branches.count()) > 0) {
      await branches.first().click();
    }
  }

  await expect(
    page.getByRole('combobox', { name: 'Default branch', exact: true })
  ).toHaveCount(0);
  await expect(
    page
      .getByRole('button', { name: 'Update default branch', exact: true })
      .or(page.getByRole('button', { name: 'Update', exact: true }))
  ).toHaveCount(0);
});

test('REQ-4-4: Manage Repository Files Through the Web Interface - Scenario 1', async ({ page }) => {
  const fileName = `pw-file-${u()}.md`;
  const content = `File content ${u()} for ${fileName}`;

  await signIn(page, 'file-contributor@example.test');
  await openCodePage(page, 'file-management-demo');

  await controlByName(page, 'Add file').click();
  await controlByName(page, 'Create new file').click();

  await page.getByLabel('File name', { exact: true }).fill(fileName);
  await page.getByLabel('File contents', { exact: true }).fill(content);
  await page.getByLabel('Commit message', { exact: true }).fill(`Add ${fileName}`);
  await page.getByRole('button', { name: 'Commit changes', exact: true }).click();

  await expect(page.getByText(content, { exact: true }).first()).toBeVisible();

  await page.getByRole('link', { name: /Commits/ }).first().click();
  await expect(page.getByText(`Add ${fileName}`, { exact: true }).first()).toBeVisible();
});

test('REQ-4-4: Manage Repository Files Through the Web Interface - Scenario 2', async ({ page }) => {
  await signIn(page, 'file-contributor@example.test');
  await openCodePage(page, 'file-management-demo');

  await controlByName(page, 'Add file').click();
  await controlByName(page, 'Create new file').click();

  await page.getByLabel('File name', { exact: true }).fill('../invalid.md');
  await page.getByLabel('File contents', { exact: true }).fill('must not be saved');
  await page.getByRole('button', { name: 'Commit changes', exact: true }).click();

  const invalidSubmission = page
    .getByText('Invalid file path', { exact: true })
    .or(page.getByText('Commit message is required', { exact: true }))
    .first();
  await expect(invalidSubmission).toBeVisible();
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

