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

// REQ-6-2-1 List and Filter Repository Pull Requests (visitor; seeded Open PR `Fix search`).
// Assumption: of the two seeded PRs, `Fix search` is the public Open PR (it carries the `src/search.ts` change used
// by REQ-6-3-2) and `Improve onboarding` is the Closed one of the filtering scenario.

const OPEN_PR = 'Fix search';

test('REQ-6-2-1: List and Filter Repository Pull Requests - Scenario 1', async ({ page }) => {
  // intent: 用户按打开状态筛选拉取请求并打开目标提案
  await page.goto('/');
  await openPRs(page);
  const pr = page.getByRole('link', { name: OPEN_PR, exact: true });
  await page.getByRole('link', { name: 'Open', exact: true }).click();
  await expect(pr).toBeVisible();
  await page.getByRole('link', { name: 'Closed', exact: true }).click();
  await expect(pr).toHaveCount(0);
  await page.getByRole('link', { name: 'Open', exact: true }).click();
  await pr.click();
  await expect(page.getByRole('heading', { name: OPEN_PR, exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true })).toBeVisible();
});

test('REQ-6-2-1: List and Filter Repository Pull Requests - Scenario 2', async ({ page }) => {
  // intent: 打开状态筛选在刷新后仍保持相同提案可见
  await page.goto('/');
  await openPRs(page);
  const pr = page.getByRole('link', { name: OPEN_PR, exact: true });
  await page.getByRole('link', { name: 'Open', exact: true }).click();
  await expect(pr).toBeVisible();
  await page.reload();
  await expect(pr).toBeVisible();
  await pr.click();
  await expect(page.getByRole('heading', { name: OPEN_PR, exact: true })).toBeVisible();
});

test('REQ-6-2-1: List and Filter Repository Pull Requests - Scenario 3', async ({ page }) => {
  // intent: 离开后重新进入拉取请求列表仍能找到打开状态提案
  await page.goto('/');
  await openPRs(page);
  const pr = page.getByRole('link', { name: OPEN_PR, exact: true });
  await page.getByRole('link', { name: 'Open', exact: true }).click();
  await expect(pr).toBeVisible();
  const listUrl = page.url();
  await page.goto('/');
  await expect(page.getByRole('searchbox', { name: 'Search', exact: true })).toBeVisible();
  await page.goto(listUrl);
  await page.getByRole('link', { name: 'Open', exact: true }).click();
  await expect(pr).toBeVisible();
  await pr.click();
  await expect(page.getByRole('heading', { name: OPEN_PR, exact: true })).toBeVisible();
});
