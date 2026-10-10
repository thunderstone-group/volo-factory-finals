const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function openSignIn(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
}

async function signIn(page, login, password) {
  await openSignIn(page);
  await page.getByLabel('Username or email', { exact: true }).fill(login);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function expectAccountMenuWithUsername(page, username) {
  const menuButton = page.getByRole('button', { name: 'Account menu', exact: true });
  await expect(menuButton).toBeVisible();
  await menuButton.click();
  await expect(page.getByRole('link', { name: 'Sign out', exact: true })).toBeVisible();
  await expect(page.getByText(username, { exact: true }).first()).toBeVisible();
}

test('REQ-1-1-1: REQ-1-1-1: Register a New GitHub Account - Scenario 1', async ({ page }) => {
  const username = `pw-user-${u()}`;
  const email = `${username}@example.test`;
  const password = 'Valid-password-123!';

  await openSignIn(page);
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();

  const usernameField = page.getByLabel('Username', { exact: true });
  const emailField = page.getByLabel('Email', { exact: true });
  const passwordField = page.getByLabel('Password', { exact: true });
  const confirmField = page.getByLabel('Confirm password', { exact: true });
  const createButton = page.getByRole('button', { name: 'Create account', exact: true });

  await usernameField.fill('-bad');
  await emailField.fill('not-an-email');
  await passwordField.fill('short');
  await confirmField.fill('different');
  await createButton.click();

  await expect(page.getByText('Username format is invalid', { exact: true })).toBeVisible();
  await expect(page.getByText('Email format is invalid', { exact: true })).toBeVisible();
  await expect(page.getByText('Password requirements are not satisfied', { exact: true })).toBeVisible();
  await expect(page.getByText('Agree to terms is required', { exact: true })).toBeVisible();
  await expect(usernameField).toHaveValue('-bad');
  await expect(emailField).toHaveValue('not-an-email');
  await expect(passwordField).toHaveValue('');
  await expect(confirmField).toHaveValue('');
  await expect(createButton).toBeEnabled();

  await usernameField.fill(username);
  await emailField.fill(email);
  await passwordField.fill(password);
  await confirmField.fill(password);
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
  await createButton.click();

  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await page.getByLabel('Username or email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expectAccountMenuWithUsername(page, username);
  await page.reload();
  await expectAccountMenuWithUsername(page, username);
});

test.skip('REQ-1-1-1#2: REQ-1-1-1: Register a New GitHub Account - Scenario 2', () => {
  // The scenario asks a signed-in user to follow the registration workflow, but the requirements expose registration only to visitors via “Sign in” → “Create an account”; no registration entry exists for signed-in users.
});

test.skip('REQ-1-1-1#3: REQ-1-1-1: Register a New GitHub Account - Scenario 3', () => {
  // The scenario asks a signed-in user to follow the registration workflow, but the requirements expose registration only to visitors via “Sign in” → “Create an account”; no registration entry exists for signed-in users.
});

test('REQ-1-1-2: REQ-1-1-2: Sign In with an Existing Account - Scenario 1', async ({ page }) => {
  await openSignIn(page);
  await page.getByLabel('Username or email', { exact: true }).fill('no-such-account');
  await page.getByLabel('Password', { exact: true }).fill('Wrong-password-123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeHidden();

  await page.getByLabel('Username or email', { exact: true }).fill('alice-dev');
  await page.getByLabel('Password', { exact: true }).fill('Valid-password-123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expectAccountMenuWithUsername(page, 'alice-dev');
  await page.reload();
  await expectAccountMenuWithUsername(page, 'alice-dev');
});

test('REQ-1-1-2#2: REQ-1-1-2: Sign In with an Existing Account - Scenario 2', async ({ page }) => {
  await signIn(page, 'alice-dev', 'Valid-password-123!');

  await expectAccountMenuWithUsername(page, 'alice-dev');
  await page.reload();
  await expectAccountMenuWithUsername(page, 'alice-dev');
});

test('REQ-1-1-2#3: REQ-1-1-2: Sign In with an Existing Account - Scenario 3', async ({ page }) => {
  await signIn(page, 'alice.dev@example.test', 'Valid-password-123!');

  await expectAccountMenuWithUsername(page, 'alice-dev');
  await page.reload();
  await expectAccountMenuWithUsername(page, 'alice-dev');
});

test('REQ-1-1-2#4: REQ-1-1-2: Sign In with an Existing Account - Scenario 4', async ({ page }) => {
  await openSignIn(page);
  await page.getByLabel('Username or email', { exact: true }).fill('alice-dev');
  await page.getByLabel('Password', { exact: true }).fill('Wrong-password-123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeHidden();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeHidden();
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

