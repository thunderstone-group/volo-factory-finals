const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function signIn(page, username = 'alice-dev', password = 'Valid-password-123!') {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
}

async function signOut(page) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Sign out', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirm sign out', exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

async function openOrganizations(page) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Your organizations', exact: true }).click();
}

async function openOrganization(page, name) {
  await page.getByRole('link', { name, exact: true }).click();
}

async function openNewOrganizationPage(page) {
  await openOrganizations(page);
  await page.getByRole('link', { name: 'New organization', exact: true }).click();
}

async function openPublicOrganizationAsVisitor(page) {
  await signIn(page);
  await openOrganizations(page);
  await openOrganization(page, 'Acme Demo');
  const orgUrl = page.url();
  await signOut(page);
  await page.goto(orgUrl);
  await expect(page.getByRole('heading', { name: 'Acme Demo', exact: true })).toBeVisible();
}

async function createTeam(page, teamName) {
  await signIn(page);
  await openOrganizations(page);
  await openOrganization(page, 'Acme Demo');
  await page.getByRole('link', { name: 'Teams', exact: true }).click();
  await page.getByRole('link', { name: 'New team', exact: true }).click();
  await page.getByLabel('Team name', { exact: true }).fill(teamName);
  await page.getByRole('button', { name: 'Create team', exact: true }).click();
}

test('REQ-2-1-1: Browse Organization Repositories - Scenario 1', async ({ page }) => {
  await openPublicOrganizationAsVisitor(page);

  await page.getByRole('link', { name: 'Repositories', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find a repository', exact: true }).fill('acme-docs');
  await page.getByText('Public', { exact: true }).first().click();
  await expect(page.getByRole('link', { name: 'acme-docs', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'acme-docs', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Acme Demo/acme-docs', exact: true })).toBeVisible();

  await page.goBack();
  await expect(page.getByRole('link', { name: 'acme-docs', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'acme-docs', exact: true })).toBeVisible();
});

test('REQ-2-1-1#2: REQ-2-1-1: Browse Organization Repositories - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openOrganizations(page);
  await openOrganization(page, 'Acme Demo');

  await page.getByRole('link', { name: 'Repositories', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find a repository', exact: true }).fill('acme-docs');
  await page.getByText('Public', { exact: true }).first().click();
  await expect(page.getByRole('link', { name: 'acme-docs', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'acme-docs', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Acme Demo/acme-docs', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Acme Demo/acme-docs', exact: true })).toBeVisible();
});

test('REQ-2-1-2: Create an Organization After Authentication - Scenario 1', async ({ page }) => {
  await signIn(page);
  await openNewOrganizationPage(page);
  await page.getByLabel('Organization name', { exact: true }).fill('mobile-guild');
  await page.getByLabel('Display name', { exact: true }).fill('Mobile Guild');
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();

  await expect(page.getByRole('heading', { name: /mobile-guild/ }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: /mobile-guild/ }).first()).toBeVisible();

  await page.getByRole('link', { name: 'People', exact: true }).click();
  await expect(page.getByText('alice-dev', { exact: true })).toBeVisible();
  await expect(page.getByText('Owner', { exact: true })).toBeVisible();

  await openOrganizations(page);
  await expect(page.getByRole('link', { name: 'mobile-guild', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'New organization', exact: true }).click();
  await page.getByLabel('Organization name', { exact: true }).fill('mobile-guild');
  await page.getByLabel('Display name', { exact: true }).fill('Duplicate');
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();
  await expect(page.getByText('Organization name already exists', { exact: true })).toBeVisible();
});

test('REQ-2-1-2#2: REQ-2-1-2: Create an Organization After Authentication - Scenario 2', async ({ page }) => {
  const orgName = 'pw-org-' + u();
  await signIn(page);
  await openNewOrganizationPage(page);
  await page.getByLabel('Organization name', { exact: true }).fill(orgName);
  await page.getByLabel('Display name', { exact: true }).fill('Playwright Org');
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();

  await expect(page.getByRole('heading', { name: new RegExp(orgName) }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: new RegExp(orgName) }).first()).toBeVisible();

  await openOrganizations(page);
  await expect(page.getByRole('link', { name: orgName, exact: true })).toBeVisible();
});

test('REQ-2-1-2#3: REQ-2-1-2: Create an Organization After Authentication - Scenario 3', async ({ page }) => {
  const badOrgName = '-invalid-organization';
  await signIn(page);
  await openNewOrganizationPage(page);
  await page.getByLabel('Organization name', { exact: true }).fill(badOrgName);
  await page.getByLabel('Display name', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();

  await expect(page.getByText('Organization name format is invalid', { exact: true })).toBeVisible();
  await expect(page.getByText('Display name is required', { exact: true })).toBeVisible();

  await openOrganizations(page);
  await expect(page.getByRole('link', { name: badOrgName, exact: true })).toHaveCount(0);
});

test('REQ-2-2-1: Create an Organization Team - Scenario 1', async ({ page }) => {
  await createTeam(page, 'mobile-team');

  await expect(page.getByRole('heading', { name: /mobile-team/ }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: /mobile-team/ }).first()).toBeVisible();

  await openOrganizations(page);
  await openOrganization(page, 'Acme Demo');
  await page.getByRole('link', { name: 'Teams', exact: true }).click();
  await expect(page.getByRole('link', { name: 'mobile-team', exact: true })).toBeVisible();
});

test('REQ-2-2-1#2: REQ-2-2-1: Create an Organization Team - Scenario 2', async ({ page }) => {
  const teamName = 'pw-team-' + u();
  await createTeam(page, teamName);

  await expect(page.getByRole('heading', { name: new RegExp(teamName) }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: new RegExp(teamName) }).first()).toBeVisible();
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

