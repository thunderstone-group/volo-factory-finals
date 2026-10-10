const { test, expect } = require('@playwright/test');

const PASSWORD = 'Valid-password-123!';

// unique suffix generator for records the scenarios create themselves
const u = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ---------------------------------------------------------------- helpers

async function signIn(page, username, password = PASSWORD) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText(username, { exact: true }).first()).toBeVisible();
}

// Clicks the first visible control carrying the given accessible name, whatever
// its role is (button/link/option/menu item). Returns false when none is present.
async function clickNamed(page, name) {
  const roles = ['button', 'link', 'option', 'menuitemcheckbox', 'menuitem'];
  for (const role of roles) {
    const loc = page.getByRole(role, { name, exact: true });
    const count = await loc.count();
    for (let i = 0; i < count; i++) {
      const el = loc.nth(i);
      if (await el.isVisible().catch(() => false)) {
        await el.click();
        return true;
      }
    }
  }
  return false;
}

// Opens a repository overview from the home page (list entry, else global search).
async function openRepo(page, repo) {
  await page.goto('/');
  const home = page.getByRole('link', { name: repo, exact: true }).first();
  if (await home.isVisible().catch(() => false)) {
    await home.click();
    return;
  }
  for (const role of ['searchbox', 'textbox']) {
    const box = page.getByRole(role, { name: 'Search', exact: true }).first();
    if (await box.isVisible().catch(() => false)) {
      await box.fill(repo);
      await page.keyboard.press('Enter');
      break;
    }
  }
  const result = page.getByRole('link', { name: repo, exact: true }).first();
  await expect(result).toBeVisible();
  await result.click();
}

async function openPullRequests(page, repo) {
  await openRepo(page, repo);
  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
}

async function openPullRequest(page, repo, title) {
  await openPullRequests(page, repo);
  const pr = page.getByRole('link', { name: title, exact: true }).first();
  await expect(pr).toBeVisible();
  await pr.click();
}

// Selects an option in the combobox with the given label; falls back to the
// clickable-option interaction when the control is not a native select.
async function selectInCombobox(page, label, option) {
  const combo = page.getByLabel(label, { exact: true }).first();
  await expect(combo).toBeVisible();
  try {
    await combo.selectOption({ label: option });
  } catch (e) {
    await combo.click();
    await clickNamed(page, option);
  }
}

// Fills the first visible field with the given label.
async function fillLabel(page, label, text) {
  const loc = page.getByLabel(label, { exact: true });
  const count = await loc.count();
  for (let i = 0; i < count; i++) {
    const el = loc.nth(i);
    if (await el.isVisible().catch(() => false)) {
      await el.fill(text);
      return true;
    }
  }
  return false;
}

async function fillAnyLabel(page, labels, text) {
  for (const label of labels) {
    if (await fillLabel(page, label, text)) return true;
  }
  return false;
}

// Fills the picker search field (a textbox named Search, unlike the global searchbox).
async function fillPickerSearch(page, text) {
  const box = page.getByRole('textbox', { name: 'Search', exact: true }).first();
  if (await box.isVisible().catch(() => false)) {
    await box.fill(text);
    return;
  }
  await fillLabel(page, 'Search', text);
}

// ---------------------------------------------------------------- REQ-6-1

test('REQ-6-1: REQ-6-1: Protect Branches with Review and Status-Check Requirements - Scenario 1', async ({ page }) => {
  await signIn(page, 'protection-admin');
  await openRepo(page, 'branch-protection-demo');

  await clickNamed(page, 'Settings');
  await clickNamed(page, 'Branches');

  await clickNamed(page, 'Add branch protection rule');
  await page.getByLabel('Branch name pattern', { exact: true }).fill('main');
  await page.getByLabel('Require 1 approval', { exact: true }).check();
  await page.getByLabel('Require status check test', { exact: true }).check();
  if (!(await clickNamed(page, 'Create'))) {
    await clickNamed(page, 'Save changes');
  }

  await page.reload();
  await expect(page.getByText('main', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/1 approval/i).first()).toBeVisible();
  await expect(page.getByText(/status check/i).first()).toBeVisible();
});

test('REQ-6-1#2: REQ-6-1: Protect Branches with Review and Status-Check Requirements - Scenario 2', async ({ page }) => {
  await signIn(page, 'protection-viewer');
  await openRepo(page, 'branch-protection-demo');

  // Settings / Branches are followed when available; absence is tolerated.
  await clickNamed(page, 'Settings');
  await clickNamed(page, 'Branches');

  await expect(page.getByRole('button', { name: 'Add branch protection rule', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Add branch protection rule', exact: true })).toHaveCount(0);
});

test('REQ-6-1#3: REQ-6-1: Protect Branches with Review and Status-Check Requirements - Scenario 3', async ({ page }) => {
  await signIn(page, 'protection-admin');
  await openPullRequest(page, 'branch-protection-demo', 'Protection status onboarding PR');

  await selectInCombobox(page, 'test', 'success');
  if (!(await clickNamed(page, 'Save'))) {
    await clickNamed(page, 'Update');
  }

  await expect(page.getByText('success', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('protection-admin', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('success', { exact: true }).first()).toBeVisible();
});

// ---------------------------------------------------------------- REQ-6-2-1

test('REQ-6-2-1: REQ-6-2-1: List and Filter Repository Pull Requests - Scenario 1', async ({ page }) => {
  await openPullRequests(page, 'acme-docs');

  await clickNamed(page, 'Open');
  await clickNamed(page, 'Improve onboarding');

  await expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible();
});

test('REQ-6-2-1#2: REQ-6-2-1: List and Filter Repository Pull Requests - Scenario 2', async ({ page }) => {
  await openPullRequests(page, 'acme-docs');

  await clickNamed(page, 'Open');
  await expect(page.getByRole('link', { name: 'Improve onboarding', exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('link', { name: 'Improve onboarding', exact: true }).first()).toBeVisible();
});

test('REQ-6-2-1#3: REQ-6-2-1: List and Filter Repository Pull Requests - Scenario 3', async ({ page }) => {
  await openPullRequests(page, 'acme-docs');
  await clickNamed(page, 'Open');

  await page.goto('/');
  await openPullRequests(page, 'acme-docs');
  await clickNamed(page, 'Open');

  await expect(page.getByRole('link', { name: 'Improve onboarding', exact: true }).first()).toBeVisible();
});

// ---------------------------------------------------------------- REQ-6-2-2

test('REQ-6-2-2: REQ-6-2-2: Compare Branches Before Opening a Pull Request - Scenario 1', async ({ page }) => {
  await signIn(page, 'pr-contributor');
  await openPullRequests(page, 'acme-docs');

  await clickNamed(page, 'New pull request');
  await selectInCombobox(page, 'Base', 'main');
  await selectInCombobox(page, 'Compare', 'feature-search');
  await clickNamed(page, 'Compare changes');

  await expect(page.getByText('src/search.ts', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/commit/i).first()).toBeVisible();
});

test('REQ-6-2-2#2: REQ-6-2-2: Compare Branches Before Opening a Pull Request - Scenario 2', async ({ page }) => {
  await signIn(page, 'pr-contributor');
  await openPullRequests(page, 'acme-docs');

  await clickNamed(page, 'New pull request');
  await selectInCombobox(page, 'Base', 'main');
  await selectInCombobox(page, 'Compare', 'main');
  await clickNamed(page, 'Compare changes');

  await expect(page.getByText(/no differences|identical|nothing to compare|are identical/i).first()).toBeVisible();

  const create = page.getByRole('button', { name: 'Create pull request', exact: true });
  if (await create.count() > 0) {
    await expect(create.first()).toBeDisabled();
  }
});

// ---------------------------------------------------------------- REQ-6-2-3

test('REQ-6-2-3: REQ-6-2-3: Create a Pull Request from Comparison Results - Scenario 1', async ({ page }) => {
  const title = `PW pr ${u()}`;

  await signIn(page, 'pr-contributor');
  await openPullRequests(page, 'acme-docs');
  await clickNamed(page, 'New pull request');
  await selectInCombobox(page, 'Base', 'main');
  await selectInCombobox(page, 'Compare', 'feature-search');
  await clickNamed(page, 'Compare changes');

  await clickNamed(page, 'Create pull request');
  await expect(page.getByLabel('Title', { exact: true })).toBeVisible();
  await page.getByLabel('Title', { exact: true }).fill(title);
  await clickNamed(page, 'Create pull request');

  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
});

test('REQ-6-2-3#2: REQ-6-2-3: Create a Pull Request from Comparison Results - Scenario 2', async ({ page }) => {
  await signIn(page, 'pr-contributor');
  await openPullRequests(page, 'acme-docs');
  await clickNamed(page, 'New pull request');
  await selectInCombobox(page, 'Base', 'main');
  await selectInCombobox(page, 'Compare', 'feature-search');
  await clickNamed(page, 'Compare changes');

  await clickNamed(page, 'Create pull request');
  await expect(page.getByLabel('Title', { exact: true })).toBeVisible();
  await page.getByLabel('Title', { exact: true }).fill('   ');
  await clickNamed(page, 'Create pull request');

  await expect(page.getByText(/required|blank/i).first()).toBeVisible();
  await expect(page.getByLabel('Title', { exact: true })).toBeVisible();
});

// ---------------------------------------------------------------- REQ-6-2-4

test('REQ-6-2-4: REQ-6-2-4: Create a Draft Pull Request - Scenario 1', async ({ page }) => {
  const title = `PW draft pr ${u()}`;

  await signIn(page, 'pr-contributor');
  await openPullRequests(page, 'acme-docs');
  await clickNamed(page, 'New pull request');
  await selectInCombobox(page, 'Base', 'main');
  await selectInCombobox(page, 'Compare', 'feature-search');
  await clickNamed(page, 'Compare changes');

  await clickNamed(page, 'Create draft pull request');
  await expect(page.getByLabel('Title', { exact: true })).toBeVisible();
  await page.getByLabel('Title', { exact: true }).fill(title);
  if (!(await clickNamed(page, 'Create draft pull request'))) {
    await clickNamed(page, 'Create pull request');
  }

  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Merge pull request', exact: true })).toBeDisabled();
});

test('REQ-6-2-4#2: REQ-6-2-4: Create a Draft Pull Request - Scenario 2', async ({ page }) => {
  await signIn(page, 'draft-author');
  await openPullRequest(page, 'acme-docs', 'Draft onboarding update');

  await clickNamed(page, 'Ready for review');
  await clickNamed(page, 'Confirm');

  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Draft', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Draft onboarding update', exact: true })).toBeVisible();
  await expect(page.getByText('draft-feature', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('main', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/ready for review/i).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
});

// ---------------------------------------------------------------- REQ-6-3-1

test('REQ-6-3-1: REQ-6-3-1: View Pull Request Overview and Commits - Scenario 1', async ({ page }) => {
  await openPullRequest(page, 'acme-docs', 'Overview onboarding PR');

  await expect(page.getByRole('heading', { name: 'Overview onboarding PR', exact: true })).toBeVisible();

  await clickNamed(page, 'Commits');
  await expect(page.getByText(/commit/i).first()).toBeVisible();

  await clickNamed(page, 'Files changed');
  await expect(page.getByText(/changed files/i).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Overview onboarding PR', exact: true })).toBeVisible();
});

test('REQ-6-3-1#2: REQ-6-3-1: View Pull Request Overview and Commits - Scenario 2', async ({ page }) => {
  await openPullRequest(page, 'acme-docs', 'Overview onboarding PR');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Overview onboarding PR', exact: true })).toBeVisible();

  await clickNamed(page, 'Commits');
  await expect(page.getByText(/commit/i).first()).toBeVisible();
});

test('REQ-6-3-1#3: REQ-6-3-1: View Pull Request Overview and Commits - Scenario 3', async ({ page }) => {
  await openPullRequest(page, 'acme-docs', 'Overview onboarding PR');

  await page.goto('/');
  await openPullRequest(page, 'acme-docs', 'Overview onboarding PR');

  await clickNamed(page, 'Files changed');
  await expect(page.getByRole('heading', { name: 'Overview onboarding PR', exact: true })).toBeVisible();
  await expect(page.getByText(/changed files/i).first()).toBeVisible();
});

// ---------------------------------------------------------------- REQ-6-3-2

test('REQ-6-3-2: REQ-6-3-2: Inspect Changed Files and Aggregate Diff - Scenario 1', async ({ page }) => {
  await openPullRequest(page, 'acme-docs', 'Public onboarding PR');

  await clickNamed(page, 'Files changed');

  await expect(page.getByText('src/search.ts', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/additions?|deletions?|\+\d+/i).first()).toBeVisible();
});

// ---------------------------------------------------------------- REQ-6-3-3

test('REQ-6-3-3: REQ-6-3-3: Add Review Comments to Changed Code Lines - Scenario 1', async ({ page }) => {
  const comment = `PW review comment ${u()}`;

  await signIn(page, 'pr-reviewer');
  await openPullRequest(page, 'acme-docs', 'Reviewable onboarding PR');

  await clickNamed(page, 'Files changed');
  await clickNamed(page, 'Add comment');
  await fillLabel(page, 'Comment', comment);
  await clickNamed(page, 'Add single comment');

  await expect(page.getByText(comment, { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText(comment, { exact: true })).toBeVisible();
});

test('REQ-6-3-3#2: REQ-6-3-3: Add Review Comments to Changed Code Lines - Scenario 2', async ({ page }) => {
  const comment = `PW pending comment ${u()}`;

  await signIn(page, 'pr-reviewer');
  await openPullRequest(page, 'acme-docs', 'Pending review onboarding PR');

  await clickNamed(page, 'Files changed');
  await clickNamed(page, 'Add comment');
  await fillLabel(page, 'Comment', comment);
  await clickNamed(page, 'Start a review');

  await expect(page.getByText(comment, { exact: true })).toBeVisible();
  await expect(page.getByText(/pending review/i).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText(/pending review/i).first()).toBeVisible();
});

// ---------------------------------------------------------------- REQ-6-3-4

test('REQ-6-3-4: REQ-6-3-4: Submit a Pull Request Review - Scenario 1', async ({ page }) => {
  await signIn(page, 'pr-reviewer');
  await openPullRequest(page, 'acme-docs', 'Reviewable onboarding PR');

  await clickNamed(page, 'Files changed');
  await clickNamed(page, 'Review changes');
  await page.getByRole('radio', { name: 'Approve', exact: true }).check();
  await clickNamed(page, 'Submit review');

  await expect(page.getByText(/approved/i).first()).toBeVisible();
});

test('REQ-6-3-4#2: REQ-6-3-4: Submit a Pull Request Review - Scenario 2', async ({ page }) => {
  const summary = `PW change request ${u()}`;

  await signIn(page, 'pr-reviewer');
  await openPullRequest(page, 'acme-docs', 'Change request onboarding PR');

  await clickNamed(page, 'Files changed');
  await clickNamed(page, 'Review changes');
  await fillAnyLabel(page, ['Summary', 'Comment', 'Review summary'], summary);
  await page.getByRole('radio', { name: 'Request changes', exact: true }).check();
  await clickNamed(page, 'Submit review');

  await expect(page.getByText(/changes requested/i).first()).toBeVisible();
  await expect(page.getByText(summary, { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText(/changes requested/i).first()).toBeVisible();
});

// ---------------------------------------------------------------- REQ-6-4

test('REQ-6-4: REQ-6-4: Request or Remove Pull Request Reviewers - Scenario 1', async ({ page }) => {
  await signIn(page, 'pr-author');
  await openPullRequest(page, 'acme-docs', 'Reviewer request onboarding PR');

  await clickNamed(page, 'Reviewers');
  await fillPickerSearch(page, 'bob-reviewer');
  await clickNamed(page, 'bob-reviewer');

  await expect(page.getByText('bob-reviewer', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('bob-reviewer', { exact: true }).first()).toBeVisible();

  await clickNamed(page, 'Remove bob-reviewer');
  await expect(page.getByText('bob-reviewer', { exact: true })).toHaveCount(0);
});

// ---------------------------------------------------------------- REQ-6-5

test('REQ-6-5: REQ-6-5: Merge an Eligible Pull Request - Scenario 1', async ({ page }) => {
  await signIn(page, 'pr-maintainer');
  await openPullRequest(page, 'acme-docs', 'Mergeable onboarding PR');

  await expect(page.getByText('Create a merge commit', { exact: true }).first()).toBeVisible();
  const method = page.getByRole('radio', { name: 'Create a merge commit', exact: true });
  if (await method.count() > 0) {
    await expect(method.first()).toBeChecked();
  }

  await clickNamed(page, 'Merge pull request');
  await clickNamed(page, 'Confirm merge');

  await expect(page.getByText('Merged', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/ago|just now/i).first()).toBeVisible();
  await expect(page.getByText(/\b[0-9a-f]{7,40}\b/).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('Merged', { exact: true }).first()).toBeVisible();

  // the merge commit is on the main branch
  await openRepo(page, 'acme-docs');
  await clickNamed(page, 'Commits');
  await expect(page.getByText(/merge/i).first()).toBeVisible();
});

test('REQ-6-5#2: REQ-6-5: Merge an Eligible Pull Request - Scenario 2', async ({ page }) => {
  await signIn(page, 'pr-maintainer');
  await openPullRequest(page, 'acme-docs', 'Blocked onboarding PR');

  const merge = page.getByRole('button', { name: 'Merge pull request', exact: true }).first();
  await expect(merge).toBeVisible();
  await expect(merge).toBeDisabled();
  await expect(page.getByText(/review required|required|protection/i).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Merge pull request', exact: true }).first()).toBeDisabled();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
});

// ---------------------------------------------------------------- REQ-6-6

test('REQ-6-6: REQ-6-6: Close or Reopen a Pull Request Without Merging - Scenario 1', async ({ page }) => {
  await signIn(page, 'pr-author');
  await openPullRequest(page, 'acme-docs', 'Closable onboarding PR');

  await clickNamed(page, 'Close pull request');
  await expect(page.getByText('Closed', { exact: true }).first()).toBeVisible();

  await clickNamed(page, 'Reopen pull request');
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Close pull request', exact: true })).toBeVisible();
});

test('REQ-6-6#2: REQ-6-6: Close or Reopen a Pull Request Without Merging - Scenario 2', async ({ page }) => {
  await signIn(page, 'pr-viewer');
  await openPullRequest(page, 'acme-docs', 'Protected onboarding PR');

  await expect(page.getByRole('heading', { name: 'Protected onboarding PR', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close pull request', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reopen pull request', exact: true })).toHaveCount(0);
});

// Added by the suite runner: a helper that uses `page` without taking it as a parameter sees the running test's page.
require('@playwright/test').test.beforeEach(async ({ page }) => { globalThis.page = page; });

