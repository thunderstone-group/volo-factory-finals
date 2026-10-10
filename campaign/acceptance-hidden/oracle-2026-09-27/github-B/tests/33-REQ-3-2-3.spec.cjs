const { test, expect } = require('@playwright/test');

// REQ-3-2-3 Copy a Repository Clone Value.
// Visitor on the public repository `acme-docs` (owner namespace not assumed); clipboard permission is a stated
// browser precondition, so it is granted here. Controls: button "Code" (not the nav link),
// tabs "HTTPS" / "SSH", button "Copy clone value", feedback "Copied".

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

const visible = (locator) => locator.filter({ visible: true });

async function searchFor(page, query) {
  const box = page.getByRole('searchbox', { name: 'Search', exact: true });
  await box.fill(query);
  await box.press('Enter');
}

async function openRepo(page, name) {
  await searchFor(page, name);
  const link = page.getByRole('link', { name, exact: true });
  await expect(link).toBeVisible();
  const before = page.url();
  await link.click();
  await page.waitForURL((u) => u.toString() !== before);
  await expect(visible(page.getByRole('heading', { name }))).not.toHaveCount(0);
}

async function copyCloneValue(page, protocol) {
  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await page.getByRole('tab', { name: protocol, exact: true }).click();
  await page.getByRole('button', { name: 'Copy clone value', exact: true }).click();
  await expect(page.getByText('Copied')).toBeVisible();
  return page.evaluate(() => navigator.clipboard.readText());
}

test('REQ-3-2-3: Copy a Repository Clone Value - Scenario 1', async ({ page }) => {
  // 访客复制 HTTPS 克隆地址时得到可粘贴 URL 且仓库内容不变
  await page.goto('/');
  await openRepo(page, 'acme-docs');
  const value = await copyCloneValue(page, 'HTTPS');
  await expect(page.getByRole('heading', { name: 'acme-docs' })).toBeVisible();
  // HTTPS protocol, identifying this repository (<host>/<owner>/acme-docs[.git])
  expect(value).toMatch(/^https:\/\/\S+\/[^\s/]+\/acme-docs(\.git)?$/);
  // read-only: the repository is unchanged after reload
  await page.reload();
  await expect(page.getByRole('heading', { name: 'acme-docs' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'README.md', exact: true })).toBeVisible();
});

test('REQ-3-2-3: Copy a Repository Clone Value - Scenario 2', async ({ page }) => {
  // 用户选择 SSH 时复制 SSH 克隆地址
  await page.goto('/');
  await openRepo(page, 'acme-docs');
  const value = await copyCloneValue(page, 'SSH');
  await expect(page.getByRole('heading', { name: 'acme-docs' })).toBeVisible();
  // SSH format with the colon and .git suffix, identifying this repository
  expect(value).toMatch(/^[^\s@]+@[^\s:]+:[^\s/]+\/acme-docs\.git$/);
});
