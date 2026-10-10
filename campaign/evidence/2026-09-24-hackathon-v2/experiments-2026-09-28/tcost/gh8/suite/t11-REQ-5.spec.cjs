const { test, expect } = require('@playwright/test');

const SEED_USERNAME = 'alice-dev';
const SEED_PASSWORD = 'Valid-password-123!';
const REPO = 'acme-docs';
const ISSUE_TITLE = 'Improve onboarding';
const ISSUE_DESCRIPTION = 'Describe the onboarding improvement.';

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function signIn(page, username, password) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
}

async function registerAndSignIn(page) {
  const username = `pw-user-${u()}`;
  const email = `${u()}@example.test`;

  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();

  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(SEED_PASSWORD);
  await page.getByLabel('Confirm password', { exact: true }).fill(SEED_PASSWORD);
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();

  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(SEED_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
}

async function openIssue(page) {
  await page.goto('/');
  await page.getByRole('searchbox', { name: 'Search', exact: true }).fill(REPO);
  await page.getByRole('searchbox', { name: 'Search', exact: true }).press('Enter');
  await page.getByRole('link', { name: REPO, exact: true }).first().click();
  await page.getByRole('link', { name: 'Issues', exact: true }).click();
  await page.getByRole('link', { name: 'Open', exact: true }).first().click();
  await page.getByRole('link', { name: ISSUE_TITLE, exact: true }).click();
  await expect(page.getByRole('heading', { name: ISSUE_TITLE, exact: true })).toBeVisible();
}

test('REQ-5-4: Close or Reopen an Issue - Scenario 1', async ({ page }) => {
  await signIn(page, SEED_USERNAME, SEED_PASSWORD);
  await openIssue(page);

  await expect(page.getByRole('button', { name: 'Close issue', exact: true })).toBeEnabled();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Close issue', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reopen issue', exact: true })).toBeEnabled();
  await expect(page.getByText('Closed', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Closed issue', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Reopen issue', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Close issue', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Reopen issue', exact: true })).toHaveCount(0);
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Closed issue', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: ISSUE_TITLE, exact: true })).toBeVisible();
  await expect(page.getByText(ISSUE_DESCRIPTION, { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: ISSUE_TITLE, exact: true })).toBeVisible();
  await expect(page.getByText(ISSUE_DESCRIPTION, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close issue', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Reopen issue', exact: true })).toHaveCount(0);
  await expect(page.getByText('Closed issue', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
});

test('REQ-5-4: Close or Reopen an Issue - Scenario 2', async ({ page }) => {
  await registerAndSignIn(page);
  await openIssue(page);

  await expect(page.getByRole('heading', { name: ISSUE_TITLE, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close issue', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reopen issue', exact: true })).toHaveCount(0);
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: ISSUE_TITLE, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close issue', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reopen issue', exact: true })).toHaveCount(0);
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

