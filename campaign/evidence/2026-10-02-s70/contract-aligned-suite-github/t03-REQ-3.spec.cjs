const { test, expect } = require('@playwright/test');

const PASSWORD = 'Valid-password-123!';
const ALICE = { username: 'alice-dev', email: 'alice.dev@example.test' };

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const searchField = (page) => page.getByRole('searchbox', { name: 'Search', exact: true });

async function signIn(page, account = ALICE) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
}

async function signOut(page) {
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();
  try {
    await page.getByRole('button', { name: 'Confirm sign out', exact: true }).click({ timeout: 3000 });
  } catch (e) {
    // no confirmation dialog was shown
  }
}

async function tryClick(locator, timeout = 3000) {
  try {
    await locator.first().click({ timeout });
    return true;
  } catch (e) {
    return false;
  }
}

async function openRepositoryFromSearch(page, name) {
  await page.goto('/');
  const box = searchField(page);
  await box.fill(name);
  await box.press('Enter');
  await page.getByRole('link', { name, exact: true }).first().click();
  await expect(page.getByRole('heading', { name: new RegExp(name) })).toBeVisible();
}

async function createRepository(page, { name, description = '', visibility = 'Private', readme = true }) {
  await page.goto('/');
  await page.getByRole('link', { name: 'New repository', exact: true }).click();
  await page.getByLabel('Repository name', { exact: true }).fill(name);
  if (description) {
    await page.getByLabel('Description', { exact: true }).fill(description);
  }
  await page.getByRole('radio', { name: visibility, exact: true }).check();
  if (readme) {
    await page.getByRole('checkbox', { name: 'Add a README file', exact: true }).check();
  }
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();
  await expect(page.getByRole('heading', { name: new RegExp(name) })).toBeVisible();
}

test('REQ-3-1: REQ-3-1: Search for and Locate Repositories - Scenario 1', async ({ page }) => {
  await page.goto('/');
  const box = searchField(page);
  await box.fill('acme-docs');
  await box.press('Enter');

  await tryClick(page.getByRole('link', { name: 'Repositories', exact: true }));

  const result = page.getByRole('link', { name: 'acme-docs', exact: true });
  await expect(result.first()).toBeVisible();
  await expect(page.getByText('Public', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'secret-research', exact: true })).toHaveCount(0);

  await result.first().click();
  await expect(page.getByRole('heading', { name: /acme-docs/ })).toBeVisible();

  await page.goto('/');
  const boxAgain = searchField(page);
  await boxAgain.fill('secret-research');
  await boxAgain.press('Enter');
  await expect(page.getByRole('link', { name: 'secret-research', exact: true })).toHaveCount(0);
  await expect(page.getByText('No results', { exact: true }).first()).toBeVisible();
});

test('REQ-3-1#2: REQ-3-1: Search for and Locate Repositories - Scenario 2', async ({ page }) => {
  await signIn(page);

  await page.goto('/');
  const box = searchField(page);
  await box.fill('acme-docs');
  await box.press('Enter');

  const result = page.getByRole('link', { name: 'acme-docs', exact: true });
  await expect(result.first()).toBeVisible();
  await result.first().click();
  await expect(page.getByRole('heading', { name: /acme-docs/ })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: /acme-docs/ })).toBeVisible();
});

test('REQ-3-1#3: REQ-3-1: Search for and Locate Repositories - Scenario 3', async ({ page }) => {
  await signIn(page);

  await page.goto('/');
  const box = searchField(page);
  await box.fill('no-such-repo-token');
  await box.press('Enter');
  await expect(page.getByText('No results', { exact: true }).first()).toBeVisible();

  await page.goto('/');
  const boxAgain = searchField(page);
  await boxAgain.fill('no-such-repo-token');
  await boxAgain.press('Enter');
  await expect(page.getByText('No results', { exact: true }).first()).toBeVisible();
});

test('REQ-3-1#4: REQ-3-1: Search for and Locate Repositories - Scenario 4', async ({ page }) => {
  await signIn(page);

  await openRepositoryFromSearch(page, 'acme-docs');
  await expect(page.getByText('Public', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: /acme-docs/ })).toBeVisible();
  await expect(page.getByText('Public', { exact: true }).first()).toBeVisible();
});

test('REQ-3-2-1: REQ-3-2-1: Create a Repository with Owner, Visibility, and Initialization Options - Scenario 1', async ({ page }) => {
  await signIn(page);
  const name = 'pw-repo-' + u();

  await createRepository(page, {
    name,
    description: 'Repository created by Playwright',
    visibility: 'Private',
    readme: true,
  });

  await expect(page.getByRole('heading', { name: new RegExp(name) })).toBeVisible();
  await expect(page.getByText('Private', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'README.md', exact: true })).toBeVisible();

  await expect(page.getByRole('link', { name: 'Commits', exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: new RegExp(name) })).toBeVisible();
  await expect(page.getByText('Private', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'README.md', exact: true })).toBeVisible();
});

test('REQ-3-2-1#2: REQ-3-2-1: Create a Repository with Owner, Visibility, and Initialization Options - Scenario 2', async ({ page }) => {
  await signIn(page);
  const name = 'pw-repo-' + u();

  await page.goto('/');
  await page.getByRole('link', { name: 'New repository', exact: true }).click();
  await expect(page.getByLabel('Owner', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Repository name', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Description', { exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Public', exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Private', exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Add a README file', exact: true })).toBeVisible();

  await page.getByLabel('Repository name', { exact: true }).fill(name);
  await page.getByLabel('Description', { exact: true }).fill('Repository created by Playwright');
  await page.getByRole('radio', { name: 'Public', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Add a README file', exact: true }).check();
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();

  await expect(page.getByRole('heading', { name: new RegExp(name) })).toBeVisible();
  await expect(page.getByText('Public', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: new RegExp(name) })).toBeVisible();
  await expect(page.getByText('Public', { exact: true }).first()).toBeVisible();
});

test('REQ-3-2-1#3: REQ-3-2-1: Create a Repository with Owner, Visibility, and Initialization Options - Scenario 3', async ({ page }) => {
  await signIn(page);

  await page.goto('/');
  await page.getByRole('link', { name: 'New repository', exact: true }).click();
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();
  await expect(page.getByLabel('Repository name', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create repository', exact: true })).toBeVisible();

  const name = 'pw-repo-' + u();
  await page.getByLabel('Repository name', { exact: true }).fill(name);
  await page.getByRole('radio', { name: 'Private', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Add a README file', exact: true }).check();
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();

  await expect(page.getByRole('heading', { name: new RegExp(name) })).toBeVisible();
  await expect(page.getByText('Private', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: new RegExp(name) })).toBeVisible();
  await expect(page.getByText('Private', { exact: true }).first()).toBeVisible();
});

test('REQ-3-2-2: REQ-3-2-2: Fork a Repository into Another Namespace - Scenario 1', async ({ page }) => {
  await signIn(page);

  await openRepositoryFromSearch(page, 'acme-docs');
  await page.getByRole('button', { name: 'Fork', exact: true }).click();

  const forkName = 'acme-docs-fork-' + u();
  await page.getByLabel('Repository name', { exact: true }).fill(forkName);
  await page.getByRole('button', { name: 'Create fork', exact: true }).click();

  await expect(page.getByRole('heading', { name: new RegExp(forkName) })).toBeVisible();
  await expect(page.getByText('Forked from acme-docs').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'README.md', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: new RegExp(forkName) })).toBeVisible();
  await expect(page.getByText('Forked from acme-docs').first()).toBeVisible();
});

test('REQ-3-2-2#2: REQ-3-2-2: Fork a Repository into Another Namespace - Scenario 2', async ({ page }) => {
  await signIn(page);

  await openRepositoryFromSearch(page, 'acme-docs');
  await page.getByRole('button', { name: 'Fork', exact: true }).click();

  const forkName = 'acme-docs-fork-' + u();
  await page.getByLabel('Repository name', { exact: true }).fill(forkName);
  await page.getByRole('button', { name: 'Create fork', exact: true }).click();

  await expect(page.getByRole('heading', { name: new RegExp(forkName) })).toBeVisible();
  await expect(page.getByText('Forked from acme-docs').first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: new RegExp(forkName) })).toBeVisible();
  await expect(page.getByText('Forked from acme-docs').first()).toBeVisible();
});

test('REQ-3-2-3: REQ-3-2-3: Copy a Repository Clone Value - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await openRepositoryFromSearch(page, 'acme-docs');

  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await page.getByRole('tab', { name: 'HTTPS', exact: true }).click();
  await page.getByRole('button', { name: 'Copy clone value', exact: true }).click();
  await expect(page.getByText('Copied', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /acme-docs/ })).toBeVisible();
  const httpsValue = await page.evaluate(() => navigator.clipboard.readText());
  expect(httpsValue).toContain('acme-docs');

  await page.getByRole('tab', { name: 'SSH', exact: true }).click();
  await page.getByRole('button', { name: 'Copy clone value', exact: true }).click();
  await expect(page.getByText('Copied', { exact: true }).first()).toBeVisible();
  const sshValue = await page.evaluate(() => navigator.clipboard.readText());
  expect(sshValue).toContain('acme-docs');
  expect(sshValue).toContain('.git');
  expect(sshValue).toContain(':');

  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'SSH', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /acme-docs/ })).toBeVisible();
});

test('REQ-3-2-3#2: REQ-3-2-3: Copy a Repository Clone Value - Scenario 2', async ({ page }) => {
  await signIn(page);

  await openRepositoryFromSearch(page, 'acme-docs');
  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await page.getByRole('tab', { name: 'SSH', exact: true }).click();
  await page.getByRole('button', { name: 'Copy clone value', exact: true }).click();
  await expect(page.getByText('Copied', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: /acme-docs/ })).toBeVisible();
  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'SSH', exact: true })).toBeVisible();
});

test('REQ-3-3: REQ-3-3: View a Public Repository Overview - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await openRepositoryFromSearch(page, 'acme-docs');

  await expect(page.getByRole('heading', { name: /acme-docs/ })).toBeVisible();
  await expect(page.getByText('Public', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Code', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Issues', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Pull requests', exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: /acme-docs/ })).toBeVisible();
  await expect(page.getByText('Public', { exact: true }).first()).toBeVisible();

  const readme = page.getByRole('link', { name: 'README.md', exact: true });
  if (await readme.count()) {
    await readme.first().click();
    await expect(page.getByRole('heading', { name: /acme-docs/ })).toBeVisible();
  }

  await page.goto('/');
  const box = searchField(page);
  await box.fill('secret-research');
  await box.press('Enter');
  await expect(page.getByRole('link', { name: 'secret-research', exact: true })).toHaveCount(0);
});

test('REQ-3-4: REQ-3-4: Change Repository Visibility with Permission Checks - Scenario 1', async ({ page }) => {
  await signIn(page);
  const name = 'pw-vis-' + u();

  await createRepository(page, {
    name,
    description: 'Repository created by Playwright',
    visibility: 'Private',
    readme: true,
  });
  await expect(page.getByText('Private', { exact: true }).first()).toBeVisible();

  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'General', exact: true }).click();
  await page.getByRole('button', { name: 'Change visibility', exact: true }).click();

  const dialog = page.getByRole('dialog');
  if (await dialog.count()) {
    const publicRadio = dialog.getByRole('radio', { name: 'Public', exact: true });
    if (await publicRadio.count()) {
      await publicRadio.first().check();
    }
    const nameBox = dialog.getByRole('textbox');
    if (await nameBox.count()) {
      await nameBox.first().fill(name);
    }
    const confirm = dialog.getByRole('button', { name: 'Confirm visibility', exact: true });
    if (await confirm.count()) {
      await confirm.first().click();
    }
  } else {
    await page.getByRole('radio', { name: 'Public', exact: true }).first().check();
    await page.getByRole('button', { name: 'Confirm visibility', exact: true }).first().click();
  }

  await expect(page.getByText('Public', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('Public', { exact: true }).first()).toBeVisible();

  await signOut(page);
  await page.goto('/');
  const box = searchField(page);
  await box.fill(name);
  await box.press('Enter');
  await expect(page.getByRole('link', { name, exact: true }).first()).toBeVisible();
});

test('REQ-3-4#2: REQ-3-4: Change Repository Visibility with Permission Checks - Scenario 2', async ({ page }) => {
  await signIn(page);
  const name = 'pw-vis-' + u();

  await createRepository(page, {
    name,
    description: 'Repository created by Playwright',
    visibility: 'Private',
    readme: true,
  });
  await expect(page.getByText('Private', { exact: true }).first()).toBeVisible();

  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'General', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Change visibility', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Change visibility', exact: true })).toBeVisible();
  await expect(page.getByText('Private', { exact: true }).first()).toBeVisible();
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

