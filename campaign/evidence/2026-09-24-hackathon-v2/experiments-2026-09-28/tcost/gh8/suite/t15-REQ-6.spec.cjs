const { test, expect: baseExpect } = require('@playwright/test');

const expect = baseExpect.configure({ timeout: 5000 });
test.setTimeout(15000);
test.use({ actionTimeout: 5000 });

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function signIn(page, usernameOrEmail, password) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(usernameOrEmail);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
}

async function registerAndSignIn(page, username, email, password) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
}

async function openRepository(page, repoName) {
  const search = page.getByRole('searchbox', { name: 'Search', exact: true });
  await search.fill(repoName);
  await search.press('Enter');
  await page.getByRole('link', { name: repoName, exact: true }).click();
  await expect(page.getByRole('link', { name: 'Pull requests', exact: true })).toBeVisible();
}

async function openFirstOpenPullRequest(page) {
  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await page.getByRole('link', { name: 'Open', exact: true }).click();
  const prLink = page.getByRole('link', { name: /^(Improve onboarding|Fix search)$/ }).first();
  await expect(prLink).toBeVisible();
  await prLink.click();
  await expect(
    page.getByRole('heading', { name: /^(Improve onboarding|Fix search)$/ }).first()
  ).toBeVisible();
}

test('REQ-6-6: Close or Reopen a Pull Request Without Merging - Scenario 1', async ({ page }) => {
  await signIn(page, 'alice-dev', 'Valid-password-123!');
  await openRepository(page, 'acme-docs');
  await openFirstOpenPullRequest(page);

  await expect(page.getByRole('button', { name: 'Close pull request', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close pull request', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reopen pull request', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close pull request', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Reopen pull request', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Close pull request', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reopen pull request', exact: true })).toHaveCount(0);

  await page.reload();
  await expect(
    page.getByRole('heading', { name: /^(Improve onboarding|Fix search)$/ }).first()
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close pull request', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await expect(page.getByText(/Changed files/).first()).toBeVisible();
});

test('REQ-6-6: Close or Reopen a Pull Request Without Merging - Scenario 2', async ({ page }) => {
  const suffix = u();
  const username = `pw-viewer-${suffix}`;
  const email = `${username}@example.test`;
  const password = 'Valid-password-123!';

  await registerAndSignIn(page, username, email, password);
  await openRepository(page, 'acme-docs');
  await openFirstOpenPullRequest(page);

  await expect(
    page.getByRole('heading', { name: /^(Improve onboarding|Fix search)$/ }).first()
  ).toBeVisible();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close pull request', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reopen pull request', exact: true })).toHaveCount(0);

  await page.reload();
  await expect(
    page.getByRole('heading', { name: /^(Improve onboarding|Fix search)$/ }).first()
  ).toBeVisible();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close pull request', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reopen pull request', exact: true })).toHaveCount(0);
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

