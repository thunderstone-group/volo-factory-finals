'use strict';
// REQ-3-2-1 duplicate facet using the other seed repo named with owner alice-dev in the scenario seed line.
const H = require('./harness.cjs');
const { expect, T, signIn, openRepo } = H;
const probes = {
  'FACET REQ-3-2-1 S2/S3 duplicate "acme-docs" in default (alice-dev) namespace': async (pr) => {
    const page = await pr.newPage();
    await signIn(pr, page);
    await pr.step('click "New repository"', () => page.getByRole('link', { name: 'New repository', exact: true }).click());
    await pr.step('fill name acme-docs', () => page.getByLabel('Repository name', { exact: true }).fill('acme-docs'));
    await pr.step('click "Create repository"', () => page.getByRole('button', { name: 'Create repository', exact: true }).click());
    await pr.step('stays on form, no repository heading opened', () => expect(page.getByRole('heading', { name: /acme-docs/ })).toHaveCount(0, T));
  },
  'FACET follow-on: signed-in global search for acme-docs after that': async (pr) => {
    const page = await pr.newPage();
    await signIn(pr, page);
    await pr.step('click "New repository"', () => page.getByRole('link', { name: 'New repository', exact: true }).click());
    await pr.step('fill name acme-docs', () => page.getByLabel('Repository name', { exact: true }).fill('acme-docs'));
    await pr.step('click "Create repository"', () => page.getByRole('button', { name: 'Create repository', exact: true }).click());
    const p2 = await pr.newPage();
    await signIn(pr, p2);
    await openRepo(pr, p2, 'acme-docs');
  },
};
H.run(probes, Object.keys(probes), { fresh: true });
