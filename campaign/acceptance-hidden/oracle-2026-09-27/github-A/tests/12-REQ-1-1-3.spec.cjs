// REQ-1-1-3 Recover Account Access Through a Verified Email (orders 8-10).
// Credential changes run on a freshly registered account (the description: "the recovery scenario uses a
// newly registered account"), so the shared seed alice-dev keeps its password for later scenarios.
const { test, expect } = require('@playwright/test');

const PASSWORD = 'Valid-password-123!';
const REPLACEMENT = 'Replacement-password-456!';
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const asWord = (s) => new RegExp(`(^|\\s)${esc(s)}(\\s|$)`);

const field = (page, name) => page.getByRole('textbox', { name, exact: true });

// "displays the reason beside the corresponding field": the message must share a local container with the
// field (form/field group), not sit in a page-level region such as a global status bar next to the banner.
async function expectBesideField(page, message, control) {
  await expect(message).toBeVisible();
  const input = await control.elementHandle();
  const pageLevel = await message.evaluate((msg, inp) => {
    let shared = msg;
    while (shared && !shared.contains(inp)) shared = shared.parentElement;
    return !shared || !!shared.querySelector('header, [role="banner"]');
  }, input);
  expect(pageLevel, `"${(await message.textContent()).trim()}" is not shown beside its field`).toBe(false);
}

async function openSignIn(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
}

async function registerAccount(page) {
  const username = `pw-user-${uid()}`;
  const email = `${username}@example.test`;
  await openSignIn(page);
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await field(page, 'Username').fill(username);
  await field(page, 'Email').fill(email);
  await field(page, 'Password').fill(PASSWORD);
  await field(page, 'Confirm password').fill(PASSWORD);
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(field(page, 'Username or email')).toBeVisible();
  return { username, email };
}

async function submitSignIn(page, login, password) {
  await field(page, 'Username or email').fill(login);
  await field(page, 'Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function expectSignedIn(page, username) {
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
  await expect(page.getByText(asWord(username)).filter({ visible: true })).not.toHaveCount(0);
}

async function expectSignInRejected(page) {
  await expect(page.getByText('Invalid credentials')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);
}

async function openForgotPassword(page) {
  await openSignIn(page);
  await page.getByRole('link', { name: 'Forgot password', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Send reset link', exact: true })).toBeVisible();
}

// submit an email and expect the same next step: fixed code shown as its own text plus the reset form
async function requestReset(page, email) {
  await field(page, 'Email').fill(email);
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
  await expect(page.getByText('123456', { exact: true })).toBeVisible();
  for (const name of ['Verification code', 'New password', 'Confirm password']) {
    await expect(field(page, name)).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Reset password', exact: true })).toBeVisible();
}

async function submitReset(page, code, password, confirm) {
  await field(page, 'Verification code').fill(code);
  await field(page, 'New password').fill(password);
  await field(page, 'Confirm password').fill(confirm);
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();
}

test('REQ-1-1-3: Recover Account Access Through a Verified Email - Scenario 1', async ({ page }) => {
  // registered email (a newly registered account): code shown directly, correct code updates the password
  const acct = await registerAccount(page);
  await openForgotPassword(page);
  await requestReset(page, acct.email);
  await submitReset(page, '123456', REPLACEMENT, REPLACEMENT);
  await expect(page.getByText('Password updated')).toBeVisible();

  // unknown email reaches the very same step, but the same submission updates nothing
  await openForgotPassword(page);
  await requestReset(page, `nobody-${uid()}@example.test`);
  await submitReset(page, '123456', REPLACEMENT, REPLACEMENT);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('button', { name: 'Reset password', exact: true })).toBeVisible();
  await expect(page.getByText('Password updated')).toHaveCount(0);
});

test('REQ-1-1-3: Recover Account Access Through a Verified Email - Scenario 2', async ({ page }) => {
  const acct = await registerAccount(page);
  await openForgotPassword(page);
  await requestReset(page, acct.email);
  await submitReset(page, '000000', REPLACEMENT, REPLACEMENT);
  await expectBesideField(page, page.getByText('Verification code is invalid'), field(page, 'Verification code'));
  await expect(page.getByText('Password updated')).toHaveCount(0);

  // candidate password does not work, old password still does
  await openSignIn(page);
  await submitSignIn(page, acct.email, REPLACEMENT);
  await expectSignInRejected(page);
  await openSignIn(page);
  await submitSignIn(page, acct.email, PASSWORD);
  await expectSignedIn(page, acct.username);
});

test('REQ-1-1-3: Recover Account Access Through a Verified Email - Scenario 3', async ({ page }) => {
  const acct = await registerAccount(page);
  await openForgotPassword(page);
  await requestReset(page, acct.email);
  await submitReset(page, '123456', REPLACEMENT, REPLACEMENT);
  await expect(page.getByText('Password updated')).toBeVisible();

  // old password is rejected, the new one signs in
  await openSignIn(page);
  await submitSignIn(page, acct.email, PASSWORD);
  await expectSignInRejected(page);
  await openSignIn(page);
  await submitSignIn(page, acct.email, REPLACEMENT);
  await expectSignedIn(page, acct.username);
});
