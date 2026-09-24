"""Real browser regressions for two scaffold mechanics: a render during a press no longer drops the click and the
double-click, and copy/cut/paste reach the app through the browser clipboard (ARC.onCopy / ARC.onPaste)."""
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
// A grid like three 09-24 drafts: every press re-renders the grid (selection), double-click opens an editor either
// through state + render (cell A1) or by writing an input into the cell itself (cell B1).
const app = `
window.APP = {
  screen() {
    const s = ARC.state.ui;
    const cell = (id) => {
      const body = s.editing === id ? '<input aria-label="Edit ' + id + '" value="' + ARC.esc(s.values[id] || '') + '">' : ARC.esc(s.values[id] || '');
      return '<div role="gridcell" aria-label="' + id + '" aria-selected="' + (s.selected === id) + '" data-cell="' + id + '">' + body + '</div>';
    };
    return '<div role="grid" aria-label="Grid">' + ['A1', 'B1', 'C1'].map(cell).join('') + '</div>' +
      '<button type="button" data-action="menuPaste">Paste</button>';
  },
  afterRender() {
    const input = document.querySelector('input[aria-label^="Edit"]');
    if (input) input.focus();
  },
  actions: { menuPaste() { ARC.pasteFromClipboard(); } },
};
ARC.state.ui = { values: {}, selected: null, editing: null };
window.__events = [];
document.addEventListener('mousedown', (ev) => {
  const cell = ev.target.closest('[data-cell]');
  if (!cell || ev.target.closest('input')) return;
  ARC.state.ui.selected = cell.dataset.cell;
  ARC.render();
});
document.addEventListener('mouseup', () => ARC.render());
for (const type of ['click', 'dblclick']) document.addEventListener(type, (ev) => {
  const cell = ev.target.closest('[data-cell]');
  if (cell) window.__events.push(type + ':' + cell.dataset.cell);
});
document.addEventListener('dblclick', (ev) => {
  const cell = ev.target.closest('[data-cell]');
  if (!cell) return;
  if (cell.dataset.cell === 'B1') {
    cell.innerHTML = '<input aria-label="Edit B1" value="">';
    cell.querySelector('input').focus();
    return;
  }
  ARC.state.ui.editing = cell.dataset.cell;
  ARC.render();
});
document.addEventListener('keydown', (ev) => {
  const input = ev.target.closest('input[aria-label^="Edit"]');
  if (!input || ev.key !== 'Enter') return;
  ARC.state.ui.values[input.getAttribute('aria-label').slice(5)] = input.value;
  ARC.state.ui.editing = null;
  ARC.render();
});
ARC.onCopy((cut) => { const id = ARC.state.ui.selected; const text = ARC.state.ui.values[id] || '';
  if (cut) ARC.state.ui.values[id] = ''; return { text, data: { from: id } }; });
ARC.onPaste((text, data) => { window.__pasted = { text, data }; ARC.state.ui.values[ARC.state.ui.selected] = text; ARC.render(); });
`;
const html = '<!doctype html><style>[role=gridcell]{display:inline-block;width:90px;height:24px;border:1px solid #999}</style><div id="app"></div><div id="dialog-root" hidden></div><div id="status-root" hidden></div>' +
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
    const context = await browser.newContext({permissions: ['clipboard-read', 'clipboard-write']});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto('http://127.0.0.1:' + server.address().port + '/');
    page.setDefaultTimeout(3000);
    const cell = (id) => page.getByRole('gridcell', {name: id, exact: true});

    await cell('C1').click();
    assert.deepEqual(await page.evaluate(() => window.__events), ['click:C1'], 'a press that re-renders still clicks');
    assert.equal(await cell('C1').getAttribute('aria-selected'), 'true', 'the postponed render ran in the same task');

    await cell('A1').dblclick();
    const a1 = page.getByLabel('Edit A1', {exact: true});
    await a1.fill('Alpha');
    await a1.press('Enter');
    assert.equal((await cell('A1').innerText()).trim(), 'Alpha', 'a double-click editor opened through render');

    await cell('B1').dblclick();
    const b1 = page.getByLabel('Edit B1', {exact: true});
    await b1.fill('Beta');
    await b1.press('Enter');
    assert.equal((await cell('B1').innerText()).trim(), 'Beta', 'a double-click editor the handler wrote itself survives');

    // A right-button press is not a click sequence: its handlers render at once, as before.
    await cell('C1').click({button: 'right'});
    assert.equal(await cell('C1').getAttribute('aria-selected'), 'true');

    // External text (a test or another program put it on the clipboard) pastes on Ctrl+V and on a menu command.
    await page.evaluate(() => navigator.clipboard.writeText('From outside'));
    await cell('C1').click();
    await page.keyboard.press('Control+V');
    await page.waitForFunction(() => window.__pasted && window.__pasted.text === 'From outside');
    assert.equal(await page.evaluate(() => window.__pasted.data), null, 'external text carries no app data');
    assert.equal((await cell('C1').innerText()).trim(), 'From outside');

    await page.evaluate(() => navigator.clipboard.writeText('Menu text'));
    await cell('B1').click();
    await page.getByRole('button', {name: 'Paste', exact: true}).click();
    await page.waitForFunction(() => window.__pasted && window.__pasted.text === 'Menu text');

    // The app's own copy reaches the clipboard and comes back with its data.
    await cell('A1').click();
    await page.keyboard.press('Control+C');
    await page.waitForFunction(async () => (await navigator.clipboard.readText()) === 'Alpha');
    await cell('C1').click();
    await page.keyboard.press('Control+V');
    await page.waitForFunction(() => window.__pasted && window.__pasted.text === 'Alpha');
    assert.deepEqual(await page.evaluate(() => window.__pasted.data), {from: 'A1'});

    // Inside a text field the browser's own paste applies; the app handler stays out of it.
    await page.evaluate(() => { window.__pasted = null; });
    await cell('A1').dblclick();
    await page.evaluate(() => navigator.clipboard.writeText('typed'));
    await page.getByLabel('Edit A1', {exact: true}).press('Control+V');
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => window.__pasted), null, 'a paste into a text field is left to the field');
    assert.deepEqual(errors, []);
    console.log('Presses that re-render still click and double-click; clipboard text flows both ways.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
"""


@unittest.skipUnless(shutil.which('node'), 'Node is required')
class ScaffoldPointerClipboardCase(unittest.TestCase):
    def test_presses_keep_their_clicks_and_the_clipboard_reaches_the_app(self):
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
