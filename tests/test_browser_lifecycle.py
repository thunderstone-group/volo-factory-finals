"""The prepared browser check harness owns one browser for a whole check run.

Run 92220c94fd25 scored 7/10 because three tests died to browser-process faults inside
one 17-second window at the start of the hosted evaluation, while the same application
passed the same public tests 25 times out of 25 locally. The run's last act before that
window was its own self-check suite launching a fresh Chromium per check, eleven of them
in 7.9 seconds, finishing 2.1 seconds before the official suite started in the same
container. These tests pin the launch count to one per check run, so a self-check no
longer hands the evaluation a container full of exiting browser processes.

The fake Playwright module keeps this deterministic and unskippable; the real-browser
case alongside it repeats the count against an installed Chromium.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from volo.web_runtime import BROWSER_CHECK

FAKE_PLAYWRIGHT = r"""const fs=require('node:fs');
function record(event){ fs.appendFileSync(process.env.FAKE_BROWSER_LOG, event + '\n'); }
function makeLocator(){
  return {
    evaluateAll: async () => [],
    count: async () => 0,
    innerText: async () => 'fake body text',
  };
}
function makePage(browser){
  return {
    on(){},
    async goto(){},
    url(){ return 'http://fake.test/'; },
    getByRole(){ return makeLocator(); },
    locator(){ return makeLocator(); },
    async crashTheBrowser(){ browser.crash(); },
  };
}
module.exports={chromium:{
  async launch(){
    record('launch');
    let connected=true;
    const browser={
      isConnected(){ return connected; },
      crash(){ connected=false; record('crash'); },
      async newContext(){
        record('context');
        return {
          setDefaultTimeout(){}, setDefaultNavigationTimeout(){},
          async newPage(){ return makePage(browser); },
          async close(){ record('context-close'); },
        };
      },
      async close(){ connected=false; record('browser-close'); },
    };
    return browser;
  },
}};
"""

CHECKS = """const {test,assert}=require('./browser.cjs');
test('first', async page => { assert.ok(page); });
test('second', async page => { assert.ok(page); });
test('third', async page => { assert.ok(page); });
"""


def run_checks(directory: Path, checks: str = CHECKS, playwright: str | None = FAKE_PLAYWRIGHT):
    """Run one check file against the shipped harness and return the recorded browser events."""
    (directory / 'browser.cjs').write_text(BROWSER_CHECK)
    (directory / 'checks.cjs').write_text(checks)
    log = directory / 'events.log'
    log.write_text('')
    environment = {**os.environ, 'FACTORY_BASE_URL': 'http://fake.test/', 'FAKE_BROWSER_LOG': str(log)}
    if playwright is None:
        environment.pop('FACTORY_PLAYWRIGHT_MODULE', None)
    else:
        (directory / 'fake-playwright.cjs').write_text(playwright)
        environment['FACTORY_PLAYWRIGHT_MODULE'] = str(directory / 'fake-playwright.cjs')
    completed = subprocess.run(['node', '--test', 'checks.cjs'], cwd=directory, capture_output=True,
                               text=True, timeout=180, env=environment)
    return completed, log.read_text().split()


class BrowserLifecycleTests(unittest.TestCase):
    def test_three_checks_share_one_browser_and_get_their_own_context(self):
        with tempfile.TemporaryDirectory() as raw:
            completed, events = run_checks(Path(raw))
            self.assertEqual(completed.returncode, 0, completed.stdout + completed.stderr)
            self.assertEqual(events.count('launch'), 1, events)
            self.assertEqual(events.count('context'), 3, events)
            self.assertEqual(events.count('context-close'), 3, events)

    def test_the_shared_browser_is_closed_once_after_the_last_check(self):
        with tempfile.TemporaryDirectory() as raw:
            completed, events = run_checks(Path(raw))
            self.assertEqual(completed.returncode, 0, completed.stdout + completed.stderr)
            self.assertEqual(events.count('browser-close'), 1, events)
            self.assertEqual(events[-1], 'browser-close', events)

    def test_a_failing_check_still_releases_its_context_and_the_browser(self):
        failing = CHECKS + "test('fails', async () => { throw new Error('Authored failure'); });\n"
        with tempfile.TemporaryDirectory() as raw:
            completed, events = run_checks(Path(raw), failing)
            self.assertNotEqual(completed.returncode, 0)
            self.assertIn('Authored failure', completed.stdout + completed.stderr)
            self.assertEqual(events.count('launch'), 1, events)
            self.assertEqual(events.count('context-close'), 4, events)
            self.assertEqual(events.count('browser-close'), 1, events)

    def test_a_crashed_browser_is_relaunched_rather_than_failing_every_later_check(self):
        crashing = ("const {test,assert}=require('./browser.cjs');\n"
                    "test('first', async page => { assert.ok(page); });\n"
                    "test('crashes', async page => { await page.crashTheBrowser(); });\n"
                    "test('after the crash', async page => { assert.ok(page); });\n")
        with tempfile.TemporaryDirectory() as raw:
            completed, events = run_checks(Path(raw), crashing)
            self.assertEqual(completed.returncode, 0, completed.stdout + completed.stderr)
            self.assertIn('crash', events)
            self.assertEqual(events.count('launch'), 2, events)
            self.assertEqual(events.count('context'), 3, events)

    def test_missing_playwright_still_fails_the_check_rather_than_the_module_load(self):
        with tempfile.TemporaryDirectory() as raw:
            completed, _ = run_checks(Path(raw), playwright=None)
            self.assertNotEqual(completed.returncode, 0)
            self.assertIn('Provided Playwright is unavailable', completed.stdout + completed.stderr)

    @unittest.skipUnless(os.getenv('FACTORY_TEST_PLAYWRIGHT_MODULE') and
                         os.getenv('FACTORY_TEST_CHROMIUM_EXECUTABLE'),
                         'Provide an installed Playwright module and Chromium for real browser checks')
    def test_an_installed_chromium_is_launched_once_for_three_checks(self):
        module = os.environ['FACTORY_TEST_PLAYWRIGHT_MODULE']
        executable = os.environ['FACTORY_TEST_CHROMIUM_EXECUTABLE']
        counting = ("const fs=require('node:fs');const pw=require(" + json.dumps(module) + ");\n"
                    "module.exports={chromium:{launch:async()=>{"
                    "fs.appendFileSync(process.env.FAKE_BROWSER_LOG,'launch\\n');"
                    "return pw.chromium.launch({headless:true,executablePath:"
                    + json.dumps(executable) + "});}}};")
        checks = ("const {test,assert}=require('./browser.cjs');\n"
                  "for(const name of ['one','two','three'])\n"
                  "  test(name, async page => {\n"
                  "    assert.equal(await page.getByRole('heading',{name:'Prepared'}).count(), 1);\n"
                  "  });\n")
        with tempfile.TemporaryDirectory() as raw:
            directory = Path(raw)
            (directory / 'page.html').write_text('<!doctype html><title>t</title><h1>Prepared</h1>')
            (directory / 'browser.cjs').write_text(BROWSER_CHECK)
            (directory / 'counting-playwright.cjs').write_text(counting)
            (directory / 'checks.cjs').write_text(checks)
            log = directory / 'events.log'
            log.write_text('')
            completed = subprocess.run(
                ['node', '--test', 'checks.cjs'], cwd=directory, capture_output=True, text=True,
                timeout=180,
                env={**os.environ,
                     'FACTORY_PLAYWRIGHT_MODULE': str(directory / 'counting-playwright.cjs'),
                     'FACTORY_BASE_URL': (directory / 'page.html').as_uri(),
                     'FAKE_BROWSER_LOG': str(log)})
            self.assertEqual(completed.returncode, 0, completed.stdout + completed.stderr)
            self.assertEqual(log.read_text().split().count('launch'), 1, log.read_text())


if __name__ == '__main__':
    unittest.main()
