// REQ-2-3 Grant Repository Access to People and Teams (orders 29-30).
// Each test creates its own team in "Acme Demo" (so the team surely has no grant yet and seed teams keep
// their permissions) and manages its access on the organization repository acme-docs as the Owner alice-dev.
const { test, expect } = require('@playwright/test');

const SEED_USER = 'alice-dev';
const PASSWORD = 'Valid-password-123!';
const ORG = 'Acme Demo';
const REPO = 'acme-docs';
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const asWord = (s) => new RegExp(`(^|\\s)${esc(s)}(\\s|$)`);

const field = (page, name) => page.getByRole('textbox', { name, exact: true });

async function signIn(page, login, password, username) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await field(page, 'Username or email').fill(login);
  await field(page, 'Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
  await expect(page.getByText(asWord(username)).filter({ visible: true })).not.toHaveCount(0);
}

async function openOrganization(page) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Your organizations', exact: true }).click();
  await page.getByRole('link', { name: ORG }).click();
}

async function createTeam(page, team) {
  await openOrganization(page);
  await page.getByRole('link', { name: 'Teams', exact: true }).click();
  await page.getByRole('link', { name: 'New team', exact: true }).click();
  await field(page, 'Team name').fill(team);
  await page.getByRole('button', { name: 'Create team', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Create team', exact: true })).toHaveCount(0);
}

async function openManageAccess(page) {
  await openOrganization(page);
  await page.getByRole('link', { name: 'Repositories', exact: true }).click();
  await page.getByRole('link', { name: REPO, exact: true }).click();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Manage access', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add people or teams', exact: true })).toBeVisible();
}

// Existing grant rows carry their own native "Role" select; the picker's controls are the ones outside rows
// and outside native selects.
const outsideRows = (page, loc) => loc.and(page.locator(':not(tr *):not([role="row"] *)'));
const outsideSelects = (page, loc) => loc.and(page.locator(':not(select *)'));

async function grantTeam(page, team, role) {
  await page.getByRole('button', { name: 'Add people or teams', exact: true }).click();
  // while the picker is active the opener is hidden, so the submit action is unambiguous
  await expect(page.getByRole('button', { name: 'Add people or teams', exact: true })).toBeHidden();
  await field(page, 'Search').fill(team);
  await outsideSelects(page, page.getByRole('option', { name: team })).click();
  // "a combobox Role with clickable role options"
  await outsideRows(page, page.getByRole('combobox', { name: 'Role', exact: true })).click();
  await outsideSelects(page, page.getByRole('option', { name: role, exact: true })).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
}

const grantRows = (page, team) => page.getByRole('row', { name: team });
const selectedRole = (row) => row.getByRole('combobox', { name: 'Role', exact: true }).locator('option:checked');

test('REQ-2-3: Grant Repository Access to People and Teams - Scenario 1', async ({ page }) => {
  const team = `grant-team-${uid()}`;
  await signIn(page, SEED_USER, PASSWORD, SEED_USER);
  await createTeam(page, team);
  await openManageAccess(page);
  await grantTeam(page, team, 'Write');

  // exactly one Write record for the team, still there after reload
  await expect(grantRows(page, team)).toHaveCount(1);
  await expect(selectedRole(grantRows(page, team))).toHaveText('Write');
  await page.reload();
  await expect(grantRows(page, team)).toHaveCount(1);
  await expect(selectedRole(grantRows(page, team))).toHaveText('Write');
});

test('REQ-2-3: Grant Repository Access to People and Teams - Scenario 2', async ({ page }) => {
  const team = `role-team-${uid()}`;
  await signIn(page, SEED_USER, PASSWORD, SEED_USER);
  await createTeam(page, team);
  await openManageAccess(page);
  // precondition: a saved Write grant for the team
  await grantTeam(page, team, 'Write');
  await expect(grantRows(page, team)).toHaveCount(1);
  await expect(selectedRole(grantRows(page, team))).toHaveText('Write');

  // change the existing grant to Read and save
  const row = grantRows(page, team);
  await row.getByRole('combobox', { name: 'Role', exact: true }).selectOption({ label: 'Read' });
  await row.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(selectedRole(grantRows(page, team))).toHaveText('Read');

  // after reload: one row for the team, holding Read
  await page.reload();
  await expect(grantRows(page, team)).toHaveCount(1);
  await expect(selectedRole(grantRows(page, team))).toHaveText('Read');
});
