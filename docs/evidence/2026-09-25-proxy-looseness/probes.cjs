'use strict';
// Strict probes for the 22 proxy-pass / hidden-fail scenarios of submission 5 (b-5450).
// Usage: node probes.cjs [substring-filter ...]   (each probe runs against a freshly restarted backend)
const H = require('./harness.cjs');
const { expect, T, uniq, signIn, register, openRepo, openAccountMenuLink } = H;
const PW = 'Valid-password-123!';

const probes = {
  // ---------------- REQ-1-1-1 (templated S3): description facets ----------------
  'REQ-1-1-1 S3 a:multi-invalid-together': async (pr) => {
    const page = await pr.newPage();
    await pr.step('goto /', () => page.goto('/'));
    await pr.step('click link "Sign in"', () => page.getByRole('link', { name: 'Sign in', exact: true }).click());
    await pr.step('click link "Create an account"', () => page.getByRole('link', { name: 'Create an account', exact: true }).click());
    await pr.step('fill Username "-bad-user"', () => page.getByLabel('Username', { exact: true }).fill('-bad-user'));
    await pr.step('fill Email "not-an-email"', () => page.getByLabel('Email', { exact: true }).fill('not-an-email'));
    await pr.step('fill Password "short"', () => page.getByLabel('Password', { exact: true }).fill('short'));
    await pr.step('fill Confirm "different"', () => page.getByLabel('Confirm password', { exact: true }).fill('different'));
    await pr.step('terms initially unchecked', () => expect(page.getByRole('checkbox', { name: 'Agree to the terms', exact: true })).not.toBeChecked(T));
    await pr.step('click "Create account"', () => page.getByRole('button', { name: 'Create account', exact: true }).click());
    await pr.step('"Username format is invalid" visible', () => expect(page.getByText('Username format is invalid')).toBeVisible(T));
    await pr.step('"Email format is invalid" visible', () => expect(page.getByText('Email format is invalid')).toBeVisible(T));
    await pr.step('"Password requirements are not satisfied" visible (strict)', () => expect(page.getByText('Password requirements are not satisfied')).toBeVisible(T));
    await pr.step('"Agree to terms is required" visible', () => expect(page.getByText('Agree to terms is required')).toBeVisible(T));
    await pr.step('username retained', () => expect(page.getByLabel('Username', { exact: true })).toHaveValue('-bad-user', T));
  },
  'REQ-1-1-1 S3 b:duplicate-username': async (pr) => {
    const page = await pr.newPage();
    const email = `dup-${uniq()}@example.test`;
    await pr.step('goto /', () => page.goto('/'));
    await pr.step('click link "Sign in"', () => page.getByRole('link', { name: 'Sign in', exact: true }).click());
    await pr.step('click link "Create an account"', () => page.getByRole('link', { name: 'Create an account', exact: true }).click());
    await pr.step('fill Username alice-dev', () => page.getByLabel('Username', { exact: true }).fill('alice-dev'));
    await pr.step('fill Email unused', () => page.getByLabel('Email', { exact: true }).fill(email));
    await pr.step('fill Password', () => page.getByLabel('Password', { exact: true }).fill(PW));
    await pr.step('fill Confirm', () => page.getByLabel('Confirm password', { exact: true }).fill(PW));
    await pr.step('check terms', () => page.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check());
    await pr.step('click "Create account"', () => page.getByRole('button', { name: 'Create account', exact: true }).click());
    await pr.step('"Username already exists" visible', () => expect(page.getByText('Username already exists')).toBeVisible(T));
    await pr.step('username retained', () => expect(page.getByLabel('Username', { exact: true })).toHaveValue('alice-dev', T));
    await pr.step('email retained', () => expect(page.getByLabel('Email', { exact: true })).toHaveValue(email, T));
  },
  'REQ-1-1-1 S3 c:success-signin-by-email-reload': async (pr) => {
    const page = await pr.newPage();
    const u = `pw-user-${uniq()}`;
    await register(pr, page, u, `${u}@example.test`);
    await pr.step('fill "Username or email" with email', () => page.getByLabel('Username or email', { exact: true }).fill(`${u}@example.test`));
    await pr.step('fill Password', () => page.getByLabel('Password', { exact: true }).fill(PW));
    await pr.step('click "Sign in"', () => page.getByRole('button', { name: 'Sign in', exact: true }).click());
    await pr.step('username visible (exact text)', () => expect(page.getByText(u, { exact: true })).toBeVisible(T));
    await pr.step('reload', () => page.reload());
    await pr.step('username visible after reload', () => expect(page.getByText(u, { exact: true })).toBeVisible(T));
  },

  // ---------------- REQ-1-1-2 (templated S3) ----------------
  'REQ-1-1-2 S3 a:unknown-account-generic-failure': async (pr) => {
    const page = await pr.newPage();
    await pr.step('goto /', () => page.goto('/'));
    await pr.step('click link "Sign in"', () => page.getByRole('link', { name: 'Sign in', exact: true }).click());
    await pr.step('fill unknown user', () => page.getByLabel('Username or email', { exact: true }).fill('no-such-user-xyz'));
    await pr.step('fill Password', () => page.getByLabel('Password', { exact: true }).fill(PW));
    await pr.step('click "Sign in"', () => page.getByRole('button', { name: 'Sign in', exact: true }).click());
    await pr.step('"Invalid credentials" (exact)', () => expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible(T));
    await pr.step('no Account menu', () => expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0, T));
    await pr.step('reload', () => page.reload());
    await pr.step('still on sign-in form after reload', () => expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible(T));
    await pr.step('still no Account menu after reload', () => expect(page.getByRole('button', { name: 'Account menu', exact: true })).toHaveCount(0, T));
  },
  'REQ-1-1-2 S3 b:wrong-password-then-success-and-protected-reopen': async (pr) => {
    const page = await pr.newPage();
    await pr.step('goto /', () => page.goto('/'));
    await pr.step('click link "Sign in"', () => page.getByRole('link', { name: 'Sign in', exact: true }).click());
    await pr.step('fill alice-dev', () => page.getByLabel('Username or email', { exact: true }).fill('alice-dev'));
    await pr.step('fill wrong Password', () => page.getByLabel('Password', { exact: true }).fill('Wrong-password-999!'));
    await pr.step('click "Sign in"', () => page.getByRole('button', { name: 'Sign in', exact: true }).click());
    await pr.step('"Invalid credentials"', () => expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible(T));
    await pr.step('fill alice email', () => page.getByLabel('Username or email', { exact: true }).fill('alice.dev@example.test'));
    await pr.step('fill Password', () => page.getByLabel('Password', { exact: true }).fill(PW));
    await pr.step('click "Sign in"', () => page.getByRole('button', { name: 'Sign in', exact: true }).click());
    await pr.step('"Invalid credentials" gone', () => expect(page.getByText('Invalid credentials', { exact: true })).toHaveCount(0, T));
    await pr.step('username alice-dev visible (exact)', () => expect(page.getByText('alice-dev', { exact: true })).toBeVisible(T));
    await openAccountMenuLink(pr, page, 'Your organizations');
    await pr.step('protected page heading "Your organizations"', () => expect(page.getByRole('heading', { name: 'Your organizations' })).toBeVisible(T));
    await pr.step('reload protected page', () => page.reload());
    await pr.step('still signed in after reload', () => expect(page.getByText('alice-dev', { exact: true })).toBeVisible(T));
    await pr.step('protected content after reload (link "New organization")', () => expect(page.getByRole('link', { name: 'New organization', exact: true })).toBeVisible(T));
  },
  'REQ-1-1-2 S3 c:signed-in-sees-authorized-private-repo-from-workspace': async (pr) => {
    const page = await pr.newPage();
    await signIn(pr, page);
    await pr.step('workspace lists private repo link "secret-research" (strict)', () => expect(page.getByRole('link', { name: 'secret-research', exact: true })).toBeVisible(T));
  },

  // ---------------- REQ-2-1-1 S1 (visitor, not templated) ----------------
  'REQ-2-1-1 S1 visitor-org-repos-public-filter': async (pr) => {
    const page = await pr.newPage();
    await pr.step('goto /', () => page.goto('/'));
    await pr.step('click org link "Acme Demo"', () => page.getByRole('link', { name: 'Acme Demo', exact: true }).click());
    await pr.step('click link "Repositories"', () => page.getByRole('link', { name: 'Repositories', exact: true }).click());
    await pr.step('fill "Find a repository" = acme-docs', () => page.getByLabel('Find a repository', { exact: true }).fill('acme-docs'));
    await pr.step('select "Public" filter (link/button/radio/option)', async () => {
      const cands = [page.getByRole('radio', { name: 'Public', exact: true }), page.getByRole('button', { name: 'Public', exact: true }), page.getByRole('link', { name: 'Public', exact: true }), page.getByRole('option', { name: 'Public', exact: true })];
      for (const c of cands) if (await c.count()) { await c.click(); return; }
      throw new Error('no Public filter control');
    });
    await pr.step('link "acme-docs" visible after Public filter', () => expect(page.getByRole('link', { name: 'acme-docs', exact: true })).toBeVisible(T));
    await pr.step('no link "secret-research"', () => expect(page.getByRole('link', { name: 'secret-research', exact: true })).toHaveCount(0, T));
    await pr.step('click "acme-docs"', () => page.getByRole('link', { name: 'acme-docs', exact: true }).click());
    await pr.step('heading contains "acme-docs"', () => expect(page.getByRole('heading', { name: /acme-docs/ })).toBeVisible(T));
    await pr.step('browser Back', () => page.goBack());
    await pr.step('public result still visible after Back', () => expect(page.getByRole('link', { name: 'acme-docs', exact: true })).toBeVisible(T));
  },
  'REQ-2-1-1 S1 visitor-org-repos-no-type-filter': async (pr) => {
    const page = await pr.newPage();
    await pr.step('goto /', () => page.goto('/'));
    await pr.step('click org link "Acme Demo"', () => page.getByRole('link', { name: 'Acme Demo', exact: true }).click());
    await pr.step('click link "Repositories"', () => page.getByRole('link', { name: 'Repositories', exact: true }).click());
    await pr.step('fill "Find a repository" = acme-docs', () => page.getByLabel('Find a repository', { exact: true }).fill('acme-docs'));
    await pr.step('link "acme-docs" visible', () => expect(page.getByRole('link', { name: 'acme-docs', exact: true })).toBeVisible(T));
    await pr.step('click "acme-docs"', () => page.getByRole('link', { name: 'acme-docs', exact: true }).click());
    await pr.step('heading contains "acme-docs"', () => expect(page.getByRole('heading', { name: /acme-docs/ })).toBeVisible(T));
    await pr.step('browser Back', () => page.goBack());
    await pr.step('public result still visible after Back', () => expect(page.getByRole('link', { name: 'acme-docs', exact: true })).toBeVisible(T));
    await pr.step('fill filter = secret-research', () => page.getByLabel('Find a repository', { exact: true }).fill('secret-research'));
    await pr.step('no link "secret-research"', () => expect(page.getByRole('link', { name: 'secret-research', exact: true })).toHaveCount(0, T));
  },

  // ---------------- REQ-2-1-2 (templated S2, S3) ----------------
  'REQ-2-1-2 S2/S3 a:duplicate-id-missing-display': async (pr) => {
    const page = await pr.newPage();
    await signIn(pr, page);
    await openAccountMenuLink(pr, page, 'Your organizations');
    await pr.step('click "New organization"', () => page.getByRole('link', { name: 'New organization', exact: true }).click());
    await pr.step('fill "Organization name" = acme-demo', () => page.getByLabel('Organization name', { exact: true }).fill('acme-demo'));
    await pr.step('click "Create organization"', () => page.getByRole('button', { name: 'Create organization', exact: true }).click());
    await pr.step('"Organization name already exists"', () => expect(page.getByText('Organization name already exists')).toBeVisible(T));
    await pr.step('no heading for existing org', () => expect(page.getByRole('heading', { name: /acme-demo|Acme Demo/ })).toHaveCount(0, T));
  },
  'REQ-2-1-2 S2/S3 b:malformed-id-blank-display': async (pr) => {
    const page = await pr.newPage();
    await signIn(pr, page);
    await openAccountMenuLink(pr, page, 'Your organizations');
    await pr.step('click "New organization"', () => page.getByRole('link', { name: 'New organization', exact: true }).click());
    await pr.step('fill id "-invalid-organization"', () => page.getByLabel('Organization name', { exact: true }).fill('-invalid-organization'));
    await pr.step('fill display "   "', () => page.getByLabel('Display name', { exact: true }).fill('   '));
    await pr.step('click "Create organization"', () => page.getByRole('button', { name: 'Create organization', exact: true }).click());
    await pr.step('"Organization name format is invalid"', () => expect(page.getByText('Organization name format is invalid')).toBeVisible(T));
    await pr.step('"Display name is required"', () => expect(page.getByText('Display name is required')).toBeVisible(T));
  },
  'REQ-2-1-2 S2/S3 c:success-heading-has-identifier': async (pr) => {
    const page = await pr.newPage();
    const id = `org-${uniq()}`;
    await signIn(pr, page);
    await openAccountMenuLink(pr, page, 'Your organizations');
    await pr.step('click "New organization"', () => page.getByRole('link', { name: 'New organization', exact: true }).click());
    await pr.step(`fill id ${id}`, () => page.getByLabel('Organization name', { exact: true }).fill(id));
    await pr.step('fill display', () => page.getByLabel('Display name', { exact: true }).fill('Some Display'));
    await pr.step('click "Create organization"', () => page.getByRole('button', { name: 'Create organization', exact: true }).click());
    await pr.step('heading contains the identifier', () => expect(page.getByRole('heading', { name: new RegExp(id) })).toBeVisible(T));
    await pr.step('reload', () => page.reload());
    await pr.step('heading contains identifier after reload', () => expect(page.getByRole('heading', { name: new RegExp(id) })).toBeVisible(T));
  },

  // ---------------- REQ-2-2-3 S1 (not templated) ----------------
  'REQ-2-2-3 S1 add-registered-nonmember': async (pr) => {
    const u = `pw-mem-${uniq()}`;
    const pa = await pr.newPage();
    await register(pr, pa, u, `${u}@example.test`);
    const po = await pr.newPage();
    await signIn(pr, po);
    // record private org repo address as the Owner sees it (for the later direct-access check)
    await openRepo(pr, po, 'acme-docs');
    const privUrl = (await po.url()).replace('acme-docs', 'secret-research');
    await pr.step('goto /', () => po.goto('/'));
    await pr.step('click org "Acme Demo"', () => po.getByRole('link', { name: 'Acme Demo', exact: true }).click());
    await pr.step('click "People"', () => po.getByRole('link', { name: 'People', exact: true }).click());
    await pr.step('click "Add member" (open)', () => po.getByRole('button', { name: 'Add member', exact: true }).click());
    await pr.step('fill "Username or email"', () => po.getByLabel('Username or email', { exact: true }).fill(u));
    await pr.step('Role combobox shows Member by default', () => expect(po.getByRole('combobox', { name: 'Role', exact: true })).toHaveText('Member', T));
    await pr.step('open Role', () => po.getByRole('combobox', { name: 'Role', exact: true }).click());
    await pr.step('options Member and Owner', async () => { await expect(po.getByRole('option', { name: 'Owner', exact: true })).toBeVisible(T); await po.getByRole('option', { name: 'Member', exact: true }).click(); });
    await pr.step('click "Add member" (submit)', () => po.getByRole('button', { name: 'Add member', exact: true }).click());
    await pr.step('People shows full username (exact)', () => expect(po.getByText(u, { exact: true })).toBeVisible(T));
    await pr.step('no Pending', () => expect(po.getByText(/Pending|Awaiting/)).toHaveCount(0, T));
    await pr.step('reload People', () => po.reload());
    await pr.step('row persists after reload', () => expect(po.getByText(u, { exact: true })).toBeVisible(T));
    const pm = await pr.newPage();
    await signIn(pr, pm, u, PW);
    await openAccountMenuLink(pr, pm, 'Your organizations');
    await pr.step('Your organizations shows identifier "acme-demo" as complete text', () => expect(pm.getByText('acme-demo', { exact: true })).toBeVisible(T));
    await pr.step('direct open of ungranted private repo', () => pm.goto(privUrl));
    await pr.step('"Access denied" shown', () => expect(pm.getByText('Access denied')).toBeVisible(T));
  },
  'REQ-2-2-3 S1 variant: org name via display text': async (pr) => {
    const u = `pw-mem-${uniq()}`;
    const pa = await pr.newPage();
    await register(pr, pa, u, `${u}@example.test`);
    const po = await pr.newPage();
    await signIn(pr, po);
    await pr.step('click org "Acme Demo"', () => po.getByRole('link', { name: 'Acme Demo', exact: true }).click());
    await pr.step('click "People"', () => po.getByRole('link', { name: 'People', exact: true }).click());
    await pr.step('click "Add member" (open)', () => po.getByRole('button', { name: 'Add member', exact: true }).click());
    await pr.step('fill "Username or email"', () => po.getByLabel('Username or email', { exact: true }).fill(u));
    await pr.step('click "Add member" (submit)', () => po.getByRole('button', { name: 'Add member', exact: true }).click());
    await pr.step('People shows full username (exact)', () => expect(po.getByText(u, { exact: true })).toBeVisible(T));
    const pm = await pr.newPage();
    await signIn(pr, pm, u, PW);
    await openAccountMenuLink(pr, pm, 'Your organizations');
    await pr.step('Your organizations shows "Acme Demo" link', () => expect(pm.getByRole('link', { name: 'Acme Demo', exact: true })).toBeVisible(T));
  },

  // ---------------- REQ-2-2-3 S2 (templated) ----------------
  'REQ-2-2-3 S2 a:existing-member': async (pr) => {
    const po = await pr.newPage();
    await signIn(pr, po);
    await pr.step('click org "Acme Demo"', () => po.getByRole('link', { name: 'Acme Demo', exact: true }).click());
    await pr.step('click "People"', () => po.getByRole('link', { name: 'People', exact: true }).click());
    await pr.step('click "Add member" (open)', () => po.getByRole('button', { name: 'Add member', exact: true }).click());
    await pr.step('fill bob-reviewer', () => po.getByLabel('Username or email', { exact: true }).fill('bob-reviewer'));
    await pr.step('click "Add member" (submit)', () => po.getByRole('button', { name: 'Add member', exact: true }).click());
    await pr.step('"Account is already a member"', () => expect(po.getByText('Account is already a member')).toBeVisible(T));
    await pr.step('form still open ("Username or email" visible)', () => expect(po.getByLabel('Username or email', { exact: true })).toBeVisible(T));
    await pr.step('bob-reviewer appears once in People', () => expect(po.getByText('bob-reviewer', { exact: true })).toHaveCount(1, T));
  },
  'REQ-2-2-3 S2 b:unknown-then-correct-and-resubmit': async (pr) => {
    const u = `pw-mem-${uniq()}`;
    const pa = await pr.newPage();
    await register(pr, pa, u, `${u}@example.test`);
    const po = await pr.newPage();
    await signIn(pr, po);
    await pr.step('click org "Acme Demo"', () => po.getByRole('link', { name: 'Acme Demo', exact: true }).click());
    await pr.step('click "People"', () => po.getByRole('link', { name: 'People', exact: true }).click());
    await pr.step('click "Add member" (open)', () => po.getByRole('button', { name: 'Add member', exact: true }).click());
    await pr.step('fill unknown-reviewer', () => po.getByLabel('Username or email', { exact: true }).fill('unknown-reviewer'));
    await pr.step('click "Add member" (submit)', () => po.getByRole('button', { name: 'Add member', exact: true }).click());
    await pr.step('"Account not found"', () => expect(po.getByText('Account not found')).toBeVisible(T));
    await pr.step('correct username in same form', () => po.getByLabel('Username or email', { exact: true }).fill(u));
    await pr.step('resubmit "Add member"', () => po.getByRole('button', { name: 'Add member', exact: true }).click());
    await pr.step('new member listed', () => expect(po.getByText(u, { exact: true })).toBeVisible(T));
    await pr.step('role "Member" shown in row', () => expect(po.getByRole('article').filter({ hasText: u }).getByText('Member', { exact: true })).toBeVisible(T));
  },

  // ---------------- REQ-2-2-4 S1 ----------------
  'REQ-2-2-4 S1 a:remove-seed-member-bob': async (pr) => {
    const po = await pr.newPage();
    await signIn(pr, po);
    await pr.step('click org "Acme Demo"', () => po.getByRole('link', { name: 'Acme Demo', exact: true }).click());
    await pr.step('click "People"', () => po.getByRole('link', { name: 'People', exact: true }).click());
    await pr.step('click "Member menu bob-reviewer"', () => po.getByRole('button', { name: 'Member menu bob-reviewer', exact: true }).click());
    await pr.step('click menuitem "Remove from organization"', () => po.getByRole('menuitem', { name: 'Remove from organization', exact: true }).click());
    await pr.step('click "Remove"', () => po.getByRole('button', { name: 'Remove', exact: true }).click());
    await pr.step('bob-reviewer absent', () => expect(po.getByText('bob-reviewer', { exact: true })).toHaveCount(0, T));
    await pr.step('reload', () => po.reload());
    await pr.step('bob-reviewer absent after reload', () => expect(po.getByText('bob-reviewer', { exact: true })).toHaveCount(0, T));
    const pb = await pr.newPage();
    await signIn(pr, pb, 'bob-reviewer', PW);
  },
  'REQ-2-2-4 S1 b:remove-registered-member-with-personal-repo': async (pr) => {
    const u = `pw-rem-${uniq()}`; const repo = `pw-personal-${uniq()}`;
    const pm = await pr.newPage();
    await register(pr, pm, u, `${u}@example.test`);
    await signIn(pr, pm, u, PW);
    await pr.step('click "New repository"', () => pm.getByRole('link', { name: 'New repository', exact: true }).click());
    await pr.step('fill Repository name', () => pm.getByLabel('Repository name', { exact: true }).fill(repo));
    await pr.step('click "Create repository"', () => pm.getByRole('button', { name: 'Create repository', exact: true }).click());
    const po = await pr.newPage();
    await signIn(pr, po);
    await pr.step('click org "Acme Demo"', () => po.getByRole('link', { name: 'Acme Demo', exact: true }).click());
    await pr.step('click "People"', () => po.getByRole('link', { name: 'People', exact: true }).click());
    await pr.step('click "Add member" (open)', () => po.getByRole('button', { name: 'Add member', exact: true }).click());
    await pr.step('fill user', () => po.getByLabel('Username or email', { exact: true }).fill(u));
    await pr.step('click "Add member" (submit)', () => po.getByRole('button', { name: 'Add member', exact: true }).click());
    await pr.step(`click "Member menu ${u}"`, () => po.getByRole('button', { name: `Member menu ${u}`, exact: true }).click());
    await pr.step('click menuitem "Remove from organization"', () => po.getByRole('menuitem', { name: 'Remove from organization', exact: true }).click());
    await pr.step('click "Remove"', () => po.getByRole('button', { name: 'Remove', exact: true }).click());
    await pr.step('member absent', () => expect(po.getByText(u, { exact: true })).toHaveCount(0, T));
    await pr.step('reload', () => po.reload());
    await pr.step('member absent after reload', () => expect(po.getByText(u, { exact: true })).toHaveCount(0, T));
    await pr.step('member reload own page', () => pm.goto('/'));
    await openRepo(pr, pm, repo);
  },

  // ---------------- REQ-3-2-1 S1 (main) and templated S2/S3 facets ----------------
  'REQ-3-2-1 S1 private-readme-with-owner-select(click)': async (pr) => {
    const page = await pr.newPage(); const name = `pw-repo-${uniq()}`;
    await signIn(pr, page);
    await pr.step('click "New repository"', () => page.getByRole('link', { name: 'New repository', exact: true }).click());
    await pr.step('Owner defaults to alice-dev', () => expect(page.getByLabel('Owner', { exact: true })).toHaveText('alice-dev', T));
    await pr.step('open Owner and pick alice-dev', async () => { await page.getByLabel('Owner', { exact: true }).click(); await page.getByRole('option', { name: 'alice-dev', exact: true }).click(); });
    await pr.step('fill Repository name', () => page.getByLabel('Repository name', { exact: true }).fill(name));
    await pr.step('fill Description', () => page.getByLabel('Description', { exact: true }).fill('Repository created by Playwright'));
    await pr.step('check radio Private', () => page.getByRole('radio', { name: 'Private', exact: true }).check());
    await pr.step('check "Add a README file"', () => page.getByRole('checkbox', { name: 'Add a README file', exact: true }).check());
    await pr.step('click "Create repository"', () => page.getByRole('button', { name: 'Create repository', exact: true }).click());
    await pr.step('heading contains new name', () => expect(page.getByRole('heading', { name: new RegExp(name) })).toBeVisible(T));
    await pr.step('Private marker', () => expect(page.getByText('Private', { exact: true })).toBeVisible(T));
    await pr.step('README.md link', () => expect(page.getByRole('link', { name: 'README.md', exact: true })).toBeVisible(T));
    await pr.step('description saved', () => expect(page.getByText('Repository created by Playwright', { exact: true })).toBeVisible(T));
    await pr.step('reload', () => page.reload());
    await pr.step('heading after reload', () => expect(page.getByRole('heading', { name: new RegExp(name) })).toBeVisible(T));
    await pr.step('click "Commits"', () => page.getByRole('link', { name: 'Commits', exact: true }).click());
    await pr.step('exactly one commit listed', () => expect(page.getByRole('article')).toHaveCount(1, T));
  },
  'REQ-3-2-1 S1 variant owner-selectOption': async (pr) => {
    const page = await pr.newPage();
    await signIn(pr, page);
    await pr.step('click "New repository"', () => page.getByRole('link', { name: 'New repository', exact: true }).click());
    await pr.step('selectOption Owner=alice-dev (native select contract)', () => page.getByLabel('Owner', { exact: true }).selectOption('alice-dev'));
  },
  'REQ-3-2-1 S2/S3 a:duplicate-in-default-namespace': async (pr) => {
    const page = await pr.newPage();
    await signIn(pr, page);
    await pr.step('click "New repository"', () => page.getByRole('link', { name: 'New repository', exact: true }).click());
    await pr.step('fill name secret-research (existing in alice-dev)', () => page.getByLabel('Repository name', { exact: true }).fill('secret-research'));
    await pr.step('click "Create repository"', () => page.getByRole('button', { name: 'Create repository', exact: true }).click());
    await pr.step('stays on form', () => expect(page.getByRole('button', { name: 'Create repository', exact: true })).toBeVisible(T));
    await pr.step('no heading alice-dev/secret-research', () => expect(page.getByRole('heading', { name: /secret-research/ })).toHaveCount(0, T));
    await pr.step('an error message mentions the name', () => expect(page.getByText(/already exists/i)).toBeVisible(T));
  },
  'REQ-3-2-1 S2/S3 b:empty-name': async (pr) => {
    const page = await pr.newPage();
    await signIn(pr, page);
    await pr.step('click "New repository"', () => page.getByRole('link', { name: 'New repository', exact: true }).click());
    await pr.step('click "Create repository" with defaults', () => page.getByRole('button', { name: 'Create repository', exact: true }).click());
    await pr.step('stays on form', () => expect(page.getByRole('button', { name: 'Create repository', exact: true })).toBeVisible(T));
    await pr.step('a required/invalid message shown', () => expect(page.getByText(/required|invalid/i)).toBeVisible(T));
  },
  'REQ-3-2-1 S1 THEN: repo appears in owner repository list': async (pr) => {
    const page = await pr.newPage(); const name = `pw-repo-${uniq()}`;
    await signIn(pr, page);
    await pr.step('click "New repository"', () => page.getByRole('link', { name: 'New repository', exact: true }).click());
    await pr.step('fill Repository name', () => page.getByLabel('Repository name', { exact: true }).fill(name));
    await pr.step('check "Add a README file"', () => page.getByRole('checkbox', { name: 'Add a README file', exact: true }).check());
    await pr.step('click "Create repository"', () => page.getByRole('button', { name: 'Create repository', exact: true }).click());
    await pr.step('back to workspace', () => page.goto('/'));
    await pr.step('new repo link in workspace repository list', () => expect(page.getByRole('link', { name, exact: true })).toBeVisible(T));
    await pr.step('owner link "alice-dev" (owner repository list entry)', () => expect(page.getByRole('link', { name: 'alice-dev', exact: true })).toBeVisible(T));
  },

  // ---------------- REQ-4-2-1 S1 ----------------
  'REQ-4-2-1 S1 visitor-history-values': async (pr) => {
    const page = await pr.newPage();
    await pr.step('goto /', () => page.goto('/'));
    await openRepo(pr, page, 'acme-docs');
    await pr.step('click "Commits" (strict)', () => page.getByRole('link', { name: /Commits/ }).click());
    await pr.step('message "Document search flow" exact', () => expect(page.getByText('Document search flow', { exact: true })).toBeVisible(T));
    await pr.step('author "alice-dev" as distinct exact text', () => expect(page.getByText('alice-dev', { exact: true })).toBeVisible(T));
    await pr.step('relative time containing "ago"', () => expect(page.getByText(/ago/).first()).toBeVisible(T));
  },
  'REQ-4-2-1 S1 THEN: short hash + file scope + parent': async (pr) => {
    const page = await pr.newPage();
    await pr.step('goto /', () => page.goto('/'));
    await openRepo(pr, page, 'acme-docs');
    await pr.step('click "Commits"', () => page.getByRole('link', { name: /Commits/ }).click());
    await pr.step('a short hash (7+ hex) is visible', () => expect(page.getByText(/\b[0-9a-f]{7,40}\b/).first()).toBeVisible(T));
  },

  // ---------------- REQ-4-2-2 S1 ----------------
  'REQ-4-2-2 S1 visitor-commit-diff': async (pr) => {
    const page = await pr.newPage();
    await pr.step('goto /', () => page.goto('/'));
    await openRepo(pr, page, 'acme-docs');
    await pr.step('click "Commits"', () => page.getByRole('link', { name: /Commits/ }).click());
    await pr.step('click commit entry "Document search flow"', () => page.getByRole('link', { name: 'Document search flow', exact: true }).click());
    await pr.step('changed path "src/search.ts" exact', () => expect(page.getByText('src/search.ts', { exact: true })).toBeVisible(T));
    await pr.step('"Changed files" summary', () => expect(page.getByText(/Changed files/)).toBeVisible(T));
    await pr.step('numeric "N additions, M deletions"', () => expect(page.getByText(/^\d+ additions?, \d+ deletions?$/)).toBeVisible(T));
    await pr.step('parent/base identifier visible', () => expect(page.getByText(/parent|base/i)).toBeVisible(T));
  },

  // ---------------- REQ-4-2-3 (templated S3/S4) ----------------
  'REQ-4-2-3 S3/S4 a:known-query-code-link-result': async (pr) => {
    const page = await pr.newPage();
    await pr.step('goto /', () => page.goto('/'));
    await openRepo(pr, page, 'acme-docs');
    await pr.step('fill Search "search flow"', () => page.getByRole('searchbox', { name: 'Search', exact: true }).fill('search flow'));
    await pr.step('Enter', () => page.getByRole('searchbox', { name: 'Search', exact: true }).press('Enter'));
    await pr.step('exactly one link "Code" on results page', () => expect(page.getByRole('link', { name: 'Code', exact: true })).toHaveCount(1, T));
    await pr.step('click "Code" (results type)', () => page.getByRole('link', { name: 'Code', exact: true }).click());
    await pr.step('still on results page (Search keeps query)', () => expect(page.getByRole('searchbox', { name: 'Search', exact: true })).toHaveValue('search flow', T));
    await pr.step('result link "README.md" (strict)', () => expect(page.getByRole('link', { name: 'README.md', exact: true })).toBeVisible(T));
    await pr.step('click README.md result', () => page.getByRole('link', { name: 'README.md', exact: true }).click());
    await pr.step('"search flow" visible as complete text value', () => expect(page.getByText('search flow', { exact: true })).toBeVisible(T));
  },
  'REQ-4-2-3 S3/S4 a2:known-query-without-Code-click': async (pr) => {
    const page = await pr.newPage();
    await pr.step('goto /', () => page.goto('/'));
    await openRepo(pr, page, 'acme-docs');
    await pr.step('fill Search "search flow"', () => page.getByRole('searchbox', { name: 'Search', exact: true }).fill('search flow'));
    await pr.step('Enter', () => page.getByRole('searchbox', { name: 'Search', exact: true }).press('Enter'));
    await pr.step('result link "README.md" (strict)', () => expect(page.getByRole('link', { name: 'README.md', exact: true })).toBeVisible(T));
    await pr.step('click README.md result', () => page.getByRole('link', { name: 'README.md', exact: true }).click());
    await pr.step('"search flow" visible as complete text value', () => expect(page.getByText('search flow', { exact: true })).toBeVisible(T));
  },
  'REQ-4-2-3 S3/S4 b:absent-query-empty-state-repeat': async (pr) => {
    const page = await pr.newPage();
    await pr.step('goto /', () => page.goto('/'));
    await openRepo(pr, page, 'acme-docs');
    await pr.step('fill Search "no-such-token"', () => page.getByRole('searchbox', { name: 'Search', exact: true }).fill('no-such-token'));
    await pr.step('Enter', () => page.getByRole('searchbox', { name: 'Search', exact: true }).press('Enter'));
    await pr.step('click "Code" (results type)', () => page.getByRole('link', { name: 'Code', exact: true }).click());
    await pr.step('"No code results"', () => expect(page.getByText('No code results', { exact: true })).toBeVisible(T));
    await pr.step('Search retains exact query', () => expect(page.getByRole('searchbox', { name: 'Search', exact: true })).toHaveValue('no-such-token', T));
  },

  // ---------------- REQ-4-3-3 S2 (non-admin) ----------------
  'REQ-4-3-3 S2 a:non-admin=bob-reviewer': async (pr) => {
    const page = await pr.newPage();
    await signIn(pr, page, 'bob-reviewer', PW);
  },
  'REQ-4-3-3 S2 b:non-admin=fresh-registered-user': async (pr) => {
    const page = await pr.newPage(); const u = `pw-na-${uniq()}`;
    await register(pr, page, u, `${u}@example.test`);
    await signIn(pr, page, u, PW);
    await openRepo(pr, page, 'acme-docs');
    await pr.step('click "Settings"', () => page.getByRole('link', { name: 'Settings', exact: true }).click());
    await pr.step('click "Branches"', () => page.getByRole('link', { name: 'Branches', exact: true }).click());
    await pr.step('no "Default branch" combobox', () => expect(page.getByRole('combobox', { name: 'Default branch' })).toHaveCount(0, T));
    await pr.step('no "Update" button', () => expect(page.getByRole('button', { name: 'Update', exact: true })).toHaveCount(0, T));
    await pr.step('click "Code"', () => page.getByRole('link', { name: 'Code', exact: true }).click());
    await pr.step('"Branch main" unchanged', () => expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible(T));
  },

  // ---------------- REQ-4-4 S2 (templated) ----------------
  'REQ-4-4 S2 a:create-unique-file': async (pr) => {
    const page = await pr.newPage(); const f = `pw-file-${uniq()}.md`; const content = `hello ${uniq()}`;
    await signIn(pr, page);
    await openRepo(pr, page, 'acme-docs');
    await pr.step('click "Add file"', () => page.getByRole('button', { name: 'Add file', exact: true }).click());
    await pr.step('click menuitem "Create new file"', () => page.getByRole('menuitem', { name: 'Create new file', exact: true }).click());
    await pr.step('fill "File name"', () => page.getByLabel('File name', { exact: true }).fill(f));
    await pr.step('fill textbox "File contents"', () => page.getByRole('textbox', { name: 'File contents', exact: true }).fill(content));
    await pr.step('"Commit message" initially empty', () => expect(page.getByLabel('Commit message', { exact: true })).toHaveValue('', T));
    await pr.step('fill "Commit message"', () => page.getByLabel('Commit message', { exact: true }).fill(`Add ${f}`));
    await pr.step('click "Commit changes"', () => page.getByRole('button', { name: 'Commit changes', exact: true }).click());
    await pr.step('exact saved content visible', () => expect(page.getByText(content, { exact: true })).toBeVisible(T));
    await pr.step('click "Commits"', () => page.getByRole('link', { name: 'Commits', exact: true }).click());
    await pr.step('history shows exact message', () => expect(page.getByText(`Add ${f}`, { exact: true })).toBeVisible(T));
  },
  'REQ-4-4 S2 b:invalid-path-no-message': async (pr) => {
    const page = await pr.newPage();
    await signIn(pr, page);
    await openRepo(pr, page, 'acme-docs');
    await pr.step('click "Add file"', () => page.getByRole('button', { name: 'Add file', exact: true }).click());
    await pr.step('click menuitem "Create new file"', () => page.getByRole('menuitem', { name: 'Create new file', exact: true }).click());
    await pr.step('fill "File name" ../invalid.md', () => page.getByLabel('File name', { exact: true }).fill('../invalid.md'));
    await pr.step('fill "File contents"', () => page.getByRole('textbox', { name: 'File contents', exact: true }).fill('must not be saved'));
    await pr.step('click "Commit changes"', () => page.getByRole('button', { name: 'Commit changes', exact: true }).click());
    await pr.step('"Invalid file path" as exact text', () => expect(page.getByText('Invalid file path', { exact: true })).toBeVisible(T));
    await pr.step('"Commit message is required" as exact text', () => expect(page.getByText('Commit message is required', { exact: true })).toBeVisible(T));
  },
  'REQ-4-4 S2 b2:invalid-path-substring-and-role': async (pr) => {
    const page = await pr.newPage();
    await signIn(pr, page);
    await openRepo(pr, page, 'acme-docs');
    await pr.step('click "Add file"', () => page.getByRole('button', { name: 'Add file', exact: true }).click());
    await pr.step('click menuitem "Create new file"', () => page.getByRole('menuitem', { name: 'Create new file', exact: true }).click());
    await pr.step('fill "File name" ../invalid.md', () => page.getByLabel('File name', { exact: true }).fill('../invalid.md'));
    await pr.step('fill "File contents"', () => page.getByRole('textbox', { name: 'File contents', exact: true }).fill('must not be saved'));
    await pr.step('click "Commit changes"', () => page.getByRole('button', { name: 'Commit changes', exact: true }).click());
    await pr.step('"Invalid file path" substring', () => expect(page.getByText(/Invalid file path/)).toBeVisible(T));
    await pr.step('message exposed to a11y (role status/alert contains it)', () => expect(page.getByRole('status').or(page.getByRole('alert'))).toContainText('Invalid file path', T));
  },

  // ---------------- REQ-5-4 S2 (read-only viewer) ----------------
  'REQ-5-4 S2 a:viewer=bob-reviewer': async (pr) => {
    const page = await pr.newPage();
    await signIn(pr, page, 'bob-reviewer', PW);
  },
  'REQ-5-4 S2 a2:bob(Write)-sees-close-button (bob pw from app seed)': async (pr) => {
    const page = await pr.newPage();
    await signIn(pr, page, 'bob-reviewer', 'Bob-password-123!');
    await openRepo(pr, page, 'acme-docs');
    await pr.step('click "Issues"', () => page.getByRole('link', { name: 'Issues', exact: true }).click());
    await pr.step('click issue "Improve onboarding"', () => page.getByRole('link', { name: 'Improve onboarding', exact: true }).click());
    await pr.step('no "Close issue" for Write user', () => expect(page.getByRole('button', { name: 'Close issue', exact: true })).toHaveCount(0, T));
  },
  'REQ-5-4 S2 b:viewer=fresh-registered (Read on public repo)': async (pr) => {
    const page = await pr.newPage(); const u = `pw-ro-${uniq()}`;
    await register(pr, page, u, `${u}@example.test`);
    await signIn(pr, page, u, PW);
    await openRepo(pr, page, 'acme-docs');
    await pr.step('click "Issues"', () => page.getByRole('link', { name: 'Issues', exact: true }).click());
    await pr.step('click issue "Improve onboarding"', () => page.getByRole('link', { name: 'Improve onboarding', exact: true }).click());
    await pr.step('status "Open" visible', () => expect(page.getByText('Open', { exact: true })).toBeVisible(T));
    await pr.step('no Close issue', () => expect(page.getByRole('button', { name: 'Close issue', exact: true })).toHaveCount(0, T));
    await pr.step('no Reopen issue', () => expect(page.getByRole('button', { name: 'Reopen issue', exact: true })).toHaveCount(0, T));
    await pr.step('reload', () => page.reload());
    await pr.step('still Open', () => expect(page.getByText('Open', { exact: true })).toBeVisible(T));
  },

  // ---------------- REQ-6-3-1 S3 (templated) ----------------
  'REQ-6-3-1 S3 visitor-PR-tabs-summaries': async (pr) => {
    const page = await pr.newPage();
    await pr.step('goto /', () => page.goto('/'));
    await openRepo(pr, page, 'acme-docs');
    await pr.step('click "Pull requests"', () => page.getByRole('link', { name: 'Pull requests', exact: true }).click());
    await pr.step('click PR "Improve onboarding"', () => page.getByRole('link', { name: 'Improve onboarding', exact: true }).click());
    await pr.step('heading exact title', () => expect(page.getByRole('heading', { name: 'Improve onboarding', exact: true })).toBeVisible(T));
    await pr.step('click "Commits"', () => page.getByRole('link', { name: 'Commits', exact: true }).click());
    await pr.step('"Commit summary" visible', () => expect(page.getByText(/Commit summary/)).toBeVisible(T));
    await pr.step('click "Files changed"', () => page.getByRole('link', { name: 'Files changed', exact: true }).click());
    await pr.step('"Changed files" summary', () => expect(page.getByText(/Changed files/)).toBeVisible(T));
  },
  'REQ-6-3-1 S3 variant open-PR="Fix search"': async (pr) => {
    const page = await pr.newPage();
    await pr.step('goto /', () => page.goto('/'));
    await openRepo(pr, page, 'acme-docs');
    await pr.step('click "Pull requests"', () => page.getByRole('link', { name: 'Pull requests', exact: true }).click());
    await pr.step('click PR "Fix search" in default list', () => page.getByRole('link', { name: 'Fix search', exact: true }).click());
  },

  // ---------------- REQ-6-3-2 S1 ----------------
  'REQ-6-3-2 S1 visitor-files-changed': async (pr) => {
    const page = await pr.newPage();
    await pr.step('goto /', () => page.goto('/'));
    await openRepo(pr, page, 'acme-docs');
    await pr.step('click "Pull requests"', () => page.getByRole('link', { name: 'Pull requests', exact: true }).click());
    await pr.step('click PR "Improve onboarding"', () => page.getByRole('link', { name: 'Improve onboarding', exact: true }).click());
    await pr.step('click "Files changed"', () => page.getByRole('link', { name: 'Files changed', exact: true }).click());
    await pr.step('path "src/search.ts" verbatim', () => expect(page.getByText('src/search.ts', { exact: true })).toBeVisible(T));
    await pr.step('aggregate "<n> additions, <m> deletions"', () => expect(page.getByText(/^\d+ additions, \d+ deletions$/)).toBeVisible(T));
    await pr.step('one added + one modified file (2 file rows)', () => expect(page.getByRole('article')).toHaveCount(2, T));
    await pr.step('diff block shows +/- lines', () => expect(page.getByText(/^[+-] /).first()).toBeVisible(T));
  },

  // ---------------- REQ-6-4 S1 ----------------
  'REQ-6-4 S1 request-then-remove-bob': async (pr) => {
    const page = await pr.newPage();
    await signIn(pr, page);
    await openRepo(pr, page, 'acme-docs');
    await pr.step('click "Pull requests"', () => page.getByRole('link', { name: 'Pull requests', exact: true }).click());
    await pr.step('click PR "Improve onboarding"', () => page.getByRole('link', { name: 'Improve onboarding', exact: true }).click());
    await pr.step('precondition: no bob-reviewer on the PR page yet', () => expect(page.getByText('bob-reviewer', { exact: true })).toHaveCount(0, T));
    await pr.step('click "Reviewers"', () => page.getByRole('button', { name: 'Reviewers', exact: true }).click());
    await pr.step('type in textbox "Search"', () => page.getByRole('textbox', { name: 'Search', exact: true }).fill('bob-reviewer'));
    await pr.step('click option "bob-reviewer"', () => page.getByRole('option', { name: 'bob-reviewer', exact: true }).click());
    await pr.step('picker closed', () => expect(page.getByRole('textbox', { name: 'Search', exact: true })).toHaveCount(0, T));
    await pr.step('"Remove bob-reviewer" button', () => expect(page.getByRole('button', { name: 'Remove bob-reviewer', exact: true })).toBeVisible(T));
    await pr.step('reload', () => page.reload());
    await pr.step('request persists', () => expect(page.getByRole('button', { name: 'Remove bob-reviewer', exact: true })).toBeVisible(T));
    await pr.step('click "Remove bob-reviewer"', () => page.getByRole('button', { name: 'Remove bob-reviewer', exact: true }).click());
    await pr.step('username gone from reviewer area/page', () => expect(page.getByText('bob-reviewer', { exact: true })).toHaveCount(0, T));
  },

  // ---------------- REQ-6-5 S1 ----------------
  'REQ-6-5 S1 merge-eligible (fresh seed)': async (pr) => {
    const page = await pr.newPage();
    await signIn(pr, page);
    await openRepo(pr, page, 'acme-docs');
    await pr.step('click "Pull requests"', () => page.getByRole('link', { name: 'Pull requests', exact: true }).click());
    await pr.step('click PR "Improve onboarding"', () => page.getByRole('link', { name: 'Improve onboarding', exact: true }).click());
    await pr.step('"Create a merge commit" is the only method, visible before merging', () => expect(page.getByText('Create a merge commit')).toBeVisible(T));
  },
  'REQ-6-5 S1 merge-eligible (click-through, exact Merged)': async (pr) => {
    const page = await pr.newPage();
    await signIn(pr, page);
    await openRepo(pr, page, 'acme-docs');
    await pr.step('click "Pull requests"', () => page.getByRole('link', { name: 'Pull requests', exact: true }).click());
    await pr.step('click PR "Improve onboarding"', () => page.getByRole('link', { name: 'Improve onboarding', exact: true }).click());
    await pr.step('"Merge pull request" enabled', () => expect(page.getByRole('button', { name: 'Merge pull request', exact: true })).toBeEnabled(T));
    await pr.step('click "Merge pull request"', () => page.getByRole('button', { name: 'Merge pull request', exact: true }).click());
    await pr.step('"Create a merge commit" shown', () => expect(page.getByText('Create a merge commit', { exact: true })).toBeVisible(T));
    await pr.step('click "Confirm merge"', () => page.getByRole('button', { name: 'Confirm merge', exact: true }).click());
    await pr.step('"Merged" (strict, exact)', () => expect(page.getByText('Merged', { exact: true })).toBeVisible(T));
    await pr.step('reload', () => page.reload());
    await pr.step('"Merged" after reload', () => expect(page.getByText('Merged', { exact: true })).toBeVisible(T));
  },
};

module.exports = probes;

if (require.main === module) {
  const filters = process.argv.slice(2);
  const keys = Object.keys(probes).filter((k) => !filters.length || filters.some((f) => k.includes(f)));
  H.run(probes, keys, { fresh: true }).then((res) => {
    require('fs').writeFileSync(__dirname + '/probe-results.' + (filters.join('_').replace(/[^A-Za-z0-9_-]/g, '') || 'all') + '.json', JSON.stringify(res, null, 1));
  });
}
