const { test, expect } = require('@playwright/test');

const ALICE = 'alice-dev';
const PASS = 'Valid-password-123!';

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function signIn(page, username, password) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
}

async function signOut(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm sign out', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
}

async function register(page, username, email, password) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
}

async function openRepoBySearch(page, repoName) {
  await page.goto('/');
  const search = page.getByRole('searchbox', { name: 'Search', exact: true });
  await expect(search).toBeVisible();
  await search.fill(repoName);
  await search.press('Enter');
  const reposFilter = page.getByRole('link', { name: 'Repositories', exact: true });
  if (await reposFilter.isVisible().catch(() => false)) await reposFilter.click();
  const result = page.getByRole('link', { name: repoName, exact: true }).first();
  await expect(result).toBeVisible();
  await result.click();
}

async function createRepo(page, ownerLabel, repoName, description = '', visibility = 'Private', initReadme = true) {
  await page.goto('/');
  await page.getByRole('link', { name: 'New repository', exact: true }).click();
  const ownerSelect = page.getByLabel('Owner', { exact: true });
  if (await ownerSelect.isVisible().catch(() => false)) {
    const slug = ownerLabel.toLowerCase().replace(/\s+/g, '-');
    try { await ownerSelect.selectOption({ label: ownerLabel }); } catch {
      try { await ownerSelect.selectOption(ownerLabel); } catch {
        try { await ownerSelect.selectOption(slug); } catch { /* ignore owner-select failures */ }
      }
    }
  }
  await page.getByLabel('Repository name', { exact: true }).fill(repoName);
  if (description) await page.getByLabel('Description', { exact: true }).fill(description);
  await page.getByRole('radio', { name: visibility, exact: true }).check();
  if (initReadme) await page.getByRole('checkbox', { name: 'Add a README file', exact: true }).check();
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();
  await expect(page.getByRole('heading', { name: new RegExp(repoName) })).toBeVisible();
}

test('REQ-3-2-2: REQ-3-2-2: Fork a Repository into Another Namespace - Scenario 1', async ({ page }) => {
  await signIn(page, ALICE, PASS);
  await openRepoBySearch(page, 'acme-docs');

  await page.getByRole('button', { name: 'Fork', exact: true }).click();
  const forkName = `acme-docs-fork-${u()}`;
  await page.getByLabel('Repository name', { exact: true }).fill(forkName);
  await page.getByRole('button', { name: 'Create fork', exact: true }).click();

  await expect(page.getByRole('heading', { name: new RegExp(forkName) })).toBeVisible();
  await expect(page.getByText('Forked from acme-docs', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: new RegExp(forkName) })).toBeVisible();
  await expect(page.getByText('Forked from acme-docs', { exact: true })).toBeVisible();

  // conflict case: seeded existing fork name must be rejected
  await openRepoBySearch(page, 'acme-docs');
  await page.getByRole('button', { name: 'Fork', exact: true }).click();
  await page.getByLabel('Repository name', { exact: true }).fill('acme-docs-fork');
  await page.getByRole('button', { name: 'Create fork', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Create fork', exact: true })).toBeVisible();
});

test('REQ-3-2-2#2: REQ-3-2-2: Fork a Repository into Another Namespace - Scenario 2', async ({ page }) => {
  await signIn(page, ALICE, PASS);
  await openRepoBySearch(page, 'acme-docs');

  await page.getByRole('button', { name: 'Fork', exact: true }).click();
  await expect(page.getByLabel('Repository name', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create fork', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Repository name', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create fork', exact: true })).toBeVisible();
});

test('REQ-3-2-3: REQ-3-2-3: Copy a Repository Clone Value - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await openRepoBySearch(page, 'acme-docs');

  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await page.getByRole('tab', { name: 'HTTPS', exact: true }).click();
  await page.getByRole('button', { name: 'Copy clone value', exact: true }).click();
  await expect(page.getByText('Copied', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /acme-docs/ })).toBeVisible();

  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await page.getByRole('tab', { name: 'SSH', exact: true }).click();
  await page.getByRole('button', { name: 'Copy clone value', exact: true }).click();
  await expect(page.getByText('Copied', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /acme-docs/ })).toBeVisible();
});

test('REQ-3-2-3#2: REQ-3-2-3: Copy a Repository Clone Value - Scenario 2', async ({ page }) => {
  await signIn(page, ALICE, PASS);
  await openRepoBySearch(page, 'acme-docs');

  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'HTTPS', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'SSH', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy clone value', exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'HTTPS', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'SSH', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy clone value', exact: true })).toBeVisible();
});

test('REQ-3-3: REQ-3-3: View a Public Repository Overview - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await openRepoBySearch(page, 'acme-docs');

  await expect(page.getByRole('heading', { name: /acme-docs/ })).toBeVisible();
  await expect(page.getByText('Public', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('main', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Code', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Issues', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Pull requests', exact: true })).toBeVisible();

  const readme = page.getByRole('link', { name: 'README.md', exact: true });
  await expect(readme).toBeVisible();
  await readme.click();
  await expect(page.getByRole('heading', { name: 'README.md', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'README.md', exact: true })).toBeVisible();

  await page.goto('/');
  const search = page.getByRole('searchbox', { name: 'Search', exact: true });
  await search.fill('secret-research');
  await search.press('Enter');
  await expect(page.getByText('No results', { exact: true })).toBeVisible();
});

test('REQ-3-4: REQ-3-4: Change Repository Visibility with Permission Checks - Scenario 1', async ({ page }) => {
  const suffix = u();
  const bob = `bob-${suffix}`;
  const bobEmail = `${bob}@example.test`;
  const bobPass = 'Valid-password-123!';

  await register(page, bob, bobEmail, bobPass);
  await signIn(page, ALICE, PASS);

  // Add bob to the seeded organization as a Member
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Your organizations', exact: true }).click();
  await page.getByRole('link', { name: 'Acme Demo', exact: true }).click();
  await page.getByRole('link', { name: 'People', exact: true }).click();
  await page.getByRole('button', { name: 'Add member', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(bob);
  const memberRole = page.getByRole('combobox', { name: 'Role', exact: true });
  if (await memberRole.isVisible().catch(() => false)) await memberRole.selectOption({ label: 'Member' });
  await page.getByRole('button', { name: 'Add member', exact: true }).last().click();

  // Create a private organization repository
  const repoName = `visrepo-${suffix}`;
  await createRepo(page, 'Acme Demo', repoName, 'Visibility test repository', 'Private', true);
  const repoPath = new URL(page.url()).pathname;

  // Grant bob Write access so Settings may be available to a non-Admin
  await page.goto(repoPath);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Manage access', exact: true }).click();
  await page.getByRole('button', { name: 'Add people or teams', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search', exact: true }).fill(bob);
  await page.getByRole('option', { name: bob, exact: true }).click();
  await page.getByRole('combobox', { name: 'Role', exact: true }).selectOption({ label: 'Write' });
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText(bob, { exact: true }).first()).toBeVisible();

  // Non-Admin must not see the visibility change action
  await signOut(page);
  await signIn(page, bob, bobPass);
  await page.goto(repoPath);
  const settingsLink = page.getByRole('link', { name: 'Settings', exact: true });
  if (await settingsLink.isVisible().catch(() => false)) {
    await settingsLink.click();
    await page.getByRole('link', { name: 'General', exact: true }).click();
  }
  await expect(page.getByRole('button', { name: 'Change visibility', exact: true })).toHaveCount(0);

  // Admin changes visibility to Public
  await signOut(page);
  await signIn(page, ALICE, PASS);
  await page.goto(repoPath);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'General', exact: true }).click();
  await page.getByRole('button', { name: 'Change visibility', exact: true }).click();

  const confirmName = page.getByRole('textbox', { name: 'Repository name', exact: true });
  if (await confirmName.isVisible().catch(() => false)) await confirmName.fill(repoName);

  await page.getByRole('radio', { name: 'Public', exact: true }).check();
  await page.getByRole('button', { name: 'Confirm visibility', exact: true }).click();
  await expect(page.getByText('Public', { exact: true }).first()).toBeVisible();

  // Visitor can now view the public repository
  await signOut(page);
  await page.goto(repoPath);
  await expect(page.getByRole('heading', { name: new RegExp(repoName) })).toBeVisible();
  await expect(page.getByText('Public', { exact: true }).first()).toBeVisible();

  // Visibility remains Public after refreshing settings
  await signIn(page, ALICE, PASS);
  await page.goto(`${repoPath}/settings`);
  await expect(page.getByText('Public', { exact: true }).first()).toBeVisible();
});

test('REQ-3-4#2: REQ-3-4: Change Repository Visibility with Permission Checks - Scenario 2', async ({ page }) => {
  await signIn(page, ALICE, PASS);
  await page.goto('/alice-dev/secret-research');
  await expect(page.getByText('Private', { exact: true }).first()).toBeVisible();

  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'General', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Change visibility', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Change visibility', exact: true })).toBeVisible();
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

