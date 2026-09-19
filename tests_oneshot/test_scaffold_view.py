"""Synthetic state-isolation regressions using the shipped JavaScript, not a browser.

Node VM contexts stand in for independent pages; DOM/timers/fetch are local stubs.
No sockets, external services, credentials, model calls or official fixtures are used.
"""
import os
import shutil
import subprocess
import tempfile
import unittest
import zipfile
from pathlib import Path

from oneshot import main as adapter
from scripts import package_oneshot as pack

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "oneshot" / "scaffold" / "frontend" / "public"
NODE = shutil.which("node")

HARNESS = r"""
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const publicDir = process.argv[1];
const plain = value => JSON.parse(JSON.stringify(value));
function page(options = {}) {
  const writes = [];
  const elements = Object.fromEntries(['app', 'dialog-root', 'status-root'].map(id =>
    [id, { innerHTML: '', hidden: true, setAttribute() {}, removeAttribute() {} }]));
  const context = {
    console,
    location: { hash: '#/' },
    document: { addEventListener() {}, getElementById(id) { return elements[id]; } },
    addEventListener() {}, setTimeout() { return 1; }, clearTimeout() {},
    fetch(url, options) {
      writes.push({ url, method: options.method, body: JSON.parse(options.body) });
      return Promise.resolve({ ok: true });
    }
  };
  context.window = context;
  vm.createContext(context);
  const load = name => vm.runInContext(fs.readFileSync(path.join(publicDir, name), 'utf8'),
                                      context, { filename: name, timeout: 1000 });
  load('seed.js');
  if (options.seed) context.SEED = options.seed;
  if (Object.hasOwn(options, 'viewSeed')) context.VIEW_SEED = options.viewSeed;
  // Set the VM-visible value, not a deletion on Node's outer context wrapper.
  if (options.noViewSeed) context.VIEW_SEED = undefined;
  load('lib/arc.js');
  load('app.js');
  let renders = 0;
  context.ARC.render = () => { renders++; };
  return { window: context, arc: context.ARC, actions: context.APP.actions,
           writes, elements, renders: () => renders };
}
"""


@unittest.skipUnless(NODE, "node is required to execute the shipped scaffold")
class ScaffoldViewCase(unittest.TestCase):
    def js(self, assertions):
        # This test executes only the trusted scaffold. Do not pass gateway credentials or
        # preload options to the subprocess; fixtures never need the operator environment.
        env = {key: value for key, value in os.environ.items()
               if key in {"PATH", "SYSTEMROOT", "WINDIR", "TMPDIR", "TEMP", "TMP"}}
        result = subprocess.run([NODE, "-e", HARNESS + assertions, str(PUBLIC)],
                                capture_output=True, text=True, timeout=15, env=env)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_search_never_enters_business_save(self):
        self.js(r"""
const p = page();
p.actions['search-items']({ el: { value: 'First' } });
assert.equal(p.writes.length, 0);
p.actions['create-item']({ form: { title: 'Second item' } });
assert.equal(p.writes.length, 1);
const saved = p.writes[0];
assert.equal(saved.url, '/api/state');
assert.equal(saved.method, 'PUT');
assert.equal(Object.hasOwn(saved.body, 'query'), false, 'search leaked into shared /api/state');
assert.equal(saved.body.items[0].title, 'Second item');
assert.equal(p.arc.view.query, 'First');
""")

    def test_independent_pages_keep_local_view_when_business_data_is_shared(self):
        self.js(r"""
const defaults = { sidebarCollapsed: false, mode: 'grid', filter: { text: '' } };
const a = page({ viewSeed: defaults });
const b = page({ viewSeed: defaults });
a.arc.view.sidebarCollapsed = true;
a.arc.view.mode = 'list';
a.arc.view.filter.text = 'mine';
a.arc.state.items[0].title = 'Shared edit';
a.arc.save();
// Simulate the next page consuming the shared backend snapshot.
b.arc.state = plain(a.writes[0].body);
assert.equal(b.arc.state.items[0].title, 'Shared edit');
assert.deepEqual(plain(b.arc.view), defaults);
assert.deepEqual(defaults, { sidebarCollapsed: false, mode: 'grid', filter: { text: '' } });
assert.equal(Object.hasOwn(a.writes[0].body, 'sidebarCollapsed'), false);
assert.equal(Object.hasOwn(a.writes[0].body, 'view'), false);
assert.equal(a.arc.view.sidebarCollapsed, true);
""")

    def test_new_page_resets_view_without_resetting_saved_domain_data(self):
        self.js(r"""
const defaults = { collapsed: false, mode: 'grid' };
const a = page({ viewSeed: defaults });
a.arc.view.collapsed = true;
a.arc.state.items.push({ id: 'kept', title: 'Persist me' });
a.arc.save();
const reloaded = page({ seed: a.writes[0].body, viewSeed: defaults });
assert.deepEqual(plain(reloaded.arc.view), defaults);
assert.equal(reloaded.arc.state.items.at(-1).id, 'kept');
assert.equal(reloaded.writes.length, 0);
""")

    def test_missing_view_seed_is_backwards_compatible(self):
        self.js(r"""
const p = page({ noViewSeed: true });
assert.equal(p.window.VIEW_SEED, undefined);
assert.deepEqual(plain(p.arc.view), {});
p.arc.view.panelOpen = true;
p.arc.save();
assert.deepEqual(p.writes[0].body, plain(p.arc.state));
assert.equal(Object.hasOwn(p.writes[0].body, 'panelOpen'), false);
""")

    def test_view_survives_synchronous_navigation_without_a_save(self):
        self.js(r"""
const p = page();
p.actions['search-items']({ el: { value: 'First' } });
p.arc.navigate('#/items');
assert.equal(p.window.location.hash, '#/items');
assert.equal(p.arc.view.query, 'First');
assert.equal(p.renders(), 2);
assert.equal(p.writes.length, 0);
""")

    def test_search_value_is_preserved_and_escaped_in_rendered_input(self):
        self.js(r"""
const p = page();
p.actions['search-items']({ el: { value: '"<&' } });
const html = p.window.APP.screens.items();
assert.ok(html.includes('value="&quot;&lt;&amp;"'), html);
assert.equal(p.writes.length, 0);
""")


class ScaffoldViewContractCase(unittest.TestCase):
    def test_scaffold_gate_reports_removed_view_primitive(self):
        with tempfile.TemporaryDirectory() as temp:
            stage = Path(temp) / "app"
            shutil.copytree(adapter.SCAFFOLD_DIR, stage)
            self.assertEqual(adapter.scaffold_gaps(stage), [])
            source = stage / "frontend/public/lib/arc.js"
            original = source.read_text(encoding="utf-8")
            self.assertIn("ARC.view =", original)
            source.write_text(original.replace("ARC.view =", "ARC.removedView ="), encoding="utf-8")
            self.assertTrue(any("ARC.view" in gap for gap in adapter.scaffold_gaps(stage)))

    def test_scaffold_gate_accepts_view_assignment_whitespace(self):
        with tempfile.TemporaryDirectory() as temp:
            stage = Path(temp) / "app"
            shutil.copytree(adapter.SCAFFOLD_DIR, stage)
            source = stage / "frontend/public/lib/arc.js"
            original = source.read_text(encoding="utf-8")
            for assignment in ("ARC.view=", "ARC . view =", "ARC.view\n= "):
                with self.subTest(assignment=assignment):
                    source.write_text(original.replace("ARC.view =", assignment), encoding="utf-8")
                    self.assertEqual(adapter.scaffold_gaps(stage), [])

    def test_package_carries_view_boundary_and_not_test_fixtures(self):
        with tempfile.TemporaryDirectory() as temp:
            archive = Path(temp) / "candidate.zip"
            manifest = pack.build_package(archive)
            with zipfile.ZipFile(archive) as bundle:
                self.assertIn("ARC.view =", bundle.read("scaffold/frontend/public/lib/arc.js").decode())
                self.assertIn("window.VIEW_SEED", bundle.read("scaffold/frontend/public/seed.js").decode())
                self.assertIn("ARC.view.query", bundle.read("scaffold/frontend/public/app.js").decode())
                self.assertFalse(any("test_scaffold_view" in name for name in bundle.namelist()))
            self.assertIn("scaffold/frontend/public/lib/arc.js", manifest["files"])


if __name__ == "__main__":
    unittest.main()
