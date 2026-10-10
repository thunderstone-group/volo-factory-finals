const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const SEED_USER = 'alice-dev';
const SEED_PASSWORD = 'Valid-password-123!';
const ORG = /acme/i; // seeded organization "Acme Demo"

// ---------------------------------------------------------------- helpers

async function openSignIn(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
}

async function submitSignIn(page, username, password) {
  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function signIn(page, username = SEED_USER, password = SEED_PASSWORD) {
  await openSignIn(page);
  await submitSignIn(page, username, password);
}

async function signOut(page) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm sign out', exact: true }).click();
}

async function registerAccount(page, username, email, password = SEED_PASSWORD) {
  await openSignIn(page);
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
}

async function openYourOrganizations(page) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Your organizations', exact: true }).click();
}

async function openOrganization(page) {
  await openYourOrganizations(page);
  await page.getByRole('link', { name: ORG }).first().click();
}

async function openPeople(page) {
  await openOrganization(page);
  await page.getByRole('link', { name: 'People', exact: true }).click();
}

async function openTeams(page) {
  await openOrganization(page);
  await page.getByRole('link', { name: 'Teams', exact: true }).click();
}

async function createTeam(page, name) {
  await openTeams(page);
  await page.getByRole('link', { name: 'New team', exact: true }).click();
  await page.getByLabel('Team name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Create team', exact: true }).click();
}

async function addOrgMemberViaForm(page, identifier) {
  await page.getByRole('button', { name: 'Add member', exact: true }).first().click();
  await page.getByLabel('Username or email', { exact: true }).fill(identifier);
  await page.getByRole('button', { name: 'Add member', exact: true }).last().click();
}

async function createPrivateOrganizationRepository(page, name) {
  await page.goto('/');
  await page.getByRole('link', { name: 'New repository', exact: true }).click();
  const owner = page.getByLabel('Owner', { exact: true });
  try {
    await owner.selectOption({ label: 'Acme Demo' });
  } catch (e) {
    await owner.click();
    await page.getByRole('option', { name: 'Acme Demo', exact: true }).click();
  }
  await page.getByLabel('Repository name', { exact: true }).fill(name);
  await page.getByRole('radio', { name: 'Private', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Add a README file', exact: true }).check();
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();
}

async function openManageAccess(page) {
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Manage access', exact: true }).click();
}

async function grantTeamWrite(page, teamName) {
  await page.getByRole('button', { name: 'Add people or teams', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search', exact: true }).fill(teamName);
  await page.getByRole('option', { name: new RegExp(teamName) }).first().click();
  await page.getByRole('combobox', { name: 'Role', exact: true }).click();
  await page.getByRole('option', { name: 'Write', exact: true }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
}

// ---------------------------------------------------------------- REQ-2-1-1

test('REQ-2-1-1: REQ-2-1-1: Browse Organization Repositories - Scenario 1', async ({ page }) => {
  await signIn(page);
  await openOrganization(page);
  await page.getByRole('link', { name: 'Repositories', exact: true }).click();

  await page.getByLabel('Find a repository', { exact: true }).fill('acme-docs');
  const repoLink = page.getByRole('link', { name: 'acme-docs', exact: true });
  await expect(repoLink).toBeVisible();

  await repoLink.click();
  await expect(page.getByRole('heading', { name: /acme-docs/ }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: /acme-docs/ }).first()).toBeVisible();
});

test('REQ-2-1-1#2: REQ-2-1-1: Browse Organization Repositories - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openOrganization(page);
  await expect(page.getByRole('link', { name: 'Repositories', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Repositories', exact: true }).click();
  await expect(page.getByLabel('Find a repository', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'acme-docs', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Find a repository', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'acme-docs', exact: true })).toBeVisible();
});

// ---------------------------------------------------------------- REQ-2-1-2

test('REQ-2-1-2: REQ-2-1-2: Create an Organization After Authentication - Scenario 1', async ({ page }) => {
  const id = 'mobile-guild-' + u();

  await signIn(page);
  await openYourOrganizations(page);
  await page.getByRole('link', { name: 'New organization', exact: true }).click();
  await page.getByLabel('Organization name', { exact: true }).fill(id);
  await page.getByLabel('Display name', { exact: true }).fill('Mobile Guild');
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();

  await expect(page.getByRole('heading', { name: new RegExp(id) }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: new RegExp(id) }).first()).toBeVisible();

  await openYourOrganizations(page);
  await expect(
    page.getByRole('link', { name: new RegExp(id) })
      .or(page.getByRole('link', { name: 'Mobile Guild', exact: true }))
      .first()
  ).toBeVisible();

  // duplicate identifier, display name missing
  await page.getByRole('link', { name: 'New organization', exact: true }).click();
  await page.getByLabel('Organization name', { exact: true }).fill(id);
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();
  await expect(page.getByText('Organization name already exists', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create organization', exact: true })).toBeVisible();

  // malformed identifier
  await page.getByLabel('Organization name', { exact: true }).fill('-invalid-organization');
  await page.getByLabel('Display name', { exact: true }).fill('Invalid Organization');
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();
  await expect(page.getByText('Organization name format is invalid', { exact: true })).toBeVisible();

  // whitespace-only display name
  await page.getByLabel('Organization name', { exact: true }).fill('mobile-guild-' + u());
  await page.getByLabel('Display name', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();
  await expect(page.getByText('Display name is required', { exact: true })).toBeVisible();
});

test('REQ-2-1-2#2: REQ-2-1-2: Create an Organization After Authentication - Scenario 2', async ({ page }) => {
  const id = 'pw-org-' + u();

  await signIn(page);
  await openYourOrganizations(page);
  await page.getByRole('link', { name: 'New organization', exact: true }).click();
  await page.getByLabel('Organization name', { exact: true }).fill(id);
  await page.getByLabel('Display name', { exact: true }).fill('Playwright Org');
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();

  await expect(page.getByRole('heading', { name: new RegExp(id) }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: new RegExp(id) }).first()).toBeVisible();
});

test('REQ-2-1-2#3: REQ-2-1-2: Create an Organization After Authentication - Scenario 3', async ({ page }) => {
  const id = 'pw-org-' + u();

  await signIn(page);
  await openYourOrganizations(page);
  await page.getByRole('link', { name: 'New organization', exact: true }).click();
  await page.getByLabel('Organization name', { exact: true }).fill(id);
  await page.getByLabel('Display name', { exact: true }).fill('Playwright Org Three');
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();

  await expect(page.getByRole('heading', { name: new RegExp(id) }).first()).toBeVisible();

  await openYourOrganizations(page);
  const listed = page.getByRole('link', { name: new RegExp(id) })
    .or(page.getByRole('link', { name: 'Playwright Org Three', exact: true }))
    .first();
  await expect(listed).toBeVisible();

  await page.reload();
  await expect(listed).toBeVisible();
});

// ---------------------------------------------------------------- REQ-2-2-1

test('REQ-2-2-1: REQ-2-2-1: Create an Organization Team - Scenario 1', async ({ page }) => {
  const team = 'mobile-team-' + u();

  await signIn(page);
  await openTeams(page);
  await page.getByRole('link', { name: 'New team', exact: true }).click();
  await page.getByLabel('Team name', { exact: true }).fill(team);
  await page.getByRole('button', { name: 'Create team', exact: true }).click();

  await expect(page.getByRole('heading', { name: new RegExp(team) }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: new RegExp(team) }).first()).toBeVisible();

  await openTeams(page);
  await expect(page.getByRole('link', { name: team, exact: true })).toBeVisible();
});

test('REQ-2-2-1#2: REQ-2-2-1: Create an Organization Team - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openTeams(page);
  await expect(page.getByRole('link', { name: 'New team', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'New team', exact: true }).click();
  await expect(page.getByLabel('Team name', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create team', exact: true })).toBeVisible();
});

// ---------------------------------------------------------------- REQ-2-2-2

test('REQ-2-2-2: REQ-2-2-2: Manage Organization Team Members and Hierarchy - Scenario 1', async ({ page }) => {
  const team = 'pw-team-' + u();

  await signIn(page);
  await createTeam(page, team);

  // add the organization member to the team
  await page.getByRole('link', { name: 'Members', exact: true }).click();
  await page.getByRole('button', { name: 'Add member', exact: true }).first().click();
  await page.getByLabel('Username', { exact: true }).fill('bob-reviewer');
  await page.getByRole('button', { name: 'Add member', exact: true }).last().click();
  await expect(page.getByRole('button', { name: 'Remove bob-reviewer', exact: true })).toBeVisible();

  // select a candidate parent team and save
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Parent team', { exact: true }).selectOption({ label: 'frontend-team' });
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  // remove the just added member
  await page.getByRole('link', { name: 'Members', exact: true }).click();
  await page.getByRole('button', { name: 'Remove bob-reviewer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove bob-reviewer', exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Remove bob-reviewer', exact: true })).toHaveCount(0);

  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('option', { name: 'frontend-team', selected: true })).toHaveCount(1);
});

test('REQ-2-2-2#2: REQ-2-2-2: Manage Organization Team Members and Hierarchy - Scenario 2', async ({ page }) => {
  const parentName = 'pw-parent-' + u();
  const childName = 'pw-child-' + u();

  await signIn(page);

  // team A with a parent team
  await createTeam(page, parentName);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Parent team', { exact: true }).selectOption({ label: 'frontend-team' });
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  // descendant team B of team A
  await createTeam(page, childName);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Parent team', { exact: true }).selectOption({ label: parentName });
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  // attempt a cyclic parent on team A
  await openTeams(page);
  await page.getByRole('link', { name: parentName, exact: true }).click();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Parent team', { exact: true }).selectOption({ label: childName });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Cyclic team hierarchy is not allowed', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('option', { name: 'frontend-team', selected: true })).toHaveCount(1);
});

// ---------------------------------------------------------------- REQ-2-2-3

test('REQ-2-2-3: REQ-2-2-3: Directly Add a User as an Organization Member - Scenario 1', async ({ page }) => {
  const uname = 'pw-member-' + u();
  const email = uname + '@example.test';

  await registerAccount(page, uname, email);
  await submitSignIn(page, SEED_USER, SEED_PASSWORD);

  await openPeople(page);
  await page.getByRole('button', { name: 'Add member', exact: true }).first().click();
  await page.getByLabel('Username or email', { exact: true }).fill(uname);
  await page.getByRole('combobox', { name: 'Role', exact: true }).click();
  await page.getByRole('option', { name: 'Member', exact: true }).click();
  await page.getByRole('button', { name: 'Add member', exact: true }).last().click();

  await expect(page.getByText(uname, { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Pending', { exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByText(uname, { exact: true }).first()).toBeVisible();

  // existing member
  await addOrgMemberViaForm(page, 'bob-reviewer');
  await expect(page.getByText('Account is already a member', { exact: true })).toBeVisible();

  // unknown account
  await page.getByLabel('Username or email', { exact: true }).fill('unknown-reviewer');
  await page.getByRole('button', { name: 'Add member', exact: true }).last().click();
  await expect(page.getByText('Account not found', { exact: true })).toBeVisible();

  // the new account can sign in and sees the organization
  await signOut(page);
  await signIn(page, uname, SEED_PASSWORD);
  await openYourOrganizations(page);
  await expect(page.getByRole('link', { name: ORG }).first()).toBeVisible();
});

test('REQ-2-2-3#2: REQ-2-2-3: Directly Add a User as an Organization Member - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openPeople(page);
  await expect(page.getByRole('button', { name: 'Add member', exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Add member', exact: true }).first()).toBeVisible();
});

// ---------------------------------------------------------------- REQ-2-2-4

test('REQ-2-2-4: REQ-2-2-4: Remove a Member from an Organization - Scenario 1', async ({ page }) => {
  const uname = 'pw-remove-' + u();
  const email = uname + '@example.test';

  await registerAccount(page, uname, email);
  await submitSignIn(page, SEED_USER, SEED_PASSWORD);

  await openPeople(page);
  await addOrgMemberViaForm(page, uname);
  await expect(page.getByText(uname, { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Member menu ' + uname, exact: true }).click();
  await page.getByRole('menuitem', { name: 'Remove from organization', exact: true }).click();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();

  await expect(page.getByText(uname, { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(uname, { exact: true })).toHaveCount(0);

  // personal account still exists and can sign in
  await signOut(page);
  await signIn(page, uname, SEED_PASSWORD);
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
});

test('REQ-2-2-4#2: REQ-2-2-4: Remove a Member from an Organization - Scenario 2', async ({ page }) => {
  const uname = 'pw-viewer-' + u();
  const email = uname + '@example.test';

  await registerAccount(page, uname, email);
  await submitSignIn(page, SEED_USER, SEED_PASSWORD);

  await openPeople(page);
  await addOrgMemberViaForm(page, uname);
  await expect(page.getByText(uname, { exact: true }).first()).toBeVisible();

  // the plain member signs in
  await signOut(page);
  await signIn(page, uname, SEED_PASSWORD);
  await openPeople(page);

  await expect(page.getByText('bob-reviewer', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /^Member menu / })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'Remove from organization', exact: true })).toHaveCount(0);
});

// ---------------------------------------------------------------- REQ-2-3

test('REQ-2-3: REQ-2-3: Grant Repository Access to People and Teams - Scenario 1', async ({ page }) => {
  const repoName = 'pw-private-' + u();

  await signIn(page);
  await createPrivateOrganizationRepository(page, repoName);
  await openManageAccess(page);

  await grantTeamWrite(page, 'frontend-team');

  const row = page.getByRole('row', { name: /frontend-team/ });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Write');

  await page.reload();
  await expect(page.getByRole('row', { name: /frontend-team/ })).toHaveCount(1);
  await expect(page.getByRole('row', { name: /frontend-team/ })).toContainText('Write');
});

test('REQ-2-3#2: REQ-2-3: Grant Repository Access to People and Teams - Scenario 2', async ({ page }) => {
  const repoName = 'pw-private-' + u();

  await signIn(page);
  await createPrivateOrganizationRepository(page, repoName);
  await openManageAccess(page);

  await grantTeamWrite(page, 'frontend-team');
  await expect(page.getByRole('row', { name: /frontend-team/ })).toHaveCount(1);

  const row = page.getByRole('row', { name: /frontend-team/ });
  await row.getByLabel('Role', { exact: true }).selectOption({ label: 'Read' });
  await row.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByRole('row', { name: /frontend-team/ })).toHaveCount(1);
  await expect(page.getByRole('row', { name: /frontend-team/ })).toContainText('Read');

  await page.reload();
  await expect(page.getByRole('row', { name: /frontend-team/ })).toHaveCount(1);
  await expect(page.getByRole('row', { name: /frontend-team/ })).toContainText('Read');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

