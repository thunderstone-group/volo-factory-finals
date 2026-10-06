"""Real browser regression: native selects retain accessible values, keyboard input, callbacks and form data."""
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
  screen(route) {
    const native = '<label>Category<select name="category"><option value="a">Alpha</option><option value="b">Beta</option></select></label>';
    if (route.name === 'native') return '<form data-action="submit">' + native + '<button type="submit">Apply</button></form>';
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
    assert.equal(await rows.inputValue(), '');
    assert.equal(await page.getByLabel('Columns', {exact: true}).inputValue(), '');
    await rows.focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.name), 'cols');
    await rows.selectOption({label: 'Alpha'});
    assert.equal(await rows.inputValue(), 'Alpha');
    const cdp = await page.context().newCDPSession(page);
    const ax = await cdp.send('Accessibility.getFullAXTree');
    const rowAX = ax.nodes.find(n => n.role?.value === 'combobox' && n.name?.value === 'Rows');
    assert.equal(rowAX?.value?.value, 'Alpha', 'the real select retains its accessible value');
    await cdp.detach();
    await rows.selectOption({label: 'Beta'});
    assert.equal(await rows.inputValue(), 'Beta');
    const columns = page.getByLabel('Columns', {exact: true});
    await columns.selectOption({label: 'Beta'});
    assert.equal(await page.evaluate(() => window.__picked), 'b');
    await columns.focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Apply');
    await page.keyboard.press('Enter');
    assert.deepEqual(await page.evaluate(() => window.__submitted), {rows: 'Beta', cols: 'b'});
    assert.deepEqual(errors, []);
    // Ordinary native controls work without scaffold DOM or CSS rewriting.
    await page.goto('http://127.0.0.1:' + server.address().port + '/#/native');
    const category = page.getByRole('combobox', {name: 'Category', exact: true});
    await category.selectOption({label: 'Beta'});
    assert.equal(await category.inputValue(), 'b');
    await category.selectOption('a');
    await page.getByRole('button', {name: 'Apply', exact: true}).click();
    assert.deepEqual(await page.evaluate(() => window.__submitted), {category: 'a'});
    await page.evaluate(() => ARC.openDialog('<form data-action="submit"><label>Mode<select name="mode">' +
      '<option value="one">One</option><option value="two">Two</option></select></label>' +
      '<button type="submit">Confirm</button></form>', {title: 'Configure'}));
    const mode = page.getByRole('dialog', {name: 'Configure'}).getByRole('combobox', {name: 'Mode'});
    await mode.selectOption('two');
    await page.getByRole('button', {name: 'Confirm', exact: true}).click();
    assert.deepEqual(await page.evaluate(() => window.__submitted), {mode: 'two'});
    await page.evaluate(() => {
      ARC.closeDialog();
      ARC.openPopover(document.getElementById('app'), '<label>Visibility<select name="visibility">' +
        '<option value="public">Public</option><option value="private">Private</option></select></label>');
    });
    const visibility = page.getByRole('combobox', {name: 'Visibility', exact: true});
    await visibility.selectOption('private');
    assert.equal(await page.locator('selectedcontent, select > button, #arc-native-select-style').count(), 0);
    assert.deepEqual(errors, []);
    console.log('Native selects retain values, keyboard behavior, callbacks and form submission.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
"""


@unittest.skipUnless(shutil.which('node'), 'Node is required')
class ScaffoldComboboxCase(unittest.TestCase):
    def test_native_select_values_keyboard_callbacks_and_form_submission(self):
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
