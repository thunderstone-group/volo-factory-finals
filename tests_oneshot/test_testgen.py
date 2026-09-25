"""Requirement-written acceptance tests (oneshot/testgen.py): planning, writing with a stub model, verdicts from a
Playwright report, and one real run against a tiny application."""
import json
import os
import shutil
import subprocess
import tempfile
import textwrap
import unittest
from pathlib import Path

from oneshot import testgen

REQUIREMENTS = textwrap.dedent("""\
    id: ROOT
    name: Synthetic notes
    type: FOLDER
    children:
    - id: REQ-1
      name: Notes
      type: FOLDER
      children:
      - id: REQ-1-1
        name: Add a note
        type: ATOMIC
        description: The home page has a button named “Add note” and a text box labeled “Note title”.
        scenarios:
        - name: Add one
          steps:
          - keyword: WHEN
            content: The user clicks “Add note”.
        - name: Add two
          steps:
          - keyword: WHEN
            content: The user clicks “Add note” twice.
      - id: REQ-1-2
        name: Edit a note
        type: ATOMIC
        description: Double-clicking a note opens a text box named “Edit <note title>”.
        scenarios:
        - name: Edit one
          steps:
          - keyword: WHEN
            content: The user double-clicks the note.
    - id: REQ-2
      name: Archive
      type: FOLDER
      children:
      - id: REQ-2-1
        name: Archive a note
        type: ATOMIC
        description: Each note has a button named “Archive”.
        scenarios:
        - name: Archive one
          steps:
          - keyword: WHEN
            content: The user clicks “Archive”.
    """)


class PlanCase(unittest.TestCase):
    def test_groups_follow_top_folders_and_never_split_a_requirement(self):
        groups = testgen.plan(REQUIREMENTS)
        self.assertEqual([g["file"] for g in groups], ["t01-REQ-1.spec.cjs", "t02-REQ-2.spec.cjs"])
        self.assertEqual([i["id"] for i in groups[0]["items"]], ["REQ-1-1", "REQ-1-1#2", "REQ-1-2"])
        small = testgen.plan(REQUIREMENTS, limit=2)
        self.assertEqual([[i["id"] for i in g["items"]] for g in small],
                         [["REQ-1-1", "REQ-1-1#2"], ["REQ-1-2"], ["REQ-2-1"]])

    def test_request_lists_the_scenarios_and_carries_prerequisites(self):
        group = testgen.plan(REQUIREMENTS)[0]
        system, user = testgen.request(REQUIREMENTS, group, "Seed: synthetic")
        self.assertIn("t01-REQ-1.spec.cjs", system["content"])
        self.assertIn("- REQ-1-1#2: Add two  (scenario 2 of REQ-1-1)", user["content"])
        self.assertIn("Seed: synthetic", user["content"])
        self.assertIn("const { test, expect } = require('@playwright/test');", system["content"])


class WriteCase(unittest.TestCase):
    def test_writes_each_file_retries_a_reply_without_a_block_and_survives_a_failed_call(self):
        calls = []

        def complete(messages):
            calls.append(messages[0]["content"])
            name = next(g["file"] for g in testgen.plan(REQUIREMENTS) if g["file"] in messages[0]["content"])
            if name.startswith("t02"):
                raise RuntimeError("synthetic transport failure")
            if sum(name in c for c in calls) == 1:
                return "Sorry, no file.", {}, "stop"
            body = ("const { test, expect } = require('@playwright/test');\n"
                    "test('REQ-1-1: Add one', async ({ page }) => {});\n"
                    "test.skip('REQ-1-1#2: Add two', async () => {});\n")
            return f"=== FILE: {name} ===\n{body}=== END ===", {}, "stop"

        with tempfile.TemporaryDirectory() as temp:
            manifest = testgen.write_suite(REQUIREMENTS, temp, complete, workers=1)
            saved = json.loads((Path(temp) / "suite.json").read_text())
        self.assertEqual(saved, manifest)
        first, second = manifest["files"]
        self.assertEqual((first["calls"], first["tests"]), (2, ["REQ-1-1: Add one", "REQ-1-1#2: Add two"]))
        self.assertNotIn("error", first)
        self.assertIn("synthetic transport failure", second["error"])
        self.assertTrue(testgen.runnable(manifest))
        self.assertFalse(testgen.runnable({"files": [second]}))


def result(status, message="", line=None, file="t01-REQ-1.spec.cjs", snippet=""):
    error = {"message": message, "stack": message, "snippet": snippet}
    if line:
        error["location"] = {"file": "/suite/" + file, "line": line, "column": 5}
    return {"status": status, "duration": 1234, "errors": [error] if message else []}


class ParseCase(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.suite = Path(self.temp.name)
        source = textwrap.dedent("""\
            const { test, expect } = require('@playwright/test');
            async function open(page) { await page.getByRole('button', { name: 'Add note', exact: true }).click(); }
            test('REQ-1-1: Add one', async ({ page }) => {
              await open(page);
            });
            test('REQ-1-1#2: Add two', async ({ page }) => {
              await open(page);
            });
            test('REQ-1-2: Edit one', async ({ page }) => {
              await page.getByRole('button', { name: 'Rename note', exact: true }).click();
            });
            test('REQ-2-1: Archive one', async ({ page }) => {
              await page.getByRole('textbox', { name: 'Edit ' + title, exact: true }).fill('x');
            });
            """)
        (self.suite / "t01-REQ-1.spec.cjs").write_text(source)
        self.manifest = {"files": [{"file": "t01-REQ-1.spec.cjs", "tests": [
            "REQ-1-1: Add one", "REQ-1-1#2: Add two", "REQ-1-2: Edit one", "REQ-2-1: Archive one", "REQ-9: Missing"]}]}

    def report(self, tests):
        specs = [{"title": title, "line": line, "tests": [{"results": [res]}]} for title, line, res in tests]
        path = self.suite / "report.json"
        path.write_text(json.dumps({"suites": [{"title": "t01-REQ-1.spec.cjs", "specs": specs}], "errors": []}))
        return path

    def test_verdicts(self):
        timeout = ("TimeoutError: locator.click: Timeout 5000ms exceeded.\nCall log:\n  - waiting for "
                   "getByRole('button', { name: 'Add note', exact: true })")
        path = self.report([
            ("REQ-1-1: Add one", 3, result("failed", timeout, line=2)),
            ("REQ-1-1#2: Add two", 6, result("timedOut", timeout.replace("5000", "6000"), line=2)),
            ("REQ-1-2: Edit one", 9, result("failed", "Error: locator.click: Timeout 5000ms exceeded.\n  - waiting for "
                                              "getByRole('button', { name: 'Rename note', exact: true })", line=10)),
            ("REQ-2-1: Archive one", 12, result("failed", "Error: expect(locator).toHaveValue(expected) failed\n  - waiting for "
                                                "getByRole('textbox', { name: 'Edit Groceries', exact: true })", line=13)),
        ])
        entries = {e["id"]: e for e in testgen.parse(path, self.suite, self.manifest, REQUIREMENTS)}
        # Two tests stop at the same helper line with the same message: one finding.
        self.assertEqual(entries["REQ-1-1"]["status"], "error")
        self.assertEqual(entries["REQ-1-1#2"]["status"], "error")
        helper = entries["helper:t01-REQ-1.spec.cjs:2"]
        self.assertEqual((helper["status"], helper["blocks"]), ("fail", ["REQ-1-1", "REQ-1-1#2"]))
        self.assertIn("Add note", helper["observation"])
        # A literal name the requirements never give is the test's own mistake.
        self.assertEqual(entries["REQ-1-2"]["status"], "error")
        self.assertIn("Rename note", entries["REQ-1-2"]["observation"])
        # A name built at run time matches a `<placeholder>` phrase and is judged as the application's failure.
        self.assertEqual(entries["REQ-2-1"]["status"], "fail")
        self.assertIn("fill('x')", entries["REQ-2-1"]["source"])
        self.assertEqual(entries["REQ-9"]["status"], "error")
        self.assertTrue(entries["REQ-9"]["observation"].startswith("Not run"))

    def test_own_errors_and_skips_never_count_against_the_application(self):
        path = self.report([
            ("REQ-1-1: Add one", 3, result("failed", "ReferenceError: page is not defined", line=2)),
            ("REQ-1-1#2: Add two", 6, {"status": "skipped", "errors": []}),
            ("REQ-1-2: Edit one", 9, result("passed")),
            ("REQ-2-1: Archive one", 12, result("failed", "TypeError: Cannot read properties of null (reading 'x')", line=13)),
        ])
        statuses = {e["id"]: e["status"] for e in testgen.parse(path, self.suite, self.manifest, REQUIREMENTS)}
        self.assertEqual(statuses, {"REQ-1-1": "error", "REQ-1-1#2": "error", "REQ-1-2": "pass", "REQ-2-1": "error",
                                    "REQ-9": "error"})


APP_SERVER = r"""
const http = require('node:http');
const page = `<!doctype html><button type="button" onclick="document.getElementById('out').textContent='Added'">Add note</button>
<p id="out"></p>`;
http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(page); })
  .listen(Number(process.env.PORT), '127.0.0.1');
"""

SPEC = r"""const { test, expect } = require('@playwright/test');
test('REQ-1-1: Add one', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add note', exact: true }).click();
  await expect(page.getByText('Added', { exact: true })).toBeVisible();
});
test('REQ-1-2: Edit one', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add note', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Archive', exact: true })).toBeVisible();
});
"""


@unittest.skipUnless(shutil.which("node") and shutil.which("npm"), "node and npm are required")
class TestIdCase(unittest.TestCase):
    def test_a_dropped_scenario_suffix_is_restored_from_the_scenario_number(self):
        self.assertEqual(testgen._test_id("REQ-3-1: REQ-3-1: Search - Scenario 2"), ("REQ-3-1#2", "REQ-3-1: Search - Scenario 2"))
        self.assertEqual(testgen._test_id("REQ-3-1: Search - Scenario 1"), ("REQ-3-1", "Search - Scenario 1"))
        self.assertEqual(testgen._test_id("REQ-3-1#3: REQ-3-1: Search - Scenario 3"), ("REQ-3-1#3", "REQ-3-1: Search - Scenario 3"))
        self.assertEqual(testgen._test_id("REQ-2: Plain name"), ("REQ-2", "Plain name"))


class RunCase(unittest.TestCase):
    def test_runs_a_suite_against_a_live_application(self):
        env = dict(os.environ)
        cli, why = testgen.ensure_runner(env)
        if not cli:
            self.skipTest("the Playwright test runner is unavailable: " + why)
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            app = root / "app"
            (app / "backend").mkdir(parents=True)
            (app / "frontend").mkdir()
            (app / "backend" / "server.js").write_text(APP_SERVER)
            (app / "backend" / "package.json").write_text('{"scripts": {"start": "node server.js"}}')
            suite = root / "suite"
            suite.mkdir()
            (suite / "t01-REQ-1.spec.cjs").write_text(SPEC)
            # A file that does not parse would make Playwright load no test at all; the run skips it by name.
            (suite / "t02-REQ-2.spec.cjs").write_text("test('REQ-2-1: x', async () => { const a = `b ${c}` d`; });\n")
            (suite / "suite.json").write_text(json.dumps({"files": [{"file": "t01-REQ-1.spec.cjs", "tests": [
                "REQ-1-1: Add one", "REQ-1-2: Edit one"]}, {"file": "t02-REQ-2.spec.cjs", "tests": ["REQ-2-1: x"],
                "syntax": "SyntaxError"}], "scenarios": 3, "tests": 3}))
            report = testgen.run_suite(app, suite, REQUIREMENTS)
            self.assertEqual(report.get("kind"), "testgen", report)
            statuses = {e["id"]: e["status"] for e in report["scenarios"]}
            self.assertEqual(statuses, {"REQ-1-1": "pass", "REQ-1-2": "fail", "REQ-2-1": "error"})
            again = testgen.run_suite(app, suite, REQUIREMENTS, only={"REQ-1-2"})
            self.assertEqual([(e["id"], e["status"]) for e in again["scenarios"]], [("REQ-1-2", "fail")])


if __name__ == "__main__":
    unittest.main()


class RepairLoopCase(unittest.TestCase):
    """main.repair_delivery with a written suite: failing tests go into the request with their code, and a repair
    that loses any passing test is discarded however many it fixes."""

    def setUp(self):
        from unittest.mock import patch
        from oneshot import main as adapter
        from tests_oneshot.test_oneshot import application
        self.adapter, self.patch = adapter, patch
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.stage = Path(self.temp.name) / "app"
        self.stage.mkdir()
        self.files = adapter.parse_blocks(application())[0]
        for item in self.files:
            adapter.write_one(self.stage, dict(item))
        for target, value in (("smoke_check", ([], True)), ("vocabulary_gaps", ([], 0)), ("static_gaps", {})):
            manager = patch.object(adapter, target, return_value=value)
            manager.__enter__()
            self.addCleanup(manager.__exit__, None, None, None)

    @staticmethod
    def report(statuses):
        return {"kind": "testgen", "invariants": [], "scenarios": [
            {"id": sid, "name": sid, "status": status, "steps": [],
             "observation": "TimeoutError: locator.click: waiting for getByRole('button', { name: 'Add note' })",
             "source": f"test('{sid}: x', async ({{ page }}) => {{ /* body of {sid} */ }});"}
            for sid, status in statuses.items()]}

    def run_loop(self, reports, replies):
        adapter, sent = self.adapter, []

        def complete(messages, model, base, key, budget, tries=3, salvage=None):
            sent.append(messages[-1]["content"])
            record = budget.start(messages, model)
            record.update(status="completed", usage={"prompt_tokens": 10, "completion_tokens": 10})
            return replies.pop(0), {}, "stop"
        budget = adapter.CallBudget(repair_limit=len(replies))
        budget.phase = "repair"
        with self.patch.object(adapter, "check_scenarios", side_effect=reports) as check, \
                self.patch.object(adapter, "stream_completion", side_effect=complete):
            adapter.repair_delivery(self.stage, list(self.files), [{"role": "user", "content": "draft"}], "m", "b", "k",
                                    budget, requirements="synthetic", tests=Path(self.temp.name) / "suite")
        return sent, budget, check

    def test_a_repair_that_loses_a_test_is_discarded_below_three_gains_per_loss(self):
        from tests_oneshot.test_oneshot import block
        before = self.report({"REQ-1": "fail", "REQ-2": "fail", "REQ-3": "fail", "REQ-4": "pass"})
        after = self.report({"REQ-1": "pass", "REQ-2": "pass", "REQ-3": "fail", "REQ-4": "fail"})
        recheck = self.report({"REQ-4": "fail", "REQ-1": "pass", "REQ-2": "pass"})
        sent, budget, check = self.run_loop([before, after, recheck],
                                            [block("frontend/public/app.js", "// repaired")])
        self.assertIn("test code:", sent[0])
        self.assertIn("/* body of REQ-2 */", sent[0])
        self.assertIn("These tests pass and must keep passing: REQ-4", sent[0])
        rounds = budget.smoke["rounds"]
        self.assertFalse(rounds[0]["accepted"])
        self.assertIn("broke 1 passing", rounds[0]["reason"])
        self.assertFalse((self.stage / "frontend/public/app.js").exists(), "the discarded repair was rolled back")
        self.assertTrue(all(call.kwargs.get("tests") is not None for call in check.call_args_list))

    def test_a_repair_that_fixes_three_per_lost_test_is_kept(self):
        from tests_oneshot.test_oneshot import block
        before = self.report({"REQ-1": "fail", "REQ-2": "fail", "REQ-3": "fail", "REQ-4": "pass"})
        after = self.report({"REQ-1": "pass", "REQ-2": "pass", "REQ-3": "pass", "REQ-4": "fail"})
        recheck = self.report({"REQ-4": "fail"})
        _, budget, _ = self.run_loop([before, after, recheck], [block("frontend/public/app.js", "// repaired")])
        self.assertTrue(budget.smoke["rounds"][0]["accepted"], budget.smoke["rounds"][0])

    def test_tests_a_shared_helper_blocked_count_as_gained_when_they_pass(self):
        from tests_oneshot.test_oneshot import block
        before = self.report({"REQ-1": "error", "REQ-2": "error", "REQ-3": "error", "REQ-4": "pass",
                              "helper:t1.spec.cjs:9": "fail"})
        after = self.report({"REQ-1": "pass", "REQ-2": "pass", "REQ-3": "pass", "REQ-4": "fail"})
        recheck = self.report({"REQ-4": "fail"})
        _, budget, _ = self.run_loop([before, after, recheck], [block("frontend/public/app.js", "// repaired")])
        self.assertTrue(budget.smoke["rounds"][0]["accepted"], budget.smoke["rounds"][0])
        self.assertEqual(budget.smoke["rounds"][0]["gained"], ["REQ-1", "REQ-2", "REQ-3"])

    def test_a_lost_quoted_phrase_weighs_as_one_lost_test_under_written_tests(self):
        from tests_oneshot.test_oneshot import block
        many = {f"REQ-{i}": "fail" for i in range(1, 7)}
        before = self.report({**many, "REQ-9": "pass"})
        after = self.report({**{k: "pass" for k in many}, "REQ-9": "pass"})
        vocab = iter([([], 0), ([], 1)])
        with self.patch.object(self.adapter, "vocabulary_gaps", side_effect=lambda *a, **k: next(vocab, ([], 1))):
            _, budget, _ = self.run_loop([before, after], [block("frontend/public/app.js", "// repaired")])
        record = budget.smoke["rounds"][0]
        self.assertTrue(record["accepted"], record)
        self.assertIn("removed quoted vocabulary", record["waived"][0])

    def test_a_lost_quoted_phrase_still_outweighs_a_small_gain(self):
        from tests_oneshot.test_oneshot import block
        before = self.report({"REQ-1": "fail", "REQ-2": "fail", "REQ-9": "pass"})
        after = self.report({"REQ-1": "pass", "REQ-2": "pass", "REQ-9": "pass"})
        recheck = self.report({"REQ-1": "pass", "REQ-2": "pass"})
        vocab = iter([([], 0), ([], 1)])
        with self.patch.object(self.adapter, "vocabulary_gaps", side_effect=lambda *a, **k: next(vocab, ([], 1))):
            _, budget, _ = self.run_loop([before, after, recheck], [block("frontend/public/app.js", "// repaired")])
        record = budget.smoke["rounds"][0]
        self.assertFalse(record["accepted"], record)
        self.assertIn("removed quoted vocabulary", record["reason"])

    def test_a_repair_that_only_gains_is_kept(self):
        from tests_oneshot.test_oneshot import block
        before = self.report({"REQ-1": "fail", "REQ-2": "fail", "REQ-3": "fail", "REQ-4": "pass"})
        after = self.report({"REQ-1": "pass", "REQ-2": "pass", "REQ-3": "pass", "REQ-4": "pass"})
        _, budget, _ = self.run_loop([before, after], [block("frontend/public/app.js", "// repaired")])
        self.assertTrue(budget.smoke["rounds"][0]["accepted"])
        self.assertEqual((self.stage / "frontend/public/app.js").read_text().strip(), "// repaired")
