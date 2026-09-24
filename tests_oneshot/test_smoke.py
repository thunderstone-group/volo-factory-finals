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
BLANK = ["frontend script error on load (the page is blank for every test): this.flights is not a function"]

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
        self.enter(patch.object(adapter, "RETRY_WAIT", (0, 0)))  # the waits themselves are tested offline
        self.enter(patch.object(adapter, "TESTGEN", False))  # the written-test path has its own tests

    def enter(self, manager):
        value = manager.__enter__()
        self.addCleanup(manager.__exit__, None, None, None)
        return value

    def replies(self, *items):
        self.transport.side_effect = [SyntheticStream(x) for x in items]

    def generate(self, repairs=adapter.REPAIR_CALLS):
        budget = adapter.CallBudget(repair_limit=repairs)
        files, _ = adapter.generate("Synthetic requirements only", "synthetic-model",
                                   "https://synthetic.invalid/v1", SYNTHETIC_KEY, self.out, budget)
        return files, budget

    def scenarios(self, rules):
        """Stand in for the Chromium scenario check: `rules` maps a scenario id to a predicate over the staged
        frontend/public/app.js (true = the scenario passes). Returns the `only` argument of every check."""
        calls, self.translate_flags = [], []

        def check(stage, requirements, only=None, translate=True):
            calls.append(only)
            self.translate_flags.append(translate)
            text = (Path(stage) / "frontend/public/app.js").read_text(encoding="utf-8")
            verdicts = {sid: ok(text) for sid, ok in rules.items() if only is None or sid in only}
            return {"scenarios": [{"id": sid, "name": "Synthetic " + sid, "status": "pass" if passed else "fail",
                                   "observation": f"synthetic observation for {sid}",
                                   "steps": [{"text": f"activate `{sid}`", "result": "ok" if passed else "fail"}]}
                                  for sid, passed in verdicts.items()],
                    "invariants": [], "coverage": {"total": len(rules), "parsed": len(rules)},
                    "translation": {"status": "not_needed"}}
        self.enter(patch.object(adapter, "check_scenarios", side_effect=check))
        return calls

    def draft_js(self, draft_js, *repairs, server_js=None):
        """Replies: a synthetic app whose app.js is `draft_js`, then one repair per item of `repairs` (an app.js body,
        or a ready block string when it starts with the file marker)."""
        draft = app(server_js or server()).replace(block("frontend/public/app.js", "console.log('synthetic');"),
                                                   block("frontend/public/app.js", draft_js))
        self.replies(events(draft), *[events(r if r.startswith("=== FILE") else block("frontend/public/app.js", r))
                                      for r in repairs])

    def test_good_application_passes_without_repair(self):
        self.replies(events(app(server())))
        files, budget = self.generate()
        self.assertEqual(self.transport.call_count, 1)
        self.assertEqual(budget.smoke["problems"], [])
        self.assertIsNone(budget.smoke["repair"])
        self.assertNotIn("rounds", budget.smoke)
        self.assertEqual(budget.smoke["scenarios"]["counts"], {})  # the synthetic requirement has no scenario
        self.assertTrue((self.out / "backend/server.js").is_file())

    def test_interrupted_repair_retries_same_request_without_publishing_partial_files(self):
        partial = events(block('frontend/public/failed-version.js', 'discard me'), finish=None, done=False)
        partial.append(b'data: {"choices":[')  # Synthetic reduction of a connection reset mid-event.
        self.replies(events(app(server(health='{}')), {'prompt_tokens':10,'completion_tokens':20}),
                     partial, events(block('backend/server.js', server()), {'prompt_tokens':3,'completion_tokens':7}))
        files, budget = self.generate()
        self.assertEqual(self.transport.call_count, 3)
        self.assertEqual([a['status'] for a in budget.attempts], ['completed','failed','completed'])
        self.assertEqual(self.transport.call_args_list[1].args[0].data,
                         self.transport.call_args_list[2].args[0].data)
        self.assertTrue(budget.smoke['repair']['accepted'], budget.smoke)
        self.assertFalse((self.out / 'frontend/public/failed-version.js').exists())
        self.assertNotIn('frontend/public/failed-version.js', [f['path'] for f in files])
        self.assertEqual(budget.summary()['unknown_usage_calls'], [2])
        self.assertIsNone(budget.summary()['prompt_tokens'])
        self.assertEqual(budget.summary()['known_prompt_tokens'], 13)

    def test_a_cut_repair_is_rejected_whole_while_a_cut_draft_is_kept(self):
        # The draft breaks off inside app.js after four complete files: kept, and app.js comes from a continuation.
        # The repair breaks off after one complete block: never used, so the pre-repair application ships.
        blocks = app(server()).split("=== FILE: frontend/public/app.js ===")[0]
        self.replies(events(blocks + "=== FILE: frontend/public/app.js ===\nconsole.log('dra", finish=None, done=False),
                     events(block("frontend/public/app.js", "console.log('draft');")),
                     events(block("frontend/public/app.js", "console.log('repaired');"), finish=None, done=False))
        checks = []

        def check(stage, requirements=None, diagnostics=None):
            checks.append(stage)
            return (BLANK if len(checks) == 1 else []), True

        budget = adapter.CallBudget(repair_limit=1, fail_limit=2)
        with patch.object(adapter, "smoke_check", side_effect=check):
            files, _ = adapter.generate("Synthetic requirements only", "synthetic-model",
                                        "https://synthetic.invalid/v1", SYNTHETIC_KEY, self.out, budget)
        self.assertEqual([(a["phase"], a["status"]) for a in budget.attempts],
                         [("draft", "failed"), ("draft", "completed"), ("repair", "failed")])
        self.assertFalse(budget.smoke["repair"]["accepted"], budget.smoke)
        self.assertIn("model stream failed (StreamError)", budget.smoke["repair"]["reason"])
        self.assertIn("global model failure limit", budget.smoke["stopped"])
        self.assertEqual((self.out / "frontend/public/app.js").read_text(), "console.log('draft');\n")
        self.assertEqual(len(checks), 1)  # the cut repair never reached the recheck

    def test_repair_retry_stops_at_the_shared_failure_budget(self):
        self.replies(events(app(server(health='{}'))), [], events(block('backend/server.js', server())))
        budget = adapter.CallBudget(fail_limit=1)
        adapter.generate('Synthetic requirements only', 'synthetic-model',
                         'https://synthetic.invalid/v1', SYNTHETIC_KEY, self.out, budget)
        self.assertEqual(self.transport.call_count, 2)
        self.assertFalse(budget.smoke['repair']['accepted'])
        self.assertEqual(len(budget.failed()), 1)
        self.assertTrue(budget.exhausted())
        self.assertEqual(list(self.root.glob(".oneshot-*")), [])

    def test_root_404_is_repaired_and_repair_is_kept(self):
        self.replies(events(app(server(root="missing.html"))),
                     events(block("backend/server.js", server())))
        files, budget = self.generate()
        self.assertEqual(self.transport.call_count, 2)
        self.assertIn("GET / returned HTTP 404", budget.smoke["problems"][0])
        self.assertEqual(budget.smoke["repair"], {"accepted": True, "reason": "the application works again",
                                                  "files": ["backend/server.js"]})
        self.assertIn("'index.html'", (self.out / "backend/server.js").read_text())
        delivered = {f["path"]: f["content"] for f in files}
        self.assertIn("'index.html'", delivered["backend/server.js"])
        self.assertEqual(len(files), 5)
        # The repair request carries the concrete failure, not the whole conversation again.
        messages = budget.attempts[1]["messages"]
        self.assertEqual(messages[-1]["role"], "user")
        self.assertIn("HTTP 404", messages[-1]["content"])
        self.assertIn("broken as a whole", messages[-1]["content"])
        self.assertEqual(messages[-2]["role"], "assistant")

    def test_wrong_content_type_and_bad_health_are_reported(self):
        self.replies(events(app(server(ctype="'application/octet-stream'"))))
        files, budget = self.generate(repairs=0)
        self.assertEqual(self.transport.call_count, 1)
        self.assertTrue(any("text/html" in p for p in budget.smoke["problems"]), budget.smoke)
        self.assertEqual(budget.smoke["repair"], "skipped: repair call limit reached (0)")
        self.transport.side_effect = [SyntheticStream(events(app(server(health='{"ok":true}'))))]
        self.out = self.root / "app2"
        files, budget = self.generate(repairs=0)
        self.assertTrue(any("/api/health" in p for p in budget.smoke["problems"]), budget.smoke)

    def test_crashing_backend_with_failed_repair_keeps_original_delivery(self):
        broken = server(prelude="throw new Error('boom at startup');")
        self.replies(events(app(broken)), events(block("backend/server.js", broken)))
        files, budget = self.generate(repairs=1)
        self.assertEqual(self.transport.call_count, 2)
        self.assertIn("exited with code 1", budget.smoke["problems"][0])
        self.assertIn("boom at startup", budget.smoke["problems"][0])
        self.assertFalse(budget.smoke["repair"]["accepted"])
        self.assertIn("still broken as a whole", budget.smoke["repair"]["reason"])
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
        files, budget = self.generate(repairs=0)
        self.assertTrue(any("vendor/lib.js" in p and "404" in p for p in budget.smoke["problems"]), budget.smoke)

    def test_without_node_the_check_is_skipped_not_failed(self):
        self.replies(events(app(server())))
        with patch.object(adapter.shutil, "which", return_value=None):
            files, budget = self.generate()
        self.assertFalse(budget.smoke["executed"])
        self.assertEqual(budget.smoke["problems"], [])
        self.assertIsNone(budget.smoke["repair"])
        self.assertIsNone(budget.smoke["scenarios"])  # no node: no scenario check either
        self.assertEqual(self.transport.call_count, 1)

    def test_frontend_that_throws_on_load_is_reported_when_jsdom_is_available(self):
        throwing = app(server()).replace(block("frontend/public/app.js", "console.log('synthetic');"),
                                         block("frontend/public/app.js", "document.body.appendChild(null);"))
        self.replies(events(throwing))
        files, budget = self.generate(repairs=0)
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
        files, budget = self.generate(repairs=0)
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
        files, budget = self.generate(repairs=0)
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
            files, budget = self.generate(repairs=0)
        if not (Path(tempfile.gettempdir()) / "oneshot-jsdom" / "node_modules" / "jsdom").is_dir():
            self.skipTest("jsdom could not be installed (offline)")
        flagged = [p for p in budget.smoke["problems"] if "did not finish within 4 s" in p]
        self.assertEqual(len(flagged), 1, budget.smoke)

    def test_script_that_does_not_parse_is_reported_with_its_line_before_anything_is_served(self):
        # Round 23 Prestashop: a missing parenthesis on app.js:12; the DOM probe said only "Unexpected token ';'"
        # and the repair did not find the line. node --check names file and line and needs no jsdom.
        broken = app(server()).replace(block("frontend/public/app.js", "console.log('synthetic');"),
                                       block("frontend/public/app.js", "function f( { }\nconsole.log('x');"))
        self.replies(events(broken))
        with patch.object(adapter, "_check_dom", side_effect=AssertionError("the DOM probe must not run")):
            files, budget = self.generate(repairs=0)
        flagged = [p for p in budget.smoke["problems"] if "does not parse" in p]
        self.assertEqual(len(flagged), 1, budget.smoke)
        self.assertIn("frontend/public/app.js:2 does not parse (SyntaxError:", flagged[0])
        self.assertIn("`console.log('x');`", flagged[0])

    def test_repair_that_removes_a_whole_app_failure_is_kept_despite_a_remaining_click_error(self):
        broken = app(server()).replace(block("frontend/public/app.js", "console.log('synthetic');"),
                                       block("frontend/public/app.js", "function f( { }"))
        throwing_button = block("frontend/public/app.js",
                                "document.body.insertAdjacentHTML('beforeend', '<button type=\"button\" data-action=\"add-to-cart\">Add to cart</button>');\n"
                                "document.addEventListener('click', (e) => { if (e.target.dataset.action === 'add-to-cart') { const p = undefined; p.id; } });")
        self.replies(events(broken), events(throwing_button))
        files, budget = self.generate(repairs=1)
        if not (Path(tempfile.gettempdir()) / "oneshot-jsdom" / "node_modules" / "jsdom").is_dir():
            self.skipTest("jsdom could not be installed (offline)")
        self.assertEqual(budget.smoke["repair"]["accepted"], True, budget.smoke)
        delivered = next(f for f in files if f["path"] == "frontend/public/app.js")["content"]
        self.assertIn("add-to-cart", delivered)

    def test_family_level_and_static_problems_alone_do_not_trigger_a_repair(self):
        # Roadmap 4.3: only a whole-application failure or a failing requirement scenario asks for a repair. A throwing
        # click handler no scenario reaches, a readonly input or a missing quoted phrase are hints, never a call: a
        # healthy 12306 once spent a repair on one likely false positive.
        throwing = ("document.body.insertAdjacentHTML('beforeend', '<button type=\"button\" data-action=\"one\">one</button>"
                    "<label>City <input readonly></label>');\n"
                    "document.addEventListener('click', (e) => { if (e.target.dataset.action === 'one') { const p = undefined; p.id; } });")
        self.draft_js(throwing)
        budget = adapter.CallBudget()
        adapter.generate('Synthetic: show "Welcome aboard".', "synthetic-model", "https://synthetic.invalid/v1",
                         SYNTHETIC_KEY, self.out, budget)
        self.assertEqual(self.transport.call_count, 1)
        self.assertIsNone(budget.smoke["repair"])
        self.assertEqual(budget.smoke["vocabulary_missing"], 1)
        self.assertTrue(any("readonly" in p for p in budget.smoke["problems"]), budget.smoke)

    def test_a_scenario_that_fails_after_a_syntax_fix_gets_the_next_repair(self):
        broken = "function f( { }"
        partial = "document.body.insertAdjacentHTML('beforeend', '<button data-action=\"open\">Open</button>');"
        complete = partial + "\ndocument.body.dataset.opened = 'true';"
        self.draft_js(broken, partial, complete)
        calls = self.scenarios({"REQ-1": lambda t: "dataset.opened" in t, "REQ-2": lambda t: "Open" in t})
        files, budget = self.generate()
        self.assertEqual(self.transport.call_count, 3)
        rounds = budget.smoke["rounds"]
        self.assertEqual([(r["accepted"], r["reason"]) for r in rounds],
                         [(True, "the application works again"), (True, "1 more scenario(s) pass")])
        self.assertEqual(rounds[1]["failing"], ["REQ-1"])
        self.assertEqual(rounds[1]["gained"], ["REQ-1"])
        ask = budget.attempts[2]["messages"][-1]["content"]
        self.assertIn("REQ-1 Synthetic REQ-1", ask)
        self.assertIn("observed: synthetic observation for REQ-1", ask)
        self.assertIn("must keep passing: REQ-2", ask)
        self.assertNotIn("broken as a whole", ask)
        self.assertEqual(calls, [None, None, {"REQ-1"}])  # the dead draft's scenarios never ran; the gain is rechecked
        self.assertEqual(budget.smoke["scenarios_after"]["counts"], {"pass": 2})
        self.assertEqual(next(f for f in files if f["path"] == "frontend/public/app.js")["content"], complete + "\n")

    def test_regressing_followup_keeps_the_prior_accepted_application(self):
        partial = "document.body.insertAdjacentHTML('beforeend', '<button>Open</button>');"
        self.draft_js("function f( { }", partial, "function f( { }")
        self.scenarios({"REQ-1": lambda t: "dataset.opened" in t})
        files, budget = self.generate(repairs=2)
        self.assertEqual(self.transport.call_count, 3)
        self.assertEqual([r["accepted"] for r in budget.smoke["rounds"]], [True, False])
        self.assertIn("still broken as a whole", budget.smoke["rounds"][1]["reason"])
        self.assertIn("repair call limit reached (2)", budget.smoke["stopped"])
        self.assertEqual((self.out / "frontend/public/app.js").read_text(), partial + "\n")
        self.assertEqual(next(f for f in files if f["path"] == "frontend/public/app.js")["content"], partial + "\n")

    def test_readonly_input_is_a_static_problem(self):
        picker = app(server()).replace(
            block("frontend/public/app.js", "console.log('synthetic');"),
            block("frontend/public/app.js", "document.body.innerHTML += '<label>出发城市 <input id=\"o\" readonly data-action=\"open-city\"></label>';"))
        self.replies(events(picker))
        files, budget = self.generate(repairs=0)
        flagged = [p for p in budget.smoke["problems"] if "readonly" in p]
        self.assertEqual(len(flagged), 1, budget.smoke)
        self.assertIn("frontend/public/app.js:1", flagged[0])

    def test_home_screen_must_render_the_landmarks_the_requirement_describes(self):
        req = "The global header carries the navigation links and the login control. A footer closes every page."
        feed_only = app(server()).replace("<h1>Synthetic</h1>", "<h1>Top questions</h1>")
        self.replies(events(feed_only))
        budget = adapter.CallBudget()
        adapter.generate(req, "synthetic-model", "https://synthetic.invalid/v1", SYNTHETIC_KEY, self.out, budget)
        if not (Path(tempfile.gettempdir()) / "oneshot-jsdom" / "node_modules" / "jsdom").is_dir():
            self.skipTest("jsdom could not be installed (offline)")
        flagged = [p for p in budget.smoke["problems"] if "renders no <" in p]
        self.assertEqual(len(flagged), 3, budget.smoke)
        self.assertTrue(all("shared layout" in p for p in flagged))
        self.assertIsNone(budget.smoke["repair"])  # a hint: without a failing scenario it asks for nothing
        self.assertEqual(self.transport.call_count, 1)

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
        budget = adapter.CallBudget(repair_limit=0)
        with patch.object(adapter, "SCAFFOLD", True):
            adapter.generate("req", "synthetic-model", "https://synthetic.invalid/v1", SYNTHETIC_KEY, self.out, budget)
        gaps = [p for p in budget.smoke["problems"] if "scaffold" in p]
        self.assertTrue(any("lib/arc.js" in p and "no longer loads" in p for p in gaps), budget.smoke)
        self.assertTrue(any("app.js no longer defines" in p for p in gaps), budget.smoke)

    def test_quoted_vocabulary_gaps_ride_along_as_hints_of_a_scenario_repair(self):
        req = 'After login replace the link with \u201cSign Out\u201d. Show \u201cEmail cannot be empty\u201d. Seed \u201cBook 5.1\u201d.'
        self.draft_js("document.body.dataset.book = 'Book 5.1';",
                      "document.body.dataset.book = 'Book 5.1'; document.body.dataset.exit = 'Sign Out';")
        self.scenarios({"REQ-1": lambda t: "Sign Out" in t})
        budget = adapter.CallBudget()
        adapter.generate(req, "synthetic-model", "https://synthetic.invalid/v1", SYNTHETIC_KEY, self.out, budget)
        self.assertEqual(budget.smoke["vocabulary_missing"], 2)
        self.assertTrue(any("Sign Out" in p and "Email cannot be empty" in p for p in budget.smoke["problems"]), budget.smoke)
        ask = budget.attempts[1]["messages"][-1]["content"]
        self.assertIn("REQ-1", ask)
        self.assertIn("Other findings of the same check", ask)
        self.assertIn("Email cannot be empty", ask)
        self.assertTrue(budget.smoke["repair"]["accepted"], budget.smoke)
        self.assertIn("Sign Out", (self.out / "frontend/public/app.js").read_text())

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

    def test_template_expressions_are_not_accessible_label_collisions(self):
        # Reduced from the real Lite Keep Qwen draft: the old scan treated
        # ARC.esc in both interpolated attributes as a shared accessible name.
        stage = self.root / "dynamic-labels"
        public = stage / "frontend" / "public"
        public.mkdir(parents=True)
        source = public / "app.js"
        template = ('const html = `<button aria-label="${ARC.esc(L.brand || \'App\')}">Home</button>'
                    '<input placeholder="${ARC.esc(field.placeholder)}">`;\n')
        source.write_text(template)
        self.assertEqual(adapter.aria_collision_gaps(stage), [])
        source.write_text(template + '<label>Quantity<input></label>'
                          '<button aria-label="Decrease quantity">-</button>')
        [problem] = adapter.aria_collision_gaps(stage)
        self.assertIn("Decrease quantity", problem)
        self.assertNotIn("ARC.esc", problem)

    def test_nested_label_advice_keeps_the_quoted_name_and_renames_the_other(self):
        stage = self.root / "stage2"
        (stage / "frontend" / "public").mkdir(parents=True)
        (stage / "frontend" / "public" / "app.js").write_text(
            "html += '<input placeholder=\"From\"><label>From Station <select></select></label>';\n"
            "html += '<label>Date <input></label><label>End date <input></label>';\n")
        req = 'input placeholders "From", "To", and "Date". Later a filter labeled "End date".'
        [problem] = adapter.aria_collision_gaps(stage, req)
        self.assertIn('keep "From" exactly (quoted in the requirement) and rename "From Station"', problem)
        self.assertNotIn('"Date" is contained in "End date"', problem)  # both quoted: not a rename problem
        [generic] = adapter.aria_collision_gaps(stage)
        self.assertIn('"Date" is contained in "End date"', generic)

    def test_a_form_after_a_button_is_not_a_button_label_collision(self):
        # Reduced from the real v4 BookStack draft. The preceding button used
        # to make the scanner misclassify this required named form.
        stage = self.root / "form-label"
        public = stage / "frontend" / "public"
        public.mkdir(parents=True)
        (public / "app.js").write_text(
            '<button>New Book</button><form aria-label="Create book form">'
            '<label>Book description<input></label></form>')
        self.assertEqual(adapter.aria_collision_gaps(stage), [])

    def test_backtick_control_names_are_not_renamed_by_collision_advice(self):
        stage = self.root / "backtick-label"
        public = stage / "frontend" / "public"
        public.mkdir(parents=True)
        (public / "app.js").write_text(
            '<label>Tags<input></label><button aria-label="Book Tags">Tags</button>')
        self.assertTrue(adapter.aria_collision_gaps(stage))
        self.assertEqual(adapter.aria_collision_gaps(stage, 'A button named `Book Tags`.'), [])

    def test_quoted_button_names_are_not_collision_problems_and_only_control_phrases_are_pinned(self):
        stage = self.root / "stage3"
        (stage / "frontend" / "public").mkdir(parents=True)
        (stage / "frontend" / "public" / "app.js").write_text(
            "html += '<label>Email address <input></label>';\n"
            "html += '<button aria-label=\"Contact information\">Edit</button><button aria-label=\"Address book\">Open</button>';\n"
            "html += '<p>Please enter a new email address.</p>';\n")
        req = ('Click the "Contact information" button. Fill the "Email address" field. '
               'On error show "Please enter a new email address."')
        [problem] = adapter.aria_collision_gaps(stage, req)
        self.assertIn('"Address book"', problem)
        self.assertNotIn('"Contact information"', problem)
        pinned = adapter.control_names(stage) & {p.lower() for p in adapter.quoted_control_phrases(req)}
        self.assertEqual(pinned, {"contact information", "email address"})

    def test_repair_that_renames_a_quoted_control_is_rejected(self):
        # 12306 r25a: the collision repair renamed the quoted "From" to "Origin city"; 45 tests then waited for
        # getByLabel(/From/i). The word survived elsewhere, so only a control-name check sees it. The scenario the
        # repair was asked for passes, and the repair is still discarded.
        draft_js = "document.body.innerHTML += '<label>From <input id=\"f\"></label><label>From Station <select id=\"s\"></select></label>';"
        repaired_js = "document.body.innerHTML += '<label>Origin city <input id=\"f\"></label><label>From Station <select id=\"s2\"></select></label>';"
        self.draft_js(draft_js, repaired_js)
        self.scenarios({"REQ-1": lambda t: "s2" in t})
        budget = adapter.CallBudget(repair_limit=1)
        files, _ = adapter.generate('Synthetic: the departure field labeled "From" and a From Station filter.',
                                    "synthetic-model", "https://synthetic.invalid/v1", SYNTHETIC_KEY, self.out, budget)
        self.assertEqual(budget.smoke["repair"]["accepted"], False, budget.smoke)
        self.assertIn("renamed quoted control(s): from", budget.smoke["repair"]["reason"])
        self.assertEqual(budget.smoke["rounds"][0]["gained"], ["REQ-1"])
        self.assertIn("From <input", next(f for f in files if f["path"] == "frontend/public/app.js")["content"])

    def test_rendered_control_name_survives_a_move_from_html_to_menu_data(self):
        before_js = "document.body.innerHTML='<button>Choose fields</button>';"
        after_js = "const item={label:'Choose fields',action:'choose'};document.body.innerHTML='<button>'+item.label+'</button>';"
        self.draft_js(before_js, after_js)
        self.scenarios({"REQ-1": lambda t: "item.label" in t})
        checks = []

        def check(stage, requirements=None, diagnostics=None):
            checks.append(stage)
            if diagnostics is not None:
                diagnostics.append({'executed': True, 'actions': [
                    {'name': 'Choose fields', 'action': 'choose', 'scope': 'dialog-popover'}]})
            return [], True

        budget = adapter.CallBudget()
        with patch.object(adapter, 'smoke_check', side_effect=check):
            adapter.generate('Synthetic: the button named "Choose fields" must remain available.',
                             'synthetic-model', 'https://synthetic.invalid/v1', SYNTHETIC_KEY,
                             self.out, budget)
        self.assertNotIn('choose fields', adapter.control_names(self.out))
        self.assertTrue(budget.smoke['repair']['accepted'], budget.smoke)

    def test_unexecuted_control_observation_does_not_waive_name_preservation(self):
        before_js = "document.body.innerHTML='<button>Choose fields</button>';"
        after_js = "const item={label:'Choose fields'};document.body.innerHTML='<button>Other action</button>';"
        self.draft_js(before_js, after_js)
        self.scenarios({"REQ-1": lambda t: "Other action" in t})
        checks = []

        def check(stage, requirements=None, diagnostics=None):
            checks.append(stage)
            if diagnostics is not None:
                diagnostics.append({'executed': True, 'actions': [
                    {'name': 'Choose fields', 'observation': 'Synthetic click did not complete'}]})
            return [], True

        budget = adapter.CallBudget(repair_limit=1)
        with patch.object(adapter, 'smoke_check', side_effect=check):
            adapter.generate('Synthetic: the button named "Choose fields" must remain available.',
                             'synthetic-model', 'https://synthetic.invalid/v1', SYNTHETIC_KEY,
                             self.out, budget)
        self.assertFalse(budget.smoke['repair']['accepted'], budget.smoke)
        self.assertIn('the change renamed quoted control(s)', budget.smoke['repair']['reason'])

    def repair_with_smoke(self, requirements, draft_js, repaired_js, before, after, browser=(), out=None, rules=None):
        """One synthetic draft and repair; the smoke check reports `before` on the draft and `after` on the repair,
        and adds browser[0] / browser[1] to the browser diagnostics of the first / second check. `rules` stands in
        for the scenario check (see scenarios())."""
        draft = app(server()).replace(block('frontend/public/app.js', "console.log('synthetic');"),
                                      block('frontend/public/app.js', draft_js))
        self.replies(events(draft), events(block('frontend/public/app.js', repaired_js)))
        checks = []

        def check(stage, requirements=None, diagnostics=None):
            checks.append(stage)
            if len(browser) >= len(checks) and diagnostics is not None:
                diagnostics.append(browser[len(checks) - 1])
            return (before if len(checks) == 1 else after), True

        budget = adapter.CallBudget(repair_limit=1)
        with patch.object(adapter, 'smoke_check', side_effect=check):
            adapter.generate(requirements, 'synthetic-model', 'https://synthetic.invalid/v1', SYNTHETIC_KEY,
                             out or self.out, budget)
        return budget

    def test_a_revived_application_is_kept_although_it_loses_quoted_vocabulary(self):
        # The rename waiver extended: one lost quoted phrase costs a family of tests, a blank page all of them.
        self.scenarios({"REQ-1": lambda t: "Welcome" in t})
        args = ('Synthetic: the welcome text reads "Have a nice trip".',
                "document.body.innerHTML='<p>Have a nice trip</p>'; this.flights();",
                "document.body.innerHTML='<p>Welcome</p>';")
        budget = self.repair_with_smoke(*args, BLANK, [])
        self.assertTrue(budget.smoke['repair']['accepted'], budget.smoke)
        self.assertEqual(budget.smoke['repair']['waived'], ['the change removed quoted vocabulary (0 -> 1 missing)'])
        # Unchanged when nothing whole-app was fixed: the guard rejects a repair that makes a scenario pass.
        budget = self.repair_with_smoke(*args, [], [], out=self.root / 'guarded')
        self.assertFalse(budget.smoke['repair']['accepted'], budget.smoke)
        self.assertEqual(budget.smoke['rounds'][0]['gained'], ['REQ-1'])
        self.assertIn('the change removed quoted vocabulary (0 -> 1 missing)', budget.smoke['repair']['reason'])

    def test_a_revived_application_is_kept_although_the_scenario_recheck_could_not_run(self):
        reports = []

        def check(stage, requirements, only=None, translate=True):
            reports.append(stage)
            if len(reports) == 1 and "Home" in (Path(stage) / "frontend/public/app.js").read_text() and self.first:
                return {"scenarios": [{"id": "REQ-1", "status": "fail", "observation": "synthetic", "steps": []}],
                        "invariants": [], "translation": {"status": "not_needed"}}
            return {"unavailable": "RuntimeError: synthetic executor crash", "scenarios": [], "invariants": []}
        self.enter(patch.object(adapter, "check_scenarios", side_effect=check))
        args = ('Synthetic requirements only', "document.body.innerHTML='<p>Home</p>'; this.flights();",
                "document.body.innerHTML='<p>Home</p>';")
        self.first = False  # a dead draft: its scenarios never run, and the revival stands without a recheck
        budget = self.repair_with_smoke(*args, BLANK, [])
        self.assertTrue(budget.smoke['repair']['accepted'], budget.smoke)
        self.assertEqual(budget.smoke['scenarios_after'], {"unavailable": "RuntimeError: synthetic executor crash"})
        reports.clear()
        self.first = True  # a live draft with a failing scenario: an unavailable recheck cannot accept anything
        budget = self.repair_with_smoke(*args, [], [], out=self.root / 'guarded')
        self.assertFalse(budget.smoke['repair']['accepted'], budget.smoke)
        self.assertIn('the scenario recheck could not run: RuntimeError: synthetic executor crash',
                      budget.smoke['repair']['reason'])

    def test_a_repair_that_revives_a_dead_application_is_kept_although_it_renames_a_quoted_control(self):
        # Reduced from 09-19 Ctrip: the repair cured a blank page and left one family-level problem, then the rename
        # veto rejected it and the blank page shipped (0/125). A revived application beats a kept name.
        budget = self.repair_with_smoke(
            'Synthetic: the button named "Add return trip" opens the return date.',
            "document.body.innerHTML='<button>Add return trip</button>'; this.flights();",
            "document.body.innerHTML='<p>Add return trip</p><button>Return trip</button>';",
            BLANK, ['clicking `Return trip` on screen `#/` throws: synthetic'])
        self.assertTrue(budget.smoke['repair']['accepted'], budget.smoke)
        self.assertEqual(budget.smoke['repair']['renamed_controls'], ['add return trip'])
        self.assertEqual(budget.smoke['repair']['waived'], ['the change renamed quoted control(s): add return trip'])
        self.assertIn('<button>Return trip</button>', (self.out / 'frontend/public/app.js').read_text())

    def test_removing_a_decoration_from_a_quoted_name_is_not_a_rename(self):
        # The exact-name gate asks for `+ Add return` to become `Add return`; the veto used to call that a rename
        # when the requirement quoted both spellings. No whole-app failure here: a scenario asks for the repair.
        self.scenarios({"REQ-1": lambda t: "Return date" in t})
        budget = self.repair_with_smoke(
            'Synthetic: the "Add return" entry. Click the "+ Add return" button, then fill "Return date".',
            "document.body.innerHTML='<button>+ Add return</button>';",
            "document.body.innerHTML='<button>Add return</button><label>Return date <input></label>';",
            [], [])
        self.assertTrue(budget.smoke['repair']['accepted'], budget.smoke)
        self.assertNotIn('renamed_controls', budget.smoke['repair'])
        self.assertEqual(adapter._bare_name('  • Add   return → '), 'add return')


    # ------------------------------------------------------------------ scenario-driven repair (roadmap 4.3)

    def test_a_repair_that_breaks_a_passing_scenario_is_discarded_and_the_next_request_says_why(self):
        self.draft_js("const one = 1;", "const two = 2;", "const one = 1; const two = 2;")
        calls = self.scenarios({"REQ-1": lambda t: "one" in t, "REQ-2": lambda t: "two" in t})
        files, budget = self.generate()
        self.assertEqual(self.transport.call_count, 3)
        first, second = budget.smoke["rounds"]
        self.assertFalse(first["accepted"])
        self.assertEqual(first["lost"], ["REQ-1"])
        self.assertIn("the change broke 1 passing scenario(s): REQ-1, and fixed only 1", first["reason"])
        self.assertTrue(second["accepted"], second)
        # The lost scenario and a gain of at most two are rechecked once, in each round.
        self.assertEqual(calls, [None, None, {"REQ-1", "REQ-2"}, None, {"REQ-2"}])
        ask = budget.attempts[2]["messages"][-1]["content"]
        self.assertIn("Your previous change was discarded", ask)
        self.assertIn("the change broke 1 passing scenario(s): REQ-1", ask)
        # The discarded reply never enters the conversation: the model sees the files as they are.
        self.assertEqual(len(budget.attempts[2]["messages"]), len(budget.attempts[1]["messages"]))
        self.assertEqual((self.out / "frontend/public/app.js").read_text(), "const one = 1; const two = 2;\n")

    def test_a_repair_that_gains_three_scenarios_per_lost_one_is_kept(self):
        # Reduced from the official v24 router fix: 9 -> 28 passing scenarios, two lost that the broken router passed
        # by accident. The lost one is then a failing scenario of the next round.
        self.draft_js("const zero = 0;", "const a = 1; const b = 2; const c = 3;", "const a = 1; const b = 2; const c = 3; const zero = 0;")
        self.scenarios({"REQ-0": lambda t: "zero" in t, "REQ-A": lambda t: "a = 1" in t,
                        "REQ-B": lambda t: "b = 2" in t, "REQ-C": lambda t: "c = 3" in t})
        files, budget = self.generate()
        first, second = budget.smoke["rounds"]
        self.assertTrue(first["accepted"], first)
        self.assertEqual((first["gained"], first["lost"]), (["REQ-A", "REQ-B", "REQ-C"], ["REQ-0"]))
        self.assertEqual(first["reason"], "3 more scenario(s) pass, 1 lost")
        self.assertEqual(second["failing"], ["REQ-0"])
        self.assertTrue(second["accepted"], second)
        self.assertEqual(budget.smoke["scenarios_after"]["counts"], {"pass": 4})

    def test_a_lost_scenario_that_passes_on_the_recheck_does_not_block_the_repair(self):
        self.draft_js("const one = 1;", "const one = 1; const two = 2;")
        full_checks = []

        def check(stage, requirements, only=None, translate=True):
            text = (Path(stage) / "frontend/public/app.js").read_text()
            if only is None:
                full_checks.append(text)
            flaky = only is None and len(full_checks) == 2  # REQ-1 times out once, right after the repair
            verdicts = {"REQ-1": "one" in text and not flaky, "REQ-2": "two" in text}
            return {"scenarios": [{"id": sid, "status": "pass" if ok else "fail", "observation": "synthetic", "steps": []}
                                  for sid, ok in verdicts.items() if only is None or sid in only],
                    "invariants": [], "translation": {"status": "not_needed"}}
        self.enter(patch.object(adapter, "check_scenarios", side_effect=check))
        files, budget = self.generate()
        [only] = budget.smoke["rounds"]
        self.assertTrue(only["accepted"], only)
        self.assertEqual(only["flaky"], ["REQ-1"])
        self.assertEqual(only["gained"], ["REQ-2"])
        self.assertEqual(budget.smoke["scenarios_after"]["counts"], {"pass": 2})

    def test_a_repair_that_makes_a_clean_static_gate_flag_is_discarded(self):
        unguarded = server().replace("process.on('uncaughtException', (e) => console.error('uncaught', e)); "
                                     "process.on('unhandledRejection', (e) => console.error('unhandled', e));\n", "")
        self.assertNotIn("uncaughtException", unguarded)
        self.draft_js("const one = 1;", block("backend/server.js", unguarded) + block("frontend/public/app.js", "const two = 2;"))
        self.scenarios({"REQ-1": lambda t: "two" in t})
        files, budget = self.generate(repairs=1)
        [only] = budget.smoke["rounds"]
        self.assertFalse(only["accepted"])
        self.assertEqual(only["gained"], ["REQ-1"])
        self.assertIn("a static gate that was clean now flags: backend registers no process.on", only["reason"])
        self.assertIn("uncaughtException", (self.out / "backend/server.js").read_text())

    def test_the_spend_limit_stops_the_repairs(self):
        draft = app(server()).replace(block("frontend/public/app.js", "console.log('synthetic');"),
                                      block("frontend/public/app.js", "const zero = 0;"))
        big = {"prompt_tokens": 100000, "completion_tokens": 20000}  # an unknown model is priced like the dearest
        self.replies(events(draft), events(block("frontend/public/app.js", "const one = 1;"), big))
        self.scenarios({"REQ-1": lambda t: "one" in t, "REQ-2": lambda t: "two" in t})
        budget = adapter.CallBudget(repair_cny=2.0)
        adapter.generate("Synthetic requirements only", "synthetic-model", "https://synthetic.invalid/v1",
                         SYNTHETIC_KEY, self.out, budget)
        self.assertEqual(self.transport.call_count, 2)
        self.assertTrue(budget.smoke["rounds"][0]["accepted"])
        self.assertAlmostEqual(budget.smoke["rounds"][0]["cost_cny"], 100000 * 13 / 1e6 + 20000 * 54 / 1e6)
        # The limit is checked before each call against an estimate; this reply was far longer than estimated.
        self.assertIn("repair spend limit reached (CNY 2.38 spent, the next call is estimated at", budget.smoke["stopped"])
        self.assertAlmostEqual(budget.summary()["estimated_repair_cost_cny"], 2.38)

    def test_three_discarded_repairs_in_a_row_end_the_loop(self):
        self.draft_js("const zero = 0;", "const a = 1;", "const b = 2;", "const c = 3;")
        self.scenarios({"REQ-1": lambda t: "fixed" in t})
        files, budget = self.generate()
        self.assertEqual(self.transport.call_count, 4)
        self.assertEqual([r["accepted"] for r in budget.smoke["rounds"]], [False, False, False])
        self.assertTrue(all(r["reason"] == "no failing scenario passes after the change" for r in budget.smoke["rounds"]))
        self.assertEqual(budget.smoke["stopped"], "3 repairs in a row were discarded")
        # The next request says what the discarded change left failing, as the check observed it.
        self.assertIn("after it REQ-1 still failed: synthetic observation for REQ-1",
                      budget.attempts[2]["messages"][-1]["content"])
        self.assertEqual((self.out / "frontend/public/app.js").read_text(), "const zero = 0;\n")

    def test_a_scenario_that_did_not_fail_before_is_no_gain(self):
        # Review E2: only a verdict both checks reached compares. An errored or unparsed scenario that passes after the
        # repair is not the repair's work.
        states = iter([{"REQ-1": "fail", "REQ-2": "error", "REQ-3": "unparsed"},
                       {"REQ-1": "fail", "REQ-2": "pass", "REQ-3": "pass"}])

        def check(stage, requirements, only=None, translate=True):
            verdicts = next(states) if only is None else {}
            return {"scenarios": [{"id": sid, "status": st, "observation": "synthetic", "steps": []}
                                  for sid, st in verdicts.items()], "invariants": [], "translation": {"status": "cached"}}
        self.enter(patch.object(adapter, "check_scenarios", side_effect=check))
        self.draft_js("const zero = 0;", "const zero = 0; // same")
        files, budget = self.generate(repairs=1)
        [only] = budget.smoke["rounds"]
        self.assertFalse(only["accepted"])
        self.assertEqual((only["gained"], only["reason"]), ([], "no failing scenario passes after the change"))

    def test_a_gain_the_recheck_does_not_confirm_is_no_gain(self):
        seen = []

        def check(stage, requirements, only=None, translate=True):
            seen.append(only)
            passing = only is None and len(seen) == 2  # passes once, right after the repair, then fails again
            return {"scenarios": [{"id": "REQ-1", "status": "pass" if passing else "fail", "observation": "synthetic",
                                   "steps": []}], "invariants": [], "translation": {"status": "cached"}}
        self.enter(patch.object(adapter, "check_scenarios", side_effect=check))
        self.draft_js("const zero = 0;", "const one = 1;")
        files, budget = self.generate(repairs=1)
        [only] = budget.smoke["rounds"]
        self.assertFalse(only["accepted"])
        self.assertEqual(only["unconfirmed"], ["REQ-1"])
        self.assertEqual((self.out / "frontend/public/app.js").read_text(), "const zero = 0;\n")

    def test_a_failed_translation_is_not_retried_within_the_loop(self):
        flags, reports = [], iter([{"status": "failed", "error": "synthetic cut"}, {"status": "disabled"}])

        def check(stage, requirements, only=None, translate=True):
            flags.append(translate)
            text = (Path(stage) / "frontend/public/app.js").read_text()
            verdict = "pass" if "one" in text else "fail"
            translation = next(reports) if only is None else {"status": "disabled"}
            return {"scenarios": [{"id": "REQ-1", "status": verdict, "observation": "synthetic", "steps": []}],
                    "invariants": [], "translation": translation}
        self.enter(patch.object(adapter, "check_scenarios", side_effect=check))
        self.draft_js("const zero = 0;", "const one = 1;")
        files, budget = self.generate()
        self.assertEqual(flags, [True, False, False])  # first check, repair check, recheck of the single gain
        self.assertTrue(budget.smoke["rounds"][0]["accepted"])
        [call] = budget.side_calls
        self.assertEqual((call["call"], call["status"]), ("scenario-translation", "failed"))

    def test_a_recheck_that_cannot_run_is_the_checkers_failure_not_the_models(self):
        seen = []

        def check(stage, requirements, only=None, translate=True):
            seen.append(only)
            if len(seen) == 1:
                return {"scenarios": [{"id": "REQ-1", "status": "fail", "observation": "synthetic", "steps": []}],
                        "invariants": [], "translation": {"status": "cached"}}
            return {"scenarios": [{"id": "REQ-1", "status": "error", "steps": [],
                                   "observation": "Chromium is unavailable (browser): synthetic"}],
                    "invariants": [], "translation": {"status": "cached"}}
        self.enter(patch.object(adapter, "check_scenarios", side_effect=check))
        self.draft_js("const zero = 0;", "const one = 1;", "const two = 2;")
        files, budget = self.generate(repairs=2)
        first, second = budget.smoke["rounds"]
        self.assertTrue(first["checker"])
        self.assertIn("the scenario recheck could not run: Chromium is unavailable", first["reason"])
        self.assertEqual(seen[:3], [None, None, None])  # the recheck is tried once more before judging
        ask = budget.attempts[2]["messages"][-1]["content"]
        self.assertNotIn("previous change was discarded", ask)  # the model is not blamed for the checker

    def test_a_load_failure_only_jsdom_reports_is_a_hint_when_chromium_renders_the_app(self):
        # Review E5: ResizeObserver and canvas exist in Chromium, not in jsdom.
        gap = "frontend script error on load (the page is blank for every test): ResizeObserver is not defined"
        self.scenarios({"REQ-1": lambda t: True})
        self.replies(events(app(server())))
        with patch.object(adapter, "smoke_check", return_value=([gap], True)):
            files, budget = self.generate()
        self.assertEqual(self.transport.call_count, 1)
        self.assertIsNone(budget.smoke["repair"])
        self.assertEqual(budget.smoke["jsdom_only"], [gap])
        self.assertEqual(budget.smoke["scenarios"]["counts"], {"pass": 1})
        # When Chromium passes nothing either, the application is broken as a whole.
        self.out = self.root / "dead"
        self.scenarios({"REQ-1": lambda t: False})
        self.replies(events(app(server())), events(block("frontend/public/app.js", "console.log('fixed');")))
        with patch.object(adapter, "smoke_check", side_effect=[([gap], True), ([], True)]):
            files, budget = self.generate(repairs=1)
        self.assertIn("broken as a whole", budget.attempts[1]["messages"][-1]["content"])
        self.assertTrue(budget.smoke["rounds"][0]["accepted"])

    def test_the_restore_swaps_by_rename_and_survives_a_failed_rename(self):
        stage, backup = self.root / "stage", self.root / "backup"
        for where, text in ((stage, "repaired"), (backup, "original")):
            (where / "frontend").mkdir(parents=True)
            (where / "frontend" / "app.js").write_text(text)
        adapter._swap_back(stage, backup)
        self.assertEqual((stage / "frontend" / "app.js").read_text(), "original")
        self.assertFalse(backup.exists())
        (backup / "frontend").mkdir(parents=True)
        (backup / "frontend" / "app.js").write_text("second")
        real = Path.rename

        def flaky(path, target):
            if path == backup:
                raise OSError("synthetic: no space left on device")
            return real(path, target)
        with patch.object(Path, "rename", flaky), self.assertRaises(OSError):
            adapter._swap_back(stage, backup)
        self.assertEqual((stage / "frontend" / "app.js").read_text(), "original")  # never neither

    def test_a_call_refused_before_any_byte_costs_nothing(self):
        refused = {"model": "kimi-k2.7-code-highspeed", "usage": {}, "messages": [{"role": "user", "content": "x" * 90000}],
                   "stream_observation": {"received_bytes": 0, "content_chars": 0, "reasoning_chars": 0}}
        self.assertEqual(adapter.call_cost(refused), 0.0)
        self.assertAlmostEqual(adapter.estimate_cost([{"role": "user", "content": "x" * 30000}], "deepseek-v4-flash", 8000),
                               (10000 * 3.0 + 8000 * 9.0) / 1e6)

    def test_the_scenario_translation_call_is_on_the_ledger(self):
        cache = self.root / "translation.json"
        cache.write_text(json.dumps({"messages": [{"role": "user", "content": "translate"}], "content": "[]",
                                     "finish_reason": "stop"}))
        budget = adapter.CallBudget()
        report = {"translation": {"status": "called", "model": "deepseek-v4-flash", "cost_cny": 0.16, "seconds": 90.0,
                                  "usage": {"prompt_tokens": 11255, "completion_tokens": 14307}, "cache": str(cache)}}
        adapter.account_translation(budget, report)
        adapter.account_translation(budget, {"translation": {"status": "cached", "cost_cny": 0.0}})
        [call] = budget.side_calls
        self.assertEqual((call["call"], call["status"], call["content"]), ("scenario-translation", "completed", "[]"))
        self.assertEqual(call["messages"], [{"role": "user", "content": "translate"}])
        self.assertAlmostEqual(budget.spent("repair"), 0.16)
        self.assertAlmostEqual(budget.spent("draft"), 0.0)

    def test_call_cost_reads_cache_hits_and_estimates_a_cut_stream(self):
        completed = {"model": "deepseek-v4-flash", "usage": {"prompt_tokens": 30000, "completion_tokens": 10000},
                     "usage_events": [{"prompt_tokens": 30000, "completion_tokens": 10000,
                                       "prompt_tokens_details": {"cached_tokens": 20000}}]}
        self.assertAlmostEqual(adapter.call_cost(completed), (10000 * 3.0 + 20000 * 0.1 + 10000 * 9.0) / 1e6)
        cut = {"model": "deepseek-v4-flash", "usage": {}, "messages": [{"role": "user", "content": "x" * 30000}],
               "stream_observation": {"received_bytes": 90000, "content_chars": 3000, "reasoning_chars": 27000}}
        self.assertAlmostEqual(adapter.call_cost(cut), (10000 * 3.0 + 10000 * 9.0) / 1e6)

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
        smoke = json.loads(line.split(" ", 2)[2])
        self.assertEqual((smoke["executed"], smoke["problems"], smoke["vocabulary_missing"], smoke["repair"]),
                         (True, [], 0, None))
        usage = json.loads([l for l in capture.getvalue().splitlines() if l.startswith("[oneshot] usage ")][0].split(" ", 2)[2])
        self.assertEqual(usage["repair_cny_limit"], 3.0)
        self.assertNotIn(SYNTHETIC_KEY, capture.getvalue())

if __name__ == "__main__":
    unittest.main()
