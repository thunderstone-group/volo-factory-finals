const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function signIn(page, username = 'alice-dev', password = 'Valid-password-123!') {
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
}

async function openRepository(page, name = 'acme-docs') {
  await page.goto('/');
  const search = page.getByRole('searchbox', { name: 'Search', exact: true });
  await search.fill(name);
  await search.press('Enter');
  await page.getByRole('link', { name, exact: true }).click();
  await expect(page.getByRole('link', { name: 'Code', exact: true })).toBeVisible();
}

async function openRepoIssues(page, signedIn = false) {
  if (signedIn) {
    await page.goto('/');
    await signIn(page);
  }
  await openRepository(page);
  await page.getByRole('link', { name: 'Issues', exact: true }).click();
  await expect(page.getByRole('searchbox', { name: 'Search issues', exact: true })).toBeVisible();
}

async function createIssue(page, title, description = '') {
  await openRepoIssues(page, true);
  await page.getByRole('link', { name: 'New issue', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(title);
  if (description) {
    await page.getByLabel('Description', { exact: true }).fill(description);
  }
  await page.getByRole('button', { name: 'Submit new issue', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}

test('REQ-5-1-1: REQ-5-1-1: List and Filter Repository Issues - Scenario 1', async ({ page }) => {
  await openRepoIssues(page);
  await page.getByRole('link', { name: 'Open', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search issues', exact: true }).fill('onboarding');
  await expect(page.getByRole('link', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Improve onboarding', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Issues', exact: true }).click();
  await page.getByRole('link', { name: 'Closed', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search issues', exact: true }).fill('Legacy');
  await expect(page.getByRole('link', { name: 'Legacy welcome text', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Improve onboarding', exact: true })).not.toBeVisible();
});

test('REQ-5-1-1#2: REQ-5-1-1: List and Filter Repository Issues - Scenario 2', async ({ page }) => {
  await openRepoIssues(page);
  await page.getByRole('link', { name: 'Closed', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search issues', exact: true }).fill('Legacy welcome text');
  await expect(page.getByRole('link', { name: 'Legacy welcome text', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Improve onboarding', exact: true })).not.toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Legacy welcome text', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Improve onboarding', exact: true })).not.toBeVisible();
});

test('REQ-5-1-2: REQ-5-1-2: View an Issue and Its Discussion - Scenario 1', async ({ page }) => {
  await openRepoIssues(page);
  await page.getByRole('link', { name: 'Improve onboarding', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true })).toBeVisible();
  await expect(page.getByText('Describe the onboarding improvement.', { exact: true })).toBeVisible();
  await expect(page.getByText('bug', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('documentation', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Q3 launch', { exact: true }).first()).toBeVisible();
});

test('REQ-5-1-2#2: REQ-5-1-2: View an Issue and Its Discussion - Scenario 2', async ({ page }) => {
  await openRepoIssues(page, true);
  await page.getByRole('link', { name: 'Improve onboarding', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true })).toBeVisible();
  await expect(page.getByText('Describe the onboarding improvement.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true })).toBeVisible();
  await expect(page.getByText('Describe the onboarding improvement.', { exact: true })).toBeVisible();
});

test('REQ-5-1-2#3: REQ-5-1-2: View an Issue and Its Discussion - Scenario 3', async ({ page }) => {
  await openRepoIssues(page, true);
  await page.getByRole('link', { name: 'Improve onboarding', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true })).toBeVisible();
  await expect(page.getByText('Describe the onboarding improvement.', { exact: true })).toBeVisible();
});

test('REQ-5-2-1: REQ-5-2-1: Create a Repository Issue - Scenario 1', async ({ page }) => {
  const title = `Created issue ${u()}`;
  const description = 'Created by Playwright';
  await openRepoIssues(page, true);
  await page.getByRole('link', { name: 'New issue', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Description', { exact: true }).fill(description);
  await page.getByRole('button', { name: 'Submit new issue', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true })).toBeVisible();
  await expect(page.getByText(description, { exact: true })).toBeVisible();
  await expect(page.getByText('alice-dev', { exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Issues', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search issues', exact: true }).fill(title);
  await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();
});

test('REQ-5-2-1#2: REQ-5-2-1: Create a Repository Issue - Scenario 2', async ({ page }) => {
  const title = `Created issue ${u()}`;
  await createIssue(page, title, 'Generic create workflow');
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
});

test('REQ-5-2-2: REQ-5-2-2: Edit an Issue Title and Description - Scenario 1', async ({ page }) => {
  const originalTitle = `Editable issue ${u()}`;
  const updatedTitle = `Updated issue ${u()}`;
  await createIssue(page, originalTitle, 'Original description');
  await page.getByRole('button', { name: 'Edit issue title', exact: true }).click();
  await page.getByLabel('Issue title', { exact: true }).fill(updatedTitle);
  await page.getByRole('button', { name: 'Save issue title', exact: true }).click();
  await expect(page.getByRole('heading', { name: updatedTitle, exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Edit issue description', exact: true }).click();
  await page.getByLabel('Issue description', { exact: true }).fill('Updated description by Playwright');
  await page.getByRole('button', { name: 'Save issue description', exact: true }).click();
  await expect(page.getByText('Updated description by Playwright', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: updatedTitle, exact: true })).toBeVisible();
  await expect(page.getByText('Updated description by Playwright', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Issues', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search issues', exact: true }).fill(updatedTitle);
  await expect(page.getByRole('link', { name: updatedTitle, exact: true })).toBeVisible();
});

test('REQ-5-2-2#2: REQ-5-2-2: Edit an Issue Title and Description - Scenario 2', async ({ page }) => {
  await openRepoIssues(page, true);
  await page.getByRole('searchbox', { name: 'Search issues', exact: true }).fill('Original issue title');
  await page.getByRole('link', { name: 'Original issue title', exact: true }).click();
  await page.getByRole('button', { name: 'Edit issue title', exact: true }).click();
  await page.getByLabel('Issue title', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Save issue title', exact: true }).click();
  await expect(page.getByText('Title is required', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Original issue title', exact: true })).toBeVisible();
});

test('REQ-5-2-3: REQ-5-2-3: Comment on an Issue Discussion - Scenario 1', async ({ page }) => {
  const title = `Comment issue ${u()}`;
  const firstComment = `First comment ${u()}`;
  const secondComment = `Second comment ${u()}`;
  await createIssue(page, title, 'Discussion seed');
  await page.getByLabel('Comment', { exact: true }).fill(firstComment);
  await page.getByRole('button', { name: 'Comment', exact: true }).click();
  await expect(page.getByText(firstComment, { exact: true })).toBeVisible();
  await page.getByLabel('Comment', { exact: true }).fill(secondComment);
  await page.getByRole('button', { name: 'Comment', exact: true }).click();
  await expect(page.getByText(secondComment, { exact: true })).toBeVisible();
  await expect(page.getByText('alice-dev', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(secondComment, { exact: true })).toBeVisible();
});

test('REQ-5-2-3#2: REQ-5-2-3: Comment on an Issue Discussion - Scenario 2', async ({ page }) => {
  const title = `Whitespace comment issue ${u()}`;
  await createIssue(page, title, '');
  const before = await page.getByRole('article').count();
  await page.getByLabel('Comment', { exact: true }).fill('   ');
  const submit = page.getByRole('button', { name: 'Comment', exact: true });
  if (await submit.isDisabled()) {
    // The requirements allow the Comment button to be disabled for whitespace-only input.
  } else {
    await submit.click();
    await expect(page.getByText('Comment is required', { exact: true })).toBeVisible();
  }
  await page.reload();
  await expect(page.getByRole('article')).toHaveCount(before);
});

test('REQ-5-3-1: REQ-5-3-1: Assign or Unassign Issue Participants - Scenario 1', async ({ page }) => {
  const title = `Assignee issue ${u()}`;
  await createIssue(page, title, '');
  await page.getByRole('button', { name: 'Assignees', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search assignees', exact: true }).fill('bob-reviewer');
  await page.getByRole('option', { name: 'bob-reviewer', exact: true }).click();
  await expect(page.getByText('bob-reviewer', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('bob-reviewer', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Assignees', exact: true }).click();
  await page.getByRole('option', { name: 'bob-reviewer', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
});

test('REQ-5-3-2: REQ-5-3-2: Apply Labels to an Issue - Scenario 1', async ({ page }) => {
  const title = `Label issue ${u()}`;
  await createIssue(page, title, '');
  await page.getByRole('button', { name: 'Labels', exact: true }).click();
  await page.getByRole('option', { name: 'bug', exact: true }).click();
  await expect(page.getByText('bug', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('bug', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Labels', exact: true }).click();
  await page.getByRole('option', { name: 'bug', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
});

test('REQ-5-3-3: REQ-5-3-3: Assign Issues and Pull Requests to a Milestone - Scenario 1', async ({ page }) => {
  const title = `Milestone issue ${u()}`;
  await createIssue(page, title, '');
  await page.getByRole('button', { name: 'Milestone', exact: true }).click();
  await page.getByRole('option', { name: 'v1.0', exact: true }).click();
  await expect(page.getByText('v1.0', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('v1.0', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Milestone', exact: true }).click();
  await page.getByRole('option', { name: 'None', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
});

test('REQ-5-4: REQ-5-4: Close or Reopen an Issue - Scenario 1', async ({ page }) => {
  const title = `Status issue ${u()}`;
  await createIssue(page, title, 'Status test');
  await page.getByRole('button', { name: 'Close issue', exact: true }).click();
  await expect(page.getByText('Closed', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reopen issue', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reopen issue', exact: true }).click();
  await expect(page.getByText('Open', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close issue', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Open', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close issue', exact: true })).toBeVisible();
});

test.skip('REQ-5-4#2: REQ-5-4: Close or Reopen an Issue - Scenario 2', () => {
  // The Read-only viewer account name/password required by this scenario is not specified in the requirements.
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

