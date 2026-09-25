'use strict';
// REQ-4 strict probes (subject scenarios on app A; B for calibration). Usage: APP=A node probes-req4.cjs [filter...]
const H = require('./harness2.cjs');
const { expect, T, PW, uniq, signIn, openRepo, register, signInOnForm } = H;

const homeLink = async (pr, page) => {
  await pr.step('home: click link "acme-docs" (repository entry, no search)', () => page.getByRole('link', { name: 'acme-docs', exact: true }).click());
  await pr.step('heading contains acme-docs', () => expect(page.getByRole('heading', { name: /acme-docs/, level: 1 })).toBeVisible(T));
};
const signedInEntry = async (pr, page, user = 'alice-dev', pw = PW) => {
  await signIn(pr, page, user, pw);
  await pr.step(`username "${user}" visible before opening the repository entry`, () => expect(page.getByText(user, { exact: true })).toBeVisible(T));
  await homeLink(pr, page);
};
const codePage = async (pr, page) => {
  await pr.step('click link "Code" (repo nav)', () => page.getByRole('link', { name: 'Code', exact: true }).click());
  await pr.step('button "Branch main"', () => expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible(T));
};
const findBranch = (page) => page.getByRole('textbox', { name: 'Find branch', exact: true });

async function absentQuery(pr, page) {
  await pr.step('fill Search "no-such-token"', () => page.getByRole('searchbox', { name: 'Search', exact: true }).fill('no-such-token'));
  await pr.step('press Enter', () => page.getByRole('searchbox', { name: 'Search', exact: true }).press('Enter'));
  await pr.step('exactly one link "Code" (results type)', () => expect(page.getByRole('link', { name: 'Code', exact: true })).toHaveCount(1, T));
  await pr.step('click "Code" results type', () => page.getByRole('link', { name: 'Code', exact: true }).click());
  await pr.step('"No code results"', () => expect(page.getByText('No code results', { exact: true })).toBeVisible(T));
  await pr.step('Search retains exact query', () => expect(page.getByRole('searchbox', { name: 'Search', exact: true })).toHaveValue('no-such-token', T));
  await pr.step('repository scope still shown (heading acme-docs)', () => expect(page.getByRole('heading', { name: /acme-docs/, level: 1 })).toBeVisible(T));
}

const probes = {
  // ---------- REQ-4-2-3 S2 (visitor, absent query, "keeps repository scope and filters unchanged") ----------
  'REQ-4-2-3 S2 via search: absent query + scope': async (pr) => {
    const page = await pr.newPage(); await pr.step('goto /', () => page.goto('/'));
    await openRepo(pr, page); await absentQuery(pr, page);
  },
  'REQ-4-2-3 S2 via search: filters present/unchanged (Path)': async (pr) => {
    const page = await pr.newPage(); await pr.step('goto /', () => page.goto('/'));
    await openRepo(pr, page); await absentQuery(pr, page);
    await pr.step('path filter field present, empty', () => expect(page.getByLabel(/Path/)).toHaveValue('', T));
  },
  'REQ-4-2-3 S2 via search: return to repository and repeat': async (pr) => {
    const page = await pr.newPage(); await pr.step('goto /', () => page.goto('/'));
    await openRepo(pr, page); await absentQuery(pr, page);
    await pr.step('return to the repository: repo navigation link to the overview exists', () => expect(page.getByRole('button', { name: 'Branch main', exact: true }).or(page.getByRole('link', { name: 'Issues', exact: true }))).toHaveCount(1, T));
  },
  'REQ-4-2-3 S2 via homeLink': async (pr) => {
    const page = await pr.newPage(); await pr.step('goto /', () => page.goto('/'));
    await homeLink(pr, page); await absentQuery(pr, page);
  },
  // ---------- REQ-4-2-3 S4 (templated, signed in) ----------
  'REQ-4-2-3 S4 signed-in: known query, complete text, reload keeps file link': async (pr) => {
    const page = await pr.newPage(); await signedInEntry(pr, page);
    await pr.step('fill Search "search flow"', () => page.getByRole('searchbox', { name: 'Search', exact: true }).fill('search flow'));
    await pr.step('press Enter', () => page.getByRole('searchbox', { name: 'Search', exact: true }).press('Enter'));
    await pr.step('click "Code" results type', () => page.getByRole('link', { name: 'Code', exact: true }).click());
    await pr.step('click result "README.md"', () => page.getByRole('link', { name: 'README.md', exact: true }).click());
    await pr.step('"search flow" as complete text value', () => expect(page.getByText('search flow', { exact: true })).toBeVisible(T));
    await pr.step('reload', () => page.reload());
    await pr.step('link named "README.md" after reload', () => expect(page.getByRole('link', { name: 'README.md', exact: true })).toBeVisible(T));
  },
  'REQ-4-2-3 S4 signed-in: known query, link after reload only': async (pr) => {
    const page = await pr.newPage(); await signedInEntry(pr, page);
    await pr.step('fill Search "search flow"', () => page.getByRole('searchbox', { name: 'Search', exact: true }).fill('search flow'));
    await pr.step('press Enter', () => page.getByRole('searchbox', { name: 'Search', exact: true }).press('Enter'));
    await pr.step('click "Code" results type', () => page.getByRole('link', { name: 'Code', exact: true }).click());
    await pr.step('click result "README.md"', () => page.getByRole('link', { name: 'README.md', exact: true }).click());
    await pr.step('reload', () => page.reload());
    await pr.step('link named "README.md" after reload', () => expect(page.getByRole('link', { name: 'README.md', exact: true })).toBeVisible(T));
  },
  'REQ-4-2-3 S4 signed-in: absent query, return via repo entry, repeat': async (pr) => {
    const page = await pr.newPage(); await signedInEntry(pr, page);
    await absentQuery(pr, page);
    await pr.step('return to repository: goto / and reopen entry', () => page.goto('/'));
    await homeLink(pr, page);
    await absentQuery(pr, page);
  },
  // ---------- REQ-4-3-1 S1 (visitor) ----------
  'REQ-4-3-1 S1 via homeLink': async (pr) => {
    const page = await pr.newPage(); await pr.step('goto /', () => page.goto('/'));
    await homeLink(pr, page);
  },
  'REQ-4-3-1 S1 via search: full THEN incl. README content differs': async (pr) => {
    const page = await pr.newPage(); await pr.step('goto /', () => page.goto('/'));
    await openRepo(pr, page); await codePage(pr, page);
    await pr.step('click "Branch main"', () => page.getByRole('button', { name: 'Branch main', exact: true }).click());
    await pr.step('options main and feature-search listed', async () => { await expect(page.getByRole('option', { name: 'main', exact: true })).toBeVisible(T); await expect(page.getByRole('option', { name: 'feature-search', exact: true })).toBeVisible(T); });
    await pr.step('current branch marked (aria-selected on main)', () => expect(page.getByRole('option', { name: 'main', exact: true })).toHaveAttribute('aria-selected', 'true', T));
    await pr.step('type "feature-search" (pressSequentially)', () => findBranch(page).pressSequentially('feature-search'));
    await pr.step('only matching branch options (no "Create branch: feature-search" for an existing branch)', () => expect(page.getByRole('option')).toHaveCount(1, T));
  },
  // ---------- REQ-4-3-2 S1 / S2 (signed in, write) ----------
  'REQ-4-3-2 S1 signed-in: create feature/api-v2 + base shown + commits': async (pr) => {
    const page = await pr.newPage(); await signedInEntry(pr, page); await codePage(pr, page);
    await pr.step('click "Branch main"', () => page.getByRole('button', { name: 'Branch main', exact: true }).click());
    await pr.step('fill "Find branch" feature/api-v2', () => findBranch(page).fill('feature/api-v2'));
    await pr.step('option "Create branch: feature/api-v2"', () => expect(page.getByRole('option', { name: 'Create branch: feature/api-v2', exact: true })).toBeVisible(T));
    await pr.step('base shown in selector (text mentioning main)', () => expect(page.getByText(/from\s+[`'"]?main|base[: ]+main/i)).toBeVisible(T));
  },
  'REQ-4-3-2 S1 signed-in: create then commits of new branch': async (pr) => {
    const page = await pr.newPage(); await signedInEntry(pr, page); await codePage(pr, page);
    await pr.step('click "Branch main"', () => page.getByRole('button', { name: 'Branch main', exact: true }).click());
    await pr.step('fill "Find branch" feature/api-v2', () => findBranch(page).fill('feature/api-v2'));
    await pr.step('click "Create branch: feature/api-v2"', () => page.getByRole('option', { name: 'Create branch: feature/api-v2', exact: true }).click());
    await pr.step('button "Branch feature/api-v2"', () => expect(page.getByRole('button', { name: 'Branch feature/api-v2', exact: true })).toBeVisible(T));
    await pr.step('reload', () => page.reload());
    await pr.step('still "Branch feature/api-v2"', () => expect(page.getByRole('button', { name: 'Branch feature/api-v2', exact: true })).toBeVisible(T));
    await pr.step('click link "Commits" (branch details)', () => page.getByRole('link', { name: 'Commits', exact: true }).click());
    await pr.step('head commit "Document search flow"', () => expect(page.getByText('Document search flow', { exact: true })).toBeVisible(T));
  },
  'REQ-4-3-2 S1 signed-in: duplicate name rejected': async (pr) => {
    const page = await pr.newPage(); await signedInEntry(pr, page); await codePage(pr, page);
    await pr.step('click "Branch main"', () => page.getByRole('button', { name: 'Branch main', exact: true }).click());
    await pr.step('fill "Find branch" feature-search (existing)', () => findBranch(page).fill('feature-search'));
    await pr.step('no "Create branch: feature-search" option', () => expect(page.getByRole('option', { name: 'Create branch: feature-search', exact: true })).toHaveCount(0, T));
  },
  'REQ-4-3-2 S2 signed-in: invalid..branch then pw-branch': async (pr) => {
    const page = await pr.newPage(); await signedInEntry(pr, page); await codePage(pr, page);
    await pr.step('click "Branch main"', () => page.getByRole('button', { name: 'Branch main', exact: true }).click());
    await pr.step('type invalid..branch (pressSequentially)', () => findBranch(page).pressSequentially('invalid..branch'));
    await pr.step('"Invalid branch"', () => expect(page.getByText('Invalid branch', { exact: true })).toBeVisible(T));
    await pr.step('no create option for invalid..branch', () => expect(page.getByRole('option', { name: /Create branch/ })).toHaveCount(0, T));
    await pr.step('press Enter (must not create)', () => findBranch(page).press('Enter'));
    await pr.step('Escape closes selector', () => page.keyboard.press('Escape'));
    await pr.step('Find branch hidden', () => expect(findBranch(page)).toHaveCount(0, T));
    const name = `pw-branch-${uniq()}`;
    await pr.step('reopen "Branch main"', () => page.getByRole('button', { name: 'Branch main', exact: true }).click());
    await pr.step(`fill ${name}`, () => findBranch(page).fill(name));
    await pr.step(`click "Create branch: ${name}"`, () => page.getByRole('option', { name: `Create branch: ${name}`, exact: true }).click());
    await pr.step(`button "Branch ${name}"`, () => expect(page.getByRole('button', { name: `Branch ${name}`, exact: true })).toBeVisible(T));
    await pr.step('reload', () => page.reload());
    await pr.step(`still "Branch ${name}"`, () => expect(page.getByRole('button', { name: `Branch ${name}`, exact: true })).toBeVisible(T));
  },
  // ---------- REQ-4-3-3 S1 / S2 ----------
  'REQ-4-3-3 S1 admin: change to release, reopen entry, main + its commits': async (pr) => {
    const page = await pr.newPage(); await signedInEntry(pr, page); await codePage(pr, page);
    await pr.step('click link "Settings"', () => page.getByRole('link', { name: 'Settings', exact: true }).click());
    await pr.step('click link "Branches"', () => page.getByRole('link', { name: 'Branches', exact: true }).click());
    await pr.step('combobox "Default branch" = main', () => expect(page.getByRole('combobox', { name: 'Default branch', exact: true })).toHaveValue('main', T));
    await pr.step('selectOption release', () => page.getByRole('combobox', { name: 'Default branch', exact: true }).selectOption('release'));
    await pr.step('click "Update"', () => page.getByRole('button', { name: 'Update', exact: true }).click());
    await pr.step('click "Confirm"', () => page.getByRole('button', { name: 'Confirm', exact: true }).click());
    await pr.step('reload settings: still release', async () => { await page.reload(); await expect(page.getByRole('combobox', { name: 'Default branch', exact: true })).toHaveValue('release', T); });
    await pr.step('goto / (newly open)', () => page.goto('/'));
    await homeLink(pr, page);
    await pr.step('"Branch release"', () => expect(page.getByRole('button', { name: 'Branch release', exact: true })).toBeVisible(T));
    await pr.step('open selector', () => page.getByRole('button', { name: 'Branch release', exact: true }).click());
    await pr.step('option "main"', () => expect(page.getByRole('option', { name: 'main', exact: true })).toBeVisible(T));
    await pr.step('click option "main"', () => page.getByRole('option', { name: 'main', exact: true }).click());
    await pr.step('click link "Commits" (main commits remain)', () => page.getByRole('link', { name: 'Commits', exact: true }).click());
  },
  'REQ-4-3-3 S2 non-admin bob-reviewer (seed password)': async (pr) => {
    const page = await pr.newPage(); await signedInEntry(pr, page, 'bob-reviewer', PW);
    await pr.step('click link "Settings"', () => page.getByRole('link', { name: 'Settings', exact: true }).click());
    await pr.step('click link "Branches"', () => page.getByRole('link', { name: 'Branches', exact: true }).click());
    await pr.step('no combobox "Default branch"', () => expect(page.getByRole('combobox', { name: 'Default branch' })).toHaveCount(0, T));
    await pr.step('no "Update" button', () => expect(page.getByRole('button', { name: 'Update', exact: true })).toHaveCount(0, T));
    await pr.step('click "Code"', () => page.getByRole('link', { name: 'Code', exact: true }).click());
    await pr.step('saved default unchanged: "Branch main"', () => expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible(T));
  },
};

// ---------- chains: earlier hidden-like scenario on the same backend, then the subject ----------
const chainParts = {
  // REQ-4-3-2 S1 as written: creates feature/api-v2 (then its own later facet may fail)
  async createApiV2(pr) {
    const page = await pr.newPage(); await signedInEntry(pr, page); await codePage(pr, page);
    await pr.step('[pred] click "Branch main"', () => page.getByRole('button', { name: 'Branch main', exact: true }).click());
    await pr.step('[pred] fill feature/api-v2', () => findBranch(page).fill('feature/api-v2'));
    await pr.step('[pred] click "Create branch: feature/api-v2"', () => page.getByRole('option', { name: 'Create branch: feature/api-v2', exact: true }).click());
    await pr.step('[pred] "Branch feature/api-v2"', () => expect(page.getByRole('button', { name: 'Branch feature/api-v2', exact: true })).toBeVisible(T));
  },
  // REQ-4-3-3 S1 as written up to Confirm (default becomes release)
  async defaultToRelease(pr) {
    const page = await pr.newPage(); await signedInEntry(pr, page); await codePage(pr, page);
    await pr.step('[pred] Settings', () => page.getByRole('link', { name: 'Settings', exact: true }).click());
    await pr.step('[pred] Branches', () => page.getByRole('link', { name: 'Branches', exact: true }).click());
    await pr.step('[pred] select release', () => page.getByRole('combobox', { name: 'Default branch', exact: true }).selectOption('release'));
    await pr.step('[pred] Update', () => page.getByRole('button', { name: 'Update', exact: true }).click());
    await pr.step('[pred] Confirm', () => page.getByRole('button', { name: 'Confirm', exact: true }).click());
  },
  // REQ-3-2-1 duplicate case with acme-docs in alice's namespace via the required "New repository" LINK
  async dupRepoLink(pr) {
    const page = await pr.newPage(); await signIn(pr, page);
    await pr.step('[pred] click link "New repository"', () => page.getByRole('link', { name: 'New repository', exact: true }).click());
  },
  // REQ-3-4 via the required "General" link
  async visibilityGeneral(pr) {
    const page = await pr.newPage(); await signIn(pr, page);
    await pr.step('[pred] search secret-research', async () => { await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('secret-research'); await page.getByRole('searchbox', { name: 'Search', exact: true }).press('Enter'); });
    await pr.step('[pred] open secret-research', () => page.getByRole('link', { name: 'secret-research', exact: true }).click());
    await pr.step('[pred] Settings', () => page.getByRole('link', { name: 'Settings', exact: true }).click());
    await pr.step('[pred] click link "General"', () => page.getByRole('link', { name: 'General', exact: true }).click());
  },
};
function withPred(preds, subject) {
  return async (pr) => {
    for (const p of preds) {
      try { await chainParts[p](pr); } catch (e) {}
      if (pr.fail) { pr.log.push(`(predecessor ${p} stopped at: ${pr.fail.label})`); pr.predFails = (pr.predFails || []).concat(`${p}: ${pr.fail.label}`); pr.fail = null; }
      else pr.log.push(`(predecessor ${p} completed)`);
      await pr.close();
    }
    await subject(pr);
  };
}
probes['CHAIN REQ-4-3-2 S1 -> S2 reuses feature/api-v2'] = withPred(['createApiV2'], async (pr) => {
  const page = await pr.newPage(); await signedInEntry(pr, page); await codePage(pr, page);
  await pr.step('click "Branch main"', () => page.getByRole('button', { name: 'Branch main', exact: true }).click());
  await pr.step('fill feature/api-v2 (already exists)', () => findBranch(page).fill('feature/api-v2'));
  await pr.step('existing-name state: no "Create branch: feature/api-v2" option', () => expect(page.getByRole('option', { name: 'Create branch: feature/api-v2', exact: true })).toHaveCount(0, T));
});
probes['CHAIN REQ-4-3-2 S1 -> S2 retries create of feature/api-v2'] = withPred(['createApiV2'], async (pr) => {
  const page = await pr.newPage(); await signedInEntry(pr, page); await codePage(pr, page);
  await pr.step('click "Branch main"', () => page.getByRole('button', { name: 'Branch main', exact: true }).click());
  await pr.step('fill feature/api-v2', () => findBranch(page).fill('feature/api-v2'));
  await pr.step('click "Create branch: feature/api-v2"', () => page.getByRole('option', { name: 'Create branch: feature/api-v2', exact: true }).click());
  await pr.step('"Branch feature/api-v2"', () => expect(page.getByRole('button', { name: 'Branch feature/api-v2', exact: true })).toBeVisible(T));
});
probes['CHAIN REQ-4-3-3 S1 -> S2 non-admin sees default unchanged'] = withPred(['defaultToRelease'], probes['REQ-4-3-3 S2 non-admin bob-reviewer (seed password)']);
probes['CHAIN REQ-4-3-2 S1 -> REQ-4-3-3 S1'] = withPred(['createApiV2'], probes['REQ-4-3-3 S1 admin: change to release, reopen entry, main + its commits']);
probes['CHAIN REQ-3-2-1 dup + REQ-3-4 -> REQ-4-3-1 S1 via search'] = withPred(['dupRepoLink', 'visibilityGeneral'], async (pr) => {
  const page = await pr.newPage(); await pr.step('goto /', () => page.goto('/')); await openRepo(pr, page); await codePage(pr, page);
});

(async () => {
  const filters = process.argv.slice(2);
  const keys = Object.keys(probes).filter((k) => !filters.length || filters.some((f) => k.includes(f)));
  const res = await H.run(probes, keys);
  require('fs').writeFileSync(__dirname + `/probe-results.req4.${H.APP}.json`, JSON.stringify(res, null, 1));
})();
