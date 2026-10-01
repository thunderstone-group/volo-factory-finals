"""Synthetic semantic/execution regressions; no model calls, credentials or network."""
import copy
import json
import os
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from oneshot import main as adapter, source_contracts as contracts

REQUIREMENTS = '''id: ROOT
name: Counter
type: FOLDER
children:
- id: REQ-1
  name: Adjust
  type: ATOMIC
  description: Positive amounts increase the balance. Negative amounts leave it unchanged.
'''
SOURCE = '''const scale = 2;
const delta = n => n * scale;
function adjust(state, amount) { state.balance += delta(amount); }
'''
PROBE = {"id": "REQ-1#contract-1", "requirement": "REQ-1", "explanation": "A negative input must retain the balance.",
         "functions": [{"file": "frontend/public/app.js", "name": "adjust", "kind": "function", "alias": "adjust"}],
         "initializers": ["frontend/public/seed.js"], "subject": "adjust",
         "setup": "globalThis.state=JSON.parse(JSON.stringify(SEED));",
         "precondition": "const initial=10; assert.equal(state.balance,initial);",
         "check": "const initial=10; adjust(state,-3); assert.equal(state.balance,initial);"}
NODE = shutil.which("node")
MODULES = contracts.PARSER_PREFIX / "node_modules"


@unittest.skipUnless(NODE and (MODULES / "acorn/package.json").is_file(), "installed Node/Acorn runtime required")
class SourceContractCase(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "frontend/public").mkdir(parents=True)
        self.file = self.root / "frontend/public/app.js"
        self.file.write_text(SOURCE)
        (self.root / "frontend/public/seed.js").write_text("window.SEED={balance:10};")
        self.suite = self.root / "suite"
        self.suite.mkdir()
        self.parser = patch.object(contracts, "ensure_parser", lambda env: (NODE, dict(env, NODE_PATH=str(MODULES))))
        self.parser.start()
        self.addCleanup(self.parser.stop)

    def run_probe(self, probe=None):
        return contracts.execute(self.root, [copy.deepcopy(probe or PROBE)], REQUIREMENTS)

    def test_rebinds_exact_changed_source_and_links_actual_dependencies(self):
        before = self.run_probe()
        self.assertEqual(before["results"][0]["status"], "fail")
        self.assertEqual(before["bindings"][0]["linked_dependencies"], ["delta", "scale"])
        self.file.write_text(SOURCE.replace("state.balance +=", "if(amount<0)return; state.balance +="))
        after = self.run_probe()
        self.assertEqual(after["results"][0]["status"], "pass")
        self.assertEqual(after["results"][0]["assertions"], 1)
        self.assertNotEqual(before["bindings"][0]["functions"][0]["source_sha256"],
                            after["bindings"][0]["functions"][0]["source_sha256"])

    def test_bad_precondition_is_unjudged_not_a_product_failure(self):
        p = copy.deepcopy(PROBE)
        p["precondition"] = "assert.equal(state.balance,20);"
        result = self.run_probe(p)["results"][0]
        self.assertEqual((result["status"], result["phase"]), ("error", "precondition"))

    def test_namespace_assignments_use_actual_helpers_values_and_receiver(self):
        self.file.write_text('''const unit=2; var Rules={};
Rules.scale=unit; Rules.calls=0;
Rules.delta=function(n){return n*this.scale;};
Rules.adjust=function(state,amount){this.calls++; state.balance+=this.delta(amount);};
''')
        p = copy.deepcopy(PROBE)
        p["functions"][0].update(name="Rules.adjust", kind="function")
        p["check"] = "Rules.adjust(state,-3); assert.equal(Rules.calls,1); assert.equal(state.balance,10);"
        before = self.run_probe(p)
        self.assertEqual(before["results"][0]["status"], "fail")
        self.assertEqual(before["results"][0]["assertions"], 2)
        self.file.write_text(self.file.read_text().replace("this.calls++;", "this.calls++; if(amount<0)return;"))
        self.assertEqual(self.run_probe(p)["results"][0]["status"], "pass")

    def test_unqualified_duplicate_namespace_members_are_not_guessed(self):
        self.file.write_text("var A={},B={}; A.adjust=s=>s.balance++; B.adjust=s=>s.balance--;")
        p = copy.deepcopy(PROBE)
        p["functions"][0]["kind"] = "method"
        self.assertIn("found 2", self.run_probe(p)["results"][0]["message"])

    def test_cross_namespace_constants_are_not_mistaken_for_application_bugs(self):
        self.file.write_text('''var Rules={},Rates={}; Rates.unit=2;
Rules.adjust=function(state,amount){state.balance+=amount*Rates.unit;};
''')
        p = copy.deepcopy(PROBE)
        p["functions"][0].update(name="Rules.adjust", kind="method")
        p["check"] = "Rules.adjust(state,3); assert.equal(state.balance,16);"
        self.assertEqual(self.run_probe(p)["results"][0]["status"], "pass")

    def test_precondition_calls_and_assertions_cannot_certify_the_check(self):
        p = copy.deepcopy(PROBE)
        p["precondition"] += "adjust(state,0);"
        p["check"] = "assert.equal(state.balance,10);"
        self.assertEqual(self.run_probe(p)["results"][0]["status"], "error")
        p["check"] = "adjust(state,0);"
        self.assertEqual(self.run_probe(p)["results"][0]["status"], "error")

    def test_mocking_the_subject_or_missing_context_is_unjudged(self):
        p = copy.deepcopy(PROBE)
        p["setup"] += "globalThis.adjust=()=>{};"
        self.assertEqual(self.run_probe(p)["results"][0]["status"], "error")
        p = copy.deepcopy(PROBE)
        p["check"] = "adjust(missingState,-3); assert.equal(state.balance,10);"
        self.assertEqual(self.run_probe(p)["results"][0]["status"], "error")

    def test_ambiguous_bindings_and_paths_outside_app_are_errors(self):
        self.file.write_text(SOURCE + "function container(){function adjust(){return 1;}}")
        self.assertIn("found 2", self.run_probe()["results"][0]["message"])
        p = copy.deepcopy(PROBE)
        p["functions"][0]["file"] = "../outside.js"
        self.assertEqual(self.run_probe(p)["results"][0]["status"], "error")

    def test_two_stage_review_executes_feedback_and_keeps_app_immutable(self):
        prompts = []
        reply = json.dumps([PROBE])
        def complete(messages):
            prompts.append(messages)
            return reply, {}, "stop"
        result = contracts.prepare(self.root, REQUIREMENTS, self.suite, complete)
        self.assertEqual(len(prompts), 2)
        self.assertIn('"status": "fail"', prompts[1][-1]["content"])
        self.assertEqual(result["validation"][0]["status"], "fail")
        self.assertEqual(self.file.read_text(), SOURCE)
        self.assertEqual(contracts.check(self.root, self.suite, REQUIREMENTS, only=[]), [])
        checks = contracts.check(self.root, self.suite, REQUIREMENTS)
        self.assertEqual(checks[0]["origin"], "source-contract")
        self.assertNotIn("verified_requirements", result)


class ContractIntegrationCase(unittest.TestCase):
    def test_fixture_errors_do_not_count_as_repair_gains(self):
        def state(status):
            return {"fatal": [], "static": {}, "missing": 0, "vocab": [], "browser": [],
                    "report": {"kind": "testgen", "scenarios": [{"id": "REQ-1#contract-1", "status": status}]}}
        accepted, reason, _ = adapter.judge(state("error"), state("pass"), Path("/unused"), REQUIREMENTS, set())
        self.assertFalse(accepted)
        self.assertIn("no failing scenario", reason)

    def test_contract_only_recheck_never_accidentally_runs_all_browser_tests(self):
        result = [{"id": "REQ-1#contract-1", "status": "pass", "origin": "source-contract"}]
        with patch.object(contracts, "check", return_value=result) as source, \
                patch.object(adapter._testgen_module(), "run_suite") as browser:
            report = adapter.check_scenarios(Path("/unused"), REQUIREMENTS,
                                             only=["REQ-1#contract-1"], tests="/suite")
        browser.assert_not_called()
        self.assertEqual(report["scenarios"], result)
        source.assert_called_once()

    def test_canonical_requirement_and_schema_bounds(self):
        p = contracts.definitions(json.dumps([PROBE]), REQUIREMENTS)[0]
        self.assertIn("Negative amounts", p["requirement_text"])
        with self.assertRaisesRegex(ValueError, "at most four"):
            contracts.definitions(json.dumps([PROBE] * 5), REQUIREMENTS)
        bad = copy.deepcopy(PROBE)
        bad["check"] += "fetch('https://invalid');"
        with self.assertRaisesRegex(ValueError, "self-contained"):
            contracts.definitions(json.dumps([bad]), REQUIREMENTS)

    def test_unavailable_diagnostics_preserve_the_browser_result(self):
        original = {"kind": "testgen", "scenarios": [{"id": "REQ-1", "status": "pass"}], "invariants": []}
        with patch.object(contracts, "check", side_effect=ValueError("invalid diagnostic file")), \
                patch.object(adapter._testgen_module(), "run_suite", return_value=original):
            report = adapter.check_scenarios(Path("/unused"), REQUIREMENTS, tests="/suite")
        self.assertEqual(report["scenarios"], original["scenarios"])
        self.assertIn("invalid diagnostic", report["source_contracts_error"])


if __name__ == "__main__":
    unittest.main()
