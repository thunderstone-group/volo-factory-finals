// REQ-2-2-1 Create an Organization Team (orders 21-22).
// Assumptions: alice-dev is the seeded Owner of "Acme Demo"; the organization is opened from
// account menu > "Your organizations" > the "Acme Demo" link. New team names carry a unique suffix.
const { test, expect } = require('@playwright/test');

const SEED_USER = 'alice-dev';
const PASSWORD = 'Valid-password-123!';
const ORG = 'Acme Demo';
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
  await expect(page.getByRole('link', { name: 'Teams', exact: true })).toBeVisible();
}

async function openTeams(page) {
  await openOrganization(page);
  await page.getByRole('link', { name: 'Teams', exact: true }).click();
  await expect(page.getByRole('link', { name: 'New team', exact: true })).toBeVisible();
}

async function submitNewTeam(page, name) {
  await page.getByRole('link', { name: 'New team', exact: true }).click();
  await field(page, 'Team name').fill(name);
  await page.getByRole('button', { name: 'Create team', exact: true }).click();
}

test('REQ-2-2-1: Create an Organization Team - Scenario 1', async ({ page }) => {
  const team = `mobile-team-${uid()}`;
  await signIn(page, SEED_USER, PASSWORD, SEED_USER);
  await openTeams(page);
  await submitNewTeam(page, team);

  // team page heading "organization name/team name", kept after reload
  await expect(page.getByRole('heading', { name: team })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: team })).toBeVisible();

  // the organization's Teams list still contains it after reopening
  await openTeams(page);
  await expect(page.getByRole('link', { name: team, exact: true })).toBeVisible();
});

test('REQ-2-2-1: Create an Organization Team - Scenario 2', async ({ page }) => {
  const badName = `-bad-team-${uid()}`;
  await signIn(page, SEED_USER, PASSWORD, SEED_USER);
  await openTeams(page);

  // malformed name
  await submitNewTeam(page, badName);
  await expect(page.getByText('Team name format is invalid')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create team', exact: true })).toBeVisible();

  // duplicate of the seeded team
  await field(page, 'Team name').fill('frontend-team');
  await page.getByRole('button', { name: 'Create team', exact: true }).click();
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('button', { name: 'Create team', exact: true })).toBeVisible();

  // the Teams list holds no malformed team and still exactly one frontend-team
  await openTeams(page);
  await expect(page.getByRole('link', { name: 'frontend-team', exact: true })).toHaveCount(1);
  await expect(page.getByText(badName.slice(1))).toHaveCount(0);
});
