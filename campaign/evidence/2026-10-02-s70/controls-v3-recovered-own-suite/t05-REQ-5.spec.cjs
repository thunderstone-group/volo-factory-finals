const { test, expect } = require('@playwright/test');

const PASSWORD = 'Valid-password-123!';
const REPO = 'acme-docs';
const OPEN_ISSUE_TITLE = 'Improve onboarding';
const OPEN_ISSUE_DESC = 'Describe the onboarding improvement.';
const CLOSED_ISSUE_TITLE = 'Legacy welcome text';

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function signIn(page, usernameOrEmail, password = PASSWORD) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(usernameOrEmail);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
}

async function registerAndSignIn(page, username, email, password = PASSWORD) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
}

async function openIssuesPage(page) {
  await page.getByRole('searchbox', { name: 'Search', exact: true }).fill(REPO);
  await page.keyboard.press('Enter');
  await page.getByRole('link', { name: REPO, exact: true }).first().click();
  await page.getByRole('link', { name: 'Issues', exact: true }).first().click();
  await expect(page.getByRole('link', { name: 'Open', exact: true }).first()).toBeVisible();
}

async function openIssue(page, title) {
  await page.getByRole('link', { name: title, exact: true }).first().click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}

async function createIssue(page, title, description) {
  await page.getByRole('link', { name: 'New issue', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(title);
  if (description !== undefined) {
    await page.getByLabel('Description', { exact: true }).fill(description);
  }
  await page.getByRole('button', { name: 'Submit new issue', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}

test('REQ-5-1-1: REQ-5-1-1: List and Filter Repository Issues - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await openIssuesPage(page);

  await page.getByRole('link', { name: 'Open', exact: true }).first().click();
  await page.getByRole('searchbox', { name: 'Search issues', exact: true }).fill('onboarding');
  await page
    .getByRole('link', { name: 'bug', exact: true })
    .or(page.getByRole('button', { name: 'bug', exact: true }))
    .first()
    .click();

  await expect(page.getByRole('link', { name: OPEN_ISSUE_TITLE, exact: true })).toBeVisible();
  await expect(page.getByText('bug', { exact: true }).first()).toBeVisible();

  await page.getByRole('link', { name: OPEN_ISSUE_TITLE, exact: true }).first().click();
  await expect(page.getByRole('heading', { name: OPEN_ISSUE_TITLE, exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Issues', exact: true }).first().click();
  await page.getByRole('link', { name: 'Closed', exact: true }).first().click();
  await expect(page.getByRole('link', { name: CLOSED_ISSUE_TITLE, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: OPEN_ISSUE_TITLE, exact: true })).toHaveCount(0);
});

test('REQ-5-1-1#2: REQ-5-1-1: List and Filter Repository Issues - Scenario 2', async ({ page }) => {
  await page.goto('/');
  await openIssuesPage(page);

  await page.getByRole('link', { name: 'Closed', exact: true }).first().click();
  await page.getByRole('searchbox', { name: 'Search issues', exact: true }).fill(CLOSED_ISSUE_TITLE);

  await expect(page.getByRole('link', { name: CLOSED_ISSUE_TITLE, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: OPEN_ISSUE_TITLE, exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('link', { name: CLOSED_ISSUE_TITLE, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: OPEN_ISSUE_TITLE, exact: true })).toHaveCount(0);
});

test('REQ-5-1-2: REQ-5-1-2: View an Issue and Its Discussion - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await openIssuesPage(page);
  await openIssue(page, OPEN_ISSUE_TITLE);

  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(OPEN_ISSUE_DESC, { exact: true })).toBeVisible();
  await expect(page.getByText('bug', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: OPEN_ISSUE_TITLE, exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(OPEN_ISSUE_DESC, { exact: true })).toBeVisible();
  await expect(page.getByText('bug', { exact: true }).first()).toBeVisible();
});

test('REQ-5-1-2#2: REQ-5-1-2: View an Issue and Its Discussion - Scenario 2', async ({ page }) => {
  await signIn(page, 'alice-dev');
  await openIssuesPage(page);
  await openIssue(page, OPEN_ISSUE_TITLE);

  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(OPEN_ISSUE_DESC, { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: OPEN_ISSUE_TITLE, exact: true })).toBeVisible();
  await expect(page.getByText(OPEN_ISSUE_DESC, { exact: true })).toBeVisible();
});

test('REQ-5-1-2#3: REQ-5-1-2: View an Issue and Its Discussion - Scenario 3', async ({ page }) => {
  await signIn(page, 'alice-dev');
  await openIssuesPage(page);

  await page.getByRole('link', { name: 'Closed', exact: true }).first().click();
  await openIssue(page, CLOSED_ISSUE_TITLE);
  await expect(page.getByText('Closed', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: CLOSED_ISSUE_TITLE, exact: true })).toBeVisible();
  await expect(page.getByText('Closed', { exact: true }).first()).toBeVisible();
});

test('REQ-5-2-1: REQ-5-2-1: Create a Repository Issue - Scenario 1', async ({ page }) => {
  await signIn(page, 'alice-dev');
  await openIssuesPage(page);

  // A title of only spaces is blank: the form reports it and creates nothing.
  await page.getByRole('link', { name: 'New issue', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Submit new issue', exact: true }).click();
  await expect(page.getByText('Title is required', { exact: true })).toBeVisible();

  const title = 'pw-issue-' + u();
  const description = 'Created by the acceptance test.';
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Description', { exact: true }).fill(description);
  await page.getByRole('button', { name: 'Submit new issue', exact: true }).click();

  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(description, { exact: true })).toBeVisible();
  await expect(page.getByText('alice-dev').first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText(description, { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Issues', exact: true }).first().click();
  await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();
});

test('REQ-5-2-1#2: REQ-5-2-1: Create a Repository Issue - Scenario 2', async ({ page }) => {
  await signIn(page, 'alice-dev');
  await openIssuesPage(page);

  const title = 'pw-issue-' + u();
  await createIssue(page, title, '');

  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Issues', exact: true }).first().click();
  await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();
});

test('REQ-5-2-2: REQ-5-2-2: Edit an Issue Title and Description - Scenario 1', async ({ page }) => {
  await signIn(page, 'alice-dev');
  await openIssuesPage(page);

  const originalTitle = 'pw-edit-' + u();
  await createIssue(page, originalTitle, 'Original description text.');

  const newTitle = 'pw-edited-' + u();
  await page.getByRole('button', { name: 'Edit issue title', exact: true }).click();
  await page.getByLabel('Issue title', { exact: true }).fill(newTitle);
  await page.getByRole('button', { name: 'Save issue title', exact: true }).click();
  await expect(page.getByRole('heading', { name: newTitle, exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Edit issue description', exact: true }).click();
  await page.getByLabel('Issue description', { exact: true }).fill('Updated description text.');
  await page.getByRole('button', { name: 'Save issue description', exact: true }).click();
  await expect(page.getByText('Updated description text.', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: newTitle, exact: true })).toBeVisible();
  await expect(page.getByText('Updated description text.', { exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();

  await page.getByRole('link', { name: 'Issues', exact: true }).first().click();
  await expect(page.getByRole('link', { name: newTitle, exact: true })).toBeVisible();
});

test('REQ-5-2-2#2: REQ-5-2-2: Edit an Issue Title and Description - Scenario 2', async ({ page }) => {
  await signIn(page, 'alice-dev');
  await openIssuesPage(page);

  const originalTitle = 'pw-blank-' + u();
  await createIssue(page, originalTitle, 'Description that must survive.');

  await page.getByRole('button', { name: 'Edit issue title', exact: true }).click();
  await page.getByLabel('Issue title', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Save issue title', exact: true }).click();
  await expect(page.getByText('Title is required', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: originalTitle, exact: true })).toBeVisible();
  await expect(page.getByText('Description that must survive.', { exact: true })).toBeVisible();
});

test('REQ-5-2-3: REQ-5-2-3: Comment on an Issue Discussion - Scenario 1', async ({ page }) => {
  await signIn(page, 'alice-dev');
  await openIssuesPage(page);
  await openIssue(page, OPEN_ISSUE_TITLE);

  const comment = 'pw-comment-' + u();
  await page.getByLabel('Comment', { exact: true }).fill(comment);
  await page.getByRole('button', { name: 'Comment', exact: true }).click();

  await expect(page.getByText(comment, { exact: true })).toBeVisible();
  await expect(page.getByText('alice-dev').first()).toBeVisible();

  await page.reload();
  await expect(page.getByText(comment, { exact: true })).toBeVisible();
});

test('REQ-5-2-3#2: REQ-5-2-3: Comment on an Issue Discussion - Scenario 2', async ({ page }) => {
  await signIn(page, 'alice-dev');
  await openIssuesPage(page);
  await openIssue(page, OPEN_ISSUE_TITLE);

  const before = await page.getByRole('article').count();

  await page.getByLabel('Comment', { exact: true }).fill('   ');
  const submit = page.getByRole('button', { name: 'Comment', exact: true });
  if (await submit.isEnabled()) {
    await submit.click();
    await expect(page.getByText('Comment is required', { exact: true })).toBeVisible();
  }

  await page.reload();
  await expect(page.getByRole('article')).toHaveCount(before);
});

test('REQ-5-3-1: REQ-5-3-1: Assign or Unassign Issue Participants - Scenario 1', async ({ page }) => {
  await signIn(page, 'alice-dev');
  await openIssuesPage(page);
  await openIssue(page, OPEN_ISSUE_TITLE);

  await page.getByRole('button', { name: 'Assignees', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search assignees', exact: true }).fill('bob-reviewer');
  await page.getByRole('option', { name: 'bob-reviewer', exact: true }).click();

  await expect(page.getByText('bob-reviewer', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('bob-reviewer', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Assignees', exact: true }).click();
  await page.getByRole('option', { name: 'bob-reviewer', exact: true }).click();
  await page.reload();
  await expect(page.getByText('bob-reviewer', { exact: true })).toHaveCount(0);
});

test('REQ-5-3-2: REQ-5-3-2: Apply Labels to an Issue - Scenario 1', async ({ page }) => {
  await signIn(page, 'alice-dev');
  await openIssuesPage(page);

  const title = 'pw-label-' + u();
  await createIssue(page, title, 'Issue for label handling.');

  await page.getByRole('button', { name: 'Labels', exact: true }).click();
  await page.getByRole('option', { name: 'bug', exact: true }).click();
  await expect(page.getByText('bug', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('bug', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Labels', exact: true }).click();
  await page.getByRole('option', { name: 'bug', exact: true }).click();
  await page.reload();
  await expect(page.getByText('bug', { exact: true })).toHaveCount(0);
});

test('REQ-5-3-3: REQ-5-3-3: Assign Issues and Pull Requests to a Milestone - Scenario 1', async ({ page }) => {
  await signIn(page, 'alice-dev');
  await openIssuesPage(page);

  const title = 'pw-milestone-' + u();
  await createIssue(page, title, 'Issue for milestone handling.');

  await page.getByRole('button', { name: 'Milestone', exact: true }).click();
  await page.getByRole('option', { name: 'v1.0', exact: true }).click();
  await expect(page.getByText('v1.0', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('v1.0', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Milestone', exact: true }).click();
  await page.getByRole('option', { name: 'None', exact: true }).click();
  await page.reload();
  await expect(page.getByText('v1.0', { exact: true })).toHaveCount(0);
});

test('REQ-5-4: REQ-5-4: Close or Reopen an Issue - Scenario 1', async ({ page }) => {
  await signIn(page, 'alice-dev');
  await openIssuesPage(page);

  const title = 'pw-status-' + u();
  await createIssue(page, title, 'Status flow description.');

  await page.getByRole('button', { name: 'Close issue', exact: true }).click();
  await expect(page.getByText('Closed', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Reopen issue', exact: true }).click();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText('Status flow description.', { exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close issue', exact: true })).toBeVisible();
});

test('REQ-5-4#2: REQ-5-4: Close or Reopen an Issue - Scenario 2', async ({ page }) => {
  // A freshly registered account has no repository management permission: only public Read access.
  const username = 'pw-viewer-' + u();
  const email = username + '@example.test';
  await registerAndSignIn(page, username, email);

  await openIssuesPage(page);
  await openIssue(page, OPEN_ISSUE_TITLE);

  await expect(page.getByRole('button', { name: 'Close issue', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reopen issue', exact: true })).toHaveCount(0);
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

