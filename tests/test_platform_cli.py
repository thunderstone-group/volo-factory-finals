"""Local HTTP contract tests plus a labeled real response fixture.

Synthetic server responses test request encoding/recovery. Live CLI runs are recorded
separately; these tests alone do not establish integration success.
"""
import io
import json
import stat
import tempfile
import threading
import unittest
import zipfile
from contextlib import redirect_stdout, redirect_stderr
from email.parser import BytesParser
from email.policy import default
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from arcbench_cli import APIError, Client, log_summary, run_summary, main


class Website:
    def __init__(self):
        self.requests, self.archive = [], None
        self.download_failure = False
        self.create_failure = False
        self.start_failure = False
        self.reject_auth = False
        self.mismatch = False
        self.redirect = None
        self.run_states = ["PASSED"]
        self.truncate_responses = 0
        owner = self
        class Handler(BaseHTTPRequestHandler):
            def serve(self):
                raw = self.rfile.read(int(self.headers.get("Content-Length", "0")))
                parts = {}
                if raw:
                    message = BytesParser(policy=default).parsebytes(
                        ("Content-Type: " + self.headers["Content-Type"] + "\r\n\r\n").encode() + raw)
                    parts = {part.get_param("name", header="content-disposition"):
                             part.get_payload(decode=True) for part in message.iter_parts()}
                owner.requests.append({"path": self.path, "method": self.command,
                                       "cookie": self.headers.get("Cookie"), "parts": parts})
                status, result, mime = 200, {}, "application/json"
                if owner.redirect:
                    self.send_response(302)
                    self.send_header("Location", owner.redirect)
                    self.end_headers()
                    return
                if self.path == "/api/auth/me":
                    status, result = (401, {"detail": "not authenticated"}) if owner.reject_auth else (200, {"user": {"username": "synthetic-user"}})
                elif self.path == "/api/user/me":
                    result = {"account": {"account_id": "synthetic-meter-account"}}
                elif self.path == "/api/user/balance":
                    result = {"balance": {"available_balance": "0.000000"}, "currency": "CNY"}
                elif self.path == "/api/user/freshness":
                    result = {"as_of": "2026-09-11T08:52:24Z", "pending_billing_events": 0}
                elif self.path == "/api/auth/access-key":
                    result = {"api_key": "synthetic-model-secret"}
                elif self.path == "/api/submissions":
                    owner.archive = parts["file"]
                    result = {"submission": {"id": "submission-1", "api_key": "synthetic-model-secret"}}
                elif self.path == "/api/submissions/submission-1/archive":
                    if owner.download_failure:
                        status, result = 404, {"detail": "Submission archive is not available"}
                    else:
                        mime, result = "application/zip", b"wrong" if owner.mismatch else owner.archive
                elif self.path == "/api/runs":
                    status, result = (409, {"detail": "The submitted agent archive is no longer available"}) if owner.create_failure else (200, {"run": {"id": "run-1"}})
                elif self.path == "/api/runs/run-1/start":
                    status, result = (503, {"detail": "upstream unavailable"}) if owner.start_failure else (200, {"id": "run-1", "status": "RUNNING"})
                elif self.path == "/api/runs/run-1/cancel":
                    owner.run_states = ["CANCELLED"]
                    status, result = 500, {"detail": "Internal Server Error"}
                elif self.path == "/api/runs/run-1":
                    result = {"id": "run-1", "status": owner.run_states[0]}
                    if len(owner.run_states) > 1:
                        owner.run_states.pop(0)
                elif self.path.startswith('/api/runs/run-1/source?'):
                    result = {'file_path': '.factory/trace.jsonl', 'kind': 'file', 'language': 'json',
                              'content': 'safe\nsynthetic-model-secret', 'first_line': 1}
                body = result if isinstance(result, bytes) else json.dumps(result).encode()
                self.send_response(status)
                self.send_header("Content-Type", mime)
                truncated = owner.truncate_responses > 0
                if truncated:
                    owner.truncate_responses -= 1
                self.send_header("Content-Length", str(len(body) + (100 if truncated else 0)))
                self.send_header("Set-Cookie", "arc_api_sticky=synthetic-route; Path=/; HttpOnly")
                self.end_headers()
                self.wfile.write(body)
                if truncated:
                    self.close_connection = True

            do_GET = do_POST = serve

            def log_message(self, *args):
                pass

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)

    @property
    def origin(self):
        return f"http://127.0.0.1:{self.server.server_port}"

    def __enter__(self):
        self.thread.start()
        return self

    def __exit__(self, *args):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()


class PlatformTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="volo-cli-test-")
        self.root = Path(self.temp.name)
        self.session = self.root / "session.json"
        self.archive = self.root / "agent.zip"
        with zipfile.ZipFile(self.archive, "w") as archive:
            archive.writestr("main.py", "print('synthetic test agent')")

    def tearDown(self):
        self.temp.cleanup()

    def client(self, server):
        client = Client(server.origin, self.session)
        client.authenticate({"origin": server.origin, "cookies": [{
            "name": "arcbench_session", "value": "synthetic-session-secret", "domain": "127.0.0.1",
            "path": "/", "secure": False, "httpOnly": True, "expires": -1}]})
        return client

    def upload(self, client):
        return client.upload(self.archive, "ticket-booking", "合约测试", "deepseek-v4-flash",
                             "https://api.arc-bench.com/v1", "python")

    def test_upload_hash_run_sequence_and_cookie_affinity(self):
        with Website() as server:
            client = self.client(server)
            saved = self.upload(client)
            self.assertTrue(saved["archive_verified"])
            self.assertNotIn("synthetic-model-secret", json.dumps(saved))
            run = client.run(saved["submission"]["id"], "ticket-booking--ticket-booking")
            self.assertEqual(run["run_id"], "run-1")
            posts = [r for r in server.requests if r["method"] == "POST"]
            self.assertEqual([r["path"] for r in posts], ["/api/submissions", "/api/runs", "/api/runs/run-1/start"])
            self.assertEqual(posts[0]["parts"]["catalog"], b"competition")
            self.assertEqual(posts[0]["parts"]["display_name"].decode(), "合约测试")
            self.assertEqual(posts[0]["parts"]["file"], self.archive.read_bytes())
            self.assertEqual(posts[1]["parts"], {"submission_id": b"submission-1", "requirement_id": b"ticket-booking--ticket-booking"})
            self.assertIn("arc_api_sticky=synthetic-route", posts[0]["cookie"])
            self.assertIn("arcbench_session=synthetic-session-secret", posts[0]["cookie"])
        self.assertEqual(stat.S_IMODE(self.session.stat().st_mode), 0o600)

    def test_wait_recovers_one_incomplete_read_without_mutating_the_run(self):
        with Website() as server:
            self.client(server)
            server.truncate_responses = 1
            output = io.StringIO()
            with redirect_stdout(output):
                code = main(['--origin', server.origin, '--session', str(self.session),
                             'wait', 'run-1', '--interval', '0.01', '--timeout', '2'])
            self.assertEqual(code, 0)
            rows = [json.loads(line) for line in output.getvalue().splitlines()]
            self.assertEqual(rows[0]['waiting_retry'], 1)
            self.assertEqual(rows[-1]['status'], 'PASSED')
            self.assertTrue(all(r['method'] == 'GET' for r in server.requests))
            self.assertEqual(sum(r['path'] == '/api/runs/run-1' for r in server.requests), 2)

    def test_incomplete_mutation_response_is_uncertain_and_never_retried(self):
        with Website() as server:
            client = self.client(server)
            server.truncate_responses = 1
            with self.assertRaises(APIError) as caught:
                client.request('POST', '/runs/run-1/start')
            self.assertTrue(caught.exception.details['outcome_uncertain'])
            self.assertEqual(sum(r['method'] == 'POST' for r in server.requests), 1)

    def test_source_reads_only_requested_file_and_saves_redacted_private_text(self):
        with Website() as server:
            self.client(server)
            destination = self.root / 'trace.jsonl'
            output = io.StringIO()
            with redirect_stdout(output):
                code = main(['--origin', server.origin, '--session', str(self.session),
                             'source', 'run-1', '.factory/trace.jsonl', '--output', str(destination)])
            self.assertEqual(code, 0)
            self.assertEqual(destination.read_text(), 'safe\n[REDACTED]')
            self.assertEqual(stat.S_IMODE(destination.stat().st_mode), 0o600)
            self.assertIn('file_path=.factory%2Ftrace.jsonl&kind=file', server.requests[-1]['path'])
            self.assertTrue(all(r['method'] == 'GET' for r in server.requests))

    def test_meter_uses_separate_auth_route_and_preserves_decimal_balance(self):
        # Endpoint/field shapes verified against the live meter; amounts are synthetic.
        with Website() as server:
            client = Client(server.origin, self.session, auth_path='/user/me')
            client.authenticate({'origin': server.origin, 'cookies': [{
                'name': 'onr_user_session', 'value': 'synthetic-meter-session',
                'domain': '127.0.0.1', 'path': '/', 'secure': False}]})
            output = io.StringIO()
            with redirect_stdout(output):
                code = main(['--origin', server.origin, '--session', str(self.session), 'balance'])
            self.assertEqual(code, 0)
            self.assertEqual(json.loads(output.getvalue()), {'available_balance': '0.000000',
                             'currency': 'CNY', 'as_of': '2026-09-11T08:52:24Z', 'pending_billing_events': 0})
            self.assertEqual([r['path'] for r in server.requests],
                             ['/api/user/me', '/api/user/balance', '/api/user/freshness'])

    def test_saved_submission_id_survives_missing_archive(self):
        with Website() as server:
            server.download_failure = True
            result = self.upload(self.client(server))
            self.assertFalse(result["archive_verified"])
            self.assertEqual(result["submission"]["id"], "submission-1")
            self.assertEqual(result["archive_error"]["http_status"], 404)
            self.assertEqual(sum(r["method"] == "POST" for r in server.requests), 1)

    def test_downloaded_archive_must_match_uploaded_bytes(self):
        with Website() as server:
            server.mismatch = True
            self.assertFalse(self.upload(self.client(server))["archive_verified"])

    def test_create_failure_is_not_retried_or_started(self):
        with Website() as server:
            server.create_failure = True
            with self.assertRaises(APIError) as caught:
                self.client(server).run("submission-1", "ticket-booking--ticket-booking")
            self.assertEqual(caught.exception.details["http_status"], 409)
            self.assertFalse(caught.exception.details["outcome_uncertain"])
            self.assertEqual([r["path"] for r in server.requests if r["method"] == "POST"], ["/api/runs"])

    def test_start_failure_retains_created_id_without_creating_another_run(self):
        with Website() as server:
            server.start_failure = True
            result = self.client(server).run("submission-1", "ticket-booking--ticket-booking")
            self.assertEqual(result["run_id"], "run-1")
            self.assertTrue(result["start_error"]["outcome_uncertain"])
            self.assertEqual([r["path"] for r in server.requests if r["method"] == "POST"],
                             ["/api/runs", "/api/runs/run-1/start"])

    def test_rejected_import_does_not_replace_an_existing_private_session(self):
        with Website() as server:
            client = self.client(server)
            before = self.session.read_bytes()
            server.reject_auth = True
            with self.assertRaises(APIError):
                client.authenticate({"origin": server.origin, "cookies": []})
            self.assertEqual(self.session.read_bytes(), before)

    def test_cancel_error_can_follow_state_change_without_retry(self):
        # E012 returned HTTP 500 after its status changed to CANCELLED.
        with Website() as server:
            client = self.client(server)
            output = io.StringIO()
            with redirect_stderr(output):
                code = main(['--origin', server.origin, '--session', str(self.session), 'cancel', 'run-1'])
            self.assertEqual(code, 1)
            self.assertTrue(json.loads(output.getvalue())['outcome_uncertain'])
            self.assertEqual(client.request('GET', '/runs/run-1')['status'], 'CANCELLED')
            self.assertEqual([r['path'] for r in server.requests if r['method'] == 'POST'],
                             ['/api/runs/run-1/cancel'])

    def test_foreign_cookie_and_redirect_are_rejected(self):
        with Website() as server:
            client = self.client(server)
            with self.assertRaisesRegex(ValueError, "another host"):
                client.import_cookies({"origin": server.origin, "cookies": [{"domain": "example.com"}]})
            server.redirect = "http://127.0.0.1:1/steal"
            with self.assertRaisesRegex(APIError, "another origin"):
                client.request("GET", "/auth/me")

    def test_real_status_fields_preserve_explicit_currency_and_test_counts(self):
        fixture = json.loads((Path(__file__).parent / "fixtures/real-arcbench-run-status.json").read_text())
        summary = run_summary(fixture["run"])
        self.assertEqual(summary["passed_count"], 2)
        self.assertEqual(summary["test_pass_rate"], 100)
        self.assertEqual(summary["cost"], {"amount": 0.026695, "currency": "CNY"})
        self.assertEqual(summary["failed_tests"], [])

    def test_log_redaction_covers_model_keys_and_meter_identifiers(self):
        with Website() as server:
            client = self.client(server)
            client.known_secrets.append("synthetic-model-secret")
            clean = client.safe({"console": "key synthetic-model-secret\nMeter baseline captured for access key synthetic-meter-id"})
            self.assertNotIn("synthetic-model-secret", clean["console"])
            self.assertNotIn("synthetic-meter-id", clean["console"])

    def test_log_tail_preserves_cursor_without_duplicate_streams(self):
        result = log_summary("run-1", {"console": "1\n2\n3", "stdout": "1\n2\n3", "stderr": "error",
                                       "runner_events": ["large"], "log_offset": 42, "last_event_id": "event-1"}, 2)
        self.assertEqual(result["console"], "2\n3")
        self.assertEqual(result["next_offset"], 42)
        self.assertNotIn("runner_events", result)
        self.assertNotIn("stdout", result)

    def test_wait_polls_through_observed_queued_state_without_starting_another_run(self):
        with Website() as server:
            server.run_states = ["QUEUED", "RUNNING", "PASSED"]
            self.client(server)
            output = io.StringIO()
            with redirect_stdout(output):
                exit_code = main(["--origin", server.origin, "--session", str(self.session),
                                  "wait", "run-1", "--interval", "0.001", "--timeout", "2"])
            self.assertEqual(exit_code, 0)
            self.assertEqual([json.loads(line)["status"] for line in output.getvalue().splitlines()],
                             ["QUEUED", "RUNNING", "PASSED"])
            self.assertFalse(any(request["method"] == "POST" for request in server.requests))


if __name__ == "__main__":
    unittest.main()
