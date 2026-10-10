// REQ-1-1-2 Sign In with an Existing Account (orders 4-7).
const { test, expect } = require('@playwright/test');

const SEED_USER = 'alice-dev';
const SEED_EMAIL = 'alice.dev@example.test';
const PASSWORD = 'Valid-password-123!';
const WRONG_PASSWORD = 'Wrong-password-000!';
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const asWord = (s) => new RegExp(`(^|\\s)${esc(s)}(\\s|$)`);

const field = (page, name) => page.getByRole('textbox', { name, exact: true });

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

async function expectSignedOutHome(page) {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);
}

test('REQ-1-1-2: Sign In with an Existing Account - Scenario 1', async ({ page }) => {
  await openSignIn(page);
  await submitSignIn(page, SEED_USER, PASSWORD);
  await expectSignedIn(page, SEED_USER);
  // refresh the workspace, then reopen the same address directly
  await page.reload();
  await expectSignedIn(page, SEED_USER);
  await page.goto(page.url());
  await expectSignedIn(page, SEED_USER);
});

test('REQ-1-1-2: Sign In with an Existing Account - Scenario 2', async ({ page }) => {
  await openSignIn(page);
  await submitSignIn(page, SEED_USER, WRONG_PASSWORD);
  await expect(page.getByText('Invalid credentials')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);
  // no session was created
  await page.reload();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);
  await expectSignedOutHome(page);
});

test('REQ-1-1-2: Sign In with an Existing Account - Scenario 3', async ({ page }) => {
  await openSignIn(page);
  await submitSignIn(page, SEED_EMAIL, PASSWORD);
  await expectSignedIn(page, SEED_USER);
  await page.reload();
  await expectSignedIn(page, SEED_USER);
});

test('REQ-1-1-2: Sign In with an Existing Account - Scenario 4', async ({ page }) => {
  // unknown account
  await openSignIn(page);
  await submitSignIn(page, `ghost-${uid()}`, PASSWORD);
  const unknownMsg = page.getByText('Invalid credentials');
  await expect(unknownMsg).toBeVisible();
  const unknownText = (await unknownMsg.textContent()).trim();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);

  // existing account, wrong password
  await openSignIn(page);
  await submitSignIn(page, SEED_USER, WRONG_PASSWORD);
  const wrongMsg = page.getByText('Invalid credentials');
  await expect(wrongMsg).toBeVisible();
  expect((await wrongMsg.textContent()).trim()).toBe(unknownText);
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);
  await expectSignedOutHome(page);
});
