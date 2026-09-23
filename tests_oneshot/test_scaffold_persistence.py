"""Real browser regression for same-tab state and fresh-context isolation."""
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
const initial = {session: null, items: ['initial']};
const html = '<!doctype html><div id="app"></div><div id="dialog-root" hidden></div>' +
  '<div id="status-root" hidden></div><script>window.SEED=' + JSON.stringify(initial) + ';</script>' +
  '<script src="/arc.js"></script><script>window.APP={screen(){return "<h1>Fixture</h1>"}};</script>';
const server = http.createServer((req, res) => {
  req.resume();
  res.setHeader('Content-Type', req.url === '/arc.js' ? 'application/javascript' : 'text/html');
  res.end(req.url === '/arc.js' ? library : req.url === '/' ? html : '{}');
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch();
    const errors = [];
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(String(error)));
    const url = 'http://127.0.0.1:' + server.address().port + '/';
    await page.goto(url);
    await page.evaluate(() => {
      ARC.state.session = 'signed-in-user';
      ARC.state.items.push('saved');
      ARC.save();
    });
    await page.goto(url);
    assert.deepEqual(await page.evaluate(() => ARC.state),
      {session: 'signed-in-user', items: ['initial', 'saved']});
    const independent = await browser.newContext();
    const fresh = await independent.newPage();
    fresh.on('pageerror', error => errors.push(String(error)));
    await fresh.goto(url);
    assert.deepEqual(await fresh.evaluate(() => ARC.state), initial);
    await page.evaluate(() => { ARC.state.session = null; ARC.save(); });
    await page.reload();
    assert.deepEqual(await page.evaluate(() => ARC.state),
      {session: null, items: ['initial', 'saved']});
    assert.deepEqual(errors, []);
    console.log('State survives navigation, logout persists, fresh contexts start from seed.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
"""


@unittest.skipUnless(shutil.which('node'), 'Node is required')
class ScaffoldPersistenceCase(unittest.TestCase):
    def test_navigation_preserves_state_without_leaking_to_a_fresh_context(self):
        env = _child_env()
        if 'PLAYWRIGHT_BROWSERS_PATH' in os.environ:
            env['PLAYWRIGHT_BROWSERS_PATH'] = os.environ['PLAYWRIGHT_BROWSERS_PATH']
        available = subprocess.run(['node', '-e', "require('playwright')"], env=env,
                                   capture_output=True, timeout=10)
        if available.returncode:
            self.skipTest('Playwright package is required on NODE_PATH')
        library = Path(__file__).resolve().parents[1] / 'oneshot/scaffold/frontend/public/lib/arc.js'
        result = subprocess.run(['node', '-e', SCRIPT, str(library)], env=env,
                                capture_output=True, text=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == '__main__':
    unittest.main()
