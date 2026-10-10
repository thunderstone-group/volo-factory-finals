'use strict';
// Oracle suite github-C (REQ-5 issues, REQ-6 pull requests). Written from requirements + hidden intents only.
// Every test starts in a fresh, unauthenticated context and reaches its target from the home page.
const { test, expect } = require('@playwright/test');

const PASSWORD = 'Valid-password-123!';
const REPO = 'acme-docs';

function uid() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// Right-side metadata area of an issue (REQ-5: "the right side displays Assignees, Labels, and Milestone metadata
// in order"). The requirement names no container, so the area is the innermost element holding the metadata
// picker buttons that are present (at least two of them), which keeps the activity timeline out of scope.
async function metadataRegion(page) {
  let region = page.locator('body *');
  let found = 0;
  for (const name of ['Assignees', 'Labels', 'Milestone']) {
    const button = page.getByRole('button', { name, exact: true });
    if ((await button.count()) > 0) {
      region = region.filter({ has: button });
      found += 1;
    }
  }
  expect(found, 'at least two of the Assignees / Labels / Milestone buttons are shown').toBeGreaterThan(1);
  return region.last();
}

// Rendered (innerText) content of a region: a value may be a bare text node next to its heading, and closed
// pickers may stay in the DOM hidden, so the check reads what is actually displayed in the region.
async function expectShown(region, text) {
  await expect(region).toContainText(text, { useInnerText: true });
}
async function expectNotShown(region, text) {
  await expect(region).not.toContainText(text, { useInnerText: true });
}

// Second, independent browser session signed in as another seeded account.
async function otherSession(browser, testInfo, username) {
  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
  const page = await context.newPage();
  if (username) await signIn(page, username);
  else await page.goto('/');
  return { context, page };
}

// REQ-1-1-2 / REQ-5 / REQ-6: home-page "Sign in" link, "Username or email", "Password", "Sign in" button,
// then the signed-in username is visible.
async function signIn(page, username, password = PASSWORD) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText(username, { exact: true })).toBeVisible();
}

// REQ-3-1: top global searchbox "Search" + Enter, then the result link named exactly after the repository.
async function openRepo(page) {
  const search = page.getByRole('searchbox', { name: 'Search', exact: true });
  await search.fill(REPO);
  await search.press('Enter');
  const result = page.getByRole('link', { name: REPO, exact: true });
  await expect(result).toBeVisible();
  const before = page.url();
  await result.click();
  await page.waitForURL((url) => url.href !== before);
}

async function openIssues(page) {
  await openRepo(page);
  await page.getByRole('link', { name: 'Issues', exact: true }).click();
}

// REQ-5-1-1 contract: the unique searchbox "Search issues" filters as the user types, "including when the entire
// seeded title is entered"; each result title is a link named exactly after the title.
async function openIssue(page, title) {
  await openIssues(page);
  await page.getByRole('searchbox', { name: 'Search issues', exact: true }).fill(title);
  await page.getByRole('link', { name: title, exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}

// REQ-5-2-1 creation contract: "New issue" link, "Title"/"Description" fields, "Submit new issue" button.
async function createIssue(page, title, description) {
  await openIssues(page);
  await page.getByRole('link', { name: 'New issue', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(title);
  if (description) await page.getByLabel('Description', { exact: true }).fill(description);
  await page.getByRole('button', { name: 'Submit new issue', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}

async function openPRs(page) {
  await openRepo(page);
  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
}

// REQ-6-2-1 contract: the list has an "Open" status link; selecting it shows the Open PR as a link named exactly
// after its title. `status: null` keeps the list as it opens (used for the seeded Draft PR, whose filter name the
// requirement does not give).
async function openPR(page, title, status = 'Open') {
  await openPRs(page);
  if (status) await page.getByRole('link', { name: status, exact: true }).click();
  await page.getByRole('link', { name: title, exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}

// REQ-6-2-2: "New pull request" link, native selects "base"/"compare", "Compare changes" button.
async function openCompare(page, base, compare) {
  await openPRs(page);
  await page.getByRole('link', { name: 'New pull request', exact: true }).click();
  await page.getByRole('combobox', { name: 'base', exact: true }).selectOption(base);
  await page.getByRole('combobox', { name: 'compare', exact: true }).selectOption(compare);
  await page.getByRole('button', { name: 'Compare changes', exact: true }).click();
}

// REQ-6-2-3 / REQ-6-2-4: create a PR main <- feature-search through the comparison page.
async function createPR(page, title, { draft = false, description } = {}) {
  const action = draft ? 'Create draft pull request' : 'Create pull request';
  await openCompare(page, 'main', 'feature-search');
  await page.getByRole('button', { name: action, exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(title);
  if (description) await page.getByLabel('Description', { exact: true }).fill(description);
  await page.getByRole('button', { name: action, exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}

// Cleanup only (never asserts): close an oracle-created PR so the main <- feature-search pair is free again,
// because a perfect app rejects a second Open/Draft PR for the same pair.
async function bestEffortClosePR(page) {
  try {
    const close = page.getByRole('button', { name: 'Close pull request', exact: true });
    if (await close.isVisible()) {
      await close.click({ timeout: 1500 });
      await page.getByRole('button', { name: 'Reopen pull request', exact: true }).waitFor({ timeout: 1500 });
    }
  } catch (e) {
    /* cleanup only */
  }
}

// Count that has stopped changing (lets late-rendered timeline entries arrive before a baseline is taken).
async function stableCount(page, locator) {
  let prev = -1;
  let cur = await locator.count();
  for (let i = 0; i < 8 && cur !== prev; i += 1) {
    prev = cur;
    await page.waitForTimeout(150);
    cur = await locator.count();
  }
  return cur;
}

// REQ-5-2-2 Edit an Issue Title and Description (editor alice-dev, Admin).

test('REQ-5-2-2: Edit an Issue Title and Description - Scenario 1', async ({ page }) => {
  // intent: 有编辑权限的用户保存新标题和描述，重新打开后仍显示新值
  // A fresh issue is edited so the shared seeds keep their titles.
  const sfx = uid();
  const title = `pw-edit-${sfx}`;
  const newTitle = `pw-edited-${sfx}`;
  const newDescription = `Updated description ${sfx}`;
  await signIn(page, 'alice-dev');
  await createIssue(page, title, `Original description ${sfx}`);
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
  await expect(page.getByText('Open', { exact: true })).toBeVisible();
  // the issue-list summary shows the new title only
  await page.getByRole('link', { name: 'Issues', exact: true }).click();
  await expect(page.getByRole('link', { name: newTitle, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: title, exact: true })).toHaveCount(0);
});

test('REQ-5-2-2: Edit an Issue Title and Description - Scenario 2', async ({ page }) => {
  // intent: 空白标题保存失败且重新打开后仍保留原标题 (seed `Original issue title`)
  await signIn(page, 'alice-dev');
  await openIssue(page, 'Original issue title');
  await page.getByRole('button', { name: 'Edit issue title', exact: true }).click();
  await page.getByLabel('Issue title', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Save issue title', exact: true }).click();
  await expect(page.getByText('Title is required', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Original issue title', exact: true })).toBeVisible();
});
