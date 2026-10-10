const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const SEED_USER = 'alice-dev';
const SEED_EMAIL = 'alice.dev@example.test';
const SEED_PASSWORD = 'Valid-password-123!';

// --- helpers ---------------------------------------------------------------

async function openAccountAccess(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
}

async function openRegistration(page) {
  await openAccountAccess(page);
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
}

async function signIn(page, identifier, password) {
  await page.getByLabel('Username or email', { exact: true }).fill(identifier);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function openAccountMenu(page) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
}

async function expectSignedInAs(page, username) {
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
  await openAccountMenu(page);
  await expect(page.getByText(username, { exact: true }).first()).toBeVisible();
}

async function signOutViaDialog(page) {
  await openAccountMenu(page);
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Sign out', exact: true })
    .getByRole('button', { name: 'Confirm sign out', exact: true })
    .click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);
}

async function registerAccount(page, username, email, password = SEED_PASSWORD) {
  await openRegistration(page);
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
}

async function registerAndSignIn(page, username, email, password = SEED_PASSWORD) {
  await registerAccount(page, username, email, password);
  await signIn(page, email, password);
}

async function openPasswordSettings(page) {
  await openAccountMenu(page);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Password and authentication', exact: true }).click();
  await expect(page.getByLabel('Current password', { exact: true })).toBeVisible();
}

async function openForgotPassword(page) {
  await page.getByRole('link', { name: 'Forgot password', exact: true }).click();
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
}

// --- REQ-1-1-1 -------------------------------------------------------------

test('REQ-1-1-1: REQ-1-1-1: Register a New GitHub Account - Scenario 1', async ({ page }) => {
  const suffix = u();
  const username = `pw-user-${suffix}`;
  const email = `pw-user-${suffix}@example.test`;

  await openRegistration(page);
  await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Confirm password', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('checkbox', { name: 'Agree to the terms', exact: true })
  ).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeEnabled();

  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(SEED_PASSWORD);
  await page.getByLabel('Confirm password', { exact: true }).fill(SEED_PASSWORD);
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();

  // Success redirects to the sign-in page and never echoes the password.
  await expect(page.getByLabel('Username or email', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByText(SEED_PASSWORD, { exact: true })).toHaveCount(0);

  // The new account can sign in immediately and the signed-in username survives a reload.
  await signIn(page, email, SEED_PASSWORD);
  await expectSignedInAs(page, username);
  await page.reload();
  await expectSignedInAs(page, username);
});

test('REQ-1-1-1#2: REQ-1-1-1: Register a New GitHub Account - Scenario 2', async ({ page }) => {
  const suffix = u();
  const attemptedUsername = `-pw-user-${suffix}`;
  const attemptedEmail = 'not-an-email';

  await openRegistration(page);
  await page.getByLabel('Username', { exact: true }).fill(attemptedUsername);
  await page.getByLabel('Email', { exact: true }).fill(attemptedEmail);
  await page.getByLabel('Password', { exact: true }).fill('short');
  await page.getByLabel('Confirm password', { exact: true }).fill('different');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();

  await expect(page.getByText('Username format is invalid', { exact: true })).toBeVisible();
  await expect(page.getByText('Email format is invalid', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Password requirements are not satisfied', { exact: true })
  ).toBeVisible();
  await expect(page.getByText('Agree to terms is required', { exact: true })).toBeVisible();

  // Non-sensitive input is retained and the submit button stays actionable.
  await expect(page.getByLabel('Username', { exact: true })).toHaveValue(attemptedUsername);
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue(attemptedEmail);
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeEnabled();
});

test('REQ-1-1-1#3: REQ-1-1-1: Register a New GitHub Account - Scenario 3', async ({ page }) => {
  const suffix = u();
  const attemptedEmail = `pw-user-${suffix}@example.test`;

  await openRegistration(page);
  await page.getByLabel('Username', { exact: true }).fill(SEED_USER);
  await page.getByLabel('Email', { exact: true }).fill(attemptedEmail);
  await page.getByLabel('Password', { exact: true }).fill(SEED_PASSWORD);
  await page.getByLabel('Confirm password', { exact: true }).fill(SEED_PASSWORD);
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();

  await expect(page.getByText('Username already exists', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Username', { exact: true })).toHaveValue(SEED_USER);
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue(attemptedEmail);

  // No account was created for the failed input.
  await openAccountAccess(page);
  await signIn(page, attemptedEmail, SEED_PASSWORD);
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
});

// --- REQ-1-1-2 -------------------------------------------------------------

test('REQ-1-1-2: REQ-1-1-2: Sign In with an Existing Account - Scenario 1', async ({ page }) => {
  await openAccountAccess(page);
  await expect(page.getByLabel('Username or email', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();

  // Unknown account.
  await signIn(page, `unknown-${u()}`, SEED_PASSWORD);
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Username or email', { exact: true })).toBeVisible();

  // Wrong password for an existing account -> exactly the same generic message.
  await signIn(page, SEED_EMAIL, 'Wrong-password-000!');
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);

  // After a failed sign-in the session still does not exist.
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);

  // Successful sign-in with the verified email.
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await signIn(page, SEED_EMAIL, SEED_PASSWORD);
  await expectSignedInAs(page, SEED_USER);

  // The session remains valid after refreshing.
  await page.reload();
  await expectSignedInAs(page, SEED_USER);
});

test('REQ-1-1-2#2: REQ-1-1-2: Sign In with an Existing Account - Scenario 2', async ({ page }) => {
  await openAccountAccess(page);
  await signIn(page, SEED_USER, SEED_PASSWORD);
  await expectSignedInAs(page, SEED_USER);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
  await openAccountMenu(page);
  await expect(page.getByText(SEED_USER, { exact: true }).first()).toBeVisible();
});

test('REQ-1-1-2#3: REQ-1-1-2: Sign In with an Existing Account - Scenario 3', async ({ page }) => {
  await openAccountAccess(page);
  await signIn(page, SEED_EMAIL, SEED_PASSWORD);
  await expectSignedInAs(page, SEED_USER);

  // Reopening the workspace through the home page keeps the signed-in user.
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
  await openAccountMenu(page);
  await expect(page.getByText(SEED_USER, { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign out', exact: true })).toBeVisible();
});

test('REQ-1-1-2#4: REQ-1-1-2: Sign In with an Existing Account - Scenario 4', async ({ page }) => {
  await openAccountAccess(page);

  await signIn(page, `unknown-${u()}`, 'Wrong-password-000!');
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Username or email', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);

  await signIn(page, SEED_USER, 'Wrong-password-000!');
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Username or email', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);
});

// --- REQ-1-1-3 -------------------------------------------------------------

test('REQ-1-1-3: REQ-1-1-3: Recover Account Access Through a Verified Email - Scenario 1', async ({
  page,
}) => {
  const suffix = u();
  const username = `pw-user-${suffix}`;
  const email = `pw-user-${suffix}@example.test`;
  const newPassword = 'Replacement-password-456!';

  await registerAccount(page, username, email);
  await openForgotPassword(page);

  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
  await expect(page.getByText('123456', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Verification code', { exact: true })).toBeVisible();
  await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Confirm password', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset password', exact: true })).toBeVisible();

  await page.getByLabel('Verification code', { exact: true }).fill('123456');
  await page.getByLabel('New password', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirm password', { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();
  await expect(page.getByText('Password updated', { exact: true })).toBeVisible();

  // The old password no longer works and the new one does.
  await openAccountAccess(page);
  await signIn(page, email, SEED_PASSWORD);
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
  await signIn(page, email, newPassword);
  await expectSignedInAs(page, username);
});

test('REQ-1-1-3#2: REQ-1-1-3: Recover Account Access Through a Verified Email - Scenario 2', async ({
  page,
}) => {
  const suffix = u();
  const username = `pw-user-${suffix}`;
  const email = `pw-user-${suffix}@example.test`;
  const unknownEmail = `unknown-${suffix}@example.test`;
  const candidatePassword = 'Replacement-password-456!';

  await registerAccount(page, username, email);

  // Registered email enters the reset step.
  await openForgotPassword(page);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
  await expect(page.getByText('123456', { exact: true })).toBeVisible();

  // Unknown email enters exactly the same step with the same fixed code.
  await openAccountAccess(page);
  await openForgotPassword(page);
  await page.getByLabel('Email', { exact: true }).fill(unknownEmail);
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
  await expect(page.getByText('123456', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Verification code', { exact: true })).toBeVisible();
  await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Confirm password', { exact: true })).toBeVisible();

  await page.getByLabel('Verification code', { exact: true }).fill('123456');
  await page.getByLabel('New password', { exact: true }).fill(candidatePassword);
  await page.getByLabel('Confirm password', { exact: true }).fill(candidatePassword);
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();
  await expect(page.getByText('Password updated', { exact: true })).toHaveCount(0);

  // The registered account is untouched: candidate fails, old password still works.
  await openAccountAccess(page);
  await signIn(page, email, candidatePassword);
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
  await signIn(page, email, SEED_PASSWORD);
  await expectSignedInAs(page, username);
});

test('REQ-1-1-3#3: REQ-1-1-3: Recover Account Access Through a Verified Email - Scenario 3', async ({
  page,
}) => {
  const suffix = u();
  const username = `pw-user-${suffix}`;
  const email = `pw-user-${suffix}@example.test`;
  const candidatePassword = 'Replacement-password-456!';

  await registerAccount(page, username, email);
  await openForgotPassword(page);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
  await expect(page.getByText('123456', { exact: true })).toBeVisible();

  // Wrong verification code.
  await page.getByLabel('Verification code', { exact: true }).fill('000000');
  await page.getByLabel('New password', { exact: true }).fill(candidatePassword);
  await page.getByLabel('Confirm password', { exact: true }).fill(candidatePassword);
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();
  await expect(page.getByText('Verification code is invalid', { exact: true })).toBeVisible();
  await expect(page.getByText('Password updated', { exact: true })).toHaveCount(0);

  // Correct code but mismatched confirmation.
  await page.getByLabel('Verification code', { exact: true }).fill('123456');
  await page.getByLabel('New password', { exact: true }).fill(candidatePassword);
  await page.getByLabel('Confirm password', { exact: true }).fill('Different-password-789!');
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();
  await expect(page.getByText('Password updated', { exact: true })).toHaveCount(0);

  // Old credentials remain usable (passwords are never echoed).
  await expect(page.getByText(candidatePassword, { exact: true })).toHaveCount(0);
  await openAccountAccess(page);
  await signIn(page, email, SEED_PASSWORD);
  await expectSignedInAs(page, username);
});

// --- REQ-1-2 ---------------------------------------------------------------

test('REQ-1-2: REQ-1-2: Sign Out and End the Current Web Session - Scenario 1', async ({ page }) => {
  await openAccountAccess(page);
  await signIn(page, SEED_USER, SEED_PASSWORD);
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();

  // Cancelling the confirmation keeps the session.
  await openAccountMenu(page);
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Sign out', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();

  // Confirming ends the session.
  await openAccountMenu(page);
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirm sign out', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);

  // Refresh does not restore the session.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);

  // Browser back navigation does not restore the session.
  await page.goBack();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);
});

test('REQ-1-2#2: REQ-1-2: Sign Out and End the Current Web Session - Scenario 2', async ({
  page,
}) => {
  await openAccountAccess(page);
  await signIn(page, SEED_USER, SEED_PASSWORD);

  const dialog = page.getByRole('dialog', { name: 'Sign out', exact: true });

  // Cancel keeps the session, also after reloading.
  await openAccountMenu(page);
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
  await openAccountMenu(page);
  await expect(page.getByText(SEED_USER, { exact: true }).first()).toBeVisible();

  // Confirm ends the session and the state persists after reload.
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirm sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);
});

// --- REQ-1-3 ---------------------------------------------------------------

test('REQ-1-3: REQ-1-3: Change Account Password - Scenario 1', async ({ page }) => {
  const suffix = u();
  const username = `pw-user-${suffix}`;
  const email = `pw-user-${suffix}@example.test`;
  const newPassword = 'New-password-456!';

  await registerAndSignIn(page, username, email);
  await openPasswordSettings(page);

  await page.getByLabel('Current password', { exact: true }).fill(SEED_PASSWORD);
  await page.getByLabel('New password', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirm password', { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: 'Update password', exact: true }).click();
  await expect(page.getByText('Password updated', { exact: true })).toBeVisible();
  await expect(page.getByText(newPassword, { exact: true })).toHaveCount(0);

  await signOutViaDialog(page);

  // The old password no longer works, the new one does.
  await openAccountAccess(page);
  await signIn(page, email, SEED_PASSWORD);
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
  await signIn(page, email, newPassword);
  await expectSignedInAs(page, username);
});

test('REQ-1-3#2: REQ-1-3: Change Account Password - Scenario 2', async ({ page }) => {
  const suffix = u();
  const username = `pw-user-${suffix}`;
  const email = `pw-user-${suffix}@example.test`;
  const newPassword = 'Required-password-789!';

  await registerAndSignIn(page, username, email);
  await openPasswordSettings(page);

  // Missing current password.
  await page.getByLabel('New password', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirm password', { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: 'Update password', exact: true }).click();
  await expect(page.getByText('Current password is required', { exact: true })).toBeVisible();

  // Correct current password but mismatched confirmation.
  await page.getByLabel('Current password', { exact: true }).fill(SEED_PASSWORD);
  await page.getByLabel('New password', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirm password', { exact: true }).fill('Different-password-000!');
  await page.getByRole('button', { name: 'Update password', exact: true }).click();
  await expect(
    page.getByText('Password confirmation does not match', { exact: true })
  ).toBeVisible();

  // Reload keeps the security form and the old credentials still work.
  await page.reload();
  await expect(page.getByLabel('Current password', { exact: true })).toBeVisible();

  await signOutViaDialog(page);
  await openAccountAccess(page);
  await signIn(page, email, SEED_PASSWORD);
  await expectSignedInAs(page, username);
});

test('REQ-1-3#3: REQ-1-3: Change Account Password - Scenario 3', async ({ page }) => {
  const suffix = u();
  const username = `pw-user-${suffix}`;
  const email = `pw-user-${suffix}@example.test`;
  const candidatePassword = 'Candidate-password-321!';

  await registerAndSignIn(page, username, email);
  await openPasswordSettings(page);

  await page.getByLabel('Current password', { exact: true }).fill('Wrong-password-000!');
  await page.getByLabel('New password', { exact: true }).fill(candidatePassword);
  await page.getByLabel('Confirm password', { exact: true }).fill(candidatePassword);
  await page.getByRole('button', { name: 'Update password', exact: true }).click();
  await expect(page.getByText('Current password is incorrect', { exact: true })).toBeVisible();
  await expect(page.getByText('Password updated', { exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByLabel('Current password', { exact: true })).toBeVisible();

  // The candidate new password does not work; the old one still does.
  await signOutViaDialog(page);
  await openAccountAccess(page);
  await signIn(page, email, candidatePassword);
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
  await signIn(page, email, SEED_PASSWORD);
  await expectSignedInAs(page, username);
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

