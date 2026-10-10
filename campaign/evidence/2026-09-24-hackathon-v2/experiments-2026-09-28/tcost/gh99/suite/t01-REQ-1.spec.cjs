const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const ALICE_USERNAME = 'alice-dev';
const ALICE_EMAIL = 'alice.dev@example.test';
const ALICE_PASSWORD = 'Valid-password-123!';

async function goToSignIn(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
}

async function openRegistration(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
}

async function registerAccount(page) {
  const unique = u();
  const account = {
    username: `pw-user-${unique}`,
    email: `${unique}@example.test`,
    password: 'Valid-password-123!',
  };

  await openRegistration(page);
  await page.getByLabel('Username', { exact: true }).fill(account.username);
  await page.getByLabel('Email', { exact: true }).fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page.getByLabel('Confirm password', { exact: true }).fill(account.password);
  await page.getByLabel('Agree to the terms', { exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();

  return account;
}

async function attemptSignIn(page, login, password) {
  await goToSignIn(page);
  await page.getByLabel('Username or email', { exact: true }).fill(login);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function expectSignedInAs(page, username) {
  const menuButton = page.getByRole('button', { name: 'Account menu', exact: true });
  await expect(menuButton).toBeVisible();
  await menuButton.click();
  const accountMenu = page.getByRole('menu').filter({
    has: page.getByRole('link', { name: 'Sign out', exact: true }),
  });
  await expect(accountMenu.getByText(username, { exact: true }).first()).toBeVisible();
  await page.keyboard.press('Escape');
}

async function signOut(page, { confirm = true } = {}) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Sign out', exact: true });
  await expect(dialog).toBeVisible();

  if (confirm) {
    await dialog.getByRole('button', { name: 'Confirm sign out', exact: true }).click();
  } else {
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
}

async function expectUnauthenticated(page) {
  const signInEntry = page
    .getByRole('link', { name: 'Sign in', exact: true })
    .or(page.getByRole('button', { name: 'Sign in', exact: true }));
  await expect(signInEntry).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);
}

async function openForgotPassword(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Forgot password', exact: true }).click();
}

async function enterRecoveryEmail(page, email) {
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
  await expect(page.getByText('123456', { exact: true })).toBeVisible();
}

async function submitReset(page, code, newPassword, confirmPassword) {
  await page.getByLabel('Verification code', { exact: true }).fill(code);
  await page.getByLabel('New password', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirm password', { exact: true }).fill(confirmPassword);
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();
}

async function createAccountAndOpenPasswordSettings(page) {
  const account = await registerAccount(page);
  await attemptSignIn(page, account.email, account.password);

  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Password and authentication', exact: true }).click();

  return account;
}

test('REQ-1-1-1: REQ-1-1-1: Register a New GitHub Account - Scenario 1', async ({ page }) => {
  const account = await registerAccount(page);

  await attemptSignIn(page, account.email, account.password);
  await expectSignedInAs(page, account.username);
  await page.reload();
  await expectSignedInAs(page, account.username);
});

test('REQ-1-1-1#2: REQ-1-1-1: Register a New GitHub Account - Scenario 2', async ({ page }) => {
  await openRegistration(page);

  await page.getByLabel('Username', { exact: true }).fill('-bad');
  await page.getByLabel('Email', { exact: true }).fill('not-an-email');
  await page.getByLabel('Password', { exact: true }).fill('short');
  await page.getByLabel('Confirm password', { exact: true }).fill('short');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();

  await expect(page.getByText('Username format is invalid', { exact: true })).toBeVisible();
  await expect(page.getByText('Email format is invalid', { exact: true })).toBeVisible();
  await expect(page.getByText('Password requirements are not satisfied', { exact: true })).toBeVisible();
  await expect(page.getByText('Agree to terms is required', { exact: true })).toBeVisible();

  await expect(page.getByLabel('Username', { exact: true })).toHaveValue('-bad');
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('not-an-email');
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Confirm password', { exact: true })).toHaveValue('');
});

test('REQ-1-1-1#3: REQ-1-1-1: Register a New GitHub Account - Scenario 3', async ({ page }) => {
  const duplicateEmail = `${u()}@example.test`;

  await openRegistration(page);
  await page.getByLabel('Username', { exact: true }).fill(ALICE_USERNAME);
  await page.getByLabel('Email', { exact: true }).fill(duplicateEmail);
  await page.getByLabel('Password', { exact: true }).fill('Valid-password-123!');
  await page.getByLabel('Confirm password', { exact: true }).fill('Valid-password-123!');
  await page.getByLabel('Agree to the terms', { exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();

  await expect(page.getByText('Username already exists', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Username', { exact: true })).toHaveValue(ALICE_USERNAME);
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue(duplicateEmail);

  await attemptSignIn(page, duplicateEmail, 'Valid-password-123!');
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
});

test('REQ-1-1-2: REQ-1-1-2: Sign In with an Existing Account - Scenario 1', async ({ page }) => {
  await attemptSignIn(page, ALICE_USERNAME, ALICE_PASSWORD);
  await expectSignedInAs(page, ALICE_USERNAME);
  await page.reload();
  await expectSignedInAs(page, ALICE_USERNAME);
});

test('REQ-1-1-2#2: REQ-1-1-2: Sign In with an Existing Account - Scenario 2', async ({ page }) => {
  await attemptSignIn(page, ALICE_USERNAME, ALICE_PASSWORD);
  await expectSignedInAs(page, ALICE_USERNAME);
  await page.reload();
  await expectSignedInAs(page, ALICE_USERNAME);
});

test('REQ-1-1-2#3: REQ-1-1-2: Sign In with an Existing Account - Scenario 3', async ({ page }) => {
  await attemptSignIn(page, ALICE_EMAIL, ALICE_PASSWORD);
  await expectSignedInAs(page, ALICE_USERNAME);
  await page.reload();
  await expectSignedInAs(page, ALICE_USERNAME);
});

test('REQ-1-1-2#4: REQ-1-1-2: Sign In with an Existing Account - Scenario 4', async ({ page }) => {
  await attemptSignIn(page, `no-${u()}@example.test`, 'Wrong-password-123!');
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Username or email', { exact: true })).toBeVisible();
});

test('REQ-1-1-3: REQ-1-1-3: Recover Account Access Through a Verified Email - Scenario 1', async ({ page }) => {
  const account = await registerAccount(page);
  const replacement = 'Replacement-password-456!';
  const unknownEmail = `unknown-${u()}@example.test`;

  await openForgotPassword(page);
  await enterRecoveryEmail(page, unknownEmail);
  await submitReset(page, '123456', 'Candidate-password-789!', 'Candidate-password-789!');
  await expect(page.getByText('Password updated', { exact: true })).not.toBeVisible();

  await openForgotPassword(page);
  await enterRecoveryEmail(page, account.email);
  await submitReset(page, '123456', replacement, replacement);
  await expect(page.getByText('Password updated', { exact: true })).toBeVisible();

  await attemptSignIn(page, account.email, account.password);
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();

  await attemptSignIn(page, account.email, replacement);
  await expectSignedInAs(page, account.username);
});

test('REQ-1-1-3#2: REQ-1-1-3: Recover Account Access Through a Verified Email - Scenario 2', async ({ page }) => {
  const account = await registerAccount(page);
  const replacement = 'Replacement-password-456!';

  await openForgotPassword(page);
  await enterRecoveryEmail(page, account.email);
  await submitReset(page, '000000', replacement, replacement);
  await expect(page.getByText('Verification code is invalid', { exact: true })).toBeVisible();
  await expect(page.getByText('Password updated', { exact: true })).not.toBeVisible();

  await attemptSignIn(page, account.email, account.password);
  await expectSignedInAs(page, account.username);

  await signOut(page);
  await attemptSignIn(page, account.email, replacement);
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
});

test('REQ-1-1-3#3: REQ-1-1-3: Recover Account Access Through a Verified Email - Scenario 3', async ({ page }) => {
  const account = await registerAccount(page);

  await openForgotPassword(page);
  await enterRecoveryEmail(page, account.email);
  await submitReset(page, '123456', 'short', 'short');
  await expect(page.getByText('Password requirements are not satisfied', { exact: true })).toBeVisible();
  await expect(page.getByText('Password updated', { exact: true })).not.toBeVisible();

  await attemptSignIn(page, account.email, account.password);
  await expectSignedInAs(page, account.username);
});

test('REQ-1-2: REQ-1-2: Sign Out and End the Current Web Session - Scenario 1', async ({ page }) => {
  await attemptSignIn(page, ALICE_USERNAME, ALICE_PASSWORD);
  await expectSignedInAs(page, ALICE_USERNAME);

  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Your organizations', exact: true }).click();
  await expect(page.getByRole('link', { name: 'New organization', exact: true })).toBeVisible();
  const protectedUrl = page.url();

  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();
  const cancelDialog = page.getByRole('dialog', { name: 'Sign out', exact: true });
  await expect(cancelDialog).toBeVisible();
  await cancelDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();
  const confirmDialog = page.getByRole('dialog', { name: 'Sign out', exact: true });
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.getByRole('button', { name: 'Confirm sign out', exact: true }).click();

  await page.goto('/');
  await expectUnauthenticated(page);

  await page.goto(protectedUrl);
  await expectUnauthenticated(page);
});

test('REQ-1-2#2: REQ-1-2: Sign Out and End the Current Web Session - Scenario 2', async ({ page }) => {
  await attemptSignIn(page, ALICE_USERNAME, ALICE_PASSWORD);
  await expectSignedInAs(page, ALICE_USERNAME);

  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Sign out', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
});

test('REQ-1-3: REQ-1-3: Change Account Password - Scenario 1', async ({ page }) => {
  const account = await createAccountAndOpenPasswordSettings(page);

  await page.getByLabel('Current password', { exact: true }).fill(account.password);
  await page.getByLabel('New password', { exact: true }).fill('New-password-456!');
  await page.getByLabel('Confirm password', { exact: true }).fill('New-password-456!');
  await page.getByRole('button', { name: 'Update password', exact: true }).click();
  await expect(page.getByText('Password updated', { exact: true })).toBeVisible();

  await signOut(page);
  await attemptSignIn(page, account.email, account.password);
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();

  await attemptSignIn(page, account.email, 'New-password-456!');
  await expectSignedInAs(page, account.username);
});

test('REQ-1-3#2: REQ-1-3: Change Account Password - Scenario 2', async ({ page }) => {
  const account = await createAccountAndOpenPasswordSettings(page);

  await page.getByLabel('Current password', { exact: true }).fill('wrong-password');
  await page.getByLabel('New password', { exact: true }).fill('New-password-456!');
  await page.getByLabel('Confirm password', { exact: true }).fill('does-not-match');
  await page.getByRole('button', { name: 'Update password', exact: true }).click();

  const error = page
    .getByText('Current password is incorrect', { exact: true })
    .or(page.getByText('Password confirmation does not match', { exact: true }));
  await expect(error).toBeVisible();
  await expect(page.getByText('Password updated', { exact: true })).not.toBeVisible();

  await signOut(page);
  await attemptSignIn(page, account.email, account.password);
  await expectSignedInAs(page, account.username);
});

test('REQ-1-3#3: REQ-1-3: Change Account Password - Scenario 3', async ({ page }) => {
  const account = await createAccountAndOpenPasswordSettings(page);

  await page.getByLabel('Current password', { exact: true }).fill('');
  await page.getByLabel('New password', { exact: true }).fill('Required-password-789!');
  await page.getByLabel('Confirm password', { exact: true }).fill('Required-password-789!');
  await page.getByRole('button', { name: 'Update password', exact: true }).click();

  await expect(page.getByText('Current password is required', { exact: true })).toBeVisible();
  await expect(page.getByText('Password updated', { exact: true })).not.toBeVisible();

  await signOut(page);
  await attemptSignIn(page, account.email, account.password);
  await expectSignedInAs(page, account.username);
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

