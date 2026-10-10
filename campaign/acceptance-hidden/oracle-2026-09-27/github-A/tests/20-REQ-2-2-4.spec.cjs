// REQ-2-2-4 Remove a Member from an Organization (orders 27-28).
// Removing a seed member would break later scenarios, so each test registers its own account and has the
// Owner alice-dev add it to "Acme Demo" as a Member first (direct add per REQ-2-2-3).
const { test, expect } = require('@playwright/test');

const SEED_USER = 'alice-dev';
const PASSWORD = 'Valid-password-123!';
const ORG = 'Acme Demo';
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const asWord = (s) => new RegExp(`(^|\\s)${esc(s)}(\\s|$)`);

const field = (page, name) => page.getByRole('textbox', { name, exact: true });
// Rows of the People list may carry their own controls; the add form's Role combobox and its clickable
// options are the ones outside rows and outside native selects.
const outsideRows = (page, loc) => loc.and(page.locator(':not(tr *):not([role="row"] *)'));
const outsideSelects = (page, loc) => loc.and(page.locator(':not(select *)'));

async function submitSignIn(page, login, password) {
  await field(page, 'Username or email').fill(login);
  await field(page, 'Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function expectSignedIn(page, username) {
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
  await expect(page.getByText(asWord(username)).filter({ visible: true })).not.toHaveCount(0);
}

async function signIn(page, login, password, username) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await submitSignIn(page, login, password);
  await expectSignedIn(page, username);
}

// register a fresh account; the page is left on the sign-in form
async function registerAccount(page) {
  const username = `pw-member-${uid()}`;
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await field(page, 'Username').fill(username);
  await field(page, 'Email').fill(`${username}@example.test`);
  await field(page, 'Password').fill(PASSWORD);
  await field(page, 'Confirm password').fill(PASSWORD);
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(field(page, 'Username or email')).toBeVisible();
  return username;
}

async function openPeople(page) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Your organizations', exact: true }).click();
  await page.getByRole('link', { name: ORG }).click();
  await page.getByRole('link', { name: 'People', exact: true }).click();
  await expect(page.getByText('bob-reviewer', { exact: true })).toBeVisible();
}

// Owner adds a registered account as Member (REQ-2-2-3 flow)
async function addMember(page, username) {
  await page.getByRole('button', { name: 'Add member', exact: true }).click();
  await field(page, 'Username or email').fill(username);
  await outsideRows(page, page.getByRole('combobox', { name: 'Role', exact: true })).click();
  await outsideSelects(page, page.getByRole('option', { name: 'Member', exact: true })).click();
  await page.getByRole('button', { name: 'Add member', exact: true }).last().click();
  await expect(page.getByText(username, { exact: true })).toBeVisible();
}

test('REQ-2-2-4: Remove a Member from an Organization - Scenario 1', async ({ page, browser }) => {
  const ctx = await browser.newContext();
  const username = await registerAccount(await ctx.newPage());
  await ctx.close();

  await signIn(page, SEED_USER, PASSWORD, SEED_USER);
  await openPeople(page);
  await addMember(page, username);

  await page.getByRole('button', { name: `Member menu ${username}`, exact: true }).click();
  await page.getByRole('menuitem', { name: 'Remove from organization', exact: true }).click();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();

  await expect(page.getByText(username, { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('bob-reviewer', { exact: true })).toBeVisible();
  await expect(page.getByText(username, { exact: true })).toHaveCount(0);
});

test('REQ-2-2-4: Remove a Member from an Organization - Scenario 2', async ({ page, browser }) => {
  const ctx = await browser.newContext();
  const memberPage = await ctx.newPage();
  const username = await registerAccount(memberPage);

  // Owner makes the new account an ordinary Member
  await signIn(page, SEED_USER, PASSWORD, SEED_USER);
  await openPeople(page);
  await addMember(page, username);

  // the ordinary Member opens People: no member menu, no removal action
  await submitSignIn(memberPage, username, PASSWORD);
  await expectSignedIn(memberPage, username);
  await openPeople(memberPage);
  await expect(memberPage.getByRole('button', { name: 'Member menu bob-reviewer', exact: true })).toHaveCount(0);
  await expect(memberPage.getByRole('menuitem', { name: 'Remove from organization', exact: true })).toHaveCount(0);

  // bob-reviewer still belongs to the organization after reload
  await memberPage.reload();
  await expect(memberPage.getByText('bob-reviewer', { exact: true })).toBeVisible();
  await ctx.close();
});
