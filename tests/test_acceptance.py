"""Synthetic model plans; real browser tests prove tooling, not model quality."""
import contextlib
import copy
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import io
import json
import os
from pathlib import Path
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

from volo.acceptance import MAX_INPUT_CHARS, main, run_acceptance, validate_plan
from volo.acceptance_browser import Browser, local_url
from volo.model import Model, ModelError, Usage
from volo.requirements import RequirementSet
from volo.trace import Trace


def plan():
    return {"checks": [{"requirement_id": "persist", "name": "Preserve entered data after reload",
        "steps": [{"op": "fill", "target": {"by": "label", "name": "Name"}, "value": "Ada"},
                  {"op": "click", "target": {"by": "role", "role": "button", "name": "Save"}},
                  {"op": "reload"},
                  {"op": "expect_text", "target": {"by": "role", "role": "status", "name": ""},
                   "value": "Ada"}]}]}


class SyntheticModel:
    def __init__(self, value=None, finish="tool_calls"):
        self.value = plan() if value is None else value
        self.finish, self.usage, self.messages = finish, Usage(), None

    def complete(self, messages, tools, **kwargs):
        self.messages = messages
        self.usage.calls += 1
        self.usage.prompt_tokens += 100
        self.usage.completion_tokens += 50
        return {"role": "assistant", "tool_calls": [{"id": "synthetic-1", "type": "function",
                "function": {"name": "acceptance_plan", "arguments": json.dumps(self.value)}}]}, self.finish


class SyntheticBrowser:
    base_url = "http://127.0.0.1:3000"

    def __init__(self, status="passed"):
        self.runs, self.status = [], status

    def execute(self, checks, *, timeout, inspect=False):
        self.runs.append((checks, inspect))
        if inspect:
            return {"initial": {"accessibility": "- textbox Name\n- button Save"}}
        results = []
        for check in checks:
            steps = []
            for step in check["steps"]:
                assertion = step["op"].startswith("expect_")
                evidence = {"action": copy.deepcopy(step), "ok": True,
                            "actual": step.get("value") if assertion else None}
                steps.append(evidence)
                if (self.status == "failed_check" and assertion) or (self.status == "blocked" and not assertion):
                    evidence.update(ok=False, error="Synthetic execution failure")
                    break
            results.append({"requirement_id": check["requirement_id"], "name": check["name"],
                            "status": self.status, "steps": steps})
        return {"checks": results}


class AlteredBrowser(SyntheticBrowser):
    def __init__(self, alter):
        super().__init__()
        self.alter = alter

    def execute(self, checks, *, timeout, inspect=False):
        result = super().execute(checks, timeout=timeout, inspect=inspect)
        if not inspect:
            self.alter(result)
        return result


class AcceptanceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.trace = Trace(self.root / "report")
        self.requirements = RequirementSet(self.root / "requirements",
            {"id": "persist", "description": "Entered data must survive page reload."},
            [{"id": "persist"}], "synthetic-fingerprint", [])

    def run_experiment(self, model=None, browser=None):
        return run_acceptance(self.requirements, model or SyntheticModel(),
                              browser or SyntheticBrowser(), self.trace, deadline=time.monotonic()+60)

    def test_one_call_original_requirements_and_actual_browser_results(self):
        model, browser = SyntheticModel(), SyntheticBrowser()
        result = self.run_experiment(model, browser)
        self.assertEqual(model.usage.calls, 1)
        self.assertEqual([x[1] for x in browser.runs], [True, False])
        self.assertIn("Entered data must survive", model.messages[1]["content"])
        self.assertEqual(result["status"], "no_issues_found")
        self.assertFalse(result["official_evaluation"])

    def test_missing_coverage_and_blocked_actions_are_inconclusive(self):
        self.requirements.nodes.append({"id": "not-covered"})
        result = self.run_experiment()
        self.assertEqual(result["status"], "inconclusive")
        self.assertEqual(result["requirements_without_checks"], ["not-covered"])
        self.assertEqual(self.run_experiment(browser=SyntheticBrowser("blocked"))["status"], "inconclusive")

    def test_failed_browser_assertion_is_not_success(self):
        self.assertEqual(self.run_experiment(browser=SyntheticBrowser("failed_check"))["status"], "issues_found")

    def test_missing_check_for_same_requirement_is_not_success(self):
        value = plan()
        second = copy.deepcopy(value["checks"][0])
        second["name"] = "Second independent scenario for the same requirement"
        value["checks"].append(second)
        model = SyntheticModel(value)
        browser = AlteredBrowser(lambda result: result["checks"].pop())
        with self.assertRaisesRegex(ValueError, "inconsistent browser evidence"):
            self.run_experiment(model, browser)
        self.assertEqual(model.usage.calls, 1)
        self.assertIn("acceptance_browser_results", self.trace.path.read_text())

    def test_unknown_browser_status_is_inconclusive(self):
        for status in ("skipped", "timed_out", "", None):
            with self.subTest(status=status), self.assertRaisesRegex(ValueError, "browser evidence"):
                self.run_experiment(browser=SyntheticBrowser(status))

    def test_incomplete_or_mismatched_pass_evidence_is_rejected(self):
        alterations = [
            lambda result: result["checks"][0]["steps"].pop(),
            lambda result: result["checks"][0].update(requirement_id="unplanned"),
            lambda result: result["checks"][0].update(name="different check"),
            lambda result: result["checks"][0].update(steps=[]),
            lambda result: result["checks"][0]["steps"][-1].update(actual="not Ada"),
            lambda result: result["checks"][0]["steps"][-1].update(ok=1),
            lambda result: result["checks"][0]["steps"][0].update(action={"op": "reload"}),
            lambda result: result["checks"].append(copy.deepcopy(result["checks"][0])),
            lambda result: result.update(checks=None),
        ]
        for index, alter in enumerate(alterations):
            with self.subTest(index=index), self.assertRaisesRegex(ValueError, "browser evidence"):
                self.run_experiment(browser=AlteredBrowser(alter))

    def test_failure_verdict_requires_matching_failure_evidence(self):
        for status in ("blocked", "failed_check"):
            browser = AlteredBrowser(lambda result: result["checks"][0].update(status=status))
            with self.subTest(status=status), self.assertRaisesRegex(ValueError, "browser evidence"):
                self.run_experiment(browser=browser)

    def test_late_browser_result_is_not_success(self):
        with patch("volo.acceptance.time.monotonic", return_value=10) as clock:
            browser = AlteredBrowser(lambda result: setattr(clock, "return_value", 101))
            with self.assertRaisesRegex(TimeoutError, "wall-time"):
                run_acceptance(self.requirements, SyntheticModel(), browser, self.trace, deadline=100)

    def test_cli_writes_inconclusive_report_for_missing_evidence_without_network(self):
        report_dir = self.root / "cli-report"
        model = SyntheticModel()
        model.api_key = "synthetic-test-key"
        browser = AlteredBrowser(lambda result: result["checks"][0]["steps"].pop())
        config = {"OPENAI_BASE_URL": "https://gateway.example/v1", "OPENAI_API_KEY": model.api_key,
                  "MODEL": "synthetic", "FACTORY_PLAYWRIGHT_MODULE": "synthetic-module"}
        with patch("volo.acceptance.RequirementSet.load", return_value=self.requirements), \
             patch.dict(os.environ, config, clear=True), patch("volo.acceptance.Model", return_value=model), \
             patch("volo.acceptance.Browser", return_value=browser), \
             patch("urllib.request.urlopen", side_effect=AssertionError("Unexpected network call")) as network, \
             contextlib.redirect_stdout(io.StringIO()):
            result = main(["requirements", "--base-url", browser.base_url,
                           "--report-dir", str(report_dir), "--allow-model-calls"])
        self.assertEqual(result, 1)
        report = json.loads((report_dir / "report.json").read_text())
        self.assertEqual(report["status"], "inconclusive")
        self.assertFalse(report["official_evaluation"])
        self.assertEqual(report["model_usage"]["calls"], 1)  # Synthetic, not a gateway request.
        self.assertNotIn(model.api_key, (report_dir / "events.jsonl").read_text())
        network.assert_not_called()

    def test_truncated_plan_does_not_execute_checks(self):
        browser = SyntheticBrowser()
        with self.assertRaises(ModelError):
            self.run_experiment(SyntheticModel(finish="length"), browser)
        self.assertEqual(len(browser.runs), 1)
        self.assertTrue(browser.runs[0][1])

    def test_malformed_plan_does_not_execute_checks(self):
        browser = SyntheticBrowser()
        invalid = plan()
        invalid["checks"][0]["steps"].pop()
        with self.assertRaisesRegex(ValueError, "assertion"):
            self.run_experiment(SyntheticModel(invalid), browser)
        self.assertEqual(len(browser.runs), 1)

    def test_overlarge_inputs_and_expired_time_do_not_call_model(self):
        model, browser = SyntheticModel(), SyntheticBrowser()
        self.requirements.document["description"] = "x" * (MAX_INPUT_CHARS+1)
        with self.assertRaisesRegex(ValueError, "nothing was truncated"):
            self.run_experiment(model, browser)
        self.assertEqual(model.usage.calls, 0)
        self.assertEqual(browser.runs, [])
        self.requirements.document["description"] = "small"
        with self.assertRaises(TimeoutError):
            run_acceptance(self.requirements, model, browser, self.trace, deadline=0)
        self.assertEqual(model.usage.calls, 0)

    def test_plan_rejects_unsupported_actions_unknown_ids_and_extra_fields(self):
        variants = []
        invalid = plan(); invalid["checks"][0]["steps"][0]["op"] = "evaluate"; variants.append(invalid)
        invalid = plan(); invalid["checks"][0]["requirement_id"] = "invented"; variants.append(invalid)
        invalid = plan(); invalid["checks"][0]["steps"][0]["script"] = "process.exit()"; variants.append(invalid)
        invalid = plan(); invalid["checks"][0]["steps"][0]["target"]["by"] = "css"; variants.append(invalid)
        invalid = plan(); invalid["checks"][0]["steps"] *= 11; variants.append(invalid)
        for value in variants:
            with self.subTest(value=value), self.assertRaises(ValueError):
                validate_plan(value, {"persist"}, SyntheticBrowser.base_url)

    def test_plan_validates_assertion_types_and_navigation(self):
        invalid = plan()
        invalid["checks"][0]["steps"][-1].update(op="expect_count", value=True)
        with self.assertRaisesRegex(ValueError, "action value"):
            validate_plan(invalid, {"persist"}, SyntheticBrowser.base_url)
        for destination in ("https://example.com", "http://127.0.0.1:4000", "file:///etc/passwd"):
            invalid = plan()
            invalid["checks"][0]["steps"].insert(0, {"op": "goto", "value": destination})
            with self.subTest(destination=destination), self.assertRaises(ValueError):
                validate_plan(invalid, {"persist"}, SyntheticBrowser.base_url)
        for url in ("https://127.0.0.1", "http://example.com", "http://u:p@localhost", "http://localhost:0"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                local_url(url)

    def test_default_cli_inspection_never_starts_browser_or_model(self):
        with patch("volo.acceptance.RequirementSet.load", return_value=self.requirements), \
             patch("volo.acceptance.discover_playwright", return_value={"available": False}), \
             patch.dict(os.environ, {}, clear=True), patch.object(Model, "complete") as model, \
             patch.object(Browser, "execute") as browser, contextlib.redirect_stdout(io.StringIO()) as out:
            self.assertEqual(main(["requirements", "--base-url", "http://127.0.0.1:3000"]), 0)
        self.assertEqual(json.loads(out.getvalue())["model_calls"], 0)
        model.assert_not_called(); browser.assert_not_called()

    def test_one_attempt_transport_does_not_retry_429(self):
        model = Model("https://gateway.example/v1", "synthetic-test-key", "test", self.trace, max_attempts=1)
        error = HTTPError(model.url, 429, "synthetic limit", {}, io.BytesIO(b'{}'))
        with patch("urllib.request.urlopen", side_effect=error) as request, patch("time.sleep") as sleep:
            with self.assertRaises(ModelError):
                model.complete([{"role": "user", "content": "synthetic"}], [])
        self.assertEqual(model.usage.calls, 1)
        self.assertEqual(request.call_count, 1)
        sleep.assert_not_called()
        self.assertEqual(Model("https://gateway.example/v1", "synthetic", "test", self.trace).max_attempts, 3)

    @unittest.skipUnless(os.getenv("FACTORY_TEST_PLAYWRIGHT_MODULE") and
                         os.getenv("FACTORY_TEST_CHROMIUM_EXECUTABLE"), "Installed browser configuration required")
    def test_real_browser_input_click_reload_assertions_and_redirect_guard(self):
        external_hits = []

        class External(BaseHTTPRequestHandler):
            def do_GET(self):
                external_hits.append(self.path)
                self.send_response(200); self.end_headers(); self.wfile.write(b"must not be fetched")
            def log_message(self, *args):
                pass

        external = ThreadingHTTPServer(("127.0.0.1", 0), External)
        html = b'''<label>Name <input id="name"></label><button>Save</button><output role="status" id="saved"></output>
<script>const field=document.getElementById('name'), output=document.getElementById('saved');
output.textContent=localStorage.getItem('acceptance-name')||'';
document.querySelector('button').onclick=()=>{localStorage.setItem('acceptance-name',field.value);output.textContent=field.value;};</script>'''

        class App(BaseHTTPRequestHandler):
            def do_GET(self):
                if self.path == "/out":
                    self.send_response(302)
                    self.send_header("Location", "http://127.0.0.1:"+str(external.server_port)+"/blocked")
                    self.end_headers(); return
                self.send_response(200); self.send_header("Content-Type", "text/html")
                self.end_headers(); self.wfile.write(html)
            def log_message(self, *args):
                pass

        app = ThreadingHTTPServer(("127.0.0.1", 0), App)
        for server in (external, app):
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            self.addCleanup(server.server_close)
            self.addCleanup(server.shutdown)
        browser = Browser("http://127.0.0.1:"+str(app.server_port),
                          os.environ["FACTORY_TEST_PLAYWRIGHT_MODULE"], self.trace.directory,
                          os.environ["FACTORY_TEST_CHROMIUM_EXECUTABLE"])
        initial = browser.execute([], timeout=30, inspect=True)
        self.assertIn("Save", initial["initial"]["accessibility"])
        checks = plan()["checks"]
        wrong = copy.deepcopy(checks[0]); wrong["steps"][-1]["value"] = "Wrong"; checks.append(wrong)
        redirect = copy.deepcopy(checks[0]); redirect["steps"].insert(0, {"op": "goto", "value": "/out"}); checks.append(redirect)
        result = browser.execute(checks, timeout=40)
        self.assertEqual([c["status"] for c in result["checks"]], ["passed", "failed_check", "blocked"], result)
        self.assertEqual(external_hits, [])
        self.assertTrue((self.trace.directory / "initial.png").is_file())
        self.assertTrue((self.trace.directory / "check-01.png").is_file())
        self.assertIn("Ada", result["checks"][0]["evidence"]["accessibility"])
