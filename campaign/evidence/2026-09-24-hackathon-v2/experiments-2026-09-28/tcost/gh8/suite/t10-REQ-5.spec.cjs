const { test, expect } = require('@playwright/test');

const uniq = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

async function signInAsAlice(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill('alice-dev');
  await page.getByLabel('Password', { exact: true }).fill('Valid-password-123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
}

async function openRepository(page, name = 'acme-docs') {
  const search = page.getByRole('searchbox', { name: 'Search', exact: true });
  await search.fill(name);
  await search.press('Enter');
  await page.getByRole('link', { name, exact: true }).click();
  await expect(page.getByRole('link', { name: 'Code', exact: true })).toBeVisible();
}

async function openRepositoryIssues(page) {
  await openRepository(page);
  await page.getByRole('link', { name: 'Issues', exact: true }).click();
  await expect(page.getByRole('link', { name: 'New issue', exact: true })).toBeVisible();
}

async function createIssue(page, title, description) {
  await page.getByRole('link', { name: 'New issue', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(title);
  if (description) {
    await page.getByLabel('Description', { exact: true }).fill(description);
  }
  await page.getByRole('button', { name: 'Submit new issue', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  if (description) {
    await expect(page.getByText(description, { exact: true })).toBeVisible();
  }
}

test('REQ-5-2-2: REQ-5-2-2: Edit an Issue Title and Description - Scenario 1', async ({ page }) => {
  const suffix = uniq();
  const originalTitle = `pw-title-${suffix}`;
  const originalDescription = `Original description ${suffix}`;
  const newTitle = `pw-title-edited-${suffix}`;
  const newDescription = `Edited description ${suffix}`;

  await signInAsAlice(page);
  await openRepositoryIssues(page);
  await createIssue(page, originalTitle, originalDescription);

  await page.getByRole('button', { name: 'Edit issue title', exact: true }).click();
  await page.getByLabel('Issue title', { exact: true }).fill(newTitle);
  await page.getByRole('button', { name: 'Save issue title', exact: true }).click();

  await page.getByRole('button', { name: 'Edit issue description', exact: true }).click();
  await page.getByLabel('Issue description', { exact: true }).fill(newDescription);
  await page.getByRole('button', { name: 'Save issue description', exact: true }).click();

  await expect(page.getByRole('heading', { name: newTitle, exact: true })).toBeVisible();
  await expect(page.getByText(newDescription, { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: newTitle, exact: true })).toBeVisible();
  await expect(page.getByText(newDescription, { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Issues', exact: true }).click();
  await expect(page.getByRole('link', { name: newTitle, exact: true })).toBeVisible();
});

test('REQ-5-2-2#2: REQ-5-2-2: Edit an Issue Title and Description - Scenario 2', async ({ page }) => {
  const suffix = uniq();
  const originalTitle = `pw-original-${suffix}`;
  const description = `Description ${suffix}`;

  await signInAsAlice(page);
  await openRepositoryIssues(page);
  await createIssue(page, originalTitle, description);

  await page.getByRole('button', { name: 'Edit issue title', exact: true }).click();
  await page.getByLabel('Issue title', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Save issue title', exact: true }).click();

  await expect(page.getByText('Title is required', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: originalTitle, exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: originalTitle, exact: true })).toBeVisible();
});

test('REQ-5-2-3: REQ-5-2-3: Comment on an Issue Discussion - Scenario 1', async ({ page }) => {
  const suffix = uniq();
  const title = `pw-comment-${suffix}`;
  const description = `Description ${suffix}`;

  await signInAsAlice(page);
  await openRepositoryIssues(page);
  await createIssue(page, title, description);

  const firstComment = `First comment ${suffix}`;
  await page.getByLabel('Comment', { exact: true }).fill(firstComment);
  await page.getByRole('button', { name: 'Comment', exact: true }).click();
  await expect(page.getByRole('article').filter({ hasText: firstComment })).toBeVisible();

  const secondComment = `Second comment ${suffix}`;
  await page.getByLabel('Comment', { exact: true }).fill(secondComment);
  await page.getByRole('button', { name: 'Comment', exact: true }).click();
  const secondArticle = page.getByRole('article').filter({ hasText: secondComment });
  await expect(secondArticle).toBeVisible();
  await expect(secondArticle.getByText('alice-dev', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('article').filter({ hasText: firstComment })).toBeVisible();
  await expect(page.getByRole('article').filter({ hasText: secondComment })).toBeVisible();
});

test('REQ-5-2-3#2: REQ-5-2-3: Comment on an Issue Discussion - Scenario 2', async ({ page }) => {
  const suffix = uniq();
  const title = `pw-whitespace-comment-${suffix}`;
  const description = `Description ${suffix}`;

  await signInAsAlice(page);
  await openRepositoryIssues(page);
  await createIssue(page, title, description);

  const articleCountBefore = await page.getByRole('article').count();
  const commentBox = page.getByLabel('Comment', { exact: true });
  await commentBox.fill('   ');
  const submitComment = page.getByRole('button', { name: 'Comment', exact: true });

  if (await submitComment.isEnabled()) {
    await submitComment.click();
    await expect(page.getByText('Comment is required', { exact: true })).toBeVisible();
  }

  await expect(page.getByRole('article')).toHaveCount(articleCountBefore);
  await page.reload();
  await expect(page.getByRole('article')).toHaveCount(articleCountBefore);
});

test('REQ-5-3-1: REQ-5-3-1: Assign or Unassign Issue Participants - Scenario 1', async ({ page }) => {
  const suffix = uniq();
  const title = `pw-assignee-${suffix}`;
  const description = `Description ${suffix}`;

  await signInAsAlice(page);
  await openRepositoryIssues(page);
  await createIssue(page, title, description);

  await page.getByRole('button', { name: 'Assignees', exact: true }).click();
  await page.getByLabel('Search assignees', { exact: true }).fill('bob-reviewer');
  await page.getByRole('option', { name: 'bob-reviewer', exact: true }).click();

  await expect(page.getByText('bob-reviewer', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('bob-reviewer', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Assignees', exact: true }).click();
  await page.getByRole('option', { name: 'bob-reviewer', exact: true }).click();
  await expect(page.getByText('bob-reviewer', { exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByText('bob-reviewer', { exact: true })).toHaveCount(0);
});

test('REQ-5-3-2: REQ-5-3-2: Apply Labels to an Issue - Scenario 1', async ({ page }) => {
  const suffix = uniq();
  const title = `pw-label-${suffix}`;
  const description = `Description ${suffix}`;

  await signInAsAlice(page);
  await openRepositoryIssues(page);
  await createIssue(page, title, description);

  await page.getByRole('button', { name: 'Labels', exact: true }).click();
  await page.getByRole('checkbox', { name: 'bug', exact: true }).click();

  await expect(page.getByText('bug', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('bug', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Labels', exact: true }).click();
  await page.getByRole('checkbox', { name: 'bug', exact: true }).click();
  await expect(page.getByText('bug', { exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByText('bug', { exact: true })).toHaveCount(0);
});

test('REQ-5-3-3: REQ-5-3-3: Assign Issues and Pull Requests to a Milestone - Scenario 1', async ({ page }) => {
  const suffix = uniq();
  const title = `pw-milestone-${suffix}`;
  const description = `Description ${suffix}`;

  await signInAsAlice(page);
  await openRepositoryIssues(page);
  await createIssue(page, title, description);

  await page.getByRole('button', { name: 'Milestone', exact: true }).click();
  await page.getByRole('option', { name: 'v1.0', exact: true }).click();

  await expect(page.getByText('v1.0', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('v1.0', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Milestone', exact: true }).click();
  await page.getByRole('option', { name: 'None', exact: true }).click();
  await expect(page.getByText('v1.0', { exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByText('v1.0', { exact: true })).toHaveCount(0);
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

