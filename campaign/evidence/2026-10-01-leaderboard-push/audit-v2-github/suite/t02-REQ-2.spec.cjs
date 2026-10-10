const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const newUsername = () => 'pw-' + u();
const newOrg = () => 'org-' + u();
const newTeam = () => 'team-' + u();
const newRepo = () => 'repo-' + u();

const seed = {
  alice: 'alice-dev',
  aliceEmail: 'alice.dev@example.test',
  alicePass: 'Valid-password-123!',
  org: 'Acme Demo',
  repo: 'acme-docs',
  member: 'bob-reviewer',
  team: 'frontend-team',
};

async function signIn(page, usernameOrEmail, password = seed.alicePass) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(usernameOrEmail);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
}

async function signOut(page) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Sign out', exact: true });
  await dialog.getByRole('button', { name: 'Confirm sign out', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
}

async function registerUser(page, username, email, password = 'Valid-password-123!') {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign up', exact: true }).click();
  const createAccount = page.getByRole('link', { name: 'Create an account', exact: true });
  if (await createAccount.count()) {
    await createAccount.click();
  }
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
}

async function openYourOrganizations(page) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Your organizations', exact: true }).click();
}

async function openOrganization(page, name) {
  await openYourOrganizations(page);
  await page.getByRole('link', { name, exact: true }).click();
}

async function chooseOption(page, label, value, { last = false } = {}) {
  let field = page.getByLabel(label, { exact: true });
  if (last) field = field.last();
  const tag = await field.evaluate((el) => el.tagName);
  if (tag === 'SELECT') {
    await field.selectOption({ label: value });
  } else {
    await field.click();
    await page.getByRole('option', { name: value, exact: true }).click();
  }
}

async function createOrganization(page, name, displayName = name) {
  await openYourOrganizations(page);
  await page.getByRole('link', { name: 'New organization', exact: true }).click();
  await page.getByLabel('Organization name', { exact: true }).fill(name);
  await page.getByLabel('Display name', { exact: true }).fill(displayName);
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}

async function createTeam(page, orgName, teamName) {
  await openOrganization(page, orgName);
  await page.getByRole('link', { name: 'Teams', exact: true }).click();
  await page.getByRole('link', { name: 'New team', exact: true }).click();
  await page.getByLabel('Team name', { exact: true }).fill(teamName);
  await page.getByRole('button', { name: 'Create team', exact: true }).click();
  await expect(page.getByRole('heading', { name: `${orgName}/${teamName}`, exact: true })).toBeVisible();
}

async function openTeam(page, orgName, teamName) {
  await openOrganization(page, orgName);
  await page.getByRole('link', { name: 'Teams', exact: true }).click();
  await page.getByRole('link', { name: teamName, exact: true }).click();
  await expect(page.getByRole('heading', { name: `${orgName}/${teamName}`, exact: true })).toBeVisible();
}

async function setParentTeam(page, orgName, teamName, parentName) {
  await openTeam(page, orgName, teamName);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  const field = page.getByLabel('Parent team', { exact: true });
  await field.selectOption({ label: parentName });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
}

function selectedOptionText(page, label) {
  return page.getByLabel(label, { exact: true }).evaluate((el) => {
    return el.options && el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : '';
  });
}

async function openPeople(page, orgName) {
  await openOrganization(page, orgName);
  await page.getByRole('link', { name: 'People', exact: true }).click();
}

async function addOrgMember(page, username) {
  await page.getByRole('button', { name: 'Add member', exact: true }).first().click();
  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await chooseOption(page, 'Role', 'Member');
  await page.getByRole('button', { name: 'Add member', exact: true }).last().click();
  await expect(page.getByText(username, { exact: true })).toBeVisible();
}

async function removeOrgMember(page, username) {
  await page.getByRole('button', { name: `Member menu ${username}`, exact: true }).click();
  await page.getByRole('menuitem', { name: 'Remove from organization', exact: true }).click();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
}

async function createPersonalRepo(page, username, repoName) {
  await page.goto('/');
  await page.getByRole('link', { name: 'New repository', exact: true }).first().click();
  await page.getByLabel('Repository name', { exact: true }).fill(repoName);
  await page.getByRole('radio', { name: 'Private', exact: true }).check();
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();
  await expect(page.getByRole('heading', { name: `${username}/${repoName}`, exact: true })).toBeVisible();
}

async function createOrgRepository(page, orgName, repoName) {
  await page.goto('/');
  await page.getByRole('link', { name: 'New repository', exact: true }).first().click();
  await chooseOption(page, 'Owner', orgName);
  await page.getByLabel('Repository name', { exact: true }).fill(repoName);
  await page.getByRole('radio', { name: 'Private', exact: true }).check();
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();
  await expect(page.getByRole('heading', { name: `${orgName}/${repoName}`, exact: true })).toBeVisible();
}

async function openManageAccess(page) {
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Manage access', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add people or teams', exact: true })).toBeVisible();
}

async function grantTeamAccess(page, teamName, role) {
  await page.getByRole('button', { name: 'Add people or teams', exact: true }).click();
  await page.getByLabel('Search', { exact: true }).fill(teamName);
  await page.getByRole('option', { name: new RegExp(teamName) }).first().click();
  await chooseOption(page, 'Role', role, { last: true });
  await page.getByRole('button', { name: 'Add', exact: true }).click();
}

async function clickPublicFilter(page) {
  for (const role of ['link', 'button', 'option', 'menuitem', 'radio']) {
    const locator = page.getByRole(role, { name: 'Public', exact: true }).first();
    if (await locator.count()) {
      await locator.click();
      return;
    }
  }
  throw new Error('Public filter not found');
}

test('REQ-2-1-1: REQ-2-1-1: Browse Organization Repositories - Scenario 1', async ({ page }) => {
  await signIn(page, seed.alice, seed.alicePass);
  await openOrganization(page, seed.org);
  const orgUrl = page.url();
  await signOut(page);
  await page.goto(orgUrl);

  await page.getByRole('link', { name: 'Repositories', exact: true }).click();
  await page.getByLabel('Find a repository', { exact: true }).fill('secret-research');
  await expect(page.getByRole('link', { name: 'secret-research', exact: true })).toHaveCount(0);

  await page.getByLabel('Find a repository', { exact: true }).fill('acme-docs');
  await clickPublicFilter(page);
  await expect(page.getByRole('link', { name: 'acme-docs', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'secret-research', exact: true })).toHaveCount(0);

  await page.getByRole('link', { name: 'acme-docs', exact: true }).click();
  await expect(page.getByRole('heading', { name: `${seed.org}/${seed.repo}`, exact: true })).toBeVisible();

  await page.goBack();
  await expect(page.getByRole('link', { name: 'Repositories', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'secret-research', exact: true })).toHaveCount(0);
});

test('REQ-2-1-1#2: REQ-2-1-1: Browse Organization Repositories - Scenario 2', async ({ page }) => {
  await signIn(page, seed.alice, seed.alicePass);
  await openOrganization(page, seed.org);
  await page.getByRole('link', { name: 'Repositories', exact: true }).click();
  await expect(page.getByLabel('Find a repository', { exact: true })).toBeVisible();
  await page.getByLabel('Find a repository', { exact: true }).fill('acme-docs');
  await expect(page.getByRole('link', { name: 'acme-docs', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Find a repository', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'acme-docs', exact: true })).toBeVisible();
});

test('REQ-2-1-2: REQ-2-1-2: Create an Organization After Authentication - Scenario 1', async ({ page }) => {
  const org = newOrg();
  await signIn(page, seed.alice, seed.alicePass);
  await createOrganization(page, org, 'Mobile Guild');
  await expect(page.getByRole('heading', { name: org, exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: org, exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'People', exact: true }).click();
  await expect(page.getByText(seed.alice, { exact: true })).toBeVisible();
  await expect(page.getByText('Owner', { exact: true })).toBeVisible();

  await openYourOrganizations(page);
  await expect(page.getByRole('link', { name: org, exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'New organization', exact: true }).click();
  await page.getByLabel('Organization name', { exact: true }).fill(org);
  await page.getByLabel('Display name', { exact: true }).fill('Duplicate');
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();
  await expect(page.getByText('Organization name already exists', { exact: true })).toBeVisible();
});

test('REQ-2-1-2#2: REQ-2-1-2: Create an Organization After Authentication - Scenario 2', async ({ page }) => {
  await signIn(page, seed.alice, seed.alicePass);
  await openYourOrganizations(page);
  await page.getByRole('link', { name: 'New organization', exact: true }).click();
  await expect(page.getByLabel('Organization name', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Display name', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create organization', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Organization name', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Display name', { exact: true })).toBeVisible();
});

test('REQ-2-1-2#3: REQ-2-1-2: Create an Organization After Authentication - Scenario 3', async ({ page }) => {
  await signIn(page, seed.alice, seed.alicePass);
  await openYourOrganizations(page);
  await page.getByRole('link', { name: 'New organization', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Create organization', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Create organization', exact: true })).toBeVisible();
});

test('REQ-2-2-1: REQ-2-2-1: Create an Organization Team - Scenario 1', async ({ page }) => {
  const org = newOrg();
  const team = newTeam();
  await signIn(page, seed.alice, seed.alicePass);
  await createOrganization(page, org, org);
  await createTeam(page, org, team);
  await page.reload();
  await expect(page.getByRole('heading', { name: `${org}/${team}`, exact: true })).toBeVisible();
});

test('REQ-2-2-1#2: REQ-2-2-1: Create an Organization Team - Scenario 2', async ({ page }) => {
  const org = newOrg();
  await signIn(page, seed.alice, seed.alicePass);
  await createOrganization(page, org, org);
  await page.getByRole('link', { name: 'Teams', exact: true }).click();
  await page.getByRole('link', { name: 'New team', exact: true }).click();
  await expect(page.getByLabel('Team name', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create team', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Team name', { exact: true })).toBeVisible();
});

test('REQ-2-2-2: REQ-2-2-2: Manage Organization Team Members and Hierarchy - Scenario 1', async ({ page }) => {
  const org = newOrg();
  const parent = 'platform-' + u();
  const child = 'frontend-child-' + u();

  await signIn(page, seed.alice, seed.alicePass);
  await createOrganization(page, org, org);
  await createTeam(page, org, parent);
  await createTeam(page, org, child);

  await openPeople(page, org);
  await addOrgMember(page, seed.member);

  await openTeam(page, org, child);
  await page.getByRole('link', { name: 'Members', exact: true }).click();
  await page.getByRole('button', { name: 'Add member', exact: true }).first().click();
  await page.getByLabel('Username', { exact: true }).fill(seed.member);
  await page.getByRole('button', { name: 'Add member', exact: true }).last().click();
  await expect(page.getByRole('button', { name: `Remove ${seed.member}`, exact: true })).toBeVisible();

  await setParentTeam(page, org, child, parent);
  await expect(await selectedOptionText(page, 'Parent team')).toBe(parent);

  await page.getByRole('link', { name: 'Members', exact: true }).click();
  await page.getByRole('button', { name: `Remove ${seed.member}`, exact: true }).click();
  await expect(page.getByRole('button', { name: `Remove ${seed.member}`, exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByText(seed.member, { exact: true })).toHaveCount(0);

  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(await selectedOptionText(page, 'Parent team')).toBe(parent);
});

test('REQ-2-2-2#2: REQ-2-2-2: Manage Organization Team Members and Hierarchy - Scenario 2', async ({ page }) => {
  const org = newOrg();
  const parent = 'platform-team-' + u();
  const current = 'cycle-child-' + u();
  const descendant = 'cycle-desc-' + u();

  await signIn(page, seed.alice, seed.alicePass);
  await createOrganization(page, org, org);
  await createTeam(page, org, parent);
  await createTeam(page, org, current);
  await createTeam(page, org, descendant);

  await setParentTeam(page, org, current, parent);
  await setParentTeam(page, org, descendant, current);

  await openTeam(page, org, current);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Parent team', { exact: true }).selectOption({ label: descendant });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Cyclic team hierarchy is not allowed', { exact: true })).toBeVisible();

  await page.reload();
  await expect(await selectedOptionText(page, 'Parent team')).toBe(parent);
});

test('REQ-2-2-3: REQ-2-2-3: Directly Add a User as an Organization Member - Scenario 1', async ({ page }) => {
  const username = newUsername();
  const email = `${username}@example.test`;
  await registerUser(page, username, email);

  const org = newOrg();
  await signIn(page, seed.alice, seed.alicePass);
  await createOrganization(page, org, org);
  await openPeople(page, org);
  await addOrgMember(page, username);
  await expect(page.getByText('Member', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText(username, { exact: true })).toBeVisible();

  await signOut(page);
  await signIn(page, username);
  await openYourOrganizations(page);
  await expect(page.getByRole('link', { name: org, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: org, exact: true })).toBeVisible();
});

test('REQ-2-2-3#2: REQ-2-2-3: Directly Add a User as an Organization Member - Scenario 2', async ({ page }) => {
  const org = newOrg();
  await signIn(page, seed.alice, seed.alicePass);
  await createOrganization(page, org, org);
  await openPeople(page, org);
  await expect(page.getByRole('button', { name: 'Add member', exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Add member', exact: true }).first().click();
  await expect(page.getByLabel('Username or email', { exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Role', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Add member', exact: true }).first()).toBeVisible();
});

test('REQ-2-2-4: REQ-2-2-4: Remove a Member from an Organization - Scenario 1', async ({ page }) => {
  const victim = newUsername();
  const victimPass = 'Valid-password-123!';
  const repo = 'personal-' + u();
  await registerUser(page, victim, `${victim}@example.test`, victimPass);
  await signIn(page, victim, victimPass);
  await createPersonalRepo(page, victim, repo);
  await signOut(page);

  const org = newOrg();
  await signIn(page, seed.alice, seed.alicePass);
  await createOrganization(page, org, org);
  await openPeople(page, org);
  await addOrgMember(page, victim);
  await removeOrgMember(page, victim);
  await expect(page.getByText(victim, { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(victim, { exact: true })).toHaveCount(0);

  await signOut(page);
  await signIn(page, victim, victimPass);
  await page.getByRole('searchbox', { name: 'Search', exact: true }).fill(repo);
  await page.keyboard.press('Enter');
  await page.getByRole('link', { name: repo, exact: true }).click();
  await expect(page.getByRole('heading', { name: `${victim}/${repo}`, exact: true })).toBeVisible();
});

test('REQ-2-2-4#2: REQ-2-2-4: Remove a Member from an Organization - Scenario 2', async ({ page }) => {
  const viewer = newUsername();
  await registerUser(page, viewer, `${viewer}@example.test`);

  const org = newOrg();
  await signIn(page, seed.alice, seed.alicePass);
  await createOrganization(page, org, org);
  await openPeople(page, org);
  await addOrgMember(page, viewer);
  await addOrgMember(page, seed.member);
  await signOut(page);

  await signIn(page, viewer);
  await openOrganization(page, org);
  await page.getByRole('link', { name: 'People', exact: true }).click();
  await expect(page.getByText(seed.member, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: `Member menu ${seed.member}`, exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(seed.member, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: `Member menu ${seed.member}`, exact: true })).toHaveCount(0);
});

test('REQ-2-3: REQ-2-3: Grant Repository Access to People and Teams - Scenario 1', async ({ page }) => {
  const org = newOrg();
  const team = newTeam();
  const repo = newRepo();

  await signIn(page, seed.alice, seed.alicePass);
  await createOrganization(page, org, org);
  await createTeam(page, org, team);
  await createOrgRepository(page, org, repo);
  await openManageAccess(page);

  await grantTeamAccess(page, team, 'Write');
  let row = page.getByRole('row', { name: new RegExp(team) });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Write');

  await page.reload();
  row = page.getByRole('row', { name: new RegExp(team) });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Write');

  await grantTeamAccess(page, team, 'Write');
  await expect(page.getByRole('row', { name: new RegExp(team) })).toHaveCount(1);
});

test('REQ-2-3#2: REQ-2-3: Grant Repository Access to People and Teams - Scenario 2', async ({ page }) => {
  const org = newOrg();
  const team = newTeam();
  const repo = newRepo();

  await signIn(page, seed.alice, seed.alicePass);
  await createOrganization(page, org, org);
  await createTeam(page, org, team);
  await createOrgRepository(page, org, repo);
  await openManageAccess(page);

  await grantTeamAccess(page, team, 'Write');
  let row = page.getByRole('row', { name: new RegExp(team) });
  await expect(row).toHaveCount(1);

  await row.getByRole('combobox', { name: 'Role', exact: true }).selectOption({ label: 'Read' });
  await row.getByRole('button', { name: 'Save', exact: true }).click();

  row = page.getByRole('row', { name: new RegExp(team) });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Read');

  await page.reload();
  row = page.getByRole('row', { name: new RegExp(team) });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Read');
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });


test('REQ-2-1-2#audit-1: Organization creation validates duplicate/missing and malformed identifiers', async ({ page }) => {
  const org = newOrg();
  await signIn(page, seed.alice, seed.alicePass);
  await createOrganization(page, org, org);

  await openYourOrganizations(page);
  await page.getByRole('link', { name: 'New organization', exact: true }).click();
  await page.getByLabel('Organization name', { exact: true }).fill(org);
  await page.getByLabel('Display name', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();
  await expect(page.getByText('Organization name already exists', { exact: true })).toBeVisible();
  await expect(page.getByText('Display name is required', { exact: true })).toBeVisible();

  await page.getByLabel('Organization name', { exact: true }).fill('-invalid-organization');
  await page.getByLabel('Display name', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();
  await expect(page.getByText('Organization name format is invalid', { exact: true })).toBeVisible();
  await expect(page.getByText('Display name is required', { exact: true })).toBeVisible();
});

test('REQ-2-2-3#audit-1: Add member reports unknown and duplicate accounts', async ({ page }) => {
  const org = newOrg();
  await signIn(page, seed.alice, seed.alicePass);
  await createOrganization(page, org, org);
  await openPeople(page, org);
  await addOrgMember(page, seed.member);

  await page.getByRole('button', { name: 'Add member', exact: true }).first().click();
  await page.getByLabel('Username or email', { exact: true }).fill('unknown-reviewer');
  await chooseOption(page, 'Role', 'Member');
  await page.getByRole('button', { name: 'Add member', exact: true }).last().click();
  await expect(page.getByText('Account not found', { exact: true })).toBeVisible();

  await page.getByLabel('Username or email', { exact: true }).fill(seed.member);
  await page.getByRole('button', { name: 'Add member', exact: true }).last().click();
  await expect(page.getByText('Account is already a member', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: `Member menu ${seed.member}`, exact: true })).toHaveCount(1);
});

test('REQ-2-2-3#audit-2: Ordinary member sees organization but not an ungranted private repository', async ({ page }) => {
  const user = newUsername();
  const org = newOrg();
  const repo = newRepo();
  await registerUser(page, user, `${user}@example.test`);
  await signIn(page, seed.alice, seed.alicePass);
  await createOrganization(page, org, org);
  await createOrgRepository(page, org, repo);
  const repoUrl = page.url();
  await openPeople(page, org);
  await addOrgMember(page, user);
  await signOut(page);
  await signIn(page, user);
  await openYourOrganizations(page);
  await expect(page.getByRole('link', { name: org, exact: true })).toBeVisible();
  await page.goto(repoUrl);
  await expect(page.getByText('Access denied', { exact: true })).toBeVisible();
});

test('REQ-2-3#audit-1: Team member with Write grant opens the private repository', async ({ page }) => {
  const user = newUsername();
  const org = newOrg();
  const team = newTeam();
  const repo = newRepo();
  await registerUser(page, user, `${user}@example.test`);
  await signIn(page, seed.alice, seed.alicePass);
  await createOrganization(page, org, org);
  await createTeam(page, org, team);
  await createOrgRepository(page, org, repo);
  const repoUrl = page.url();
  await openPeople(page, org);
  await addOrgMember(page, user);

  await openTeam(page, org, team);
  await page.getByRole('link', { name: 'Members', exact: true }).click();
  await page.getByRole('button', { name: 'Add member', exact: true }).first().click();
  await page.getByLabel('Username', { exact: true }).fill(user);
  await page.getByRole('button', { name: 'Add member', exact: true }).last().click();
  await expect(page.getByRole('button', { name: `Remove ${user}`, exact: true })).toBeVisible();

  await page.goto(repoUrl);
  await openManageAccess(page);
  await grantTeamAccess(page, team, 'Write');
  await expect(page.getByRole('row', { name: new RegExp(team) })).toContainText('Write');

  await signOut(page);
  await signIn(page, user);
  await page.goto(repoUrl);
  await expect(page.getByRole('heading', { name: `${org}/${repo}`, exact: true })).toBeVisible();
});
