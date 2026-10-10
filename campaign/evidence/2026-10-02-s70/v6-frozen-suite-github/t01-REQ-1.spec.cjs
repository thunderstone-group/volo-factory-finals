const { test, expect } = require('@playwright/test');

const PASSWORD = 'Valid-password-123!';

async function isVisibleQuick(locator, timeout = 1500) {
  try {
    await locator.first().waitFor({ state: 'visible', timeout });
    return true;
  } catch (err) {
    return false;
  }
}

async function signOutViaMenu(page) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Sign out' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirm sign out', exact: true }).click();
}

async function ensureSignedOut(page) {
  await page.goto('/');
  const menu = page.getByRole('button', { name: 'Account menu', exact: true });
  if (await isVisibleQuick(menu)) {
    await signOutViaMenu(page);
    await page.goto('/');
  }
}

async function signIn(page, identifier, password = PASSWORD) {
  await ensureSignedOut(page);
  await page.getByRole('link', { name: 'Sign in', exact: true }).first().click();
  await page.getByLabel('Username or email', { exact: true }).fill(identifier);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function openRegistrationPage(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).first().click();
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
}

async function openResetStep(page, email) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).first().click();
  await page.getByRole('link', { name: 'Forgot password', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  const sendResetLink = page.getByRole('button', { name: 'Send reset link', exact: true });
  if (await isVisibleQuick(sendResetLink)) {
    await sendResetLink.click();
  } else if (!(await isVisibleQuick(page.getByLabel('Verification code', { exact: true })))) {
    const resetPassword = page.getByRole('button', { name: 'Reset password', exact: true });
    if (await isVisibleQuick(resetPassword)) {
      await resetPassword.click();
    }
  }
}

async function openPasswordAuthentication(page) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  const settings = page.getByRole('link', { name: 'Settings', exact: true });
  if (await isVisibleQuick(settings)) {
    await settings.first().click();
  }
  await page.getByRole('link', { name: 'Password and authentication', exact: true }).first().click();
}

test('REQ-1-1-1: Register a New GitHub Account - Scenario 1', async ({ page }) => {
  await openRegistrationPage(page);

  await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Confirm password', { exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Agree to the terms', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeEnabled();

  await page.getByLabel('Username', { exact: true }).fill('nora-demo');
  await page.getByLabel('Email', { exact: true }).fill('nora.demo@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Valid-password-123!');
  await page.getByLabel('Confirm password', { exact: true }).fill('Valid-password-123!');
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();

  await expect(page.getByLabel('Username or email', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();

  await page.getByLabel('Username or email', { exact: true }).fill('nora.demo@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Valid-password-123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(page.getByText('nora-demo', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('nora-demo', { exact: true }).first()).toBeVisible();
});

test('REQ-1-1-1#2: Register a New GitHub Account - Scenario 2', async ({ page }) => {
  await openRegistrationPage(page);

  await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Confirm password', { exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Agree to the terms', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeEnabled();

  await page.getByLabel('Username', { exact: true }).fill('-invalid-demo');
  await page.getByLabel('Email', { exact: true }).fill('invalid.username@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Valid-password-123!');
  await page.getByLabel('Confirm password', { exact: true }).fill('Valid-password-123!');
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();

  await expect(page.getByText('Username format is invalid', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Username', { exact: true })).toHaveValue('-invalid-demo');

  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Confirm password', { exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Agree to the terms', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeVisible();
});

test('REQ-1-1-1#3: Register a New GitHub Account - Scenario 3', async ({ page }) => {
  await openRegistrationPage(page);

  await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Confirm password', { exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Agree to the terms', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeEnabled();

  await page.getByLabel('Username', { exact: true }).fill('invalid-email-demo');
  await page.getByLabel('Email', { exact: true }).fill('not-an-email');
  await page.getByLabel('Password', { exact: true }).fill('Valid-password-123!');
  await page.getByLabel('Confirm password', { exact: true }).fill('Valid-password-123!');
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();

  await expect(page.getByText('Email format is invalid', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('not-an-email');

  await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Confirm password', { exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Agree to the terms', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeVisible();
});

test('REQ-1-1-2: Sign In with an Existing Account - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toHaveCount(1);
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();

  await page.getByLabel('Username or email', { exact: true }).fill('alice-dev');
  await page.getByLabel('Password', { exact: true }).fill('Valid-password-123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(page.getByText('alice-dev', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('alice-dev', { exact: true }).first()).toBeVisible();
});

test('REQ-1-1-2#2: Sign In with an Existing Account - Scenario 2', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).first().click();

  await page.getByLabel('Username or email', { exact: true }).fill('alice.dev@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Valid-password-123!-incorrect');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
});

test('REQ-1-1-2#3: Sign In with an Existing Account - Scenario 3', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).first().click();

  await page.getByLabel('Username or email', { exact: true }).fill('alice.dev@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Valid-password-123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(page.getByText('alice-dev', { exact: true }).first()).toBeVisible();
});

test('REQ-1-1-2#4: Sign In with an Existing Account - Scenario 4', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).first().click();
  await page.getByLabel('Username or email', { exact: true }).fill('unknown@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Valid-password-123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();

  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).first().click();
  await page.getByLabel('Username or email', { exact: true }).fill('alice-dev');
  await page.getByLabel('Password', { exact: true }).fill('Valid-password-123!-wrong');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
});

test('REQ-1-1-3: Recover Account Access Through a Verified Email - Scenario 1', async ({ page }) => {
  await openResetStep(page, 'recovery-visibility@example.test');
  await expect(page.getByText('123456', { exact: true }).first()).toBeVisible();
  await expect(page.getByLabel('Verification code', { exact: true })).toBeVisible();
  await expect(page.getByLabel('New password', { exact: true })).toBeVisible();

  await openResetStep(page, 'unknown@example.test');
  await expect(page.getByText('123456', { exact: true }).first()).toBeVisible();
  await expect(page.getByLabel('Verification code', { exact: true })).toBeVisible();
  await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
});

test('REQ-1-1-3#2: Recover Account Access Through a Verified Email - Scenario 2', async ({ page }) => {
  await openResetStep(page, 'recovery-invalid-code@example.test');

  await page.getByLabel('Verification code', { exact: true }).fill('000000');
  await page.getByLabel('New password', { exact: true }).fill('Replacement-password-456!');
  await page.getByLabel('Confirm password', { exact: true }).fill('Replacement-password-456!');
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();

  await expect(page.getByText('Verification code is invalid', { exact: true })).toBeVisible();

  await signIn(page, 'recovery-invalid-code@example.test', 'Valid-password-123!');
  await expect(page.getByText('recovery-invalid-code', { exact: true }).first()).toBeVisible();
});

test('REQ-1-1-3#3: Recover Account Access Through a Verified Email - Scenario 3', async ({ page }) => {
  await openResetStep(page, 'recovery-success@example.test');

  await page.getByLabel('Verification code', { exact: true }).fill('123456');
  await page.getByLabel('New password', { exact: true }).fill('Replacement-password-456!');
  await page.getByLabel('Confirm password', { exact: true }).fill('Replacement-password-456!');
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();

  await expect(page.getByText('Password updated', { exact: true }).first()).toBeVisible();

  await signIn(page, 'recovery-success@example.test', 'Replacement-password-456!');
  await expect(page.getByText('recovery-success', { exact: true }).first()).toBeVisible();
});

test('REQ-1-2: Sign Out and End the Current Web Session - Scenario 1', async ({ page }) => {
  await signIn(page, 'alice-dev', 'Valid-password-123!');
  await expect(page.getByText('alice-dev', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Your organizations', exact: true }).click();
  const protectedUrl = page.url();
  await expect(page.getByRole('link', { name: 'New organization', exact: true })).toBeVisible();

  const signOutLink = page.getByRole('link', { name: 'Sign out', exact: true });
  const accountMenu = page.getByRole('button', { name: 'Account menu', exact: true });
  const dialog = page.getByRole('dialog', { name: 'Sign out' });

  await accountMenu.click();
  await signOutLink.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(accountMenu).toBeVisible();
  await expect(page.getByText('alice-dev', { exact: true }).first()).toBeVisible();

  if (!(await isVisibleQuick(signOutLink))) {
    await accountMenu.click();
  }
  await signOutLink.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirm sign out', exact: true }).click();

  await expect(page.getByRole('link', { name: 'Sign in', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('link', { name: 'Sign in', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);

  await page.goto(protectedUrl);
  await expect(page.getByRole('link', { name: 'Sign in', exact: true }).first()).toBeVisible();
});

test('REQ-1-2#2: Sign Out and End the Current Web Session - Scenario 2', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Sign in', exact: true }).first()).toBeVisible();

  await signIn(page, 'alice-dev', 'Valid-password-123!');
  await expect(page.getByText('alice-dev', { exact: true }).first()).toBeVisible();

  const accountMenu = page.getByRole('button', { name: 'Account menu', exact: true });
  await accountMenu.click();
  await expect(page.getByRole('link', { name: 'Sign out', exact: true })).toHaveCount(1);
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Sign out' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Confirm sign out', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirm sign out', exact: true }).click();

  await expect(page.getByRole('link', { name: 'Sign in', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('link', { name: 'Sign in', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);
});

test('REQ-1-3: Change Account Password - Scenario 1', async ({ page }) => {
  await signIn(page, 'password-change-success', 'Valid-password-123!');
  await expect(page.getByText('password-change-success', { exact: true }).first()).toBeVisible();

  await openPasswordAuthentication(page);
  await page.getByLabel('Current password', { exact: true }).fill('Valid-password-123!');
  await page.getByLabel('New password', { exact: true }).fill('New-password-456!');
  await page.getByLabel('Confirm password', { exact: true }).fill('New-password-456!');
  await page.getByRole('button', { name: 'Update password', exact: true }).click();

  await expect(page.getByText('Password updated', { exact: true }).first()).toBeVisible();

  await signIn(page, 'password-change-success@example.test', 'New-password-456!');
  await expect(page.getByText('password-change-success', { exact: true }).first()).toBeVisible();
});

test('REQ-1-3#2: Change Account Password - Scenario 2', async ({ page }) => {
  await signIn(page, 'password-change-invalid', 'Valid-password-123!');
  await expect(page.getByText('password-change-invalid', { exact: true }).first()).toBeVisible();

  await openPasswordAuthentication(page);
  await page.getByLabel('Current password', { exact: true }).fill('Valid-password-123!-wrong');
  await page.getByLabel('New password', { exact: true }).fill('Another-valid-password-123!');
  await page.getByLabel('Confirm password', { exact: true }).fill('does-not-match');
  await page.getByRole('button', { name: 'Update password', exact: true }).click();

  await expect(page.getByText('Current password is incorrect', { exact: true }).first()).toBeVisible();

  await signIn(page, 'password-change-invalid@example.test', 'Valid-password-123!');
  await expect(page.getByText('password-change-invalid', { exact: true }).first()).toBeVisible();
});

test('REQ-1-3#3: Change Account Password - Scenario 3', async ({ page }) => {
  await signIn(page, 'password-change-required', 'Valid-password-123!');
  await expect(page.getByText('password-change-required', { exact: true }).first()).toBeVisible();

  await openPasswordAuthentication(page);
  await page.getByLabel('New password', { exact: true }).fill('Required-password-789!');
  await page.getByLabel('Confirm password', { exact: true }).fill('Required-password-789!');
  await page.getByRole('button', { name: 'Update password', exact: true }).click();

  await expect(page.getByText('Current password is required', { exact: true }).first()).toBeVisible();

  await signIn(page, 'password-change-required@example.test', 'Valid-password-123!');
  await expect(page.getByText('password-change-required', { exact: true }).first()).toBeVisible();
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

