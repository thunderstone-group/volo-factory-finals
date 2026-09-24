"""Real browser regression: a scaffold combo box is opened by its name and its options are clicked by theirs."""
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
const app = `window.APP = {
  screen() {
    return '<form data-action="submit">' +
      ARC.combobox({label: 'Rows', name: 'rows', options: ['Alpha', 'Beta']}) +
      ARC.combobox({label: 'Columns', name: 'cols', options: [{value: 'a', label: 'Alpha'}, {value: 'b', label: 'Beta'}], change: 'picked'}) +
      '<button type="submit">Apply</button></form>';
  },
  actions: {
    submit(ctx) { window.__submitted = ctx.form; },
    picked(ctx) { window.__picked = ctx.value; },
  },
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
    const rows = page.getByRole('combobox', {name: 'Rows', exact: true});
    assert.equal(await page.getByRole('option').count(), 0, 'no option exists while every box is closed');
    await rows.click();
    assert.equal(await rows.getAttribute('aria-expanded'), 'true');
    // Both boxes offer Alpha, but only the open box's options exist: the exact option locator is strict-safe.
    await page.getByRole('option', {name: 'Alpha', exact: true}).click();
    assert.equal(await rows.innerText(), 'Alpha');
    assert.equal(await rows.getAttribute('aria-expanded'), 'false');
    assert.equal(await page.getByRole('listbox').count(), 0);
    await page.getByLabel('Columns', {exact: true}).click();
    await page.getByRole('option', {name: 'Beta', exact: true}).click();
    assert.equal(await page.evaluate(() => window.__picked), 'b');
    await rows.click();
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('listbox').count(), 0, 'Escape closes the open box');
    await page.getByRole('button', {name: 'Apply', exact: true}).click();
    assert.deepEqual(await page.evaluate(() => window.__submitted), {rows: 'Alpha', cols: 'b'});
    assert.deepEqual(errors, []);
    console.log('Combo boxes open by name, options are clicked by name, values submit with the form.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
"""


@unittest.skipUnless(shutil.which('node'), 'Node is required')
class ScaffoldComboboxCase(unittest.TestCase):
    def test_options_are_clicked_by_name_and_submit_with_the_form(self):
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
