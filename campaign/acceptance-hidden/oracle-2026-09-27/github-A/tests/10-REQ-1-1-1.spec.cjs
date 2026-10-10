// REQ-1-1-1 Register a New GitHub Account (orders 1-3).
// The three hidden intents are only partly known ("不合规字段、未同意条款或确认密码不一致时不创建账户" is one of them);
// the description spells out three concrete checks: a successful registration, a duplicate username,
// and a multi-field invalid submission. Assumed order: S1 success, S2 duplicate username, S3 invalid fields.
const { test, expect } = require('@playwright/test');

const SEED_USER = 'alice-dev';
const PASSWORD = 'Valid-password-123!';
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// the username shown as a whole word (not as part of "owner/repo")
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

async function openRegistration(page) {
  await openSignIn(page);
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeVisible();
}

async function fillRegistration(page, v) {
  await field(page, 'Username').fill(v.username);
  await field(page, 'Email').fill(v.email);
  await field(page, 'Password').fill(v.password);
  await field(page, 'Confirm password').fill(v.confirm);
  if (v.agree) await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
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

test('REQ-1-1-1: Register a New GitHub Account - Scenario 1', async ({ page }) => {
  const username = `pw-user-${uid()}`;
  const email = `${username}@example.test`;
  await openRegistration(page);
  for (const name of ['Username', 'Email', 'Password', 'Confirm password']) {
    await expect(field(page, name)).toBeVisible();
  }
  const terms = page.getByRole('checkbox', { name: 'Agree to the terms', exact: true });
  await expect(terms).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeEnabled();

  await fillRegistration(page, { username, email, password: PASSWORD, confirm: PASSWORD, agree: true });
  await page.getByRole('button', { name: 'Create account', exact: true }).click();

  // lands on the sign-in form, password never echoed
  await expect(field(page, 'Username or email')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByText(PASSWORD)).toHaveCount(0);

  // the new email signs in immediately; the username stays visible after reload
  await submitSignIn(page, email, PASSWORD);
  await expectSignedIn(page, username);
  await page.reload();
  await expectSignedIn(page, username);
});

test('REQ-1-1-1: Register a New GitHub Account - Scenario 2', async ({ page }) => {
  // duplicate username with a different unused email
  const email = `dup-${uid()}@example.test`;
  await openRegistration(page);
  await fillRegistration(page, { username: SEED_USER, email, password: PASSWORD, confirm: PASSWORD, agree: true });
  await page.getByRole('button', { name: 'Create account', exact: true }).click();

  await expectBesideField(page, page.getByText('Username already exists'), field(page, 'Username'));
  await expect(field(page, 'Username')).toHaveValue(SEED_USER);
  await expect(field(page, 'Email')).toHaveValue(email);
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeVisible();

  // no account was created for the attempted email
  await openSignIn(page);
  await submitSignIn(page, email, PASSWORD);
  await expectSignInRejected(page);
});

test('REQ-1-1-1: Register a New GitHub Account - Scenario 3', async ({ page }) => {
  // invalid username, invalid email, short password, mismatched confirmation, terms not accepted
  const badUser = `-bad-user-${uid()}`;
  await openRegistration(page);
  await fillRegistration(page, { username: badUser, email: 'not-an-email', password: 'short', confirm: 'different', agree: false });
  await page.getByRole('button', { name: 'Create account', exact: true }).click();

  // all four reasons together, each beside its own field
  const reasons = [
    ['Username format is invalid', field(page, 'Username')],
    ['Email format is invalid', field(page, 'Email')],
    ['Password requirements are not satisfied', field(page, 'Password')],
    ['Agree to terms is required', page.getByRole('checkbox', { name: 'Agree to the terms', exact: true })],
  ];
  for (const [msg, control] of reasons) {
    await expectBesideField(page, page.getByText(msg), control);
  }
  await expect(field(page, 'Username')).toHaveValue(badUser);
  await expect(field(page, 'Email')).toHaveValue('not-an-email');
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeVisible();

  // no account exists for the rejected input
  await openSignIn(page);
  await submitSignIn(page, badUser, 'short');
  await expectSignInRejected(page);
});
