const { test, expect } = require('@playwright/test');

// REQ-3-2-1 Create a Repository with Owner, Visibility, and Initialization Options.
// Signed in as the seed account alice-dev; "New repository" link on the signed-in workspace;
// labels "Owner", "Repository name", "Description"; radios "Public"/"Private";
// checkbox "Add a README file"; button "Create repository".

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

async function openNewRepositoryForm(page) {
  await signIn(page);
  await page.getByRole('link', { name: 'New repository', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Create repository', exact: true })).toBeVisible();
}

// Resolves once the submission round-trip (if any) has answered, so negative checks are not vacuous.
function nextWrite(page) {
  return page
    .waitForResponse((r) => r.request().method() !== 'GET', { timeout: 3000 })
    .catch(() => null);
}

async function searchFor(page, query) {
  const box = page.getByRole('searchbox', { name: 'Search', exact: true });
  await box.fill(query);
  await box.press('Enter');
}

test('REQ-3-2-1: Create a Repository with Owner, Visibility, and Initialization Options - Scenario 1', async ({ page }) => {
  // 已登录用户以指定可见性和 README 初始化创建仓库
  const name = `pw-repo-${uid()}`;
  await openNewRepositoryForm(page);
  await page.getByLabel('Repository name', { exact: true }).fill(name);
  await page.getByLabel('Description', { exact: true }).fill('Repository created by Playwright');
  await page.getByRole('radio', { name: 'Private', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Add a README file', exact: true }).check();
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();

  const heading = page.getByRole('heading', { name });
  const privateMarker = page.getByText('Private', { exact: true });
  const readme = page.getByRole('link', { name: 'README.md', exact: true });
  await expect(heading).toBeVisible();
  await expect(privateMarker).toBeVisible();
  await expect(readme).toBeVisible();
  await expect(page.getByText('Repository created by Playwright')).toBeVisible();

  await page.reload();
  await expect(heading).toBeVisible();
  await expect(privateMarker).toBeVisible();
  await expect(readme).toBeVisible();
  await expect(page.getByText('Repository created by Playwright')).toBeVisible();
});

test('REQ-3-2-1: Create a Repository with Owner, Visibility, and Initialization Options - Scenario 2', async ({ page }) => {
  // 重复仓库名不会创建半完成的仓库
  // Duplicate name: `acme-docs-fork`, the seed the requirements place explicitly "in the target personal
  // namespace" of the signed-in user (REQ-3-2-2). acme-docs / secret-research are not used because apps
  // legitimately disagree on their namespace (REQ-3 seeds say owner alice-dev, REQ-2 seeds list the org).
  await signIn(page);
  const workspaceUrl = page.url();
  await searchFor(page, 'acme-docs-fork');
  const results = page.getByRole('link', { name: 'acme-docs-fork', exact: true });
  await expect(results).not.toHaveCount(0);
  const before = await results.count();

  await page.goto(workspaceUrl);
  await page.getByRole('link', { name: 'New repository', exact: true }).click();
  await page.getByLabel('Repository name', { exact: true }).fill('acme-docs-fork');
  const answered = nextWrite(page);
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();
  await answered;
  // stays on the form and does not open the existing repository heading
  await expect(page.getByRole('button', { name: 'Create repository', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'acme-docs-fork' })).toHaveCount(0);
  // no additional (partial) repository with that name exists
  await page.goto(workspaceUrl);
  await page.reload();
  await searchFor(page, 'acme-docs-fork');
  await expect(results).not.toHaveCount(0);
  expect(await results.count()).toBe(before);
});

test('REQ-3-2-1: Create a Repository with Owner, Visibility, and Initialization Options - Scenario 3', async ({ page }) => {
  // 空仓库名不会创建仓库并显示字段错误
  await openNewRepositoryForm(page);
  const nameField = page.getByLabel('Repository name', { exact: true });
  await expect(nameField).toHaveValue('');
  const answered = nextWrite(page);
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();
  await answered;
  // still on the creation form
  await expect(page.getByRole('button', { name: 'Create repository', exact: true })).toBeVisible();
  await expect(nameField).toBeVisible();
  // a field error is shown (its text is not specified): a visible alert or a message about the name,
  // an aria-invalid name field, or the browser's own required-field validation on the name input
  await expect
    .poll(async () => {
      const msg = await visible(
        page.getByRole('alert').or(page.getByText(/required|empty|blank|invalid/i)),
      ).count();
      const invalid = await nameField.evaluate(
        (el) => el.getAttribute('aria-invalid') === 'true' || (el.validity && el.validity.valueMissing === true),
      );
      return msg > 0 || invalid;
    })
    .toBe(true);
});
