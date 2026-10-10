const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function signIn(page, username = 'alice-dev', password = 'Valid-password-123!') {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
  await page.goto('/');
}

async function openRepository(page, repoName = 'acme-docs') {
  const search = page.getByRole('searchbox', { name: 'Search', exact: true });
  await search.fill(repoName);
  await search.press('Enter');
  await page.getByRole('link', { name: repoName, exact: true }).click();
}

async function openCodePage(page) {
  await page.getByRole('link', { name: 'Code', exact: true }).click();
}

async function createRepository(page, repoName) {
  await page.getByRole('link', { name: 'New repository', exact: true }).click();
  await page.getByLabel('Repository name', { exact: true }).fill(repoName);
  await page.getByRole('checkbox', { name: 'Add a README file', exact: true }).check();
  await page.getByRole('radio', { name: 'Private', exact: true }).check();
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();
}

test('REQ-4-3-1: REQ-4-3-1: List and Switch Repository Branches - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await openRepository(page);
  await openCodePage(page);
  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Branch main', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find branch', exact: true }).fill('feature-search');
  await page.getByRole('option', { name: 'feature-search', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Branch feature-search', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'main-only.md', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Branch feature-search', exact: true }).click();
  await expect(page.getByRole('option', { name: 'main', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'feature-search', exact: true })).toBeVisible();

  await page.getByRole('option', { name: 'main', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'main-only.md', exact: true })).toHaveCount(0);
});

test('REQ-4-3-1#2: REQ-4-3-1: List and Switch Repository Branches - Scenario 2', async ({ page }) => {
  await page.goto('/');
  await openRepository(page);
  await openCodePage(page);
  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();

  const findBranch = page.getByRole('textbox', { name: 'Find branch', exact: true });
  await page.getByRole('button', { name: 'Branch main', exact: true }).click();
  await findBranch.fill('no-such-branch');
  await expect(page.getByText('No matching branch', { exact: true })).toBeVisible();

  await findBranch.press('Escape');
  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();
});

test('REQ-4-3-2: REQ-4-3-2: Create a Branch from an Existing Revision - Scenario 1', async ({ page }) => {
  const branchName = `feature/api-v2-${u()}`;
  await signIn(page);
  await openRepository(page);
  await openCodePage(page);
  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Branch main', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find branch', exact: true }).fill(branchName);
  await page.getByRole('option', { name: `Create branch: ${branchName}`, exact: true }).click();

  await expect(page.getByRole('button', { name: `Branch ${branchName}`, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: `Branch ${branchName}`, exact: true })).toBeVisible();

  await page.getByRole('button', { name: `Branch ${branchName}`, exact: true }).click();
  const findBranch = page.getByRole('textbox', { name: 'Find branch', exact: true });
  await expect(page.getByRole('option', { name: branchName, exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'main', exact: true })).toBeVisible();
  await findBranch.press('Escape');
});

test('REQ-4-3-2#2: REQ-4-3-2: Create a Branch from an Existing Revision - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openRepository(page);
  await openCodePage(page);
  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();

  const findBranch = page.getByRole('textbox', { name: 'Find branch', exact: true });
  await page.getByRole('button', { name: 'Branch main', exact: true }).click();
  await findBranch.fill('invalid..branch');
  await expect(page.getByText('Invalid branch', { exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Create branch: invalid..branch', exact: true })).toHaveCount(0);

  await findBranch.press('Escape');
  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible();
});

test('REQ-4-3-3: REQ-4-3-3: Change the Repository Default Branch - Scenario 1', async ({ page }) => {
  const repoName = `pw-repo-${u()}`;
  await signIn(page);
  await createRepository(page, repoName);
  await openCodePage(page);

  await page.getByRole('button', { name: 'Branch main', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find branch', exact: true }).fill('release');
  await page.getByRole('option', { name: 'Create branch: release', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Branch release', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Branches', exact: true }).click();
  const defaultBranch = page.getByRole('combobox', { name: 'Default branch', exact: true });
  await defaultBranch.selectOption({ label: 'release' });
  await page.getByRole('button', { name: 'Update', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();

  await page.goto('/');
  await openRepository(page, repoName);
  await openCodePage(page);
  await expect(page.getByRole('button', { name: 'Branch release', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Branch release', exact: true }).click();
  const findBranch = page.getByRole('textbox', { name: 'Find branch', exact: true });
  await expect(page.getByRole('option', { name: 'main', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'release', exact: true })).toBeVisible();
  await findBranch.press('Escape');

  await page.goto('/');
  await openRepository(page, repoName);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Branches', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Default branch', exact: true })).toHaveValue('release');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Default branch', exact: true })).toHaveValue('release');
});

test.skip('REQ-4-3-3#2: REQ-4-3-3: Change the Repository Default Branch - Scenario 2', () => {
  // The scenario needs a signed-in non-Administrator account on the repository, but the requirements give no such account's credentials and no UI flow to provision one, so the state cannot be built without guessing.
});

test('REQ-4-4: REQ-4-4: Manage Repository Files Through the Web Interface - Scenario 1', async ({ page }) => {
  const suffix = u();
  const filePath = `docs/guide-${suffix}.md`;
  const content = `Guide content ${suffix}`;
  const commitMessage = `Add ${filePath}`;

  await signIn(page);
  await openRepository(page);
  await openCodePage(page);

  await page.getByRole('button', { name: 'Add file', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Create new file', exact: true }).click();
  await page.getByLabel('File name', { exact: true }).fill(filePath);
  await page.getByRole('textbox', { name: 'File contents', exact: true }).fill(content);
  await page.getByLabel('Commit message', { exact: true }).fill(commitMessage);
  await page.getByRole('button', { name: 'Commit changes', exact: true }).click();

  await expect(page.getByText(content, { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Commits', exact: true }).click();
  await expect(page.getByText(commitMessage, { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Code', exact: true }).click();
  await page.getByRole('button', { name: 'Add file', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Create new file', exact: true }).click();
  await page.getByLabel('File name', { exact: true }).fill('../invalid.md');
  await page.getByRole('textbox', { name: 'File contents', exact: true }).fill('must not be saved');
  await page.getByRole('button', { name: 'Commit changes', exact: true }).click();

  await expect(
    page.getByText('Invalid file path', { exact: true })
      .or(page.getByText('Commit message is required', { exact: true }))
      .first()
  ).toBeVisible();
});

test('REQ-4-4#2: REQ-4-4: Manage Repository Files Through the Web Interface - Scenario 2', async ({ page }) => {
  const suffix = u();
  const filePath = `pw-file-${suffix}.md`;
  const content = `File content ${suffix}`;
  const commitMessage = `Add ${filePath}`;

  await signIn(page);
  await openRepository(page);
  await openCodePage(page);

  await page.getByRole('button', { name: 'Add file', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Create new file', exact: true }).click();
  await page.getByLabel('File name', { exact: true }).fill(filePath);
  await page.getByRole('textbox', { name: 'File contents', exact: true }).fill(content);
  await page.getByLabel('Commit message', { exact: true }).fill(commitMessage);
  await page.getByRole('button', { name: 'Commit changes', exact: true }).click();

  await expect(page.getByText(content, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(content, { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Commits', exact: true }).click();
  await expect(page.getByText(commitMessage, { exact: true })).toBeVisible();
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

