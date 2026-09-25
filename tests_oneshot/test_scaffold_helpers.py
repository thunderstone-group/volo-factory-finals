"""`this.helper is not a function`: helpers placed on one part of APP and called through `this` from another."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
ARC = ROOT / 'oneshot/scaffold/frontend/public/lib/arc.js'
MODULES = Path(tempfile.gettempdir()) / "oneshot-jsdom" / "node_modules"

SCRIPT = r'''
const fs = require('fs');
const {JSDOM} = require('jsdom');
const w = new JSDOM('<div id="app"></div><div id="dialog-root" hidden></div><div id="status-root" hidden></div>',
  {url:'http://localhost/#/', runScripts:'outside-only', pretendToBeVisual:true}).window;
w.SEED = {items: []};
w.eval(fs.readFileSync(process.argv[1], 'utf8'));
const errors = [];
w.addEventListener('error', (e) => errors.push(String(e.message)));
w.eval(`window.LAYOUT = {brand: 'App', nav: [], sidebar: [], footer: ''};
window.APP = {
  appHelper() { return '<p>from app</p>'; },
  screens: {
    screenHelper() { return '<p>from screens</p>'; },
    // runs with APP as \`this\` (APP.screen below) yet calls a helper written on screens
    home() { return '<h1>Home</h1>' + this.screenHelper() + '<button type="button" data-action="go">Go</button>'; },
    // runs with screens as \`this\` (called directly below) yet calls a helper written on APP
    other() { return '<h1>Other</h1>' + this.appHelper(); }
  },
  screen(route) { const fn = this.screens[route.name] || this.screens.home; return fn.call(this, route); },
  actions: {
    go() { window.clicked = this.appHelper() + this.screenHelper(); }
  }
};`);
const out = {};
try { w.ARC.render(); out.home = w.document.querySelector('main') ? w.document.querySelector('main').innerHTML : w.document.getElementById('app').innerHTML; } catch (e) { out.homeError = String(e.message); }
try { out.other = w.APP.screens.other(); } catch (e) { out.otherError = String(e.message); }
try { w.document.querySelector('[data-action="go"]').click(); out.clicked = w.clicked || null; } catch (e) { out.clickError = String(e.message); }
out.enumerable = Object.keys(w.APP.screens).sort();
out.errors = errors;
console.log(JSON.stringify(out));
w.close();
'''


@unittest.skipUnless(shutil.which("node") and (MODULES / "jsdom").is_dir(), "Node and jsdom are required")
class SharedHelperTests(unittest.TestCase):
    def run_script(self, arc):
        result = subprocess.run(['node', '-e', SCRIPT, str(arc)], env={**os.environ, 'NODE_PATH': str(MODULES)},
                                capture_output=True, text=True, timeout=20)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout.strip().splitlines()[-1])

    def test_helpers_resolve_through_this_from_screens_app_and_actions(self):
        out = self.run_script(ARC)
        self.assertNotIn('homeError', out)
        self.assertIn('from screens', out['home'])
        self.assertEqual(out.get('other'), '<h1>Other</h1><p>from app</p>')
        self.assertEqual(out.get('clicked'), '<p>from app</p><p>from screens</p>')
        self.assertEqual(out['errors'], [])
        # shared helpers stay out of enumeration (screens lists built from Object.keys are unchanged)
        self.assertEqual(out['enumerable'], ['home', 'other', 'screenHelper'])

    def test_without_the_sharing_the_same_app_throws(self):
        source = ARC.read_text(encoding='utf-8').replace('ARC.shareHelpers(app);', '').replace(
            'fn.call(app.actions, {', 'fn({')
        with tempfile.TemporaryDirectory() as tmp:
            old = Path(tmp) / 'arc.js'
            old.write_text(source, encoding='utf-8')
            out = self.run_script(old)
        self.assertIn('is not a function', out.get('homeError', ''))


if __name__ == "__main__":
    unittest.main()
