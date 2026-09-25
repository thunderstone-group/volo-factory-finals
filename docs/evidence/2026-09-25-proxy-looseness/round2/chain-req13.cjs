'use strict';
// Replays hidden-like REQ-1-1-1..REQ-1-2 flows on ONE backend (never reset), then REQ-1-3 subject probes.
const H = require('./harness2.cjs');
const { expect, T, PW, uniq, signIn, signInOnForm, register, signOut } = H;
const soft = async (pr, fn) => { try { await fn(); } catch (e) {} if (pr.fail) { pr.log.push('(pred stopped: ' + pr.fail.label + ')'); pr.fail = null; } await pr.close(); };
async function openPw(pr, page) {
  await pr.step('Account menu', () => page.getByRole('button', { name: 'Account menu', exact: true }).click());
  await pr.step('Settings', () => page.getByRole('link', { name: 'Settings', exact: true }).click());
  await pr.step('Password and authentication', () => page.getByRole('link', { name: 'Password and authentication', exact: true }).click());
}
const preds = [
  async (pr) => { const p = await pr.newPage(); const u = 'pw-user-' + uniq(); await register(pr, p, u, u + '@example.test'); await signInOnForm(pr, p, u + '@example.test', PW, true); await p.reload(); },
  async (pr) => { const p = await pr.newPage(); await pr.step('goto', () => p.goto('/')); await p.getByRole('link', { name: 'Sign in', exact: true }).click(); await p.getByRole('link', { name: 'Create an account', exact: true }).click();
    await p.getByLabel('Username', { exact: true }).fill('alice-dev'); await p.getByLabel('Email', { exact: true }).fill('other-' + uniq() + '@example.test'); await p.getByLabel('Password', { exact: true }).fill(PW); await p.getByLabel('Confirm password', { exact: true }).fill(PW);
    await p.getByRole('checkbox', { name: 'Agree to the terms', exact: true }).check(); await p.getByRole('button', { name: 'Create account', exact: true }).click(); },
  async (pr) => { const p = await pr.newPage(); await pr.step('goto', () => p.goto('/')); await p.getByRole('link', { name: 'Sign in', exact: true }).click(); await p.getByRole('link', { name: 'Create an account', exact: true }).click();
    await p.getByLabel('Username', { exact: true }).fill('-bad'); await p.getByLabel('Email', { exact: true }).fill('not-an-email'); await p.getByLabel('Password', { exact: true }).fill('short'); await p.getByLabel('Confirm password', { exact: true }).fill('different'); await p.getByRole('button', { name: 'Create account', exact: true }).click(); },
  async (pr) => { const p = await pr.newPage(); await signIn(pr, p); await p.reload(); },
  async (pr) => { const p = await pr.newPage(); await signIn(pr, p, 'alice.dev@example.test'); },
  async (pr) => { const p = await pr.newPage(); await pr.step('goto', () => p.goto('/')); await p.getByRole('link', { name: 'Sign in', exact: true }).click(); await signInOnForm(pr, p, 'alice-dev', 'Wrong-password-1!', false); },
  async (pr) => { const p = await pr.newPage(); await pr.step('goto', () => p.goto('/')); await p.getByRole('link', { name: 'Sign in', exact: true }).click(); await signInOnForm(pr, p, 'ghost-' + uniq(), PW, false); },
  // REQ-1-1-3: new account recovered with correct code, unknown email, wrong code
  async (pr) => { const p = await pr.newPage(); const u = 'pw-user-' + uniq(); await register(pr, p, u, u + '@example.test');
    for (const [email, code] of [[u + '@example.test', '123456'], ['nobody-' + uniq() + '@example.test', '123456'], [u + '@example.test', '000000']]) {
      await pr.step('goto', () => p.goto('/')); await p.getByRole('link', { name: 'Sign in', exact: true }).click(); await p.getByRole('link', { name: 'Forgot password', exact: true }).click();
      await p.getByLabel('Email', { exact: true }).fill(email); await p.getByRole('button', { name: 'Send reset link', exact: true }).click();
      await p.getByLabel('Verification code', { exact: true }).fill(code); await p.getByLabel('New password', { exact: true }).fill('Replacement-password-456!'); await p.getByLabel('Confirm password', { exact: true }).fill('Replacement-password-456!');
      await p.getByRole('button', { name: 'Reset password', exact: true }).click(); } },
  async (pr) => { const p = await pr.newPage(); await signIn(pr, p); await openPw(pr, p); await signOut(pr, p); await p.reload(); },
  async (pr) => { const p = await pr.newPage(); await signIn(pr, p); await p.getByRole('button', { name: 'Account menu', exact: true }).click(); await p.getByRole('link', { name: 'Sign out', exact: true }).click(); await p.getByRole('button', { name: 'Cancel', exact: true }).click(); },
];
const probes = {
  'CHAIN REQ-1-1-1..REQ-1-2 -> REQ-1-3 S1/S2/S3 described cases': async (pr) => {
    for (const f of preds) await soft(pr, () => f(pr));
    pr.log.push('--- subject');
    // S1 success on a fresh account
    let p = await pr.newPage(); const u = 'pw-user-' + uniq(); await register(pr, p, u, u + '@example.test'); await signInOnForm(pr, p, u + '@example.test', PW, true);
    await openPw(pr, p);
    await p.getByLabel('Current password', { exact: true }).fill(PW); await p.getByLabel('New password', { exact: true }).fill('New-password-456!'); await p.getByLabel('Confirm password', { exact: true }).fill('New-password-456!');
    await pr.step('[S1] Update password', () => p.getByRole('button', { name: 'Update password', exact: true }).click());
    await pr.step('[S1] "Password updated"', () => expect(p.getByText('Password updated', { exact: true })).toBeVisible(T));
    await pr.close();
    // S2 missing current on alice
    p = await pr.newPage(); await signIn(pr, p); await openPw(pr, p);
    await p.getByLabel('New password', { exact: true }).fill('Required-password-789!'); await p.getByLabel('Confirm password', { exact: true }).fill('Required-password-789!');
    await pr.step('[S2] Update password', () => p.getByRole('button', { name: 'Update password', exact: true }).click());
    await pr.step('[S2] "Current password is required"', () => expect(p.getByText('Current password is required', { exact: true })).toBeVisible(T));
    await pr.close();
    // S3 wrong current on alice
    p = await pr.newPage(); await signIn(pr, p); await openPw(pr, p);
    await p.getByLabel('Current password', { exact: true }).fill('Wrong-password-000!'); await p.getByLabel('New password', { exact: true }).fill('Adjust-password-789!'); await p.getByLabel('Confirm password', { exact: true }).fill('does-not-match');
    await pr.step('[S3] Update password', () => p.getByRole('button', { name: 'Update password', exact: true }).click());
    await pr.step('[S3] "Current password is incorrect"', () => expect(p.getByText('Current password is incorrect', { exact: true })).toBeVisible(T));
    await pr.close();
    p = await pr.newPage(); await signIn(pr, p);
  },
};
H.run(probes, Object.keys(probes)).then((r) => { console.log(r[0].log.filter((l) => /pred|---|\[S|FAIL/.test(l)).join('\n')); });
