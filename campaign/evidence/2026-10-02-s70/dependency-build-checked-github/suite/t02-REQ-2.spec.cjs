const { test, expect } = require('@playwright/test');

const ALICE = 'alice-dev';
const PASSWORD = 'Valid-password-123!';
const ORG = 'Acme Demo';
const TEAM = 'frontend-team';

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function signIn(page, username = ALICE, password = PASSWORD) {
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
  await page.getByRole('button', { name: 'Confirm sign out', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
}

async function createAccount(page, username, email, password = PASSWORD) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByLabel('Username or email', { exact: true })).toBeVisible();
}

async function openYourOrganizations(page) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Your organizations', exact: true }).click();
}

async function openOrganization(page, name = ORG) {
  await openYourOrganizations(page);
  await page.getByRole('link', { name, exact: true }).click();
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
  await expect(page.getByRole('heading', { name: new RegExp(name) })).toBeVisible();
}

async function openTeam(page, name) {
  await openTeams(page);
  await page.getByRole('link', { name, exact: true }).click();
}

async function setParentTeam(page, team, parentName) {
  await openTeam(page, team);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Parent team', { exact: true }).selectOption({ label: parentName });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
}

async function addMemberFromPeople(page, username) {
  await page.getByRole('button', { name: 'Add member', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await page.getByRole('button', { name: 'Add member', exact: true }).click();
}

async function createOrgRepository(page, name) {
  await page.getByRole('link', { name: 'New repository', exact: true }).click();
  await page.getByLabel('Owner', { exact: true }).click();
  await page.getByRole('option', { name: ORG, exact: true }).click();
  await page.getByLabel('Repository name', { exact: true }).fill(name);
  await page.getByRole('radio', { name: 'Private', exact: true }).check();
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();
  await expect(page.getByRole('heading', { name: new RegExp(name) })).toBeVisible();
}

async function grantTeamWrite(page) {
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Manage access', exact: true }).click();
  await page.getByRole('button', { name: 'Add people or teams', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search', exact: true }).fill(TEAM);
  await page.getByRole('option', { name: new RegExp(TEAM) }).click();
  await page.getByRole('combobox', { name: 'Role', exact: true }).click();
  await page.getByRole('option', { name: 'Write', exact: true }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
}

test('REQ-2-1-1: REQ-2-1-1: Browse Organization Repositories - Scenario 1', async ({ page }) => {
  await signIn(page);
  await openOrganization(page);
  await expect(page.getByRole('heading', { name: ORG, exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Repositories', exact: true }).click();
  await page.getByLabel('Find a repository', { exact: true }).fill('acme-docs');
  await page.getByRole('button', { name: 'Public', exact: true }).click();
  await expect(page.getByRole('link', { name: 'acme-docs', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'acme-docs', exact: true }).click();
  await expect(page.getByRole('heading', { name: /acme-docs/ })).toBeVisible();
  await expect(page.getByText('Public', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: /acme-docs/ })).toBeVisible();
});

test('REQ-2-1-1#2: REQ-2-1-1: Browse Organization Repositories - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openOrganization(page);
  await page.getByRole('link', { name: 'Repositories', exact: true }).click();
  await expect(page.getByRole('link', { name: 'acme-docs', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('link', { name: 'acme-docs', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'acme-docs', exact: true }).click();
  await expect(page.getByRole('heading', { name: /acme-docs/ })).toBeVisible();
});

test('REQ-2-1-2: REQ-2-1-2: Create an Organization After Authentication - Scenario 1', async ({ page }) => {
  const orgName = 'mobile-guild-' + uid();

  await signIn(page);
  await openYourOrganizations(page);
  await page.getByRole('link', { name: 'New organization', exact: true }).click();

  await page.getByLabel('Organization name', { exact: true }).fill('-invalid-organization');
  await page.getByLabel('Display name', { exact: true }).fill('Invalid Org');
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();
  await expect(page.getByText('Organization name format is invalid', { exact: true })).toBeVisible();

  await page.getByLabel('Organization name', { exact: true }).fill(orgName);
  await page.getByLabel('Display name', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();
  await expect(page.getByText('Display name is required', { exact: true })).toBeVisible();

  await page.getByLabel('Organization name', { exact: true }).fill(orgName);
  await page.getByLabel('Display name', { exact: true }).fill('Mobile Guild');
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();
  await expect(page.getByRole('heading', { name: orgName, exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: orgName, exact: true })).toBeVisible();

  await openYourOrganizations(page);
  await expect(page.getByRole('link', { name: orgName, exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'New organization', exact: true }).click();
  await page.getByLabel('Organization name', { exact: true }).fill(orgName);
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();
  await expect(page.getByText('Organization name already exists', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create organization', exact: true })).toBeVisible();
});

test('REQ-2-1-2#2: REQ-2-1-2: Create an Organization After Authentication - Scenario 2', async ({ page }) => {
  const orgName = 'pw-org-' + uid();

  await signIn(page);
  await openYourOrganizations(page);
  await page.getByRole('link', { name: 'New organization', exact: true }).click();
  await expect(page.getByLabel('Organization name', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Display name', { exact: true })).toBeVisible();

  await page.getByLabel('Organization name', { exact: true }).fill(orgName);
  await page.getByLabel('Display name', { exact: true }).fill('Playwright Org');
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();
  await expect(page.getByRole('heading', { name: orgName, exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: orgName, exact: true })).toBeVisible();
});

test('REQ-2-1-2#3: REQ-2-1-2: Create an Organization After Authentication - Scenario 3', async ({ page }) => {
  const orgName = 'pw-org-b-' + uid();

  await signIn(page);
  await openYourOrganizations(page);
  await page.getByRole('link', { name: 'New organization', exact: true }).click();
  await page.getByLabel('Organization name', { exact: true }).fill(orgName);
  await page.getByLabel('Display name', { exact: true }).fill('Playwright Org Two');
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();
  await expect(page.getByRole('heading', { name: orgName, exact: true })).toBeVisible();

  await openYourOrganizations(page);
  await expect(page.getByRole('link', { name: orgName, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: orgName, exact: true })).toBeVisible();
});

test('REQ-2-2-1: REQ-2-2-1: Create an Organization Team - Scenario 1', async ({ page }) => {
  const team = 'mobile-team-' + uid();

  await signIn(page);
  await openOrganization(page);
  await page.getByRole('link', { name: 'Teams', exact: true }).click();
  await page.getByRole('link', { name: 'New team', exact: true }).click();
  await page.getByLabel('Team name', { exact: true }).fill(team);
  await page.getByRole('button', { name: 'Create team', exact: true }).click();
  await expect(page.getByRole('heading', { name: new RegExp(team) })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: new RegExp(team) })).toBeVisible();

  await openTeams(page);
  await expect(page.getByRole('link', { name: team, exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'New team', exact: true }).click();
  await page.getByLabel('Team name', { exact: true }).fill('-invalid-team-');
  await page.getByRole('button', { name: 'Create team', exact: true }).click();
  await expect(page.getByText('Team name format is invalid', { exact: true })).toBeVisible();
});

test('REQ-2-2-1#2: REQ-2-2-1: Create an Organization Team - Scenario 2', async ({ page }) => {
  const team = 'pw-team-' + uid();

  await signIn(page);
  await createTeam(page, team);

  await openTeams(page);
  await expect(page.getByRole('link', { name: team, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: team, exact: true })).toBeVisible();

  await page.getByRole('link', { name: team, exact: true }).click();
  await expect(page.getByRole('heading', { name: new RegExp(team) })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Members', exact: true })).toBeVisible();
});

test('REQ-2-2-2: REQ-2-2-2: Manage Organization Team Members and Hierarchy - Scenario 1', async ({ page }) => {
  const parentTeam = 'pw-parent-' + uid();

  await signIn(page);
  await createTeam(page, parentTeam);

  await openTeam(page, TEAM);
  await page.getByRole('link', { name: 'Members', exact: true }).click();
  await page.getByRole('button', { name: 'Add member', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill('bob-reviewer');
  await page.getByRole('button', { name: 'Add member', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove bob-reviewer', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Parent team', { exact: true }).selectOption({ label: parentTeam });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.reload();
  await expect(page.getByLabel('Parent team', { exact: true })).toHaveValue(parentTeam);

  await page.getByRole('link', { name: 'Members', exact: true }).click();
  await page.getByRole('button', { name: 'Remove bob-reviewer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove bob-reviewer', exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Remove bob-reviewer', exact: true })).toHaveCount(0);
});

test('REQ-2-2-2#2: REQ-2-2-2: Manage Organization Team Members and Hierarchy - Scenario 2', async ({ page }) => {
  const teamA = 'pw-team-a-' + uid();
  const teamB = 'pw-team-b-' + uid();
  const teamD = 'pw-team-d-' + uid();

  await signIn(page);
  await createTeam(page, teamD);
  await createTeam(page, teamA);
  await setParentTeam(page, teamA, teamD);
  await createTeam(page, teamB);
  await setParentTeam(page, teamB, teamA);

  await openTeam(page, teamA);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Parent team', { exact: true }).selectOption({ label: teamB });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Cyclic team hierarchy is not allowed', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Parent team', { exact: true })).toHaveValue(teamD);
});

test('REQ-2-2-3: REQ-2-2-3: Directly Add a User as an Organization Member - Scenario 1', async ({ page }) => {
  const username = 'pw-member-' + uid();
  const email = username + '@example.test';

  await createAccount(page, username, email);
  await signIn(page);
  await openOrganization(page);
  await page.getByRole('link', { name: 'People', exact: true }).click();

  await addMemberFromPeople(page, username);
  await expect(page.getByText(username, { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText(username, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Add member', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await page.getByRole('button', { name: 'Add member', exact: true }).click();
  await expect(page.getByText('Account is already a member', { exact: true })).toBeVisible();

  await page.getByLabel('Username or email', { exact: true }).fill('unknown-reviewer');
  await page.getByRole('button', { name: 'Add member', exact: true }).click();
  await expect(page.getByText('Account not found', { exact: true })).toBeVisible();

  await signOut(page);
  await signIn(page, username);
  await openYourOrganizations(page);
  await expect(page.getByText(ORG, { exact: true }).first()).toBeVisible();
});

test('REQ-2-2-3#2: REQ-2-2-3: Directly Add a User as an Organization Member - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openOrganization(page);
  await page.getByRole('link', { name: 'People', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Add member', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add member', exact: true }).click();
  await expect(page.getByLabel('Username or email', { exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Role', exact: true })).toBeVisible();

  await page.getByLabel('Username or email', { exact: true }).fill('unknown-reviewer');
  await page.getByRole('button', { name: 'Add member', exact: true }).click();
  await expect(page.getByText('Account not found', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText('bob-reviewer', { exact: true })).toBeVisible();
});

test('REQ-2-2-4: REQ-2-2-4: Remove a Member from an Organization - Scenario 1', async ({ page }) => {
  const username = 'pw-remove-' + uid();
  const email = username + '@example.test';

  await createAccount(page, username, email);
  await signIn(page);
  await openOrganization(page);
  await page.getByRole('link', { name: 'People', exact: true }).click();
  await addMemberFromPeople(page, username);
  await expect(page.getByText(username, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Member menu ' + username, exact: true }).click();
  await page.getByRole('menuitem', { name: 'Remove from organization', exact: true }).click();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByText(username, { exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByText(username, { exact: true })).toHaveCount(0);

  await signOut(page);
  await signIn(page, username);
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
});

test('REQ-2-2-4#2: REQ-2-2-4: Remove a Member from an Organization - Scenario 2', async ({ page }) => {
  const username = 'pw-nonowner-' + uid();
  const email = username + '@example.test';

  await createAccount(page, username, email);
  await signIn(page);
  await openOrganization(page);
  await page.getByRole('link', { name: 'People', exact: true }).click();
  await addMemberFromPeople(page, username);
  await expect(page.getByText(username, { exact: true })).toBeVisible();

  await signOut(page);
  await signIn(page, username);
  await openOrganization(page);
  await page.getByRole('link', { name: 'People', exact: true }).click();
  await expect(page.getByText('bob-reviewer', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Member menu bob-reviewer', exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByText('bob-reviewer', { exact: true })).toBeVisible();
});

test('REQ-2-3: REQ-2-3: Grant Repository Access to People and Teams - Scenario 1', async ({ page }) => {
  const repoName = 'pw-access-' + uid();

  await signIn(page);
  await createOrgRepository(page, repoName);
  await grantTeamWrite(page);

  await expect(page.getByText(TEAM, { exact: true })).toBeVisible();
  await expect(page.getByText('Write', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText(TEAM, { exact: true })).toBeVisible();
  await expect(page.getByText('Write', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Role', { exact: true })).toHaveCount(1);
});

test('REQ-2-3#2: REQ-2-3: Grant Repository Access to People and Teams - Scenario 2', async ({ page }) => {
  const repoName = 'pw-replace-' + uid();

  await signIn(page);
  await createOrgRepository(page, repoName);
  await grantTeamWrite(page);

  await expect(page.getByText(TEAM, { exact: true })).toBeVisible();
  await expect(page.getByLabel('Role', { exact: true })).toHaveCount(1);

  await page.getByLabel('Role', { exact: true }).selectOption({ label: 'Read' });
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await page.reload();
  await expect(page.getByText(TEAM, { exact: true })).toBeVisible();
  await expect(page.getByText('Read', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Role', { exact: true })).toHaveCount(1);
  await expect(page.getByLabel('Role', { exact: true })).toHaveValue('Read');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

