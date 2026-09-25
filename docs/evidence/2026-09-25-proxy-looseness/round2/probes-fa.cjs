'use strict';
// False-alarm checks: what the app shows for the v2 over-assertions, and whether the plausible hidden case passes.
const H = require('./harness2.cjs');
const { expect, T, PW, uniq, signIn, signInOnForm, register, signOut } = H;
async function recover(pr, p, email, code, pw) {
  await pr.step('goto /', () => p.goto('/'));
  await pr.step('Sign in', () => p.getByRole('link', { name: 'Sign in', exact: true }).click());
  await pr.step('Forgot password', () => p.getByRole('link', { name: 'Forgot password', exact: true }).click());
  await pr.step('fill Email', () => p.getByLabel('Email', { exact: true }).fill(email));
  await pr.step('Send reset link', () => p.getByRole('button', { name: 'Send reset link', exact: true }).click());
  await pr.step('"123456" as distinct text', () => expect(p.getByText('123456', { exact: true })).toBeVisible(T));
  await pr.step('fill code', () => p.getByLabel('Verification code', { exact: true }).fill(code));
  await pr.step('fill New password', () => p.getByLabel('New password', { exact: true }).fill(pw));
  await pr.step('fill Confirm password', () => p.getByLabel('Confirm password', { exact: true }).fill(pw));
  await pr.step('Reset password', () => p.getByRole('button', { name: 'Reset password', exact: true }).click());
}
const probes = {
  'REQ-1-1-1 S3 multi-invalid: messages + username/email retained (hidden-like)': async (pr) => {
    const p = await pr.newPage();
    await pr.step('goto /', () => p.goto('/'));
    await pr.step('Sign in', () => p.getByRole('link', { name: 'Sign in', exact: true }).click());
    await pr.step('Create an account', () => p.getByRole('link', { name: 'Create an account', exact: true }).click());
    await pr.step('fill', async () => { await p.getByLabel('Username', { exact: true }).fill('-bad-user'); await p.getByLabel('Email', { exact: true }).fill('not-an-email'); await p.getByLabel('Password', { exact: true }).fill('short'); await p.getByLabel('Confirm password', { exact: true }).fill('different'); });
    await pr.step('Create account', () => p.getByRole('button', { name: 'Create account', exact: true }).click());
    for (const m of ['Username format is invalid', 'Email format is invalid', 'Password requirements are not satisfied', 'Agree to terms is required'])
      await pr.step(`"${m}"`, () => expect(p.getByText(m, { exact: true })).toBeVisible(T));
    await pr.step('username retained', () => expect(p.getByLabel('Username', { exact: true })).toHaveValue('-bad-user', T));
    await pr.step('email retained', () => expect(p.getByLabel('Email', { exact: true })).toHaveValue('not-an-email', T));
    await pr.step('[v2 extra] Password field empty', () => expect(p.getByLabel('Password', { exact: true })).toHaveValue('', T));
  },
  'REQ-1-1-2 S4 unknown account: generic failure (hidden-like) then v2 extra': async (pr) => {
    const p = await pr.newPage(); const g = 'ghost-' + uniq();
    await pr.step('goto /', () => p.goto('/'));
    await pr.step('Sign in', () => p.getByRole('link', { name: 'Sign in', exact: true }).click());
    await signInOnForm(pr, p, g, PW, false);
    await pr.step('reload: still unauthenticated, sign-in form', async () => { await p.reload(); await expect(p.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible(T); });
    await signInOnForm(pr, p, 'alice-dev', PW, true);
    await pr.close();
    const q = await pr.newPage();
    await pr.step('goto /', () => q.goto('/'));
    await pr.step('Sign in', () => q.getByRole('link', { name: 'Sign in', exact: true }).click());
    await signInOnForm(pr, q, g, PW, false);
    await pr.step('[v2 extra] identifier retained', () => expect(q.getByLabel('Username or email', { exact: true })).toHaveValue(g, T));
  },
  'REQ-1-1-3 S3 success path for a new account (hidden-like)': async (pr) => {
    const p = await pr.newPage(); const u = 'pw-user-' + uniq(); const e = u + '@example.test';
    await register(pr, p, u, e);
    await recover(pr, p, e, '123456', 'Replacement-password-456!');
    await pr.step('"Password updated"', () => expect(p.getByText('Password updated', { exact: true })).toBeVisible(T));
    await pr.step('goto /', () => p.goto('/'));
    await pr.step('Sign in', () => p.getByRole('link', { name: 'Sign in', exact: true }).click());
    await signInOnForm(pr, p, e, PW, false);
    await signInOnForm(pr, p, e, 'Replacement-password-456!', true);
  },
  'REQ-1-1-3 S3 unknown email + correct code (v2 case)': async (pr) => {
    const p = await pr.newPage();
    await recover(pr, p, 'nobody-' + uniq() + '@example.test', '123456', 'Replacement-password-456!');
    await pr.step('[v2 extra] no "Password updated"', () => expect(p.getByText('Password updated', { exact: true })).toHaveCount(0, T));
  },
};
(async () => { const k = Object.keys(probes).filter((x) => !process.argv[2] || x.includes(process.argv[2])); await H.run(probes, k); })();
