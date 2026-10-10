const { expect: baseExpect } = require('@playwright/test');

const expect = baseExpect.configure({ timeout: 5000 });

function u() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function validPassword() {
  return `Valid-password-${u()}!`;
}

// REQ-1-1-1 / REQ-1-1-2
async function getSignedInUsername(page) {
  const menu = page.getByRole('button', { name: 'Account menu', exact: true });
  await expect(menu).toBeVisible();
  const text = await menu.innerText();
  const lines = text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const ignored = new Set([
    'Account menu',
    'Sign out',
    'Your organizations',
    'Settings',
    'New organization',
    'New repository',
  ]);
  return lines.find((line) => !ignored.has(line)) || lines[0] || text.trim();
}

async function chooseComboboxOptionLocator(page, combo, optionName) {
  const isNativeSelect = await combo
    .evaluate((el) => el instanceof HTMLSelectElement)
    .catch(() => false);
  if (isNativeSelect) {
    await combo.selectOption({ label: optionName });
  } else {
    await combo.click();
    await page.getByRole('option', { name: optionName, exact: true }).click();
  }
}

async function chooseComboboxOption(page, label, optionName) {
  await chooseComboboxOptionLocator(
    page,
    page.getByRole('combobox', { name: label, exact: true }),
    optionName
  );
}

async function switchBranchOnCodePage(page, branchName) {
  const selector = page.getByRole('button', { name: /^Branch / });
  await selector.click();
  await page.getByLabel('Find branch', { exact: true }).fill(branchName);
  await page.getByRole('option', { name: branchName, exact: true }).click();
  await expect(selector).toContainText(branchName);
}

// REQ-1-1-1
async function registerAccount(page) {
  page.setDefaultTimeout(5000);
  const username = `pw-user-${u()}`;
  const email = `${username}@example.test`;
  const password = validPassword();

  await page.goto('/', { timeout: 5000 });
  await page.getByRole('link', { name: 'Sign in', exact: true }).click({ timeout: 5000 });
  await page.getByRole('link', { name: 'Create an account', exact: true }).click({ timeout: 5000 });
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  return { username, email, password };
}

// REQ-1-1-2
async function signIn(page, credentials) {
  page.setDefaultTimeout(5000);
  const { username, email, password } = credentials;

  await page.goto('/', { timeout: 5000 });
  await page.getByRole('link', { name: 'Sign in', exact: true }).click({ timeout: 5000 });
  await page.getByLabel('Username or email', { exact: true }).fill(email || username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
  await expect(page.getByText(username).first()).toBeVisible();
  return credentials;
}

// REQ-1-1-1 + REQ-1-1-2
async function createSignedInAccount(page) {
  page.setDefaultTimeout(5000);
  const credentials = await registerAccount(page);
  return signIn(page, credentials);
}

// REQ-1-2
async function signOut(page) {
  page.setDefaultTimeout(5000);
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Sign out', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm sign out', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
}

// REQ-1-3
async function changePassword(page, { currentPassword, newPassword }) {
  page.setDefaultTimeout(5000);
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Password and authentication', exact: true }).click();
  await page.getByLabel('Current password', { exact: true }).fill(currentPassword);
  await page.getByLabel('New password', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirm password', { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: 'Update password', exact: true }).click();
  await expect(page.getByText('Password updated').first()).toBeVisible();
  return newPassword;
}

// REQ-1-1-3
async function requestPasswordReset(page, email) {
  page.setDefaultTimeout(5000);
  await page.goto('/', { timeout: 5000 });
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Forgot password', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
  await expect(page.getByText('123456').first()).toBeVisible();
  return { email };
}

// REQ-1-1-3
async function submitPasswordReset(
  page,
  { verificationCode = '123456', newPassword, confirmPassword }
) {
  page.setDefaultTimeout(5000);
  await page.getByLabel('Verification code', { exact: true }).fill(verificationCode);
  await page.getByLabel('New password', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirm password', { exact: true }).fill(confirmPassword || newPassword);
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();
}

// REQ-2-1-2
async function createOrganization(page, { name, displayName } = {}) {
  page.setDefaultTimeout(5000);
  const orgName = name || `pw-org-${u()}`;
  const orgDisplayName = displayName || `Display ${orgName}`;

  await page.goto('/', { timeout: 5000 });
  await page.getByRole('button', { name: 'Account menu', exact: true }).click();
  await page.getByRole('link', { name: 'Your organizations', exact: true }).click();
  await page.getByRole('link', { name: 'New organization', exact: true }).click();
  await page.getByLabel('Organization name', { exact: true }).fill(orgName);
  await page.getByLabel('Display name', { exact: true }).fill(orgDisplayName);
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();

  await expect(page.getByRole('heading', { name: new RegExp(orgName) })).toBeVisible();
  return { name: orgName, displayName: orgDisplayName, url: page.url() };
}

// REQ-2-2-3
async function addOrganizationMember(page, { org, account, role = 'Member' }) {
  page.setDefaultTimeout(5000);
  await page.goto(org.url, { timeout: 5000 });
  await page.getByRole('link', { name: 'People', exact: true }).click();
  await page.getByRole('button', { name: 'Add member', exact: true }).first().click();
  await page.getByLabel('Username or email', { exact: true }).fill(account.email || account.username);
  await chooseComboboxOption(page, 'Role', role);
  await page.getByRole('button', { name: 'Add member', exact: true }).last().click();
  await expect(page.getByText(account.username).first()).toBeVisible();
  return { org, account, role };
}

// REQ-2-2-4
async function removeOrganizationMember(page, { org, username }) {
  page.setDefaultTimeout(5000);
  await page.goto(org.url, { timeout: 5000 });
  await page.getByRole('link', { name: 'People', exact: true }).click();
  await page.getByRole('button', { name: `Member menu ${username}`, exact: true }).click();
  await page.getByRole('menuitem', { name: 'Remove from organization', exact: true }).click();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(
    page.getByRole('button', { name: `Member menu ${username}`, exact: true })
  ).not.toBeVisible();
  return { org, username };
}

// REQ-2-2-1
async function createTeam(page, { org, name, description, parent } = {}) {
  page.setDefaultTimeout(5000);
  const teamName = name || `pw-team-${u()}`;

  await page.goto(org.url, { timeout: 5000 });
  await page.getByRole('link', { name: 'Teams', exact: true }).click();
  await page.getByRole('link', { name: 'New team', exact: true }).click();
  await page.getByLabel('Team name', { exact: true }).fill(teamName);
  if (description) {
    await page.getByLabel('Description', { exact: true }).fill(description);
  }
  if (parent) {
    await chooseComboboxOption(page, 'Parent team', parent);
  }
  await page.getByRole('button', { name: 'Create team', exact: true }).click();

  await expect(
    page.getByRole('heading', { name: new RegExp(`${org.name}/${teamName}`) })
  ).toBeVisible();
  return { org, name: teamName, description, parent, url: page.url() };
}

// REQ-2-2-2
async function addTeamMember(page, { team, username }) {
  page.setDefaultTimeout(5000);
  await page.goto(team.url, { timeout: 5000 });
  await page.getByRole('link', { name: 'Members', exact: true }).click();
  await page.getByRole('button', { name: 'Add member', exact: true }).first().click();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByRole('button', { name: 'Add member', exact: true }).last().click();
  await expect(page.getByText(username).first()).toBeVisible();
  return { team, username };
}

// REQ-2-2-2
async function removeTeamMember(page, { team, username }) {
  page.setDefaultTimeout(5000);
  await page.goto(team.url, { timeout: 5000 });
  await page.getByRole('link', { name: 'Members', exact: true }).click();
  await page.getByRole('button', { name: `Remove ${username}`, exact: true }).click();
  await expect(
    page.getByRole('button', { name: `Remove ${username}`, exact: true })
  ).not.toBeVisible();
  return { team, username };
}

// REQ-2-2-2
async function setTeamParent(page, { team, parentName }) {
  page.setDefaultTimeout(5000);
  await page.goto(team.url, { timeout: 5000 });
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await chooseComboboxOption(page, 'Parent team', parentName);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  return { team, parentName };
}

// REQ-2-3
async function grantRepositoryAccess(page, { repo, subjectName, role }) {
  page.setDefaultTimeout(5000);
  await page.goto(repo.url, { timeout: 5000 });
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Manage access', exact: true }).click();
  await page.getByRole('button', { name: 'Add people or teams', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search', exact: true }).last().fill(subjectName);
  await page.getByRole('option', { name: subjectName, exact: true }).click();
  await chooseComboboxOptionLocator(
    page,
    page.getByRole('combobox', { name: 'Role', exact: true }).last(),
    role
  );
  await page.getByRole('button', { name: 'Add', exact: true }).last().click();
  await expect(page.getByText(subjectName).first()).toBeVisible();
  return { repo, subjectName, role };
}

// REQ-3-2-1
async function createRepository(page, options = {}) {
  page.setDefaultTimeout(5000);
  const repoName = options.name || `pw-repo-${u()}`;
  const visibility = options.visibility || 'Private';
  const readme = options.readme !== false;
  const description = options.description || '';

  await page.goto('/', { timeout: 5000 });
  await page.getByRole('link', { name: 'New repository', exact: true }).click();
  if (options.owner) {
    await chooseComboboxOption(page, 'Owner', options.owner);
  }
  await page.getByLabel('Repository name', { exact: true }).fill(repoName);
  if (description) {
    await page.getByLabel('Description', { exact: true }).fill(description);
  }
  await page.getByRole('radio', { name: visibility, exact: true }).check();
  if (readme) {
    await page.getByRole('checkbox', { name: 'Add a README file', exact: true }).check();
  }
  await page.getByRole('button', { name: 'Create repository', exact: true }).click();

  await expect(page.getByRole('heading', { name: new RegExp(repoName) })).toBeVisible();
  const url = page.url();
  const pathSegments = new URL(url).pathname.split('/').filter(Boolean);
  const owner =
    options.owner ||
    pathSegments[0] ||
    (await getSignedInUsername(page).catch(() => '')) ||
    null;
  return { owner, name: repoName, description, visibility, readme, url };
}

// REQ-3-2-2
async function forkRepository(page, { repo, name, owner } = {}) {
  page.setDefaultTimeout(5000);
  await page.goto(repo.url, { timeout: 5000 });
  await page.getByRole('button', { name: 'Fork', exact: true }).click();
  if (owner) {
    await chooseComboboxOption(page, 'Owner', owner);
  }
  if (name) {
    await page.getByLabel('Repository name', { exact: true }).fill(name);
  }
  await page.getByRole('button', { name: 'Create fork', exact: true }).click();

  await expect(page.getByText(`Forked from ${repo.name}`).first()).toBeVisible();
  const url = page.url();
  const pathSegments = new URL(url).pathname.split('/').filter(Boolean);
  const forkOwner = owner || pathSegments[0] || '';
  const forkName = name || pathSegments[1] || repo.name;
  return { owner: forkOwner, name: forkName, url, source: repo };
}

// REQ-3-4
async function setRepositoryVisibility(page, { repo, visibility = 'Public' } = {}) {
  page.setDefaultTimeout(5000);
  await page.goto(repo.url, { timeout: 5000 });
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'General', exact: true }).click();
  await page.getByRole('button', { name: 'Change visibility', exact: true }).click();
  await page.getByRole('radio', { name: visibility, exact: true }).check();
  await page.getByRole('button', { name: 'Confirm visibility', exact: true }).click();
  await page.goto(repo.url, { timeout: 5000 });
  await expect(page.getByText(visibility, { exact: true }).first()).toBeVisible();
  return { ...repo, visibility };
}

// REQ-4-3-1
async function selectBranch(page, repo, branchName) {
  page.setDefaultTimeout(5000);
  await page.goto(repo.url, { timeout: 5000 });
  await page.getByRole('link', { name: 'Code', exact: true }).click();
  await switchBranchOnCodePage(page, branchName);
  return branchName;
}

// REQ-4-3-2
async function createBranch(page, { repo, name, base } = {}) {
  page.setDefaultTimeout(5000);
  const branchName = name || `pw-branch-${u()}`;

  await page.goto(repo.url, { timeout: 5000 });
  await page.getByRole('link', { name: 'Code', exact: true }).click();
  if (base) {
    await switchBranchOnCodePage(page, base);
  }
  const selector = page.getByRole('button', { name: /^Branch / });
  await selector.click();
  await page.getByLabel('Find branch', { exact: true }).fill(branchName);
  await page
    .getByRole('option', { name: `Create branch: ${branchName}`, exact: true })
    .click();
  await expect(selector).toContainText(branchName);
  return { repo, name: branchName, base: base || null, url: page.url() };
}

// REQ-4-4
async function createFile(page, { repo, branch, path, content, message } = {}) {
  page.setDefaultTimeout(5000);
  const commitMessage = message || `Add ${path}`;

  await page.goto(repo.url, { timeout: 5000 });
  await page.getByRole('link', { name: 'Code', exact: true }).click();
  if (branch) {
    await switchBranchOnCodePage(page, branch);
  }
  await page.getByRole('button', { name: 'Add file', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Create new file', exact: true }).click();
  await page.getByLabel('File name', { exact: true }).fill(path);
  await page.getByLabel('File contents', { exact: true }).fill(content);
  await page.getByLabel('Commit message', { exact: true }).fill(commitMessage);
  await page.getByRole('button', { name: 'Commit changes', exact: true }).click();

  await expect(page.getByText(content).first()).toBeVisible();
  return { repo, branch, path, content, message: commitMessage, url: page.url() };
}

// REQ-5-2-1
async function createIssue(page, { repo, title, description = '' } = {}) {
  page.setDefaultTimeout(5000);
  const issueTitle = title || `Issue ${u()}`;

  await page.goto(repo.url, { timeout: 5000 });
  await page.getByRole('link', { name: 'Issues', exact: true }).click();
  await page.getByRole('link', { name: 'New issue', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(issueTitle);
  if (description) {
    await page.getByLabel('Description', { exact: true }).fill(description);
  }
  await page.getByRole('button', { name: 'Submit new issue', exact: true }).click();

  await expect(page.getByRole('heading', { name: issueTitle, exact: true })).toBeVisible();
  return { repo, title: issueTitle, description, url: page.url() };
}

// REQ-5-2-2
async function editIssueTitle(page, issue, newTitle) {
  page.setDefaultTimeout(5000);
  await page.goto(issue.url, { timeout: 5000 });
  await page.getByRole('button', { name: 'Edit issue title', exact: true }).click();
  await page.getByLabel('Issue title', { exact: true }).fill(newTitle);
  await page.getByRole('button', { name: 'Save issue title', exact: true }).click();
  await expect(page.getByRole('heading', { name: newTitle, exact: true })).toBeVisible();
  return { ...issue, title: newTitle };
}

// REQ-5-2-2
async function editIssueDescription(page, issue, newDescription) {
  page.setDefaultTimeout(5000);
  await page.goto(issue.url, { timeout: 5000 });
  await page.getByRole('button', { name: 'Edit issue description', exact: true }).click();
  await page.getByLabel('Issue description', { exact: true }).fill(newDescription);
  await page.getByRole('button', { name: 'Save issue description', exact: true }).click();
  await expect(page.getByText(newDescription).first()).toBeVisible();
  return { ...issue, description: newDescription };
}

// REQ-5-2-3
async function addIssueComment(page, issue, body) {
  page.setDefaultTimeout(5000);
  await page.goto(issue.url, { timeout: 5000 });
  await page.getByLabel('Comment', { exact: true }).fill(body);
  await page.getByRole('button', { name: 'Comment', exact: true }).click();
  await expect(page.getByText(body).first()).toBeVisible();
  return { issue, comment: body };
}

// REQ-5-3-1
async function assignIssue(page, { issue, username }) {
  page.setDefaultTimeout(5000);
  await page.goto(issue.url, { timeout: 5000 });
  await page.getByRole('button', { name: 'Assignees', exact: true }).click();
  await page.getByLabel('Search assignees', { exact: true }).fill(username);
  await page.getByRole('option', { name: username, exact: true }).click();
  return { issue, username };
}

// REQ-5-3-2
async function applyLabel(page, { issue, label }) {
  page.setDefaultTimeout(5000);
  await page.goto(issue.url, { timeout: 5000 });
  await page.getByRole('button', { name: 'Labels', exact: true }).click();
  await page.getByRole('option', { name: label, exact: true }).click();
  return { issue, label };
}

// REQ-5-3-3
async function setMilestone(page, { issue, milestone }) {
  page.setDefaultTimeout(5000);
  await page.goto(issue.url, { timeout: 5000 });
  await page.getByRole('button', { name: 'Milestone', exact: true }).click();
  await page.getByRole('option', { name: milestone, exact: true }).click();
  return { issue, milestone };
}

// REQ-5-4
async function closeIssue(page, issue) {
  page.setDefaultTimeout(5000);
  await page.goto(issue.url, { timeout: 5000 });
  await page.getByRole('button', { name: 'Close issue', exact: true }).click();
  await expect(page.getByText('Closed', { exact: true }).first()).toBeVisible();
  return issue;
}

// REQ-5-4
async function reopenIssue(page, issue) {
  page.setDefaultTimeout(5000);
  await page.goto(issue.url, { timeout: 5000 });
  await page.getByRole('button', { name: 'Reopen issue', exact: true }).click();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  return issue;
}

// REQ-6-2-3 / REQ-6-2-4
async function createPullRequest(page, { repo, base = 'main', compare, title, description = '', draft = false } = {}) {
  page.setDefaultTimeout(5000);
  const prTitle = title || `PR ${u()}`;
  const createName = draft ? 'Create draft pull request' : 'Create pull request';

  await page.goto(repo.url, { timeout: 5000 });
  await page.getByRole('link', { name: 'Pull requests', exact: true }).click();
  await page.getByRole('link', { name: 'New pull request', exact: true }).click();
  await chooseComboboxOption(page, 'base', base);
  await chooseComboboxOption(page, 'compare', compare);
  await page
    .getByRole('button', { name: 'Compare changes', exact: true })
    .click({ timeout: 3000 })
    .catch(() => {});
  await page.getByRole('button', { name: createName, exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(prTitle);
  if (description) {
    await page.getByLabel('Description', { exact: true }).fill(description);
  }
  await page.getByRole('button', { name: createName, exact: true }).last().click();

  await expect(page.getByRole('heading', { name: prTitle, exact: true })).toBeVisible();
  await expect(
    page.getByText(draft ? 'Draft' : 'Open', { exact: true }).first()
  ).toBeVisible();
  return { repo, base, compare, title: prTitle, description, draft, url: page.url() };
}

// REQ-6-2-4
async function createDraftPullRequest(page, options) {
  return createPullRequest(page, { ...options, draft: true });
}

// REQ-6-2-4
async function markPullRequestReady(page, pr) {
  page.setDefaultTimeout(5000);
  await page.goto(pr.url, { timeout: 5000 });
  await page.getByRole('button', { name: 'Ready for review', exact: true }).click();
  await page
    .getByRole('button', { name: 'Confirm', exact: true })
    .click({ timeout: 2500 })
    .catch(() => {});
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  return pr;
}

// REQ-6-1
async function addBranchProtectionRule(page, { repo, pattern, requireApproval = true, requireCheck = true } = {}) {
  page.setDefaultTimeout(5000);
  await page.goto(repo.url, { timeout: 5000 });
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Branches', exact: true }).click();
  await page.getByRole('button', { name: 'Add branch protection rule', exact: true }).click();
  await page.getByLabel('Branch name pattern', { exact: true }).fill(pattern);
  if (requireApproval) {
    await page.getByRole('checkbox', { name: 'Require 1 approval', exact: true }).check();
  }
  if (requireCheck) {
    await page.getByRole('checkbox', { name: 'Require status check test', exact: true }).check();
  }
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByText(pattern).first()).toBeVisible();
  return { repo, pattern, requireApproval, requireCheck };
}

// REQ-6-1
async function setCheckStatus(page, { pr, status }) {
  page.setDefaultTimeout(5000);
  await page.goto(pr.url, { timeout: 5000 });
  await page.getByRole('link', { name: 'Checks', exact: true }).click();
  await chooseComboboxOption(page, 'test status', status);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(`test: ${status}`).first()).toBeVisible();
  return { pr, status };
}

// REQ-6-3-4
async function submitPullRequestReview(page, { pr, decision, summary = '' } = {}) {
  page.setDefaultTimeout(5000);
  await page.goto(pr.url, { timeout: 5000 });
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await page.getByRole('button', { name: 'Review changes', exact: true }).click();
  if (summary) {
    await page.getByLabel('Summary', { exact: true }).fill(summary);
  }
  await page.getByRole('radio', { name: decision, exact: true }).check();
  await page.getByRole('button', { name: 'Submit review', exact: true }).click();

  const statusText =
    decision === 'Approve'
      ? 'Approved'
      : decision === 'Request changes'
        ? 'Changes requested'
        : 'Comment';
  await expect(page.getByText(statusText).first()).toBeVisible();
  return { pr, decision, summary };
}

// REQ-6-3-3
async function addInlineComment(page, { pr, body, mode = 'single' } = {}) {
  page.setDefaultTimeout(5000);
  await page.goto(pr.url, { timeout: 5000 });
  await page.getByRole('link', { name: 'Files changed', exact: true }).click();
  await page.getByRole('button', { name: 'Add comment', exact: true }).first().click();
  await page.getByLabel('Comment', { exact: true }).fill(body);
  if (mode === 'review') {
    await page.getByRole('button', { name: 'Start a review', exact: true }).click();
  } else {
    await page.getByRole('button', { name: 'Add single comment', exact: true }).click();
  }
  await expect(page.getByText(body).first()).toBeVisible();
  return { pr, body, mode };
}

// REQ-6-4
async function requestReviewer(page, { pr, username }) {
  page.setDefaultTimeout(5000);
  await page.goto(pr.url, { timeout: 5000 });
  await page.getByRole('button', { name: 'Reviewers', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search', exact: true }).last().fill(username);
  await page.getByRole('option', { name: username, exact: true }).click();
  await expect(page.getByText(username).first()).toBeVisible();
  return { pr, username };
}

// REQ-6-4
async function removeReviewer(page, { pr, username }) {
  page.setDefaultTimeout(5000);
  await page.goto(pr.url, { timeout: 5000 });
  await page.getByRole('button', { name: `Remove ${username}`, exact: true }).click();
  return { pr, username };
}

// REQ-6-5
async function mergePullRequest(page, pr) {
  page.setDefaultTimeout(5000);
  await page.goto(pr.url, { timeout: 5000 });
  await page.getByRole('button', { name: 'Merge pull request', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm merge', exact: true }).click();
  await expect(page.getByText('Merged', { exact: true }).first()).toBeVisible();
  return pr;
}

// REQ-6-6
async function closePullRequest(page, pr) {
  page.setDefaultTimeout(5000);
  await page.goto(pr.url, { timeout: 5000 });
  await page.getByRole('button', { name: 'Close pull request', exact: true }).click();
  await expect(page.getByText('Closed', { exact: true }).first()).toBeVisible();
  return pr;
}

// REQ-6-6
async function reopenPullRequest(page, pr) {
  page.setDefaultTimeout(5000);
  await page.goto(pr.url, { timeout: 5000 });
  await page.getByRole('button', { name: 'Reopen pull request', exact: true }).click();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  return pr;
}

// REQ-4-3-3
async function setDefaultBranch(page, { repo, branch }) {
  page.setDefaultTimeout(5000);
  await page.goto(repo.url, { timeout: 5000 });
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Branches', exact: true }).click();
  await chooseComboboxOption(page, 'Default branch', branch);
  await page.getByRole('button', { name: 'Update', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  return { repo, branch };
}

module.exports = {
  u,
  validPassword,
  getSignedInUsername,
  registerAccount,
  signIn,
  createSignedInAccount,
  signOut,
  changePassword,
  requestPasswordReset,
  submitPasswordReset,
  createOrganization,
  addOrganizationMember,
  removeOrganizationMember,
  createTeam,
  addTeamMember,
  removeTeamMember,
  setTeamParent,
  grantRepositoryAccess,
  createRepository,
  forkRepository,
  setRepositoryVisibility,
  selectBranch,
  createBranch,
  createFile,
  createIssue,
  editIssueTitle,
  editIssueDescription,
  addIssueComment,
  assignIssue,
  applyLabel,
  setMilestone,
  closeIssue,
  reopenIssue,
  createPullRequest,
  createDraftPullRequest,
  markPullRequestReady,
  addBranchProtectionRule,
  setCheckStatus,
  submitPullRequestReview,
  addInlineComment,
  requestReviewer,
  removeReviewer,
  mergePullRequest,
  closePullRequest,
  reopenPullRequest,
  setDefaultBranch,
};
