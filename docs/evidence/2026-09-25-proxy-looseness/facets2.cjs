'use strict';
// Extra facet probes: a11y exposure of dialog-time messages; REQ-6-4 username text after select/remove.
const H = require('./harness.cjs');
const { expect, T, uniq, signIn, register, openRepo } = H;
const probes = {
  'FACET REQ-2-2-3 S2 unknown-account message exposed as status/alert': async (pr) => {
    const po = await pr.newPage();
    await signIn(pr, po);
    await pr.step('click org "Acme Demo"', () => po.getByRole('link', { name: 'Acme Demo', exact: true }).click());
    await pr.step('click "People"', () => po.getByRole('link', { name: 'People', exact: true }).click());
    await pr.step('click "Add member" (open)', () => po.getByRole('button', { name: 'Add member', exact: true }).click());
    await pr.step('fill unknown-reviewer', () => po.getByLabel('Username or email', { exact: true }).fill('unknown-reviewer'));
    await pr.step('click "Add member" (submit)', () => po.getByRole('button', { name: 'Add member', exact: true }).click());
    await pr.step('getByText("Account not found") visible', () => expect(po.getByText('Account not found')).toBeVisible(T));
    await pr.step('message exposed via role status/alert', () => expect(po.getByRole('status').or(po.getByRole('alert'))).toContainText('Account not found', T));
  },
  'FACET REQ-6-4 strict getByText after select, and after remove': async (pr) => {
    const page = await pr.newPage();
    await signIn(pr, page);
    await openRepo(pr, page, 'acme-docs');
    await pr.step('click "Pull requests"', () => page.getByRole('link', { name: 'Pull requests', exact: true }).click());
    await pr.step('click PR "Improve onboarding"', () => page.getByRole('link', { name: 'Improve onboarding', exact: true }).click());
    await pr.step('click "Reviewers"', () => page.getByRole('button', { name: 'Reviewers', exact: true }).click());
    await pr.step('type in textbox "Search"', () => page.getByRole('textbox', { name: 'Search', exact: true }).fill('bob-reviewer'));
    await pr.step('click option "bob-reviewer"', () => page.getByRole('option', { name: 'bob-reviewer', exact: true }).click());
    const els = await page.getByText('bob-reviewer').evaluateAll((es) => es.map((e) => e.tagName + ':' + e.textContent.trim()));
    pr.log.push('getByText(bob-reviewer) resolves to: ' + JSON.stringify(els));
    await pr.step('click "Remove bob-reviewer"', () => page.getByRole('button', { name: 'Remove bob-reviewer', exact: true }).click());
    await pr.step('reload', () => page.reload());
    const els2 = await page.getByText('bob-reviewer').evaluateAll((es) => es.map((e) => e.tagName + ':' + e.textContent.trim()));
    pr.log.push('after remove+reload getByText(bob-reviewer): ' + JSON.stringify(els2));
    await pr.step('username absent after removal', () => expect(page.getByText('bob-reviewer')).toHaveCount(0, T));
  },
  'FACET REQ-6-5 which elements say "Merged"': async (pr) => {
    const page = await pr.newPage();
    await signIn(pr, page);
    await openRepo(pr, page, 'acme-docs');
    await pr.step('click "Pull requests"', () => page.getByRole('link', { name: 'Pull requests', exact: true }).click());
    await pr.step('click PR', () => page.getByRole('link', { name: 'Improve onboarding', exact: true }).click());
    await pr.step('click "Merge pull request"', () => page.getByRole('button', { name: 'Merge pull request', exact: true }).click());
    await pr.step('click "Confirm merge"', () => page.getByRole('button', { name: 'Confirm merge', exact: true }).click());
    const els = await page.getByText('Merged', { exact: true }).evaluateAll((es) => es.map((e) => e.outerHTML.slice(0, 80)));
    pr.log.push('getByText(Merged, exact) resolves to: ' + JSON.stringify(els));
  },
  'FACET REQ-1-1-1 which elements say "Password requirements are not satisfied"': async (pr) => {
    const page = await pr.newPage();
    await pr.step('goto', () => page.goto('/#/register'));
    await pr.step('fill', async () => { await page.getByLabel('Username', { exact: true }).fill('-bad'); await page.getByLabel('Email', { exact: true }).fill('a@b'); await page.getByLabel('Password', { exact: true }).fill('short'); await page.getByLabel('Confirm password', { exact: true }).fill('different'); await page.getByRole('button', { name: 'Create account', exact: true }).click(); });
    const els = await page.getByText('Password requirements are not satisfied').evaluateAll((es) => es.map((e) => e.outerHTML.slice(0, 90)));
    pr.log.push('resolves to: ' + JSON.stringify(els));
  },
};
if (require.main === module) {
  H.run(probes, Object.keys(probes), { fresh: true }).then((res) => { for (const r of res) console.log(`\n[log ${r.key}]\n  ` + r.log.filter((l) => !l.startsWith('ok')).join('\n  ')); });
}
module.exports = probes;
