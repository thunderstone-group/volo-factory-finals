// REQ-2-2-2 Manage Organization Team Members and Hierarchy (orders 23-24).
// Seeds used: team frontend-team (parent platform-team, descendant frontend-child) in "Acme Demo",
// organization member bob-reviewer who is not in frontend-team. The maintainer is the Owner alice-dev.
// S1 adds and then removes bob-reviewer, so the seed team ends unchanged; S2's change is rejected.
const { test, expect } = require('@playwright/test');

const SEED_USER = 'alice-dev';
const PASSWORD = 'Valid-password-123!';
const ORG = 'Acme Demo';
const TEAM = 'frontend-team';
const MEMBER = 'bob-reviewer';
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

async function openTeamPage(page, team) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Your organizations', exact: true }).click();
  await page.getByRole('link', { name: ORG }).click();
  await page.getByRole('link', { name: 'Teams', exact: true }).click();
  await page.getByRole('link', { name: team, exact: true }).click();
  await expect(page.getByRole('heading', { name: team })).toBeVisible();
}

// the option currently shown by a native select, by label or stored value
async function selectedParent(select) {
  return select.evaluate((el) => {
    const opt = el.options[el.selectedIndex];
    return opt ? `${opt.label.trim()}|${el.value}` : '';
  });
}

test('REQ-2-2-2: Manage Organization Team Members and Hierarchy - Scenario 1', async ({ page }) => {
  await signIn(page, SEED_USER, PASSWORD, SEED_USER);
  await openTeamPage(page, TEAM);
  await page.getByRole('link', { name: 'Members', exact: true }).click();
  await page.getByRole('button', { name: 'Add member', exact: true }).click();
  await field(page, 'Username').fill(MEMBER);
  // only the current step's "Add member" is actionable now
  await page.getByRole('button', { name: 'Add member', exact: true }).click();

  const memberText = page.getByText(MEMBER, { exact: true });
  await expect(memberText).toHaveCount(1);
  await expect(memberText).toBeVisible();
  const remove = page.getByRole('button', { name: `Remove ${MEMBER}`, exact: true });
  await expect(remove).toBeVisible();

  // removal is immediate, no confirmation step
  await remove.click();
  await expect(page.getByRole('button', { name: `Remove ${MEMBER}`, exact: true })).toHaveCount(0);
  await expect(page.getByText(MEMBER, { exact: true })).toHaveCount(0);

  await page.reload();
  await page.getByRole('link', { name: 'Members', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add member', exact: true })).toBeVisible();
  await expect(page.getByText(MEMBER, { exact: true })).toHaveCount(0);
});

test('REQ-2-2-2: Manage Organization Team Members and Hierarchy - Scenario 2', async ({ page }) => {
  await signIn(page, SEED_USER, PASSWORD, SEED_USER);
  await openTeamPage(page, TEAM);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  const parent = page.getByRole('combobox', { name: 'Parent team', exact: true });
  await expect.poll(() => selectedParent(parent)).toMatch(/(^|\|)platform-team(\||$)/);

  // choose a descendant as the new parent
  await parent.selectOption({ label: 'frontend-child' });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Cyclic team hierarchy is not allowed')).toBeVisible();

  // after reload the original parent is still selected
  await page.reload();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  const parentAfter = page.getByRole('combobox', { name: 'Parent team', exact: true });
  await expect(parentAfter).toBeVisible();
  await expect.poll(() => selectedParent(parentAfter)).toMatch(/(^|\|)platform-team(\||$)/);
});
