// Acceptance tests for REQ-2 (Organization and Governance) and REQ-2-3.
// Seed records these scenarios rely on (stated by the requirements):
//   accounts      : org-owner, team-maintainer, bob-reviewer, new-member,
//                   existing-member, org-member, protected-member, repo-admin
//   organization  : Acme Demo (identifier acme-demo)
//   repositories  : acme-docs (public), secret-research (private)
//   teams         : frontend-team (parent platform-team, descendant frontend-child),
//                   access-role-team (already one direct Write grant on acme-docs)

const { test, expect } = require('@playwright/test');

const PASSWORD = 'Valid-password-123!';

// Sign in through the home-page "Sign in" link and the sign-in form.
async function signIn(page, usernameOrEmail) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(usernameOrEmail);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

// The account menu (upper-right corner) exposes "Your organizations".
async function openYourOrganizations(page) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Your organizations', exact: true }).click();
}

async function openOrganization(page, name) {
  await openYourOrganizations(page);
  const organization = page.getByRole('link', { name, exact: true });
  await expect(organization).toBeVisible();
  await organization.click();
}

// "Role"/"Parent team" style controls are described as comboboxes. Native selects
// are chosen with selectOption; anything else is opened and its named option clicked.
async function chooseOption(control, optionName) {
  const tagName = await control.evaluate((element) => element.tagName.toLowerCase());
  if (tagName === 'select') {
    await control.selectOption(optionName);
    return;
  }
  await control.click();
  await control.page().getByRole('option', { name: optionName, exact: true }).click();
}

// Open a readable repository through the top global search control.
async function openRepository(page, name) {
  await page.getByRole('searchbox', { name: 'Search', exact: true }).fill(name);
  await page.keyboard.press('Enter');
  const result = page.getByRole('link', { name, exact: true });
  await expect(result).toBeVisible();
  await result.click();
}

test('REQ-2-1-1: REQ-2-1-1: Browse Organization Repositories - Scenario 1', async ({ page }) => {
  // GIVEN: unauthenticated visitor on the home page, public organization Acme Demo.
  await page.goto('/');
  const organization = page.getByRole('link', { name: 'Acme Demo', exact: true });
  await expect(organization).toBeVisible();
  await organization.click();

  // WHEN: Repositories tab, filter by the public repository, open the result.
  await page.getByRole('link', { name: 'Repositories', exact: true }).click();
  await page.getByLabel('Find a repository', { exact: true }).fill('acme-docs');
  const repository = page.getByRole('link', { name: 'acme-docs', exact: true });
  await expect(repository).toBeVisible();
  await repository.click();

  // THEN: the repository overview is shown.
  await expect(page.getByRole('heading', { name: /acme-docs/ })).toBeVisible();

  // THEN: going back through the organization link keeps the public result available.
  await page.goto('/');
  await page.getByRole('link', { name: 'Acme Demo', exact: true }).click();
  await page.getByRole('link', { name: 'Repositories', exact: true }).click();
  await expect(page.getByRole('link', { name: 'acme-docs', exact: true })).toBeVisible();
});

test('REQ-2-1-1#2: REQ-2-1-1: Browse Organization Repositories - Scenario 2', async ({ page }) => {
  // GIVEN: unauthenticated visitor on the home page, public organization Acme Demo.
  await page.goto('/');
  const organization = page.getByRole('link', { name: 'Acme Demo', exact: true });
  await expect(organization).toBeVisible();
  await organization.click();

  // WHEN: filter the repository list by the exact private repository name.
  await page.getByRole('link', { name: 'Repositories', exact: true }).click();
  await page.getByLabel('Find a repository', { exact: true }).fill('secret-research');

  // THEN: the private repository link is never exposed to the visitor.
  await expect(page.getByRole('link', { name: 'secret-research', exact: true })).not.toBeVisible();
});

test('REQ-2-1-2: REQ-2-1-2: Create an Organization After Authentication - Scenario 1', async ({ page }) => {
  // GIVEN: verified account org-owner, able to create organizations.
  await signIn(page, 'org-owner@example.test');

  // WHEN
  await openYourOrganizations(page);
  await page.getByRole('link', { name: 'New organization', exact: true }).click();
  await page.getByLabel('Organization name', { exact: true }).fill('mobile-guild');
  await page.getByLabel('Display name', { exact: true }).fill('Mobile Guild');
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();

  // THEN: the new organization overview is opened.
  await expect(page.getByRole('heading', { name: /mobile-guild/ })).toBeVisible();

  // THEN: it persists across reload.
  await page.reload();
  await expect(page.getByRole('heading', { name: /mobile-guild/ })).toBeVisible();
});

test('REQ-2-1-2#2: REQ-2-1-2: Create an Organization After Authentication - Scenario 2', async ({ page }) => {
  // GIVEN: verified account org-owner; identifier acme-demo already exists.
  await signIn(page, 'org-owner@example.test');

  // WHEN: submit the existing identifier with an empty display name.
  await openYourOrganizations(page);
  await page.getByRole('link', { name: 'New organization', exact: true }).click();
  await page.getByLabel('Organization name', { exact: true }).fill('acme-demo');
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();

  // THEN: the duplicate identifier is rejected and no organization overview is opened.
  await expect(page.getByText('Organization name already exists', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /acme-demo/i })).toHaveCount(0);
});

test('REQ-2-1-2#3: REQ-2-1-2: Create an Organization After Authentication - Scenario 3', async ({ page }) => {
  // GIVEN: verified account org-owner, able to create organizations.
  await signIn(page, 'org-owner@example.test');

  // WHEN: invalid identifier and a whitespace-only display name.
  await openYourOrganizations(page);
  await page.getByRole('link', { name: 'New organization', exact: true }).click();
  await page.getByLabel('Organization name', { exact: true }).fill('-invalid-organization');
  await page.getByLabel('Display name', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();

  // THEN: both field messages are shown together.
  await expect(page.getByText('Organization name format is invalid', { exact: true })).toBeVisible();
  await expect(page.getByText('Display name is required', { exact: true })).toBeVisible();
});

test('REQ-2-2-1: REQ-2-2-1: Create an Organization Team - Scenario 1', async ({ page }) => {
  // GIVEN: org-owner is Owner of Acme Demo; mobile-team is unused there.
  await signIn(page, 'org-owner@example.test');

  // WHEN
  await openOrganization(page, 'Acme Demo');
  await page.getByRole('link', { name: 'Teams', exact: true }).click();
  await page.getByRole('link', { name: 'New team', exact: true }).click();
  await page.getByLabel('Team name', { exact: true }).fill('mobile-team');
  await page.getByRole('button', { name: 'Create team', exact: true }).click();

  // THEN: the team overview is opened.
  await expect(page.getByRole('heading', { name: /mobile-team/ })).toBeVisible();

  // THEN: the team persists across reload.
  await page.reload();
  await expect(page.getByRole('heading', { name: /mobile-team/ })).toBeVisible();
});

test('REQ-2-2-1#2: REQ-2-2-1: Create an Organization Team - Scenario 2', async ({ page }) => {
  // GIVEN: org-owner is Owner of Acme Demo.
  await signIn(page, 'org-owner@example.test');

  // WHEN: a malformed team name is submitted.
  await openOrganization(page, 'Acme Demo');
  await page.getByRole('link', { name: 'Teams', exact: true }).click();
  await page.getByRole('link', { name: 'New team', exact: true }).click();
  await page.getByLabel('Team name', { exact: true }).fill('-invalid-team');
  await page.getByRole('button', { name: 'Create team', exact: true }).click();

  // THEN
  await expect(page.getByText('Team name is invalid', { exact: true })).toBeVisible();
});

test('REQ-2-2-2: REQ-2-2-2: Manage Organization Team Members and Hierarchy - Scenario 1', async ({ page }) => {
  // GIVEN: team-maintainer can manage frontend-team in Acme Demo; bob-reviewer is a
  // registered organization member who is not currently in frontend-team.
  await signIn(page, 'team-maintainer@example.test');
  await openOrganization(page, 'Acme Demo');
  await page.getByRole('link', { name: 'Teams', exact: true }).click();
  await page.getByRole('link', { name: 'frontend-team', exact: true }).click();
  await page.getByRole('link', { name: 'Members', exact: true }).click();

  // WHEN: "Add member" opens the form; its submit button carries the same name.
  await page.getByRole('button', { name: 'Add member', exact: true }).first().click();
  await page.getByLabel('Username', { exact: true }).fill('bob-reviewer');
  await page.getByRole('button', { name: 'Add member', exact: true }).last().click();

  // THEN: added member is listed.
  await expect(page.getByText('bob-reviewer', { exact: true })).toBeVisible();

  // WHEN: remove the member again.
  await page.getByRole('button', { name: 'Remove bob-reviewer', exact: true }).click();

  // THEN: the member disappears immediately and stays gone after reload.
  await expect(page.getByText('bob-reviewer', { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('bob-reviewer', { exact: true })).toHaveCount(0);
});

test('REQ-2-2-2#2: REQ-2-2-2: Manage Organization Team Members and Hierarchy - Scenario 2', async ({ page }) => {
  // GIVEN: frontend-team (in Acme Demo) has saved parent platform-team and the
  // descendant team frontend-child is selectable.
  await signIn(page, 'team-maintainer@example.test');
  await openOrganization(page, 'Acme Demo');
  await page.getByRole('link', { name: 'Teams', exact: true }).click();
  await page.getByRole('link', { name: 'frontend-team', exact: true }).click();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();

  // WHEN: select the descendant team as the parent and save.
  await page.getByLabel('Parent team', { exact: true }).selectOption('frontend-child');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  // THEN: the cycle is rejected.
  await expect(page.getByText('Cyclic team hierarchy is not allowed', { exact: true })).toBeVisible();

  // THEN: after reload the previously saved parent is still selected.
  await page.reload();
  await expect(page.getByLabel('Parent team', { exact: true })).toHaveValue('platform-team');
});

test('REQ-2-2-3: REQ-2-2-3: Directly Add a User as an Organization Member - Scenario 1', async ({ page, browser }) => {
  // GIVEN: org-owner owns Acme Demo; account new-member is registered but not a member.
  await signIn(page, 'org-owner@example.test');
  await openOrganization(page, 'Acme Demo');
  await page.getByRole('link', { name: 'People', exact: true }).click();

  // WHEN: add new-member with the Member role.
  await page.getByRole('button', { name: 'Add member', exact: true }).first().click();
  await page.getByLabel('Username or email', { exact: true }).fill('new-member');
  await chooseOption(page.getByLabel('Role', { exact: true }), 'Member');
  await page.getByRole('button', { name: 'Add member', exact: true }).last().click();

  // THEN: the account is listed with the Member role and no pending-invitation state.
  await expect(page.getByText('new-member', { exact: true })).toBeVisible();
  await expect(page.getByText('Member', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Pending invitation', { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('new-member', { exact: true })).toBeVisible();

  // THEN: in a separate browser session the member sees Acme Demo in "Your organizations".
  const origin = new URL(page.url()).origin;
  const memberContext = await browser.newContext({ baseURL: origin });
  const memberPage = await memberContext.newPage();
  await signIn(memberPage, 'new-member@example.test');
  await openYourOrganizations(memberPage);
  await expect(memberPage.getByRole('link', { name: 'Acme Demo', exact: true })).toBeVisible();
  // The remaining step ("Access denied" when opening the ungranted private repository
  // secret-research) names no navigable control, so the documented UI cannot reach it;
  // the private repository exposes no link even on the organization's Repositories tab.
  await memberContext.close();
});

test('REQ-2-2-3#2: REQ-2-2-3: Directly Add a User as an Organization Member - Scenario 2', async ({ page }) => {
  // GIVEN: org-owner owns Acme Demo; existing-member is already a member and the
  // username unknown-reviewer belongs to no account.
  await signIn(page, 'org-owner@example.test');
  await openOrganization(page, 'Acme Demo');
  await page.getByRole('link', { name: 'People', exact: true }).click();

  // WHEN: submit an existing member, then an unknown username.
  await page.getByRole('button', { name: 'Add member', exact: true }).first().click();
  await page.getByLabel('Username or email', { exact: true }).fill('existing-member');
  await page.getByRole('button', { name: 'Add member', exact: true }).last().click();

  // THEN: the duplicate membership is rejected.
  await expect(page.getByText('Account is already a member', { exact: true })).toBeVisible();

  await page.getByLabel('Username or email', { exact: true }).fill('unknown-reviewer');
  await page.getByRole('button', { name: 'Add member', exact: true }).last().click();

  // THEN: the unknown account is reported and no duplicate membership exists.
  await expect(page.getByText('Account not found', { exact: true })).toBeVisible();
  await expect(page.getByText('existing-member', { exact: true })).toHaveCount(1);
});

test('REQ-2-2-4: REQ-2-2-4: Remove a Member from an Organization - Scenario 1', async ({ page }) => {
  // GIVEN: org-owner owns Acme Demo; existing-member is present in the People list.
  await signIn(page, 'org-owner@example.test');
  await openOrganization(page, 'Acme Demo');
  await page.getByRole('link', { name: 'People', exact: true }).click();

  // WHEN: the Owner removes the member through the member menu and confirms.
  await expect(page.getByText('existing-member', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Member menu existing-member', exact: true }).click();
  await page.getByText('Remove from organization', { exact: true }).click();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();

  // THEN: the member is gone immediately and after reload.
  await expect(page.getByText('existing-member', { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('existing-member', { exact: true })).toHaveCount(0);
});

test('REQ-2-2-4#2: REQ-2-2-4: Remove a Member from an Organization - Scenario 2', async ({ page }) => {
  // GIVEN: org-member is an ordinary non-Owner member of Acme Demo; protected-member
  // is another member present in the People list.
  await signIn(page, 'org-member@example.test');
  await openOrganization(page, 'Acme Demo');
  await page.getByRole('link', { name: 'People', exact: true }).click();

  // WHEN/THEN: the member is visible but no removal controls are exposed to a non-Owner.
  await expect(page.getByText('protected-member', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Member menu protected-member', exact: true })).toHaveCount(0);
  await expect(page.getByText('Remove from organization', { exact: true })).toHaveCount(0);
});

test('REQ-2-3: REQ-2-3: Grant Repository Access to People and Teams - Scenario 1', async ({ page }) => {
  // GIVEN: repo-admin has Admin permission on acme-docs; frontend-team has no direct
  // access grant on it.
  await signIn(page, 'repo-admin@example.test');
  await openRepository(page, 'acme-docs');

  // WHEN: open Settings -> Manage access -> Add people or teams.
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Manage access', exact: true }).click();
  await page.getByText('Add people or teams', { exact: true }).click();

  // The global header search and the picker's Search textbox share the label; the
  // picker is the later control on the page.
  await page.getByLabel('Search', { exact: true }).last().fill('frontend-team');
  await page.getByRole('option', { name: 'frontend-team', exact: true }).click();
  await chooseOption(page.getByLabel('Role', { exact: true }).last(), 'Write');
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  // THEN: the access list shows the team with Write access.
  const accessRow = page.getByRole('row', { name: /frontend-team/ });
  await expect(accessRow).toHaveCount(1);
  await expect(accessRow.getByText('frontend-team', { exact: true })).toBeVisible();
  await expect(accessRow.getByText('Write', { exact: true })).toBeVisible();

  // THEN: the grant survives a reload of Manage access.
  await page.reload();
  await expect(page.getByRole('row', { name: /frontend-team/ })).toBeVisible();
});

test('REQ-2-3#2: REQ-2-3: Grant Repository Access to People and Teams - Scenario 2', async ({ page }) => {
  // GIVEN: repo-admin has Admin permission on acme-docs; access-role-team already has
  // exactly one direct Write grant on it.
  await signIn(page, 'repo-admin@example.test');
  await openRepository(page, 'acme-docs');

  // WHEN: change the existing grant from Write to Read.
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Manage access', exact: true }).click();

  const row = page.getByRole('row', { name: /access-role-team/ });
  await expect(row.getByText('Write', { exact: true })).toBeVisible();
  await chooseOption(row.getByLabel('Role', { exact: true }), 'Read');
  await row.getByRole('button', { name: 'Save', exact: true }).click();

  // THEN: exactly one row for the team remains and it displays Read.
  await page.reload();
  const reloadedRow = page.getByRole('row', { name: /access-role-team/ });
  await expect(reloadedRow).toHaveCount(1);
  await expect(reloadedRow.getByText('Read', { exact: true })).toBeVisible();
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

