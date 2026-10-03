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
    def test_sidebar_merges_identical_destinations_without_losing_distinct_entries(self):
        script = r'''
const fs = require('fs');
const {JSDOM} = require('jsdom');
const w = new JSDOM('', {url:'http://localhost/',runScripts:'outside-only'}).window;
w.SEED = {};
w.eval(fs.readFileSync(process.argv[1], 'utf8'));
w.LAYOUT = {sidebar:[
  {label:'Home', hash:'#/'}, {label:'Saved', hash:'#/saved'},
  {label:'Saved', hash:'#/saved'}, {label:'Saved', hash:'#/other'},
  {label:'Other name', hash:'#/saved'}
]};
w.document.body.innerHTML = w.ARC.layout('', {hash:'#/saved'});
const entries = Array.from(w.document.querySelectorAll('aside a'), el => [el.textContent,el.getAttribute('href'),el.getAttribute('aria-current')]);
console.log(JSON.stringify({entries, originalCount:w.LAYOUT.sidebar.length}));
w.close();
'''
        result = subprocess.run(
            ['node', '-e', script, str(ROOT / 'oneshot/scaffold/frontend/public/lib/arc.js')],
            env={**os.environ, 'NODE_PATH': str(MODULES)}, capture_output=True, text=True,
            timeout=20, check=True,
        )
        self.assertEqual(json.loads(result.stdout.strip().splitlines()[-1]), {
            'entries': [['Home', '#/', None], ['Saved', '#/saved', 'page'],
                        ['Saved', '#/other', None], ['Other name', '#/saved', 'page']],
            'originalCount': 5,
        })

    def test_nested_popover_host_inherits_record_id_and_respects_explicit_overrides(self):
        script = r'''
const fs = require('fs');
const {JSDOM} = require('jsdom');
const w = new JSDOM('<article data-id="record"><div class="host"></div></article>', {url:'http://localhost/',runScripts:'outside-only'}).window;
w.SEED = {};
w.eval(fs.readFileSync(process.argv[1], 'utf8'));
const host = w.document.querySelector('.host');
const target = opts => {
  w.ARC.openPopover(host, [{label:'Apply', action:'apply'}], opts);
  return w.ARC._popover.querySelector('button').dataset.id;
};
const inherited = target();
host.dataset.id = 'selected';
const own = target();
const explicit = target({id: 'override'});
const empty = target({id: ''});
console.log(JSON.stringify({inherited, own, explicit, empty}));
w.close();
'''
        result = subprocess.run(
            ['node', '-e', script, str(ROOT / 'oneshot/scaffold/frontend/public/lib/arc.js')],
            env={**os.environ, 'NODE_PATH': str(MODULES)}, capture_output=True, text=True,
            timeout=20, check=True,
        )
        self.assertEqual(json.loads(result.stdout.strip().splitlines()[-1]), {
            'inherited': 'record', 'own': 'selected', 'explicit': 'override', 'empty': '',
        })

    def test_menu_item_can_replace_its_popover_without_detaching_the_new_controls(self):
        script = r'''
const fs = require('fs');
const {JSDOM} = require('jsdom');
const w = new JSDOM('<div id="app"></div><div id="dialog-root" hidden></div><div id="status-root" hidden></div>', {url:'http://localhost/',runScripts:'outside-only'}).window;
w.SEED = {};
w.eval(fs.readFileSync(process.argv[1], 'utf8'));
const host = w.document.createElement('section');
host.dataset.id = 'parent-record';
w.document.body.appendChild(host);
w.ARC.openPopover(host, [{label:'Choose fields', action:'fields'}]);
const old = w.ARC._popover;
const item = old.querySelector('button');
item.dataset.id = 'selected-record';
w.ARC.openPopover(item, [{label:'Apply', action:'apply'}]);
console.log(JSON.stringify({connected:w.ARC._popover.isConnected, inOriginalScope:host.contains(w.ARC._popover), oldRemoved:!old.isConnected, target:w.ARC._popover.querySelector('button').dataset.id, count:host.querySelectorAll('[data-popover]').length}));
w.close();
'''
        result = subprocess.run(
            ['node', '-e', script, str(ROOT / 'oneshot/scaffold/frontend/public/lib/arc.js')],
            env={**os.environ, 'NODE_PATH': str(MODULES)}, capture_output=True, text=True,
            timeout=20, check=True,
        )
        observed = json.loads(result.stdout.strip().splitlines()[-1])
        self.assertTrue(observed['connected'])
        self.assertTrue(observed['inOriginalScope'])
        self.assertTrue(observed['oldRemoved'])
        self.assertEqual(observed['target'], 'selected-record')
        self.assertEqual(observed['count'], 1)

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
