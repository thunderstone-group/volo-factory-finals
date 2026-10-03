"""Real browser regression: controls remain available in their own scopes, and layout regions are conditional."""
import os
import shutil
import subprocess
import unittest
from pathlib import Path

from oneshot.main import _child_env


SCRIPT = r"""
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const {chromium} = require('playwright');
const library = fs.readFileSync(process.argv[1], 'utf8');
const app = `
window.LAYOUT = { brand: 'Synthetic', nav: [], account: () => '<a href="#/signin">Sign in</a>' };
window.APP = {
  screen() {
    return '<h1>Welcome</h1><p><a href="#/signin">Sign in</a> to continue.</p>' +
      '<a href="#/help">Sign in</a>' +
      '<button type="button" data-action="remove" data-id="1">Remove</button>' +
      '<button type="button" data-action="remove" data-id="2">Remove</button>' +
      '<div style="display:none"><a href="#/docs">Docs</a></div><a href="#/docs">Docs</a>';
  },
  actions: {},
};`;
const html = '<!doctype html><div id="app"></div><div id="dialog-root" hidden></div><div id="status-root" hidden></div>' +
  '<script>window.SEED={};</script><script src="/arc.js"></script><script>' + app + '</script>';
const server = http.createServer((req, res) => {
  req.resume();
  if (req.url === '/api/state') { res.setHeader('Content-Type', 'application/json'); return res.end('{}'); }
  res.setHeader('Content-Type', req.url === '/arc.js' ? 'application/javascript' : 'text/html');
  res.end(req.url === '/arc.js' ? library : html);
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto('http://127.0.0.1:' + server.address().port + '/');
    page.setDefaultTimeout(3000);
    await page.getByRole('heading', {name: 'Welcome'}).waitFor();
    const signIn = page.getByRole('link', {name: 'Sign in', exact: true});
    // Equal names in different regions remain independently available.
    assert.equal(await signIn.count(), 3, 'controls in separate scopes are retained');
    assert.equal(await page.locator('a[href="#/signin"]:visible').count(), 2);
    await page.getByRole('banner').getByRole('link', {name:'Sign in',exact:true}).click();
    await page.getByRole('main').locator('a[href="#/signin"]').click();
    assert.equal(await page.locator('footer').count(), 0);
    assert.equal(await page.getByRole('button',{name:'Synthetic',exact:true}).count(), 0);
    assert.equal(await page.getByRole('link',{name:'Synthetic',exact:true}).count(), 1);
    await page.evaluate(()=>{LAYOUT.brandRole='button';ARC.render();});
    assert.equal(await page.getByRole('button',{name:'Synthetic',exact:true}).count(), 1);
    assert.equal(await page.getByRole('link',{name:'Synthetic',exact:true}).count(), 0);
    await page.evaluate(()=>{delete LAYOUT.brandRole;ARC.render();});
    assert.equal(await page.getByText('Header · Sidebar · Main content · Footer', {exact:true}).count(), 0);
    await page.evaluate(()=>{LAYOUT.footer='Product support';ARC.render();});
    assert.equal(await page.getByRole('contentinfo').textContent(), 'Product support');
    await page.evaluate(()=>{window.LAYOUT={};ARC.render();});
    assert.equal(await page.getByRole('banner').count(), 0);
    assert.equal(await page.locator('footer').count(), 0);
    await page.evaluate(()=>{window.LAYOUT={brand:'Synthetic',nav:[],account:()=>'<a href="#/signin">Sign in</a>'};ARC.render();});
    assert.equal(await page.getByRole('banner').getByRole('link', {name: 'Sign in', exact: true}).count(), 1);
    assert.equal(await page.getByRole('button', {name: 'Remove', exact: true}).count(), 2, 'different records stay');
    // An invisible copy does not hide the visible one.
    assert.equal(await page.getByRole('link', {name: 'Docs', exact: true}).count(), 1);
    await page.getByRole('link', {name: 'Docs', exact: true}).click();
    assert.deepEqual(errors, []);
    console.log('Controls retain their scope; optional layout regions follow configuration.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
"""


@unittest.skipUnless(shutil.which('node'), 'Node is required')
class ScaffoldDuplicatesCase(unittest.TestCase):
    def test_controls_retain_their_scopes_and_optional_layout_is_not_injected(self):
        env = _child_env()
        if 'PLAYWRIGHT_BROWSERS_PATH' in os.environ:
            env['PLAYWRIGHT_BROWSERS_PATH'] = os.environ['PLAYWRIGHT_BROWSERS_PATH']
        available = subprocess.run(['node', '-e', "require('playwright')"], env=env,
                                   capture_output=True, timeout=10)
        if available.returncode:
            self.skipTest('Playwright package is required on NODE_PATH')
        library = Path(__file__).resolve().parents[1] / 'oneshot/scaffold/frontend/public/lib/arc.js'
        result = subprocess.run(['node', '-e', SCRIPT, str(library)], env=env,
                                capture_output=True, text=True, timeout=60)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == '__main__':
    unittest.main()
