const { test, expect } = require('@playwright/test');

const ORG = 'Acme Demo';
const MEMBER = 'bob-reviewer';
const PASSWORD = 'Valid-password-123!';
const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function openSignIn(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
}

async function signIn(page, usernameOrEmail, password = PASSWORD) {
  await openSignIn(page);
  await page.getByLabel('Username or email', { exact: true }).fill(usernameOrEmail);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function registerAccount(page, username, email) {
  await openSignIn(page);
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password', { exact: true }).fill(PASSWORD);
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
}

async function signOut(page) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Sign out' })
    .getByRole('button', { name: 'Confirm sign out', exact: true })
    .click();
}

async function openYourOrganizations(page) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Your organizations', exact: true }).click();
}

async function openOrganization(page, name) {
  await openYourOrganizations(page);
  await page.getByRole('link', { name, exact: true }).click();
}

async function createOrganization(page, name, displayName) {
  await openYourOrganizations(page);
  await page.getByRole('link', { name: 'New organization', exact: true }).click();
  await page.getByLabel('Organization name', { exact: true }).fill(name);
  await page.getByLabel('Display name', { exact: true }).fill(displayName);
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();
}

async function createTeam(page, orgName, teamName) {
  await openOrganization(page, orgName);
  await page.getByRole('link', { name: 'Teams', exact: true }).click();
  await page.getByRole('link', { name: 'New team', exact: true }).click();
  await page.getByLabel('Team name', { exact: true }).fill(teamName);
  await page.getByRole('button', { name: 'Create team', exact: true }).click();
  await expect(page.getByRole('heading', { name: teamName })).toBeVisible();
}

async function openTeam(page, orgName, teamName) {
  await openOrganization(page, orgName);
  await page.getByRole('link', { name: 'Teams', exact: true }).click();
  await page.getByRole('link', { name: teamName, exact: true }).click();
}

async function addOrganizationMember(page, usernameOrEmail) {
  await page.getByRole('button', { name: 'Add member', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(usernameOrEmail);
  await page.getByRole('button', { name: 'Add member', exact: true }).last().click();
}

async function addTeamMember(page, username) {
  await page.getByRole('button', { name: 'Add member', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByRole('button', { name: 'Add member', exact: true }).last().click();
}

// Works for a native select and for a combobox with clickable options.
async function chooseOption(page, control, optionName, exact = true) {
  try {
    await control.selectOption({ label: optionName });
  } catch (err) {
    await control.click();
    await page.getByRole('option', { name: optionName, exact }).click();
  }
}

async function createPrivateOrgRepository(page, orgName, repoName) {
  await page.getByRole('link', { name: 'New repository', exact: true }).click();
  await chooseOption(page, page.getByLabel('Owner', { exact: true }), orgName);
  await page.getByLabel('Repository name', { exact: true }).fill(repoName);
  await page.getByRole('radio', { name: 'Private', exact: true }).check();
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();
  await expect(page.getByRole('heading', { name: repoName })).toBeVisible();
}

async function openOrganizationRepository(page, orgName, repoName) {
  await openOrganization(page, orgName);
  await page.getByRole('link', { name: 'Repositories', exact: true }).click();
  await page.getByLabel('Find a repository', { exact: true }).fill(repoName);
  await page.getByRole('link', { name: repoName, exact: true }).click();
}

async function openManageAccess(page) {
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Manage access', exact: true }).click();
}

async function grantAccess(page, subjectName, roleName) {
  await page.getByRole('button', { name: 'Add people or teams', exact: true }).click();
  await page.getByLabel('Search', { exact: true }).fill(subjectName);
  await page.getByRole('option', { name: subjectName }).click();
  await chooseOption(page, page.getByRole('combobox', { name: 'Role', exact: true }), roleName);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
}

test('REQ-2-1-1: REQ-2-1-1: Browse Organization Repositories - Scenario 1', async ({ page }) => {
  await signIn(page, 'alice-dev');
  await openOrganization(page, ORG);
  await page.getByRole('link', { name: 'Repositories', exact: true }).click();
  await page.getByLabel('Find a repository', { exact: true }).fill('acme-docs');
  const repoLink = page.getByRole('link', { name: 'acme-docs', exact: true });
  await expect(repoLink).toBeVisible();
  await repoLink.click();
  await expect(page.getByRole('heading', { name: 'acme-docs' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'acme-docs' })).toBeVisible();
});

test('REQ-2-1-1#2: REQ-2-1-1: Browse Organization Repositories - Scenario 2', async ({ page }) => {
  await signIn(page, 'alice-dev');
  await openOrganization(page, ORG);
  await expect(page.getByRole('link', { name: 'Repositories', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'People', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Teams', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Repositories', exact: true }).click();
  await page.getByLabel('Find a repository', { exact: true }).fill('acme-docs');
  await expect(page.getByRole('link', { name: 'acme-docs', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'acme-docs', exact: true })).toBeVisible();
});

test('REQ-2-1-2: REQ-2-1-2: Create an Organization After Authentication - Scenario 1', async ({ page }) => {
  const org = 'mobile-guild-' + u();
  await signIn(page, 'alice-dev');
  await createOrganization(page, org, 'Mobile Guild');
  await expect(page.getByRole('heading', { name: org, exact: true })).toBeVisible();

  // the creating account is shown as Owner and organization member
  await page.getByRole('link', { name: 'People', exact: true }).click();
  await expect(page.getByText('alice-dev', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Owner', { exact: true }).first()).toBeVisible();

  // the organization appears in the "Your organizations" list
  await openYourOrganizations(page);
  await expect(page.getByRole('link', { name: org, exact: true })).toBeVisible();

  // the overview survives a refresh
  await page.getByRole('link', { name: org, exact: true }).click();
  await expect(page.getByRole('heading', { name: org, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: org, exact: true })).toBeVisible();
});

test('REQ-2-1-2#2: REQ-2-1-2: Create an Organization After Authentication - Scenario 2', async ({ page }) => {
  const existing = 'pw-dup-' + u();
  await signIn(page, 'alice-dev');
  await createOrganization(page, existing, 'Duplicate Check Org');
  await expect(page.getByRole('heading', { name: existing, exact: true })).toBeVisible();

  // duplicate identifier, display name also missing
  await openYourOrganizations(page);
  await page.getByRole('link', { name: 'New organization', exact: true }).click();
  await page.getByLabel('Organization name', { exact: true }).fill(existing);
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();
  await expect(page.getByText('Organization name already exists', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: existing, exact: true })).toHaveCount(0);

  // malformed identifier
  await page.getByLabel('Organization name', { exact: true }).fill('-invalid-organization');
  await page.getByLabel('Display name', { exact: true }).fill('Invalid Org');
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();
  await expect(page.getByText('Organization name format is invalid', { exact: true })).toBeVisible();

  // whitespace-only display name
  await page.getByLabel('Organization name', { exact: true }).fill('pw-org-' + u());
  await page.getByLabel('Display name', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();
  await expect(page.getByText('Display name is required', { exact: true })).toBeVisible();
});

test('REQ-2-1-2#3: REQ-2-1-2: Create an Organization After Authentication - Scenario 3', async ({ page }) => {
  const org = 'pw-org-' + u();
  await signIn(page, 'alice-dev');
  await openYourOrganizations(page);
  await expect(page.getByRole('link', { name: 'New organization', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'New organization', exact: true }).click();
  await expect(page.getByLabel('Organization name', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Display name', { exact: true })).toBeVisible();
  await page.getByLabel('Organization name', { exact: true }).fill(org);
  await page.getByLabel('Display name', { exact: true }).fill('PW Organization');
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();

  await expect(page.getByRole('heading', { name: org, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: org, exact: true })).toBeVisible();
  await openYourOrganizations(page);
  await expect(page.getByRole('link', { name: org, exact: true })).toBeVisible();
});

test('REQ-2-2-1: REQ-2-2-1: Create an Organization Team - Scenario 1', async ({ page }) => {
  const team = 'mobile-team-' + u();
  await signIn(page, 'alice-dev');
  await openOrganization(page, ORG);
  await page.getByRole('link', { name: 'Teams', exact: true }).click();
  await page.getByRole('link', { name: 'New team', exact: true }).click();
  await expect(page.getByLabel('Team name', { exact: true })).toBeVisible();
  await page.getByLabel('Team name', { exact: true }).fill(team);
  await page.getByRole('button', { name: 'Create team', exact: true }).click();

  await expect(page.getByRole('heading', { name: team })).toBeVisible();
  await expect(page.getByRole('heading', { name: ORG })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: team })).toBeVisible();

  // reopening the Teams list still shows the new team
  await openOrganization(page, ORG);
  await page.getByRole('link', { name: 'Teams', exact: true }).click();
  await expect(page.getByText(team, { exact: true }).first()).toBeVisible();
});

test('REQ-2-2-1#2: REQ-2-2-1: Create an Organization Team - Scenario 2', async ({ page }) => {
  const team = 'pw-team-' + u();
  await signIn(page, 'alice-dev');
  await openOrganization(page, ORG);
  await page.getByRole('link', { name: 'Teams', exact: true }).click();
  await page.getByRole('link', { name: 'New team', exact: true }).click();

  // malformed team name is rejected
  await page.getByLabel('Team name', { exact: true }).fill('-invalid-team');
  await page.getByRole('button', { name: 'Create team', exact: true }).click();
  await expect(page.getByText('Team name format is invalid', { exact: true })).toBeVisible();

  // a compliant unique name is created
  await page.getByLabel('Team name', { exact: true }).fill(team);
  await page.getByRole('button', { name: 'Create team', exact: true }).click();
  await expect(page.getByRole('heading', { name: team })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: team })).toBeVisible();
});

test('REQ-2-2-2: REQ-2-2-2: Manage Organization Team Members and Hierarchy - Scenario 1', async ({ page }) => {
  const team = 'pw-team-' + u();
  await signIn(page, 'alice-dev');
  await createTeam(page, ORG, team);

  // add an existing organization member who is not yet in the team
  await page.getByRole('link', { name: 'Members', exact: true }).click();
  await addTeamMember(page, MEMBER);
  await expect(page.getByText(MEMBER, { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: `Remove ${MEMBER}`, exact: true })).toBeVisible();

  // give the team a parent team from the same organization
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  const parentSelect = page.getByLabel('Parent team', { exact: true });
  const before = await parentSelect.inputValue();
  await parentSelect.selectOption({ label: 'frontend-team' });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.reload();
  await expect(parentSelect).not.toHaveValue(before);

  // the membership survives the reload and is then removed
  await page.getByRole('link', { name: 'Members', exact: true }).click();
  await expect(page.getByText(MEMBER, { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: `Remove ${MEMBER}`, exact: true }).click();
  await expect(page.getByText(MEMBER, { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(MEMBER, { exact: true })).toHaveCount(0);
});

test('REQ-2-2-2#2: REQ-2-2-2: Manage Organization Team Members and Hierarchy - Scenario 2', async ({ page }) => {
  const parentTeam = 'pw-parent-' + u();
  const childTeam = 'pw-child-' + u();
  await signIn(page, 'alice-dev');
  await createTeam(page, ORG, parentTeam);
  await createTeam(page, ORG, childTeam);

  // make the child a descendant of the parent
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Parent team', { exact: true }).selectOption({ label: parentTeam });
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  // from the parent team, selecting its own descendant as parent is a cycle
  await openTeam(page, ORG, parentTeam);
  await expect(page.getByRole('heading', { name: parentTeam })).toBeVisible();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  const parentSelect = page.getByLabel('Parent team', { exact: true });
  const before = await parentSelect.inputValue();
  await parentSelect.selectOption({ label: childTeam });
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText('Cyclic team hierarchy is not allowed', { exact: true })).toBeVisible();
  await page.reload();
  await expect(parentSelect).toHaveValue(before);
});

test('REQ-2-2-3: REQ-2-2-3: Directly Add a User as an Organization Member - Scenario 1', async ({ page }) => {
  const username = 'pw-member-' + u();
  const email = username + '@example.test';
  await registerAccount(page, username, email);

  await signIn(page, 'alice-dev');
  await openOrganization(page, ORG);
  await page.getByRole('link', { name: 'People', exact: true }).click();
  await page.getByRole('button', { name: 'Add member', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await page.getByRole('combobox', { name: 'Role', exact: true }).click();
  await page.getByRole('option', { name: 'Member', exact: true }).click();
  await page.getByRole('button', { name: 'Add member', exact: true }).last().click();

  await expect(page.getByText(username, { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Member', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(username, { exact: true }).first()).toBeVisible();

  // the added account sees the organization in "Your organizations"
  await signOut(page);
  await signIn(page, email);
  await openYourOrganizations(page);
  await expect(page.getByText(ORG, { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(ORG, { exact: true }).first()).toBeVisible();
});

test('REQ-2-2-3#2: REQ-2-2-3: Directly Add a User as an Organization Member - Scenario 2', async ({ page }) => {
  await signIn(page, 'alice-dev');
  await openOrganization(page, ORG);
  await page.getByRole('link', { name: 'People', exact: true }).click();

  // an existing member keeps the form open and creates no second membership
  await page.getByRole('button', { name: 'Add member', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(MEMBER);
  await page.getByRole('button', { name: 'Add member', exact: true }).last().click();
  await expect(page.getByText('Account is already a member', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Username or email', { exact: true })).toBeVisible();
  await expect(page.getByText(MEMBER, { exact: true })).toHaveCount(1);

  // an unknown account is reported and again nothing is created
  await page.getByLabel('Username or email', { exact: true }).fill('unknown-reviewer');
  await page.getByRole('button', { name: 'Add member', exact: true }).last().click();
  await expect(page.getByText('Account not found', { exact: true })).toBeVisible();
  await expect(page.getByText('unknown-reviewer', { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(MEMBER, { exact: true })).toHaveCount(1);
});

test('REQ-2-2-4: REQ-2-2-4: Remove a Member from an Organization - Scenario 1', async ({ page }) => {
  const username = 'pw-remove-' + u();
  const email = username + '@example.test';
  await registerAccount(page, username, email);

  await signIn(page, 'alice-dev');
  await openOrganization(page, ORG);
  await page.getByRole('link', { name: 'People', exact: true }).click();
  await addOrganizationMember(page, username);
  await expect(page.getByText(username, { exact: true }).first()).toBeVisible();

  // remove the member through the member action menu and its confirmation
  await page.getByRole('button', { name: `Member menu ${username}`, exact: true }).click();
  await page.getByRole('menuitem', { name: 'Remove from organization', exact: true }).click();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();

  await expect(page.getByText(username, { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(username, { exact: true })).toHaveCount(0);

  // the removed account still exists and no longer sees the organization
  await signOut(page);
  await signIn(page, email);
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await expect(page.getByText(username, { exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Your organizations', exact: true }).click();
  await expect(page.getByText(ORG, { exact: true })).toHaveCount(0);
});

test('REQ-2-2-4#2: REQ-2-2-4: Remove a Member from an Organization - Scenario 2', async ({ page }) => {
  const username = 'pw-nonowner-' + u();
  const email = username + '@example.test';
  await registerAccount(page, username, email);

  // the Owner adds a plain organization member
  await signIn(page, 'alice-dev');
  await openOrganization(page, ORG);
  await page.getByRole('link', { name: 'People', exact: true }).click();
  await addOrganizationMember(page, username);
  await expect(page.getByText(username, { exact: true }).first()).toBeVisible();

  // that plain member opens the same People page
  await signOut(page);
  await signIn(page, email);
  await openOrganization(page, ORG);
  await page.getByRole('link', { name: 'People', exact: true }).click();
  await expect(page.getByText(MEMBER, { exact: true }).first()).toBeVisible();

  // no member-menu button and no removal menuitem for a non-Owner
  await expect(page.getByRole('button', { name: `Member menu ${MEMBER}`, exact: true })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'Remove from organization', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Remove', exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByText(MEMBER, { exact: true }).first()).toBeVisible();
});

test('REQ-2-3: REQ-2-3: Grant Repository Access to People and Teams - Scenario 1', async ({ page }) => {
  const repo = 'pw-repo-' + u();
  await signIn(page, 'alice-dev');
  await createPrivateOrgRepository(page, ORG, repo);

  await openManageAccess(page);
  await grantAccess(page, MEMBER, 'Write');
  await page.reload();

  const row = page.getByRole('row', { name: MEMBER });
  await expect(row).toHaveCount(1);
  await expect(row.getByLabel('Role', { exact: true })).toHaveValue('Write');

  // saving the same role for the same subject again does not add a second record
  await grantAccess(page, MEMBER, 'Write');
  await page.reload();
  await expect(page.getByRole('row', { name: MEMBER })).toHaveCount(1);
});

test('REQ-2-3#2: REQ-2-3: Grant Repository Access to People and Teams - Scenario 2', async ({ page }) => {
  const repo = 'pw-repo-' + u();
  const team = 'pw-team-' + u();
  await signIn(page, 'alice-dev');
  await createPrivateOrgRepository(page, ORG, repo);
  await createTeam(page, ORG, team);

  await openOrganizationRepository(page, ORG, repo);
  await openManageAccess(page);
  await grantAccess(page, team, 'Write');
  await page.reload();

  let row = page.getByRole('row', { name: team });
  await expect(row).toHaveCount(1);
  await expect(row.getByLabel('Role', { exact: true })).toHaveValue('Write');

  // replace the Write role with Read
  await chooseOption(page, row.getByLabel('Role', { exact: true }), 'Read');
  await row.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(row.getByLabel('Role', { exact: true })).toHaveValue('Read');

  await page.reload();
  row = page.getByRole('row', { name: team });
  await expect(row).toHaveCount(1);
  await expect(row.getByLabel('Role', { exact: true })).toHaveValue('Read');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

