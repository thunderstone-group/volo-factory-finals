const { test, expect } = require('@playwright/test');

const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const PASSWORD = 'Valid-password-123!';

function linkOrButton(page, name) {
  return page
    .getByRole('link', { name, exact: true })
    .or(page.getByRole('button', { name, exact: true }));
}

async function clickLinkOrButton(page, name) {
  const el = linkOrButton(page, name);
  await expect(el.first()).toBeVisible();
  await el.first().click();
}

function optionByName(page, name) {
  return page
    .getByRole('option', { name, exact: true })
    .or(page.getByRole('button', { name, exact: true }))
    .or(page.getByText(name, { exact: true }));
}

async function signIn(page, usernameOrEmail, password = PASSWORD) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(usernameOrEmail);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
}

async function openRepo(page, repoName) {
  await page.goto('/');
  const search = page.getByRole('searchbox', { name: 'Search', exact: true });
  await expect(search).toBeVisible();
  await search.fill(repoName);
  await search.press('Enter');
  const result = page.getByRole('link', { name: repoName, exact: true });
  await expect(result.first()).toBeVisible();
  await result.first().click();
}

async function openPullRequests(page, repoName) {
  await openRepo(page, repoName);
  await clickLinkOrButton(page, 'Pull requests');
}

async function openPullRequest(page, repoName, title) {
  await openPullRequests(page, repoName);
  const prLink = page.getByRole('link', { name: title, exact: true });
  await expect(prLink.first()).toBeVisible();
  await prLink.first().click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}

async function chooseBranch(page, label, branch) {
  await page.getByRole('combobox', { name: label, exact: true }).selectOption(branch);
}

async function compareBranches(page, base, compare) {
  await clickLinkOrButton(page, 'New pull request');
  await chooseBranch(page, 'Base', base);
  await chooseBranch(page, 'Compare', compare);
  const compareBtn = linkOrButton(page, 'Compare changes');
  if (await compareBtn.first().isVisible().catch(() => false)) {
    await compareBtn.first().click();
  }
}

async function openFilesChanged(page, repoName, title) {
  await openPullRequest(page, repoName, title);
  await clickLinkOrButton(page, 'Files changed');
}

// ---------------------------------------------------------------------------
// REQ-6-1: Protect Branches with Review and Status-Check Requirements
// ---------------------------------------------------------------------------

test('REQ-6-1: REQ-6-1: Protect Branches with Review and Status-Check Requirements - Scenario 1', async ({ page }) => {
  await signIn(page, 'protection-admin');
  await openRepo(page, 'branch-protection-demo');
  await clickLinkOrButton(page, 'Settings');
  await clickLinkOrButton(page, 'Branches');

  await clickLinkOrButton(page, 'Add branch protection rule');
  await page.getByLabel('Branch name pattern', { exact: true }).fill('main');
  await page.getByRole('checkbox', { name: 'Require 1 approval', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Require status check test', exact: true }).check();

  const save = page
    .getByRole('button', { name: 'Create', exact: true })
    .or(page.getByRole('button', { name: 'Save changes', exact: true }));
  await expect(save.first()).toBeVisible();
  await save.first().click();

  await page.reload();
  await expect(page.getByText('main', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('1 approval', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('test', { exact: true }).first()).toBeVisible();
});

test('REQ-6-1#2: REQ-6-1: Protect Branches with Review and Status-Check Requirements - Scenario 2', async ({ page }) => {
  await signIn(page, 'protection-viewer');
  await openRepo(page, 'branch-protection-demo');

  const settings = linkOrButton(page, 'Settings');
  if (await settings.first().isVisible().catch(() => false)) {
    await settings.first().click();
    const branches = linkOrButton(page, 'Branches');
    if (await branches.first().isVisible().catch(() => false)) {
      await branches.first().click();
    }
  }

  await expect(
    page.getByRole('button', { name: 'Add branch protection rule', exact: true })
  ).toHaveCount(0);
});

test('REQ-6-1#3: REQ-6-1: Protect Branches with Review and Status-Check Requirements - Scenario 3', async ({ page }) => {
  await signIn(page, 'protection-admin');
  await openPullRequest(page, 'branch-protection-demo', 'Protection status onboarding PR');
  await clickLinkOrButton(page, 'Checks');

  await page.getByRole('combobox', { name: 'test', exact: true }).selectOption('success');

  const save = page
    .getByRole('button', { name: 'Save', exact: true })
    .or(page.getByRole('button', { name: 'Update', exact: true }));
  await expect(save.first()).toBeVisible();
  await save.first().click();

  await expect(page.getByText('success', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('protection-admin', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('success', { exact: true }).first()).toBeVisible();
});

// ---------------------------------------------------------------------------
// REQ-6-2-1: List and Filter Repository Pull Requests
// ---------------------------------------------------------------------------

test('REQ-6-2-1: REQ-6-2-1: List and Filter Repository Pull Requests - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await openPullRequests(page, 'acme-docs');
  await clickLinkOrButton(page, 'Open');

  const prLink = page.getByRole('link', { name: 'Improve onboarding', exact: true });
  await expect(prLink.first()).toBeVisible();
  await prLink.first().click();

  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
});

test('REQ-6-2-1#2: REQ-6-2-1: List and Filter Repository Pull Requests - Scenario 2', async ({ page }) => {
  await page.goto('/');
  await openPullRequests(page, 'acme-docs');
  await clickLinkOrButton(page, 'Open');

  const prLink = page.getByRole('link', { name: 'Improve onboarding', exact: true });
  await expect(prLink.first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('link', { name: 'Improve onboarding', exact: true }).first()).toBeVisible();
});

test('REQ-6-2-1#3: REQ-6-2-1: List and Filter Repository Pull Requests - Scenario 3', async ({ page }) => {
  await page.goto('/');
  await openPullRequests(page, 'acme-docs');
  await clickLinkOrButton(page, 'Open');

  await openPullRequests(page, 'acme-docs');
  await clickLinkOrButton(page, 'Open');

  await expect(page.getByRole('link', { name: 'Improve onboarding', exact: true }).first()).toBeVisible();
});

// ---------------------------------------------------------------------------
// REQ-6-2-2: Compare Branches Before Opening a Pull Request
// ---------------------------------------------------------------------------

test('REQ-6-2-2: REQ-6-2-2: Compare Branches Before Opening a Pull Request - Scenario 1', async ({ page }) => {
  await signIn(page, 'pr-contributor');
  await openPullRequests(page, 'acme-docs');
  await compareBranches(page, 'main', 'feature-search');

  await expect(page.getByText('src/search.ts').first()).toBeVisible();
  await expect(page.getByText(/commit/i).first()).toBeVisible();
});

test('REQ-6-2-2#2: REQ-6-2-2: Compare Branches Before Opening a Pull Request - Scenario 2', async ({ page }) => {
  await signIn(page, 'pr-contributor');
  await openPullRequests(page, 'acme-docs');
  await compareBranches(page, 'main', 'main');

  await expect(page.getByText(/identical|no differences|no changes/i).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create pull request', exact: true })).toBeDisabled();
});

// ---------------------------------------------------------------------------
// REQ-6-2-3: Create a Pull Request from Comparison Results
// ---------------------------------------------------------------------------

test('REQ-6-2-3: REQ-6-2-3: Create a Pull Request from Comparison Results - Scenario 1', async ({ page }) => {
  const title = `pw-pr-${u()}`;

  await signIn(page, 'pr-contributor');
  await openPullRequests(page, 'acme-docs');
  await compareBranches(page, 'main', 'feature-search');

  await clickLinkOrButton(page, 'Create pull request');
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByRole('button', { name: 'Create pull request', exact: true }).click();

  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
});

test('REQ-6-2-3#2: REQ-6-2-3: Create a Pull Request from Comparison Results - Scenario 2', async ({ page }) => {
  await signIn(page, 'pr-contributor');
  await openPullRequests(page, 'acme-docs');
  await compareBranches(page, 'main', 'feature-search');

  await clickLinkOrButton(page, 'Create pull request');
  await page.getByLabel('Title', { exact: true }).fill('   ');

  const submit = page.getByRole('button', { name: 'Create pull request', exact: true });
  if (await submit.isEnabled().catch(() => false)) {
    await submit.click();
  }

  await expect(page.getByText(/required/i).first()).toBeVisible();
});

// ---------------------------------------------------------------------------
// REQ-6-2-4: Create a Draft Pull Request
// ---------------------------------------------------------------------------

test('REQ-6-2-4: REQ-6-2-4: Create a Draft Pull Request - Scenario 1', async ({ page }) => {
  const title = `pw-draft-${u()}`;

  await signIn(page, 'pr-contributor');
  await openPullRequests(page, 'acme-docs');
  await compareBranches(page, 'main', 'feature-search');

  await clickLinkOrButton(page, 'Create draft pull request');
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByRole('button', { name: 'Create draft pull request', exact: true }).click();

  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Merge pull request', exact: true })).toBeDisabled();
});

test('REQ-6-2-4#2: REQ-6-2-4: Create a Draft Pull Request - Scenario 2', async ({ page }) => {
  await signIn(page, 'draft-author');
  await openPullRequest(page, 'acme-docs', 'Draft onboarding update');

  await clickLinkOrButton(page, 'Ready for review');
  const confirm = linkOrButton(page, 'Confirm');
  if (await confirm.first().isVisible().catch(() => false)) {
    await confirm.first().click();
  }

  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Draft', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Draft onboarding update', exact: true })).toBeVisible();
  await expect(page.getByText('draft-feature', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('main', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/ready for review/i).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
});

// ---------------------------------------------------------------------------
// REQ-6-3-1: View Pull Request Overview and Commits
// ---------------------------------------------------------------------------

test('REQ-6-3-1: REQ-6-3-1: View Pull Request Overview and Commits - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await openPullRequest(page, 'acme-docs', 'Overview onboarding PR');

  await expect(page.getByRole('heading', { name: 'Overview onboarding PR', exact: true })).toBeVisible();

  await clickLinkOrButton(page, 'Commits');
  await expect(page.getByText(/commit/i).first()).toBeVisible();

  await clickLinkOrButton(page, 'Files changed');
  await expect(page.getByText(/changed file/i).first()).toBeVisible();
});

test('REQ-6-3-1#2: REQ-6-3-1: View Pull Request Overview and Commits - Scenario 2', async ({ page }) => {
  await page.goto('/');
  await openPullRequest(page, 'acme-docs', 'Overview onboarding PR');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Overview onboarding PR', exact: true })).toBeVisible();

  await clickLinkOrButton(page, 'Commits');
  await expect(page.getByText(/commit/i).first()).toBeVisible();
});

test('REQ-6-3-1#3: REQ-6-3-1: View Pull Request Overview and Commits - Scenario 3', async ({ page }) => {
  await page.goto('/');
  await openPullRequest(page, 'acme-docs', 'Overview onboarding PR');

  await page.goto('/');
  await openPullRequest(page, 'acme-docs', 'Overview onboarding PR');
  await clickLinkOrButton(page, 'Files changed');

  await expect(page.getByRole('heading', { name: 'Overview onboarding PR', exact: true })).toBeVisible();
  await expect(page.getByText(/changed file/i).first()).toBeVisible();
});

// ---------------------------------------------------------------------------
// REQ-6-3-2: Inspect Changed Files and Aggregate Diff
// ---------------------------------------------------------------------------

test('REQ-6-3-2: REQ-6-3-2: Inspect Changed Files and Aggregate Diff - Scenario 1', async ({ page }) => {
  await page.goto('/');
  await openFilesChanged(page, 'acme-docs', 'Public onboarding PR');

  await expect(page.getByText('src/search.ts').first()).toBeVisible();
  await expect(page.getByText(/\+\d+/).first()).toBeVisible();
  await expect(page.getByText(/[-−]\d+/).first()).toBeVisible();
});

// ---------------------------------------------------------------------------
// REQ-6-3-3: Add Review Comments to Changed Code Lines
// ---------------------------------------------------------------------------

test('REQ-6-3-3: REQ-6-3-3: Add Review Comments to Changed Code Lines - Scenario 1', async ({ page }) => {
  const comment = `pw review comment ${u()}`;

  await signIn(page, 'pr-reviewer');
  await openFilesChanged(page, 'acme-docs', 'Reviewable onboarding PR');

  const addComment = page.getByRole('button', { name: 'Add comment', exact: true });
  await expect(addComment.first()).toBeVisible();
  await addComment.first().click();

  await page.getByLabel('Comment', { exact: true }).fill(comment);
  await page.getByRole('button', { name: 'Add single comment', exact: true }).click();

  await expect(page.getByText(comment, { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText(comment, { exact: true }).first()).toBeVisible();
});

test('REQ-6-3-3#2: REQ-6-3-3: Add Review Comments to Changed Code Lines - Scenario 2', async ({ page }) => {
  const comment = `pw pending comment ${u()}`;

  await signIn(page, 'pr-reviewer');
  await openFilesChanged(page, 'acme-docs', 'Pending review onboarding PR');

  const addComment = page.getByRole('button', { name: 'Add comment', exact: true });
  await expect(addComment.first()).toBeVisible();
  await addComment.first().click();

  await page.getByLabel('Comment', { exact: true }).fill(comment);
  await page.getByRole('button', { name: 'Start a review', exact: true }).click();

  await expect(page.getByText(comment, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/pending review/i).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText(/pending review/i).first()).toBeVisible();
});

// ---------------------------------------------------------------------------
// REQ-6-3-4: Submit a Pull Request Review
// ---------------------------------------------------------------------------

test('REQ-6-3-4: REQ-6-3-4: Submit a Pull Request Review - Scenario 1', async ({ page }) => {
  await signIn(page, 'pr-reviewer');
  await openFilesChanged(page, 'acme-docs', 'Reviewable onboarding PR');

  await clickLinkOrButton(page, 'Review changes');
  await page.getByRole('radio', { name: 'Approve', exact: true }).check();
  await page.getByRole('button', { name: 'Submit review', exact: true }).click();

  await expect(page.getByText('Approved', { exact: true }).first()).toBeVisible();
});

test('REQ-6-3-4#2: REQ-6-3-4: Submit a Pull Request Review - Scenario 2', async ({ page }) => {
  const summary = `pw review summary ${u()}`;

  await signIn(page, 'pr-reviewer');
  await openFilesChanged(page, 'acme-docs', 'Change request onboarding PR');

  await clickLinkOrButton(page, 'Review changes');
  const summaryField = page
    .getByLabel('Comment', { exact: true })
    .or(page.getByLabel('Summary', { exact: true }));
  await expect(summaryField.first()).toBeVisible();
  await summaryField.first().fill(summary);

  await page.getByRole('radio', { name: 'Request changes', exact: true }).check();
  await page.getByRole('button', { name: 'Submit review', exact: true }).click();

  await expect(page.getByText('Changes requested', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(summary, { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('Changes requested', { exact: true }).first()).toBeVisible();
});

// ---------------------------------------------------------------------------
// REQ-6-4: Request or Remove Pull Request Reviewers
// ---------------------------------------------------------------------------

test('REQ-6-4: REQ-6-4: Request or Remove Pull Request Reviewers - Scenario 1', async ({ page }) => {
  await signIn(page, 'pr-author');
  await openPullRequest(page, 'acme-docs', 'Reviewer request onboarding PR');

  await clickLinkOrButton(page, 'Reviewers');
  await page.getByLabel('Search', { exact: true }).fill('bob-reviewer');
  const option = optionByName(page, 'bob-reviewer');
  await expect(option.first()).toBeVisible();
  await option.first().click();

  await expect(page.getByText('bob-reviewer', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('bob-reviewer', { exact: true }).first()).toBeVisible();

  const removeBtn = page.getByRole('button', { name: 'Remove bob-reviewer', exact: true });
  if (!(await removeBtn.isVisible().catch(() => false))) {
    await clickLinkOrButton(page, 'Reviewers');
  }
  await expect(removeBtn).toBeVisible();
  await removeBtn.click();

  await expect(page.getByText('bob-reviewer', { exact: true })).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// REQ-6-5: Merge an Eligible Pull Request
// ---------------------------------------------------------------------------

test('REQ-6-5: REQ-6-5: Merge an Eligible Pull Request - Scenario 1', async ({ page }) => {
  await signIn(page, 'pr-maintainer');
  await openPullRequest(page, 'acme-docs', 'Mergeable onboarding PR');

  await expect(page.getByText('Create a merge commit', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Merge pull request', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm merge', exact: true }).click();

  await expect(page.getByText('Merged', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('pr-maintainer', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/\b[0-9a-f]{7,40}\b/).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('Merged', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/\b[0-9a-f]{7,40}\b/).first()).toBeVisible();
});

test('REQ-6-5#2: REQ-6-5: Merge an Eligible Pull Request - Scenario 2', async ({ page }) => {
  await signIn(page, 'pr-maintainer');
  await openPullRequest(page, 'acme-docs', 'Blocked onboarding PR');

  const merge = page.getByRole('button', { name: 'Merge pull request', exact: true });
  await expect(merge).toBeVisible();
  await expect(merge).toBeDisabled();

  await expect(page.getByText('Review required by branch protection', { exact: true }).first()).toBeVisible();

  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(merge).toBeDisabled();
});

// ---------------------------------------------------------------------------
// REQ-6-6: Close or Reopen a Pull Request Without Merging
// ---------------------------------------------------------------------------

test('REQ-6-6: REQ-6-6: Close or Reopen a Pull Request Without Merging - Scenario 1', async ({ page }) => {
  await signIn(page, 'pr-author');
  await openPullRequest(page, 'acme-docs', 'Closable onboarding PR');

  await page.getByRole('button', { name: 'Close pull request', exact: true }).click();
  await expect(page.getByText('Closed', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Reopen pull request', exact: true }).click();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Close pull request', exact: true })).toBeVisible();
});

test('REQ-6-6#2: REQ-6-6: Close or Reopen a Pull Request Without Merging - Scenario 2', async ({ page }) => {
  await signIn(page, 'pr-viewer');
  await openPullRequest(page, 'acme-docs', 'Protected onboarding PR');

  await expect(page.getByRole('button', { name: 'Close pull request', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reopen pull request', exact: true })).toHaveCount(0);
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

