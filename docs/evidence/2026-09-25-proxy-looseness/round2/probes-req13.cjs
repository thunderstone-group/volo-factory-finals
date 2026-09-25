'use strict';
// REQ-1-3 strict probes on a fresh backend. Usage: APP=A node probes-req13.cjs [filter...]
const H = require('./harness2.cjs');
const { expect, T, PW, uniq, signIn, signInOnForm, register, signOut } = H;

async function openPasswordPage(pr, page) {
  await pr.step('click "Account menu"', () => page.getByRole('button', { name: 'Account menu', exact: true }).click());
  await pr.step('click link "Settings"', () => page.getByRole('link', { name: 'Settings', exact: true }).click());
  await pr.step('click link "Password and authentication"', () => page.getByRole('link', { name: 'Password and authentication', exact: true }).click());
  await pr.step('heading "Password and authentication"', () => expect(page.getByRole('heading', { name: 'Password and authentication', exact: true })).toBeVisible(T));
}
async function submitChange(pr, page, cur, nw, conf) {
  if (cur !== null) await pr.step(`fill "Current password" ${cur}`, () => page.getByLabel('Current password', { exact: true }).fill(cur));
  if (nw !== null) await pr.step(`fill "New password" ${nw}`, () => page.getByLabel('New password', { exact: true }).fill(nw));
  if (conf !== null) await pr.step(`fill "Confirm password" ${conf}`, () => page.getByLabel('Confirm password', { exact: true }).fill(conf));
  await pr.step('click "Update password"', () => page.getByRole('button', { name: 'Update password', exact: true }).click());
}
async function freshAccount(pr) {
  const page = await pr.newPage();
  const u = `pw-user-${uniq()}`;
  await register(pr, page, u, `${u}@example.test`);
  await signInOnForm(pr, page, `${u}@example.test`, PW, true);
  return { page, u, email: `${u}@example.test` };
}
// old works / candidate fails, from a signed-in page
async function checkCredentials(pr, page, ident, okPw, badPw) {
  await signOut(pr, page);
  await pr.step('click link "Sign in"', () => page.getByRole('link', { name: 'Sign in', exact: true }).click());
  await signInOnForm(pr, page, ident, badPw, false);
  await signInOnForm(pr, page, ident, okPw, true);
}

const probes = {
  // S1 as written, success path, own fresh account (description: "Each password-change scenario starts with its own verified account")
  'S1 success fresh account': async (pr) => {
    const { page, email } = await freshAccount(pr);
    await openPasswordPage(pr, page);
    await submitChange(pr, page, PW, 'New-password-456!', 'New-password-456!');
    await pr.step('"Password updated"', () => expect(page.getByText('Password updated', { exact: true })).toBeVisible(T));
    await checkCredentials(pr, page, email, 'New-password-456!', PW);
  },
  // S1 success path with the seed account (Seed values line); DESTRUCTIVE for alice on a shared backend
  'S1 success alice-dev': async (pr) => {
    const page = await pr.newPage();
    await signIn(pr, page);
    await openPasswordPage(pr, page);
    await submitChange(pr, page, PW, 'New-password-456!', 'New-password-456!');
    await pr.step('"Password updated"', () => expect(page.getByText('Password updated', { exact: true })).toBeVisible(T));
    await checkCredentials(pr, page, 'alice-dev', 'New-password-456!', PW);
  },
  // S1 THEN clause: noncompliant new password shows a reason, password unchanged
  'S1 facet noncompliant new password (fresh)': async (pr) => {
    const { page, email } = await freshAccount(pr);
    await openPasswordPage(pr, page);
    await submitChange(pr, page, PW, 'short', 'short');
    await pr.step('no "Password updated"', () => expect(page.getByText('Password updated', { exact: true })).toHaveCount(0, T));
    await pr.step('"Password requirements are not satisfied" shown', () => expect(page.getByText('Password requirements are not satisfied')).toBeVisible(T));
    await checkCredentials(pr, page, email, PW, 'short');
  },
  'S1 facet all fields empty (fresh)': async (pr) => {
    const { page, email } = await freshAccount(pr);
    await openPasswordPage(pr, page);
    await submitChange(pr, page, null, null, null);
    await pr.step('"Current password is required"', () => expect(page.getByText('Current password is required')).toBeVisible(T));
    await pr.step('no "Password updated"', () => expect(page.getByText('Password updated', { exact: true })).toHaveCount(0, T));
  },
  'S1 facet current ok, new+confirm empty (fresh)': async (pr) => {
    const { page, email } = await freshAccount(pr);
    await openPasswordPage(pr, page);
    await submitChange(pr, page, PW, null, null);
    await pr.step('no "Password updated"', () => expect(page.getByText('Password updated', { exact: true })).toHaveCount(0, T));
    await checkCredentials(pr, page, email, PW, '');
  },
  'S1 facet mismatched confirmation (fresh)': async (pr) => {
    const { page, email } = await freshAccount(pr);
    await openPasswordPage(pr, page);
    await submitChange(pr, page, PW, 'New-password-456!', 'does-not-match');
    await pr.step('"Password confirmation does not match"', () => expect(page.getByText('Password confirmation does not match')).toBeVisible(T));
    await pr.step('message beside field (inside the form)', () => expect(page.locator('form').getByText('Password confirmation does not match')).toBeVisible(T));
  },
  // S2 = missing current password with Required-password-789! (description seed value)
  'S2 missing current (alice-dev)': async (pr) => {
    const page = await pr.newPage();
    await signIn(pr, page);
    await openPasswordPage(pr, page);
    await submitChange(pr, page, null, 'Required-password-789!', 'Required-password-789!');
    await pr.step('"Current password is required"', () => expect(page.getByText('Current password is required', { exact: true })).toBeVisible(T));
    await pr.step('message beside field (inside the form)', () => expect(page.locator('form').getByText('Current password is required')).toBeVisible(T));
    await checkCredentials(pr, page, 'alice-dev', PW, 'Required-password-789!');
  },
  'S2 missing current (alice-dev), toast-agnostic credential check': async (pr) => {
    const page = await pr.newPage();
    await signIn(pr, page);
    await openPasswordPage(pr, page);
    await submitChange(pr, page, null, 'Required-password-789!', 'Required-password-789!');
    await pr.step('"Current password is required"', () => expect(page.getByText('Current password is required', { exact: true })).toBeVisible(T));
    await checkCredentials(pr, page, 'alice-dev', PW, 'Required-password-789!');
  },
  // S3 = incorrect current + confirmation "does-not-match"
  'S3 wrong current + does-not-match (alice-dev)': async (pr) => {
    const page = await pr.newPage();
    await signIn(pr, page);
    await openPasswordPage(pr, page);
    await submitChange(pr, page, 'Wrong-password-000!', 'Adjust-password-789!', 'does-not-match');
    await pr.step('"Current password is incorrect" or "Password confirmation does not match"', () => expect(page.getByText(/Current password is incorrect|Password confirmation does not match/).first()).toBeVisible(T));
    await pr.step('"Password confirmation does not match" (both errors)', () => expect(page.getByText('Password confirmation does not match')).toBeVisible(T));
  },
  'S3 wrong current + does-not-match, current error then credentials (alice-dev)': async (pr) => {
    const page = await pr.newPage();
    await signIn(pr, page);
    await openPasswordPage(pr, page);
    await submitChange(pr, page, 'Wrong-password-000!', 'Adjust-password-789!', 'does-not-match');
    await pr.step('"Current password is incorrect"', () => expect(page.getByText('Current password is incorrect', { exact: true })).toBeVisible(T));
    await checkCredentials(pr, page, 'alice-dev', PW, 'Adjust-password-789!');
  },
  'S3 resubmit twice (error duplicates?)': async (pr) => {
    const page = await pr.newPage();
    await signIn(pr, page);
    await openPasswordPage(pr, page);
    await submitChange(pr, page, 'Wrong-password-000!', 'Adjust-password-789!', 'Adjust-password-789!');
    await submitChange(pr, page, 'Wrong-password-001!', 'Adjust-password-789!', 'Adjust-password-789!');
    await pr.step('"Current password is incorrect" single match (strict)', () => expect(page.getByText('Current password is incorrect', { exact: true })).toBeVisible(T));
  },
  'S1 password fields cleared after failure': async (pr) => {
    const page = await pr.newPage();
    await signIn(pr, page);
    await openPasswordPage(pr, page);
    await submitChange(pr, page, 'Wrong-password-000!', 'Adjust-password-789!', 'Adjust-password-789!');
    await pr.step('"Current password is incorrect"', () => expect(page.getByText('Current password is incorrect', { exact: true })).toBeVisible(T));
    await pr.step('Current password not redisplayed', () => expect(page.getByLabel('Current password', { exact: true })).toHaveValue('', T));
  },
};

(async () => {
  const filters = process.argv.slice(2);
  const keys = Object.keys(probes).filter((k) => !filters.length || filters.some((f) => k.includes(f)));
  const res = await H.run(probes, keys);
  require('fs').writeFileSync(__dirname + `/probe-results.req13.${H.APP}.json`, JSON.stringify(res, null, 1));
})();
