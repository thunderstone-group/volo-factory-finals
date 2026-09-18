"""Delivery smoke check and bounded repair, exercised against REAL tiny Node servers.

All applications and model replies are local synthetic fixtures; no model is called.
"""
import contextlib
import io
import json
import os
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from oneshot import main as adapter
from test_oneshot import SYNTHETIC_KEY, SyntheticStream, block, events

NODE = shutil.which("node") and shutil.which("npm")

SERVER = """// Synthetic local fixture
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const DIST = path.join(__dirname, '..', 'frontend', 'dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css' };
%(prelude)s
process.on('uncaughtException', (e) => console.error('uncaught', e)); process.on('unhandledRejection', (e) => console.error('unhandled', e));
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(%(health)s));
  }
  const rel = url.pathname === '/' ? '%(root)s' : url.pathname;
  const file = path.join(DIST, rel);
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end('nope'); }
  res.writeHead(200, { 'Content-Type': %(ctype)s });
  res.end(fs.readFileSync(file));
}).listen(process.env.PORT, () => console.log('listening'));
"""


def server(root="index.html", health='{"code":200,"message":"Backend Ready"}',
           ctype="TYPES[path.extname(file)] || 'application/octet-stream'", prelude=""):
    return SERVER % {"root": root, "health": health, "ctype": ctype, "prelude": prelude}


def app(server_js):
    return (block("backend/package.json", '{"scripts":{"start":"node server.js"}}') +
            block("backend/server.js", server_js) +
            block("frontend/package.json",
                  '{"scripts":{"build":"node -e \\"require(\'fs\').cpSync(\'public\',\'dist\',{recursive:true})\\""}}') +
            block("frontend/public/index.html", "<!doctype html><title>Synthetic</title><h1>Synthetic</h1><script src=\"app.js\"></script>") +
            block("frontend/public/app.js", "console.log('synthetic');"))


@unittest.skipUnless(NODE, "node and npm are required for the smoke tests")
class SmokeCase(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.out = self.root / "app"
        self.enter(patch.object(adapter, "SCAFFOLD", False))
        self.transport = self.enter(patch.object(adapter, "_open_model",
                                                side_effect=AssertionError("unexpected HTTP")))
        self.enter(patch.object(adapter, "SMOKE_READY_SECONDS", 8))

    def enter(self, manager):
        value = manager.__enter__()
        self.addCleanup(manager.__exit__, None, None, None)
        return value

    def replies(self, *items):
        self.transport.side_effect = [SyntheticStream(x) for x in items]

    def generate(self, limit=adapter.MAX_CALLS):
        budget = adapter.CallBudget(limit)
        files, _ = adapter.generate("Synthetic requirements only", "synthetic-model",
                                   "https://synthetic.invalid/v1", SYNTHETIC_KEY, self.out, budget)
        return files, budget

    def test_good_application_passes_without_repair(self):
        self.replies(events(app(server())))
        files, budget = self.generate()
        self.assertEqual(self.transport.call_count, 1)
        self.assertEqual(budget.smoke, {"executed": True, "problems": [], "vocabulary_missing": 0, "repair": None})
        self.assertTrue((self.out / "backend/server.js").is_file())
        self.assertEqual(list(self.root.glob(".oneshot-*")), [])

    def test_root_404_is_repaired_and_repair_is_kept(self):
        self.replies(events(app(server(root="missing.html"))),
                     events(block("backend/server.js", server())))
        files, budget = self.generate()
        self.assertEqual(self.transport.call_count, 2)
        self.assertIn("GET / returned HTTP 404", budget.smoke["problems"][0])
        self.assertEqual(budget.smoke["repair"], {"accepted": True, "files": ["backend/server.js"], "vocabulary_missing_after": 0})
        self.assertIn("'index.html'", (self.out / "backend/server.js").read_text())
        delivered = {f["path"]: f["content"] for f in files}
        self.assertIn("'index.html'", delivered["backend/server.js"])
        self.assertEqual(len(files), 5)
        # The repair request carries the concrete failure, not the whole conversation again.
        messages = budget.attempts[1]["messages"]
        self.assertEqual(messages[-1]["role"], "user")
        self.assertIn("HTTP 404", messages[-1]["content"])
        self.assertEqual(messages[-2]["role"], "assistant")

    def test_wrong_content_type_and_bad_health_are_reported(self):
        self.replies(events(app(server(ctype="'application/octet-stream'"))))
        files, budget = self.generate(limit=1)
        self.assertEqual(self.transport.call_count, 1)
        self.assertTrue(any("text/html" in p for p in budget.smoke["problems"]), budget.smoke)
        self.assertEqual(budget.smoke["repair"], "skipped: call limit reached")
        self.transport.side_effect = [SyntheticStream(events(app(server(health='{"ok":true}'))))]
        self.out = self.root / "app2"
        files, budget = self.generate(limit=1)
        self.assertTrue(any("/api/health" in p for p in budget.smoke["problems"]), budget.smoke)

    def test_crashing_backend_with_failed_repair_keeps_original_delivery(self):
        broken = server(prelude="throw new Error('boom at startup');")
        self.replies(events(app(broken)), events(block("backend/server.js", broken)))
        files, budget = self.generate()
        self.assertEqual(self.transport.call_count, 2)
        self.assertIn("exited with code 1", budget.smoke["problems"][0])
        self.assertIn("boom at startup", budget.smoke["problems"][0])
        self.assertFalse(budget.smoke["repair"]["accepted"])
        self.assertIn("still failing", budget.smoke["repair"]["reason"])
        self.assertEqual((self.out / "backend/server.js").read_text(), broken.rstrip("\n") + "\n")
        self.assertTrue((self.out / "frontend/public/app.js").is_file())
        self.assertEqual(list(self.root.glob(".oneshot-*")), [])

    def test_repair_that_escapes_the_application_root_is_rejected(self):
        self.replies(events(app(server(root="missing.html"))),
                     events(block("../escape.js", "bad")))
        files, budget = self.generate()
        self.assertFalse(budget.smoke["repair"]["accepted"])
        self.assertFalse((self.root / "escape.js").exists())
        self.assertIn("'missing.html'", (self.out / "backend/server.js").read_text())

    def test_missing_asset_referenced_by_index_is_reported(self):
        missing_asset = app(server()).replace('<script src="app.js">', '<script src="vendor/lib.js">')
        self.replies(events(missing_asset))
        files, budget = self.generate(limit=1)
        self.assertTrue(any("vendor/lib.js" in p and "404" in p for p in budget.smoke["problems"]), budget.smoke)

    def test_without_node_the_check_is_skipped_not_failed(self):
        self.replies(events(app(server())))
        with patch.object(adapter.shutil, "which", return_value=None):
            files, budget = self.generate()
        self.assertEqual(budget.smoke, {"executed": False, "problems": [], "vocabulary_missing": 0, "repair": None})
        self.assertEqual(self.transport.call_count, 1)

    def test_frontend_that_throws_on_load_is_reported_when_jsdom_is_available(self):
        throwing = app(server()).replace(block("frontend/public/app.js", "console.log('synthetic');"),
                                         block("frontend/public/app.js", "document.body.appendChild(null);"))
        self.replies(events(throwing))
        files, budget = self.generate(limit=1)
        if not (Path(tempfile.gettempdir()) / "oneshot-jsdom" / "node_modules" / "jsdom").is_dir():
            self.skipTest("jsdom could not be installed (offline)")
        self.assertTrue(any("frontend script error on load" in p for p in budget.smoke["problems"]), budget.smoke)

    def test_frontend_that_fetches_its_data_on_load_is_not_a_script_error(self):
        # jsdom has no fetch; the probe must supply one that reaches the local backend (r14 StackOverflow
        # lost a whole task to "fetch is not defined" rejecting a good repair).
        fetching = (app(server())
                    .replace("<h1>Synthetic</h1>", "")
                    .replace(block("frontend/public/app.js", "console.log('synthetic');"),
                             block("frontend/public/app.js",
                                   "fetch('/api/health').then((r) => r.json()).then((d) => { document.body.textContent = d.message; });")))
        self.replies(events(fetching))
        files, budget = self.generate(limit=1)
        if not (Path(tempfile.gettempdir()) / "oneshot-jsdom" / "node_modules" / "jsdom").is_dir():
            self.skipTest("jsdom could not be installed (offline)")
        self.assertEqual(budget.smoke["problems"], [], budget.smoke)
        self.assertEqual(self.transport.call_count, 1)

    def test_click_handler_that_throws_is_reported_when_jsdom_is_available(self):
        throwing = app(server()).replace(
            block("frontend/public/app.js", "console.log('synthetic');"),
            block("frontend/public/app.js",
                  "document.body.insertAdjacentHTML('beforeend', '<button type=\"button\" data-action=\"add-to-cart\">Add to cart</button>');\n"
                  "document.addEventListener('click', (e) => { if (e.target.dataset.action === 'add-to-cart') { const p = undefined; p.id; } });"))
        self.replies(events(throwing))
        files, budget = self.generate(limit=1)
        if not (Path(tempfile.gettempdir()) / "oneshot-jsdom" / "node_modules" / "jsdom").is_dir():
            self.skipTest("jsdom could not be installed (offline)")
        flagged = [p for p in budget.smoke["problems"] if "throws" in p]
        self.assertEqual(len(flagged), 1, budget.smoke)
        self.assertIn("`Add to cart` (data-action `add-to-cart`)", flagged[0])
        self.assertIn("reading 'id'", flagged[0])

    def test_script_that_never_returns_is_reported_not_skipped(self):
        # Round 23 Prestashop: every test timed out at "Visit Homepage" while the gate stayed silent, because
        # the probe's own timeout returned without a problem. A page that never settles is the app's fault.
        spinning = app(server()).replace(block("frontend/public/app.js", "console.log('synthetic');"),
                                         block("frontend/public/app.js", "for (;;) {}"))
        self.replies(events(spinning))
        with patch.object(adapter, "DOM_PROBE_SECONDS", 4):
            files, budget = self.generate(limit=1)
        if not (Path(tempfile.gettempdir()) / "oneshot-jsdom" / "node_modules" / "jsdom").is_dir():
            self.skipTest("jsdom could not be installed (offline)")
        flagged = [p for p in budget.smoke["problems"] if "did not finish within 4 s" in p]
        self.assertEqual(len(flagged), 1, budget.smoke)

    def test_readonly_input_is_a_static_problem(self):
        picker = app(server()).replace(
            block("frontend/public/app.js", "console.log('synthetic');"),
            block("frontend/public/app.js", "document.body.innerHTML += '<label>出发城市 <input id=\"o\" readonly data-action=\"open-city\"></label>';"))
        self.replies(events(picker))
        files, budget = self.generate(limit=1)
        flagged = [p for p in budget.smoke["problems"] if "readonly" in p]
        self.assertEqual(len(flagged), 1, budget.smoke)
        self.assertIn("frontend/public/app.js:1", flagged[0])

    def test_home_screen_must_render_the_landmarks_the_requirement_describes(self):
        req = "The global header carries the navigation links and the login control. A footer closes every page."
        feed_only = app(server()).replace("<h1>Synthetic</h1>", "<h1>Top questions</h1>")
        laid_out = app(server()).replace(
            "<h1>Synthetic</h1>",
            "<header><nav><a href=\"#/\">Home</a></nav></header><main><h1>Top questions</h1></main><footer>Footer</footer>")
        self.replies(events(feed_only), events(laid_out))
        budget = adapter.CallBudget()
        adapter.generate(req, "synthetic-model", "https://synthetic.invalid/v1", SYNTHETIC_KEY, self.out, budget)
        if not (Path(tempfile.gettempdir()) / "oneshot-jsdom" / "node_modules" / "jsdom").is_dir():
            self.skipTest("jsdom could not be installed (offline)")
        flagged = [p for p in budget.smoke["problems"] if "renders no <" in p]
        self.assertEqual(len(flagged), 3, budget.smoke)
        self.assertTrue(all("shared layout" in p for p in flagged))
        self.assertTrue(budget.smoke["repair"]["accepted"], budget.smoke)
        self.assertIn("<header>", (self.out / "frontend/public/index.html").read_text())

    def test_scaffold_is_placed_shown_and_extended(self):
        # With the scaffold on, the model only writes seed.js and app.js; the delivered app keeps the
        # primitives, the prompt shows them, and the bare result passes every gate.
        req = "The global header carries the navigation links and the login control. A footer closes every page."
        reply = (block("frontend/public/seed.js", "window.SEED = { session: null, users: [], items: [] };") +
                 block("frontend/public/app.js",
                       "window.LAYOUT = { brand: 'T', nav: [{ label: 'Home', hash: '#/' }], footer: 'Footer', account: () => '' };\n"
                       "window.APP = { screen() { return '<h1>Home</h1>'; }, actions: {} };"))
        self.replies(events(reply))
        budget = adapter.CallBudget()
        with patch.object(adapter, "SCAFFOLD", True):
            adapter.generate(req, "synthetic-model", "https://synthetic.invalid/v1", SYNTHETIC_KEY, self.out, budget)
        self.assertTrue((self.out / "frontend/public/lib/arc.js").is_file())
        self.assertTrue((self.out / "backend/server.js").is_file())
        self.assertIn("window.SEED = { session: null", (self.out / "frontend/public/seed.js").read_text())
        prompt = budget.attempts[0]["messages"][1]["content"]
        self.assertIn("## Scaffold already in the application root", prompt)
        self.assertIn("frontend/public/lib/arc.js", prompt)
        self.assertEqual(self.transport.call_count, 1)
        if (Path(tempfile.gettempdir()) / "oneshot-jsdom" / "node_modules" / "jsdom").is_dir():
            self.assertEqual(budget.smoke["problems"], [], budget.smoke)

    def test_replacing_the_scaffold_shell_is_a_gate_problem(self):
        reply = (block("frontend/public/index.html", "<!doctype html><title>T</title><h1>T</h1><script src=\"app.js\"></script>") +
                 block("frontend/public/app.js", "document.body.append('x');"))
        self.replies(events(reply))
        budget = adapter.CallBudget(1)
        with patch.object(adapter, "SCAFFOLD", True):
            adapter.generate("req", "synthetic-model", "https://synthetic.invalid/v1", SYNTHETIC_KEY, self.out, budget)
        gaps = [p for p in budget.smoke["problems"] if "scaffold" in p]
        self.assertTrue(any("lib/arc.js" in p and "no longer loads" in p for p in gaps), budget.smoke)
        self.assertTrue(any("app.js no longer defines" in p for p in gaps), budget.smoke)

    def test_missing_quoted_vocabulary_is_reported_and_partial_repair_is_kept(self):
        req = 'After login replace the link with \u201cSign Out\u201d. Show \u201cEmail cannot be empty\u201d. Seed \u201cBook 5.1\u201d.'
        good = app(server()).replace("<h1>Synthetic</h1>", "<h1>Synthetic</h1><p>Book 5.1</p>")
        fixed = block("frontend/public/index.html",
                      "<!doctype html><title>Synthetic</title><h1>Synthetic</h1><p>Book 5.1</p><button>Sign Out</button><script src=\"app.js\"></script>")
        self.replies(events(good), events(fixed))
        budget = adapter.CallBudget()
        adapter.generate(req, "synthetic-model", "https://synthetic.invalid/v1", SYNTHETIC_KEY, self.out, budget)
        self.assertEqual(budget.smoke["vocabulary_missing"], 2)
        self.assertTrue(any("Sign Out" in p and "Email cannot be empty" in p for p in budget.smoke["problems"]), budget.smoke)
        self.assertTrue(budget.smoke["repair"]["accepted"], budget.smoke)
        self.assertEqual(budget.smoke["repair"]["vocabulary_missing_after"], 1)
        self.assertIn("Sign Out", (self.out / "frontend/public/index.html").read_text())

    def test_exact_name_gate_flags_decorated_quoted_names(self):
        stage = self.root / "stage"
        (stage / "frontend" / "public").mkdir(parents=True)
        req = 'Click the "Take a note" form. The sidebar shows "Notes" and "Reminders" entries. The snackbar shows exactly "Note trashed". Stats read "Asked" and "Viewed".'
        (stage / "frontend" / "public" / "app.js").write_text(
            "html += `<a href=\"#/\">\u2022 Notes</a><a href=\"#/r\">\U0001f514 Reminders</a>`;\n"
            "html += `<input placeholder=\"Take a note...\">`;\n"
            "html += `<div role=\"status\">Note trashed</div><span>Asked ' + when + '</span>`;\n")
        gaps = adapter.exact_name_gaps(stage, req)
        self.assertEqual(len(gaps), 1, gaps)
        self.assertIn("3 quoted control name(s)", gaps[0])
        for word in ("Take a note", "Notes", "Reminders"):
            self.assertIn(word, gaps[0])
        self.assertNotIn("Note trashed", gaps[0])
        self.assertNotIn("Asked", gaps[0])  # no control word near the quote: not a control name
        (stage / "frontend" / "public" / "app.js").write_text(
            "html += `<a href=\"#/\"><span aria-hidden=\"true\">\u2022</span>Notes</a><button aria-label=\"Reminders\">R</button>`;\n"
            "html += `<button type=\"button\">Take a note</button><div role=\"status\">Note trashed</div>`;\n")
        self.assertEqual(adapter.exact_name_gaps(stage, req), [])

    def test_static_gates_flag_missing_process_guards_and_aria_collisions(self):
        stage = self.root / "stage"
        (stage / "backend").mkdir(parents=True)
        (stage / "frontend" / "public").mkdir(parents=True)
        (stage / "backend" / "server.js").write_text("const http = require('http');\n")
        (stage / "frontend" / "public" / "app.js").write_text(
            "html += '<label for=\"qty\">Quantity</label><input id=\"qty\">';\n"
            "html += '<button aria-label=\"Decrease quantity\">-</button>';\n"
            "html += '<button aria-label=\"Close dialog\">x</button>';\n")
        guard = adapter.process_guard_gaps(stage)
        self.assertEqual(len(guard), 1)
        self.assertIn("uncaughtException", guard[0])
        aria = adapter.aria_collision_gaps(stage)
        self.assertEqual(len(aria), 1)
        self.assertIn("Decrease quantity", aria[0])
        self.assertNotIn("Close dialog", aria[0])
        (stage / "backend" / "server.js").write_text("process.on('uncaughtException', () => {}); process.on('unhandledRejection', () => {});\n")
        self.assertEqual(adapter.process_guard_gaps(stage), [])

    def test_cli_prints_smoke_summary_without_the_key(self):
        requirement = self.root / "requirements"
        requirement.mkdir()
        (requirement / "requirements.yaml").write_text("synthetic: true")
        self.replies(events(app(server())))
        capture = io.StringIO()
        env = {"OPENAI_API_KEY": SYNTHETIC_KEY, "PATH": os.environ.get("PATH", ""), "HOME": os.environ.get("HOME", "")}
        with patch.dict(os.environ, env, clear=True), \
                contextlib.redirect_stderr(capture), contextlib.redirect_stdout(io.StringIO()):
            code = adapter.main([str(requirement), "--output-dir", str(self.out)])
        self.assertEqual(code, 0)
        line = [l for l in capture.getvalue().splitlines() if l.startswith("[oneshot] smoke ")][0]
        self.assertEqual(json.loads(line.split(" ", 2)[2]), {"executed": True, "problems": [], "vocabulary_missing": 0, "repair": None})
        self.assertNotIn(SYNTHETIC_KEY, capture.getvalue())


if __name__ == "__main__":
    unittest.main()
