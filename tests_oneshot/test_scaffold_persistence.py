"""Real browser regression: records shared across browser sessions, sign-in and view state per browser."""
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
let stored = null;  // the scaffold server's /api/state: shared records only
const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    if (req.url === '/api/state') {
      if (req.method === 'PUT') stored = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(req.method === 'PUT' ? {ok: true} : stored || {}));
    }
    res.setHeader('Content-Type', req.url === '/arc.js' ? 'application/javascript' : 'text/html');
    res.end(req.url === '/arc.js' ? library : html);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch();
    const errors = [];
    const open = async () => {
      const page = await (await browser.newContext()).newPage();
      page.on('pageerror', error => errors.push(String(error)));
      await page.goto(url);
      return page;
    };
    const url = 'http://127.0.0.1:' + server.address().port + '/';
    const first = await open();
    assert.deepEqual(stored, {items: ['initial']}, 'the first visit shares the seed records, never the session');
    await first.evaluate(() => {
      ARC.state.session = 'owner';
      ARC.state.items.push('saved');
      ARC.state.teams = ['created later'];      // an undeclared array is a record collection too
      ARC.state.ui = {open: true};              // view state stays in this tab
      ARC.state.signInError = 'Invalid';        // so does any other non-record key
      ARC.save();
    });
    await first.goto(url);
    assert.deepEqual(await first.evaluate(() => ARC.state), {session: 'owner', items: ['initial', 'saved'],
      teams: ['created later'], ui: {open: true}, signInError: 'Invalid'});
    // Another user's isolated browser session reads the same records, with its own sign-in and view state.
    const second = await open();
    assert.deepEqual(await second.evaluate(() => ARC.state),
      {session: null, items: ['initial', 'saved'], teams: ['created later']});
    await second.evaluate(() => { ARC.state.session = 'member'; ARC.state.items.push('by member'); ARC.save(); });
    // The first session sees the member's record on its next navigation, and keeps its own sign-in.
    await first.evaluate(() => ARC.navigate('#/other'));
    assert.deepEqual(await first.evaluate(() => [ARC.state.session, ARC.state.items]),
      ['owner', ['initial', 'saved', 'by member']]);
    // Signing out lasts across a reload and does not sign the other session out.
    await first.evaluate(() => { ARC.state.session = null; ARC.save(); });
    await first.reload();
    assert.equal(await first.evaluate(() => ARC.state.session), null);
    await second.reload();
    assert.equal(await second.evaluate(() => ARC.state.session), 'member');
    // A second tab in the same browser session shares the sign-in, not the tab's view state.
    const tab = await second.context().newPage();
    await tab.goto(url);
    assert.deepEqual(await tab.evaluate(() => [ARC.state.session, ARC.state.ui]), ['member', undefined]);
    assert.deepEqual(errors, []);
    console.log('Records are shared across browser sessions; sign-in and view state stay per browser.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
"""


@unittest.skipUnless(shutil.which('node'), 'Node is required')
class ScaffoldPersistenceCase(unittest.TestCase):
    def test_records_are_shared_while_sign_in_and_view_state_stay_per_browser(self):
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
