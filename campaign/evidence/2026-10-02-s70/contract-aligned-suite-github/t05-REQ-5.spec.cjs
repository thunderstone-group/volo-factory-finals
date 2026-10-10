// @playwright/test end-to-end acceptance tests for REQ-5 (Work Planning and Issue Management)
const { test, expect } = require('@playwright/test');

const REPO = 'acme-docs';
const ACCOUNT = { email: 'alice.dev@example.test', password: 'Valid-password-123!' };
const OPEN_ISSUE = 'Improve onboarding';
const OPEN_ISSUE_DESCRIPTION = 'Describe the onboarding improvement.';
const CLOSED_ISSUE = 'Legacy welcome text';

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function signIn(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(ACCOUNT.email);
  await page.getByLabel('Password', { exact: true }).fill(ACCOUNT.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
}

async function openRepository(page, name = REPO) {
  await page.getByRole('searchbox', { name: 'Search', exact: true }).fill(name);
  await page.getByRole('searchbox', { name: 'Search', exact: true }).press('Enter');
  await page.getByRole('link', { name, exact: true }).first().click();
}

async function openIssues(page, name = REPO) {
  await openRepository(page, name);
  await page.getByRole('link', { name: 'Issues', exact: true }).click();
}

async function openIssue(page, title) {
  await page.getByRole('link', { name: title, exact: true }).first().click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}

async function createIssue(page, title, description) {
  await page.getByRole('link', { name: 'New issue', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(title);
  if (description) await page.getByLabel('Description', { exact: true }).fill(description);
  await page.getByRole('button', { name: 'Submit new issue', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}

// Reads the selected/unselected state of a picker item (role option or a checkbox inside it).
async function optionIsSelected(option) {
  const aria = (await option.getAttribute('aria-selected'))
    ?? (await option.getAttribute('aria-checked'));
  if (aria !== null) return aria === 'true';
  const box = option.getByRole('checkbox');
  if (await box.count()) return await box.first().isChecked();
  return false;
}

async function expectOptionSelected(option, selected) {
  await expect.poll(() => optionIsSelected(option)).toBe(selected);
}

test('REQ-5-1-1: List and Filter Repository Issues - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await openIssues(page);

  await page.getByRole('link', { name: 'Open', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search issues', exact: true }).fill(OPEN_ISSUE);
  await page.getByRole('link', { name: 'bug', exact: true }).first().click();

  await expect(page.getByRole('link', { name: OPEN_ISSUE, exact: true })).toBeVisible();
  await expect(page.getByText('bug', { exact: true }).first()).toBeVisible();

  await openIssue(page, OPEN_ISSUE);

  await page.goBack();
  await page.getByRole('link', { name: 'Closed', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search issues', exact: true }).fill(CLOSED_ISSUE);
  await expect(page.getByRole('link', { name: CLOSED_ISSUE, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: OPEN_ISSUE, exact: true })).toHaveCount(0);
});

test('REQ-5-1-1#2: List and Filter Repository Issues - Scenario 2', async ({ page }) => {
  await page.goto('/');
  await openIssues(page);

  await page.getByRole('link', { name: 'Closed', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search issues', exact: true }).fill(CLOSED_ISSUE);

  await expect(page.getByRole('link', { name: CLOSED_ISSUE, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: OPEN_ISSUE, exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('link', { name: CLOSED_ISSUE, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: OPEN_ISSUE, exact: true })).toHaveCount(0);
  await expect(page.getByRole('searchbox', { name: 'Search issues', exact: true })).toHaveValue(CLOSED_ISSUE);
});

test('REQ-5-1-2: View an Issue and Its Discussion - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await openIssues(page);
  await openIssue(page, OPEN_ISSUE);

  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(OPEN_ISSUE_DESCRIPTION, { exact: true })).toBeVisible();
  await expect(page.getByText('bug', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Q3 launch', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: OPEN_ISSUE, exact: true })).toBeVisible();
  await expect(page.getByText(OPEN_ISSUE_DESCRIPTION, { exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
});

test('REQ-5-1-2#2: View an Issue and Its Discussion - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openIssues(page);
  await openIssue(page, OPEN_ISSUE);

  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(OPEN_ISSUE_DESCRIPTION, { exact: true })).toBeVisible();
  await expect(page.getByText('bug', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Q3 launch', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: OPEN_ISSUE, exact: true })).toBeVisible();
  await expect(page.getByText(OPEN_ISSUE_DESCRIPTION, { exact: true })).toBeVisible();
});

test('REQ-5-1-2#3: View an Issue and Its Discussion - Scenario 3', async ({ page }) => {
  await signIn(page);
  await openIssues(page);
  await openIssue(page, OPEN_ISSUE);
  await expect(page.getByText(OPEN_ISSUE_DESCRIPTION, { exact: true })).toBeVisible();

  // Reopen the same issue from the list and check the persisted record again.
  await page.getByRole('link', { name: 'Issues', exact: true }).click();
  await openIssue(page, OPEN_ISSUE);

  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(OPEN_ISSUE_DESCRIPTION, { exact: true })).toBeVisible();
  await expect(page.getByText('bug', { exact: true }).first()).toBeVisible();
});

test('REQ-5-2-1: Create a Repository Issue - Scenario 1', async ({ page }) => {
  await signIn(page);
  await openIssues(page);

  const title = `pw-issue-${u()}`;
  const description = `Created by Playwright ${u()}`;
  await createIssue(page, title, description);

  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(description, { exact: true })).toBeVisible();
  await expect(page.getByText('alice-dev', { exact: true }).first()).toBeVisible();

  await page.getByRole('link', { name: 'Issues', exact: true }).click();
  await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();

  // A whitespace-only title is blank and must not create an issue.
  await page.getByRole('link', { name: 'New issue', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Submit new issue', exact: true }).click();
  await expect(page.getByText('Title is required', { exact: true })).toBeVisible();
});

test('REQ-5-2-1#2: Create a Repository Issue - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openIssues(page);

  const title = `pw-new-issue-${u()}`;
  const description = `Issue body ${u()}`;
  await createIssue(page, title, description);

  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText(description, { exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText(description, { exact: true })).toBeVisible();
});

test('REQ-5-2-2: Edit an Issue Title and Description - Scenario 1', async ({ page }) => {
  await signIn(page);
  await openIssues(page);

  const originalTitle = `pw-edit-${u()}`;
  await createIssue(page, originalTitle, `Original description ${u()}`);

  const newTitle = `${originalTitle}-updated`;
  const newDescription = `Updated description ${u()}`;

  await page.getByRole('button', { name: 'Edit issue title', exact: true }).click();
  await page.getByLabel('Issue title', { exact: true }).fill(newTitle);
  await page.getByRole('button', { name: 'Save issue title', exact: true }).click();
  await expect(page.getByRole('heading', { name: newTitle, exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Edit issue description', exact: true }).click();
  await page.getByLabel('Issue description', { exact: true }).fill(newDescription);
  await page.getByRole('button', { name: 'Save issue description', exact: true }).click();
  await expect(page.getByText(newDescription, { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: newTitle, exact: true })).toBeVisible();
  await expect(page.getByText(newDescription, { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Issues', exact: true }).click();
  await expect(page.getByRole('link', { name: newTitle, exact: true })).toBeVisible();
});

test('REQ-5-2-2#2: Edit an Issue Title and Description - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openIssues(page);

  const originalTitle = `pw-blank-title-${u()}`;
  await createIssue(page, originalTitle, `Description kept ${u()}`);

  await page.getByRole('button', { name: 'Edit issue title', exact: true }).click();
  await page.getByLabel('Issue title', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Save issue title', exact: true }).click();
  await expect(page.getByText('Title is required', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: originalTitle, exact: true })).toBeVisible();
});

test('REQ-5-2-3: Comment on an Issue Discussion - Scenario 1', async ({ page }) => {
  await signIn(page);
  await openIssues(page);
  await openIssue(page, OPEN_ISSUE);

  const body = `Looks good to me ${u()}`;
  await page.getByLabel('Comment', { exact: true }).fill(body);
  await page.getByRole('button', { name: 'Comment', exact: true }).click();

  await expect(page.getByText(body, { exact: true })).toBeVisible();
  await expect(page.getByText('alice-dev', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText(body, { exact: true })).toBeVisible();
});

test('REQ-5-2-3#2: Comment on an Issue Discussion - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openIssues(page);
  await openIssue(page, OPEN_ISSUE);

  const before = await page.getByRole('article').count();

  await page.getByLabel('Comment', { exact: true }).fill('   ');
  const submit = page.getByRole('button', { name: 'Comment', exact: true });
  if (await submit.isEnabled()) {
    await submit.click();
  }

  await page.reload();
  await expect(page.getByRole('article')).toHaveCount(before);
});

test('REQ-5-3-1: Assign or Unassign Issue Participants - Scenario 1', async ({ page }) => {
  await signIn(page);
  await openIssues(page);

  const title = `pw-assignee-${u()}`;
  await createIssue(page, title, 'Assignee scenario');

  await page.getByRole('button', { name: 'Assignees', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search assignees', exact: true }).fill('bob-reviewer');
  await page.getByRole('option', { name: 'bob-reviewer', exact: true }).click();
  await expect(page.getByText('bob-reviewer', { exact: true }).first()).toBeVisible();

  await page.reload();
  // Reopening Assignees shows the selected member without another search.
  await page.getByRole('button', { name: 'Assignees', exact: true }).click();
  const selected = page.getByRole('option', { name: 'bob-reviewer', exact: true });
  await expect(selected).toBeVisible();
  await expectOptionSelected(selected, true);
  await selected.click();

  await page.reload();
  await page.getByRole('button', { name: 'Assignees', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search assignees', exact: true }).fill('bob-reviewer');
  const removed = page.getByRole('option', { name: 'bob-reviewer', exact: true });
  await expect(removed).toBeVisible();
  await expectOptionSelected(removed, false);
});

test('REQ-5-3-2: Apply Labels to an Issue - Scenario 1', async ({ page }) => {
  await signIn(page);
  await openIssues(page);

  const title = `pw-label-${u()}`;
  await createIssue(page, title, 'Label scenario');

  await page.getByRole('button', { name: 'Labels', exact: true }).click();
  await page.getByRole('option', { name: 'bug', exact: true }).click();
  await expect(page.getByText('bug', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('bug', { exact: true }).first()).toBeVisible();

  // Reopening the selector and selecting the same option removes the association.
  await page.getByRole('button', { name: 'Labels', exact: true }).click();
  await expectOptionSelected(page.getByRole('option', { name: 'bug', exact: true }), true);
  await page.getByRole('option', { name: 'bug', exact: true }).click();

  await page.reload();
  await page.getByRole('button', { name: 'Labels', exact: true }).click();
  await expectOptionSelected(page.getByRole('option', { name: 'bug', exact: true }), false);
});

test('REQ-5-3-3: Assign Issues and Pull Requests to a Milestone - Scenario 1', async ({ page }) => {
  await signIn(page);
  await openIssues(page);

  const title = `pw-milestone-${u()}`;
  await createIssue(page, title, 'Milestone scenario');

  await page.getByRole('button', { name: 'Milestone', exact: true }).click();
  await page.getByRole('option', { name: 'v1.0', exact: true }).click();
  await expect(page.getByText('v1.0', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('v1.0', { exact: true }).first()).toBeVisible();

  // Selecting "None" removes the association.
  await page.getByRole('button', { name: 'Milestone', exact: true }).click();
  await expectOptionSelected(page.getByRole('option', { name: 'v1.0', exact: true }), true);
  await page.getByRole('option', { name: 'None', exact: true }).click();

  await page.reload();
  await page.getByRole('button', { name: 'Milestone', exact: true }).click();
  await expectOptionSelected(page.getByRole('option', { name: 'None', exact: true }), true);
  await expectOptionSelected(page.getByRole('option', { name: 'v1.0', exact: true }), false);
});

test('REQ-5-4: Close or Reopen an Issue - Scenario 1', async ({ page }) => {
  await signIn(page);
  await openIssues(page);

  const title = `pw-status-${u()}`;
  const description = `Status scenario ${u()}`;
  await createIssue(page, title, description);

  await page.getByRole('button', { name: 'Close issue', exact: true }).click();
  await expect(page.getByText('Closed', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Reopen issue', exact: true }).click();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText(description, { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close issue', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
});

test('REQ-5-4#2: Close or Reopen an Issue - Scenario 2', async ({ page }) => {
  // A read-only signed-in account's credentials are not given by the requirements; a
  // visitor session also has no issue-management permission on this public repository.
  await page.goto('/');
  await openIssues(page);
  await openIssue(page, OPEN_ISSUE);

  await expect(page.getByRole('button', { name: 'Close issue', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reopen issue', exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close issue', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reopen issue', exact: true })).toHaveCount(0);
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

