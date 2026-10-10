const { test, expect } = require('@playwright/test');

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const SEED_PASSWORD = 'Valid-password-123!';

async function openSignIn(page) {
  await page.goto('/');
  const link = page.getByRole('link', { name: 'Sign in', exact: true });
  await expect(link).toBeVisible();
  await link.click();
}

async function submitSignIn(page, usernameOrEmail, password) {
  await page.getByLabel('Username or email', { exact: true }).fill(usernameOrEmail);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function signInFromHome(page, usernameOrEmail, password) {
  await openSignIn(page);
  await submitSignIn(page, usernameOrEmail, password);
}

async function openRegistration(page) {
  await openSignIn(page);
  const link = page.getByRole('link', { name: 'Create an account', exact: true });
  await expect(link).toBeVisible();
  await link.click();
}

async function openAccountMenu(page) {
  const menu = page.getByRole('button', { name: 'Account menu', exact: true });
  await expect(menu).toBeVisible();
  await menu.click();
}

async function confirmSignOut(page) {
  await openAccountMenu(page);
  const signOutLink = page.getByRole('link', { name: 'Sign out', exact: true });
  await expect(signOutLink).toBeVisible();
  await signOutLink.click();
  const dialog = page.getByRole('dialog', { name: 'Sign out', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirm sign out', exact: true }).click();
}

async function openPasswordSettings(page) {
  await openAccountMenu(page);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Password and authentication', exact: true }).click();
  await expect(page.getByLabel('Current password', { exact: true })).toBeVisible();
}

async function startPasswordRecovery(page, email) {
  await openSignIn(page);
  const forgot = page.getByRole('link', { name: 'Forgot password', exact: true });
  await expect(forgot).toBeVisible();
  await forgot.click();
  const emailField = page.getByLabel('Email', { exact: true });
  await expect(emailField).toBeVisible();
  await emailField.fill(email);
  const sendResetLink = page.getByRole('button', { name: 'Send reset link', exact: true });
  if ((await sendResetLink.count()) > 0) {
    await sendResetLink.click();
  } else {
    await page.getByRole('button', { name: 'Reset password', exact: true }).click();
  }
}

async function signInInFreshSession(browser, origin, usernameOrEmail, password) {
  const context = await browser.newContext({ baseURL: origin });
  const fresh = await context.newPage();
  await openSignIn(fresh);
  await submitSignIn(fresh, usernameOrEmail, password);
  return { context, fresh };
}

test('REQ-1-1-1: REQ-1-1-1: Register a New GitHub Account - Scenario 1', async ({ page }) => {
  const username = `nora-demo-${uid()}`;
  const email = `${username}@example.test`;

  await openRegistration(page);
  await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Confirm password', { exact: true })).toBeVisible();
  const terms = page.getByRole('checkbox', { name: 'Agree to the terms', exact: true });
  await expect(terms).toBeVisible();
  const createAccount = page.getByRole('button', { name: 'Create account', exact: true });
  await expect(createAccount).toBeVisible();

  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(SEED_PASSWORD);
  await page.getByLabel('Confirm password', { exact: true }).fill(SEED_PASSWORD);
  await terms.check();
  await createAccount.click();

  await expect(page.getByLabel('Username or email', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();

  await submitSignIn(page, email, SEED_PASSWORD);
  await expect(page.getByText(username, { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText(username, { exact: true }).first()).toBeVisible();
});

test('REQ-1-1-1#2: REQ-1-1-1: Register a New GitHub Account - Scenario 2', async ({ page }) => {
  await openRegistration(page);
  await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Confirm password', { exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Agree to the terms', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeVisible();

  await page.getByLabel('Username', { exact: true }).fill('-invalid-demo');
  await page.getByLabel('Email', { exact: true }).fill('invalid.username@example.test');
  await page.getByLabel('Password', { exact: true }).fill(SEED_PASSWORD);
  await page.getByLabel('Confirm password', { exact: true }).fill(SEED_PASSWORD);
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();

  await expect(page.getByText('Username format is invalid', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Username', { exact: true })).toHaveValue('-invalid-demo');

  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Confirm password', { exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Agree to the terms', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeEnabled();
  await expect(page.getByLabel('Username or email', { exact: true })).toHaveCount(0);
});

test('REQ-1-1-1#3: REQ-1-1-1: Register a New GitHub Account - Scenario 3', async ({ page }) => {
  await openRegistration(page);
  await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Confirm password', { exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Agree to the terms', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeVisible();

  await page.getByLabel('Username', { exact: true }).fill('invalid-email-demo');
  await page.getByLabel('Email', { exact: true }).fill('not-an-email');
  await page.getByLabel('Password', { exact: true }).fill(SEED_PASSWORD);
  await page.getByLabel('Confirm password', { exact: true }).fill(SEED_PASSWORD);
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();

  await expect(page.getByText('Email format is invalid', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('not-an-email');

  await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Confirm password', { exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Agree to the terms', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeEnabled();
  await expect(page.getByLabel('Username or email', { exact: true })).toHaveCount(0);
});

test('REQ-1-1-2: REQ-1-1-2: Sign In with an Existing Account - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toHaveCount(1);
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();

  await submitSignIn(page, 'alice-dev', SEED_PASSWORD);
  await expect(page.getByText('alice-dev', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('alice-dev', { exact: true }).first()).toBeVisible();
});

test('REQ-1-1-2#2: REQ-1-1-2: Sign In with an Existing Account - Scenario 2', async ({ page }) => {
  await openSignIn(page);
  await submitSignIn(page, 'alice.dev@example.test', 'Valid-password-123!-incorrect');

  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
});

test('REQ-1-1-2#3: REQ-1-1-2: Sign In with an Existing Account - Scenario 3', async ({ page }) => {
  await openSignIn(page);
  await submitSignIn(page, 'alice.dev@example.test', SEED_PASSWORD);

  await expect(page.getByText('alice-dev', { exact: true }).first()).toBeVisible();
});

test('REQ-1-1-2#4: REQ-1-1-2: Sign In with an Existing Account - Scenario 4', async ({ page }) => {
  await openSignIn(page);
  await submitSignIn(page, 'unknown@example.test', SEED_PASSWORD);
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();

  await openSignIn(page);
  await submitSignIn(page, 'alice-dev', 'Valid-password-123!-wrong');
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
});

test('REQ-1-1-3: REQ-1-1-3: Recover Account Access Through a Verified Email - Scenario 1', async ({ page }) => {
  await startPasswordRecovery(page, 'recovery-visibility@example.test');
  await expect(page.getByText('123456', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Verification code', { exact: true })).toBeVisible();
  await expect(page.getByLabel('New password', { exact: true })).toBeVisible();

  await startPasswordRecovery(page, 'unknown@example.test');
  await expect(page.getByText('123456', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Verification code', { exact: true })).toBeVisible();
  await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
});

test('REQ-1-1-3#2: REQ-1-1-3: Recover Account Access Through a Verified Email - Scenario 2', async ({ page }) => {
  await startPasswordRecovery(page, 'recovery-invalid-code@example.test');
  await page.getByLabel('Verification code', { exact: true }).fill('000000');
  await page.getByLabel('New password', { exact: true }).fill('Replacement-password-456!');
  await page.getByLabel('Confirm password', { exact: true }).fill('Replacement-password-456!');
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();

  await expect(page.getByText('Verification code is invalid', { exact: true })).toBeVisible();

  await signInFromHome(page, 'recovery-invalid-code@example.test', SEED_PASSWORD);
  await expect(page.getByText('recovery-invalid-code', { exact: true }).first()).toBeVisible();
});

test('REQ-1-1-3#3: REQ-1-1-3: Recover Account Access Through a Verified Email - Scenario 3', async ({ page }) => {
  await startPasswordRecovery(page, 'recovery-success@example.test');
  await page.getByLabel('Verification code', { exact: true }).fill('123456');
  await page.getByLabel('New password', { exact: true }).fill('Replacement-password-456!');
  await page.getByLabel('Confirm password', { exact: true }).fill('Replacement-password-456!');
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();

  await expect(page.getByText('Password updated', { exact: true })).toBeVisible();

  await signInFromHome(page, 'recovery-success@example.test', 'Replacement-password-456!');
  await expect(page.getByText('recovery-success', { exact: true }).first()).toBeVisible();
});

test('REQ-1-2: REQ-1-2: Sign Out and End the Current Web Session - Scenario 1', async ({ page }) => {
  await signInFromHome(page, 'alice-dev', SEED_PASSWORD);
  await openAccountMenu(page);
  await page.getByRole('link', { name: 'Your organizations', exact: true }).click();
  await expect(page.getByRole('link', { name: 'New organization', exact: true })).toBeVisible();
  const protectedUrl = page.url();

  await openAccountMenu(page);
  const signOutLink = page.getByRole('link', { name: 'Sign out', exact: true });
  await expect(signOutLink).toBeVisible();
  await signOutLink.click();
  const dialog = page.getByRole('dialog', { name: 'Sign out', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Confirm sign out', exact: true })).toBeVisible();
  const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true });
  await expect(cancel).toBeVisible();

  await cancel.click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'New organization', exact: true })).toBeVisible();

  await confirmSignOut(page);
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();

  await page.goBack();
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();

  await page.goto(protectedUrl);
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);
});

test('REQ-1-2#2: REQ-1-2: Sign Out and End the Current Web Session - Scenario 2', async ({ page }) => {
  await signInFromHome(page, 'alice-dev', SEED_PASSWORD);
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();

  await openAccountMenu(page);
  const signOutLink = page.getByRole('link', { name: 'Sign out', exact: true });
  await expect(signOutLink).toBeVisible();
  await signOutLink.click();

  const dialog = page.getByRole('dialog', { name: 'Sign out', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Confirm sign out', exact: true })).toBeVisible();
  const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true });
  await expect(cancel).toBeVisible();

  await cancel.click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();

  await confirmSignOut(page);
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);
});

test('REQ-1-3: REQ-1-3: Change Account Password - Scenario 1', async ({ page, browser }) => {
  await signInFromHome(page, 'password-change-success', SEED_PASSWORD);
  await openPasswordSettings(page);

  await page.getByLabel('Current password', { exact: true }).fill(SEED_PASSWORD);
  await page.getByLabel('New password', { exact: true }).fill('New-password-456!');
  await page.getByLabel('Confirm password', { exact: true }).fill('New-password-456!');
  await page.getByRole('button', { name: 'Update password', exact: true }).click();

  await expect(page.getByText('Password updated', { exact: true })).toBeVisible();

  const origin = new URL(page.url()).origin;
  const { context, fresh } = await signInInFreshSession(
    browser,
    origin,
    'password-change-success@example.test',
    'New-password-456!'
  );
  await expect(fresh.getByText('password-change-success', { exact: true }).first()).toBeVisible();
  await context.close();
});

test('REQ-1-3#2: REQ-1-3: Change Account Password - Scenario 2', async ({ page, browser }) => {
  await signInFromHome(page, 'password-change-invalid', SEED_PASSWORD);
  await openPasswordSettings(page);

  await page.getByLabel('Current password', { exact: true }).fill('Valid-password-123!-wrong');
  await page.getByLabel('New password', { exact: true }).fill('Another-valid-password-123!');
  await page.getByLabel('Confirm password', { exact: true }).fill('does-not-match');
  await page.getByRole('button', { name: 'Update password', exact: true }).click();

  await expect(page.getByText('Current password is incorrect', { exact: true })).toBeVisible();

  const origin = new URL(page.url()).origin;
  const { context, fresh } = await signInInFreshSession(
    browser,
    origin,
    'password-change-invalid@example.test',
    SEED_PASSWORD
  );
  await expect(fresh.getByText('password-change-invalid', { exact: true }).first()).toBeVisible();
  await context.close();
});

test('REQ-1-3#3: REQ-1-3: Change Account Password - Scenario 3', async ({ page, browser }) => {
  await signInFromHome(page, 'password-change-required', SEED_PASSWORD);
  await openPasswordSettings(page);

  await page.getByLabel('New password', { exact: true }).fill('Required-password-789!');
  await page.getByLabel('Confirm password', { exact: true }).fill('Required-password-789!');
  await page.getByRole('button', { name: 'Update password', exact: true }).click();

  await expect(page.getByText('Current password is required', { exact: true })).toBeVisible();

  const origin = new URL(page.url()).origin;
  const { context, fresh } = await signInInFreshSession(
    browser,
    origin,
    'password-change-required@example.test',
    SEED_PASSWORD
  );
  await expect(fresh.getByText('password-change-required', { exact: true }).first()).toBeVisible();
  await context.close();
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

