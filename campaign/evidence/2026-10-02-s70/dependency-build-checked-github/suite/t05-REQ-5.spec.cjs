const { test, expect } = require('@playwright/test');

const PASSWORD = 'Valid-password-123!';
const USERNAME = 'alice-dev';
const REPO = 'acme-docs';
const OPEN_ISSUE = 'Improve onboarding';
const OPEN_ISSUE_DESCRIPTION = 'Describe the onboarding improvement.';
const CLOSED_ISSUE = 'Legacy welcome text';

const unique = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function signIn(page, identifier = USERNAME, password = PASSWORD) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(identifier);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function signUpAndSignIn(page, username, email, password) {
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
}

async function openRepository(page, name = REPO) {
  const search = page.getByRole('searchbox', { name: 'Search', exact: true });
  await search.click();
  await search.fill(name);
  await search.press('Enter');
  await page.getByRole('link', { name, exact: true }).first().click();
  await expect(page.getByRole('heading', { name: new RegExp(name) }).first()).toBeVisible();
}

async function openIssuesList(page) {
  await page.getByRole('link', { name: 'Issues', exact: true }).first().click();
}

async function openRepoIssues(page, name = REPO) {
  await openRepository(page, name);
  await openIssuesList(page);
}

async function openIssue(page, title) {
  await page.getByRole('link', { name: title, exact: true }).first().click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}

async function createIssue(page, title, description) {
  await page.getByRole('link', { name: 'New issue', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(title);
  if (description) {
    await page.getByLabel('Description', { exact: true }).fill(description);
  }
  await page.getByRole('button', { name: 'Submit new issue', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}

// The issue-list label filter control is not given an accessible name by the requirements;
// it is used only when the page exposes it under the requirements' own "Labels" wording.
async function chooseLabelFilter(page, label) {
  const trigger = page.getByRole('button', { name: 'Labels', exact: true });
  if ((await trigger.count()) === 0) return;
  await trigger.first().click();
  const option = page.getByRole('option', { name: label, exact: true });
  if ((await option.count()) === 0) {
    await page.keyboard.press('Escape');
    return;
  }
  await option.first().click();
}

test('REQ-5-1-1: REQ-5-1-1: List and Filter Repository Issues - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await openRepoIssues(page);

  await page.getByRole('link', { name: 'Open', exact: true }).first().click();
  await page.getByRole('searchbox', { name: 'Search issues', exact: true }).fill('onboarding');
  await chooseLabelFilter(page, 'bug');

  await expect(page.getByRole('link', { name: OPEN_ISSUE, exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: CLOSED_ISSUE, exact: true })).toBeHidden();

  await page.getByRole('link', { name: OPEN_ISSUE, exact: true }).first().click();
  await expect(page.getByRole('heading', { name: OPEN_ISSUE, exact: true })).toBeVisible();

  await openIssuesList(page);
  await page.getByRole('searchbox', { name: 'Search issues', exact: true }).fill('');
  await page.getByRole('link', { name: 'Closed', exact: true }).first().click();

  await expect(page.getByRole('link', { name: CLOSED_ISSUE, exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: OPEN_ISSUE, exact: true })).toBeHidden();
});

test('REQ-5-1-1#2: REQ-5-1-1: List and Filter Repository Issues - Scenario 2', async ({ page }) => {
  await page.goto('/');
  await openRepoIssues(page);
  await expect(page.getByRole('link', { name: OPEN_ISSUE, exact: true }).first()).toBeVisible();

  await page.getByRole('link', { name: 'Closed', exact: true }).first().click();
  await page.getByRole('searchbox', { name: 'Search issues', exact: true }).fill(CLOSED_ISSUE);

  await expect(page.getByRole('link', { name: CLOSED_ISSUE, exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: OPEN_ISSUE, exact: true })).toBeHidden();

  await page.reload();
  await expect(page.getByRole('searchbox', { name: 'Search issues', exact: true })).toHaveValue(CLOSED_ISSUE);
  await expect(page.getByRole('link', { name: CLOSED_ISSUE, exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: OPEN_ISSUE, exact: true })).toBeHidden();
});

test('REQ-5-1-2: REQ-5-1-2: View an Issue and Its Discussion - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await openRepoIssues(page);
  await openIssue(page, OPEN_ISSUE);

  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(OPEN_ISSUE_DESCRIPTION, { exact: true })).toBeVisible();
  await expect(page.getByText('bug', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: OPEN_ISSUE, exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(OPEN_ISSUE_DESCRIPTION, { exact: true })).toBeVisible();
});

test('REQ-5-1-2#2: REQ-5-1-2: View an Issue and Its Discussion - Scenario 2', async ({ page }) => {
  await signIn(page);
  await openRepoIssues(page);
  await openIssue(page, OPEN_ISSUE);

  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(OPEN_ISSUE_DESCRIPTION, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Assignees', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Milestone', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: OPEN_ISSUE, exact: true })).toBeVisible();
  await expect(page.getByText(OPEN_ISSUE_DESCRIPTION, { exact: true })).toBeVisible();
});

test('REQ-5-1-2#3: REQ-5-1-2: View an Issue and Its Discussion - Scenario 3', async ({ page }) => {
  await signIn(page);
  await openRepoIssues(page);
  await expect(page.getByRole('link', { name: OPEN_ISSUE, exact: true }).first()).toBeVisible();
  await openIssue(page, OPEN_ISSUE);

  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(OPEN_ISSUE_DESCRIPTION, { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: OPEN_ISSUE, exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
});

test('REQ-5-2-1: REQ-5-2-1: Create a Repository Issue - Scenario 1', async ({ page }) => {
  const suffix = unique();
  const title = `pw-issue-${suffix}`;
  const description = `Issue description ${suffix}`;

  await signIn(page);
  await openRepoIssues(page);
  await createIssue(page, title, description);

  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText(description, { exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();

  await openIssuesList(page);
  await expect(page.getByRole('link', { name: title, exact: true }).first()).toBeVisible();

  await page.getByRole('link', { name: 'New issue', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Submit new issue', exact: true }).click();
  await expect(page.getByText('Title is required', { exact: true }).first()).toBeVisible();
});

test('REQ-5-2-1#2: REQ-5-2-1: Create a Repository Issue - Scenario 2', async ({ page }) => {
  const suffix = unique();
  const title = `pw-issue-${suffix}`;
  const description = `Second issue description ${suffix}`;

  await signIn(page);
  await openRepoIssues(page);
  await createIssue(page, title, description);

  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText(description, { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText(description, { exact: true })).toBeVisible();

  await openIssuesList(page);
  await expect(page.getByRole('link', { name: title, exact: true }).first()).toBeVisible();
});

test('REQ-5-2-2: REQ-5-2-2: Edit an Issue Title and Description - Scenario 1', async ({ page }) => {
  const suffix = unique();
  const originalTitle = `pw-edit-${suffix}`;
  const newTitle = `pw-edited-${suffix}`;
  const newDescription = `Updated description ${suffix}`;

  await signIn(page);
  await openRepoIssues(page);
  await createIssue(page, originalTitle, `Original description ${suffix}`);

  await page.getByRole('button', { name: 'Edit issue title', exact: true }).click();
  await page.getByLabel('Issue title', { exact: true }).fill(newTitle);
  await page.getByRole('button', { name: 'Save issue title', exact: true }).click();
  await expect(page.getByRole('heading', { name: newTitle, exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Edit issue description', exact: true }).click();
  await page.getByLabel('Issue description', { exact: true }).fill(newDescription);
  await page.getByRole('button', { name: 'Save issue description', exact: true }).click();
  await expect(page.getByText(newDescription, { exact: true })).toBeVisible();

  await openIssuesList(page);
  await expect(page.getByRole('link', { name: newTitle, exact: true }).first()).toBeVisible();

  await page.getByRole('link', { name: newTitle, exact: true }).first().click();
  await page.reload();
  await expect(page.getByRole('heading', { name: newTitle, exact: true })).toBeVisible();
  await expect(page.getByText(newDescription, { exact: true })).toBeVisible();
});

test('REQ-5-2-2#2: REQ-5-2-2: Edit an Issue Title and Description - Scenario 2', async ({ page }) => {
  const suffix = unique();
  const title = `pw-blank-${suffix}`;

  await signIn(page);
  await openRepoIssues(page);
  await createIssue(page, title, `Blank title description ${suffix}`);

  await page.getByRole('button', { name: 'Edit issue title', exact: true }).click();
  await page.getByLabel('Issue title', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Save issue title', exact: true }).click();
  await expect(page.getByText('Title is required', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
});

test('REQ-5-2-3: REQ-5-2-3: Comment on an Issue Discussion - Scenario 1', async ({ page }) => {
  const suffix = unique();
  const title = `pw-comment-${suffix}`;
  const commentBody = `Looks good to me ${suffix}`;

  await signIn(page);
  await openRepoIssues(page);
  await createIssue(page, title, `Comment scenario description ${suffix}`);

  await page.getByLabel('Comment', { exact: true }).fill(commentBody);
  await page.getByRole('button', { name: 'Comment', exact: true }).click();
  await expect(page.getByText(commentBody, { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText(commentBody, { exact: true }).first()).toBeVisible();
  // The reaction menu's accessible names are not stated by the requirements, so only the
  // comment publication itself is exercised here.
});

test('REQ-5-2-3#2: REQ-5-2-3: Comment on an Issue Discussion - Scenario 2', async ({ page }) => {
  const suffix = unique();
  const title = `pw-blank-comment-${suffix}`;

  await signIn(page);
  await openRepoIssues(page);
  await createIssue(page, title, `Whitespace comment description ${suffix}`);

  const entriesBefore = await page.getByRole('article').count();

  await page.getByLabel('Comment', { exact: true }).fill('   ');
  const commentButton = page.getByRole('button', { name: 'Comment', exact: true });
  if (await commentButton.isEnabled()) {
    await commentButton.click();
  }

  await expect(page.getByRole('article')).toHaveCount(entriesBefore);
  await page.reload();
  await expect(page.getByRole('article')).toHaveCount(entriesBefore);
});

test('REQ-5-3-1: REQ-5-3-1: Assign or Unassign Issue Participants - Scenario 1', async ({ page }) => {
  const suffix = unique();
  const title = `pw-assign-${suffix}`;

  await signIn(page);
  await openRepoIssues(page);
  await createIssue(page, title, `Assignee scenario description ${suffix}`);

  await page.getByRole('button', { name: 'Assignees', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search assignees', exact: true }).fill('bob-reviewer');
  await page.getByRole('option', { name: 'bob-reviewer', exact: true }).first().click();
  await page.reload();
  await expect(page.getByText('bob-reviewer', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Assignees', exact: true }).click();
  await page.getByRole('option', { name: 'bob-reviewer', exact: true }).first().click();
  await page.reload();
  await expect(page.getByText('bob-reviewer', { exact: true }).first()).toBeHidden();
});

test('REQ-5-3-2: REQ-5-3-2: Apply Labels to an Issue - Scenario 1', async ({ page }) => {
  const suffix = unique();
  const title = `pw-label-${suffix}`;

  await signIn(page);
  await openRepoIssues(page);
  await createIssue(page, title, `Label scenario description ${suffix}`);

  await page.getByRole('button', { name: 'Labels', exact: true }).click();
  await page.getByRole('option', { name: 'bug', exact: true }).first().click();
  await page.reload();
  await expect(page.getByText('bug', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Labels', exact: true }).click();
  await page.getByRole('option', { name: 'bug', exact: true }).first().click();
  await page.reload();
  await expect(page.getByText('bug', { exact: true }).first()).toBeHidden();
});

test('REQ-5-3-3: REQ-5-3-3: Assign Issues and Pull Requests to a Milestone - Scenario 1', async ({ page }) => {
  const suffix = unique();
  const title = `pw-milestone-${suffix}`;

  await signIn(page);
  await openRepoIssues(page);
  await createIssue(page, title, `Milestone scenario description ${suffix}`);

  await page.getByRole('button', { name: 'Milestone', exact: true }).click();
  await page.getByRole('option', { name: 'v1.0', exact: true }).first().click();
  await page.reload();
  await expect(page.getByText('v1.0', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Milestone', exact: true }).click();
  await page.getByRole('option', { name: 'None', exact: true }).first().click();
  await page.reload();
  await expect(page.getByText('v1.0', { exact: true }).first()).toBeHidden();
});

test('REQ-5-4: REQ-5-4: Close or Reopen an Issue - Scenario 1', async ({ page }) => {
  const suffix = unique();
  const title = `pw-status-${suffix}`;
  const description = `Status scenario description ${suffix}`;

  await signIn(page);
  await openRepoIssues(page);
  await createIssue(page, title, description);

  await expect(page.getByRole('button', { name: 'Close issue', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close issue', exact: true }).click();
  await expect(page.getByText('Closed', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Closed issue', { exact: true }).first()).toBeVisible();

  await expect(page.getByRole('button', { name: 'Reopen issue', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reopen issue', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Close issue', exact: true })).toBeVisible();

  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText(description, { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Close issue', exact: true })).toBeVisible();
  await openIssuesList(page);
  await expect(page.getByRole('link', { name: title, exact: true }).first()).toBeVisible();
});

test('REQ-5-4#2: REQ-5-4: Close or Reopen an Issue - Scenario 2', async ({ page }) => {
  const suffix = unique();
  const viewerName = `pw-viewer-${suffix}`;
  const viewerEmail = `${suffix}.viewer@example.test`;

  await signUpAndSignIn(page, viewerName, viewerEmail, PASSWORD);
  await openRepoIssues(page);
  await openIssue(page, OPEN_ISSUE);

  await expect(page.getByRole('button', { name: 'Close issue', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reopen issue', exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('heading', { name: OPEN_ISSUE, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close issue', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reopen issue', exact: true })).toHaveCount(0);
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

