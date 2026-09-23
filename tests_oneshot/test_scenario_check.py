"""End-to-end scenario check on a LOCAL SYNTHETIC application (no competition artifacts, no network).

Runs only where Playwright and its Chromium are installed (set NODE_PATH and PLAYWRIGHT_BROWSERS_PATH);
otherwise it is skipped, like the other optional browser checks.
"""
import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from oneshot import scenario_check

REQUIREMENTS = """id: ROOT
name: Synthetic Items
type: FOLDER
children:
  - id: REQ-1.1
    name: Open Home
    type: ATOMIC
    dependencies: []
    scenarios:
      - name: Open Home
        steps:
          - keyword: GIVEN
            content: The system is accessible.
          - keyword: WHEN
            content: The user opens the application URL.
          - keyword: THEN
            content: The homepage is displayed with exactly one visible heading named `Demo Home`.
  - id: REQ-2
    name: Items
    type: FOLDER
    children:
      - id: REQ-2.1
        name: View Item List
        type: ATOMIC
        dependencies: [REQ-1.1]
        scenarios:
          - name: View Item List
            steps:
              - keyword: GIVEN
                content: The user is on a page where the global navigation bar is visible.
              - keyword: WHEN
                content: The user activates the unique link or button named `Items` in the top navigation bar.
              - keyword: THEN
                content: The system displays the item list page with heading `Items` and a unique item entry named `Item 2.1` in the `Item list` region.
      - id: REQ-2.2
        name: Item Details
        type: ATOMIC
        description: 'Seed data: item "Item 2.2".'
        dependencies: [REQ-2.1]
        scenarios:
          - name: Item Details
            steps:
              - keyword: GIVEN
                content: The user is on the item list page.
              - keyword: WHEN
                content: The user activates the unique link or button named `Item 2.2` in the item list.
              - keyword: THEN
                content: The system displays the item details page with a visible heading named `Item 2.2`.
      - id: REQ-2.3
        name: Create Item
        type: ATOMIC
        dependencies: [REQ-2.1]
        scenarios:
          - name: Create Item
            steps:
              - keyword: GIVEN
                content: The user is on the item list page.
              - keyword: WHEN
                content: The user activates the unique button named `New Item`, fills `Name` with `Item Created 2.3`, and activates the `Save Item` button.
              - keyword: THEN
                content: The system displays the item list with exactly one entry named `Item Created 2.3`.
      - id: REQ-2.4
        name: Create Item Again
        type: ATOMIC
        dependencies: [REQ-2.1]
        scenarios:
          - name: Create Item Again
            steps:
              - keyword: GIVEN
                content: The user is on the item list page.
              - keyword: WHEN
                content: The user activates the unique button named `New Item`, fills `Name` with `Item Created 2.3`, and activates the `Save Item` button.
              - keyword: THEN
                content: The system displays the item list with exactly one entry named `Item Created 2.3`.
      - id: REQ-2.5
        name: Browse
        type: ATOMIC
        dependencies: [REQ-2.1]
        scenarios:
          - name: Browse
            steps:
              - keyword: GIVEN
                content: The user is browsing items.
              - keyword: WHEN
                content: The user opens any item.
              - keyword: THEN
                content: The system shows it.
"""

SERVER = r"""'use strict';
const http = require('node:http'); const fs = require('node:fs'); const path = require('node:path');
const DIST = path.resolve(__dirname, '..', 'frontend', 'dist');
const DATA = path.join(__dirname, 'data', 'items.json');
const load = () => JSON.parse(fs.readFileSync(DATA, 'utf8'));
const json = (res, status, body) => { res.writeHead(status, {'content-type': 'application/json'}); res.end(JSON.stringify(body)); };
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://local');
  if (url.pathname === '/api/health') return json(res, 200, {code: 200, message: 'Backend Ready'});
  if (url.pathname === '/api/items' && req.method === 'GET') return json(res, 200, load());
  if (url.pathname === '/api/items' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => { const items = load(); items.push(JSON.parse(body)); fs.writeFileSync(DATA, JSON.stringify(items)); json(res, 201, {}); });
    return;
  }
  let file = path.join(DIST, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!file.startsWith(DIST) || !fs.existsSync(file)) file = path.join(DIST, 'index.html');
  res.writeHead(200, {'content-type': file.endsWith('.js') ? 'text/javascript' : 'text/html'});
  fs.createReadStream(file).pipe(res);
}).listen(Number(process.env.PORT) || 3000, '127.0.0.1');
"""

INDEX = """<!doctype html><html><head><meta charset="utf-8"><title>Demo</title></head><body>
<header><nav><a href="#/">Home</a> <a href="#/items">Items</a></nav></header><main id="app"></main>
<script src="app.js"></script></body></html>"""

APP = r"""'use strict';
const root = document.getElementById('app');
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const items = async () => (await fetch('/api/items')).json();
async function list() {
  const all = await items();
  return '<h1>Items</h1><button type="button" id="new">New Item</button><section aria-label="Item list">' +
    all.map(i => `<p><a href="#/items/${i.id}">${esc(i.name)}</a></p>`).join('') + '</section>';
}
async function details(id) {
  const item = (await items()).find(i => i.id === id);
  return `<h1>${esc(item ? item.name : 'Missing')}</h1>`;
}
const form = () => '<h1>New Item</h1><form aria-label="Create item form"><label for="n">Name</label><input id="n">' +
  '<button type="submit">Save Item</button></form>';
async function render() {
  const parts = (location.hash || '#/').slice(2).split('/');
  let html;
  if (parts[0] === 'items' && parts[1] === 'new') html = form();
  else if (parts[0] === 'items' && parts[1]) html = await DETAILS(parts[1]);
  else if (parts[0] === 'items') html = await list();
  else html = '<h1>Demo Home</h1>';
  root.innerHTML = html;
}
document.addEventListener('click', e => { if (e.target.id === 'new') location.hash = '#/items/new'; });
document.addEventListener('submit', async e => {
  e.preventDefault();
  await fetch('/api/items', {method: 'POST', body: JSON.stringify({id: 'i' + Date.now(), name: document.getElementById('n').value})});
  location.hash = '#/items';
});
window.addEventListener('hashchange', render);
render();
"""

# The broken variant routes details to the list and throws, like the observed routing and `this` failures.
BROKEN_DETAILS = "async id => { setTimeout(() => { throw new TypeError('this.details is not a function'); }); return list(); }"


def make_app(root, broken):
    (root / "backend" / "data").mkdir(parents=True)
    (root / "frontend" / "public").mkdir(parents=True)
    (root / "backend" / "server.js").write_text(SERVER)
    (root / "backend" / "package.json").write_text(json.dumps({"scripts": {"start": "node server.js"}}))
    (root / "backend" / "data" / "items.json").write_text(json.dumps([{"id": "i21", "name": "Item 2.1"},
                                                                     {"id": "i22", "name": "Item 2.2"}]))
    (root / "frontend" / "package.json").write_text(json.dumps({"scripts": {
        "build": "node -e \"require('fs').cpSync('public','dist',{recursive:true})\""}}))
    (root / "frontend" / "public" / "index.html").write_text(INDEX)
    (root / "frontend" / "public" / "app.js").write_text(
        APP.replace("DETAILS(", "(" + (BROKEN_DETAILS if broken else "details") + ")("))


def playwright_ready():
    node = shutil.which("node")
    if not node or not shutil.which("npm"):
        return False
    probe = ("const {chromium}=require('playwright');require('fs').accessSync(chromium.executablePath());")
    try:
        return subprocess.run([node, "-e", probe], capture_output=True, timeout=30).returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


@unittest.skipUnless(playwright_ready(), "Playwright with Chromium is not installed (set NODE_PATH and PLAYWRIGHT_BROWSERS_PATH)")
class ScenarioCheckEndToEnd(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = Path(tempfile.mkdtemp(prefix="scenario-e2e-"))
        (cls.temp / "requirements.yaml").write_text(REQUIREMENTS)
        cls.reports = {}
        for variant in ("good", "broken"):
            make_app(cls.temp / variant, variant == "broken")
            out = cls.temp / f"{variant}.json"
            with patch.dict(os.environ, {"SCENARIO_TRANSLATE": "0"}):  # rules only: no model fallback in this test
                cls.reports[variant] = scenario_check.run(cls.temp / "requirements.yaml", cls.temp / variant, out)
            cls.reports[variant + "-file"] = json.loads(out.read_text())

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.temp, ignore_errors=True)

    def status(self, variant):
        return {s["id"]: s["status"] for s in self.reports[variant]["scenarios"]}

    def test_correct_app_passes_and_each_scenario_starts_from_the_seed(self):
        self.assertEqual(self.status("good"), {"REQ-1.1": "pass", "REQ-2.1": "pass", "REQ-2.2": "pass",
                                               "REQ-2.3": "pass", "REQ-2.4": "pass", "REQ-2.5": "unparsed"})
        self.assertEqual(self.reports["good"]["coverage"], {"total": 6, "parsed": 5, "rules": 5, "model": 0})
        self.assertEqual(self.reports["good"]["translation"], {"status": "disabled"})
        self.assertEqual([i["status"] for i in self.reports["good"]["invariants"]], ["pass"] * len(self.reports["good"]["invariants"]))
        items = json.loads((self.temp / "good" / "backend" / "data" / "items.json").read_text())
        self.assertEqual(len(items), 2)  # the check never writes into the application it was given
        self.assertEqual(self.reports["good-file"]["scenarios"][0]["id"], "REQ-1.1")

    def test_broken_details_screen_fails_with_an_observation_naming_the_screen(self):
        status = self.status("broken")
        self.assertEqual(status["REQ-2.2"], "fail")
        self.assertEqual(status["REQ-2.1"], "pass")
        detail = next(s for s in self.reports["broken"]["scenarios"] if s["id"] == "REQ-2.2")
        for fragment in ("#/items/i22", "h1 `Items`", "heading named `Item 2.2`", "found 0"):
            self.assertIn(fragment, detail["observation"])
        kinds = {(i["kind"], i["status"]) for i in self.reports["broken"]["invariants"]}
        self.assertIn(("main-heading", "fail"), kinds)
        self.assertIn(("pageerror", "fail"), kinds)


    def test_a_recheck_runs_only_the_named_scenarios_from_the_text_and_stops_at_its_time_budget(self):
        # The repair loop passes the document itself, a subset of ids, and translate=False after a failed translation.
        text = (self.temp / "requirements.yaml").read_text()
        report = scenario_check.run(None, self.temp / "broken", text=text, only={"REQ-2.1", "REQ-2.2"}, translate=False)
        self.assertEqual({s["id"]: s["status"] for s in report["scenarios"]}, {"REQ-2.1": "pass", "REQ-2.2": "fail"})
        self.assertEqual(report["translation"], {"status": "disabled"})
        spent = scenario_check.run(None, self.temp / "good", text=text, only={"REQ-2.1"}, translate=False, seconds=1e-9)
        [scenario] = spent["scenarios"]
        self.assertEqual(scenario["status"], "error")
        self.assertTrue(scenario["observation"].startswith("Not run:"))

if __name__ == "__main__":
    unittest.main()
