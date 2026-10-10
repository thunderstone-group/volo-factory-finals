const { test, expect } = require('@playwright/test');

const SEED_USERNAME = 'alice-dev';
const SEED_EMAIL = 'alice.dev@example.test';
const SEED_PASSWORD = 'Valid-password-123!';

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const newUsername = (prefix) => `${prefix}-${u()}`.slice(0, 39);
const newEmail = (username) => `${username}@example.test`;

/* ------------------------------------------------------------------ helpers */

async function openAccountAccess(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await expect(page.getByLabel('Username or email', { exact: true })).toBeVisible();
}

async function openRegistration(page) {
  await openAccountAccess(page);
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
}

async function openForgotPassword(page) {
  await openAccountAccess(page);
  await page.getByRole('link', { name: 'Forgot password', exact: true }).click();
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
}

async function fillRegistration(page, username, email, password) {
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
}

async function register(page, username, email, password) {
  await fillRegistration(page, username, email, password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
}

async function signIn(page, identifier, password) {
  await page.getByLabel('Username or email', { exact: true }).fill(identifier);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function signOut(page) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm sign out', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
}

async function openPasswordSettings(page) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Password and authentication', exact: true }).click();
  await expect(page.getByLabel('Current password', { exact: true })).toBeVisible();
}

/* -------------------------------------------------- REQ-1-1-1 registration */

test('REQ-1-1-1: REQ-1-1-1: Register a New GitHub Account - Scenario 1', async ({ page }) => {
  const username = newUsername('pw-user');
  const email = newEmail(username);
  const password = 'Valid-password-123!';

  // GIVEN the visitor opens the registration page from the sign-in page
  await openRegistration(page);
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Confirm password', { exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Agree to the terms', exact: true })).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeEnabled();

  // WHEN a compliant username, email, password and matching confirmation are submitted
  await register(page, username, email, password);

  // THEN the sign-in form is immediately available and no password is echoed
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByText(password, { exact: true })).toHaveCount(0);

  // THEN the visitor can immediately sign in with the new account
  await signIn(page, email, password);
  await expect(page.getByText(username, { exact: true }).first()).toBeVisible();

  // THEN the session and the account persist
  await page.reload();
  await expect(page.getByText(username, { exact: true }).first()).toBeVisible();
});

test('REQ-1-1-1#2: REQ-1-1-1: Register a New GitHub Account - Scenario 2', async ({ page }) => {
  const badUsername = '-invalid-user';
  const badEmail = 'not-an-email';

  await openRegistration(page);

  // WHEN several invalid fields are submitted together
  await page.getByLabel('Username', { exact: true }).fill(badUsername);
  await page.getByLabel('Email', { exact: true }).fill(badEmail);
  await page.getByLabel('Password', { exact: true }).fill('short');
  await page.getByLabel('Confirm password', { exact: true }).fill('different');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();

  // THEN every field reason is shown together, not only one per submission
  await expect(page.getByText('Username format is invalid').first()).toBeVisible();
  await expect(page.getByText('Email format is invalid').first()).toBeVisible();
  await expect(page.getByText('Password requirements are not satisfied').first()).toBeVisible();
  await expect(page.getByText('Agree to terms is required').first()).toBeVisible();

  // THEN non-sensitive input is retained, passwords are not echoed, and the button stays actionable
  await expect(page.getByLabel('Username', { exact: true })).toHaveValue(badUsername);
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue(badEmail);
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Confirm password', { exact: true })).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeEnabled();

  // THEN reopening the sign-in page shows that no account was created for the failed input
  await openAccountAccess(page);
  await signIn(page, badUsername, 'short');
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
});

test('REQ-1-1-1#3: REQ-1-1-1: Register a New GitHub Account - Scenario 3', async ({ page }) => {
  const otherEmail = newEmail(newUsername('pw-dup'));

  await openRegistration(page);

  // WHEN a duplicate username is submitted together with a different unused email
  await fillRegistration(page, SEED_USERNAME, otherEmail, SEED_PASSWORD);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();

  // THEN the conflict is reported and both attempted values are retained
  await expect(page.getByText('Username already exists').first()).toBeVisible();
  await expect(page.getByLabel('Username', { exact: true })).toHaveValue(SEED_USERNAME);
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue(otherEmail);

  // WHEN a genuinely unique username and email are submitted
  const username = newUsername('pw-user');
  const email = newEmail(username);
  await fillRegistration(page, username, email, SEED_PASSWORD);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();

  // THEN the sign-in form is available and the new account works
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await signIn(page, SEED_EMAIL, SEED_PASSWORD);
  await expect(page.getByText(SEED_USERNAME, { exact: true }).first()).toBeVisible();
  await signOut(page);

  await signIn(page, username, SEED_PASSWORD);
  await expect(page.getByText(username, { exact: true }).first()).toBeVisible();
});

/* ---------------------------------------------------- REQ-1-1-2 sign in */

test('REQ-1-1-2: REQ-1-1-2: Sign In with an Existing Account - Scenario 1', async ({ page }) => {
  // GIVEN the account-access page from the home page
  await openAccountAccess(page);
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();

  // WHEN authentication fails with an unknown account
  await signIn(page, `unknown-${u()}`, SEED_PASSWORD);
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);

  // THEN a failed sign-in leaves the protected area requiring authentication
  await page.reload();
  await expect(page.getByLabel('Username or email', { exact: true })).toBeVisible();

  // WHEN authentication fails with an incorrect password
  await signIn(page, SEED_USERNAME, 'Wrong-password-999!');
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();

  // WHEN the correct credentials are submitted
  await signIn(page, SEED_EMAIL, SEED_PASSWORD);

  // THEN the workspace is entered and the account menu shows the username
  await expect(page.getByText(SEED_USERNAME, { exact: true }).first()).toBeVisible();

  // THEN the session survives a refresh
  await page.reload();
  await expect(page.getByText(SEED_USERNAME, { exact: true }).first()).toBeVisible();
});

test('REQ-1-1-2#2: REQ-1-1-2: Sign In with an Existing Account - Scenario 2', async ({ page }) => {
  const workspaceUsername = SEED_USERNAME;

  // WHEN the visitor signs in with the verified email
  await openAccountAccess(page);
  await signIn(page, SEED_EMAIL, SEED_PASSWORD);

  // THEN the workspace is entered with the account menu showing the current user
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
  await expect(page.getByText(workspaceUsername, { exact: true }).first()).toBeVisible();

  // THEN refreshing the workspace keeps the signed-in user
  await page.reload();
  await expect(page.getByText(workspaceUsername, { exact: true }).first()).toBeVisible();

  // THEN reopening through the home page keeps the signed-in user
  await page.goto('/');
  await expect(page.getByText(workspaceUsername, { exact: true }).first()).toBeVisible();
});

test('REQ-1-1-2#3: REQ-1-1-2: Sign In with an Existing Account - Scenario 3', async ({ page }) => {
  // WHEN the visitor signs in with the username
  await openAccountAccess(page);
  await signIn(page, SEED_USERNAME, SEED_PASSWORD);
  await expect(page.getByText(SEED_USERNAME, { exact: true }).first()).toBeVisible();

  // THEN the session governs access to a protected page reached from the account menu
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Your organizations', exact: true }).click();
  await expect(page.getByRole('link', { name: 'New organization', exact: true })).toBeVisible();
  await expect(page.getByText(SEED_USERNAME, { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('link', { name: 'New organization', exact: true })).toBeVisible();
  await expect(page.getByText(SEED_USERNAME, { exact: true }).first()).toBeVisible();

  // THEN signing out ends the session for protected requests
  await signOut(page);
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);
});

test('REQ-1-1-2#4: REQ-1-1-2: Sign In with an Existing Account - Scenario 4', async ({ page }) => {
  await openAccountAccess(page);

  // WHEN the account is unknown (email form)
  await signIn(page, `unknown-${u()}@example.test`, SEED_PASSWORD);
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);

  // WHEN the account is unknown (username form)
  await signIn(page, `unknown-${u()}`, SEED_PASSWORD);
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);

  // WHEN the password is wrong
  await signIn(page, SEED_EMAIL, 'Wrong-password-999!');
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);

  // WHEN the correct credentials are submitted
  await signIn(page, SEED_EMAIL, SEED_PASSWORD);
  await expect(page.getByText(SEED_USERNAME, { exact: true }).first()).toBeVisible();

  // THEN the previously accessible protected page is still usable after reopening it directly
  const workspaceUrl = page.url();
  await page.reload();
  await expect(page.getByText(SEED_USERNAME, { exact: true }).first()).toBeVisible();
  await page.goto('/');
  await expect(page.getByText(SEED_USERNAME, { exact: true }).first()).toBeVisible();
  await page.goto(workspaceUrl);
  await expect(page.getByText(SEED_USERNAME, { exact: true }).first()).toBeVisible();
});

/* --------------------------------------------- REQ-1-1-3 password recovery */

test('REQ-1-1-3: REQ-1-1-3: Recover Account Access Through a Verified Email - Scenario 1', async ({ page }) => {
  const username = newUsername('pw-recover');
  const email = newEmail(username);
  const oldPassword = 'Old-password-111!';
  const newPassword = 'Replacement-password-456!';

  // GIVEN a registered account (created through the registration flow)
  await openRegistration(page);
  await register(page, username, email, oldPassword);
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();

  // WHEN the registered email is submitted for recovery
  await page.getByRole('link', { name: 'Forgot password', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click();

  // THEN the next step of the same flow appears with the fixed verification code
  await expect(page.getByText('123456', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Verification code', { exact: true })).toBeVisible();
  await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Confirm password', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset password', exact: true })).toBeVisible();

  // WHEN the correct code and a compliant matching new password are submitted
  await page.getByLabel('Verification code', { exact: true }).fill('123456');
  await page.getByLabel('New password', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirm password', { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();

  // THEN the password is updated
  await expect(page.getByText('Password updated', { exact: true })).toBeVisible();

  // THEN the old password no longer signs in and the new password does
  await openAccountAccess(page);
  await signIn(page, email, oldPassword);
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
  await signIn(page, email, newPassword);
  await expect(page.getByText(username, { exact: true }).first()).toBeVisible();
});

test('REQ-1-1-3#2: REQ-1-1-3: Recover Account Access Through a Verified Email - Scenario 2', async ({ page }) => {
  const username = newUsername('pw-recover');
  const email = newEmail(username);
  const oldPassword = 'Old-password-222!';
  const newPassword = 'Replacement-password-456!';
  const unknownEmail = `unknown-${u()}@example.test`;

  // GIVEN a registered account
  await openRegistration(page);
  await register(page, username, email, oldPassword);
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();

  // WHEN an unknown email is submitted it reaches the same next step with the same fixed code
  await openForgotPassword(page);
  await page.getByLabel('Email', { exact: true }).fill(unknownEmail);
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
  await expect(page.getByText('123456', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Verification code', { exact: true })).toBeVisible();
  await expect(page.getByLabel('New password', { exact: true })).toBeVisible();

  await page.getByLabel('Verification code', { exact: true }).fill('123456');
  await page.getByLabel('New password', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirm password', { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();

  // THEN no account is updated for the unknown email
  await expect(page.getByText('Password updated', { exact: true })).toHaveCount(0);

  // WHEN the registered email is submitted with a mismatched confirmation
  await openForgotPassword(page);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
  await expect(page.getByText('123456', { exact: true })).toBeVisible();
  await page.getByLabel('Verification code', { exact: true }).fill('123456');
  await page.getByLabel('New password', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirm password', { exact: true }).fill('Different-password-777!');
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();

  // THEN the account is not modified and its old credentials still work
  await expect(page.getByText('Password updated', { exact: true })).toHaveCount(0);
  await openAccountAccess(page);
  await signIn(page, email, oldPassword);
  await expect(page.getByText(username, { exact: true }).first()).toBeVisible();
});

test('REQ-1-1-3#3: REQ-1-1-3: Recover Account Access Through a Verified Email - Scenario 3', async ({ page }) => {
  const username = newUsername('pw-recover');
  const email = newEmail(username);
  const oldPassword = 'Old-password-333!';
  const candidatePassword = 'Replacement-password-456!';

  // GIVEN a registered account
  await openRegistration(page);
  await register(page, username, email, oldPassword);
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();

  // WHEN the reset form is submitted with an incorrect verification code
  await page.getByRole('link', { name: 'Forgot password', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
  await expect(page.getByText('123456', { exact: true })).toBeVisible();
  await page.getByLabel('Verification code', { exact: true }).fill('000000');
  await page.getByLabel('New password', { exact: true }).fill(candidatePassword);
  await page.getByLabel('Confirm password', { exact: true }).fill(candidatePassword);
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();

  // THEN the code error is explained and no password was changed
  await expect(page.getByText('Verification code is invalid').first()).toBeVisible();
  await expect(page.getByText('Password updated', { exact: true })).toHaveCount(0);

  // THEN the candidate password does not sign in and the old password still does
  await openAccountAccess(page);
  await signIn(page, email, candidatePassword);
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
  await signIn(page, email, oldPassword);
  await expect(page.getByText(username, { exact: true }).first()).toBeVisible();
});

/* ------------------------------------------------------- REQ-1-2 sign out */

test('REQ-1-2: REQ-1-2: Sign Out and End the Current Web Session - Scenario 1', async ({ page }) => {
  // GIVEN a signed-in user who has opened a protected page from the account menu
  await openAccountAccess(page);
  await signIn(page, SEED_USERNAME, SEED_PASSWORD);
  await expect(page.getByText(SEED_USERNAME, { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Your organizations', exact: true }).click();
  await expect(page.getByRole('link', { name: 'New organization', exact: true })).toBeVisible();
  const protectedUrl = page.url();

  // WHEN the user opens the account menu, clicks Sign out and confirms the dialog
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Sign out', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm sign out', exact: true }).click();

  // THEN the access state is unauthenticated
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);
  await expect(page.getByText(SEED_USERNAME, { exact: true })).toHaveCount(0);

  // THEN refresh requires re-authentication
  await page.reload();
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();

  // THEN browser back navigation does not restore the session
  await page.goBack();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);

  // THEN directly reopening the recorded protected page requires re-authentication
  await page.goto(protectedUrl);
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);
});

test('REQ-1-2#2: REQ-1-2: Sign Out and End the Current Web Session - Scenario 2', async ({ page }) => {
  // GIVEN a signed-in user on a protected page
  await openAccountAccess(page);
  await signIn(page, SEED_USERNAME, SEED_PASSWORD);
  await expect(page.getByText(SEED_USERNAME, { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Your organizations', exact: true }).click();
  await expect(page.getByRole('link', { name: 'New organization', exact: true })).toBeVisible();
  await expect(page.getByText(SEED_USERNAME, { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Sign out', exact: true })).toBeVisible();

  // WHEN the user cancels the sign-out dialog
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Sign out', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();

  // THEN the dialog is gone and the session and page are retained
  await expect(page.getByRole('dialog', { name: 'Sign out', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'New organization', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'New organization', exact: true })).toBeVisible();
  await expect(page.getByText(SEED_USERNAME, { exact: true }).first()).toBeVisible();

  // WHEN the user signs out and confirms
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm sign out', exact: true }).click();

  // THEN the session is invalidated
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);
});

/* ------------------------------------------------ REQ-1-3 change password */

test('REQ-1-3: REQ-1-3: Change Account Password - Scenario 1', async ({ page }) => {
  const username = newUsername('pw-change');
  const email = newEmail(username);
  const currentPassword = 'Old-password-111!';
  const newPassword = 'New-password-456!';

  // GIVEN a signed-in user with its own account
  await openRegistration(page);
  await register(page, username, email, currentPassword);
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await signIn(page, email, currentPassword);
  await expect(page.getByText(username, { exact: true }).first()).toBeVisible();

  // WHEN Settings -> Password and authentication is opened
  await openPasswordSettings(page);
  await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Confirm password', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Update password', exact: true })).toBeVisible();

  await page.getByLabel('Current password', { exact: true }).fill(currentPassword);
  await page.getByLabel('New password', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirm password', { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: 'Update password', exact: true }).click();

  // THEN the update succeeds
  await expect(page.getByText('Password updated', { exact: true })).toBeVisible();

  // THEN the old password no longer works and the new one does
  await signOut(page);
  await signIn(page, email, currentPassword);
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
  await signIn(page, email, newPassword);
  await expect(page.getByText(username, { exact: true }).first()).toBeVisible();
});

test('REQ-1-3#2: REQ-1-3: Change Account Password - Scenario 2', async ({ page }) => {
  const username = newUsername('pw-change');
  const email = newEmail(username);
  const currentPassword = 'Old-password-222!';
  const candidatePassword = 'Required-password-789!';

  // GIVEN a signed-in user with its own account
  await openRegistration(page);
  await register(page, username, email, currentPassword);
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await signIn(page, email, currentPassword);
  await expect(page.getByText(username, { exact: true }).first()).toBeVisible();

  // WHEN the current-password field is left empty
  await openPasswordSettings(page);
  await page.getByLabel('Current password', { exact: true }).fill('');
  await page.getByLabel('New password', { exact: true }).fill(candidatePassword);
  await page.getByLabel('Confirm password', { exact: true }).fill(candidatePassword);
  await page.getByRole('button', { name: 'Update password', exact: true }).click();

  // THEN the required-current-password message is shown
  await expect(page.getByText('Current password is required').first()).toBeVisible();

  // THEN the old password still works and the candidate does not
  await signOut(page);
  await signIn(page, email, candidatePassword);
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
  await signIn(page, email, currentPassword);
  await expect(page.getByText(username, { exact: true }).first()).toBeVisible();
});

test('REQ-1-3#3: REQ-1-3: Change Account Password - Scenario 3', async ({ page }) => {
  const username = newUsername('pw-change');
  const email = newEmail(username);
  const currentPassword = 'Old-password-333!';
  const newPassword = 'New-password-456!';

  // GIVEN a signed-in user with its own account
  await openRegistration(page);
  await register(page, username, email, currentPassword);
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await signIn(page, email, currentPassword);
  await expect(page.getByText(username, { exact: true }).first()).toBeVisible();

  // WHEN the current password is incorrect
  await openPasswordSettings(page);
  await page.getByLabel('Current password', { exact: true }).fill('Wrong-password-999!');
  await page.getByLabel('New password', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirm password', { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: 'Update password', exact: true }).click();
  await expect(page.getByText('Current password is incorrect').first()).toBeVisible();

  // WHEN the confirmation does not match
  await page.getByLabel('Current password', { exact: true }).fill(currentPassword);
  await page.getByLabel('New password', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirm password', { exact: true }).fill('Different-password-777!');
  await page.getByRole('button', { name: 'Update password', exact: true }).click();
  await expect(page.getByText('Password confirmation does not match').first()).toBeVisible();

  // THEN the old credentials are still usable and the candidate new password is not
  await signOut(page);
  await signIn(page, email, newPassword);
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
  await signIn(page, email, currentPassword);
  await expect(page.getByText(username, { exact: true }).first()).toBeVisible();
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

