const { test, expect } = require('@playwright/test');

const PASSWORD = 'Valid-password-123!';
const ORG = 'Acme Demo';
const REPO = 'acme-docs';
const TEAM = 'frontend-team';
const MEMBER = 'bob-reviewer';

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const headingLike = (page, text) =>
  page.getByRole('heading', { name: new RegExp(escapeRe(text)) }).first();

async function signIn(page, usernameOrEmail, password = PASSWORD) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(usernameOrEmail);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function registerAccount(page, username, email) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password', { exact: true }).fill(PASSWORD);
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
}

async function newSession(browser, page) {
  const origin = new URL(page.url()).origin;
  const context = await browser.newContext({ baseURL: origin });
  return { context, page: await context.newPage() };
}

async function chooseOption(page, control, label) {
  try {
    await control.selectOption({ label });
    return;
  } catch (err) {
    // not a native select: fall through to the clickable-option behaviour
  }
  await control.click();
  await page.getByRole('option', { name: label, exact: true }).first().click();
}

async function openOrganizations(page) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Your organizations', exact: true }).click();
}

async function openOrganization(page, name = ORG) {
  await openOrganizations(page);
  await page.getByRole('link', { name, exact: true }).first().click();
}

async function createTeam(page, name) {
  await openOrganization(page);
  await page.getByRole('link', { name: 'Teams', exact: true }).click();
  await page.getByRole('link', { name: 'New team', exact: true }).click();
  await page.getByLabel('Team name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Create team', exact: true }).click();
}

async function addOrganizationMember(page, username, role = 'Member') {
  await page.getByRole('button', { name: 'Add member', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await chooseOption(page, page.getByRole('combobox', { name: 'Role', exact: true }), role);
  await page.getByRole('button', { name: 'Add member', exact: true }).click();
}

async function openRepository(page, name) {
  const search = page.getByRole('searchbox', { name: 'Search', exact: true });
  await search.fill(name);
  await search.press('Enter');
  await page.getByRole('link', { name, exact: true }).first().click();
}

async function clickVisibilityFilter(page, label) {
  for (const role of ['link', 'button']) {
    const control = page.getByRole(role, { name: label, exact: true });
    if ((await control.count()) > 0) {
      await control.first().click();
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// REQ-2-1-1 Browse Organization Repositories
// ---------------------------------------------------------------------------

test('REQ-2-1-1: REQ-2-1-1: Browse Organization Repositories - Scenario 1', async ({ page }) => {
  await signIn(page, 'alice-dev');
  await openOrganization(page);
  await page.getByRole('link', { name: 'Repositories', exact: true }).click();

  await page.getByLabel('Find a repository', { exact: true }).fill(REPO);
  await clickVisibilityFilter(page, 'Public');
  await expect(page.getByRole('link', { name: REPO, exact: true }).first()).toBeVisible();

  await page.getByRole('link', { name: REPO, exact: true }).first().click();
  await expect(headingLike(page, ORG + '/' + REPO)).toBeVisible();

  await page.goBack();
  await expect(page.getByRole('link', { name: REPO, exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('link', { name: REPO, exact: true }).first()).toBeVisible();
});

test('REQ-2-1-1#2: REQ-2-1-1: Browse Organization Repositories - Scenario 2', async ({ page }) => {
  await signIn(page, 'alice-dev');
  await openOrganization(page);
  await expect(headingLike(page, ORG)).toBeVisible();

  await page.getByRole('link', { name: 'Repositories', exact: true }).click();
  await expect(page.getByLabel('Find a repository', { exact: true })).toBeVisible();

  await page.getByLabel('Find a repository', { exact: true }).fill(REPO);
  await page.getByRole('link', { name: REPO, exact: true }).first().click();
  await expect(headingLike(page, ORG + '/' + REPO)).toBeVisible();

  await page.reload();
  await expect(headingLike(page, ORG + '/' + REPO)).toBeVisible();
});

// ---------------------------------------------------------------------------
// REQ-2-1-2 Create an Organization After Authentication
// ---------------------------------------------------------------------------

test('REQ-2-1-2: REQ-2-1-2: Create an Organization After Authentication - Scenario 1', async ({ page }) => {
  await signIn(page, 'alice-dev');
  await openOrganizations(page);
  await page.getByRole('link', { name: 'New organization', exact: true }).click();

  await page.getByLabel('Organization name', { exact: true }).fill('mobile-guild');
  await page.getByLabel('Display name', { exact: true }).fill('Mobile Guild');
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();
  await expect(headingLike(page, 'mobile-guild')).toBeVisible();

  await openOrganizations(page);
  await expect(page.getByText('mobile-guild', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('mobile-guild', { exact: true }).first()).toBeVisible();
});

test('REQ-2-1-2#2: REQ-2-1-2: Create an Organization After Authentication - Scenario 2', async ({ page }) => {
  const name = 'pw-org-' + u();
  await signIn(page, 'alice-dev');
  await openOrganizations(page);
  await page.getByRole('link', { name: 'New organization', exact: true }).click();

  await page.getByLabel('Organization name', { exact: true }).fill('-invalid-organization');
  await page.getByLabel('Display name', { exact: true }).fill('Invalid Org');
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();
  await expect(page.getByText('Organization name format is invalid', { exact: true })).toBeVisible();

  await page.getByLabel('Organization name', { exact: true }).fill(name);
  await page.getByLabel('Display name', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();
  await expect(page.getByText('Display name is required', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Organization name', { exact: true })).toHaveValue(name);

  await page.getByLabel('Display name', { exact: true }).fill('Valid Display Name');
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();
  await expect(headingLike(page, name)).toBeVisible();

  await openOrganizations(page);
  await page.getByRole('link', { name: 'New organization', exact: true }).click();
  await page.getByLabel('Organization name', { exact: true }).fill(name);
  await page.getByLabel('Display name', { exact: true }).fill('Duplicate Org');
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();
  await expect(page.getByText('Organization name already exists', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Organization name', { exact: true })).toHaveValue(name);
  await expect(page.getByLabel('Display name', { exact: true })).toHaveValue('Duplicate Org');
});

test('REQ-2-1-2#3: REQ-2-1-2: Create an Organization After Authentication - Scenario 3', async ({ page }) => {
  const name = 'pw-org-' + u();
  await signIn(page, 'alice-dev');
  await openOrganizations(page);
  await page.getByRole('link', { name: 'New organization', exact: true }).click();

  await page.getByLabel('Organization name', { exact: true }).fill(name);
  await page.getByLabel('Display name', { exact: true }).fill('Playwright Org');
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();
  await expect(headingLike(page, name)).toBeVisible();

  await page.getByRole('link', { name: 'People', exact: true }).click();
  await expect(page.getByText('alice-dev', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Owner', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('alice-dev', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Owner', { exact: true }).first()).toBeVisible();
});

// ---------------------------------------------------------------------------
// REQ-2-2-1 Create an Organization Team
// ---------------------------------------------------------------------------

test('REQ-2-2-1: REQ-2-2-1: Create an Organization Team - Scenario 1', async ({ page }) => {
  await signIn(page, 'alice-dev');
  await openOrganization(page);
  await page.getByRole('link', { name: 'Teams', exact: true }).click();
  await page.getByRole('link', { name: 'New team', exact: true }).click();

  await page.getByLabel('Team name', { exact: true }).fill('mobile-team');
  const parent = page.getByLabel('Parent team', { exact: true });
  if ((await parent.count()) > 0) {
    await chooseOption(page, parent.first(), TEAM);
  }
  await page.getByRole('button', { name: 'Create team', exact: true }).click();
  await expect(headingLike(page, ORG + '/mobile-team')).toBeVisible();

  await page.reload();
  await expect(headingLike(page, ORG + '/mobile-team')).toBeVisible();

  await openOrganization(page);
  await page.getByRole('link', { name: 'Teams', exact: true }).click();
  await expect(page.getByRole('link', { name: 'mobile-team', exact: true }).first()).toBeVisible();

  await page.getByRole('link', { name: 'New team', exact: true }).click();
  await page.getByLabel('Team name', { exact: true }).fill('-invalid-team');
  await page.getByRole('button', { name: 'Create team', exact: true }).click();
  await expect(page.getByText('Team name format is invalid', { exact: true })).toBeVisible();
});

test('REQ-2-2-1#2: REQ-2-2-1: Create an Organization Team - Scenario 2', async ({ page }) => {
  const team = 'pw-team-' + u();
  await signIn(page, 'alice-dev');
  await createTeam(page, team);
  await expect(headingLike(page, ORG + '/' + team)).toBeVisible();

  await page.reload();
  await expect(headingLike(page, ORG + '/' + team)).toBeVisible();

  await openOrganization(page);
  await page.getByRole('link', { name: 'Teams', exact: true }).click();
  await expect(page.getByRole('link', { name: team, exact: true }).first()).toBeVisible();
});

// ---------------------------------------------------------------------------
// REQ-2-2-2 Manage Organization Team Members and Hierarchy
// ---------------------------------------------------------------------------

test('REQ-2-2-2: REQ-2-2-2: Manage Organization Team Members and Hierarchy - Scenario 1', async ({ page }) => {
  const parentName = 'pw-parent-' + u();
  await signIn(page, 'alice-dev');
  await createTeam(page, parentName);
  await expect(headingLike(page, ORG + '/' + parentName)).toBeVisible();

  await openOrganization(page);
  await page.getByRole('link', { name: 'Teams', exact: true }).click();
  await page.getByRole('link', { name: TEAM, exact: true }).first().click();

  await page.getByRole('link', { name: 'Members', exact: true }).click();
  await page.getByRole('button', { name: 'Add member', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(MEMBER);
  await page.getByRole('button', { name: 'Add member', exact: true }).click();
  await expect(page.getByText(MEMBER, { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove ' + MEMBER, exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await chooseOption(page, page.getByLabel('Parent team', { exact: true }).first(), parentName);
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await page.getByRole('link', { name: 'Members', exact: true }).click();
  await page.getByRole('button', { name: 'Remove ' + MEMBER, exact: true }).click();
  await expect(page.getByText(MEMBER, { exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByText(MEMBER, { exact: true })).toHaveCount(0);
});

test('REQ-2-2-2#2: REQ-2-2-2: Manage Organization Team Members and Hierarchy - Scenario 2', async ({ page }) => {
  const parentName = 'pw-parent-' + u();
  const childName = 'pw-child-' + u();
  await signIn(page, 'alice-dev');

  await createTeam(page, parentName);
  await expect(headingLike(page, ORG + '/' + parentName)).toBeVisible();

  await createTeam(page, childName);
  await expect(headingLike(page, ORG + '/' + childName)).toBeVisible();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await chooseOption(page, page.getByLabel('Parent team', { exact: true }).first(), parentName);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('option', { name: parentName, selected: true })).toBeAttached();

  await openOrganization(page);
  await page.getByRole('link', { name: 'Teams', exact: true }).click();
  await page.getByRole('link', { name: parentName, exact: true }).first().click();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await chooseOption(page, page.getByLabel('Parent team', { exact: true }).first(), childName);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Cyclic team hierarchy is not allowed', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText('Cyclic team hierarchy is not allowed', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('option', { name: childName, selected: true })).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// REQ-2-2-3 Directly Add a User as an Organization Member
// ---------------------------------------------------------------------------

test('REQ-2-2-3: REQ-2-2-3: Directly Add a User as an Organization Member - Scenario 1', async ({ page, browser }) => {
  const username = 'pw-member-' + u();
  await registerAccount(page, username, username + '@example.test');

  await signIn(page, 'alice-dev');
  await openOrganization(page);
  await page.getByRole('link', { name: 'People', exact: true }).click();
  await addOrganizationMember(page, username, 'Member');

  await expect(page.getByText(username, { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Member', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Pending', { exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByText(username, { exact: true }).first()).toBeVisible();

  const { context, page: memberPage } = await newSession(browser, page);
  await signIn(memberPage, username, PASSWORD);
  await openOrganizations(memberPage);
  await expect(memberPage.getByText(ORG, { exact: true }).first()).toBeVisible();
  await context.close();
});

test('REQ-2-2-3#2: REQ-2-2-3: Directly Add a User as an Organization Member - Scenario 2', async ({ page }) => {
  await signIn(page, 'alice-dev');
  await openOrganization(page);
  await page.getByRole('link', { name: 'People', exact: true }).click();

  await page.getByRole('button', { name: 'Add member', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill('unknown-reviewer');
  await chooseOption(page, page.getByRole('combobox', { name: 'Role', exact: true }), 'Member');
  await page.getByRole('button', { name: 'Add member', exact: true }).click();
  await expect(page.getByText('Account not found', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Username or email', { exact: true })).toBeVisible();

  await page.getByLabel('Username or email', { exact: true }).fill(MEMBER);
  await page.getByRole('button', { name: 'Add member', exact: true }).click();
  await expect(page.getByText('Account is already a member', { exact: true })).toBeVisible();
  await expect(page.getByText(MEMBER, { exact: true })).toHaveCount(1);
});

// ---------------------------------------------------------------------------
// REQ-2-2-4 Remove a Member from an Organization
// ---------------------------------------------------------------------------

test('REQ-2-2-4: REQ-2-2-4: Remove a Member from an Organization - Scenario 1', async ({ page, browser }) => {
  const username = 'pw-member-' + u();
  await registerAccount(page, username, username + '@example.test');

  await signIn(page, 'alice-dev');
  await openOrganization(page);
  await page.getByRole('link', { name: 'People', exact: true }).click();
  await addOrganizationMember(page, username, 'Member');
  await expect(page.getByText(username, { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Member menu ' + username, exact: true }).click();
  await page.getByRole('menuitem', { name: 'Remove from organization', exact: true }).click();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();

  await expect(page.getByText(username, { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(username, { exact: true })).toHaveCount(0);

  const { context, page: memberPage } = await newSession(browser, page);
  await signIn(memberPage, username, PASSWORD);
  await expect(memberPage.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
  await openOrganizations(memberPage);
  await expect(memberPage.getByText(ORG, { exact: true })).toHaveCount(0);
  await context.close();
});

test('REQ-2-2-4#2: REQ-2-2-4: Remove a Member from an Organization - Scenario 2', async ({ page, browser }) => {
  const username = 'pw-member-' + u();
  await registerAccount(page, username, username + '@example.test');

  await signIn(page, 'alice-dev');
  await openOrganization(page);
  await page.getByRole('link', { name: 'People', exact: true }).click();
  await addOrganizationMember(page, username, 'Member');
  await expect(page.getByText(username, { exact: true }).first()).toBeVisible();

  const { context, page: memberPage } = await newSession(browser, page);
  await signIn(memberPage, username, PASSWORD);
  await openOrganization(memberPage);
  await memberPage.getByRole('link', { name: 'People', exact: true }).click();

  await expect(memberPage.getByText(username, { exact: true }).first()).toBeVisible();
  await expect(memberPage.getByRole('button', { name: 'Member menu ' + username, exact: true })).toHaveCount(0);
  await expect(memberPage.getByRole('menuitem', { name: 'Remove from organization', exact: true })).toHaveCount(0);

  await memberPage.reload();
  await expect(memberPage.getByText(username, { exact: true }).first()).toBeVisible();
  await context.close();
});

// ---------------------------------------------------------------------------
// REQ-2-3 Grant Repository Access to People and Teams
// ---------------------------------------------------------------------------

test('REQ-2-3: REQ-2-3: Grant Repository Access to People and Teams - Scenario 1', async ({ page }) => {
  await signIn(page, 'alice-dev');
  await openRepository(page, REPO);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Manage access', exact: true }).click();

  await page.getByRole('button', { name: 'Add people or teams', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search', exact: true }).fill(MEMBER);
  await page.getByRole('option', { name: new RegExp(escapeRe(MEMBER)) }).first().click();
  await chooseOption(page, page.getByRole('combobox', { name: 'Role', exact: true }), 'Write');
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  await expect(page.getByText(MEMBER, { exact: true })).toHaveCount(1);
  await expect(page.getByRole('option', { name: 'Write', selected: true })).toBeAttached();

  await page.reload();
  await expect(page.getByText(MEMBER, { exact: true })).toHaveCount(1);

  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(MEMBER, { exact: true })).toHaveCount(1);
});

test('REQ-2-3#2: REQ-2-3: Grant Repository Access to People and Teams - Scenario 2', async ({ page }) => {
  await signIn(page, 'alice-dev');
  await openRepository(page, REPO);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Manage access', exact: true }).click();

  await page.getByRole('button', { name: 'Add people or teams', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search', exact: true }).fill(TEAM);
  await page.getByRole('option', { name: new RegExp(escapeRe(TEAM)) }).first().click();
  await chooseOption(page, page.getByRole('combobox', { name: 'Role', exact: true }), 'Write');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText(TEAM, { exact: true })).toHaveCount(1);
  await expect(page.getByRole('option', { name: 'Write', selected: true })).toBeAttached();

  await chooseOption(page, page.getByLabel('Role', { exact: true }), 'Read');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(TEAM, { exact: true })).toHaveCount(1);
  await expect(page.getByRole('option', { name: 'Read', selected: true })).toBeAttached();

  await page.reload();
  await expect(page.getByText(TEAM, { exact: true })).toHaveCount(1);
  await expect(page.getByRole('option', { name: 'Read', selected: true })).toBeAttached();
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

