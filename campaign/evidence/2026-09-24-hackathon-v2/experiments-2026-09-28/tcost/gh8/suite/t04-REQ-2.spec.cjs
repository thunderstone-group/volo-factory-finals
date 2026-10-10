const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const PASSWORD = 'Valid-password-123!';

async function registerUser(page, username) {
  const email = `${username}@example.test`;
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password', { exact: true }).fill(PASSWORD);
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
}

async function signInAs(page, usernameOrEmail) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(usernameOrEmail);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
}

async function signOut(page) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm sign out', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
}

async function createOrganization(page, orgName) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Your organizations', exact: true }).click();
  await page.getByRole('link', { name: 'New organization', exact: true }).click();
  await page.getByLabel('Organization name', { exact: true }).fill(orgName);
  await page.getByLabel('Display name', { exact: true }).fill(orgName);
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Repositories', exact: true })).toBeVisible();
}

async function openOrganization(page, orgName) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Your organizations', exact: true }).click();
  await page.getByRole('link', { name: orgName, exact: true }).click();
  await expect(page.getByRole('link', { name: 'Repositories', exact: true })).toBeVisible();
}

async function createTeam(page, orgName, teamName) {
  await openOrganization(page, orgName);
  await page.getByRole('link', { name: 'Teams', exact: true }).click();
  await page.getByRole('link', { name: 'New team', exact: true }).click();
  await page.getByLabel('Team name', { exact: true }).fill(teamName);
  await page.getByRole('button', { name: 'Create team', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Members', exact: true })).toBeVisible();
}

async function openTeam(page, orgName, teamName) {
  await openOrganization(page, orgName);
  await page.getByRole('link', { name: 'Teams', exact: true }).click();
  await page.getByRole('link', { name: teamName, exact: true }).click();
  await expect(page.getByRole('link', { name: 'Members', exact: true })).toBeVisible();
}

async function setParentTeam(page, parentTeamName) {
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Parent team', { exact: true }).selectOption({ label: parentTeamName });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('option', { name: parentTeamName, exact: true })).toBeSelected();
}

async function addOrganizationMember(page, orgName, username) {
  await openOrganization(page, orgName);
  await page.getByRole('link', { name: 'People', exact: true }).click();
  await page.getByRole('button', { name: 'Add member', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await page.getByRole('button', { name: 'Add member', exact: true }).last().click();
  await expect(page.getByText(username, { exact: true })).toBeVisible();
}

async function createPrivateRepository(page, orgName, repoName) {
  await openOrganization(page, orgName);
  await page.getByRole('link', { name: 'Repositories', exact: true }).click();
  await page.getByRole('link', { name: 'New repository', exact: true }).click();
  await page.getByLabel('Owner', { exact: true }).selectOption({ label: orgName });
  await page.getByLabel('Repository name', { exact: true }).fill(repoName);
  await page.getByRole('radio', { name: 'Private', exact: true }).check();
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();
  await expect(page.getByText('Private', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Code', exact: true })).toBeVisible();
}

async function createPersonalRepository(page, repoName) {
  await page.getByRole('link', { name: 'New repository', exact: true }).click();
  await page.getByLabel('Repository name', { exact: true }).fill(repoName);
  await page.getByRole('radio', { name: 'Public', exact: true }).check();
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Code', exact: true })).toBeVisible();
}

async function openManageAccess(page) {
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Manage access', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add people or teams', exact: true })).toBeVisible();
}

async function grantTeamAccess(page, teamName) {
  await page.getByRole('button', { name: 'Add people or teams', exact: true }).click();
  await page.getByLabel('Search', { exact: true }).last().fill(teamName);
  await page.getByRole('option', { name: new RegExp(teamName) }).first().click();
  await page.getByLabel('Role', { exact: true }).last().selectOption({ label: 'Write' });
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText(teamName, { exact: true })).toBeVisible();
  await expect(page.getByText('Write', { exact: true })).toBeVisible();
}

test('REQ-2-2-2: REQ-2-2-2: Manage Organization Team Members and Hierarchy - Scenario 1', async ({ page }) => {
  const member = `pw-user-${u()}`;
  const org = `pw-org-${u()}`;
  const parentTeam = `pw-parent-${u()}`;
  const team = `pw-team-${u()}`;

  await registerUser(page, member);
  await signInAs(page, 'alice-dev');
  await createOrganization(page, org);
  await createTeam(page, org, parentTeam);
  await createTeam(page, org, team);
  await addOrganizationMember(page, org, member);

  await openTeam(page, org, team);
  await page.getByRole('link', { name: 'Members', exact: true }).click();
  await page.getByRole('button', { name: 'Add member', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(member);
  await page.getByRole('button', { name: 'Add member', exact: true }).last().click();
  await expect(page.getByText(member, { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Parent team', { exact: true }).selectOption({ label: parentTeam });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('option', { name: parentTeam, exact: true })).toBeSelected();

  await page.getByRole('link', { name: 'Members', exact: true }).click();
  await page.getByRole('button', { name: `Remove ${member}`, exact: true }).click();
  await expect(page.getByText(member, { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(member, { exact: true })).toHaveCount(0);
});

test('REQ-2-2-2#2: REQ-2-2-2: Manage Organization Team Members and Hierarchy - Scenario 2', async ({ page }) => {
  const org = `pw-org-${u()}`;
  const parentTeam = `pw-parent-${u()}`;
  const team = `pw-team-${u()}`;
  const descendant = `pw-desc-${u()}`;

  await signInAs(page, 'alice-dev');
  await createOrganization(page, org);
  await createTeam(page, org, parentTeam);
  await createTeam(page, org, team);
  await createTeam(page, org, descendant);

  await openTeam(page, org, team);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Parent team', { exact: true }).selectOption({ label: parentTeam });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('option', { name: parentTeam, exact: true })).toBeSelected();

  await openTeam(page, org, descendant);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Parent team', { exact: true }).selectOption({ label: team });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('option', { name: team, exact: true })).toBeSelected();

  await openTeam(page, org, team);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Parent team', { exact: true }).selectOption({ label: descendant });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Cyclic team hierarchy is not allowed', { exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: parentTeam, exact: true })).toBeSelected();
  await page.reload();
  await expect(page.getByRole('option', { name: parentTeam, exact: true })).toBeSelected();
});

test('REQ-2-2-3: REQ-2-2-3: Directly Add a User as an Organization Member - Scenario 1', async ({ page }) => {
  const member = `pw-user-${u()}`;
  const org = `pw-org-${u()}`;

  await registerUser(page, member);
  await signInAs(page, 'alice-dev');
  await createOrganization(page, org);
  await addOrganizationMember(page, org, member);

  await page.reload();
  await expect(page.getByText(member, { exact: true })).toBeVisible();

  await signOut(page);
  await signInAs(page, member);
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Your organizations', exact: true }).click();
  await expect(page.getByText(org, { exact: true })).toBeVisible();
  await page.getByRole('link', { name: org, exact: true }).click();
  await expect(page.getByRole('link', { name: 'Repositories', exact: true })).toBeVisible();
});

test('REQ-2-2-3#2: REQ-2-2-3: Directly Add a User as an Organization Member - Scenario 2', async ({ page }) => {
  const member = `pw-user-${u()}`;
  const org = `pw-org-${u()}`;

  await registerUser(page, member);
  await signInAs(page, 'alice-dev');
  await createOrganization(page, org);

  await openOrganization(page, org);
  await page.getByRole('link', { name: 'People', exact: true }).click();
  await page.getByRole('button', { name: 'Add member', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(member);
  await page.getByLabel('Role', { exact: true }).selectOption({ label: 'Owner' });
  await page.getByRole('button', { name: 'Add member', exact: true }).last().click();
  await expect(page.getByText(member, { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText(member, { exact: true })).toBeVisible();
});

test('REQ-2-2-4: REQ-2-2-4: Remove a Member from an Organization - Scenario 1', async ({ page }) => {
  const member = `pw-user-${u()}`;
  const personalRepo = `pw-personal-${u()}`;
  const org = `pw-org-${u()}`;

  await registerUser(page, member);
  await signInAs(page, member);
  await createPersonalRepository(page, personalRepo);
  await signOut(page);

  await signInAs(page, 'alice-dev');
  await createOrganization(page, org);
  await addOrganizationMember(page, org, member);
  await page.reload();
  await expect(page.getByText(member, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: `Member menu ${member}`, exact: true }).click();
  await page.getByRole('menuitem', { name: 'Remove from organization', exact: true }).click();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByText(member, { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(member, { exact: true })).toHaveCount(0);

  await signOut(page);
  await signInAs(page, member);
  await page.getByRole('searchbox', { name: 'Search', exact: true }).fill(personalRepo);
  await page.keyboard.press('Enter');
  await page.getByRole('link', { name: personalRepo, exact: true }).click();
  await expect(page.getByRole('link', { name: 'Code', exact: true })).toBeVisible();
});

test('REQ-2-2-4#2: REQ-2-2-4: Remove a Member from an Organization - Scenario 2', async ({ page }) => {
  const nonOwner = `pw-user-${u()}`;
  const other = `pw-user-${u()}`;
  const org = `pw-org-${u()}`;

  await registerUser(page, nonOwner);
  await registerUser(page, other);
  await signInAs(page, 'alice-dev');
  await createOrganization(page, org);
  await addOrganizationMember(page, org, nonOwner);
  await addOrganizationMember(page, org, other);
  await signOut(page);

  await signInAs(page, nonOwner);
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Your organizations', exact: true }).click();
  await page.getByRole('link', { name: org, exact: true }).click();
  await page.getByRole('link', { name: 'People', exact: true }).click();
  await expect(page.getByText(other, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: `Member menu ${other}`, exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(other, { exact: true })).toBeVisible();
});

test('REQ-2-3: REQ-2-3: Grant Repository Access to People and Teams - Scenario 1', async ({ page }) => {
  const org = `pw-org-${u()}`;
  const team = `pw-team-${u()}`;
  const repo = `pw-repo-${u()}`;

  await signInAs(page, 'alice-dev');
  await createOrganization(page, org);
  await createTeam(page, org, team);
  await createPrivateRepository(page, org, repo);
  await openManageAccess(page);
  await grantTeamAccess(page, team);

  await page.reload();
  await expect(page.getByText(team, { exact: true })).toBeVisible();
  await expect(page.getByText('Write', { exact: true })).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(team) })).toHaveCount(1);

  const row = page.getByRole('row', { name: new RegExp(team) });
  await row.getByLabel('Role', { exact: true }).selectOption({ label: 'Write' });
  await row.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('row', { name: new RegExp(team) })).toHaveCount(1);
});

test('REQ-2-3#2: REQ-2-3: Grant Repository Access to People and Teams - Scenario 2', async ({ page }) => {
  const org = `pw-org-${u()}`;
  const team = `pw-team-${u()}`;
  const repo = `pw-repo-${u()}`;

  await signInAs(page, 'alice-dev');
  await createOrganization(page, org);
  await createTeam(page, org, team);
  await createPrivateRepository(page, org, repo);
  await openManageAccess(page);
  await grantTeamAccess(page, team);

  const row = page.getByRole('row', { name: new RegExp(team) });
  await row.getByLabel('Role', { exact: true }).selectOption({ label: 'Read' });
  await row.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('row', { name: new RegExp(team) }).getByText('Read', { exact: true })).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(team) }).getByText('Write', { exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('row', { name: new RegExp(team) }).getByText('Read', { exact: true })).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(team) }).getByText('Write', { exact: true })).toHaveCount(0);
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

