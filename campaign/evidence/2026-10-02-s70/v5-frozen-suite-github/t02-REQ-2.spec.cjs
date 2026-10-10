const { test, expect } = require('@playwright/test');

const PASSWORD = 'Valid-password-123!';

async function signIn(page, usernameOrEmail, password, username) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(usernameOrEmail);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  if (username) {
    await expect(page.getByText(username, { exact: true }).first()).toBeVisible();
  }
}

async function signOut(page) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm sign out', exact: true }).click();
}

async function openYourOrganizations(page) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Your organizations', exact: true }).click();
}

async function openOrganization(page, orgName) {
  await openYourOrganizations(page);
  await page.getByRole('link', { name: orgName, exact: true }).first().click();
}

async function openRepository(page, repoName) {
  await page.goto('/');
  const search = page.getByRole('searchbox', { name: 'Search', exact: true });
  await search.fill(repoName);
  await search.press('Enter');
  await page.getByRole('link', { name: repoName, exact: true }).first().click();
}

async function ensureAddMemberForm(page, fieldLabel) {
  const fields = page.getByRole('textbox', { name: fieldLabel, exact: true });
  if ((await fields.count()) > 0 && (await fields.first().isVisible())) {
    return;
  }
  const openerLink = page.getByRole('link', { name: 'Add member', exact: true });
  if ((await openerLink.count()) > 0) {
    await openerLink.first().click();
    return;
  }
  await page.getByRole('button', { name: 'Add member', exact: true }).first().click();
}

test('REQ-2-1-1: REQ-2-1-1: Browse Organization Repositories - Scenario 1', async ({ page }) => {
  await page.goto('/');
  const orgLink = page.getByRole('link', { name: 'Acme Demo', exact: true });
  await expect(orgLink.first()).toBeVisible();
  await orgLink.first().click();

  const repositories = page.getByRole('link', { name: 'Repositories', exact: true });
  await expect(repositories).toBeVisible();
  await repositories.click();

  await page.getByRole('textbox', { name: 'Find a repository', exact: true }).fill('acme-docs');
  await page.getByRole('link', { name: 'acme-docs', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'acme-docs' })).toBeVisible();

  await page.goto('/');
  await page.getByRole('link', { name: 'Acme Demo', exact: true }).first().click();
  await page.getByRole('link', { name: 'Repositories', exact: true }).click();
  await expect(page.getByRole('link', { name: 'acme-docs', exact: true }).first()).toBeVisible();
});

test('REQ-2-1-1#2: REQ-2-1-1: Browse Organization Repositories - Scenario 2', async ({ page }) => {
  await page.goto('/');
  const orgLink = page.getByRole('link', { name: 'Acme Demo', exact: true });
  await expect(orgLink.first()).toBeVisible();
  await orgLink.first().click();

  const repositories = page.getByRole('link', { name: 'Repositories', exact: true });
  await expect(repositories).toBeVisible();
  await repositories.click();

  await page.getByRole('textbox', { name: 'Find a repository', exact: true }).fill('secret-research');
  await expect(page.getByRole('link', { name: 'secret-research', exact: true })).toHaveCount(0);
});

test('REQ-2-1-2: REQ-2-1-2: Create an Organization After Authentication - Scenario 1', async ({ page }) => {
  await signIn(page, 'org-owner', PASSWORD, 'org-owner');
  await openYourOrganizations(page);
  await page.getByRole('link', { name: 'New organization', exact: true }).click();
  await page.getByLabel('Organization name', { exact: true }).fill('mobile-guild');
  await page.getByLabel('Display name', { exact: true }).fill('Mobile Guild');
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'mobile-guild' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'mobile-guild' })).toBeVisible();
});

test('REQ-2-1-2#2: REQ-2-1-2: Create an Organization After Authentication - Scenario 2', async ({ page }) => {
  await signIn(page, 'org-owner', PASSWORD, 'org-owner');
  await openYourOrganizations(page);
  await page.getByRole('link', { name: 'New organization', exact: true }).click();
  await page.getByLabel('Organization name', { exact: true }).fill('acme-demo');
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();

  await expect(page.getByText('Organization name already exists')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'acme-demo' })).toHaveCount(0);
});

test('REQ-2-1-2#3: REQ-2-1-2: Create an Organization After Authentication - Scenario 3', async ({ page }) => {
  await signIn(page, 'org-owner', PASSWORD, 'org-owner');
  await openYourOrganizations(page);
  await page.getByRole('link', { name: 'New organization', exact: true }).click();
  await page.getByLabel('Organization name', { exact: true }).fill('-invalid-organization');
  await page.getByLabel('Display name', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();

  await expect(page.getByText('Organization name format is invalid')).toBeVisible();
  await expect(page.getByText('Display name is required')).toBeVisible();
});

test('REQ-2-2-1: REQ-2-2-1: Create an Organization Team - Scenario 1', async ({ page }) => {
  await signIn(page, 'org-owner', PASSWORD, 'org-owner');
  await openOrganization(page, 'Acme Demo');
  await page.getByRole('link', { name: 'Teams', exact: true }).click();
  await page.getByRole('link', { name: 'New team', exact: true }).click();
  await page.getByLabel('Team name', { exact: true }).fill('mobile-team');
  await page.getByRole('button', { name: 'Create team', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'mobile-team' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'mobile-team' })).toBeVisible();
});

test('REQ-2-2-1#2: REQ-2-2-1: Create an Organization Team - Scenario 2', async ({ page }) => {
  await signIn(page, 'org-owner', PASSWORD, 'org-owner');
  await openOrganization(page, 'Acme Demo');
  await page.getByRole('link', { name: 'Teams', exact: true }).click();
  await page.getByRole('link', { name: 'New team', exact: true }).click();
  await page.getByLabel('Team name', { exact: true }).fill('-invalid-team');
  await page.getByRole('button', { name: 'Create team', exact: true }).click();

  await expect(page.getByText('Team name is invalid')).toBeVisible();
});

test('REQ-2-2-2: REQ-2-2-2: Manage Organization Team Members and Hierarchy - Scenario 1', async ({ page }) => {
  await signIn(page, 'team-maintainer', PASSWORD, 'team-maintainer');
  await openOrganization(page, 'Acme Demo');
  await page.getByRole('link', { name: 'Teams', exact: true }).click();
  await page.getByRole('link', { name: 'frontend-team', exact: true }).first().click();
  await page.getByRole('link', { name: 'Members', exact: true }).click();

  await ensureAddMemberForm(page, 'Username');
  await page.getByRole('textbox', { name: 'Username', exact: true }).fill('bob-reviewer');
  await page.getByRole('button', { name: 'Add member', exact: true }).last().click();
  await expect(page.getByText('bob-reviewer', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Remove bob-reviewer', exact: true }).click();
  await expect(page.getByText('bob-reviewer', { exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByText('bob-reviewer', { exact: true })).toHaveCount(0);
});

test('REQ-2-2-2#2: REQ-2-2-2: Manage Organization Team Members and Hierarchy - Scenario 2', async ({ page }) => {
  await signIn(page, 'team-maintainer', PASSWORD, 'team-maintainer');
  await openOrganization(page, 'Acme Demo');
  await page.getByRole('link', { name: 'Teams', exact: true }).click();
  await page.getByRole('link', { name: 'frontend-team', exact: true }).first().click();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();

  await page.getByRole('combobox', { name: 'Parent team', exact: true }).click();
  await page.getByRole('option', { name: 'frontend-child', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText('Cyclic team hierarchy is not allowed')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Parent team', exact: true })).toHaveValue('platform-team');
});

test('REQ-2-2-3: REQ-2-2-3: Directly Add a User as an Organization Member - Scenario 1', async ({ page }) => {
  await signIn(page, 'org-owner', PASSWORD, 'org-owner');
  await openOrganization(page, 'Acme Demo');
  await page.getByRole('link', { name: 'People', exact: true }).click();

  await ensureAddMemberForm(page, 'Username or email');
  await page.getByRole('textbox', { name: 'Username or email', exact: true }).fill('new-member');
  await page.getByRole('combobox', { name: 'Role', exact: true }).click();
  await page.getByRole('option', { name: 'Member', exact: true }).click();
  await page.getByRole('button', { name: 'Add member', exact: true }).last().click();

  await expect(page.getByText('new-member', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Member', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Pending invitation')).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('new-member', { exact: true }).first()).toBeVisible();

  await signOut(page);
  await signIn(page, 'new-member@example.test', PASSWORD, 'new-member');
  await openYourOrganizations(page);
  await expect(page.getByRole('link', { name: 'Acme Demo', exact: true }).first()).toBeVisible();

  await page.goto('/acme-demo/secret-research');
  await expect(page.getByText('Access denied').first()).toBeVisible();
});

test('REQ-2-2-3#2: REQ-2-2-3: Directly Add a User as an Organization Member - Scenario 2', async ({ page }) => {
  await signIn(page, 'org-owner', PASSWORD, 'org-owner');
  await openOrganization(page, 'Acme Demo');
  await page.getByRole('link', { name: 'People', exact: true }).click();

  await ensureAddMemberForm(page, 'Username or email');
  const field = page.getByRole('textbox', { name: 'Username or email', exact: true });
  await field.fill('existing-member');
  await page.getByRole('button', { name: 'Add member', exact: true }).last().click();
  await expect(page.getByText('Account is already a member')).toBeVisible();

  await field.fill('unknown-reviewer');
  await page.getByRole('button', { name: 'Add member', exact: true }).last().click();
  await expect(page.getByText('Account not found')).toBeVisible();

  await expect(page.getByText('existing-member', { exact: true })).toHaveCount(1);
});

test('REQ-2-2-4: REQ-2-2-4: Remove a Member from an Organization - Scenario 1', async ({ page }) => {
  await signIn(page, 'org-owner', PASSWORD, 'org-owner');
  await openOrganization(page, 'Acme Demo');
  await page.getByRole('link', { name: 'People', exact: true }).click();

  await expect(page.getByText('existing-member', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Member menu existing-member', exact: true }).click();
  await page.getByText('Remove from organization', { exact: true }).click();
  await page.getByRole('button', { name: 'Remove', exact: true }).first().click();

  await expect(page.getByText('existing-member', { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('existing-member', { exact: true })).toHaveCount(0);
});

test('REQ-2-2-4#2: REQ-2-2-4: Remove a Member from an Organization - Scenario 2', async ({ page }) => {
  await signIn(page, 'org-member', PASSWORD, 'org-member');
  await openOrganization(page, 'Acme Demo');
  await page.getByRole('link', { name: 'People', exact: true }).click();

  await expect(page.getByText('protected-member', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Member menu protected-member', exact: true })).toHaveCount(0);
  await expect(page.getByText('Member menu protected-member')).toHaveCount(0);
  await expect(page.getByText('Remove from organization', { exact: true })).toHaveCount(0);
});

test('REQ-2-3: REQ-2-3: Grant Repository Access to People and Teams - Scenario 1', async ({ page }) => {
  await signIn(page, 'repo-admin', PASSWORD, 'repo-admin');
  await openRepository(page, 'acme-docs');
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Manage access', exact: true }).click();

  await page.getByRole('button', { name: 'Add people or teams', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search', exact: true }).fill('frontend-team');
  await page.getByRole('option', { name: 'frontend-team', exact: true }).click();
  await page.getByRole('combobox', { name: 'Role', exact: true }).click();
  await page.getByRole('option', { name: 'Write', exact: true }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  await expect(page.getByText('frontend-team', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Write', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('frontend-team', { exact: true }).first()).toBeVisible();
});

test('REQ-2-3#2: REQ-2-3: Grant Repository Access to People and Teams - Scenario 2', async ({ page }) => {
  await signIn(page, 'repo-admin', PASSWORD, 'repo-admin');
  await openRepository(page, 'acme-docs');
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Manage access', exact: true }).click();

  const row = page.getByRole('row', { name: /access-role-team/ });
  await expect(row).toHaveCount(1);
  await expect(row.getByText('Write', { exact: true })).toBeVisible();

  await row.getByRole('combobox', { name: 'Role', exact: true }).click();
  await page.getByRole('option', { name: 'Read', exact: true }).click();
  await row.getByRole('button', { name: 'Save', exact: true }).click();

  await page.reload();
  await expect(page.getByRole('row', { name: /access-role-team/ })).toHaveCount(1);
  await expect(page.getByRole('row', { name: /access-role-team/ }).getByText('Read', { exact: true })).toBeVisible();
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

