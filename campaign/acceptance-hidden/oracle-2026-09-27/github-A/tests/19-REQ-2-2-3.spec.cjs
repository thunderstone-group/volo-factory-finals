// REQ-2-2-3 Directly Add a User as an Organization Member (orders 25-26).
// The registered non-member is created through the registration page in its own browser session,
// so seed memberships stay untouched. Owner: alice-dev on "Acme Demo"; existing member: bob-reviewer.
const { test, expect } = require('@playwright/test');

const SEED_USER = 'alice-dev';
const PASSWORD = 'Valid-password-123!';
const ORG = 'Acme Demo';
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const asWord = (s) => new RegExp(`(^|\\s)${esc(s)}(\\s|$)`);

const field = (page, name) => page.getByRole('textbox', { name, exact: true });
// Rows of the People list may carry their own controls; the add form's Role combobox and its clickable
// options are the ones outside rows and outside native selects.
const outsideRows = (page, loc) => loc.and(page.locator(':not(tr *):not([role="row"] *)'));
const outsideSelects = (page, loc) => loc.and(page.locator(':not(select *)'));

async function submitSignIn(page, login, password) {
  await field(page, 'Username or email').fill(login);
  await field(page, 'Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function expectSignedIn(page, username) {
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
  await expect(page.getByText(asWord(username)).filter({ visible: true })).not.toHaveCount(0);
}

async function signIn(page, login, password, username) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await submitSignIn(page, login, password);
  await expectSignedIn(page, username);
}

// register a fresh account; the page is left on the sign-in form
async function registerAccount(page) {
  const username = `pw-member-${uid()}`;
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await field(page, 'Username').fill(username);
  await field(page, 'Email').fill(`${username}@example.test`);
  await field(page, 'Password').fill(PASSWORD);
  await field(page, 'Confirm password').fill(PASSWORD);
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(field(page, 'Username or email')).toBeVisible();
  return username;
}

async function openYourOrganizations(page) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Your organizations', exact: true }).click();
}

async function openPeople(page) {
  await openYourOrganizations(page);
  await page.getByRole('link', { name: ORG }).click();
  await page.getByRole('link', { name: 'People', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add member', exact: true })).toBeVisible();
}

async function openAddMemberForm(page) {
  await page.getByRole('button', { name: 'Add member', exact: true }).click();
  await expect(field(page, 'Username or email')).toBeVisible();
}

async function chooseRole(page, role) {
  await outsideRows(page, page.getByRole('combobox', { name: 'Role', exact: true })).click();
  await outsideSelects(page, page.getByRole('option', { name: role, exact: true })).click();
}

// requirement: if the opening button stays present, the form's submit button follows it in page order
async function submitAddMember(page) {
  await page.getByRole('button', { name: 'Add member', exact: true }).last().click();
}

// the membership role (Member/Owner) shown next to the username: walk up from the element holding the
// username to the nearest container that shows exactly one role word (text or selected option)
async function roleShownFor(page, username) {
  return page.evaluate((name) => {
    const shown = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    const holders = Array.from(document.querySelectorAll('body *')).filter((el) => shown(el) && el.textContent.trim() === name);
    const hit = holders.find((el) => !Array.from(el.children).some((c) => c.textContent.trim() === name));
    const roles = (root) => {
      const found = [];
      for (const sel of root.querySelectorAll('select')) {
        const label = (sel.options[sel.selectedIndex] || {}).label;
        if (label && /^(Member|Owner)$/.test(label.trim())) found.push(label.trim());
      }
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (n.parentElement.closest('select, option')) continue;
        const t = n.textContent.trim();
        if (t === 'Member' || t === 'Owner') found.push(t);
      }
      return found;
    };
    for (let el = hit ? hit.parentElement : null; el && el !== document.body; el = el.parentElement) {
      const found = roles(el);
      if (found.length === 1) return found[0];
      if (found.length > 1) return `ambiguous:${found.join(',')}`;
    }
    return '';
  }, username);
}

test('REQ-2-2-3: Directly Add a User as an Organization Member - Scenario 1', async ({ page, browser }) => {
  const ctx = await browser.newContext();
  const newcomer = await ctx.newPage();
  const username = await registerAccount(newcomer);

  await signIn(page, SEED_USER, PASSWORD, SEED_USER);
  await openPeople(page);
  await openAddMemberForm(page);
  await field(page, 'Username or email').fill(username);
  await chooseRole(page, 'Member');
  await submitAddMember(page);

  // immediately listed as Member, no pending/awaiting state; kept after reload
  await expect(page.getByText(username, { exact: true })).toBeVisible();
  await expect.poll(() => roleShownFor(page, username)).toBe('Member');
  await expect(page.getByText(/Pending|Awaiting/)).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(username, { exact: true })).toBeVisible();
  await expect(page.getByText(/Pending|Awaiting/)).toHaveCount(0);

  // the new member signs in separately and sees the organization, also after refresh
  await submitSignIn(newcomer, username, PASSWORD);
  await expectSignedIn(newcomer, username);
  await openYourOrganizations(newcomer);
  await expect(newcomer.getByRole('link', { name: ORG })).toBeVisible();
  await newcomer.reload();
  await expect(newcomer.getByRole('link', { name: ORG })).toBeVisible();
  // and the organization overview opens for the new member
  await newcomer.getByRole('link', { name: ORG }).click();
  await expect(newcomer.getByRole('link', { name: 'People', exact: true })).toBeVisible();
  await ctx.close();
});

test('REQ-2-2-3: Directly Add a User as an Organization Member - Scenario 2', async ({ page }) => {
  await signIn(page, SEED_USER, PASSWORD, SEED_USER);
  await openPeople(page);
  await expect(page.getByText('bob-reviewer', { exact: true })).toHaveCount(1);

  // existing member
  await openAddMemberForm(page);
  await field(page, 'Username or email').fill('bob-reviewer');
  await chooseRole(page, 'Member');
  await submitAddMember(page);
  await expect(page.getByText('Account is already a member')).toBeVisible();

  // the form stays open: correct the name to an unknown account and resubmit
  await field(page, 'Username or email').fill('unknown-reviewer');
  await submitAddMember(page);
  await expect(page.getByText('Account not found')).toBeVisible();

  // no duplicate and no phantom membership, also after reload
  await expect(page.getByText('bob-reviewer', { exact: true })).toHaveCount(1);
  await expect(page.getByText('unknown-reviewer', { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('bob-reviewer', { exact: true })).toHaveCount(1);
  await expect(page.getByText('unknown-reviewer', { exact: true })).toHaveCount(0);
});
