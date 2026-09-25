'use strict';
// Calibration probes: which visitor route to acme-docs separates A (hidden fail) from B (hidden pass)
// on REQ-3-3 S1 and REQ-4-3-1 S1. Usage: APP=A node probes-nav.cjs [filter...]
const H = require('./harness2.cjs');
const { expect, T, openRepo } = H;

const nav = {
  search: async (pr, page) => { await openRepo(pr, page, 'acme-docs'); },
  homeLink: async (pr, page) => {
    await pr.step('home: click link "acme-docs" (strict, no search)', () => page.getByRole('link', { name: 'acme-docs', exact: true }).click());
    await pr.step('heading contains acme-docs', () => expect(page.getByRole('heading', { name: /acme-docs/, level: 1 })).toBeVisible(T));
  },
  reposLink: async (pr, page) => {
    await pr.step('click link "Repositories" (strict)', () => page.getByRole('link', { name: 'Repositories', exact: true }).click());
    await pr.step('click link "acme-docs" (strict)', () => page.getByRole('link', { name: 'acme-docs', exact: true }).click());
    await pr.step('heading contains acme-docs', () => expect(page.getByRole('heading', { name: /acme-docs/, level: 1 })).toBeVisible(T));
  },
};

async function req33(pr, page) {
  await pr.step('Public marker exact', () => expect(page.getByText('Public', { exact: true })).toBeVisible(T));
  await pr.step('link "Code" (strict)', () => expect(page.getByRole('link', { name: 'Code', exact: true })).toBeVisible(T));
  await pr.step('button "Code" (clone, strict)', () => expect(page.getByRole('button', { name: 'Code', exact: true })).toBeVisible(T));
  await pr.step('link "Issues"', () => expect(page.getByRole('link', { name: 'Issues', exact: true })).toBeVisible(T));
  await pr.step('link "Pull requests"', () => expect(page.getByRole('link', { name: 'Pull requests', exact: true })).toBeVisible(T));
  await pr.step('default branch "main" as exact text', () => expect(page.getByText('main', { exact: true })).toBeVisible(T));
}
async function req33file(pr, page) {
  await pr.step('click file link "README.md"', () => page.getByRole('link', { name: 'README.md', exact: true }).click());
  await pr.step('file page shows "README.md"', () => expect(page.getByText('README.md', { exact: true })).toBeVisible(T));
  await pr.step('reload', () => page.reload());
  await pr.step('after reload heading contains acme-docs', () => expect(page.getByRole('heading', { name: /acme-docs/, level: 1 })).toBeVisible(T));
}
async function req431(pr, page) {
  await pr.step('click link "Code"', () => page.getByRole('link', { name: 'Code', exact: true }).click());
  await pr.step('button "Branch main"', () => expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible(T));
  await pr.step('click "Branch main"', () => page.getByRole('button', { name: 'Branch main', exact: true }).click());
  await pr.step('fill "Find branch" feature-search', () => page.getByRole('textbox', { name: 'Find branch', exact: true }).fill('feature-search'));
  await pr.step('click option "feature-search"', () => page.getByRole('option', { name: 'feature-search', exact: true }).click());
  await pr.step('button "Branch feature-search"', () => expect(page.getByRole('button', { name: 'Branch feature-search', exact: true })).toBeVisible(T));
  await pr.step('link "main-only.md"', () => expect(page.getByRole('link', { name: 'main-only.md', exact: true })).toBeVisible(T));
  await pr.step('reopen selector', () => page.getByRole('button', { name: 'Branch feature-search', exact: true }).click());
  await pr.step('option main visible', () => expect(page.getByRole('option', { name: 'main', exact: true })).toBeVisible(T));
  await pr.step('option feature-search marked selected', () => expect(page.getByRole('option', { name: 'feature-search', exact: true })).toHaveAttribute('aria-selected', 'true', T));
  await pr.step('click option "main"', () => page.getByRole('option', { name: 'main', exact: true }).click());
  await pr.step('button "Branch main"', () => expect(page.getByRole('button', { name: 'Branch main', exact: true })).toBeVisible(T));
  await pr.step('no "main-only.md"', () => expect(page.getByRole('link', { name: 'main-only.md', exact: true })).toHaveCount(0, T));
}

const probes = {};
for (const [n, go] of Object.entries(nav)) {
  probes[`REQ-3-3 S1 via ${n}`] = async (pr) => { const page = await pr.newPage(); await pr.step('goto /', () => page.goto('/')); await go(pr, page); await req33(pr, page); };
  probes[`REQ-3-3 S1 via ${n} (no exact main)`] = async (pr) => {
    const page = await pr.newPage(); await pr.step('goto /', () => page.goto('/')); await go(pr, page);
    await pr.step('Public marker exact', () => expect(page.getByText('Public', { exact: true })).toBeVisible(T));
    await req33file(pr, page);
  };
  probes[`REQ-4-3-1 S1 via ${n}`] = async (pr) => { const page = await pr.newPage(); await pr.step('goto /', () => page.goto('/')); await go(pr, page); await req431(pr, page); };
}
module.exports = { nav, req33, req33file, req431 };

if (require.main === module) (async () => {
  const filters = process.argv.slice(2);
  const keys = Object.keys(probes).filter((k) => !filters.length || filters.some((f) => k.includes(f)));
  const res = await H.run(probes, keys);
  require('fs').writeFileSync(__dirname + `/probe-results.nav.${H.APP}.json`, JSON.stringify(res, null, 1));
})();
