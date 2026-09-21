"""Recovery control tests; generated transport fixtures are explicitly synthetic."""

import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from experiment_recovery import (
    Recovery,
    RunLock,
    atomic_json,
    outcome,
    repair_pending_archives,
)
from experiment_transport import Response


def failed(folder, request=b'{"synthetic": true}'):
    folder.mkdir(parents=True)
    (folder / "request.json").write_bytes(request)
    atomic_json(
        folder / "transport.json",
        {"sse_events": 2, "saw_done": False, "curl_exit_code": 0},
    )
    atomic_json(folder / "trace.json", {"attempts": [{"status": "failed"}]})


def completed(folder):
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "application").mkdir(exist_ok=True)
    atomic_json(folder / "trace.json", {"attempts": [{"status": "completed"}]})
    atomic_json(folder / "receipt.json", {"new_model_calls": 1})


class RecoveryTests(unittest.TestCase):
    def test_cli_rejects_wrong_runtime_before_opening_experiment(self):
        script = (
            Path(__file__).resolve().parents[1] / "scripts/resume_repair_experiment.py"
        )
        code = (
            "import runpy,sys;sys.version_info=(3,9,6);"
            "sys.path.insert(0,sys.argv[1]);"
            'sys.argv=[sys.argv[2],"resume","--run-dir","/missing-frozen-experiment"];'
            'runpy.run_path(sys.argv[0],run_name="__main__")'
        )
        result = subprocess.run(
            [sys.executable, "-c", code, str(script.parent), str(script)],
            capture_output=True,
            text=True,
            timeout=10,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("requires Python 3.11.15", result.stderr)
        self.assertNotIn("FileNotFoundError", result.stderr)

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.folder = self.root / "ctrip-3" / "baseline"
        self.folder.parent.mkdir()
        self.lock = RunLock(self.root).__enter__()
        self.addCleanup(self.lock.__exit__, None, None, None)

    def test_one_attempt_policy_cannot_retry_an_existing_failure(self):
        failed(self.folder)
        recovery = Recovery(self.root, self.lock, retry_delay=0, max_attempts=1)
        with patch.object(recovery, "run") as run:
            with self.assertRaisesRegex(RuntimeError, r"attempt limit reached \(1\)"):
                recovery.step("single", [], self.folder, self.root)
            run.assert_not_called()

    def test_saved_one_attempt_policy_cannot_be_silently_raised(self):
        recovery = Recovery(self.root, self.lock, max_attempts=1)
        recovery.save()
        with self.assertRaisesRegex(RuntimeError, "saved retry policy"):
            Recovery(self.root, self.lock)

    def test_failed_atomic_replace_preserves_previous_state(self):
        path = self.root / "state.json"
        atomic_json(path, {"old": True})
        with patch(
            "experiment_recovery.os.replace",
            side_effect=OSError("synthetic disk failure"),
        ):
            with self.assertRaises(OSError):
                atomic_json(path, {"new": True})
        self.assertEqual(json.loads(path.read_text()), {"old": True})
        self.assertEqual(list(self.root.glob(".state.json-*")), [])

    def test_completed_step_does_not_launch_or_consume_attempt(self):
        completed(self.folder)
        recovery = Recovery(self.root, self.lock, retry_delay=0)
        with patch.object(recovery, "run") as run:
            recovery.step("ctrip-3/baseline-repair", [], self.folder, self.root)
        run.assert_not_called()
        self.assertFalse(recovery.path.exists())

    def test_all_historical_attempts_count_after_restart(self):
        for name in [
            "baseline-attempt1-transport-failure",
            "baseline-attempt2-transport-failure",
            "baseline",
        ]:
            failed(self.folder.with_name(name))
        for _ in range(2):
            recovery = Recovery(self.root, self.lock, retry_delay=0)
            with patch.object(recovery, "run") as run:
                with self.assertRaisesRegex(RuntimeError, "cumulative attempt limit"):
                    recovery.step("ctrip-3/baseline-repair", [], self.folder, self.root)
            run.assert_not_called()
            self.assertEqual(
                len(recovery.data["steps"]["ctrip-3/baseline-repair"]["attempts"]), 3
            )

    def test_preserves_failure_and_resumes_once(self):
        failed(self.folder)
        original = (self.folder / "trace.json").read_bytes()
        recovery = Recovery(self.root, self.lock, retry_delay=0)

        def worker(argv, log, cwd):
            self.assertIn("--expected-request-sha256", argv)
            completed(self.folder)
            (self.folder / "request.json").write_bytes(b'{"synthetic": true}')
            return 0

        with patch.object(recovery, "run", side_effect=worker) as run:
            recovery.step("ctrip-3/baseline-repair", ["worker"], self.folder, self.root)
        self.assertEqual(run.call_count, 1)
        self.assertEqual(
            (
                self.folder.with_name("baseline-attempt1-incomplete_stream")
                / "trace.json"
            ).read_bytes(),
            original,
        )
        self.assertEqual(
            len(recovery.data["steps"]["ctrip-3/baseline-repair"]["attempts"]), 2
        )

    def test_new_failures_stop_at_persistent_limit(self):
        failed(self.folder)
        recovery = Recovery(self.root, self.lock, retry_delay=0)

        def worker(*args):
            failed(self.folder)
            return 1

        with patch.object(recovery, "run", side_effect=worker) as run:
            with self.assertRaisesRegex(RuntimeError, "cumulative attempt limit"):
                recovery.step("ctrip-3/baseline-repair", [], self.folder, self.root)
        self.assertEqual(run.call_count, 2)
        self.assertEqual(
            len(recovery.data["steps"]["ctrip-3/baseline-repair"]["attempts"]), 3
        )

    def test_complete_provider_response_is_never_regenerated(self):
        failed(self.folder)
        atomic_json(self.folder / "trace.json", {"attempts": [{"status": "completed"}]})
        recovery = Recovery(self.root, self.lock)
        with patch.object(recovery, "run") as run:
            with self.assertRaisesRegex(
                RuntimeError, "completed_response_needs_recovery"
            ):
                recovery.step("ctrip-3/baseline-repair", [], self.folder, self.root)
        run.assert_not_called()

    def test_permanent_failure_is_not_retried(self):
        failed(self.folder)
        atomic_json(self.folder / "transport.json", {"http_status": 402})
        recovery = Recovery(self.root, self.lock)
        with patch.object(recovery, "run") as run:
            with self.assertRaisesRegex(RuntimeError, "permanent_http_failure"):
                recovery.step("ctrip-3/baseline-repair", [], self.folder, self.root)
        run.assert_not_called()

    def test_request_disagreement_stops_before_launch(self):
        failed(self.folder)
        failed(
            self.folder.with_name("baseline-attempt1-transport-failure"),
            b'{"different":true}',
        )
        recovery = Recovery(self.root, self.lock)
        with patch.object(recovery, "run") as run:
            with self.assertRaisesRegex(RuntimeError, "different requests"):
                recovery.step("ctrip-3/baseline-repair", [], self.folder, self.root)
        run.assert_not_called()

    def test_mismatch_stops_once_then_allows_corrected_preparation(self):
        failed(self.folder)
        recovery = Recovery(self.root, self.lock, retry_delay=0)

        def mismatch(*args):
            self.folder.mkdir()
            atomic_json(
                self.folder / "trace.json", {"attempts": [{"status": "failed"}]}
            )
            atomic_json(
                self.folder / "transport.json",
                {
                    "failure_kind": "request_mismatch",
                    "request_reached_gateway": False,
                },
            )
            return 1

        with patch.object(recovery, "run", side_effect=mismatch) as run:
            with self.assertRaisesRegex(RuntimeError, "correct the runtime"):
                recovery.step("step", [], self.folder, self.root)
        self.assertEqual(run.call_count, 1)

        def corrected(*args):
            completed(self.folder)
            (self.folder / "request.json").write_bytes(b'{"synthetic": true}')
            return 0

        recovery = Recovery(self.root, self.lock, retry_delay=0)
        with patch.object(recovery, "run", side_effect=corrected) as run:
            recovery.step("step", [], self.folder, self.root)
        self.assertEqual(run.call_count, 1)
        self.assertEqual(len(recovery.data["steps"]["step"]["attempts"]), 3)

    def test_transport_checks_request_before_starting_any_process(self):
        class Request:
            data = b"{}"

        with patch("experiment_transport.subprocess.Popen") as run:
            with self.assertRaisesRegex(ValueError, "request bytes differ"):
                Response(
                    Request(), "synthetic-key", self.root, {}, "", "1.1", "wrong-hash"
                )
        run.assert_not_called()

    def test_pending_rename_recovers_without_double_counting(self):
        failed(self.folder)
        archive = self.folder.with_name("baseline-attempt1-incomplete_stream")
        recovery = Recovery(self.root, self.lock)
        recovery.data["steps"]["step"] = {
            "attempts": [
                {
                    "path": str(self.folder.relative_to(self.root)),
                    "archive_pending": str(archive.relative_to(self.root)),
                }
            ]
        }
        self.folder.rename(
            archive
        )  # Synthetic interruption between rename and journal update.
        recovery.save()
        repair_pending_archives(recovery)
        record = recovery.data["steps"]["step"]["attempts"][0]
        self.assertEqual(record["path"], str(archive.relative_to(self.root)))
        self.assertNotIn("archive_pending", record)

    def test_live_child_keeps_lock_when_owner_closes(self):
        # Real OS process/lock check, not a mocked process-liveness fixture.
        lock = RunLock(self.folder.parent).__enter__()
        worker = subprocess.Popen(
            [sys.executable, "-c", "import sys;sys.stdin.read()"],
            stdin=subprocess.PIPE,
            pass_fds=(lock.fd,),
        )
        try:
            lock.__exit__(None, None, None)
            with self.assertRaisesRegex(RuntimeError, "still holds"):
                with RunLock(self.folder.parent):
                    pass
            worker.stdin.close()
            worker.wait(timeout=5)
            with RunLock(self.folder.parent):
                pass
        finally:
            if worker.poll() is None:
                worker.kill()
                worker.wait()

    def test_contradictory_receipt_is_not_skipped(self):
        failed(self.folder)
        (self.folder / "application").mkdir()
        atomic_json(self.folder / "receipt.json", {"new_model_calls": 1})
        with self.assertRaisesRegex(RuntimeError, "contradicts"):
            outcome(self.folder)


if __name__ == "__main__":
    unittest.main()
