const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

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
  await page.getByRole('searchbox', { name: 'Search', exact: true }).fill(repoName);
  await page.getByRole('searchbox', { name: 'Search', exact: true }).press('Enter');
  await page.getByRole('link', { name: repoName, exact: true }).click();
  await expect(page.getByRole('link', { name: 'Code', exact: true })).toBeVisible();
}

async function openPullRequest(page, title, status) {
  await openRepository(page);
  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  if (status) {
    await page.getByRole('link', { name: status, exact: true }).click();
  }
  await page.getByRole('link', { name: title, exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}

async function openNewPullRequestComparison(page, baseBranch, compareBranch, changedPath) {
  await openRepository(page);
  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await page.getByRole('link', { name: 'New pull request', exact: true }).click();
  await page.getByRole('combobox', { name: 'base', exact: true }).selectOption({ label: baseBranch });
  await page.getByRole('combobox', { name: 'compare', exact: true }).selectOption({ label: compareBranch });
  await page.getByRole('button', { name: 'Compare changes', exact: true }).click();
  await expect(page.getByText(changedPath, { exact: true })).toBeVisible();
}

async function createBranchAndFile(page) {
  const branch = 'pw-branch-' + u();
  const filePath = 'pw-file-' + u() + '.md';
  await openRepository(page);
  await page.getByRole('button', { name: 'Branch main', exact: true }).click();
  await page.getByLabel('Find branch', { exact: true }).fill(branch);
  await page.getByRole('option', { name: `Create branch: ${branch}`, exact: true }).click();
  await expect(page.getByRole('button', { name: `Branch ${branch}`, exact: true })).toBeVisible();

  const content = 'Unique content ' + u();
  await page.getByRole('button', { name: 'Add file', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Create new file', exact: true }).click();
  await page.getByLabel('File name', { exact: true }).fill(filePath);
  await page.getByLabel('File contents', { exact: true }).fill(content);
  await page.getByLabel('Commit message', { exact: true }).fill('Add ' + filePath);
  await page.getByRole('button', { name: 'Commit changes', exact: true }).click();
  await expect(page.getByText(content, { exact: true })).toBeVisible();

  return { branch, filePath };
}

async function clickConfirmIfAppears(page) {
  const confirm = page.getByRole('button', { name: 'Confirm', exact: true });
  try {
    await confirm.waitFor({ state: 'visible', timeout: 2000 });
    await confirm.click();
  } catch {
    // No confirmation step was shown.
  }
}

test('REQ-6-2-3: Create a Pull Request from Comparison Results - Scenario 1', async ({ page }) => {
  const title = 'PW PR ' + u();
  await signIn(page);
  await openNewPullRequestComparison(page, 'main', 'feature-search', 'src/search.ts');

  await expect(page.getByRole('button', { name: 'Create pull request', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Create pull request', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Description', { exact: true }).fill('Description ' + u());
  await page.getByRole('button', { name: 'Create pull request', exact: true }).click();

  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await page.getByRole('link', { name: 'Open', exact: true }).click();
  await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();
});

test('REQ-6-2-3#2: Create a Pull Request from Comparison Results - Scenario 2', async ({ page }) => {
  await signIn(page);
  const { branch, filePath } = await createBranchAndFile(page);
  await openNewPullRequestComparison(page, 'main', branch, filePath);

  const createPr = page.getByRole('button', { name: 'Create pull request', exact: true });
  await expect(createPr).toBeEnabled();

  await page.getByRole('combobox', { name: 'compare', exact: true }).selectOption({ label: 'main' });
  await expect(page.getByText('No changes', { exact: true })).toBeVisible();
  await expect(createPr).toBeDisabled();

  await page.reload();
  await expect(page.getByText('No changes', { exact: true })).toBeVisible();
  await expect(createPr).toBeDisabled();
});

test('REQ-6-2-4: Create a Draft Pull Request - Scenario 1', async ({ page }) => {
  const title = 'PW Draft ' + u();
  await signIn(page);
  const { branch, filePath } = await createBranchAndFile(page);
  await openNewPullRequestComparison(page, 'main', branch, filePath);

  await page.getByRole('button', { name: 'Create draft pull request', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Description', { exact: true }).fill('Draft description ' + u());
  await page.getByRole('button', { name: 'Create draft pull request', exact: true }).click();

  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText('Draft', { exact: true })).toBeVisible();

  const merge = page.getByRole('button', { name: 'Merge pull request', exact: true });
  await expect(merge).toBeDisabled();

  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText('Draft', { exact: true })).toBeVisible();
  await expect(merge).toBeDisabled();

  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await page.getByRole('link', { name: 'Draft', exact: true }).click();
  await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();
});

test('REQ-6-2-4#2: Create a Draft Pull Request - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openPullRequest(page, 'Draft onboarding update', 'Draft');

  await expect(page.getByText('Draft', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ready for review', exact: true }).click();
  await clickConfirmIfAppears(page);

  await expect(page.getByRole('heading', { name: 'Draft onboarding update', exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ready for review', exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Draft onboarding update', exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true })).toBeVisible();
});

test('REQ-6-3-1: View Pull Request Overview and Commits - Scenario 1', async ({ page }) => {
  const title = 'Improve onboarding';
  await openPullRequest(page, title, 'Open');

  await page.getByRole('link', { name: 'Conversation', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Commits', exact: true }).click();
  await expect(page.getByText('Commit summary', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await expect(page.getByText('Changed files', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
});

test('REQ-6-3-1#2: View Pull Request Overview and Commits - Scenario 2', async ({ page }) => {
  const title = 'Improve onboarding';
  await signIn(page);
  await openPullRequest(page, title, 'Open');

  await page.getByRole('link', { name: 'Conversation', exact: true }).click();
  await page.getByRole('link', { name: 'Commits', exact: true }).click();
  await expect(page.getByText('Commit summary', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Files changed', exact: true })).toBeVisible();
});

test('REQ-6-3-1#3: View Pull Request Overview and Commits - Scenario 3', async ({ page }) => {
  const title = 'Improve onboarding';
  await signIn(page);
  await openPullRequest(page, title, 'Open');

  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await expect(page.getByText('Changed files', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Commits', exact: true })).toBeVisible();
});

test('REQ-6-3-2: Inspect Changed Files and Aggregate Diff - Scenario 1', async ({ page }) => {
  await openPullRequest(page, 'Fix search', 'Closed');

  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await expect(page.getByText('src/search.ts', { exact: true })).toBeVisible();
  await expect(page.getByText(/\d+ additions, \d+ deletions/)).toBeVisible();

  await page.reload();
  await expect(page.getByText('src/search.ts', { exact: true })).toBeVisible();
  await expect(page.getByText(/\d+ additions, \d+ deletions/)).toBeVisible();
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

