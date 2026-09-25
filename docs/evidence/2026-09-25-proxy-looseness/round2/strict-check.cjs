const P = process.env.TMPDIR + '/oneshot-playwright-test-1.57.0/node_modules/';
const { chromium } = require(P + 'playwright');
const { expect } = require(P + '@playwright/test');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.setContent('<a href="#a">dup</a><a href="#b">dup</a><p>x</p><p>x</p>');
  for (const [n, fn] of [['click', () => p.getByRole('link', { name: 'dup', exact: true }).click({ timeout: 5000 })],
                         ['expect.toBeVisible', () => expect(p.getByText('x', { exact: true })).toBeVisible({ timeout: 5000 })],
                         ['expect.toHaveText', () => expect(p.getByText('x', { exact: true })).toHaveText('x', { timeout: 5000 })]]) {
    const t = Date.now();
    try { await fn(); console.log(n, 'ok'); } catch (e) { console.log(n, ((Date.now() - t) / 1000).toFixed(2) + 's', String(e.message).split('\n')[0].slice(0, 120)); }
  }
  await b.close();
})();
