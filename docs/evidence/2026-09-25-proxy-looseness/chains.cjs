'use strict';
// Pollution chains (earlier hidden scenario run to its most plausible failing point on the SAME backend,
// then the subject scenario) plus follow-up facet probes that look past a first failure.
// Usage: node chains.cjs [filter...]
const H = require('./harness.cjs');
const { expect, T, uniq, signIn, register, openRepo, openAccountMenuLink } = H;
const PW = 'Valid-password-123!';

// Runs `steps` in order on one backend; each step is its own Probe (fresh contexts), like hidden tests.
async function chain(pr, parts) { for (const [name, fn] of parts) { pr.log.push(`--- ${name}`); await fn(pr); } }

const hiddenLike = {
  // REQ-5-4 S1 as the description words it: Close -> Closed + "Closed issue" activity -> Reopen.
  async req54s1(pr) {
    const page = await pr.newPage();
    await signIn(pr, page);
    await openRepo(pr, page, 'acme-docs');
    await pr.step('[S1] click "Issues"', () => page.getByRole('link', { name: 'Issues', exact: true }).click());
    await pr.step('[S1] click issue', () => page.getByRole('link', { name: 'Improve onboarding', exact: true }).click());
    await pr.step('[S1] click "Close issue"', () => page.getByRole('button', { name: 'Close issue', exact: true }).click());
    await pr.step('[S1] status Closed', () => expect(page.getByText('Closed', { exact: true })).toBeVisible(T));
    await pr.step('[S1] "Closed issue" activity', () => expect(page.getByText('Closed issue')).toBeVisible(T));
    await pr.step('[S1] click "Reopen issue"', () => page.getByRole('button', { name: 'Reopen issue', exact: true }).click());
  },
  // REQ-6-1 S1 as the description words it.
  async req61s1(pr) {
    const page = await pr.newPage();
    await signIn(pr, page);
    await openRepo(pr, page, 'acme-docs');
    await pr.step('[6-1] click "Settings"', () => page.getByRole('link', { name: 'Settings', exact: true }).click());
    await pr.step('[6-1] click "Branches"', () => page.getByRole('link', { name: 'Branches', exact: true }).click());
    await pr.step('[6-1] click "Add branch protection rule"', () => page.getByRole('button', { name: 'Add branch protection rule', exact: true }).click());
    await pr.step('[6-1] fill "Branch name pattern" main', () => page.getByLabel('Branch name pattern', { exact: true }).fill('main'));
    await pr.step('[6-1] check "Require 1 approval"', () => page.getByRole('checkbox', { name: 'Require 1 approval', exact: true }).check());
    await pr.step('[6-1] check "Require status check test"', () => page.getByRole('checkbox', { name: 'Require status check test', exact: true }).check());
    await pr.step('[6-1] click "Create"', () => page.getByRole('button', { name: 'Create', exact: true }).click());
    await pr.step('[6-1] rule shows "main"', () => expect(page.getByText('main', { exact: true })).toBeVisible(T));
    await pr.step('[6-1] summary "1 approval"', () => expect(page.getByText('1 approval', { exact: true })).toBeVisible(T));
    await pr.step('[6-1] click "Pull requests"', () => page.getByRole('link', { name: 'Pull requests', exact: true }).click());
    await pr.step('[6-1] click PR', () => page.getByRole('link', { name: 'Improve onboarding', exact: true }).click());
    await pr.step('[6-1] click "Checks"', () => page.getByRole('link', { name: 'Checks', exact: true }).click());
    await pr.step('[6-1] "test: pending"', () => expect(page.getByText('test: pending')).toBeVisible(T));
    await pr.step('[6-1] open combobox "test status"', () => page.getByRole('combobox', { name: 'test status', exact: true }).click());
    await pr.step('[6-1] click option "success"', () => page.getByRole('option', { name: 'success', exact: true }).click());
  },
  async req212s1(pr) {
    const page = await pr.newPage();
    await signIn(pr, page);
    await openAccountMenuLink(pr, page, 'Your organizations');
    await pr.step('[S1] click "New organization"', () => page.getByRole('link', { name: 'New organization', exact: true }).click());
    await pr.step('[S1] fill mobile-guild', () => page.getByLabel('Organization name', { exact: true }).fill('mobile-guild'));
    await pr.step('[S1] fill Mobile Guild', () => page.getByLabel('Display name', { exact: true }).fill('Mobile Guild'));
    await pr.step('[S1] click "Create organization"', () => page.getByRole('button', { name: 'Create organization', exact: true }).click());
    await pr.step('[S1] heading contains mobile-guild', () => expect(page.getByRole('heading', { name: /mobile-guild/ })).toBeVisible(T));
  },
};

// Run a hidden-like predecessor, swallow its failure (it is expected to fail), then run the subject.
function withPredecessor(pred, subject) {
  return async (pr) => {
    const saved = pr.step.bind(pr);
    try { await pred(pr); } catch (e) {}
    if (pr.fail) { pr.log.push(`(predecessor stopped at: ${pr.fail.label})`); pr.predFail = pr.fail; pr.fail = null; }
    await subject(pr);
  };
}

const probes = {
  'CHAIN REQ-5-4 S1 -> S2 (fresh Read viewer)': withPredecessor(hiddenLike.req54s1, async (pr) => {
    const page = await pr.newPage(); const u = `pw-ro-${uniq()}`;
    await register(pr, page, u, `${u}@example.test`);
    await signIn(pr, page, u, PW);
    await openRepo(pr, page, 'acme-docs');
    await pr.step('[S2] click "Issues"', () => page.getByRole('link', { name: 'Issues', exact: true }).click());
    await pr.step('[S2] click issue "Improve onboarding" in default list', () => page.getByRole('link', { name: 'Improve onboarding', exact: true }).click());
    await pr.step('[S2] status Open', () => expect(page.getByText('Open', { exact: true })).toBeVisible(T));
  }),
  'CHAIN REQ-6-1 S1 -> REQ-6-5 S1 (merge)': withPredecessor(hiddenLike.req61s1, async (pr) => {
    const page = await pr.newPage();
    await signIn(pr, page);
    await openRepo(pr, page, 'acme-docs');
    await pr.step('[6-5] click "Pull requests"', () => page.getByRole('link', { name: 'Pull requests', exact: true }).click());
    await pr.step('[6-5] click PR "Improve onboarding"', () => page.getByRole('link', { name: 'Improve onboarding', exact: true }).click());
    await pr.step('[6-5] "Merge pull request" enabled', () => expect(page.getByRole('button', { name: 'Merge pull request', exact: true })).toBeEnabled(T));
  }),
  'CHAIN REQ-2-1-2 S1 -> duplicate mobile-guild': withPredecessor(hiddenLike.req212s1, async (pr) => {
    const page = await pr.newPage();
    await signIn(pr, page);
    await openAccountMenuLink(pr, page, 'Your organizations');
    await pr.step('[S2] "mobile-guild" listed in Your organizations (identifier text)', () => expect(page.getByText('mobile-guild', { exact: true })).toBeVisible(T));
  }),
  'CHAIN REQ-2-1-2 S1 -> duplicate mobile-guild form': withPredecessor(hiddenLike.req212s1, async (pr) => {
    const page = await pr.newPage();
    await signIn(pr, page);
    await openAccountMenuLink(pr, page, 'Your organizations');
    await pr.step('[S2] click "New organization"', () => page.getByRole('link', { name: 'New organization', exact: true }).click());
    await pr.step('[S2] fill mobile-guild', () => page.getByLabel('Organization name', { exact: true }).fill('mobile-guild'));
    await pr.step('[S2] click "Create organization"', () => page.getByRole('button', { name: 'Create organization', exact: true }).click());
    await pr.step('[S2] "Organization name already exists"', () => expect(page.getByText('Organization name already exists')).toBeVisible(T));
  }),

  // ---- follow-up facets ----
  'FACET REQ-1-1-1 native email validation blocks submit': async (pr) => {
    const page = await pr.newPage();
    await pr.step('goto /', () => page.goto('/'));
    await pr.step('click link "Sign in"', () => page.getByRole('link', { name: 'Sign in', exact: true }).click());
    await pr.step('click link "Create an account"', () => page.getByRole('link', { name: 'Create an account', exact: true }).click());
    await pr.step('fill Email "not-an-email"', () => page.getByLabel('Email', { exact: true }).fill('not-an-email'));
    const info = await page.evaluate(() => { const i = document.querySelector('#reg-email'); return { type: i.type, valid: i.checkValidity(), msg: i.validationMessage, formNoValidate: i.form.noValidate }; });
    pr.log.push('email input: ' + JSON.stringify(info));
    await pr.step('email input is not natively blocking (type!=email or novalidate)', () => { if (info.type === 'email' && !info.valid && !info.formNoValidate) throw new Error('native constraint validation blocks submit: ' + info.msg); });
  },
  'FACET REQ-1-1-1 multi-invalid w/ valid email shape (isolates native block)': async (pr) => {
    const page = await pr.newPage();
    await pr.step('goto /', () => page.goto('/'));
    await pr.step('click link "Sign in"', () => page.getByRole('link', { name: 'Sign in', exact: true }).click());
    await pr.step('click link "Create an account"', () => page.getByRole('link', { name: 'Create an account', exact: true }).click());
    await pr.step('fill Username "-bad-user"', () => page.getByLabel('Username', { exact: true }).fill('-bad-user'));
    await pr.step('fill Email "a@b"', () => page.getByLabel('Email', { exact: true }).fill('a@b'));
    await pr.step('fill Password "short"', () => page.getByLabel('Password', { exact: true }).fill('short'));
    await pr.step('fill Confirm "different"', () => page.getByLabel('Confirm password', { exact: true }).fill('different'));
    await pr.step('click "Create account"', () => page.getByRole('button', { name: 'Create account', exact: true }).click());
    await pr.step('"Username format is invalid"', () => expect(page.getByText('Username format is invalid')).toBeVisible(T));
    await pr.step('"Email format is invalid"', () => expect(page.getByText('Email format is invalid')).toBeVisible(T));
    await pr.step('"Password requirements are not satisfied" (strict)', () => expect(page.getByText('Password requirements are not satisfied')).toBeVisible(T));
  },
  'FACET REQ-1-1-2 S3 d:signed-in org overview heading has identifier': async (pr) => {
    const page = await pr.newPage();
    await signIn(pr, page);
    await pr.step('click org "Acme Demo"', () => page.getByRole('link', { name: 'Acme Demo', exact: true }).click());
    await pr.step('heading contains "acme-demo"', () => expect(page.getByRole('heading', { name: /acme-demo/ })).toBeVisible(T));
  },
  'FACET REQ-2-2-3 S1 ungranted private repo shows "Access denied"': async (pr) => {
    const u = `pw-mem-${uniq()}`;
    const pa = await pr.newPage();
    await register(pr, pa, u, `${u}@example.test`);
    const po = await pr.newPage();
    await signIn(pr, po);
    await pr.step('click org "Acme Demo"', () => po.getByRole('link', { name: 'Acme Demo', exact: true }).click());
    await pr.step('click org repo "secret-research"', () => po.getByRole('link', { name: 'secret-research', exact: true }).click());
    const privUrl = po.url();
    await pr.step('click "People"', async () => { await po.goto('/'); await po.getByRole('link', { name: 'Acme Demo', exact: true }).click(); await po.getByRole('link', { name: 'People', exact: true }).click(); });
    await pr.step('add member', async () => { await po.getByRole('button', { name: 'Add member', exact: true }).click(); await po.getByLabel('Username or email', { exact: true }).fill(u); await po.getByRole('button', { name: 'Add member', exact: true }).click(); await expect(po.getByText(u, { exact: true })).toBeVisible(T); });
    const pm = await pr.newPage();
    await signIn(pr, pm, u, PW);
    await pr.step('direct open ungranted private repo address', () => pm.goto(privUrl));
    await pr.step('"Access denied"', () => expect(pm.getByText('Access denied')).toBeVisible(T));
  },
  'FACET REQ-3-2-1 Owner default asserted by value': async (pr) => {
    const page = await pr.newPage();
    await signIn(pr, page);
    await pr.step('click "New repository"', () => page.getByRole('link', { name: 'New repository', exact: true }).click());
    await pr.step('Owner toHaveValue("alice-dev")', () => expect(page.getByLabel('Owner', { exact: true })).toHaveValue('alice-dev', T));
  },
  'FACET REQ-4-2-2 click changed file -> file diff lines': async (pr) => {
    const page = await pr.newPage();
    await pr.step('goto /', () => page.goto('/'));
    await openRepo(pr, page, 'acme-docs');
    await pr.step('click "Commits"', () => page.getByRole('link', { name: /Commits/ }).click());
    await pr.step('click commit "Document search flow"', () => page.getByRole('link', { name: 'Document search flow', exact: true }).click());
    await pr.step('click changed file "src/search.ts"', () => page.getByRole('link', { name: 'src/search.ts', exact: true }).click());
    await pr.step('file diff shows added lines (+ prefix) / still a diff page', () => expect(page.getByText(/^\+/).first()).toBeVisible(T));
  },
  'FACET REQ-4-4 S2 b3: substring messages, then files/history unchanged': async (pr) => {
    const page = await pr.newPage();
    await signIn(pr, page);
    await openRepo(pr, page, 'acme-docs');
    await pr.step('click "Add file"', () => page.getByRole('button', { name: 'Add file', exact: true }).click());
    await pr.step('click menuitem "Create new file"', () => page.getByRole('menuitem', { name: 'Create new file', exact: true }).click());
    await pr.step('fill "File name" ../invalid.md', () => page.getByLabel('File name', { exact: true }).fill('../invalid.md'));
    await pr.step('fill "File contents"', () => page.getByRole('textbox', { name: 'File contents', exact: true }).fill('must not be saved'));
    await pr.step('click "Commit changes"', () => page.getByRole('button', { name: 'Commit changes', exact: true }).click());
    await pr.step('getByText("Invalid file path") default (substring)', () => expect(page.getByText('Invalid file path')).toBeVisible(T));
    await pr.step('getByText("Commit message is required") default (substring)', () => expect(page.getByText('Commit message is required')).toBeVisible(T));
    await pr.step('reload', () => page.reload());
    await pr.step('no "invalid.md" in files', () => expect(page.getByRole('link', { name: 'invalid.md', exact: true })).toHaveCount(0, T));
    await pr.step('click "Commits"', () => page.getByRole('link', { name: 'Commits', exact: true }).click());
    await pr.step('history unchanged (2 commits)', () => expect(page.getByRole('article')).toHaveCount(2, T));
  },
  'FACET REQ-6-3-2 exact example aggregate "3 additions, 1 deletions"': async (pr) => {
    const page = await pr.newPage();
    await pr.step('goto /', () => page.goto('/'));
    await openRepo(pr, page, 'acme-docs');
    await pr.step('click "Pull requests"', () => page.getByRole('link', { name: 'Pull requests', exact: true }).click());
    await pr.step('click PR "Improve onboarding"', () => page.getByRole('link', { name: 'Improve onboarding', exact: true }).click());
    await pr.step('click "Files changed"', () => page.getByRole('link', { name: 'Files changed', exact: true }).click());
    await pr.step('"3 additions, 1 deletions"', () => expect(page.getByText('3 additions, 1 deletions')).toBeVisible(T));
  },
  'FACET REQ-6-4 without seed precondition: username visibility after select/remove': async (pr) => {
    const page = await pr.newPage();
    await signIn(pr, page);
    await openRepo(pr, page, 'acme-docs');
    await pr.step('click "Pull requests"', () => page.getByRole('link', { name: 'Pull requests', exact: true }).click());
    await pr.step('click PR "Improve onboarding"', () => page.getByRole('link', { name: 'Improve onboarding', exact: true }).click());
    await pr.step('click "Reviewers"', () => page.getByRole('button', { name: 'Reviewers', exact: true }).click());
    await pr.step('type in textbox "Search"', () => page.getByRole('textbox', { name: 'Search', exact: true }).fill('bob-reviewer'));
    await pr.step('click option "bob-reviewer"', () => page.getByRole('option', { name: 'bob-reviewer', exact: true }).click());
    const n1 = await page.getByText('bob-reviewer').count(); const n2 = await page.getByText('bob-reviewer', { exact: true }).count();
    pr.log.push(`after select: getByText(bob-reviewer) count=${n1}, exact count=${n2}`);
    await pr.step('reviewer area (complementary) shows bob-reviewer', () => expect(page.getByRole('complementary').getByText('bob-reviewer', { exact: true })).toBeVisible(T));
    await pr.step('page-level getByText("bob-reviewer") strict visible', () => expect(page.getByText('bob-reviewer')).toBeVisible(T));
  },
  'FACET REQ-6-5 S1 test check success before merge': async (pr) => {
    const page = await pr.newPage();
    await signIn(pr, page);
    await openRepo(pr, page, 'acme-docs');
    await pr.step('click "Pull requests"', () => page.getByRole('link', { name: 'Pull requests', exact: true }).click());
    await pr.step('click PR "Improve onboarding"', () => page.getByRole('link', { name: 'Improve onboarding', exact: true }).click());
    await pr.step('click "Checks"', () => page.getByRole('link', { name: 'Checks', exact: true }).click());
    await pr.step('"test: success" seeded', () => expect(page.getByText('test: success')).toBeVisible(T));
  },
  'FACET REQ-6-5 S1 merger/time/commit id after merge': async (pr) => {
    const page = await pr.newPage();
    await signIn(pr, page);
    await openRepo(pr, page, 'acme-docs');
    await pr.step('click "Pull requests"', () => page.getByRole('link', { name: 'Pull requests', exact: true }).click());
    await pr.step('click PR "Improve onboarding"', () => page.getByRole('link', { name: 'Improve onboarding', exact: true }).click());
    await pr.step('click "Merge pull request"', () => page.getByRole('button', { name: 'Merge pull request', exact: true }).click());
    await pr.step('click "Confirm merge"', () => page.getByRole('button', { name: 'Confirm merge', exact: true }).click());
    await pr.step('status "Merged" inside main (scoped)', () => expect(page.locator('main').getByText('Merged', { exact: true })).toBeVisible(T));
    await pr.step('merger "alice-dev" shown in main', () => expect(page.locator('main').getByText(/merged by alice-dev|alice-dev merged/i)).toBeVisible(T));
  },
};

module.exports = probes;
if (require.main === module) {
  const filters = process.argv.slice(2);
  const keys = Object.keys(probes).filter((k) => !filters.length || filters.some((f) => k.includes(f)));
  H.run(probes, keys, { fresh: true }).then((res) => {
    for (const r of res) console.log(`\n[log ${r.key}]\n  ` + r.log.join('\n  '));
    require('fs').writeFileSync(__dirname + '/chain-results.json', JSON.stringify(res, null, 1));
  });
}
