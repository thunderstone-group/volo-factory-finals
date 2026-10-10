// REQ-2-1-1 Browse Organization Repositories (orders 16-17). Both intents are visitor scenarios.
// Assumptions: a visitor reaches the public organization from the home page through a link carrying the seed
// organization name "Acme Demo" (the requirement names no other visitor entry point); the "Public" filter's role
// is not stated, so any control named exactly "Public" (button, link, radio, tab, option) or a native select
// option "Public" counts.
const { test, expect } = require('@playwright/test');

const ORG = 'Acme Demo';
const PUBLIC_REPO = 'acme-docs';
const PRIVATE_REPO = 'secret-research'; // the only private repository name the seed data gives

const filterBox = (page) => page.getByRole('textbox', { name: 'Find a repository', exact: true });

async function openOrgRepositoriesAsVisitor(page) {
  await page.goto('/');
  await page.getByRole('link', { name: ORG }).click();
  await page.getByRole('link', { name: 'Repositories', exact: true }).click();
  await expect(filterBox(page)).toBeVisible();
}

async function selectPublicFilter(page) {
  const named = ['button', 'link', 'radio', 'tab', 'menuitemradio', 'option']
    .map((role) => page.getByRole(role, { name: 'Public', exact: true }))
    .reduce((a, b) => a.or(b))
    .and(page.locator(':not(select *)'));
  const nativeSelect = page.getByRole('combobox').filter({ has: page.getByRole('option', { name: 'Public', exact: true }) });
  await expect(named.or(nativeSelect)).not.toHaveCount(0);
  if (await named.count()) await named.click();
  else await nativeSelect.selectOption({ label: 'Public' });
}

test('REQ-2-1-1: Browse Organization Repositories - Scenario 1', async ({ page }) => {
  await openOrgRepositoriesAsVisitor(page);
  await filterBox(page).fill(PUBLIC_REPO);
  await selectPublicFilter(page);
  const repoLink = page.getByRole('link', { name: PUBLIC_REPO, exact: true });
  await expect(repoLink).toBeVisible();
  await repoLink.click();
  // repository overview titled "organization name/repository name"
  await expect(page.getByRole('heading', { name: /\/\s*acme-docs(?![\w-])/ })).toBeVisible();
  // browser Back keeps the public result available
  await page.goBack();
  await expect(page.getByRole('link', { name: PUBLIC_REPO, exact: true })).toBeVisible();
});

test('REQ-2-1-1: Browse Organization Repositories - Scenario 2', async ({ page }) => {
  await openOrgRepositoriesAsVisitor(page);
  await filterBox(page).fill('');
  await expect(page.getByRole('link', { name: PUBLIC_REPO, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: PRIVATE_REPO, exact: true })).toHaveCount(0);

  // filtering by the exact private name exposes nothing
  await filterBox(page).fill(PRIVATE_REPO);
  await expect(page.getByRole('link', { name: PUBLIC_REPO, exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: PRIVATE_REPO, exact: true })).toHaveCount(0);

  // reopening the organization's list still hides it
  await openOrgRepositoriesAsVisitor(page);
  await filterBox(page).fill('');
  await expect(page.getByRole('link', { name: PUBLIC_REPO, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: PRIVATE_REPO, exact: true })).toHaveCount(0);
  await filterBox(page).fill(PRIVATE_REPO);
  await expect(page.getByRole('link', { name: PUBLIC_REPO, exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: PRIVATE_REPO, exact: true })).toHaveCount(0);
});
