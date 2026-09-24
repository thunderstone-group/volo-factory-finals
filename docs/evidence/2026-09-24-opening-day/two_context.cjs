// Two isolated browser contexts against one app: A registers an account, B signs in with it.
const { chromium } = require('playwright');
(async () => {
  const base = process.argv[2];
  const browser = await chromium.launch();
  const suffix = Date.now().toString(36);
  const user = 'pw-user-' + suffix, email = user + '@example.test', pw = 'Valid-password-123!';
  const out = {};
  const a = await (await browser.newContext({ baseURL: base })).newPage();
  await a.goto('/');
  await a.getByRole('link', { name: 'Sign in', exact: true }).first().click();
  await a.getByRole('link', { name: 'Create an account', exact: true }).click();
  await a.getByLabel('Username', { exact: true }).fill(user);
  await a.getByLabel('Email', { exact: true }).fill(email);
  await a.getByLabel('Password', { exact: true }).fill(pw);
  await a.getByLabel('Confirm password', { exact: true }).fill(pw);
  await a.getByRole('checkbox', { name: 'Agree to the terms' }).check();
  await a.getByRole('button', { name: 'Create account', exact: true }).click();
  await a.waitForTimeout(500);
  // Same context: sign in right away.
  await a.getByLabel('Username or email', { exact: true }).fill(email);
  await a.getByLabel('Password', { exact: true }).fill(pw);
  await a.getByRole('button', { name: 'Sign in', exact: true }).click();
  await a.waitForTimeout(500);
  out.sameContextSignedIn = await a.getByRole('button', { name: 'Account menu' }).isVisible().catch(() => false);
  // Second, isolated context: sign in with the account A just created.
  const b = await (await browser.newContext({ baseURL: base })).newPage();
  await b.goto('/');
  await b.getByRole('link', { name: 'Sign in', exact: true }).first().click();
  await b.getByLabel('Username or email', { exact: true }).fill(email);
  await b.getByLabel('Password', { exact: true }).fill(pw);
  await b.getByRole('button', { name: 'Sign in', exact: true }).click();
  await b.waitForTimeout(500);
  out.otherContextSignedIn = await b.getByRole('button', { name: 'Account menu' }).isVisible().catch(() => false);
  out.otherContextError = await b.getByText('Invalid credentials').isVisible().catch(() => false);
  console.log(JSON.stringify(out));
  await browser.close();
})().catch((e) => { console.error('ERR', e.message.split('\n')[0]); process.exit(1); });
