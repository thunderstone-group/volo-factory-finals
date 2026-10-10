const { test, expect } = require('@playwright/test');

// REQ-4-4 Manage Repository Files Through the Web Interface.
// Contributor = seed owner alice-dev on the Code page of `alice-dev/acme-docs` (default branch).
// "Add file" button -> "Create new file" menuitem; field "File name", textbox "File contents",
// initially empty "Commit message", button "Commit changes". Messages: "Invalid file path",
// "Commit message is required".

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

// REQ-4 works on the repository "Code" page: overview -> repository navigation link "Code".
async function openCodePage(page, name) {
  await openRepo(page, name);
  await page.getByRole('link', { name: 'Code', exact: true }).click();
}

async function openNewFileEditor(page) {
  await page.getByRole('button', { name: 'Add file', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Create new file', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Commit changes', exact: true })).toBeVisible();
}

test('REQ-4-4: Manage Repository Files Through the Web Interface - Scenario 1', async ({ page }) => {
  // 有写权限的用户通过 Web 编辑器提交文件变更并保留提交历史
  const id = uid();
  const fileName = `pw-file-${id}.md`;
  const content = `Created through the web editor ${id}`;
  const message = `Add ${fileName}`;

  await signIn(page);
  await openCodePage(page, 'acme-docs');
  const repoUrl = page.url();
  await openNewFileEditor(page);
  await page.getByLabel('File name', { exact: true }).fill(fileName);
  await page.getByRole('textbox', { name: 'File contents', exact: true }).fill(content);
  const commitMessage = page.getByLabel('Commit message', { exact: true });
  await expect(commitMessage).toHaveValue('');
  await commitMessage.fill(message);
  await page.getByRole('button', { name: 'Commit changes', exact: true }).click();

  // the saved file view shows the exact content
  await expect(page.getByText(content, { exact: true })).toBeVisible();
  // its Commits link opens history with the exact message
  await page.getByRole('link', { name: 'Commits' }).click();
  await expect(page.getByText(message, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(message, { exact: true })).toBeVisible();
  // the file browser lists the new file
  await page.goto(repoUrl);
  await expect(page.getByRole('link', { name: fileName, exact: true })).toBeVisible();
});

test('REQ-4-4: Manage Repository Files Through the Web Interface - Scenario 2', async ({ page }) => {
  // 空提交消息或非法文件路径不会改变分支内容
  await signIn(page);
  await openCodePage(page, 'acme-docs');
  const repoUrl = page.url();
  const commitsLink = page.getByRole('link', { name: 'Commits' });
  const commitsLabelBefore = (await commitsLink.textContent()).trim();

  await openNewFileEditor(page);
  await page.getByLabel('File name', { exact: true }).fill('../invalid.md');
  await page.getByRole('textbox', { name: 'File contents', exact: true }).fill('must not be saved');
  await expect(page.getByLabel('Commit message', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Commit changes', exact: true }).click();

  // the reason is reported (invalid path and/or required message) and the editor stays open
  await expect(visible(page.getByText('Invalid file path').or(page.getByText('Commit message is required')))).not.toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Commit changes', exact: true })).toBeVisible();

  // files and history unchanged after reopening the Code page (full reload, so no editor state survives)
  await page.goto(repoUrl);
  await page.reload();
  await expect(page.getByRole('link', { name: 'Commits' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'invalid.md' })).toHaveCount(0);
  expect((await page.getByRole('link', { name: 'Commits' }).textContent()).trim()).toBe(commitsLabelBefore);
  await page.getByRole('link', { name: 'Commits' }).click();
  await expect(visible(page.getByText('Document search flow', { exact: true }))).not.toHaveCount(0);
  await expect(page.getByText('must not be saved')).toHaveCount(0);
});
