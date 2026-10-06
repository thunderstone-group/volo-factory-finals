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
from unittest.mock import patch

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
    def test_initial_entries_do_not_invent_parent_navigation_or_authentication(self):
        def document(given, when):
            return ('id: REQ-1\ntype: ATOMIC\nscenarios:\n- name: Open a saved note\n  steps:\n'
                    '  - keyword: GIVEN\n    content: ' + json.dumps(given) + '\n'
                    '  - keyword: WHEN\n    content: ' + json.dumps(when) + '\n')
        given = 'The visitor starts at the application home page in a fresh unauthenticated browser session.'
        when = 'The visitor opens the visible `Travel plans` note entry.'
        text = document(given, when)
        entries = testgen.initial_entries(text)
        self.assertEqual([(x["id"], x["name"]) for x in entries], [("REQ-1#entry-1", "Travel plans")])
        default_start = document('The visitor is unauthenticated.', 'The visitor opens Archive, then reads a note.')
        default_start = default_start.replace('type: ATOMIC', 'type: ATOMIC\ndescription: A link named “Archive” opens the archive.')
        self.assertEqual(testgen.initial_entries(default_start)[0]['name'], 'Archive')
        for given_case, when_case in [
            (given + ' A signed-in user has entered the editor.', when),
            ('The user is in an editor.', when),
            ('The unauthenticated visitor is on the settings page.', when),
            (given, 'The user signs in, then opens `Travel plans`.'),
            (given, 'The visitor searches for a notebook and opens `Travel plans`.'),
            (given, 'The visitor clicks “Export” in the editor.'),
            (given, 'The visitor opens an appropriate place.'),
        ]:
            text = document(given_case, when_case)
            self.assertEqual(testgen.initial_entries(text), [])

    def test_initial_entry_checks_are_fixed_and_do_not_call_the_writer(self):
        entry = {"id": "REQ-1#entry-1", "name": 'A "quoted" note', "scenario_id": "REQ-1",
                 "given": "fresh unauthenticated home page", "when": 'opens `A "quoted" note`'}
        with tempfile.TemporaryDirectory() as directory, \
                patch.object(testgen, "initial_entries", return_value=[entry]):
            manifest = testgen.add_initial_entry_checks("", directory,
                {"files": [], "scenarios": 1, "tests": 0})
            source = (Path(directory) / manifest["files"][0]["file"]).read_text()
            self.assertIn("await page.goto('/')", source)
            self.assertIn(".closest(", source)
            self.assertNotIn(".click()", source)
            self.assertEqual(manifest["files"][0]["calls"], 0)
            self.assertEqual(manifest["initial_entry_checks"], [entry])
            if shutil.which('node'):
                checked = subprocess.run(['node', '--check', str(Path(directory) / manifest['files'][0]['file'])],
                                         capture_output=True, text=True)
                self.assertEqual(checked.returncode, 0, checked.stderr)

    def test_initial_checks_do_not_replace_a_failed_written_suite(self):
        with tempfile.TemporaryDirectory() as directory, \
                patch.object(testgen, "add_initial_entry_checks") as add_entries:
            manifest = testgen.write_suite(REQUIREMENTS, directory,
                lambda messages: ("No file block", None, "stop"), workers=1, audit=False)
            self.assertFalse(testgen.runnable(manifest))
            add_entries.assert_not_called()

    def test_groups_follow_top_folders_and_never_split_a_requirement(self):
        groups = testgen.plan(REQUIREMENTS)
        self.assertEqual([g["file"] for g in groups], ["t01-REQ-1.spec.cjs", "t02-REQ-2.spec.cjs"])
        self.assertEqual([i["id"] for i in groups[0]["items"]], ["REQ-1-1", "REQ-1-1#2", "REQ-1-2"])
        small = testgen.plan(REQUIREMENTS, limit=2)
        self.assertEqual([[i["id"] for i in g["items"]] for g in small],
                         [["REQ-1-1", "REQ-1-1#2"], ["REQ-1-2"], ["REQ-2-1"]])

    def test_bare_scenario_names_get_their_ids_in_listed_order(self):
        # 09-28: masked names repeat within a requirement; a file titling tests by the bare name did not load.
        group = {"items": [{"id": "REQ-1", "name": "REQ-1 -the requested workflow"},
                           {"id": "REQ-1#2", "name": "REQ-1 -the requested workflow"},
                           {"id": "REQ-1#3", "name": "REQ-1 -the requested workflow"}]}
        body = ("test('REQ-1#2: REQ-1 -the requested workflow', async () => {});\n"
                "test('REQ-1 -the requested workflow', async () => {});\n"
                "test(\"REQ-1 -the requested workflow\", async () => {});\n"
                "test('Something else', async () => {});\n")
        named = testgen.name_tests(body, group)
        self.assertEqual([m.group(2) for m in testgen.TITLE.finditer(named)],
                         ["REQ-1#2: REQ-1 -the requested workflow", "REQ-1: REQ-1 -the requested workflow",
                          "REQ-1#3: REQ-1 -the requested workflow", "Something else"])
        self.assertEqual(testgen.name_tests(named, group), named)

    def test_request_lists_the_scenarios_and_carries_prerequisites(self):
        group = testgen.plan(REQUIREMENTS)[0]
        system, user = testgen.request(REQUIREMENTS, group, "Seed: synthetic")
        self.assertIn("=== FILE: t01-REQ-1.spec.cjs ===", user["content"])
        # Every file's request shares everything up to its scenario list, so the gateway's prefix cache serves it.
        other = testgen.request(REQUIREMENTS, testgen.plan(REQUIREMENTS)[1], "Seed: synthetic")
        self.assertEqual(system, other[0])
        self.assertEqual(user["content"].split("\n\nWrite `")[0], other[1]["content"].split("\n\nWrite `")[0])
        self.assertIn("- REQ-1-1#2: Add two  (scenario 2 of REQ-1-1)", user["content"])
        self.assertIn("Seed: synthetic", user["content"])
        self.assertIn("const { test, expect } = require('@playwright/test');", system["content"])


class WriteCase(unittest.TestCase):
    def test_writes_each_file_retries_a_reply_without_a_block_and_survives_a_failed_call(self):
        calls = []

        def complete(messages):
            calls.append(messages[-1]["content"])
            name = next(g["file"] for g in testgen.plan(REQUIREMENTS) if g["file"] in messages[-1]["content"])
            if name.startswith("t02"):
                raise RuntimeError("synthetic transport failure")
            if sum(name in c for c in calls) == 1:
                return "Sorry, no file.", {}, "stop"
            body = ("const { test, expect } = require('@playwright/test');\n"
                    "test('REQ-1-1: Add one', async ({ page }) => {});\n"
                    "test.skip('REQ-1-1#2: Add two', async () => {});\n")
            return f"=== FILE: {name} ===\n{body}=== END ===", {}, "stop"

        with tempfile.TemporaryDirectory() as temp:
            manifest = testgen.write_suite(REQUIREMENTS, temp, complete, workers=1, audit=False)
            saved = json.loads((Path(temp) / "suite.json").read_text())
        self.assertEqual(saved, manifest)
        first, second = manifest["files"]
        self.assertEqual((first["calls"], first["tests"]), (2, ["REQ-1-1: Add one", "REQ-1-1#2: Add two"]))
        self.assertNotIn("error", first)
        self.assertIn("synthetic transport failure", second["error"])
        self.assertTrue(testgen.runnable(manifest))
        self.assertFalse(testgen.runnable({"files": [second]}))


class AuditCase(unittest.TestCase):
    """Synthetic model replies exercise preservation and grounding, not generation quality."""

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.suite = Path(self.temp.name)
        self.group = testgen.plan(REQUIREMENTS)[0]
        self.path = self.suite / self.group["file"]
        self.original = "const { test, expect } = require('@playwright/test');\ntest('REQ-1-1: Add one', async () => { expect(1).toBe(1); });\n"
        self.path.write_text(self.original)
        self.manifest = {"scenarios": 3, "files": [{"file": self.path.name, "tests": ["REQ-1-1: Add one"]}]}
        (self.suite / "suite.json").write_text(json.dumps(self.manifest))
        self.claim = {"id": "REQ-1-2#audit-1", "requirement": "REQ-1-2",
                      "quote": 'Double-clicking a note opens a text box named “Edit <note title>”.',
                      "gap": "The existing test never checks the editor."}
        self.addition = "test('REQ-1-2#audit-1: Editor', async ({ page }) => { await expect(page.getByRole('textbox')).toBeVisible(); });"

    def complete(self, messages):
        self.assertIn(self.original.rstrip(), messages[-2]["content"])
        return ("=== FILE: coverage.json ===\n" + json.dumps([self.claim]) + "\n=== END ===\n"
                "=== FILE: additions.cjs ===\n" + self.addition + "\n=== END ==="), {}, "stop"

    def test_appends_grounded_checks_without_rewriting_old_tests_and_is_idempotent(self):
        manifest = testgen.audit_suite(REQUIREMENTS, self.suite, self.complete, workers=1)
        self.assertTrue(self.path.read_text().startswith(self.original))
        self.assertEqual(manifest["audit_checks"], 1)
        self.assertEqual(manifest["tests"], 2)
        self.assertEqual(manifest["files"][0]["tests"][0], "REQ-1-1: Add one")
        again = testgen.audit_suite(REQUIREMENTS, self.suite, lambda _: self.fail("audit repeated"), workers=1)
        self.assertEqual(again["tests"], 2)

    def test_unfounded_quote_preserves_the_original_suite(self):
        self.claim["quote"] = "An invented requirement which was never in the document."
        manifest = testgen.audit_suite(REQUIREMENTS, self.suite, self.complete, workers=1)
        self.assertEqual(self.path.read_text(), self.original)
        self.assertEqual(manifest["audit_checks"], 0)
        self.assertIn("verbatim", manifest["files"][0]["audit"]["error"])

    def test_accepts_assertions_in_existing_helpers_without_changing_them(self):
        # Live Sheet audit replies used expectCellText/expectCellFormula rather than inline expect calls.
        self.original = ("async function expectEditor(page) {\n"
                         "  await expect(page.getByRole('textbox')).toBeVisible();\n}\n"
                         "const verifyEditor = async (page) => { await expectEditor(page); };\n" + self.original)
        self.path.write_text(self.original)
        self.addition = "test('REQ-1-2#audit-1: Editor', async ({ page }) => { await verifyEditor(page); });"
        result = testgen.audit_suite(REQUIREMENTS, self.suite, self.complete, workers=1)
        self.assertEqual(result["audit_checks"], 1)
        self.assertTrue(self.path.read_text().startswith(self.original))

    def test_helper_name_alone_does_not_count_as_an_assertion(self):
        self.original = ("async function expectEditor(page) { await page.getByRole('textbox').click(); }\n"
                         + self.original)
        self.path.write_text(self.original)
        self.addition = "test('REQ-1-2#audit-1: Editor', async ({ page }) => { await expectEditor(page); });"
        result = testgen.audit_suite(REQUIREMENTS, self.suite, self.complete, workers=1)
        self.assertEqual(result["audit_checks"], 0)
        self.assertIn("observable assertion", result["files"][0]["audit"]["error"])
        self.assertEqual(self.path.read_text(), self.original)

    def test_one_unfounded_check_does_not_discard_a_separate_grounded_check(self):
        def complete(messages):
            content, usage, finish = self.complete(messages)
            bad = dict(self.claim, id="REQ-1-2#audit-2", quote="A made up obligation which is not in the requirement.")
            content = content.replace(json.dumps([self.claim]), json.dumps([self.claim, bad]))
            content = content.replace(self.addition, self.addition + "\n" +
                                      self.addition.replace("#audit-1", "#audit-2"))
            return content, usage, finish
        result = testgen.audit_suite(REQUIREMENTS, self.suite, complete, workers=1)
        self.assertEqual(result["audit_checks"], 1)
        self.assertIn("#audit-1", self.path.read_text())
        self.assertNotIn("#audit-2", self.path.read_text())
        self.assertEqual(result["files"][0]["audit"]["rejected"][0]["id"], "REQ-1-2#audit-2")

    def test_unmatched_ids_or_suite_configuration_cannot_be_appended(self):
        original_addition = self.addition
        for addition in [original_addition.replace("REQ-1-2#audit-1", "REQ-2-1#audit-1"),
                         "test.beforeEach(() => {});\n" + original_addition,
                         original_addition.replace("test(", "test.only(")]:
            with self.subTest(addition=addition):
                (self.suite / "suite.json").write_text(json.dumps(self.manifest))
                self.addition = addition
                result = testgen.audit_suite(REQUIREMENTS, self.suite, self.complete, workers=1)
                self.assertIn("error", result["files"][0]["audit"])
                self.assertEqual(self.path.read_text(), self.original)


def result(status, message="", line=None, file="t01-REQ-1.spec.cjs", snippet=""):
    error = {"message": message, "stack": message, "snippet": snippet}
    if line:
        error["location"] = {"file": "/suite/" + file, "line": line, "column": 5}
    return {"status": status, "duration": 1234, "errors": [error] if message else []}


class ParseCase(unittest.TestCase):
    def test_page_snapshot_is_bounded_and_cannot_read_an_external_attachment(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            work = root / 'runner'; work.mkdir()
            snapshot = work / 'results' / 'case' / 'error-context.md'
            snapshot.parent.mkdir(parents=True)
            snapshot.write_text('Creation page\n' + 'grid rows\n' * 1000 + '\nalert: a required field is missing')
            report = work / 'report.json'
            result = {'attachments': [{'name': 'error-context', 'path': str(snapshot)}]}
            text = testgen.page_snapshot(result, report)
            self.assertIn('Creation page', text)
            self.assertIn('required field is missing', text)
            self.assertLess(len(text), 2500)
            external = root / 'error-context.md'; external.write_text('must not be read')
            result['attachments'][0]['path'] = str(external)
            self.assertEqual(testgen.page_snapshot(result, report), '')

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
        self.assertTrue(testgen.ungrounded("E1", source, "A catalog has named records.", testgen._phrases("")))


class RunCase(unittest.TestCase):
    def test_per_test_fixtures_in_suite_hooks_are_sent_to_the_test_writer(self):
        # Reproduce the real Playwright error seen after a passing application assertion.
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            app, suite = root / "app", root / "suite"
            (app / "backend").mkdir(parents=True)
            (app / "frontend").mkdir()
            (app / "backend/server.js").write_text(APP_SERVER)
            (app / "backend/package.json").write_text('{"scripts":{"start":"node server.js"}}')
            suite.mkdir()
            filename = "t01-REQ-1.spec.cjs"
            (suite / "suite.json").write_text(json.dumps({"files": [
                {"file": filename, "tests": ["REQ-1-1: Add one"]}]}))
            for hook in ("beforeAll", "afterAll"):
                with self.subTest(hook=hook):
                    (suite / filename).write_text(
                        "const {test,expect}=require('@playwright/test');\n"
                        "test('REQ-1-1: Add one',async({page})=>{await page.goto('/');"
                        "await expect(page.getByRole('button',{name:'Add note'})).toBeVisible();});\n"
                        "test.%s(async({page})=>{await page.goto('/');});\n" % hook)
                    report = testgen.run_suite(app, suite, REQUIREMENTS)
                    self.assertEqual(report['scenarios'][0]['status'], 'error', report)
                    self.assertIn(filename, testgen.own_breaks(report))
                    self.assertIn('fixtures are not supported', report['scenarios'][0]['observation'])

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
            failed = next(e for e in report["scenarios"] if e['id'] == 'REQ-1-2')
            self.assertIn('Add note', failed.get('page_snapshot', ''), failed)
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

    def run_loop(self, reports, replies, **options):
        adapter, sent = self.adapter, []

        self.keys = []

        def complete(messages, model, base, key, budget, tries=3, salvage=None):
            sent.append(messages[-1]["content"])
            self.keys.append(key)
            record = budget.start(messages, model)
            record.update(status="completed", usage={"prompt_tokens": 10, "completion_tokens": 10})
            return replies.pop(0), {}, "stop"
        budget = adapter.CallBudget(repair_limit=len(replies))
        budget.phase = "repair"
        with self.patch.object(adapter, "check_scenarios", side_effect=reports) as check, \
                self.patch.object(adapter, "stream_completion", side_effect=complete):
            adapter.repair_delivery(self.stage, list(self.files), [{"role": "user", "content": "draft"}], "m", "b", "k",
                                    budget, requirements="synthetic", tests=Path(self.temp.name) / "suite", **options)
        return sent, budget, check

    def test_source_repair_stops_after_its_targets_pass_and_keeps_other_failures_visible(self):
        from tests_oneshot.test_oneshot import block
        before = self.report({"old-failure": "fail", "new-contract": "fail", "protected": "pass"})
        after = self.report({"old-failure": "fail", "new-contract": "pass", "protected": "pass"})
        recheck = self.report({"new-contract": "pass"})
        sent, budget, check = self.run_loop([before, after, recheck],
            [block("frontend/public/app.js", "// repaired"), "unused"], repair_targets={"new-contract"})
        self.assertEqual(len(sent), 1)
        self.assertNotIn("/* body of old-failure */", sent[0])
        self.assertIn("protected", sent[0])
        self.assertEqual(budget.smoke['stopped'], 'requested source checks pass')
        self.assertEqual(budget.smoke['scenarios_after']['counts'], {'fail': 1, 'pass': 2})
        self.assertTrue(budget.smoke['rounds'][0]['accepted'])

    def test_source_repair_still_rejects_regressions_outside_its_targets(self):
        from tests_oneshot.test_oneshot import block
        before = self.report({"old-failure": "fail", "new-contract": "fail", "protected": "pass"})
        after = self.report({"old-failure": "fail", "new-contract": "pass", "protected": "fail"})
        recheck = self.report({"new-contract": "pass", "protected": "fail"})
        _, budget, _ = self.run_loop([before, after, recheck],
            [block("frontend/public/app.js", "// rejected")], repair_targets={"new-contract"})
        self.assertFalse(budget.smoke['rounds'][0]['accepted'])
        self.assertFalse((self.stage/'frontend/public/app.js').exists())

    def test_unjudged_source_target_is_not_reported_as_fixed(self):
        report = self.report({"old-failure": "fail", "new-contract": "error", "protected": "pass"})
        sent, budget, _ = self.run_loop([report], [], repair_targets={"new-contract"})
        self.assertEqual(sent, [])
        self.assertEqual(budget.smoke['stopped'], 'requested source checks are unjudged')

    def test_source_target_scope_keeps_the_discard_limit(self):
        from tests_oneshot.test_oneshot import block
        report = self.report({"old-failure": "fail", "new-contract": "fail", "protected": "pass"})
        sent, budget, _ = self.run_loop([report] * 5,
            [block("frontend/public/app.js", "// ineffective")] * 6, repair_targets={"new-contract"})
        self.assertEqual(len(sent), 4)
        self.assertEqual(budget.smoke['stopped'], '4 repairs in a row were discarded')

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

    def test_literal_inventory_does_not_add_a_penalty_to_written_verdicts(self):
        from tests_oneshot.test_oneshot import block
        many = {f"REQ-{i}": "fail" for i in range(1, 7)}
        before = self.report({**many, "REQ-9": "pass"})
        after = self.report({**{k: "pass" for k in many}, "REQ-9": "pass"})
        vocab = iter([([], 0), ([], 1)])
        with self.patch.object(self.adapter, "vocabulary_gaps", side_effect=lambda *a, **k: next(vocab, ([], 1))):
            _, budget, _ = self.run_loop([before, after], [block("frontend/public/app.js", "// repaired")])
        record = budget.smoke["rounds"][0]
        self.assertTrue(record["accepted"], record)
        self.assertNotIn("removed quoted vocabulary", record["reason"])
        self.assertNotIn("waived", record)

    def test_literal_inventory_does_not_reject_an_executed_small_gain(self):
        from tests_oneshot.test_oneshot import block
        before = self.report({"REQ-1": "fail", "REQ-2": "fail", "REQ-9": "pass"})
        after = self.report({"REQ-1": "pass", "REQ-2": "pass", "REQ-9": "pass"})
        recheck = self.report({"REQ-1": "pass", "REQ-2": "pass"})
        vocab = iter([([], 0), ([], 1)])
        with self.patch.object(self.adapter, "vocabulary_gaps", side_effect=lambda *a, **k: next(vocab, ([], 1))):
            _, budget, _ = self.run_loop([before, after, recheck], [block("frontend/public/app.js", "// repaired")])
        record = budget.smoke["rounds"][0]
        self.assertTrue(record["accepted"], record)
        self.assertNotIn("removed quoted vocabulary", record["reason"])

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

    def test_a_repair_that_fixes_some_and_breaks_others_gets_one_follow_up_that_can_save_it(self):
        before = self.report({"REQ-1": "fail", "REQ-2": "fail", "REQ-8": "pass", "REQ-9": "pass"})
        broke = self.report({"REQ-1": "pass", "REQ-2": "fail", "REQ-8": "pass", "REQ-9": "fail"})
        mended = self.report({"REQ-1": "pass", "REQ-2": "fail", "REQ-8": "pass", "REQ-9": "pass"})
        sent, budget, _ = self.run_loop([before, broke, broke, mended, mended], [
            self.edit("frontend/build.js", "// Synthetic build fixture", "// step one"),
            self.edit("frontend/build.js", "// step one", "// step two")])
        record = budget.smoke["rounds"][0]
        self.assertTrue(record["accepted"], record)
        self.assertEqual(record["follow_up"], "regression")
        self.assertEqual(record["first_try"]["lost"], 1)
        self.assertIn("broke 1 that passed before", sent[1])
        self.assertIn("- REQ-9 ", sent[1])
        self.assertEqual((self.stage / "frontend/build.js").read_text().strip(), "// step two")

    def test_after_a_discard_each_round_takes_one_failing_requirement_until_every_one_had_a_round(self):
        before = self.report({f"REQ-{i}": "fail" for i in range(1, 7)} | {"REQ-9": "pass"})
        replies = [self.edit("frontend/build.js", "// Synthetic build fixture", "// same") for _ in range(8)]
        sent, budget, _ = self.run_loop([before] * 9, replies)
        rounds = budget.smoke["rounds"]
        self.assertEqual(len(rounds), 7, [r.get("reason") for r in rounds])
        self.assertNotIn("focus", rounds[0])
        self.assertEqual([r["focus"] for r in rounds[1:]], [[f"REQ-{i}"] for i in range(1, 7)])
        self.assertIn("make only the 1 test(s) below pass", sent[1])
        self.assertIn("- REQ-1 ", sent[1])
        self.assertNotIn("- REQ-2 ", sent[1])
        self.assertEqual(budget.smoke["stopped"], f"{self.adapter.REPAIR_REJECTIONS} repairs in a row were discarded")
        # 09-28: the focused rounds rebound the API key to a requirement id and every later call got HTTP 401.
        self.assertEqual(set(self.keys), {"k"})

    def test_a_kept_round_after_a_focused_one_goes_back_to_the_whole_list(self):
        before = self.report({"REQ-1": "fail", "REQ-2": "fail", "REQ-9": "pass"})
        fixed = self.report({"REQ-1": "pass", "REQ-2": "fail", "REQ-9": "pass"})
        sent, budget, _ = self.run_loop([before, before, fixed, fixed, fixed], [
            self.edit("frontend/build.js", "// Synthetic build fixture", "// same"),
            self.edit("frontend/build.js", "// Synthetic build fixture", "// one"),
            self.edit("frontend/build.js", "// one", "// two")])
        rounds = budget.smoke["rounds"]
        self.assertFalse(rounds[0]["accepted"])
        self.assertEqual(rounds[1]["focus"], ["REQ-1"])
        self.assertTrue(rounds[1]["accepted"], rounds[1])
        self.assertNotIn("focus", rounds[2])
        self.assertNotIn("Work on one finding at a time", sent[2])

    def test_a_lost_test_that_passes_alone_but_fails_in_order_stays_lost(self):
        before = self.report({"REQ-1": "fail", "REQ-2": "fail", "REQ-3": "fail", "REQ-8": "pass"})
        after = self.report({"REQ-1": "pass", "REQ-2": "pass", "REQ-3": "fail", "REQ-8": "fail"})
        alone = self.report({"REQ-1": "pass", "REQ-2": "pass", "REQ-8": "pass"})
        in_order = self.report({"REQ-1": "pass", "REQ-2": "pass", "REQ-3": "fail", "REQ-8": "fail"})
        _, budget, _ = self.run_loop([before, after, alone, in_order], [
            self.edit("frontend/build.js", "// Synthetic build fixture", "// one")])
        record = budget.smoke["rounds"][0]
        self.assertFalse(record["accepted"], record)
        self.assertIn("broke 1 passing scenario(s): REQ-8", record["reason"])
        self.assertEqual(record["order_recheck"], {"REQ-8": "fail"})

    def test_a_lost_test_that_passes_alone_and_in_order_is_flaky(self):
        before = self.report({"REQ-1": "fail", "REQ-2": "fail", "REQ-3": "fail", "REQ-8": "pass"})
        after = self.report({"REQ-1": "pass", "REQ-2": "pass", "REQ-3": "fail", "REQ-8": "fail"})
        alone = self.report({"REQ-1": "pass", "REQ-2": "pass", "REQ-8": "pass"})
        in_order = self.report({"REQ-1": "pass", "REQ-2": "pass", "REQ-3": "fail", "REQ-8": "pass"})
        _, budget, _ = self.run_loop([before, after, alone, in_order], [
            self.edit("frontend/build.js", "// Synthetic build fixture", "// one")])
        record = budget.smoke["rounds"][0]
        self.assertTrue(record["accepted"], record)
        self.assertEqual(record["flaky"], ["REQ-8"])

    def test_a_passing_test_the_changed_run_never_reached_is_lost(self):
        before = self.report({"REQ-1": "fail", "REQ-8": "pass"})
        after = self.report({"REQ-1": "pass", "REQ-8": "error"})
        after["scenarios"][1]["observation"] = "Not run: the suite was stopped at its 900 s limit"
        _, budget, _ = self.run_loop([before, after, after], [
            self.edit("frontend/build.js", "// Synthetic build fixture", "// one")])
        record = budget.smoke["rounds"][0]
        self.assertFalse(record["accepted"], record)
        self.assertIn("REQ-8", record["reason"])

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
        self.assertTrue(testgen.ungrounded("Sheet3", "'Sheet3'", "A record named Sheet1 exists.", testgen._phrases("")))


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


SLIPS = r"""const { test, expect } = require('@playwright/test');
async function cell(page, name) {
  return page.getByRole('button', { name, exact: true });
}
async function press(name) {
  await page.getByRole('button', { name, exact: true }).click();
}
const pattern = /[{'"`]/;
test('REQ-1-1: Add one', async ({ page }) => {
  await page.goto('/');
  await cell(page, 'Add note').scrollIntoViewIfNeeded();
  await press('Add note');
  await expect(page.getByText('Added', { exact: true })).toBeVisible();
});
"""


class HardenCase(unittest.TestCase):
    def test_an_async_function_that_never_awaits_loses_async_and_one_that_awaits_keeps_it(self):
        out = testgen._needless_async(SLIPS)
        self.assertIn("\nfunction cell(page, name) {", out)
        self.assertIn("async function press(name) {", out)
        self.assertIn("async ({ page }) => {", out)  # the test body awaits
        arrow = "const f = async (x) => { return x.locator('a{'); };\nconst g = async (y) => { await y; };\n"
        self.assertEqual(testgen._needless_async(arrow),
                         "const f = (x) => { return x.locator('a{'); };\nconst g = async (y) => { await y; };\n")

    def test_the_page_shim_is_added_once_and_a_rewrite_that_does_not_parse_is_dropped(self):
        once = testgen.harden(SLIPS)
        self.assertEqual(once.count("globalThis.page = page"), 1)
        self.assertEqual(testgen.harden(once).count("globalThis.page = page"), 1)
        kept = testgen.harden(SLIPS, check=lambda text: False)
        self.assertIn("async function cell(page, name)", kept)  # the rewrite was refused, the shim stays
        self.assertIn("globalThis.page = page", kept)

    @unittest.skipUnless(shutil.which("node") and shutil.which("npm"), "node and npm are required")
    def test_a_hardened_file_runs_where_the_written_one_broke_in_its_own_code(self):
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
            (suite / "t01-REQ-1.spec.cjs").write_text(SLIPS)
            (suite / "suite.json").write_text(json.dumps({"files": [{"file": "t01-REQ-1.spec.cjs",
                                                                     "tests": ["REQ-1-1: Add one"]}]}))
            before = testgen.run_suite(app, suite, REQUIREMENTS)
            self.assertEqual(before["scenarios"][0]["status"], "error", before)
            self.assertTrue(before["scenarios"][0]["observation"].startswith("The test's own code threw"))
            path = suite / "t01-REQ-1.spec.cjs"
            path.write_text(testgen.harden(SLIPS, lambda t: testgen._parses(shutil.which("node"), path, t)))
            after = testgen.run_suite(app, suite, REQUIREMENTS)
            self.assertEqual(after["scenarios"][0]["status"], "pass", after)


class FixSuiteCase(unittest.TestCase):
    def suite(self, temp, body):
        suite = Path(temp)
        (suite / "t01-REQ-1.spec.cjs").write_text(body)
        (suite / "suite.json").write_text(json.dumps({"files": [{"file": "t01-REQ-1.spec.cjs", "tests": [
            "REQ-1-1: Add one", "REQ-1-2: Edit one"]}], "tests": 2, "prerequisites": ""}))
        return suite

    REPORT = {"kind": "testgen", "scenarios": [
        {"id": "REQ-1-1", "status": "error", "file": "t01-REQ-1.spec.cjs", "at": "t01-REQ-1.spec.cjs:2",
         "observation": "The test's own code threw: ReferenceError: grid is not defined"},
        {"id": "REQ-1-2", "status": "error", "file": "t01-REQ-1.spec.cjs",
         "observation": "Blocked by helper:t01-REQ-1.spec.cjs:9 (shared with 1 other test(s))."}]}

    def test_only_tests_broken_in_their_own_code_go_back_and_the_reply_replaces_the_file(self):
        self.assertEqual({k: [e["id"] for e in v] for k, v in testgen.own_breaks(self.REPORT).items()},
                         {"t01-REQ-1.spec.cjs": ["REQ-1-1"]})
        body = "const { test } = require('@playwright/test');\ntest('REQ-1-1: Add one', async () => { grid; });\n"
        fixed = ("const { test } = require('@playwright/test');\ntest('REQ-1-1: Add one', async () => {});\n"
                 "test('REQ-1-2: Edit one', async () => {});\n")
        seen = []

        def complete(messages):
            seen.append(messages)
            return f"=== FILE: t01-REQ-1.spec.cjs ===\n{fixed}=== END ===", {}, "stop"
        with tempfile.TemporaryDirectory() as temp:
            suite = self.suite(temp, body)
            self.assertEqual(testgen.fix_suite(REQUIREMENTS, suite, self.REPORT, complete), ["t01-REQ-1.spec.cjs"])
            self.assertEqual(len(seen), 1)
            self.assertEqual(seen[0][-2]["role"], "assistant")  # the file as written is the writer's own reply
            self.assertIn("REQ-1-1: The test's own code threw: ReferenceError: grid is not defined", seen[0][-1]["content"])
            self.assertIn("at line 2: test('REQ-1-1: Add one'", seen[0][-1]["content"])
            self.assertNotIn("REQ-1-2:", seen[0][-1]["content"].split("=== FILE")[0])
            written = (suite / "t01-REQ-1.spec.cjs").read_text()
            self.assertIn("test('REQ-1-2: Edit one'", written)
            self.assertIn("globalThis.page = page", written)
            self.assertEqual(json.loads((suite / "suite.json").read_text())["files"][0]["fixed"], 1)

    def test_a_rewrite_that_drops_a_test_skips_one_or_loses_an_assertion_leaves_the_file(self):
        body = ("const { test, expect } = require('@playwright/test');\n"
                "test('REQ-1-1: Add one', async ({ page }) => { grid; await expect(page).toHaveTitle('x'); });\n"
                "test('REQ-1-2: Edit one', async ({ page }) => { await expect(page).toHaveTitle('y'); });\n")
        replies = {
            "dropped": "const { test, expect } = require('@playwright/test');\n"
                       "test('REQ-1-1: Add one', async ({ page }) => { await expect(page).toHaveTitle('x'); });\n",
            "skipped": body.replace("grid; ", "").replace("test('REQ-1-2", "test.skip('REQ-1-2"),
            "weaker": body.replace("grid; await expect(page).toHaveTitle('x');", ""),
        }
        for kind, fixed in replies.items():
            with self.subTest(kind), tempfile.TemporaryDirectory() as temp:
                suite = self.suite(temp, body)
                reply = f"=== FILE: t01-REQ-1.spec.cjs ===\n{fixed}=== END ==="
                self.assertEqual(testgen.fix_suite(REQUIREMENTS, suite, self.REPORT, lambda m: (reply, {}, "stop")), [])
                self.assertEqual((suite / "t01-REQ-1.spec.cjs").read_text(), body)
        self.assertTrue(testgen.faithful(body, body.replace("grid; ", "")))

    def test_an_expect_on_something_other_than_a_locator_is_the_tests_own_error(self):
        result = {"status": "failed", "errors": [{"message": "Error: toHaveText can be only used with Locator object",
                                                  "stack": "Error: toHaveText can be only used with Locator object\n at x"}]}
        status, observation, _ = testgen._classify(result, "", "", (set(), []))
        self.assertEqual(status, "error")
        self.assertTrue(observation.startswith("The test's own code threw"))

    def test_an_unavailable_expect_matcher_is_not_a_product_failure(self):
        # Actual Playwright 1.57 error from a requirements-only generated suite.
        for matcher in ("toBeSelected", "toHaveInventedState"):
            failure = {"status": "failed", "errors": [{
                "message": "Error: expect: Property '%s' not found." % matcher}]}
            status, observation, _ = testgen._classify(failure, "", "", (set(), []))
            self.assertEqual(status, "error")
            self.assertTrue(observation.startswith("The test's own code threw"))
        mismatch = {"status": "failed", "errors": [{
            "message": 'Error: expect(locator).toHaveValue(expected)\nExpected: "Write"\nReceived: "Read"'}]}
        self.assertEqual(testgen._classify(mismatch, "", "", (set(), []))[0], "fail")

    @unittest.skipUnless(shutil.which("node"), "node is required")
    def test_a_reply_that_does_not_parse_leaves_the_file_as_it_was(self):
        body = "const { test } = require('@playwright/test');\ntest('REQ-1-1: Add one', async () => { grid; });\n"
        with tempfile.TemporaryDirectory() as temp:
            suite = self.suite(temp, body)
            reply = "=== FILE: t01-REQ-1.spec.cjs ===\ntest('REQ-1-1: Add one', async () => { `x ${ });\n=== END ==="
            self.assertEqual(testgen.fix_suite(REQUIREMENTS, suite, self.REPORT, lambda m: (reply, {}, "stop")), [])
            self.assertEqual((suite / "t01-REQ-1.spec.cjs").read_text(), body)
