"""Real browser regressions for the scaffold's context menus on a multi-select grid: a menu opened on a cell closes once
a command runs (a menu left open became part of the cell's text), and a menu Paste works without clipboard permission
by falling back to the app's own copy. Pasted text reaches the app without the trailing line break of copied rows."""
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
// A 3x2 grid with drag selection (aria-selected), a context menu on each cell (Copy, Cut, Paste, More), and a record
// card whose options menu opens inside the card.
const app = `
const COLS = ['A', 'B', 'C'], ROWS = [1, 2];
ARC.state.ui = { pasted: [] };
const sheet = () => ARC.state.sheet;  // a shared record: values and selection, saved by the app
const box = () => { const [a, b] = sheet().sel; const c = (x) => [COLS.indexOf(x[0]), +x.slice(1)];
  const [c1, r1] = c(a), [c2, r2] = c(b); return { l: Math.min(c1, c2), r: Math.max(c1, c2), t: Math.min(r1, r2), b: Math.max(r1, r2) }; };
const inBox = (id) => { const s = box(), c = COLS.indexOf(id[0]), r = +id.slice(1); return c >= s.l && c <= s.r && r >= s.t && r <= s.b; };
window.APP = {
  screen() {
    const v = sheet().values;
    const rows = ROWS.map((r) => '<div role="row" aria-label="Row ' + r + '">' + COLS.map((c) => {
      const id = c + r; return '<div role="gridcell" aria-label="' + id + '" aria-selected="' + inBox(id) + '" data-cell="' + id + '">' + ARC.esc(v[id] || '') + '</div>';
    }).join('') + '</div>').join('');
    return '<div role="grid" aria-label="Grid" aria-multiselectable="true">' + rows + '</div>' +
      '<article data-id="r1"><h2>Record one</h2><button type="button" class="opts" data-action="recordMenu">Options</button></article>';
  },
  actions: {
    copy() { ARC.copyToClipboard(false); },
    cut() { ARC.copyToClipboard(true); },
    paste() { ARC.pasteFromClipboard(); },
    more({ el }) { ARC.openPopover(el, [{ label: 'Sub command', action: 'copy' }], { kind: 'menu', label: 'More' }); },
    recordMenu() { ARC.openPopover(document.querySelector('article'), [{ label: 'Archive', action: 'copy' }], { kind: 'menu' }); },
  },
};
let drag = null;
// Like two official drafts: a left press selects whatever cell is around the event target, menu or not.
document.addEventListener('mousedown', (ev) => {
  const cell = ev.target.closest('[data-cell]'); if (!cell || ev.button !== 0) return;
  drag = cell.dataset.cell; sheet().sel = [drag, drag]; ARC.save();
});
document.addEventListener('mouseup', (ev) => {
  if (!drag) return;
  const cell = ev.target.closest('[data-cell]'); if (cell) sheet().sel = [drag, cell.dataset.cell];
  drag = null; ARC.save(); ARC.render();
});
// The context menu keeps a selection it was opened inside; outside it, it selects the cell (in memory, unsaved).
document.addEventListener('contextmenu', (ev) => {
  const cell = ev.target.closest('[data-cell]'); if (!cell) return;
  ev.preventDefault();
  if (!inBox(cell.dataset.cell)) { sheet().sel = [cell.dataset.cell, cell.dataset.cell]; ARC.render(); }
  const host = document.querySelector('[data-cell="' + cell.dataset.cell + '"]');
  ARC.openPopover(host, [{ label: 'Copy', action: 'copy' }, { label: 'Cut', action: 'cut' }, { label: 'Paste', action: 'paste' },
    { label: 'More', action: 'more' }], { kind: 'menu' });
});
ARC.onCopy((cut) => { const s = box(), rows = [];
  for (let r = s.t; r <= s.b; r++) { const row = []; for (let c = s.l; c <= s.r; c++) row.push(sheet().values[COLS[c] + r] || ''); rows.push(row.join('\\t')); }
  return { text: rows.join('\\n'), data: { cut, from: sheet().sel.slice() } }; });
ARC.onPaste((text, data) => { ARC.state.ui.pasted.push({ text, data });
  const s = box(); const c0 = s.l, r0 = s.t;
  text.split('\\n').forEach((line, i) => line.split('\\t').forEach((v, j) => { if (COLS[c0 + j] && ROWS.includes(r0 + i)) sheet().values[COLS[c0 + j] + (r0 + i)] = v; }));
  ARC.save(); ARC.render(); });
`;
const html = '<!doctype html><style>[role=gridcell]{display:inline-block;width:90px;height:24px;border:1px solid #999;vertical-align:top}' +
  '.popover{position:relative;z-index:5;background:#fff}</style>' +
  '<div id="app"></div><div id="dialog-root" hidden></div><div id="status-root" hidden></div>' +
  '<script>window.SEED={sheet:{values:{A1:"Item",B1:"Qty",A2:"Pen",B2:"4"},sel:["A1","A1"]}};</script>' +
  '<script src="/arc.js"></script><script>' + app + '</script>';
let stored = null;  // the scaffold server's /api/state: shared records only, one copy per page context below
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
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  let browser;
  try {
    browser = await chromium.launch();
    // Like the evaluator's configuration: no clipboard permission granted.
    const page = await (await browser.newContext()).newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(url);
    page.setDefaultTimeout(3000);
    const cell = (id) => page.getByRole('gridcell', {name: id, exact: true});
    const item = (name) => page.getByRole('menuitem', {name, exact: true});
    const pasted = () => page.evaluate(() => ARC.state.ui.pasted);

    // Drag A1:B2, right-click inside it, Copy from the menu: the whole range is copied, and the menu is gone.
    await cell('A1').dragTo(cell('B2'));
    await cell('A2').click({button: 'right'});
    await item('Copy').waitFor();
    assert.equal(await cell('A2').getByRole('menuitem', {name: 'Copy', exact: true}).count(), 1,
      'the menu stays inside its host, where the app finds the cell a command acts on');
    await item('Copy').click();
    assert.equal(await page.getByRole('menu').count(), 0, 'a menu command closes its menu');
    assert.equal(await cell('A2').textContent(), 'Pen', 'no menu text is left in the cell');
    assert.equal(await cell('B2').getAttribute('aria-selected'), 'true', 'pressing a menu item did not re-select its cell');

    // Right-click an outside cell (selected in memory, not yet saved) and Paste from the menu, without clipboard
    // permission: the app's own copy lands on that cell, with its data.
    await cell('C1').click({button: 'right'});
    await item('Paste').click();
    await page.waitForFunction(() => ARC.state.ui.pasted.length === 1);
    assert.deepEqual((await pasted())[0], {text: 'Item\tQty\nPen\t4', data: {cut: false, from: ['A1', 'B2']}});
    assert.equal(await page.getByRole('menu').count(), 0);
    assert.equal(await cell('C1').innerText(), 'Item');

    // Keyboard copy, then menu Paste, still without permission.
    await cell('B1').click();
    await page.keyboard.press('ControlOrMeta+C');
    await cell('C2').click({button: 'right'});
    await item('Paste').click();
    await page.waitForFunction(() => ARC.state.ui.pasted.length === 2);
    assert.equal((await pasted())[1].text, 'Qty');
    assert.equal(await cell('C2').innerText(), 'Qty');

    // A command that opens another popover keeps the new one; a record host keeps its menu inside the record.
    await cell('A1').click({button: 'right'});
    await item('More').click();
    await item('Sub command').waitFor();
    assert.equal(await page.getByRole('menu').count(), 1, 'the replacement menu stays open');
    await page.keyboard.press('Escape');
    await page.getByRole('button', {name: 'Options', exact: true}).click();
    assert.equal(await page.getByRole('article').getByRole('menuitem', {name: 'Archive', exact: true}).count(), 1,
      'a container host holds its popover');
    assert.equal(await page.getByRole('button', {name: 'Options', exact: true}).count(), 1);
    await item('Archive').click();
    assert.equal(await page.getByRole('menu').count(), 0);

    // With permission, external text still wins over the app's copy, and the rows' final line break is dropped.
    const granted = await (await browser.newContext({permissions: ['clipboard-read', 'clipboard-write']})).newPage();
    granted.setDefaultTimeout(3000);
    await granted.goto(url);
    await granted.getByRole('gridcell', {name: 'A1', exact: true}).click();
    await granted.keyboard.press('ControlOrMeta+C');
    await granted.evaluate(() => navigator.clipboard.writeText('x\ty\r\nz\tw\r\n'));
    await granted.getByRole('gridcell', {name: 'B1', exact: true}).click({button: 'right'});
    await granted.getByRole('menuitem', {name: 'Paste', exact: true}).click();
    await granted.waitForFunction(() => ARC.state.ui.pasted.length === 1);
    assert.deepEqual(await granted.evaluate(() => ARC.state.ui.pasted[0]), {text: 'x\ty\nz\tw', data: null});
    await granted.evaluate(() => navigator.clipboard.writeText('k\n'));
    await granted.getByRole('gridcell', {name: 'C2', exact: true}).click();
    await granted.keyboard.press('ControlOrMeta+V');
    await granted.waitForFunction(() => ARC.state.ui.pasted.length === 2);
    assert.equal(await granted.evaluate(() => ARC.state.ui.pasted[1].text), 'k', 'Ctrl+V drops the final line break too');
    assert.deepEqual(errors, []);
    console.log('Menus close after a command and paste the own copy without permission.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
"""


@unittest.skipUnless(shutil.which('node'), 'Node is required')
class ScaffoldMenuCase(unittest.TestCase):
    def test_grid_menus_leave_cells_alone_close_after_a_command_and_paste_without_permission(self):
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
