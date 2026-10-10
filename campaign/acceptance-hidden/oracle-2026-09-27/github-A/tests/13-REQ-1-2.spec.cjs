// REQ-1-2 Sign Out and End the Current Web Session (orders 11-12).
// Protected page used: "Your organizations", opened from the account menu (its "New organization" link marks
// that the protected content is shown).
const { test, expect } = require('@playwright/test');

const SEED_USER = 'alice-dev';
const PASSWORD = 'Valid-password-123!';
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const asWord = (s) => new RegExp(`(^|\\s)${esc(s)}(\\s|$)`);

const field = (page, name) => page.getByRole('textbox', { name, exact: true });

async function signIn(page, login, password, username) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await field(page, 'Username or email').fill(login);
  await field(page, 'Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
  await expect(page.getByText(asWord(username)).filter({ visible: true })).not.toHaveCount(0);
}

async function openYourOrganizations(page) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Your organizations', exact: true }).click();
  await expect(page.getByRole('link', { name: 'New organization', exact: true })).toBeVisible();
}

async function signOut(page) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Sign out', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirm sign out', exact: true }).click();
}

async function expectSignedOut(page) {
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'New organization', exact: true })).toHaveCount(0);
}

test('REQ-1-2: Sign Out and End the Current Web Session - Scenario 1', async ({ page }) => {
  await signIn(page, SEED_USER, PASSWORD, SEED_USER);
  await openYourOrganizations(page);
  await signOut(page);
  await expectSignedOut(page);
  // browser back and refresh cannot restore the session
  await page.goBack();
  await expectSignedOut(page);
  await page.reload();
  await expectSignedOut(page);
});

test('REQ-1-2: Sign Out and End the Current Web Session - Scenario 2', async ({ page }) => {
  await signIn(page, SEED_USER, PASSWORD, SEED_USER);
  await openYourOrganizations(page);
  const protectedUrl = page.url();
  await signOut(page);
  await expectSignedOut(page);
  // directly reopening the recorded protected address still requires authentication
  await page.goto(protectedUrl);
  await expectSignedOut(page);
});
