const { test, expect } = require('@playwright/test');

test.setTimeout(15000);
expect.configure({ timeout: 5000 });

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

test.beforeEach(({ page }) => {
  page.setDefaultTimeout(5000);
});

async function signIn(page, username = 'alice-dev', password = 'Valid-password-123!') {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).first().click();
  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
}

async function openRepository(page, repoName = 'acme-docs') {
  await page.goto('/');
  const search = page.getByRole('searchbox', { name: 'Search', exact: true });
  await search.fill(repoName);
  await search.press('Enter');
  await page.getByRole('link', { name: repoName, exact: true }).click();
  await expect(page.getByRole('link', { name: 'Issues', exact: true })).toBeVisible();
}

async function openIssues(page) {
  await openRepository(page);
  await page.getByRole('link', { name: 'Issues', exact: true }).click();
  await expect(page.getByRole('searchbox', { name: 'Search issues', exact: true })).toBeVisible();
}

async function openIssueDetail(page, title) {
  await openIssues(page);
  await page.getByRole('link', { name: title, exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}

async function selectLabelFilter(page, label) {
  await page.getByRole('button', { name: 'Labels', exact: true }).click();
  const option = page
    .getByRole('checkbox', { name: label, exact: true })
    .or(page.getByRole('menuitemcheckbox', { name: label, exact: true }))
    .or(page.getByRole('option', { name: label, exact: true }));
  await option.first().click();
  await page.keyboard.press('Escape');
}

test('REQ-5-1-1: List and Filter Repository Issues - Scenario 1', async ({ page }) => {
  await openIssues(page);

  await page.getByRole('link', { name: 'Open', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search issues', exact: true }).fill('Improve');
  await selectLabelFilter(page, 'bug');

  const openIssue = page.getByRole('link', { name: 'Improve onboarding', exact: true });
  await expect(openIssue).toBeVisible();
  await expect(page.getByRole('link', { name: 'Legacy welcome text', exact: true })).toHaveCount(0);

  await openIssue.click();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();

  await page.goBack();
  await expect(page.getByRole('searchbox', { name: 'Search issues', exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search issues', exact: true }).fill('');
  await page.getByRole('link', { name: 'Closed', exact: true }).click();

  await expect(page.getByRole('link', { name: 'Legacy welcome text', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Improve onboarding', exact: true })).toHaveCount(0);
});

test('REQ-5-1-1: List and Filter Repository Issues - Scenario 2', async ({ page }) => {
  await openIssues(page);

  await page.getByRole('link', { name: 'Closed', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search issues', exact: true }).fill('Legacy welcome text');

  await expect(page.getByRole('link', { name: 'Legacy welcome text', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Improve onboarding', exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('link', { name: 'Legacy welcome text', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Improve onboarding', exact: true })).toHaveCount(0);
});

test('REQ-5-1-2: View an Issue and Its Discussion - Scenario 1', async ({ page }) => {
  await openIssueDetail(page, 'Improve onboarding');

  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Describe the onboarding improvement.', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('bug', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('documentation', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Q3 launch', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Describe the onboarding improvement.', { exact: true }).first()).toBeVisible();
});

test('REQ-5-1-2: View an Issue and Its Discussion - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openIssueDetail(page, 'Improve onboarding');

  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Describe the onboarding improvement.', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Describe the onboarding improvement.', { exact: true }).first()).toBeVisible();
});

test('REQ-5-1-2: View an Issue and Its Discussion - Scenario 3', async ({ page }) => {
  await signIn(page);
  await openRepository(page);
  await page.getByRole('link', { name: 'Issues', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search issues', exact: true }).fill('Improve onboarding');
  await page.getByRole('link', { name: 'Improve onboarding', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Describe the onboarding improvement.', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Describe the onboarding improvement.', { exact: true }).first()).toBeVisible();
});

test('REQ-5-2-1: Create a Repository Issue - Scenario 1', async ({ page }) => {
  await signIn(page);
  await openIssues(page);

  await page.getByRole('link', { name: 'New issue', exact: true }).click();

  const title = `Fix empty state ${u()}`;
  const description = 'Describe the empty state fix.';

  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Description', { exact: true }).fill(description);
  await page.getByRole('button', { name: 'Submit new issue', exact: true }).click();

  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText(description, { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();

  await page.goto('/');
  await openIssues(page);
  await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();
});

test('REQ-5-2-1: Create a Repository Issue - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openIssues(page);

  await page.getByRole('link', { name: 'New issue', exact: true }).click();

  await page.getByLabel('Title', { exact: true }).fill('   ');
  await page.getByLabel('Description', { exact: true }).fill('Should not be saved.');
  await page.getByRole('button', { name: 'Submit new issue', exact: true }).click();

  await expect(page.getByText('Title is required', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Title', { exact: true })).toBeVisible();

  const title = `Recovered issue ${u()}`;
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByRole('button', { name: 'Submit new issue', exact: true }).click();

  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

