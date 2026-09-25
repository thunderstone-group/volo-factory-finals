const H = require('./harness2.cjs');
const P = process.env.TMPDIR + '/oneshot-playwright-test-1.57.0/node_modules/';
const { chromium } = require(P + 'playwright');
(async () => { await H.restart(); const b = await chromium.launch(); const c = await b.newContext({ baseURL: H.BASE }); const p = await c.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('/'); await p.getByRole('link', { name: 'Sign in', exact: true }).click(); await p.getByRole('link', { name: 'Forgot password', exact: true }).click();
  await p.waitForTimeout(500); console.log('url', p.url(), 'h1', await p.locator('h1').innerText(), 'errors', errs);
  await b.close(); require('child_process').execSync(`lsof -ti tcp:3301 -sTCP:LISTEN | xargs kill -9 || true`); })();
