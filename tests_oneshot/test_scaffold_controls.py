"""Native-control regressions reduced from real Lite generated applications."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
MODULES = Path(tempfile.gettempdir()) / "oneshot-jsdom" / "node_modules"


@unittest.skipUnless(shutil.which("node") and (MODULES / "jsdom").is_dir(), "Node and jsdom are required")
class NativeControlTests(unittest.TestCase):
    def test_native_controls_do_not_trigger_their_record_action(self):
        # Synthetic DOM exercising the same actual scaffold used by the real apps.
        script = r'''
const fs = require('fs');
const {JSDOM} = require('jsdom');
(async () => {
  const dom = new JSDOM('<div id="app"></div><div id="dialog-root" hidden></div><div id="status-root" hidden></div>', {url:'http://localhost/',runScripts:'outside-only'});
  const w = dom.window;
  w.fetch = () => Promise.resolve({});
  const observed = {opened:0, changed:0, actionChecked:null, typed:null, submitted:null, routes:[]};
  w.SEED = {};
  w.APP = {
    screen(route) {
      observed.routes.push(route.name);
      return '<article data-action="open-record"><span id="record-title">Record</span>' +
        '<input id="action-check" type="checkbox" data-action="toggle-check">' +
        '<label for="field-check">Enabled</label><input id="field-check" type="checkbox" data-change="field-check">' +
        '<input id="text" data-change="type-text">' +
        '<form data-action="submit-record"><input name="title" value="Draft"><button id="submit">Save</button></form>' +
        '<a id="next" href="#/next">Next</a></article>';
    },
    actions: {
      'open-record': () => observed.opened++,
      'toggle-check': ({el}) => observed.actionChecked = el.checked,
      'field-check': () => observed.changed++,
      'type-text': ({el}) => observed.typed = el.value,
      'submit-record': ({form}) => observed.submitted = form.title,
    }
  };
  w.eval(fs.readFileSync(process.argv[1], 'utf8'));
  await new Promise(resolve => setTimeout(resolve, 0));
  w.ARC.render();
  w.document.getElementById('action-check').click();
  observed.actionNativeChecked = w.document.getElementById('action-check').checked;
  w.document.querySelector('label[for="field-check"]').click();
  observed.fieldNativeChecked = w.document.getElementById('field-check').checked;
  const text = w.document.getElementById('text'); text.value = 'live value';
  text.dispatchEvent(new w.Event('input', {bubbles:true}));
  w.document.getElementById('submit').click();
  observed.openedBeforePrimary = observed.opened;
  w.document.getElementById('record-title').click();
  w.document.getElementById('next').click();
  observed.hash = w.location.hash;
  console.log(JSON.stringify(observed));
  w.close();
})();
'''
        result = subprocess.run(
            ["node", "-e", script, str(ROOT / "oneshot/scaffold/frontend/public/lib/arc.js")],
            env={**os.environ, "NODE_PATH": str(MODULES)}, capture_output=True, text=True,
            timeout=20, check=True,
        )
        observed = json.loads(result.stdout.strip().splitlines()[-1])
        self.assertTrue(observed["actionNativeChecked"])
        self.assertTrue(observed["actionChecked"])
        self.assertTrue(observed["fieldNativeChecked"])
        self.assertEqual(observed["changed"], 1)
        self.assertEqual(observed["typed"], "live value")
        self.assertEqual(observed["submitted"], "Draft")
        self.assertEqual(observed["openedBeforePrimary"], 0)
        self.assertEqual(observed["opened"], 1)
        self.assertEqual(observed["hash"], "#/next")
        self.assertEqual(observed["routes"][-1], "next")


if __name__ == "__main__":
    unittest.main()
