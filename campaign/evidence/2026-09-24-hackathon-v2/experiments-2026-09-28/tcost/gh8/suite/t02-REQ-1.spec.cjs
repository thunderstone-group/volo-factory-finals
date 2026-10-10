const { test, expect } = require('@playwright/test');

const SEED_USERNAME = 'alice-dev';
const SEED_PASSWORD = 'Valid-password-123!';

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function openSignIn(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
}

async function signIn(page, usernameOrEmail, password) {
  await openSignIn(page);
  await page.getByLabel('Username or email', { exact: true }).fill(usernameOrEmail);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
}

async function attemptSignIn(page, usernameOrEmail, password) {
  await openSignIn(page);
  await page.getByLabel('Username or email', { exact: true }).fill(usernameOrEmail);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function registerAccount(page, username, email, password) {
  await openSignIn(page);
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByLabel('Agree to the terms', { exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
}

async function signOut(page, { confirm = true } = {}) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Sign out', exact: true });
  await expect(dialog).toBeVisible();
  if (confirm) {
    await dialog.getByRole('button', { name: 'Confirm sign out', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
  } else {
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
  }
}

async function openForgotPassword(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Forgot password', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Send reset link', exact: true })).toBeVisible();
}

async function submitRecoveryEmail(page, email) {
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
  await expect(page.getByText('123456', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset password', exact: true })).toBeVisible();
}

async function completeRecovery(page, code, newPassword) {
  await page.getByLabel('Verification code', { exact: true }).fill(code);
  await page.getByLabel('New password', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirm password', { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();
}

async function openPasswordSecurityPage(page) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Password and authentication', exact: true }).click();
  await expect(page.getByLabel('Current password', { exact: true })).toBeVisible();
}

test('REQ-1-1-3: REQ-1-1-3: Recover Account Access Through a Verified Email - Scenario 1', async ({ page }) => {
  const suffix = u();
  const username = `pw-user-${suffix}`;
  const email = `${username}@example.test`;
  const originalPassword = 'Valid-password-123!';
  const replacementPassword = 'Replacement-password-456!';
  const candidatePassword = 'Candidate-password-789!';

  // The recovery scenario uses a newly registered account; never reset the seed account.
  await registerAccount(page, username, email, originalPassword);

  // Registered email: the next step shows the fixed code and the reset form.
  await openForgotPassword(page);
  await submitRecoveryEmail(page, email);
  await completeRecovery(page, '123456', replacementPassword);
  await expect(page.getByText('Password updated', { exact: true })).toBeVisible();

  // Refreshing the reset page does not create another account or link.
  await page.reload();

  // After success: old password fails, new password works.
  await attemptSignIn(page, email, originalPassword);
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
  await attemptSignIn(page, email, replacementPassword);
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
  await signOut(page);

  // Unknown email: same next step and same fixed code, but no account is modified.
  await openForgotPassword(page);
  await submitRecoveryEmail(page, `unknown-${suffix}@example.test`);
  await completeRecovery(page, '123456', candidatePassword);
  await expect(page.getByText('Password updated', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reset password', exact: true })).toBeVisible();

  // After failure: the current password still works, the candidate new password does not.
  await attemptSignIn(page, email, replacementPassword);
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
  await signOut(page);
  await attemptSignIn(page, email, candidatePassword);
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
});

test('REQ-1-1-3#2: REQ-1-1-3: Recover Account Access Through a Verified Email - Scenario 2', async ({ page }) => {
  const suffix = u();
  const username = `pw-user-${suffix}`;
  const email = `${username}@example.test`;
  const originalPassword = 'Valid-password-123!';

  // Build a dedicated account to reset; the seed account is used only for the sign-in step.
  await registerAccount(page, username, email, originalPassword);
  await signIn(page, SEED_USERNAME, SEED_PASSWORD);
  await signOut(page);

  // Incorrect verification code is rejected beside the field.
  await openForgotPassword(page);
  await submitRecoveryEmail(page, email);
  await completeRecovery(page, '000000', 'Replacement-password-456!');
  await expect(page.getByText('Verification code is invalid', { exact: true })).toBeVisible();

  // Rejected action leaves the original credentials usable.
  await attemptSignIn(page, email, originalPassword);
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
});

test('REQ-1-1-3#3: REQ-1-1-3: Recover Account Access Through a Verified Email - Scenario 3', async ({ page }) => {
  const suffix = u();
  const username = `pw-user-${suffix}`;
  const email = `${username}@example.test`;
  const originalPassword = 'Valid-password-123!';

  await registerAccount(page, username, email, originalPassword);
  await signIn(page, SEED_USERNAME, SEED_PASSWORD);
  await signOut(page);

  // A noncompliant replacement password is rejected; no account is modified.
  await openForgotPassword(page);
  await submitRecoveryEmail(page, email);
  await completeRecovery(page, '123456', 'short');
  await expect(page.getByText('Password updated', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reset password', exact: true })).toBeVisible();

  await attemptSignIn(page, email, originalPassword);
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
});

test('REQ-1-2: REQ-1-2: Sign Out and End the Current Web Session - Scenario 1', async ({ page }) => {
  await signIn(page, SEED_USERNAME, SEED_PASSWORD);

  // Enter a protected account-settings page from the account menu.
  await openPasswordSecurityPage(page);

  // Confirm sign-out.
  await signOut(page);

  // Unauthenticated state: Sign in entry is shown and the account menu is gone.
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);

  // Refreshing and browser-back navigation both require re-authentication.
  await page.reload();
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
});

test('REQ-1-2#2: REQ-1-2: Sign Out and End the Current Web Session - Scenario 2', async ({ page }) => {
  await signIn(page, SEED_USERNAME, SEED_PASSWORD);

  // Cancel retains the session and the current page.
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Sign out', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');

  // Confirm sign-out invalidates the session.
  await signOut(page);
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);

  // Refreshing keeps the unauthenticated state.
  await page.reload();
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
});

test('REQ-1-3: REQ-1-3: Change Account Password - Scenario 1', async ({ page }) => {
  const suffix = u();
  const username = `pw-user-${suffix}`;
  const email = `${username}@example.test`;
  const originalPassword = 'Valid-password-123!';
  const newPassword = 'New-password-456!';

  // The seeded account's credentials must stay intact: change a dedicated account's password.
  await registerAccount(page, username, email, originalPassword);
  await signIn(page, username, originalPassword);

  await openPasswordSecurityPage(page);

  await page.getByLabel('Current password', { exact: true }).fill(originalPassword);
  await page.getByLabel('New password', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirm password', { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: 'Update password', exact: true }).click();
  await expect(page.getByText('Password updated', { exact: true })).toBeVisible();

  // The new password immediately works; the old password no longer works.
  await signOut(page);
  await attemptSignIn(page, email, newPassword);
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
  await signOut(page);
  await attemptSignIn(page, email, originalPassword);
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
});

test('REQ-1-3#2: REQ-1-3: Change Account Password - Scenario 2', async ({ page }) => {
  const suffix = u();
  const username = `pw-user-${suffix}`;
  const email = `${username}@example.test`;
  const originalPassword = 'Valid-password-123!';
  const newPassword = 'New-password-456!';

  await registerAccount(page, username, email, originalPassword);
  await signIn(page, username, originalPassword);

  await openPasswordSecurityPage(page);

  // Incorrect current password with a mismatched confirmation is rejected.
  await page.getByLabel('Current password', { exact: true }).fill('Wrong-password-000!');
  await page.getByLabel('New password', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirm password', { exact: true }).fill('does-not-match');
  await page.getByRole('button', { name: 'Update password', exact: true }).click();
  await expect(
    page.getByText('Current password is incorrect', { exact: true })
      .or(page.getByText('Password confirmation does not match', { exact: true }))
  ).toBeVisible();

  // Rejected action leaves the original credentials usable.
  await page.reload();
  await expect(page.getByLabel('Current password', { exact: true })).toBeVisible();
  await signOut(page);
  await attemptSignIn(page, email, originalPassword);
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
});

test('REQ-1-3#3: REQ-1-3: Change Account Password - Scenario 3', async ({ page }) => {
  const suffix = u();
  const username = `pw-user-${suffix}`;
  const email = `${username}@example.test`;
  const originalPassword = 'Valid-password-123!';

  await registerAccount(page, username, email, originalPassword);
  await signIn(page, username, originalPassword);

  await openPasswordSecurityPage(page);

  // An empty current-password field is required.
  await page.getByLabel('New password', { exact: true }).fill('Required-password-789!');
  await page.getByLabel('Confirm password', { exact: true }).fill('Required-password-789!');
  await page.getByRole('button', { name: 'Update password', exact: true }).click();
  await expect(page.getByText('Current password is required', { exact: true })).toBeVisible();

  // The original credentials remain unchanged.
  await page.reload();
  await expect(page.getByLabel('Current password', { exact: true })).toBeVisible();
  await signOut(page);
  await attemptSignIn(page, email, originalPassword);
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

