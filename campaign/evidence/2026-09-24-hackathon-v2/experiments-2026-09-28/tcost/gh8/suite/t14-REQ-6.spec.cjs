const { test, expect } = require('@playwright/test');

const SEED_REPO = 'acme-docs';
const ALICE = 'alice-dev';
const PASSWORD = 'Valid-password-123!';
const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function signIn(page, login) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(login);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
}

async function signOut(page) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm sign out', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
}

async function registerUser(page, username, email) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password', { exact: true }).fill(PASSWORD);
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
}

async function openRepository(page, repoName = SEED_REPO) {
  const search = page.getByRole('searchbox', { name: 'Search', exact: true });
  await search.fill(repoName);
  await search.press('Enter');
  await page.getByRole('link', { name: repoName, exact: true }).first().click();
}

async function grantWrite(page, username) {
  await openRepository(page, SEED_REPO);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Manage access', exact: true }).click();
  await page.getByRole('button', { name: 'Add people or teams', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search', exact: true }).fill(username);
  await page.getByRole('option', { name: username, exact: true }).click();
  await page.getByRole('combobox', { name: 'Role', exact: true }).first().click();
  await page.getByRole('option', { name: 'Write', exact: true }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText(username, { exact: true }).first()).toBeVisible();
}

async function createPullRequest(page, title, branchName) {
  await openRepository(page, SEED_REPO);
  await page.getByRole('link', { name: 'Code', exact: true }).click();
  await page.getByRole('button', { name: 'Branch main', exact: true }).click();
  await page.getByLabel('Find branch', { exact: true }).fill(branchName);
  await page.getByRole('option', { name: `Create branch: ${branchName}`, exact: true }).click();
  await expect(page.getByRole('button', { name: `Branch ${branchName}`, exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Add file', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Create new file', exact: true }).click();
  await page.getByLabel('File name', { exact: true }).fill(`pw-file-${u()}.md`);
  await page.getByLabel('File contents', { exact: true }).fill(`# ${branchName}\ncontent ${u()}`);
  await page.getByLabel('Commit message', { exact: true }).fill(`Add ${branchName}`);
  await page.getByRole('button', { name: 'Commit changes', exact: true }).click();

  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await page.getByRole('link', { name: 'New pull request', exact: true }).click();
  await page.getByRole('combobox', { name: 'base', exact: true }).selectOption('main');
  await page.getByRole('combobox', { name: 'compare', exact: true }).selectOption({ label: branchName });
  await page.getByRole('button', { name: 'Compare changes', exact: true }).click();
  await page.getByRole('button', { name: 'Create pull request', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByRole('button', { name: 'Create pull request', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}

async function openPr(page, title) {
  await openRepository(page, SEED_REPO);
  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await page.getByRole('link', { name: title, exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}

async function createAuthorWithAccess(page) {
  const username = `pw-author-${u()}`;
  const email = `${username}@example.test`;
  const branch = `pw-branch-${u()}`;
  const title = `PW PR ${u()}`;
  await registerUser(page, username, email);
  await signIn(page, ALICE);
  await grantWrite(page, username);
  await signOut(page);
  await signIn(page, username);
  await createPullRequest(page, title, branch);
  return { username, title };
}

async function submitReview(page, decision, summary) {
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await page.getByRole('button', { name: 'Review changes', exact: true }).click();
  await page.getByLabel('Summary', { exact: true }).fill(summary);
  await page.getByRole('radio', { name: decision, exact: true }).check();
  await page.getByRole('button', { name: 'Submit review', exact: true }).click();
  await page.getByRole('link', { name: 'Conversation', exact: true }).click();
}

async function setCheckSuccess(page) {
  await page.getByRole('link', { name: 'Checks', exact: true }).click();
  await expect(page.getByText('test: pending', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'test status', exact: true }).click();
  await page.getByRole('option', { name: 'success', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('test: success', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Conversation', exact: true }).click();
}

test('REQ-6-3-3: Add Review Comments to Changed Code Lines - Scenario 1', async ({ page }) => {
  const author = await createAuthorWithAccess(page);
  await signOut(page);
  await signIn(page, ALICE);
  await openPr(page, author.title);

  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  const comment = `Inline comment ${u()}`;
  await page.getByRole('button', { name: 'Add comment', exact: true }).first().click();
  await page.getByRole('textbox', { name: 'Comment', exact: true }).fill(comment);
  await page.getByRole('button', { name: 'Add single comment', exact: true }).click();

  await page.getByRole('link', { name: 'Conversation', exact: true }).click();
  await expect(page.getByText(comment, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(comment, { exact: true })).toBeVisible();
});

test('REQ-6-3-3: Add Review Comments to Changed Code Lines - Scenario 2', async ({ page }) => {
  const author = await createAuthorWithAccess(page);
  await signOut(page);
  await signIn(page, ALICE);
  await openPr(page, author.title);

  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  const comment = `Pending comment ${u()}`;
  await page.getByRole('button', { name: 'Add comment', exact: true }).first().click();
  await page.getByRole('textbox', { name: 'Comment', exact: true }).fill(comment);
  await page.getByRole('button', { name: 'Start a review', exact: true }).click();

  await expect(page.getByText(comment, { exact: true })).toBeVisible();
  await expect(page.getByText('Pending review', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(comment, { exact: true })).toBeVisible();
  await expect(page.getByText('Pending review', { exact: true })).toBeVisible();
});

test('REQ-6-3-4: Submit a Pull Request Review - Scenario 1', async ({ page }) => {
  const author = await createAuthorWithAccess(page);
  await signOut(page);
  await signIn(page, ALICE);
  await openPr(page, author.title);

  const summary = `Approved by alice ${u()}`;
  await submitReview(page, 'Approve', summary);
  await expect(page.getByText('Approved', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(summary, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Approved', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(summary, { exact: true })).toBeVisible();
});

test('REQ-6-3-4: Submit a Pull Request Review - Scenario 2', async ({ page }) => {
  const author = await createAuthorWithAccess(page);
  await signOut(page);
  await signIn(page, ALICE);
  await openPr(page, author.title);

  const summary = `Requested changes ${u()}`;
  await submitReview(page, 'Request changes', summary);
  await expect(page.getByText('Changes requested', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(summary, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Changes requested', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(summary, { exact: true })).toBeVisible();
});

test('REQ-6-4: Request or Remove Pull Request Reviewers - Scenario 1', async ({ page }) => {
  const author = await createAuthorWithAccess(page);

  await page.getByRole('button', { name: 'Reviewers', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search', exact: true }).fill(ALICE);
  await page.getByRole('option', { name: ALICE, exact: true }).click();

  await expect(page.getByRole('button', { name: `Remove ${ALICE}`, exact: true })).toBeVisible();
  await page.getByRole('button', { name: `Remove ${ALICE}`, exact: true }).click();
  await expect(page.getByRole('button', { name: `Remove ${ALICE}`, exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('button', { name: `Remove ${ALICE}`, exact: true })).toHaveCount(0);
});

test('REQ-6-5: Merge an Eligible Pull Request - Scenario 1', async ({ page }) => {
  const author = await createAuthorWithAccess(page);
  await signOut(page);
  await signIn(page, ALICE);
  await openPr(page, author.title);

  await submitReview(page, 'Approve', `LGTM ${u()}`);
  await expect(page.getByText('Approved', { exact: true }).first()).toBeVisible();

  await setCheckSuccess(page);

  await expect(page.getByRole('button', { name: 'Merge pull request', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Merge pull request', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm merge', exact: true }).click();
  await expect(page.getByText('Merged', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('Merged', { exact: true }).first()).toBeVisible();
});

test('REQ-6-5: Merge an Eligible Pull Request - Scenario 2', async ({ page }) => {
  await signIn(page, ALICE);
  await openPr(page, 'Improve onboarding');
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Merge pull request', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Merge pull request', exact: true })).toBeVisible();
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

