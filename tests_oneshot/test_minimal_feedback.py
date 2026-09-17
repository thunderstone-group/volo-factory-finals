"""Synthetic apps/responses, real Node syntax checks; never quality scores."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

from oneshot import main as baseline
from oneshot import minimal_feedback as experiment
from test_oneshot import application, block


class Fixture:
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.app, self.out = self.root / "app", self.root / "out"
        for item in baseline.parse_blocks(application())[0]:
            baseline.write_one(self.app, item)
        (self.app / "backend/server.js").write_text("const broken = ;\n")
        (self.app / "backend/kept.cjs").write_text("module.exports = 7;\n")
        (self.app / ".env").write_text("SYNTHETIC_SECRET=preserve-without-reading\n")
        (self.app / "frontend/public/logo.bin").write_bytes(b"\xff\x00asset")
        (self.app / "frontend/dist").mkdir()
        (self.app / "frontend/dist/index.html").write_text("old-build")
        self.before = self.tree(self.app)
        self.gateway = patch.object(baseline, "_open_model", side_effect=AssertionError("network forbidden")).start()
        self.addCleanup(patch.stopall)
        self.addCleanup(lambda: self.gateway.assert_not_called())

    @staticmethod
    def tree(root):
        return {p.relative_to(root).as_posix(): p.read_bytes() for p in root.rglob("*") if p.is_file()}

    def run_replay(self, *responses, max_rounds=2, **kwargs):
        result = experiment.run(self.app, self.out, responses=responses, max_rounds=max_rounds, **kwargs)
        self.assertEqual(self.tree(self.app), self.before)
        self.assertEqual(result["verified_requirements"], [])
        self.assertEqual(result["behavior"], "unknown")
        self.assertEqual(result["model_api_calls"], 0)
        self.assertIsNone(result["cost"])
        self.assertEqual(list(self.root.glob(".minimal-feedback-*")), [])
        return result


class FeedbackTests(Fixture, unittest.TestCase):
    def test_zero_rounds_is_byte_equivalent_without_checker_or_replay(self):
        with patch.object(experiment, "check_syntax", side_effect=AssertionError("zero must bypass")):
            report = self.run_replay("bad response", max_rounds=0)
        self.assertEqual(self.tree(self.out), self.before)
        self.assertEqual(report["stop_reason"], "zero_rounds")
        self.assertEqual(report["replay_calls"], 0)

    def test_invalid_limits_and_overlap_fail_before_process_or_gateway(self):
        for n in (-1, 3, True, float("nan")):
            with self.assertRaises(ValueError):
                experiment.run(self.app, self.out, max_rounds=n)
        for out in (self.app, self.app / "child", self.root):
            with self.assertRaises(ValueError):
                experiment.run(self.app, out)
        with self.assertRaises(ValueError):
            experiment.run(self.app, self.out, responses=("a", "b", "c"))

    def test_publish_failure_leaves_original_and_existing_empty_output(self):
        self.out.mkdir()
        with patch.object(Path, "replace", side_effect=OSError("synthetic rename failure")):
            with self.assertRaisesRegex(OSError, "rename failure"):
                self.run_replay(max_rounds=0)
        self.assertEqual(self.tree(self.app), self.before)
        self.assertEqual(list(self.out.iterdir()), [])

    def test_concurrent_original_metadata_change_aborts_publication(self):
        real_publish = baseline.publish
        def mutate(*args):
            (self.app / ".env").write_text("concurrent owner edit")
            return real_publish(*args)
        with patch.object(baseline, "publish", side_effect=mutate), self.assertRaisesRegex(ValueError, "changed"):
            experiment.run(self.app, self.out)
        self.assertFalse(self.out.exists())
        self.assertEqual((self.app / ".env").read_text(), "concurrent owner edit")

    def test_symlink_source_is_rejected_and_preserved_metadata_link_not_followed(self):
        (self.app / "backend/link.js").symlink_to(self.app / "backend/server.js")
        with self.assertRaisesRegex(ValueError, "symlink"):
            experiment.run(self.app, self.out)
        (self.app / "backend/link.js").unlink()
        (self.app / ".local-link").symlink_to(self.root / "does-not-exist")
        experiment.run(self.app, self.out)
        self.assertTrue((self.out / ".local-link").is_symlink())


    def test_traversal_preserved_frontend_manifest_and_duplicate_paths_cannot_be_repaired(self):
        # These are file-protocol boundaries, not a Node availability test. The
        # parser's product-failure prerequisite is explicit synthetic evidence.
        feedback = {"source": experiment.SOURCE, "status": "product_fail", "checks": [
            {"path": "backend/server.js", "status": "product_fail", "source": experiment.SOURCE,
             "output": "SYNTHETIC parser failure"}]}
        responses = [block(name, "const bad = 1;") for name in (
            "../escape", "/tmp/escape", "backend/../../escape", ".env", "frontend/public/index.html",
            "backend/.env", "backend/package.json", "backend/new.js", "frontend/dist/index.html")]
        responses.append(block("backend/server.js", "const fixed = 1;") +
                         block("./backend/server.js", "const twice = 2;"))
        for response in responses:
            with self.subTest(response=response), patch.object(experiment, "check_syntax", return_value=feedback) as check:
                report = self.run_replay(response)
                self.assertEqual(report["stop_reason"], "invalid_repair", json.dumps(report))
                self.assertEqual(report["replay_calls"], 1)
                self.assertEqual(self.tree(self.out), self.before)
                check.assert_called_once()  # No invalid candidate reaches verification.
                shutil.rmtree(self.out)

    def test_environment_failure_precedes_invalid_response_without_consuming_it(self):
        feedback = {"source": experiment.SOURCE, "status": "environment_error", "checks": [
            {"path": "backend/kept.cjs", "status": "environment_error", "reason": "timeout",
             "timeout_seconds": 10, "elapsed_seconds": 10.0}]}
        duplicate = block("backend/server.js", "const fixed = 1;") * 2
        with patch.object(experiment, "check_syntax", return_value=feedback):
            report = self.run_replay(duplicate)
        self.assertEqual(report["stop_reason"], "environment_error", json.dumps(report))
        self.assertEqual(report["baseline_feedback"], feedback)
        self.assertEqual(report["replay_calls"], 0)
        self.assertEqual(self.tree(self.out), self.before)


@unittest.skipUnless(shutil.which("node"), "Node required for actual syntax feedback")
class RealSyntaxTests(Fixture, unittest.TestCase):
    def test_real_failure_repair_recheck_preserves_opaque_and_unmentioned_files(self):
        reply = block("backend/server.js", "console.log('synthetic repaired');")
        report = self.run_replay(reply)
        self.assertEqual(report["baseline_feedback"]["status"], "product_fail")
        self.assertEqual(report["stop_reason"], "syntax_pass_behavior_unknown")
        self.assertEqual(report["replay_calls"], 1)
        self.assertTrue(report["rounds"][0]["accepted"])
        self.assertNotEqual(report["baseline_source_sha256"], report["retained_source_sha256"])
        expected = dict(self.before, **{"backend/server.js": b"console.log('synthetic repaired');\n"})
        self.assertEqual(self.tree(self.out), expected)
        packet = report["rounds"][0]["attempt"]["messages"][0]["content"]
        self.assertIn("SyntaxError:", packet)
        self.assertNotIn("preserve-without-reading", packet)
        self.assertNotIn("old-build", packet)

    def test_two_failed_candidates_exhaust_one_shared_cap_and_keep_a0(self):
        report = self.run_replay(block("backend/server.js", "const first = ;"),
                                 block("backend/server.js", "const second = ;"))
        self.assertEqual(report["stop_reason"], "round_limit")
        self.assertEqual(report["replay_calls"], 2)
        self.assertEqual([r["attempt"]["call"] for r in report["rounds"]], [1, 2])
        self.assertEqual(report["usage"]["unknown_usage_calls"], [1, 2])
        self.assertEqual(self.tree(self.out), self.before)

    def test_second_response_uses_failed_candidate_source_diagnostic_and_hash(self):
        report = self.run_replay(block("backend/server.js", "const rejected = ;"),
                                 block("backend/server.js", "const fixed = 1;"))
        self.assertEqual(report["stop_reason"], "syntax_pass_behavior_unknown")
        self.assertEqual(report["replay_calls"], 2)
        first, second = report["rounds"]
        packet = json.loads(second["attempt"]["messages"][0]["content"])
        working = baseline.read_template(self.app)
        working["backend/server.js"] = b"const rejected = ;\n"
        self.assertEqual(packet["sources"]["backend/server.js"], "const rejected = ;\n")
        failures = [r for r in first["feedback"]["checks"] if r["status"] == "product_fail"]
        self.assertEqual(packet["failures"], failures)
        self.assertIn("const rejected = ;", failures[0]["output"])
        self.assertIn("SyntaxError:", failures[0]["output"])
        self.assertNotIn("const broken", json.dumps(packet))
        self.assertEqual(packet["working_source_sha256"], experiment.identity(working))
        self.assertEqual(packet["working_source_sha256"], first["candidate_source_sha256"])
        self.assertEqual(second["working_source_sha256"], packet["working_source_sha256"])
        self.assertEqual(packet["retained_source_sha256"], report["baseline_source_sha256"])
        self.assertNotEqual(packet["retained_source_sha256"], packet["working_source_sha256"])
        self.assertFalse(first["accepted"])
        self.assertTrue(second["accepted"])
        self.assertEqual(report["retained_source_sha256"], second["candidate_source_sha256"])

    def test_partial_syntax_repairs_accumulate_across_rounds(self):
        (self.app / "backend/another.cjs").write_text("const another = ;\n")
        self.before = self.tree(self.app)
        report = self.run_replay(block("backend/server.js", "const fixed = 1;"),
                                 block("backend/another.cjs", "const another = 2;"))
        self.assertEqual(report["stop_reason"], "syntax_pass_behavior_unknown")
        self.assertEqual(report["replay_calls"], 2)
        first, second = report["rounds"]
        self.assertFalse(first["accepted"])
        self.assertEqual(first["feedback"]["status"], "product_fail")
        packet = json.loads(second["attempt"]["messages"][0]["content"])
        self.assertEqual(packet["sources"]["backend/server.js"], "const fixed = 1;\n")
        self.assertEqual([r["path"] for r in packet["failures"]], ["backend/another.cjs"])
        self.assertTrue(second["accepted"])
        expected = dict(self.before, **{"backend/server.js": b"const fixed = 1;\n",
                                       "backend/another.cjs": b"const another = 2;\n"})
        self.assertEqual(self.tree(self.out), expected)

    def test_partial_repair_followed_by_failure_or_new_pass_regression_keeps_a0(self):
        (self.app / "backend/another.cjs").write_text("const another = ;\n")
        self.before = self.tree(self.app)
        cases = [(block("backend/another.cjs", "const still_broken = ;"), "round_limit"),
                 (block("backend/another.cjs", "const another = 2;") +
                  block("backend/server.js", "const regression = ;"),
                  "regression_or_missing_protected_evidence")]
        for reply, reason in cases:
            with self.subTest(reason=reason):
                report = self.run_replay(block("backend/server.js", "const fixed = 1;"), reply)
                self.assertEqual(report["stop_reason"], reason)
                self.assertEqual(report["replay_calls"], 2)
                self.assertEqual([r["accepted"] for r in report["rounds"]], [False, False])
                self.assertEqual(report["retained_source_sha256"], report["baseline_source_sha256"])
                self.assertEqual(self.tree(self.out), self.before)
                shutil.rmtree(self.out)

    def test_known_syntax_regression_discards_candidate_and_stops(self):
        reply = block("backend/server.js", "const fixed = 1;") + block("backend/kept.cjs", "const regression = ;")
        report = self.run_replay(reply, block("backend/kept.cjs", "module.exports = 9;"))
        self.assertEqual(report["stop_reason"], "regression_or_missing_protected_evidence")
        self.assertEqual(report["replay_calls"], 1)
        self.assertFalse(report["rounds"][0]["accepted"])
        self.assertEqual(self.tree(self.out), self.before)

    def test_environment_unknown_or_missing_input_do_not_consume_responses(self):
        cases = [("environment_error", "node_unavailable", None),
                 ("unknown", None, 2), ("environment_error", "timeout", None),
                 ("unknown", "output_limit", None)]
        for status, reason, code in cases:
            with self.subTest(status=status, reason=reason):
                row = {"status": status, "reason": reason, "exit_code": code, "output": "synthetic runner error"}
                with patch.object(experiment, "_process", return_value=row):
                    report = self.run_replay("must not parse")
                self.assertEqual(report["replay_calls"], 0)
                self.assertIn(report["stop_reason"], ("unknown", "environment_error"))
                shutil.rmtree(self.out)
        (self.app / "frontend/public/index.html").unlink()
        feedback = experiment.check_syntax(self.app)
        self.assertEqual(feedback["status"], "unknown")
        self.assertEqual(feedback["reason"], "incomplete_delivery_or_missing_input")

    def test_missing_node_and_abnormal_exit_are_not_product_failures(self):
        result = self.run_replay("must not parse", node=self.root / "missing-node")
        self.assertEqual(result["stop_reason"], "environment_error")
        self.assertEqual(result["replay_calls"], 0)
        with patch.object(experiment, "_process", return_value={"status": "unknown", "exit_code": -9, "output": ""}):
            self.assertEqual(experiment.check_syntax(self.app)["status"], "environment_error")

    def test_candidate_environment_or_unknown_evidence_keeps_original(self):
        first = experiment.check_syntax(self.app)
        for status in ("environment_error", "unknown"):
            feedback = {"source": experiment.SOURCE, "status": status, "checks": []}
            with patch.object(experiment, "check_syntax", side_effect=[first, feedback]):
                report = self.run_replay(block("backend/server.js", "const fixed = 1;"))
            self.assertEqual(report["stop_reason"], status)
            self.assertEqual(report["replay_calls"], 1)
            self.assertEqual(self.tree(self.out), self.before)
            shutil.rmtree(self.out)

    def test_non_utf8_and_missing_source_are_unknown_even_with_old_dist(self):
        (self.app / "backend/server.js").write_bytes(b"\xff\xfe\x00")
        self.assertEqual(experiment.check_syntax(self.app)["reason"], "non_utf8_backend_source")
        (self.app / "backend/server.js").write_text("const broken = ;")
        (self.app / "frontend/public/index.html").unlink()
        self.assertEqual(experiment.check_syntax(self.app)["reason"], "incomplete_delivery_or_missing_input")

    def test_missing_offline_response_stops_without_claiming_repair(self):
        report = self.run_replay()
        self.assertEqual(report["stop_reason"], "offline_response_unavailable")
        self.assertEqual(report["replay_calls"], 0)
        self.assertEqual(self.tree(self.out), self.before)

    def test_partial_reply_does_not_get_retry_or_continuation(self):
        report = self.run_replay("=== FILE: backend/server.js ===\nconst incomplete =",
                                 block("backend/server.js", "const fixed = 1;"))
        self.assertEqual(report["stop_reason"], "invalid_repair")
        self.assertEqual(report["replay_calls"], 1)
        self.assertEqual(self.tree(self.out), self.before)

    def test_no_offline_suite_or_self_check_enters_packet_or_executes(self):
        sentinel = self.root / "executed"
        (self.app / "checks").mkdir()
        (self.app / "checks/generated.js").write_text("MODEL_SELF_CHECK_SENTINEL")
        (self.app / "official-results.json").write_text("OFFLINE_ASSERTION_SENTINEL")
        code = "require('node:fs').writeFileSync(" + json.dumps(str(sentinel)) + ",'BAD');\nconst broken = ;"
        (self.app / "backend/server.js").write_text(code)
        self.before = self.tree(self.app)
        report = self.run_replay(block("backend/server.js", code.replace("const broken = ;", "const fixed = 1;")))
        self.assertFalse(sentinel.exists())
        packet = report["rounds"][0]["attempt"]["messages"][0]["content"]
        self.assertNotIn("OFFLINE_ASSERTION_SENTINEL", packet)
        self.assertNotIn("MODEL_SELF_CHECK_SENTINEL", packet)

    def test_redaction_clean_child_environment_and_no_node_preload(self):
        secret = "synthetic-known-key-for-redaction"
        (self.app / "backend/server.js").write_text("const token = '" + secret + "';\nconst broken = ;")
        self.before = self.tree(self.app)
        with patch.dict(os.environ, {"OPENAI_API_KEY": secret, "NODE_OPTIONS": "--require /must-not-load"}):
            report = self.run_replay(block("backend/server.js", "const token = '" + secret + "';"))
        self.assertEqual(report["stop_reason"], "syntax_pass_behavior_unknown")
        self.assertNotIn(secret, json.dumps(report))
        child = experiment._process([sys.executable, "-c", "import os; print(sorted(os.environ))"], self.root, 2)
        self.assertNotIn("OPENAI_API_KEY", child["output"])
        self.assertNotIn("NODE_OPTIONS", child["output"])

    def test_cli_pass_is_only_syntax_and_does_not_consume_response(self):
        (self.app / "backend/server.js").write_text("throw new Error('would fail at runtime');")
        command = [sys.executable, "-B", "-m", "oneshot.minimal_feedback", str(self.app),
                   "--output-dir", str(self.out), "--max-rounds", "1"]
        done = subprocess.run(command, capture_output=True, text=True, timeout=10)
        self.assertEqual(done.returncode, 0, done.stderr)
        report = json.loads(done.stdout)
        self.assertEqual(report["stop_reason"], "pass")
        self.assertEqual(report["behavior"], "unknown")
        self.assertEqual(report["replay_calls"], 0)


class ProcessTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()

    def invoke(self, code, seconds):
        return experiment._process([sys.executable, "-c", code], self.root, seconds)

    def test_actual_timeout_is_bounded_and_process_is_reaped(self):
        real = subprocess.Popen
        processes = []
        def tracked(*args, **kwargs):
            process = real(*args, **kwargs)
            processes.append(process)
            return process
        with patch.object(experiment.subprocess, "Popen", side_effect=tracked):
            row = self.invoke("import time; time.sleep(5)", .2)
        self.assertEqual(row["reason"], "timeout", row)
        self.assertEqual(row["status"], "environment_error")
        self.assertLess(row["elapsed_seconds"], 3, row)
        self.assertIsNotNone(row["exit_code"])
        process = processes[0]
        self.assertIsNotNone(process.returncode)
        self.assertTrue(process.stdout.closed)
        with self.assertRaises(ChildProcessError):
            os.waitpid(process.pid, os.WNOHANG)

    def test_actual_output_cap_survives_slow_start_without_short_timeout_race(self):
        # Reproduce startup slower than the old 0.2s fixture. Give this branch its
        # own deadline so the output limit, not process startup, is under test.
        real = subprocess.Popen
        def delayed(*args, **kwargs):
            time.sleep(.25)
            return real(*args, **kwargs)
        with patch.object(experiment.subprocess, "Popen", side_effect=delayed):
            row = self.invoke("print('x'*1000000)", 3)
        self.assertEqual(row["reason"], "output_limit", row)
        self.assertEqual(row["status"], "unknown")
        self.assertEqual(len(row["output"].encode()), experiment.MAX_LOG)
        self.assertTrue(row["truncated"])
        self.assertGreaterEqual(row["spawn_seconds"], .25)
        self.assertLess(row["elapsed_seconds"], 4, row)

    def test_expired_deadline_does_not_launch_another_process(self):
        for seconds in (0, -.1, float('inf'), float('nan')):
            with self.subTest(seconds=seconds), patch.object(experiment.subprocess, "Popen") as start:
                row = self.invoke("raise AssertionError('must not start')", seconds)
                self.assertEqual(row["reason"], "deadline_exhausted")
                self.assertEqual(row["status"], "environment_error")
                start.assert_not_called()

    def test_spawn_error_retains_actionable_redacted_details(self):
        secret = "synthetic-process-secret"
        with patch.dict(os.environ, {"OPENAI_API_KEY": secret}), patch.object(experiment.subprocess, "Popen", side_effect=PermissionError(1, secret)):
            row = self.invoke("pass", 3)
        self.assertEqual(row["reason"], "spawn_error")
        self.assertEqual(row["exception_type"], "PermissionError")
        self.assertEqual(row["errno"], 1)
        self.assertEqual(row["timeout_seconds"], 3)
        self.assertIn("elapsed_seconds", row)
        self.assertNotIn(secret, json.dumps(row))

    def test_capture_error_is_reported_and_child_is_reaped(self):
        real = subprocess.Popen
        processes = []
        def tracked(*args, **kwargs):
            process = real(*args, **kwargs)
            processes.append(process)
            return process
        # Inject an I/O error after launch without relying on a host-specific pipe failure.
        with patch.object(experiment.subprocess, "Popen", side_effect=tracked), patch.object(experiment.selectors, "DefaultSelector", side_effect=OSError(5, 'synthetic I/O error')):
            row = self.invoke("import time; time.sleep(5)", 3)
        self.assertEqual(row["reason"], "capture_error")
        self.assertEqual(row["errno"], 5)
        self.assertEqual(row["status"], "environment_error")
        self.assertIsNotNone(processes[0].returncode)
        self.assertTrue(processes[0].stdout.closed)


if __name__ == "__main__":
    unittest.main()
