const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const PASSWORD = 'Valid-password-123!';

// Sign in from the home page with the documented fields and button.
async function signIn(page, email, username) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText(username, { exact: true }).first()).toBeVisible();
}

// Locate and open a repository through the top global Search box (readable
// by both visitors and signed-in users).
async function openRepository(page, repoName) {
  const search = page.getByRole('searchbox', { name: 'Search', exact: true });
  await expect(search).toBeVisible();
  await search.fill(repoName);
  await search.press('Enter');
  const link = page.getByRole('link', { name: repoName, exact: true });
  await expect(link).toBeVisible();
  await link.click();
}

// Open the repository Issues page.
async function openIssuesPage(page, repoName) {
  await openRepository(page, repoName);
  await page.getByRole('link', { name: 'Issues', exact: true }).click();
}

// Open a single issue from the repository Issues page using the
// "Search issues" filter.
async function openIssue(page, repoName, issueTitle) {
  await openIssuesPage(page, repoName);
  const search = page.getByRole('searchbox', { name: 'Search issues', exact: true });
  await expect(search).toBeVisible();
  await search.fill(issueTitle);
  const link = page.getByRole('link', { name: issueTitle, exact: true });
  await expect(link).toBeVisible();
  await link.click();
}

// ---------------------------------------------------------------------------
// REQ-5-1-1 List and Filter Repository Issues
// ---------------------------------------------------------------------------

test('REQ-5-1-1: REQ-5-1-1: List and Filter Repository Issues - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await openIssuesPage(page, 'acme-docs');

  await page.getByRole('link', { name: 'Open', exact: true }).click();

  const issueSearch = page.getByRole('searchbox', { name: 'Search issues', exact: true });
  await expect(issueSearch).toBeVisible();
  await issueSearch.fill('Improve onboarding');

  await expect(page.getByRole('link', { name: 'Improve onboarding', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('link', { name: 'Improve onboarding', exact: true })).toBeVisible();
});

test('REQ-5-1-1#2: REQ-5-1-1: List and Filter Repository Issues - Scenario 2', async ({ page }) => {
  await page.goto('/');
  await openIssuesPage(page, 'acme-docs');

  await page.getByRole('link', { name: 'Closed', exact: true }).click();

  const issueSearch = page.getByRole('searchbox', { name: 'Search issues', exact: true });
  await expect(issueSearch).toBeVisible();
  await issueSearch.fill('Legacy welcome text');

  await expect(page.getByRole('link', { name: 'Legacy welcome text', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Improve onboarding', exact: true })).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// REQ-5-1-2 View an Issue and Its Discussion
// ---------------------------------------------------------------------------

test('REQ-5-1-2: REQ-5-1-2: View an Issue and Its Discussion - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await openIssue(page, 'acme-docs', 'Improve onboarding');

  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await expect(page.getByText('Describe the onboarding improvement.', { exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Comment|Activity/).first()).toBeVisible();
});

test('REQ-5-1-2#2: REQ-5-1-2: View an Issue and Its Discussion - Scenario 2', async ({ page }) => {
  await page.goto('/');
  await openIssue(page, 'acme-docs', 'Improve onboarding');

  await page.reload();

  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await expect(page.getByText('Describe the onboarding improvement.', { exact: true })).toBeVisible();
});

test('REQ-5-1-2#3: REQ-5-1-2: View an Issue and Its Discussion - Scenario 3', async ({ page }) => {
  await page.goto('/');
  await openIssue(page, 'acme-docs', 'Improve onboarding');

  await page.goto('/');
  await openIssue(page, 'acme-docs', 'Improve onboarding');

  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
});

// ---------------------------------------------------------------------------
// REQ-5-2-1 Create a Repository Issue
// ---------------------------------------------------------------------------

test('REQ-5-2-1: REQ-5-2-1: Create a Repository Issue - Scenario 1', async ({ page }) => {
  const title = 'Playwright onboarding ' + u();
  const body = 'Issue body created by Playwright ' + u();

  await signIn(page, 'issue-author@example.test', 'issue-author');
  await openIssuesPage(page, 'acme-docs');

  await page.getByRole('link', { name: 'New issue', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Description', { exact: true }).fill(body);
  await page.getByRole('button', { name: 'Submit new issue', exact: true }).click();

  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText(body, { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Issues', exact: true }).click();
  await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();
});

test('REQ-5-2-1#2: REQ-5-2-1: Create a Repository Issue - Scenario 2', async ({ page }) => {
  await signIn(page, 'issue-author@example.test', 'issue-author');
  await openIssuesPage(page, 'acme-docs');

  await page.getByRole('link', { name: 'New issue', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Submit new issue', exact: true }).click();

  await expect(page.getByText(/required/i).first()).toBeVisible();
  // Still on the creation form: no issue was created.
  await expect(page.getByRole('button', { name: 'Submit new issue', exact: true })).toBeVisible();
});

// ---------------------------------------------------------------------------
// REQ-5-2-2 Edit an Issue Title and Description
// ---------------------------------------------------------------------------

test('REQ-5-2-2: REQ-5-2-2: Edit an Issue Title and Description - Scenario 1', async ({ page }) => {
  const newTitle = 'Edited onboarding title ' + u();
  const newBody = 'Edited onboarding description ' + u();

  await signIn(page, 'issue-editor@example.test', 'issue-editor');
  await openIssue(page, 'acme-docs', 'Editable onboarding issue');

  await page.getByRole('button', { name: 'Edit issue title', exact: true }).click();
  await page.getByLabel('Issue title', { exact: true }).fill(newTitle);
  await page.getByRole('button', { name: 'Save issue title', exact: true }).click();

  await page.getByRole('button', { name: 'Edit issue description', exact: true }).click();
  await page.getByLabel('Issue description', { exact: true }).fill(newBody);
  await page.getByRole('button', { name: 'Save issue description', exact: true }).click();

  await page.reload();
  await expect(page.getByRole('heading', { name: newTitle, exact: true })).toBeVisible();
  await expect(page.getByText(newBody, { exact: true })).toBeVisible();
});

test('REQ-5-2-2#2: REQ-5-2-2: Edit an Issue Title and Description - Scenario 2', async ({ page }) => {
  await signIn(page, 'issue-editor@example.test', 'issue-editor');
  await openIssue(page, 'acme-docs', 'Original issue title');

  await page.getByRole('button', { name: 'Edit issue title', exact: true }).click();
  await page.getByLabel('Issue title', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Save issue title', exact: true }).click();

  await expect(page.getByText(/required|empty/i).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Original issue title', exact: true })).toBeVisible();
});

// ---------------------------------------------------------------------------
// REQ-5-2-3 Comment on an Issue Discussion
// ---------------------------------------------------------------------------

test('REQ-5-2-3: REQ-5-2-3: Comment on an Issue Discussion - Scenario 1', async ({ page }) => {
  const comment = 'Playwright comment ' + u();

  await signIn(page, 'issue-commenter@example.test', 'issue-commenter');
  await openIssue(page, 'acme-docs', 'Commentable onboarding issue');

  await page.getByLabel('Comment', { exact: true }).fill(comment);
  await page.getByRole('button', { name: 'Comment', exact: true }).click();

  await expect(page.getByText(comment, { exact: true })).toBeVisible();
  await expect(page.getByText('issue-commenter', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText(comment, { exact: true })).toBeVisible();
});

test('REQ-5-2-3#2: REQ-5-2-3: Comment on an Issue Discussion - Scenario 2', async ({ page }) => {
  await signIn(page, 'issue-commenter@example.test', 'issue-commenter');
  await openIssue(page, 'acme-docs', 'Comment validation issue');

  const articles = page.getByRole('article');
  const before = await articles.count();

  await page.getByLabel('Comment', { exact: true }).fill('   ');
  const commentButton = page.getByRole('button', { name: 'Comment', exact: true });
  if (await commentButton.isDisabled()) {
    await expect(commentButton).toBeDisabled();
  } else {
    await commentButton.click();
    await expect(page.getByText(/required|empty/i).first()).toBeVisible();
  }

  await page.reload();
  await expect(page.getByRole('article')).toHaveCount(before);
});

// ---------------------------------------------------------------------------
// REQ-5-3-1 Assign or Unassign Issue Participants
// ---------------------------------------------------------------------------

test('REQ-5-3-1: REQ-5-3-1: Assign or Unassign Issue Participants - Scenario 1', async ({ page }) => {
  await signIn(page, 'issue-editor@example.test', 'issue-editor');
  await openIssue(page, 'acme-docs', 'Assignable onboarding issue');

  // Assign.
  await page.getByRole('button', { name: 'Assignees', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search assignees', exact: true }).fill('bob-reviewer');
  await page.getByRole('option', { name: 'bob-reviewer', exact: true }).click();

  await page.reload();
  await expect(page.getByText('bob-reviewer', { exact: true }).first()).toBeVisible();

  // Unassign by selecting the same option again.
  await page.getByRole('button', { name: 'Assignees', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search assignees', exact: true }).fill('bob-reviewer');
  await page.getByRole('option', { name: 'bob-reviewer', exact: true }).click();

  await page.reload();
  await expect(page.getByText('bob-reviewer', { exact: true })).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// REQ-5-3-2 Apply Labels to an Issue
// ---------------------------------------------------------------------------

test('REQ-5-3-2: REQ-5-3-2: Apply Labels to an Issue - Scenario 1', async ({ page }) => {
  await signIn(page, 'issue-editor@example.test', 'issue-editor');
  await openIssue(page, 'acme-docs', 'Labelable onboarding issue');

  await page.getByRole('button', { name: 'Labels', exact: true }).click();
  await page.getByRole('option', { name: 'bug', exact: true }).click();

  await page.reload();
  await expect(page.getByText('bug', { exact: true }).first()).toBeVisible();
});

// ---------------------------------------------------------------------------
// REQ-5-3-3 Assign Issues and Pull Requests to a Milestone
// ---------------------------------------------------------------------------

test('REQ-5-3-3: REQ-5-3-3: Assign Issues and Pull Requests to a Milestone - Scenario 1', async ({ page }) => {
  await signIn(page, 'issue-editor@example.test', 'issue-editor');
  await openIssue(page, 'acme-docs', 'Milestone onboarding issue');

  await page.getByRole('button', { name: 'Milestone', exact: true }).click();
  await page.getByRole('option', { name: 'v1.0', exact: true }).click();

  await page.reload();
  await expect(page.getByText('v1.0', { exact: true }).first()).toBeVisible();
});

// ---------------------------------------------------------------------------
// REQ-5-4 Close or Reopen an Issue
// ---------------------------------------------------------------------------

test('REQ-5-4: REQ-5-4: Close or Reopen an Issue - Scenario 1', async ({ page }) => {
  await signIn(page, 'issue-editor@example.test', 'issue-editor');
  await openIssue(page, 'acme-docs', 'Closable onboarding issue');

  await page.getByRole('button', { name: 'Close issue', exact: true }).click();
  await expect(page.getByText('Closed', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/closed/i).first()).toBeVisible();

  await page.getByRole('button', { name: 'Reopen issue', exact: true }).click();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Close issue', exact: true })).toBeVisible();
});

test('REQ-5-4#2: REQ-5-4: Close or Reopen an Issue - Scenario 2', async ({ page }) => {
  await signIn(page, 'issue-viewer@example.test', 'issue-viewer');
  await openIssue(page, 'acme-docs', 'Protected onboarding issue');

  await expect(page.getByRole('button', { name: 'Close issue', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reopen issue', exact: true })).toHaveCount(0);
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

