const { test, expect } = require('@playwright/test');

const SEED_USER = 'alice-dev';
const SEED_EMAIL = 'alice.dev@example.test';
const SEED_PASSWORD = 'Valid-password-123!';
const NEW_PASSWORD = 'New-password-456!';
const REQUIRED_PASSWORD = 'Required-password-789!';
const REPLACEMENT_PASSWORD = 'Replacement-password-456!';

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const accountMenu = (page) => page.getByRole('button', { name: 'Account menu', exact: true });
const signInLink = (page) => page.getByRole('link', { name: 'Sign in', exact: true });
const signInButton = (page) => page.getByRole('button', { name: 'Sign in', exact: true });
const usernameField = (page) => page.getByLabel('Username or email', { exact: true });
const signInPasswordField = (page) => page.getByLabel('Password', { exact: true });

async function gotoSignInPage(page) {
  await page.goto('/');
  await signInLink(page).click();
  await expect(usernameField(page)).toBeVisible();
}

async function submitSignIn(page, id, password) {
  await usernameField(page).fill(id);
  await signInPasswordField(page).fill(password);
  await signInButton(page).click();
}

async function openRegistrationPage(page) {
  await gotoSignInPage(page);
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
}

async function createAccount(page, password = SEED_PASSWORD) {
  const id = u();
  const username = `pw-user-${id}`;
  const email = `pw-user-${id}@example.test`;
  await openRegistrationPage(page);
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('checkbox', { name: 'Agree to the terms' }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(usernameField(page)).toBeVisible();
  return { username, email, password };
}

async function expectSignedIn(page, username) {
  await expect(accountMenu(page)).toBeVisible();
  await expect(page.getByText(username, { exact: true }).first()).toBeVisible();
}

async function signOut(page) {
  await accountMenu(page).click();
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Sign out' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirm sign out', exact: true }).click();
}

async function openPasswordAndAuthentication(page) {
  await accountMenu(page).click();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Password and authentication', exact: true }).click();
  await expect(page.getByLabel('Current password', { exact: true })).toBeVisible();
}

async function startPasswordReset(page, email) {
  await page.getByRole('link', { name: 'Forgot password', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
  await expect(page.getByText('123456', { exact: true })).toBeVisible();
}

test('REQ-1-1-1: REQ-1-1-1: Register a New GitHub Account - Scenario 1', async ({ page }) => {
  const id = u();
  const username = `pw-user-${id}`;
  const email = `pw-user-${id}@example.test`;

  await openRegistrationPage(page);
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Confirm password', { exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Agree to the terms' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeEnabled();

  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(SEED_PASSWORD);
  await page.getByLabel('Confirm password', { exact: true }).fill(SEED_PASSWORD);
  await page.getByRole('checkbox', { name: 'Agree to the terms' }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();

  // redirected to the sign-in page, password not echoed
  await expect(usernameField(page)).toBeVisible();
  await expect(signInPasswordField(page)).toHaveValue('');
  await expect(page.getByText(SEED_PASSWORD, { exact: true })).toHaveCount(0);

  await submitSignIn(page, email, SEED_PASSWORD);
  await expectSignedIn(page, username);

  await page.reload();
  await expectSignedIn(page, username);
});

test('REQ-1-1-1#2: REQ-1-1-1: Register a New GitHub Account - Scenario 2', async ({ page }) => {
  const id = u();
  const badUsername = `-pw-user-${id}`;
  const username = `pw-user-${id}`;
  const email = `pw-user-${id}@example.test`;

  await openRegistrationPage(page);

  // every invalid field submitted at once
  await page.getByLabel('Username', { exact: true }).fill(badUsername);
  await page.getByLabel('Email', { exact: true }).fill('not-an-email');
  await page.getByLabel('Password', { exact: true }).fill('short');
  await page.getByLabel('Confirm password', { exact: true }).fill('different');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();

  await expect(page.getByText('Username format is invalid', { exact: true })).toBeVisible();
  await expect(page.getByText('Email format is invalid', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Password requirements are not satisfied', { exact: true })
  ).toBeVisible();
  await expect(page.getByText('Agree to terms is required', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Username', { exact: true })).toHaveValue(badUsername);
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('not-an-email');
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Confirm password', { exact: true })).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeEnabled();

  // mismatched confirmation only: still no account created, form keeps the input
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(SEED_PASSWORD);
  await page.getByLabel('Confirm password', { exact: true }).fill('does-not-match');
  await page.getByRole('checkbox', { name: 'Agree to the terms' }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByLabel('Username', { exact: true })).toHaveValue(username);
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue(email);
  await expect(usernameField(page)).toHaveCount(0);

  // matching confirmation now succeeds, proving the failed submission created nothing
  await page.getByLabel('Confirm password', { exact: true }).fill(SEED_PASSWORD);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(usernameField(page)).toBeVisible();

  await submitSignIn(page, email, SEED_PASSWORD);
  await expectSignedIn(page, username);
});

test('REQ-1-1-1#3: REQ-1-1-1: Register a New GitHub Account - Scenario 3', async ({ page }) => {
  const id = u();
  const username = `pw-user-${id}`;
  const email = `pw-user-${id}@example.test`;
  const otherEmail = `pw-user-${id}-other@example.test`;

  await openRegistrationPage(page);
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(SEED_PASSWORD);
  await page.getByLabel('Confirm password', { exact: true }).fill(SEED_PASSWORD);
  await page.getByRole('checkbox', { name: 'Agree to the terms' }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(usernameField(page)).toBeVisible();

  // reopening the registration page and reusing the username with another unused email
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(otherEmail);
  await page.getByLabel('Password', { exact: true }).fill(SEED_PASSWORD);
  await page.getByLabel('Confirm password', { exact: true }).fill(SEED_PASSWORD);
  await page.getByRole('checkbox', { name: 'Agree to the terms' }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();

  await expect(page.getByText('Username already exists', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Username', { exact: true })).toHaveValue(username);
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue(otherEmail);
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeEnabled();
  await expect(usernameField(page)).toHaveCount(0);

  // the originally registered account still signs in
  await gotoSignInPage(page);
  await submitSignIn(page, email, SEED_PASSWORD);
  await expectSignedIn(page, username);
});

test('REQ-1-1-2: REQ-1-1-2: Sign In with an Existing Account - Scenario 1', async ({ page }) => {
  await gotoSignInPage(page);

  // unknown account: generic failure, no session
  await submitSignIn(page, `unknown-account-${u()}`, SEED_PASSWORD);
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
  await expect(accountMenu(page)).toHaveCount(0);

  // incorrect password: exactly the same generic failure
  await submitSignIn(page, SEED_USER, 'Wrong-password-000!');
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
  await expect(accountMenu(page)).toHaveCount(0);

  // after failed sign in the application still requires authentication
  await page.goto('/');
  await expect(signInLink(page)).toBeVisible();
  await expect(accountMenu(page)).toHaveCount(0);

  // successful sign in with the verified email
  await signInLink(page).click();
  await submitSignIn(page, SEED_EMAIL, SEED_PASSWORD);
  await expectSignedIn(page, SEED_USER);

  await page.reload();
  await expectSignedIn(page, SEED_USER);
});

test('REQ-1-1-2#2: REQ-1-1-2: Sign In with an Existing Account - Scenario 2', async ({ page }) => {
  await gotoSignInPage(page);
  await submitSignIn(page, SEED_USER, SEED_PASSWORD);
  await expectSignedIn(page, SEED_USER);

  await page.reload();
  await expectSignedIn(page, SEED_USER);

  await page.goto('/');
  await expectSignedIn(page, SEED_USER);
});

test('REQ-1-1-2#3: REQ-1-1-2: Sign In with an Existing Account - Scenario 3', async ({ page }) => {
  await gotoSignInPage(page);
  await submitSignIn(page, SEED_EMAIL, SEED_PASSWORD);
  await expectSignedIn(page, SEED_USER);

  await page.reload();
  await expectSignedIn(page, SEED_USER);
});

test('REQ-1-1-2#4: REQ-1-1-2: Sign In with an Existing Account - Scenario 4', async ({ page }) => {
  await gotoSignInPage(page);

  // rejected sign in leaves the original unauthenticated state unchanged
  await submitSignIn(page, SEED_USER, 'Incorrect-password-999!');
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
  await expect(accountMenu(page)).toHaveCount(0);
  await page.reload();
  await expect(signInLink(page)).toBeVisible();

  // accepted sign in is persisted
  await submitSignIn(page, SEED_USER, SEED_PASSWORD);
  await expectSignedIn(page, SEED_USER);

  await page.reload();
  await expectSignedIn(page, SEED_USER);
  await page.goto('/');
  await expectSignedIn(page, SEED_USER);
});

test('REQ-1-1-3: REQ-1-1-3: Recover Account Access Through a Verified Email - Scenario 1', async ({ page }) => {
  const account = await createAccount(page);
  const unknownEmail = `unknown-${u()}@example.test`;

  // unknown email: same next step, same fixed code, no existence disclosure
  await startPasswordReset(page, unknownEmail);
  await expect(page.getByLabel('Verification code', { exact: true })).toBeVisible();
  await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Confirm password', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset password', exact: true })).toBeVisible();

  // registered email: same next step and same fixed code
  await gotoSignInPage(page);
  await startPasswordReset(page, account.email);

  // wrong verification code explains the reason and changes nothing
  await page.getByLabel('Verification code', { exact: true }).fill('000000');
  await page.getByLabel('New password', { exact: true }).fill(REPLACEMENT_PASSWORD);
  await page.getByLabel('Confirm password', { exact: true }).fill(REPLACEMENT_PASSWORD);
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();
  await expect(page.getByText('Verification code is invalid', { exact: true })).toBeVisible();
  await expect(page.getByText('Password updated', { exact: true })).toHaveCount(0);

  // correct code for the registered email updates the password
  await page.getByLabel('Verification code', { exact: true }).fill('123456');
  await page.getByLabel('New password', { exact: true }).fill(REPLACEMENT_PASSWORD);
  await page.getByLabel('Confirm password', { exact: true }).fill(REPLACEMENT_PASSWORD);
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();
  await expect(page.getByText('Password updated', { exact: true })).toBeVisible();

  // old password no longer signs in, the new password does
  await gotoSignInPage(page);
  await submitSignIn(page, account.email, account.password);
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
  await signInPasswordField(page).fill(REPLACEMENT_PASSWORD);
  await signInButton(page).click();
  await expectSignedIn(page, account.username);
});

test('REQ-1-1-3#2: REQ-1-1-3: Recover Account Access Through a Verified Email - Scenario 2', async ({ page }) => {
  const account = await createAccount(page);

  await startPasswordReset(page, account.email);
  await page.getByLabel('Verification code', { exact: true }).fill('123456');
  await page.getByLabel('New password', { exact: true }).fill(REPLACEMENT_PASSWORD);
  await page.getByLabel('Confirm password', { exact: true }).fill(REPLACEMENT_PASSWORD);
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();
  await expect(page.getByText('Password updated', { exact: true })).toBeVisible();

  await gotoSignInPage(page);
  await submitSignIn(page, account.email, REPLACEMENT_PASSWORD);
  await expectSignedIn(page, account.username);
  await page.reload();
  await expectSignedIn(page, account.username);
});

test('REQ-1-1-3#3: REQ-1-1-3: Recover Account Access Through a Verified Email - Scenario 3', async ({ page }) => {
  const account = await createAccount(page);

  await startPasswordReset(page, account.email);

  // noncompliant replacement password
  await page.getByLabel('Verification code', { exact: true }).fill('123456');
  await page.getByLabel('New password', { exact: true }).fill('short');
  await page.getByLabel('Confirm password', { exact: true }).fill('short');
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();
  await expect(
    page.getByText('Password requirements are not satisfied', { exact: true })
  ).toBeVisible();
  await expect(page.getByText('Password updated', { exact: true })).toHaveCount(0);

  // mismatched confirmation
  await page.getByLabel('New password', { exact: true }).fill(REPLACEMENT_PASSWORD);
  await page.getByLabel('Confirm password', { exact: true }).fill('does-not-match-123!');
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();
  await expect(page.getByText('Password updated', { exact: true })).toHaveCount(0);

  // the account keeps its old credentials
  await gotoSignInPage(page);
  await submitSignIn(page, account.email, account.password);
  await expectSignedIn(page, account.username);

  await signOut(page);
  await gotoSignInPage(page);
  await submitSignIn(page, account.email, REPLACEMENT_PASSWORD);
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
  await expect(accountMenu(page)).toHaveCount(0);
});

test('REQ-1-2: REQ-1-2: Sign Out and End the Current Web Session - Scenario 1', async ({ page }) => {
  await gotoSignInPage(page);
  await submitSignIn(page, SEED_USER, SEED_PASSWORD);
  await expectSignedIn(page, SEED_USER);

  // a protected account-settings page reached from the account menu
  await openPasswordAndAuthentication(page);
  const protectedUrl = page.url();

  // cancel keeps the session and the page
  await accountMenu(page).click();
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Sign out' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Confirm sign out', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByLabel('Current password', { exact: true })).toBeVisible();
  await expect(accountMenu(page)).toBeVisible();

  // confirming sign out ends the session
  await signOut(page);
  await expect(signInLink(page)).toBeVisible();
  await expect(accountMenu(page)).toHaveCount(0);

  // refresh, back navigation and a direct reopen all require authentication again
  await page.goto(protectedUrl);
  await expect(accountMenu(page)).toHaveCount(0);
  await expect(signInLink(page)).toBeVisible();

  await page.goBack();
  await expect(accountMenu(page)).toHaveCount(0);

  await page.goto(protectedUrl);
  await page.reload();
  await expect(accountMenu(page)).toHaveCount(0);
  await expect(signInLink(page)).toBeVisible();
});

test('REQ-1-2#2: REQ-1-2: Sign Out and End the Current Web Session - Scenario 2', async ({ page }) => {
  await gotoSignInPage(page);
  await submitSignIn(page, SEED_USER, SEED_PASSWORD);
  await expectSignedIn(page, SEED_USER);

  await accountMenu(page).click();
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Sign out' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Confirm sign out', exact: true })).toBeVisible();

  // closing the dialog retains the current session
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expectSignedIn(page, SEED_USER);

  // confirming invalidates the session
  await signOut(page);
  await expect(accountMenu(page)).toHaveCount(0);
  await expect(signInLink(page)).toBeVisible();

  await page.reload();
  await expect(signInLink(page)).toBeVisible();
  await expect(accountMenu(page)).toHaveCount(0);
});

test('REQ-1-3: REQ-1-3: Change Account Password - Scenario 1', async ({ page }) => {
  const account = await createAccount(page);
  await submitSignIn(page, account.email, account.password);
  await expectSignedIn(page, account.username);

  await openPasswordAndAuthentication(page);
  await page.getByLabel('Current password', { exact: true }).fill(account.password);
  await page.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel('Confirm password', { exact: true }).fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Update password', exact: true }).click();
  await expect(page.getByText('Password updated', { exact: true })).toBeVisible();

  await signOut(page);
  await gotoSignInPage(page);
  await submitSignIn(page, account.email, NEW_PASSWORD);
  await expectSignedIn(page, account.username);

  await signOut(page);
  await gotoSignInPage(page);
  await submitSignIn(page, account.email, account.password);
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
  await expect(accountMenu(page)).toHaveCount(0);
});

test('REQ-1-3#2: REQ-1-3: Change Account Password - Scenario 2', async ({ page }) => {
  const account = await createAccount(page);
  await submitSignIn(page, account.email, account.password);
  await expectSignedIn(page, account.username);

  await openPasswordAndAuthentication(page);

  // missing current password
  await page.getByLabel('New password', { exact: true }).fill(REQUIRED_PASSWORD);
  await page.getByLabel('Confirm password', { exact: true }).fill(REQUIRED_PASSWORD);
  await page.getByRole('button', { name: 'Update password', exact: true }).click();
  await expect(page.getByText('Current password is required', { exact: true })).toBeVisible();

  // incorrect current password
  await page.getByLabel('Current password', { exact: true }).fill('Wrong-current-000!');
  await page.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel('Confirm password', { exact: true }).fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Update password', exact: true }).click();
  await expect(page.getByText('Current password is incorrect', { exact: true })).toBeVisible();

  // mismatched confirmation
  await page.getByLabel('Current password', { exact: true }).fill(account.password);
  await page.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel('Confirm password', { exact: true }).fill('does-not-match');
  await page.getByRole('button', { name: 'Update password', exact: true }).click();
  await expect(page.getByText('Password confirmation does not match', { exact: true })).toBeVisible();
  await expect(page.getByText('Password updated', { exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByLabel('Current password', { exact: true })).toBeVisible();

  // the rejected submissions left the credentials untouched
  await signOut(page);
  await gotoSignInPage(page);
  await submitSignIn(page, account.email, account.password);
  await expectSignedIn(page, account.username);

  await signOut(page);
  await gotoSignInPage(page);
  await submitSignIn(page, account.email, NEW_PASSWORD);
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
  await expect(accountMenu(page)).toHaveCount(0);
});

test('REQ-1-3#3: REQ-1-3: Change Account Password - Scenario 3', async ({ page }) => {
  const account = await createAccount(page);
  const candidate = 'Another-password-789!';
  await submitSignIn(page, account.email, account.password);
  await expectSignedIn(page, account.username);

  await openPasswordAndAuthentication(page);
  await page.getByLabel('Current password', { exact: true }).fill(account.password);
  await page.getByLabel('New password', { exact: true }).fill(candidate);
  await page.getByLabel('Confirm password', { exact: true }).fill(candidate);
  await page.getByRole('button', { name: 'Update password', exact: true }).click();
  await expect(page.getByText('Password updated', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Current password', { exact: true })).toBeVisible();

  await signOut(page);
  await gotoSignInPage(page);
  await submitSignIn(page, account.email, candidate);
  await expectSignedIn(page, account.username);

  await page.reload();
  await expectSignedIn(page, account.username);
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

