// REQ-2-1-2 Create an Organization After Authentication (orders 18-20).
// Organization identifiers carry a unique suffix so a never-reset instance can run the suite repeatedly.
const { test, expect } = require('@playwright/test');

const SEED_USER = 'alice-dev';
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

async function openNewOrganizationForm(page) {
  await openYourOrganizations(page);
  await page.getByRole('link', { name: 'New organization', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Create organization', exact: true })).toBeVisible();
}

async function submitOrganization(page, id, displayName) {
  await field(page, 'Organization name').fill(id);
  await field(page, 'Display name').fill(displayName);
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();
}

test('REQ-2-1-2: Create an Organization After Authentication - Scenario 1', async ({ page }) => {
  const orgId = `mobile-guild-${uid()}`;
  await signIn(page, SEED_USER, PASSWORD, SEED_USER);
  await openNewOrganizationForm(page);
  await submitOrganization(page, orgId, 'Mobile Guild');

  // new overview titled with the identifier, still there after reload
  await expect(page.getByRole('heading', { name: orgId })).toBeVisible();
  const overviewUrl = page.url();
  await page.reload();
  await expect(page.getByRole('heading', { name: orgId })).toBeVisible();

  // listed under "Your organizations" (by identifier or display name); its overview can be reopened
  await openYourOrganizations(page);
  await expect(page.getByText(orgId).or(page.getByText('Mobile Guild')).filter({ visible: true })).not.toHaveCount(0);
  await page.goto(overviewUrl);
  await expect(page.getByRole('heading', { name: orgId })).toBeVisible();
});

test('REQ-2-1-2: Create an Organization After Authentication - Scenario 2', async ({ page }) => {
  const suffix = uid();
  const orgId = `dup-org-${suffix}`;
  const displayName = `Duplicate Org ${suffix}`;
  await signIn(page, SEED_USER, PASSWORD, SEED_USER);
  // precondition: an existing organization with this identifier
  await openNewOrganizationForm(page);
  await submitOrganization(page, orgId, displayName);
  await expect(page.getByRole('button', { name: 'Create organization', exact: true })).toHaveCount(0);

  // same identifier again, display name left empty
  await openNewOrganizationForm(page);
  await submitOrganization(page, orgId, '');
  await expectBesideField(page, page.getByText('Organization name already exists'), field(page, 'Organization name'));
  await expect(page.getByRole('button', { name: 'Create organization', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: orgId })).toHaveCount(0);

  // the organization is listed once, not twice (by identifier and by display name)
  await openYourOrganizations(page);
  await expect(page.getByText(orgId).or(page.getByText(displayName)).filter({ visible: true })).not.toHaveCount(0);
  expect(await page.getByText(orgId).count()).toBeLessThanOrEqual(1);
  expect(await page.getByText(displayName).count()).toBeLessThanOrEqual(1);
});

test('REQ-2-1-2: Create an Organization After Authentication - Scenario 3', async ({ page }) => {
  const validId = `valid-org-${uid()}`;
  await signIn(page, SEED_USER, PASSWORD, SEED_USER);
  await openNewOrganizationForm(page);

  await submitOrganization(page, '-invalid-organization', 'Invalid Organization');
  await expectBesideField(page, page.getByText('Organization name format is invalid'), field(page, 'Organization name'));
  await expect(page.getByRole('button', { name: 'Create organization', exact: true })).toBeVisible();

  await submitOrganization(page, validId, '   ');
  await expectBesideField(page, page.getByText('Display name is required'), field(page, 'Display name'));
  await expect(page.getByRole('button', { name: 'Create organization', exact: true })).toBeVisible();

  // neither attempt created an organization (the seed organization marks that the list has loaded)
  await openYourOrganizations(page);
  await expect(page.getByText('Acme Demo').filter({ visible: true })).not.toHaveCount(0);
  await expect(page.getByText(validId)).toHaveCount(0);
  await expect(page.getByText('-invalid-organization')).toHaveCount(0);
});
