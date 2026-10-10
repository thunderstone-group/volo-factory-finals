const { test, expect } = require('@playwright/test');

// REQ-3-4 Change Repository Visibility with Permission Checks.
// S1: Admin = seed owner alice-dev; the currently private repository = seed `secret-research`
//     (no later scenario depends on it staying private). Settings -> General -> "Change visibility"
//     -> radio "Public" -> "Confirm visibility"; afterwards an unauthenticated visitor can open it.
// S2: the non-Admin is a freshly registered account (no seed credentials exist for another user);
//     on the readable public repository it must not see a "Change visibility" button, even if a
//     Settings link is reachable.

const OWNER = 'alice-dev';
const PASSWORD = 'Valid-password-123!';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const visible = (locator) => locator.filter({ visible: true });

async function signIn(page, username = OWNER, password = PASSWORD) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toHaveCount(0);
  await expect(visible(page.getByText(username))).not.toHaveCount(0);
}

// REQ-1-1-1 registration flow, then sign in with the new account.
async function registerAndSignIn(page) {
  const username = `pw-na-${uid()}`;
  const password = 'Valid-password-123!';
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page
    .getByRole('link', { name: 'Create an account', exact: true })
    .or(page.getByRole('button', { name: 'Create an account', exact: true }))
    .click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(`${username}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByLabel('Username or email', { exact: true })).toBeVisible();
  await page.getByLabel('Username or email', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toHaveCount(0);
  await expect(visible(page.getByText(username))).not.toHaveCount(0);
  return username;
}

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

test('REQ-3-4: Change Repository Visibility with Permission Checks - Scenario 1', async ({ page, browser }) => {
  // 仓库管理员确认变更可见性后，访客访问规则同步更新
  await signIn(page);
  await openRepo(page, 'secret-research');
  await expect(page.getByText('Private', { exact: true })).toBeVisible();
  const repoUrl = page.url();

  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'General', exact: true }).click();
  await page.getByRole('button', { name: 'Change visibility', exact: true }).click();
  await page.getByRole('radio', { name: 'Public', exact: true }).check();
  await page.getByRole('button', { name: 'Confirm visibility', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Confirm visibility', exact: true })).toHaveCount(0);

  // overview shows the Public marker, also after reload
  await page.goto(repoUrl);
  await expect(page.getByText('Public', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Public', { exact: true })).toBeVisible();

  // an unauthenticated visitor can now open the same address and find it in search
  const visitorContext = await browser.newContext();
  const visitor = await visitorContext.newPage();
  try {
    await visitor.goto(repoUrl);
    await expect(visitor.getByRole('heading', { name: 'secret-research' })).toBeVisible();
    await visitor.goto(new URL('/', repoUrl).toString());
    await searchFor(visitor, 'secret-research');
    await expect(visitor.getByRole('link', { name: 'secret-research', exact: true })).toBeVisible();
  } finally {
    await visitorContext.close();
  }
});

test('REQ-3-4: Change Repository Visibility with Permission Checks - Scenario 2', async ({ page }) => {
  // 无管理员权限的用户不能看到可执行的可见性修改入口
  await registerAndSignIn(page);
  await openRepo(page, 'acme-docs');
  await expect(page.getByRole('link', { name: 'Code', exact: true })).toBeVisible();

  const settings = page.getByRole('link', { name: 'Settings', exact: true });
  if ((await settings.count()) > 0) {
    await settings.click();
    await page.waitForTimeout(400);
    const general = page.getByRole('link', { name: 'General', exact: true });
    if ((await general.count()) > 0) {
      await general.click();
      await page.waitForTimeout(400);
    }
  }
  await expect(page.getByRole('button', { name: 'Change visibility' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Confirm visibility' })).toHaveCount(0);
});
