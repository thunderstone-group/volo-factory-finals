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


class GroundingCase(unittest.TestCase):
    def test_a_cell_address_is_grounded_but_an_invented_name_is_not(self):
        quoted = testgen._phrases("Cell `A1` holds `Region`.")
        source = "getByRole('gridcell', { name: 'E1', exact: true }); getByRole('button', { name: 'Frobnicate' })"
        self.assertFalse(testgen.ungrounded("E1", source, "Cell `A1` holds `Region`.", quoted))
        self.assertTrue(testgen.ungrounded("Frobnicate", source, "Cell `A1` holds `Region`.", quoted))


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
            # A file that parses but that Playwright cannot load (a duplicate title) also stops every test; the run
            # finds it, sets it aside in suite.json and runs the rest.
            (suite / "t02-REQ-2.spec.cjs").write_text("const { test } = require('@playwright/test');\n"
                                                      "test('REQ-2-1: x', async () => {});\ntest('REQ-2-1: x', async () => {});\n")
            saved = json.loads((suite / "suite.json").read_text())
            saved["files"][1].pop("syntax")
            (suite / "suite.json").write_text(json.dumps(saved))
            third = testgen.run_suite(app, suite, REQUIREMENTS)
            self.assertEqual({e["id"]: e["status"] for e in third["scenarios"]},
                             {"REQ-1-1": "pass", "REQ-1-2": "fail", "REQ-2-1": "error"})
            self.assertIn("cannot load", json.loads((suite / "suite.json").read_text())["files"][1]["syntax"])

    def test_a_run_stopped_at_its_time_limit_keeps_the_tests_it_finished(self):
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
            # The third test outlasts the run's limit while staying inside its own timeout: a stuck application.
            (suite / "t01-REQ-1.spec.cjs").write_text(SPEC + "test('REQ-1-3: Slow', async ({ page }) => {\n"
                                                      "  await page.goto('/');\n  await page.waitForTimeout(14000);\n});\n")
            (suite / "suite.json").write_text(json.dumps({"files": [{"file": "t01-REQ-1.spec.cjs", "tests": [
                "REQ-1-1: Add one", "REQ-1-2: Edit one", "REQ-1-3: Slow"]}], "scenarios": 3, "tests": 3}))
            report = testgen.run_suite(app, suite, REQUIREMENTS, seconds=16)
            self.assertEqual(report.get("timed_out"), 16, report)
            entries = {e["id"]: e for e in report["scenarios"]}
            self.assertEqual({k: e["status"] for k, e in entries.items()},
                             {"REQ-1-1": "pass", "REQ-1-2": "fail", "REQ-1-3": "error"})
            self.assertIn("Archive", entries["REQ-1-2"]["observation"])
            self.assertIn("stopped at its 16 s limit", entries["REQ-1-3"]["observation"])


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

    def test_a_round_the_model_never_answered_does_not_count_toward_the_discard_limit(self):
        adapter, sent = self.adapter, []
        before = self.report({"REQ-1": "fail", "REQ-9": "pass"})
        unchanged = self.report({"REQ-1": "fail", "REQ-9": "pass"})
        n = adapter.REPAIR_REJECTIONS
        outcomes = ["http"] + ["same"] * n

        def complete(messages, model, base, key, budget, tries=3, salvage=None):
            kind = outcomes.pop(0)
            record = budget.start(messages, model)
            if kind == "http":
                raise RuntimeError("model HTTP 400")
            record.update(status="completed", usage={"prompt_tokens": 10, "completion_tokens": 10})
            from tests_oneshot.test_oneshot import block
            return block("frontend/public/app.js", "// tried"), {}, "stop"
        budget = adapter.CallBudget(repair_limit=n + 1)
        budget.phase = "repair"
        with self.patch.object(adapter, "check_scenarios", side_effect=[before] + [unchanged] * (n + 2)), \
                self.patch.object(adapter, "stream_completion", side_effect=complete):
            adapter.repair_delivery(self.stage, list(self.files), [{"role": "user", "content": "draft"}], "m", "b", "k",
                                    budget, requirements="synthetic", tests=Path(self.temp.name) / "suite")
        rounds = budget.smoke["rounds"]
        self.assertEqual(len(rounds), n + 1, [r.get("reason") for r in rounds])
        self.assertFalse(rounds[0]["replied"])
        self.assertEqual(budget.smoke["stopped"], f"{n} repairs in a row were discarded")

    @staticmethod
    def edit(path, search, replace):
        return f"=== EDIT: {path} ===\n<<<<<<< SEARCH\n{search}\n=======\n{replace}\n>>>>>>> REPLACE\n=== END ===\n"

    def test_a_repair_that_breaks_parsing_gets_one_follow_up_in_the_same_round(self):
        if not shutil.which("node"):
            self.skipTest("node is required")
        from tests_oneshot.test_oneshot import block
        before = self.report({"REQ-1": "fail", "REQ-2": "fail", "REQ-9": "pass"})
        after = self.report({"REQ-1": "pass", "REQ-2": "pass", "REQ-9": "pass"})
        recheck = self.report({"REQ-1": "pass", "REQ-2": "pass"})
        sent, budget, _ = self.run_loop([before, after, recheck], [
            block("frontend/public/app.js", "const shown = ;"),
            self.edit("frontend/public/app.js", "const shown = ;", "const shown = 1;")])
        record = budget.smoke["rounds"][0]
        self.assertTrue(record["accepted"], record)
        self.assertEqual(record["follow_up"], "syntax")
        self.assertIn("does not parse", sent[1])
        self.assertEqual((self.stage / "frontend/public/app.js").read_text().strip(), "const shown = 1;")

    def test_a_repair_whose_every_search_missed_gets_one_follow_up_in_the_same_round(self):
        before = self.report({"REQ-1": "fail", "REQ-2": "fail", "REQ-9": "pass"})
        after = self.report({"REQ-1": "pass", "REQ-2": "pass", "REQ-9": "pass"})
        recheck = self.report({"REQ-1": "pass", "REQ-2": "pass"})
        sent, budget, _ = self.run_loop([before, after, recheck], [
            self.edit("frontend/build.js", "// a line that is not there", "// fixed"),
            self.edit("frontend/build.js", "// Synthetic build fixture", "// fixed")])
        record = budget.smoke["rounds"][0]
        self.assertTrue(record["accepted"], record)
        self.assertEqual(record["follow_up"], "search")
        self.assertIn("was not applied", sent[1])
        self.assertEqual((self.stage / "frontend/build.js").read_text().strip(), "// fixed")

    def test_a_repair_that_only_gains_is_kept(self):
        from tests_oneshot.test_oneshot import block
        before = self.report({"REQ-1": "fail", "REQ-2": "fail", "REQ-3": "fail", "REQ-4": "pass"})
        after = self.report({"REQ-1": "pass", "REQ-2": "pass", "REQ-3": "pass", "REQ-4": "pass"})
        _, budget, _ = self.run_loop([before, after], [block("frontend/public/app.js", "// repaired")])
        self.assertTrue(budget.smoke["rounds"][0]["accepted"])
        self.assertEqual((self.stage / "frontend/public/app.js").read_text().strip(), "// repaired")


class FenceCase(unittest.TestCase):
    def test_a_fenced_body_loses_its_fence_and_an_unfenced_one_is_unchanged(self):
        self.assertEqual(testgen.unfence("```js\nconst a = 1;\n```"), "const a = 1;")
        self.assertEqual(testgen.unfence("```cjs\nconst a = 1;\n```\n"), "const a = 1;")
        self.assertEqual(testgen.unfence("```\nconst a = 1;"), "const a = 1;")  # the closing fence was cut
        plain = "const a = `x`;\n// ```js in a comment\n"
        self.assertEqual(testgen.unfence(plain), plain)

    def test_the_suite_writer_saves_a_fenced_reply_as_a_file_that_parses(self):
        body = "```js\nconst { test } = require('@playwright/test');\ntest('REQ-1-1: Add one', async () => {});\n```"
        with tempfile.TemporaryDirectory() as temp:
            manifest = testgen.write_suite(REQUIREMENTS, temp, lambda m: (f"=== FILE: x.spec.cjs ===\n{body}\n=== END ===",
                                                                          {}, "stop"), workers=1)
            text = (Path(temp) / manifest["files"][0]["file"]).read_text()
        self.assertTrue(text.startswith("const { test }"))
        if shutil.which("node"):
            self.assertNotIn("syntax", manifest["files"][0])


class DependencyOrderCase(unittest.TestCase):
    GRAPH = textwrap.dedent("""\
        id: ROOT
        type: FOLDER
        children:
        - id: REQ-1
          type: ATOMIC
          scenarios: [{name: a, steps: []}]
        - id: REQ-2
          type: FOLDER
          dependencies: [REQ-1]
          children:
          - id: REQ-2-1
            type: ATOMIC
            scenarios: [{name: b, steps: []}]
          - id: REQ-2-2
            type: ATOMIC
            dependencies: [REQ-2-1]
            scenarios: [{name: c, steps: []}]
        - id: REQ-3
          type: ATOMIC
          dependencies: [REQ-4]
          scenarios: [{name: d, steps: []}]
        - id: REQ-4
          type: ATOMIC
          dependencies: [REQ-3]
          scenarios: [{name: e, steps: []}]
        """)

    def test_depth_counts_the_longest_chain_including_folder_dependencies_and_survives_a_cycle(self):
        depths = testgen.depths(self.GRAPH)
        self.assertEqual((depths["REQ-1"], depths["REQ-2-1"], depths["REQ-2-2"]), (0, 1, 2))
        self.assertIn(depths["REQ-3"], (0, 1))

    def test_failures_others_depend_on_come_first_and_helpers_are_no_longer_cut(self):
        from oneshot import main as adapter
        depths = testgen.depths(self.GRAPH)
        failing = ([{"id": "REQ-2-2", "status": "fail"}] * 25
                   + [{"id": "REQ-2-1", "status": "fail"},
                      {"id": "helper:t01.spec.cjs:9", "status": "fail", "blocks": ["REQ-2-1#2", "REQ-2-2#2", "REQ-2-2#3"]},
                      {"id": "REQ-1", "status": "fail"}])
        ordered = adapter.dependency_order(failing, depths)
        self.assertEqual([e["id"] for e in ordered[:3]], ["REQ-1", "helper:t01.spec.cjs:9", "REQ-2-1"])
        self.assertIn("helper:t01.spec.cjs:9", [e["id"] for e in ordered[:adapter.TESTGEN_SHOWN]])
        self.assertEqual([e["id"] for e in adapter.dependency_order(failing, {})][:1], ["helper:t01.spec.cjs:9"])


class GroundingFlatCase(unittest.TestCase):
    TEXT = textwrap.dedent("""\
        id: REQ-1
        type: ATOMIC
        description: The dialog shows "Worksheet name
          already exists" and names new sheets Sheet1, Sheet2 in order; the chart title is "<target worksheet name>".
        scenarios: []
        """)

    def test_a_phrase_broken_across_lines_and_a_numbered_name_are_grounded_but_an_invented_one_is_not(self):
        import re as _re
        flat = _re.sub(r"\s+", " ", self.TEXT)
        quoted = testgen._phrases(flat)
        for name, expected in (("Worksheet name already exists", False), ("Sheet3", False), ("Totally invented", True)):
            self.assertEqual(testgen.ungrounded(name, f"'{name}'", flat, quoted), expected, name)


class LabelOverrideCase(unittest.TestCase):
    def test_an_aria_label_that_renames_a_labelled_field_hides_the_label_from_the_control_names(self):
        from oneshot import main as adapter
        clean = '<label for="ws">Worksheet name</label><input id="ws" name="ws">'
        renamed = '<label for="ws">Worksheet name</label><input id="ws" aria-label="Workbook name">'
        same = '<label for="ws">Worksheet name</label><input id="ws" aria-label="Worksheet name">'
        self.assertEqual(adapter.label_overrides(clean), set())
        self.assertEqual(adapter.label_overrides(renamed), {"worksheet name"})
        self.assertEqual(adapter.label_overrides(same), set())
        with tempfile.TemporaryDirectory() as temp:
            public = Path(temp) / "frontend" / "public"
            public.mkdir(parents=True)
            (public / "app.js").write_text("const html = `" + renamed + "`;")
            names = adapter.control_names(Path(temp))
        self.assertNotIn("worksheet name", names)
        self.assertIn("workbook name", names)


class SecondLookCase(unittest.TestCase):
    """main.second_look: after the first suite's repairs stop, a second suite drives more repairs from the current
    files (roadmap 4.23)."""

    def run_look(self, stop=None):
        from unittest.mock import patch
        from oneshot import main as adapter
        budget = adapter.CallBudget()
        budget.phase = "repair"
        budget.smoke = {"stopped": "4 repairs in a row were discarded", "rounds": [{}, {}]}
        files = [{"path": "frontend/public/app.js", "content": "// repaired\n"}]
        calls, made = [], []

        def repair(*args, **kwargs):
            calls.append((args, kwargs))
            budget.smoke = {"stopped": None}

        def start(requirements, directory, *rest):
            made.append(directory)
            return {"job": 1}
        with patch.object(adapter, "start_suite", side_effect=start) as started, \
                patch.object(adapter, "finish_suite", return_value=Path("/suite-b")), \
                patch.object(adapter, "repair_delivery", side_effect=repair), \
                patch.object(budget, "repair_stop", return_value=stop):
            suites = []
            adapter.second_look(Path("/stage"), files, [{"role": "system", "content": "s"}, {"role": "user", "content": "u"}],
                                "m", "b", "k", budget, None, "reqs", True, "", suites)
        for directory in made:
            shutil.rmtree(directory, ignore_errors=True)
        return budget, calls, started, suites

    def test_a_second_suite_repairs_from_the_current_files(self):
        budget, calls, started, suites = self.run_look()
        self.assertEqual(len(calls), 1)
        args, kwargs = calls[0]
        self.assertEqual(kwargs["tests"], Path("/suite-b"))
        self.assertEqual(args[2][-1]["role"], "assistant")
        self.assertIn("=== FILE: frontend/public/app.js ===\n// repaired\n=== END ===", args[2][-1]["content"])
        self.assertEqual(budget.smoke["first_suite"], {"stopped": "4 repairs in a row were discarded", "rounds": 2})
        self.assertEqual(suites, [{"job": 1}])

    def test_a_spent_repair_budget_writes_no_second_suite(self):
        budget, calls, started, suites = self.run_look(stop="repair call limit reached (24)")
        self.assertFalse(started.called)
        self.assertEqual(calls, [])
