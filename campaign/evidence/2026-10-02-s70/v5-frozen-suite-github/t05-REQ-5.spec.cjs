const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function signIn(page, username, password) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function openRepository(page, name) {
  const search = page.getByRole('searchbox', { name: 'Search', exact: true });
  await search.fill(name);
  await search.press('Enter');
  await page.getByRole('link', { name, exact: true }).click();
}

async function openRepoFromHome(page, name) {
  await page.goto('/');
  await openRepository(page, name);
}

async function openIssues(page, repo = 'acme-docs') {
  await openRepoFromHome(page, repo);
  await page.getByRole('link', { name: 'Issues', exact: true }).click();
}

// ---------------------------------------------------------------- REQ-5-1-1

test('REQ-5-1-1: REQ-5-1-1: List and Filter Repository Issues - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await openRepository(page, 'acme-docs');
  await page.getByRole('link', { name: 'Issues', exact: true }).click();

  await page.getByRole('link', { name: 'Open', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search issues', exact: true }).fill('Improve onboarding');

  await expect(page.getByRole('link', { name: 'Improve onboarding', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('link', { name: 'Improve onboarding', exact: true })).toBeVisible();
});

test('REQ-5-1-1#2: REQ-5-1-1: List and Filter Repository Issues - Scenario 2', async ({ page }) => {
  await page.goto('/');
  await openRepository(page, 'acme-docs');
  await page.getByRole('link', { name: 'Issues', exact: true }).click();

  await page.getByRole('link', { name: 'Closed', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search issues', exact: true }).fill('Legacy welcome text');

  await expect(page.getByRole('link', { name: 'Legacy welcome text', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Improve onboarding', exact: true })).toHaveCount(0);
});

// ---------------------------------------------------------------- REQ-5-1-2

test('REQ-5-1-2: REQ-5-1-2: View an Issue and Its Discussion - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await openRepository(page, 'acme-docs');
  await page.getByRole('link', { name: 'Issues', exact: true }).click();
  await page.getByRole('link', { name: 'Improve onboarding', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await expect(page.getByText('Describe the onboarding improvement.', { exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Comment|Activity/).first()).toBeVisible();
});

test('REQ-5-1-2#2: REQ-5-1-2: View an Issue and Its Discussion - Scenario 2', async ({ page }) => {
  await page.goto('/');
  await openRepository(page, 'acme-docs');
  await page.getByRole('link', { name: 'Issues', exact: true }).click();
  await page.getByRole('link', { name: 'Improve onboarding', exact: true }).click();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await expect(page.getByText('Describe the onboarding improvement.', { exact: true })).toBeVisible();
});

test('REQ-5-1-2#3: REQ-5-1-2: View an Issue and Its Discussion - Scenario 3', async ({ page }) => {
  await page.goto('/');
  await openRepository(page, 'acme-docs');
  await page.getByRole('link', { name: 'Issues', exact: true }).click();
  await page.getByRole('link', { name: 'Improve onboarding', exact: true }).click();

  await openRepository(page, 'acme-docs');
  await page.getByRole('link', { name: 'Issues', exact: true }).click();
  await page.getByRole('link', { name: 'Improve onboarding', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
});

// ---------------------------------------------------------------- REQ-5-2-1

test('REQ-5-2-1: REQ-5-2-1: Create a Repository Issue - Scenario 1', async ({ page }) => {
  const title = `Playwright issue ${u()}`;
  const description = `Issue body created by Playwright ${u()}`;

  await signIn(page, 'issue-author', 'Valid-password-123!');
  await openIssues(page);

  await page.getByRole('link', { name: 'New issue', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Description', { exact: true }).fill(description);
  await page.getByRole('button', { name: 'Submit new issue', exact: true }).click();

  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText(description, { exact: true })).toBeVisible();

  await openIssues(page);
  await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();
});

test('REQ-5-2-1#2: REQ-5-2-1: Create a Repository Issue - Scenario 2', async ({ page }) => {
  await signIn(page, 'issue-author', 'Valid-password-123!');
  await openIssues(page);

  await page.getByRole('link', { name: 'New issue', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Submit new issue', exact: true }).click();

  await expect(page.getByText(/required/i).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit new issue', exact: true })).toBeVisible();
});

// ---------------------------------------------------------------- REQ-5-2-2

test('REQ-5-2-2: REQ-5-2-2: Edit an Issue Title and Description - Scenario 1', async ({ page }) => {
  const newTitle = `Edited onboarding issue ${u()}`;
  const newDescription = `Edited description ${u()}`;

  await signIn(page, 'issue-editor', 'Valid-password-123!');
  await openIssues(page);
  await page.getByRole('link', { name: 'Editable onboarding issue', exact: true }).click();

  await page.getByRole('button', { name: 'Edit issue title', exact: true }).click();
  await page.getByLabel('Issue title', { exact: true }).fill(newTitle);
  await page.getByRole('button', { name: 'Save issue title', exact: true }).click();

  await page.getByRole('button', { name: 'Edit issue description', exact: true }).click();
  await page.getByLabel('Issue description', { exact: true }).fill(newDescription);
  await page.getByRole('button', { name: 'Save issue description', exact: true }).click();

  await page.reload();
  await expect(page.getByRole('heading', { name: newTitle, exact: true })).toBeVisible();
  await expect(page.getByText(newDescription, { exact: true })).toBeVisible();
});

test('REQ-5-2-2#2: REQ-5-2-2: Edit an Issue Title and Description - Scenario 2', async ({ page }) => {
  await signIn(page, 'issue-editor', 'Valid-password-123!');
  await openIssues(page);
  await page.getByRole('link', { name: 'Original issue title', exact: true }).click();

  await page.getByRole('button', { name: 'Edit issue title', exact: true }).click();
  await page.getByLabel('Issue title', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Save issue title', exact: true }).click();

  await expect(page.getByText(/required|empty/i).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Original issue title', exact: true })).toBeVisible();
});

// ---------------------------------------------------------------- REQ-5-2-3

test('REQ-5-2-3: REQ-5-2-3: Comment on an Issue Discussion - Scenario 1', async ({ page }) => {
  const comment = `Playwright comment ${u()}`;

  await signIn(page, 'issue-commenter', 'Valid-password-123!');
  await openIssues(page);
  await page.getByRole('link', { name: 'Commentable onboarding issue', exact: true }).click();

  await page.getByLabel('Comment', { exact: true }).fill(comment);
  await page.getByRole('button', { name: 'Comment', exact: true }).click();

  await expect(page.getByText(comment, { exact: true })).toBeVisible();
  await expect(page.getByText('issue-commenter', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText(comment, { exact: true })).toBeVisible();
});

test('REQ-5-2-3#2: REQ-5-2-3: Comment on an Issue Discussion - Scenario 2', async ({ page }) => {
  await signIn(page, 'issue-commenter', 'Valid-password-123!');
  await openIssues(page);
  await page.getByRole('link', { name: 'Comment validation issue', exact: true }).click();

  const articles = page.getByRole('article');
  const before = await articles.count();

  const submit = page.getByRole('button', { name: 'Comment', exact: true });
  await page.getByLabel('Comment', { exact: true }).fill('   ');

  if (await submit.isEnabled()) {
    await submit.click();
    await expect(page.getByText(/required|empty/i).first()).toBeVisible();
  } else {
    await expect(submit).toBeDisabled();
  }

  await expect(articles).toHaveCount(before);

  await page.reload();
  await expect(articles).toHaveCount(before);
});

// ---------------------------------------------------------------- REQ-5-3-1

test('REQ-5-3-1: REQ-5-3-1: Assign or Unassign Issue Participants - Scenario 1', async ({ page }) => {
  await signIn(page, 'issue-editor', 'Valid-password-123!');
  await openIssues(page);
  await page.getByRole('link', { name: 'Assignable onboarding issue', exact: true }).click();

  await page.getByRole('button', { name: 'Assignees', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search assignees', exact: true }).fill('bob-reviewer');
  await page.getByRole('option', { name: 'bob-reviewer', exact: true }).click();

  await expect(page.getByText('bob-reviewer', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('bob-reviewer', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Assignees', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search assignees', exact: true }).fill('bob-reviewer');
  await page.getByRole('option', { name: 'bob-reviewer', exact: true }).click();

  await expect(page.getByText('bob-reviewer', { exact: true })).toHaveCount(0);
});

// ---------------------------------------------------------------- REQ-5-3-2

test('REQ-5-3-2: REQ-5-3-2: Apply Labels to an Issue - Scenario 1', async ({ page }) => {
  await signIn(page, 'issue-editor', 'Valid-password-123!');
  await openIssues(page);
  await page.getByRole('link', { name: 'Labelable onboarding issue', exact: true }).click();

  await page.getByRole('button', { name: 'Labels', exact: true }).click();
  await page.getByRole('option', { name: 'bug', exact: true }).click();

  await expect(page.getByText('bug', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('bug', { exact: true }).first()).toBeVisible();
});

// ---------------------------------------------------------------- REQ-5-3-3

test('REQ-5-3-3: REQ-5-3-3: Assign Issues and Pull Requests to a Milestone - Scenario 1', async ({ page }) => {
  await signIn(page, 'issue-editor', 'Valid-password-123!');
  await openIssues(page);
  await page.getByRole('link', { name: 'Milestone onboarding issue', exact: true }).click();

  await page.getByRole('button', { name: 'Milestone', exact: true }).click();
  await page.getByRole('option', { name: 'v1.0', exact: true }).click();

  await expect(page.getByText('v1.0', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('v1.0', { exact: true }).first()).toBeVisible();
});

// ---------------------------------------------------------------- REQ-5-4

test('REQ-5-4: REQ-5-4: Close or Reopen an Issue - Scenario 1', async ({ page }) => {
  await signIn(page, 'issue-editor', 'Valid-password-123!');
  await openIssues(page);
  await page.getByRole('link', { name: 'Closable onboarding issue', exact: true }).click();

  await page.getByRole('button', { name: 'Close issue', exact: true }).click();
  await expect(page.getByText('Closed', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Reopen issue', exact: true }).click();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Close issue', exact: true })).toBeVisible();
});

test('REQ-5-4#2: REQ-5-4: Close or Reopen an Issue - Scenario 2', async ({ page }) => {
  await signIn(page, 'issue-viewer', 'Valid-password-123!');
  await openIssues(page);
  await page.getByRole('link', { name: 'Protected onboarding issue', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Close issue', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reopen issue', exact: true })).toHaveCount(0);
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

