// REQ-1-3 Change Account Password (orders 13-15).
// "Each password-change scenario starts with its own verified account": every test registers a fresh account,
// so the shared seed alice-dev keeps its password.
const { test, expect } = require('@playwright/test');

const PASSWORD = 'Valid-password-123!';
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

async function submitSignIn(page, login, password) {
  await field(page, 'Username or email').fill(login);
  await field(page, 'Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function expectSignedIn(page, username) {
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
  await expect(page.getByText(asWord(username)).filter({ visible: true })).not.toHaveCount(0);
}

// register a fresh account and sign in with it
async function registerAndSignIn(page) {
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
  await submitSignIn(page, username, PASSWORD);
  await expectSignedIn(page, username);
  return { username, email };
}

async function openPasswordSettings(page) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Password and authentication', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Update password', exact: true })).toBeVisible();
}

async function submitPasswordChange(page, current, next, confirm) {
  await field(page, 'Current password').fill(current);
  await field(page, 'New password').fill(next);
  await field(page, 'Confirm password').fill(confirm);
  await page.getByRole('button', { name: 'Update password', exact: true }).click();
}

// a new sign-in in a separate browser session
async function expectLogin(browser, login, password, username, ok) {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  try {
    await openSignIn(p);
    await submitSignIn(p, login, password);
    if (ok) {
      await expectSignedIn(p, username);
    } else {
      await expect(p.getByText('Invalid credentials')).toBeVisible();
      await expect(p.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);
    }
  } finally {
    await ctx.close();
  }
}

test('REQ-1-3: Change Account Password - Scenario 1', async ({ page, browser }) => {
  const acct = await registerAndSignIn(page);
  await openPasswordSettings(page);
  await submitPasswordChange(page, PASSWORD, 'New-password-456!', 'New-password-456!');
  await expect(page.getByText('Password updated')).toBeVisible();

  await expectLogin(browser, acct.username, PASSWORD, acct.username, false);
  await expectLogin(browser, acct.username, 'New-password-456!', acct.username, true);
});

test('REQ-1-3: Change Account Password - Scenario 2', async ({ page, browser }) => {
  const acct = await registerAndSignIn(page);
  await openPasswordSettings(page);
  // incorrect current password together with confirmation "does-not-match"
  await submitPasswordChange(page, 'Incorrect-password-321!', 'Changed-password-654!', 'does-not-match');
  // the current-password or the confirmation reason, beside its field
  const incorrect = page.getByText('Current password is incorrect');
  const mismatch = page.getByText('Password confirmation does not match');
  await expect(incorrect.or(mismatch).filter({ visible: true })).not.toHaveCount(0);
  if (await incorrect.isVisible()) await expectBesideField(page, incorrect, field(page, 'Current password'));
  if (await mismatch.isVisible()) await expectBesideField(page, mismatch, field(page, 'Confirm password'));
  await expect(page.getByText('Password updated')).toHaveCount(0);

  await expectLogin(browser, acct.username, 'Changed-password-654!', acct.username, false);
  await expectLogin(browser, acct.username, PASSWORD, acct.username, true);
});

test('REQ-1-3: Change Account Password - Scenario 3', async ({ page, browser }) => {
  const acct = await registerAndSignIn(page);
  await openPasswordSettings(page);
  await submitPasswordChange(page, '', 'Required-password-789!', 'Required-password-789!');
  await expectBesideField(page, page.getByText('Current password is required'), field(page, 'Current password'));
  await expect(page.getByText('Password updated')).toHaveCount(0);

  await expectLogin(browser, acct.username, 'Required-password-789!', acct.username, false);
  await expectLogin(browser, acct.username, PASSWORD, acct.username, true);
});
