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


class DraftPairCase(unittest.TestCase):
    """main.generate with a written suite writes a second draft alongside the first; pick_draft judges it only when
    the first passes fewer than a third of the written tests, and the draft passing more goes on (roadmap 4.17)."""

    def setUp(self):
        import threading
        from unittest.mock import patch
        from oneshot import main as adapter
        self.adapter, self.patch = adapter, patch
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        done = threading.Thread(target=lambda: None)
        done.start()
        done.join()
        suite_dir = Path(self.temp.name) / "suite"
        suite_dir.mkdir()

        def finish(job, budget, wait=None):
            budget.suite = {"tests": 9}
            return suite_dir
        for target, value in (("SCAFFOLD", False), ("TESTGEN", True), ("SMOKE", True)):
            self.enter(patch.object(adapter, target, value))
        for target, kwargs in (("smoke_check", {"return_value": ([], True)}),
                               ("vocabulary_gaps", {"return_value": ([], 0)}), ("static_gaps", {"return_value": {}}),
                               ("start_suite", {"return_value": {"thread": done, "dir": Path(self.temp.name) / "x"}}),
                               ("finish_suite", {"side_effect": finish})):
            self.enter(patch.object(adapter, target, **kwargs))

    def enter(self, manager):
        value = manager.__enter__()
        self.addCleanup(manager.__exit__, None, None, None)
        return value

    def generate(self, drafts, passes):
        """`drafts` are the first and the second draft's app.js; `passes` maps a marker in app.js to how many of the
        nine written tests pass on it. Returns the published app.js, the budget and the app.js of each judged draft."""
        import threading
        from tests_oneshot.test_oneshot import application, block
        adapter, judged = self.adapter, []
        replies = [application(block("frontend/public/app.js", d)) for d in drafts]

        def complete(messages, model, base, key, budget, tries=3, salvage=None):
            record = budget.start(messages, model)
            record.update(status="completed", usage={"prompt_tokens": 10, "completion_tokens": 10})
            return replies[threading.current_thread().name == "oneshot-draft-2"], {}, "stop"

        def check(stage, requirements, only=None, translate=True, tests=None):
            text = (Path(stage) / "frontend/public/app.js").read_text()
            judged.append(text.strip())
            count = next(n for marker, n in passes.items() if marker in text)
            return {"kind": "testgen", "invariants": [], "scenarios": [
                {"id": f"REQ-{i}", "name": f"REQ-{i}", "status": "pass" if i < count else "fail", "steps": [],
                 "observation": "synthetic", "source": ""} for i in range(9)]}
        budget = adapter.CallBudget(repair_limit=0)
        out = Path(self.temp.name) / "out"
        with self.patch.object(adapter, "stream_completion", side_effect=complete), \
                self.patch.object(adapter, "check_scenarios", side_effect=check):
            adapter.generate(REQUIREMENTS, "m", "https://synthetic.invalid/v1", "k", out, budget)
        return (out / "frontend/public/app.js").read_text().strip(), budget, judged

    def test_a_weak_first_draft_gives_way_to_a_second_that_passes_more(self):
        published, budget, judged = self.generate(["// weak", "// strong"], {"weak": 1, "strong": 5})
        self.assertEqual(published, "// strong")
        self.assertEqual(judged, ["// weak", "// strong"])
        pair = budget.summary()["draft_pair"]
        self.assertEqual((pair["first"], pair["second"], pair["chosen"]), (1, 5, 2))
        self.assertEqual([c["phase"] for c in budget.side_calls if c["call"].startswith("draft2-")], ["draft"])

    def test_a_weaker_second_draft_is_judged_and_dropped(self):
        published, budget, judged = self.generate(["// weak", "// weaker"], {"weaker": 0, "weak": 2})
        self.assertEqual(published, "// weak")
        self.assertEqual(judged, ["// weak", "// weaker"])
        self.assertEqual(budget.pair["chosen"], 1)

    def test_a_first_draft_passing_a_third_goes_on_without_judging_the_second(self):
        published, budget, judged = self.generate(["// fine", "// better"], {"fine": 3, "better": 8})
        self.assertEqual(judged, ["// fine"])
        self.assertEqual(published, "// fine")
        self.assertEqual(budget.pair["second"], "not judged")
        self.assertEqual(budget.pair["chosen"], 1)

    def test_a_tie_keeps_the_first_draft(self):
        published, budget, judged = self.generate(["// one", "// two"], {"one": 2, "two": 2})
        self.assertEqual(judged, ["// one", "// two"])
        self.assertEqual(published, "// one")
        self.assertEqual(budget.pair["chosen"], 1)
