"""Offline regressions. ALL transport/application fixtures are LOCAL SYNTHETIC data.

No competition fixtures, external services, real keys or model calls are used.
"""
import contextlib
import hashlib
import io
import json
import os
import subprocess
import sys
import tempfile
import threading
import unittest
import zipfile
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError, URLError

from oneshot import main as adapter
from scripts import package_oneshot as pack

SYNTHETIC_KEY = "synthetic-offline-key"
ABSENT = object()


def block(path, content):
    return f"=== FILE: {path} ===\n{content}\n=== END ===\n"


def application(extra=""):
    return (block("backend/package.json", '{"scripts":{"start":"node server.js"}}') +
            block("backend/server.js", "// Synthetic local fixture\n"+"process.on('uncaughtException', (e) => console.error('uncaught', e)); process.on('unhandledRejection', (e) => console.error('unhandled', e));\n"+"console.log('fixture');") +
            block("frontend/package.json", '{"scripts":{"build":"node build.js"}}') +
            block("frontend/build.js", "// Synthetic build fixture") +
            block("frontend/public/index.html", "<!doctype html><title>Synthetic</title>") + extra)


def event(obj):
    return b"data: " + json.dumps(obj).encode("utf-8") + b"\n\n"


def events(content, usage=ABSENT, finish="stop", done=True):
    frames = [event({"choices": [{"delta": {"content": content}, "finish_reason": finish}]})]
    if usage is not ABSENT:
        frames.append(event({"choices": [], "usage": usage}))
    if done:
        frames.append(b"data: [DONE]\n\n")
    return frames


class SyntheticStream:
    def __init__(self, frames):
        self.frames = frames

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def __iter__(self):
        for frame in self.frames:
            if isinstance(frame, Exception):
                raise frame
            yield frame


class OfflineCase(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.out = self.root / "app"
        self.enter(patch.object(adapter, "SCAFFOLD", False))
        self.transport = self.enter(patch.object(adapter, "_open_model",
                                                side_effect=AssertionError("unexpected HTTP")))
        self.enter(patch.object(adapter.time, "sleep"))
        self.enter(patch.object(adapter, "SMOKE", False))

    def enter(self, manager):
        value = manager.__enter__()
        self.addCleanup(manager.__exit__, None, None, None)
        return value

    def replies(self, *items):
        self.transport.side_effect = [SyntheticStream(x) if isinstance(x, list) else x for x in items]

    def generate(self, budget=None):
        return adapter.generate("Synthetic requirements only", "synthetic-model",
                                "https://synthetic.invalid/v1", SYNTHETIC_KEY, self.out, budget)

    def test_resolve_rejects_traversal_absolute_and_sibling_prefix(self):
        self.out.mkdir()
        paths = ("../app-sibling/escape.js", "../../escape", "x/../safe.js", "/tmp/escape.js",
                 str(self.out / "absolute-inside.js"), "C:/escape.js", "C:escape.js", "\\\\host\\share",
                 ".", "", "\x00.js")
        for name in paths:
            with self.subTest(name=name), self.assertRaises(ValueError):
                adapter.write_one(self.out, {"path": name, "content": "data"})
        self.assertEqual(list(self.out.iterdir()), [])
        self.assertFalse((self.root / "app-sibling").exists())

    def test_resolve_rejects_symlink_directory_and_file_escape(self):
        self.out.mkdir()
        sibling = self.root / "app-sibling"
        sibling.mkdir()
        (sibling / "keep.js").write_text("unchanged")
        (self.out / "linked").symlink_to(sibling, target_is_directory=True)
        (self.out / "file.js").symlink_to(sibling / "keep.js")
        for name in ("linked/new.js", "file.js"):
            with self.subTest(name=name), self.assertRaises(ValueError):
                adapter.write_one(self.out, {"path": name, "content": "bad"})
        self.assertEqual((sibling / "keep.js").read_text(), "unchanged")
        self.assertFalse((sibling / "new.js").exists())

    def test_gateway_redirect_never_forwards_authorization(self):
        req = adapter.request.Request("https://synthetic.invalid/v1/chat/completions",
                                      headers={"Authorization": "Bearer " + SYNTHETIC_KEY})
        for target in ("https://other.invalid/leak", "http://synthetic.invalid/plain"):
            with self.subTest(target=target), self.assertRaises(HTTPError) as caught:
                adapter.NoModelRedirect().redirect_request(req, None, 302, "redirect", {}, target)
            self.assertEqual(caught.exception.code, 302)
        self.transport.assert_not_called()

    def test_nested_relative_write(self):
        adapter.write_one(self.out, {"path": "frontend/public/index.html", "content": "ok"})
        self.assertEqual((self.out / "frontend/public/index.html").read_text(), "ok")

    def test_empty_and_malformed_blocks_raise_clear_value_error(self):
        examples = ("", " \n", "hello", "=== FILE: ===\nx\n=== END ===\n",
                    "=== FILE: x.js ==\nx\n=== END ===\n", "=== END ===\n",
                    block("x.js", ""), block("x.js", "   "),
                    "=== FILE: x.js ===\na\n" + block("y.js", "b"))
        for value in examples:
            with self.subTest(value=value), self.assertRaises(ValueError) as caught:
                adapter.parse_blocks(value)
            self.assertNotIsInstance(caught.exception, IndexError)

    def test_a_path_emitted_twice_in_one_reply_keeps_the_later_block(self):
        files, missing = adapter.parse_blocks(block("x.js", "first") + block("y.js", "b") + block("x.js", "second"))
        self.assertEqual([f["path"] for f in files], ["y.js", "x.js"])
        self.assertEqual(files[1]["content"], "second\n")
        self.assertEqual(missing, [])

    def test_prose_outside_blocks_is_ignored(self):
        files, missing = adapter.parse_blocks("Here is the app:\n" + block("x.js", "a") + "Done.\n" + block("y.js", "b"))
        self.assertEqual([f["path"] for f in files], ["x.js", "y.js"])
        self.assertEqual(missing, [])

    def test_crlf_and_unterminated_final_block(self):
        files, missing = adapter.parse_blocks((block("a.js", "one") +
                                               "=== FILE: b.js ===\ntwo").replace("\n", "\r\n"))
        self.assertEqual(files, [{"path": "a.js", "content": "one\n"}])
        self.assertEqual(missing, ["b.js"])

    def test_stream_retry_discards_failed_attempt_files_and_accumulates_usage(self):
        self.out.mkdir()  # Existing empty output is supported.
        budget = adapter.CallBudget()
        self.replies(events(application(block("stale.js", "old")),
                            {"prompt_tokens": 10, "completion_tokens": 20}, done=False) +
                     [URLError("synthetic disconnect")],
                     events(application(), {"prompt_tokens": 3, "completion_tokens": 7}))
        files, totals = self.generate(budget)
        self.assertEqual(len(files), 5)
        self.assertFalse((self.out / "stale.js").exists())
        self.assertEqual(totals["prompt_tokens"], 13)
        self.assertEqual(totals["completion_tokens"], 27)
        self.assertEqual([r["status"] for r in budget.attempts], ["failed", "completed"])
        self.assertEqual(list(self.root.glob(".oneshot-*")), [])

    def test_failed_unknown_usage_is_not_zero(self):
        budget = adapter.CallBudget()
        self.replies(events("discard me", done=False) + [URLError("synthetic disconnect")],
                     events(application(), {"prompt_tokens": 3, "completion_tokens": 7}))
        _, totals = self.generate(budget)
        self.assertIsNone(totals["prompt_tokens"])
        self.assertIsNone(totals["completion_tokens"])
        self.assertEqual(totals["known_prompt_tokens"], 3)
        self.assertEqual(totals["known_completion_tokens"], 7)
        self.assertEqual(totals["unknown_usage_calls"], [1])
        self.assertEqual(totals["billing_status"], "unknown")

    def test_partial_usage_and_snapshot_frames(self):
        budget = adapter.CallBudget()
        self.replies(events(application(), {"prompt_tokens": 5}, done=False) +
                     [event({"usage": {"prompt_tokens": 5, "completion_tokens": -1}}),
                      event({"usage": {"prompt_tokens": 4, "completion_tokens": True}}),
                      b"data: [DONE]\n\n"])
        _, totals = self.generate(budget)
        self.assertEqual(totals["prompt_tokens"], 5)
        self.assertIsNone(totals["known_completion_tokens"])
        self.assertEqual(totals["unknown_usage_calls"], [1])
        self.assertEqual(len(budget.attempts[0]["usage_events"]), 3)

    def test_final_failure_retains_usage_without_publishing(self):
        budget = adapter.CallBudget(limit=1, fail_limit=1)
        self.replies(events(application(), {"prompt_tokens": 9}, done=False))
        with self.assertRaisesRegex(RuntimeError, "StreamError"):
            self.generate(budget)
        self.assertEqual(budget.summary()["known_prompt_tokens"], 9)
        self.assertEqual(budget.summary()["unknown_usage_calls"], [1])
        self.assertFalse(self.out.exists())
        self.assertEqual(list(self.root.glob(".oneshot-*")), [])

    def test_permanent_http_4xx_including_402_are_not_retried(self):
        for status in (400, 401, 402, 403, 404, 405, 409, 410, 413, 422):
            with self.subTest(status=status):
                budget = adapter.CallBudget()
                self.replies(HTTPError("https://synthetic.invalid", status, "synthetic", {}, None))
                with self.assertRaisesRegex(RuntimeError, f"HTTP {status}"):
                    self.generate(budget)
                self.assertEqual(len(budget.attempts), 1)
                self.assertEqual(budget.summary()["unknown_usage_calls"], [1])
                self.assertEqual(budget.attempts[0]["http_status"], status)

    def test_transient_http_errors_share_global_failure_cap(self):
        budget = adapter.CallBudget(fail_limit=3)
        self.replies(*[HTTPError("https://synthetic.invalid", status, "synthetic", {}, None)
                       for status in (408, 429, 503)])
        with self.assertRaisesRegex(RuntimeError, "HTTP 503"):
            self.generate(budget)
        self.assertEqual(self.transport.call_count, 3)
        self.assertEqual(budget.summary()["failed_calls"], 3)
        self.assertEqual(budget.summary()["completed_calls"], 0)
        with self.assertRaisesRegex(RuntimeError, "global model failure limit"):
            adapter.stream_completion([], "synthetic-model", "https://synthetic.invalid",
                                      SYNTHETIC_KEY, budget)
        self.assertEqual(self.transport.call_count, 3)

    def test_cut_streams_do_not_consume_the_continuation(self):
        budget = adapter.CallBudget()
        prefix = block("backend/package.json", '{"scripts":{"start":"node server.js"}}')
        rest = application()[len(prefix):]
        self.replies(URLError("first"), URLError("second"),
                     events(prefix + "=== FILE: backend/server.js ===\n// cut off", finish="length"),
                     events(rest))
        self.generate(budget)
        self.assertEqual(self.transport.call_count, 4)
        self.assertEqual(budget.summary()["failed_calls"], 2)
        self.assertEqual(budget.summary()["completed_calls"], 2)
        self.assertTrue((self.out / "backend" / "server.js").exists())

    def test_primary_model_retries_are_spent_then_the_run_switches_to_the_fallback(self):
        budget = adapter.CallBudget()
        prefix = block("backend/package.json", '{"scripts":{"start":"node server.js"}}')
        rest = application()[len(prefix):]
        self.replies(URLError("first"), URLError("second"), URLError("third"),
                     events(prefix + "=== FILE: backend/server.js ===\n// cut off", finish="length"),
                     events(rest))
        with patch.dict(os.environ, {"FALLBACK_MODEL": "synthetic-fallback"}):
            self.generate(budget)
        self.assertEqual(self.transport.call_count, 5)
        self.assertEqual([r["model"] for r in budget.attempts],
                         ["synthetic-model"] * 3 + ["synthetic-fallback"] * 2)
        self.assertEqual(budget.summary()["fallback_model"], "synthetic-fallback")
        self.assertEqual(budget.summary()["failed_calls"], 3)
        self.assertTrue((self.out / "backend" / "server.js").exists())

    def test_a_file_emitted_twice_keeps_the_later_version(self):
        budget = adapter.CallBudget()
        twice = application(block("backend/server.js", "// Synthetic local fixture\nconsole.log('second');"))
        self.replies(events(twice))
        self.generate(budget)
        self.assertEqual(self.transport.call_count, 1)
        self.assertIn("second", (self.out / "backend/server.js").read_text())

    def test_content_filter_keeps_the_draft_and_continues_on_the_fallback(self):
        budget = adapter.CallBudget()
        prefix = block("backend/package.json", '{"scripts":{"start":"node server.js"}}')
        rest = application()[len(prefix):]
        self.replies(events(prefix + "=== FILE: backend/server.js ===\n// cut off", finish="content_filter"),
                     events(rest))
        with patch.dict(os.environ, {"FALLBACK_MODEL": "synthetic-fallback"}):
            self.generate(budget)
        self.assertEqual(self.transport.call_count, 2)
        self.assertEqual([r["model"] for r in budget.attempts], ["synthetic-model", "synthetic-fallback"])
        self.assertEqual(budget.summary()["completed_calls"], 2)
        self.assertEqual(budget.attempts[0]["finish_reason"], "content_filter")
        self.assertTrue((self.out / "backend" / "server.js").exists())
        self.assertNotIn("cut off", (self.out / "backend/server.js").read_text())

    def test_content_filter_continues_on_the_same_model_when_the_fallback_is_disabled(self):
        budget = adapter.CallBudget()
        prefix = block("backend/package.json", '{"scripts":{"start":"node server.js"}}')
        rest = application()[len(prefix):]
        self.replies(events(prefix + "=== FILE: backend/server.js ===\n// cut off", finish="content_filter"),
                     events(rest))
        with patch.dict(os.environ, {"FALLBACK_MODEL": ""}):
            self.generate(budget)
        self.assertEqual([r["model"] for r in budget.attempts], ["synthetic-model"] * 2)
        self.assertIsNone(budget.summary()["fallback_model"])
        self.assertTrue((self.out / "backend" / "server.js").exists())

    def test_fallback_is_not_taken_for_permanent_errors(self):
        budget = adapter.CallBudget()
        self.replies(HTTPError("https://synthetic.invalid", 402, "synthetic", {}, None))
        with patch.dict(os.environ, {"FALLBACK_MODEL": "synthetic-fallback"}):
            with self.assertRaisesRegex(RuntimeError, "HTTP 402"):
                self.generate(budget)
        self.assertEqual(self.transport.call_count, 1)
        self.assertIsNone(budget.summary()["fallback_model"])

    def test_fallback_can_be_disabled(self):
        budget = adapter.CallBudget()
        self.replies(URLError("first"), URLError("second"), URLError("third"))
        with patch.dict(os.environ, {"FALLBACK_MODEL": ""}):
            with self.assertRaisesRegex(RuntimeError, "URLError"):
                self.generate(budget)
        self.assertEqual(self.transport.call_count, 3)
        self.assertIsNone(budget.summary()["fallback_model"])

    def test_an_empty_first_draft_is_asked_once_more(self):
        budget = adapter.CallBudget()
        self.replies(events("No answer text provided."), events(application()))
        files, totals = self.generate(budget)
        self.assertEqual(len(files), 5)
        self.assertEqual(self.transport.call_count, 2)
        self.assertEqual(totals["completed_calls"], 2)

    def test_two_empty_drafts_fail_without_a_third_call(self):
        budget = adapter.CallBudget()
        self.replies(events("No answer text provided."), events("Still nothing."))
        with self.assertRaisesRegex(ValueError, "no file blocks"):
            self.generate(budget)
        self.assertEqual(self.transport.call_count, 2)

    def test_quoted_vocabulary_table_precedes_the_requirements(self):
        req = ("- id: REQ-1\n  name: Login\n  description: Show \u201cEmail cannot be empty\u201d and a \"Sign In\" button.\n"
               "- id: REQ-2\n  name: Notes\n  description: The system contains a note titled \"Groceries\". Show \u201cEmail cannot be empty\u201d again.\n")
        table = adapter.vocabulary_table(req)
        self.assertIn("REQ-1 Login: \u201cEmail cannot be empty\u201d; \u201cSign In\u201d", table)
        self.assertIn("REQ-2 Notes: \u201cGroceries\u201d", table)
        self.assertEqual(table.count("Email cannot be empty"), 1)
        self.assertEqual(adapter.vocabulary_table("no quotes here"), "")
        budget = adapter.CallBudget()
        self.replies(events(application()))
        adapter.generate(req, "synthetic-model", "https://synthetic.invalid/v1", SYNTHETIC_KEY, self.out, budget)
        prompt = budget.attempts[0]["messages"][1]["content"]
        self.assertLess(prompt.index("## Quoted vocabulary checklist"), prompt.index("## Requirements (the application to build)"))

    def test_completed_calls_still_share_the_global_cap(self):
        budget = adapter.CallBudget(limit=1)
        prefix = block("backend/package.json", '{"scripts":{"start":"node server.js"}}')
        self.replies(events(prefix + "=== FILE: backend/server.js ===\n// cut off", finish="length"))
        with self.assertRaisesRegex(RuntimeError, "global model call limit"):
            self.generate(budget)
        self.assertEqual(self.transport.call_count, 1)
        self.assertFalse(self.out.exists())

    def test_continuation_can_retry_without_leaking_a_failed_version(self):
        budget = adapter.CallBudget()
        prefix = block("backend/package.json", '{"scripts":{"start":"node server.js"}}')
        rest = application()[len(prefix):]
        self.replies(events(prefix + "=== FILE: backend/server.js ===\n// cut off", finish="length"),
                     events(rest + block("leaked.js", "bad"), done=False), events(rest))
        self.generate(budget)
        self.assertEqual(self.transport.call_count, 3)
        self.assertFalse((self.out / "leaked.js").exists())
        self.assertNotIn("cut off", (self.out / "backend/server.js").read_text())
        self.assertIn("backend/server.js", budget.attempts[1]["messages"][-1]["content"])

    def test_no_continuation_for_stop_with_open_block_or_length_between_blocks(self):
        cases = (("=== FILE: x.js ===\npartial", "stop", "incomplete delivery"),
                 (application(), "length", "truncated between"),
                 ("", "stop", "no content"))  # a draft without blocks is asked once more (own test)
        for content, finish, message in cases:
            with self.subTest(content=content):
                budget = adapter.CallBudget()
                self.replies(events(content, finish=finish))
                with self.assertRaisesRegex(ValueError, message):
                    self.generate(budget)
                self.assertEqual(len(budget.attempts), 1)
                self.assertFalse(self.out.exists())

    def test_invalid_sse_retries_without_unbounded_calls(self):
        self.replies([b"data: {invalid json}\n"], [event({"choices": [None]})], events(application()))
        self.generate()
        self.assertEqual(self.transport.call_count, 3)

    def test_invalid_file_rolls_back_all_staged_files(self):
        self.replies(events(application(block("../app-sibling/escape.js", "bad"))))
        with self.assertRaisesRegex(ValueError, "escapes"):
            self.generate()
        self.assertFalse(self.out.exists())
        self.assertFalse((self.root / "app-sibling").exists())
        self.assertEqual(list(self.root.glob(".oneshot-*")), [])

    def test_nonempty_output_cannot_supply_stale_required_files(self):
        self.out.mkdir()
        (self.out / "keep.txt").write_text("existing")
        with self.assertRaisesRegex(ValueError, "absent or empty"):
            self.generate()
        self.transport.assert_not_called()
        self.assertEqual((self.out / "keep.txt").read_text(), "existing")

    def test_symlink_output_rejected_before_model(self):
        target = self.root / "target"
        target.mkdir()
        self.out.symlink_to(target, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, "symlink"):
            self.generate()
        self.transport.assert_not_called()

    def test_missing_required_does_not_trigger_backfill(self):
        self.replies(events(block("frontend/public/index.html", "<h1>partial</h1>")))
        with self.assertRaisesRegex(ValueError, "incomplete delivery.*backend/package.json"):
            self.generate()
        self.assertEqual(self.transport.call_count, 1)
        self.assertFalse(self.out.exists())

    def test_manifest_shape_scripts_entry_and_dependencies(self):
        manifests = ("[]", "null", '"text"', "{broken", '{"scripts":[]}',
                     '{"scripts":{"start":3}}', '{"scripts":{"start":" "}}',
                     '{"scripts":{"start":"node missing.js"}}',
                     '{"scripts":{"start":"node ../outside.js"}}',
                     '{"scripts":{"start":"node /tmp/outside.js"}}',
                     '{"scripts":{"start":"node server.js && echo hi"}}',
                     '{"scripts":{"start":"node server.js"},"dependencies":{"x":"1"}}')
        for content in manifests:
            with self.subTest(content=content):
                self.out.mkdir(exist_ok=True)
                for item in adapter.parse_blocks(application())[0]:
                    adapter.write_one(self.out, item)
                (self.out / "backend/package.json").write_text(content)
                self.assertTrue(adapter.missing_required(self.out))
        self.assertEqual(self.transport.call_count, 0)

    def test_cli_failure_is_nonzero_and_reports_unknown_usage(self):
        requirement = self.root / "requirements"
        requirement.mkdir()
        (requirement / "requirements.yaml").write_text("synthetic: true")
        self.replies(events(block("x.js", "// incomplete application")))
        capture = io.StringIO()
        with patch.dict(os.environ, {"OPENAI_API_KEY": SYNTHETIC_KEY}, clear=True), contextlib.redirect_stderr(capture):
            code = adapter.main([str(requirement), "--output-dir", str(self.out)])
        self.assertEqual(code, 1)
        self.assertIn("incomplete delivery", capture.getvalue())
        self.assertIn('"billing_status": "unknown"', capture.getvalue())
        self.assertNotIn(SYNTHETIC_KEY, capture.getvalue())

    def test_cli_generates_into_runner_prepopulated_output(self):
        # A fresh platform run pre-creates `.arc/` and `requirements/` inside output-dir.
        requirement = self.out / "requirements"
        requirement.mkdir(parents=True)
        (requirement / "requirements.yaml").write_text("synthetic: true")
        (self.out / ".arc" / "traceability").mkdir(parents=True)
        (self.out / ".arc" / "runner-events.jsonl").write_text("{}\n")
        self.replies(events(application()))
        with patch.dict(os.environ, {"OPENAI_API_KEY": SYNTHETIC_KEY}, clear=True), \
                contextlib.redirect_stderr(io.StringIO()), contextlib.redirect_stdout(io.StringIO()):
            code = adapter.main([str(requirement), "--output-dir", str(self.out)])
        self.assertEqual(code, 0)
        self.assertEqual(self.transport.call_count, 1)
        self.assertTrue((self.out / "frontend/package.json").is_file())
        self.assertTrue((self.out / "backend/package.json").is_file())
        self.assertEqual((self.out / ".arc" / "runner-events.jsonl").read_text(), "{}\n")
        self.assertEqual((requirement / "requirements.yaml").read_text(), "synthetic: true")
        self.assertEqual(list(self.out.glob(".oneshot-*")), [])

    def test_cli_prepopulated_output_with_stray_file_is_still_rejected(self):
        requirement = self.out / "requirements"
        requirement.mkdir(parents=True)
        (requirement / "requirements.yaml").write_text("synthetic: true")
        (self.out / "stale.txt").write_text("leftover")
        capture = io.StringIO()
        with patch.dict(os.environ, {"OPENAI_API_KEY": SYNTHETIC_KEY}, clear=True), contextlib.redirect_stderr(capture):
            self.assertEqual(adapter.main([str(requirement), "--output-dir", str(self.out)]), 1)
        self.transport.assert_not_called()
        self.assertIn("absent or empty", capture.getvalue())

    def test_cli_missing_requirements_is_nonzero_without_http(self):
        with contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(adapter.main([str(self.root), "--output-dir", str(self.out)]), 1)
        self.transport.assert_not_called()


class PackageTests(unittest.TestCase):
    def test_two_builds_identical_manifest_matches_every_entry_and_excludes_extras(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "source"
            source.mkdir()
            for name in (*pack.FILES, "source_manifest.json"):
                (source / name).write_bytes((pack.SOURCE / name).read_bytes())
            # Synthetic exclusion sentinels, not real credentials or experiment data.
            for name in (".env", "test_fake.py", "run.json", "extra.zip"):
                (source / name).write_text("SYNTHETIC EXCLUDED SENTINEL")
            first, second = root / "one.zip", root / "two.zip"
            manifest = pack.build_package(first, source)
            for name in pack.FILES:
                os.utime(source / name, (1000000000, 1000000000))
            self.assertEqual(pack.build_package(second, source), manifest)
            self.assertEqual(first.read_bytes(), second.read_bytes())
            self.assertEqual(hashlib.sha256(first.read_bytes()).hexdigest(), manifest["package_sha256"])
            with zipfile.ZipFile(first) as archive:
                self.assertEqual(archive.namelist(), list(pack.FILES))
                self.assertIsNone(archive.testzip())
                for name in pack.FILES:
                    self.assertEqual(hashlib.sha256(archive.read(name)).hexdigest(), manifest["files"][name]["sha256"])
                    self.assertEqual(archive.getinfo(name).date_time, (2026, 9, 16, 0, 0, 0))
            stored = json.loads(first.with_suffix(".zip.manifest.json").read_text())
            self.assertEqual(stored, manifest)
            self.assertNotIn("SYNTHETIC EXCLUDED SENTINEL", first.read_bytes().decode("utf-8", errors="ignore"))

    def test_packager_rejects_missing_empty_symlink_and_source_overwrite(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            with self.assertRaises(ValueError):
                pack.build_package(root / "bad.zip", root)
            for name in (*pack.FILES, "source_manifest.json"):
                (root / name).write_bytes((pack.SOURCE / name).read_bytes())
            with self.assertRaises(ValueError):
                pack.build_package(root / "main.py", root)
            (root / "main.py").write_text("")
            with self.assertRaises(ValueError):
                pack.build_package(root / "bad.zip", root)
            (root / "main.py").unlink()
            (root / "main.py").symlink_to(pack.SOURCE / "main.py")
            with self.assertRaises(ValueError):
                pack.build_package(root / "bad.zip", root)


class LocalHTTPTests(unittest.TestCase):
    """Exercise the actual urllib/SSE and extracted ZIP CLI over loopback only."""

    def test_extracted_zip_cli_success_and_failure_over_synthetic_local_http(self):
        replies = [(200, b"".join(events(application(), {"prompt_tokens": 8, "completion_tokens": 13}))),
                   (200, b"".join(events(block("x.js", "// missing packages")))),
                   (402, b'{"error":"synthetic payment required"}')]
        seen = []

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                seen.append((self.path, json.loads(self.rfile.read(int(self.headers["Content-Length"])))))
                status, body = replies.pop(0)
                self.send_response(status)
                self.send_header("Content-Type", "text/event-stream")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *args):
                pass

        server = HTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True)
        thread.start()
        try:
            with tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                bundle = root / "candidate.zip"
                pack.build_package(bundle)
                with zipfile.ZipFile(bundle) as archive:
                    archive.extractall(root / "candidate")
                requirements = root / "requirements"
                requirements.mkdir()
                (requirements / "requirements.yaml").write_text("synthetic: true")
                env = {"PATH": os.defpath, "PYTHONDONTWRITEBYTECODE": "1", "OPENAI_API_KEY": SYNTHETIC_KEY,
                       "OPENAI_BASE_URL": f"http://127.0.0.1:{server.server_port}/v1", "MODEL": "synthetic-model",
                       "ONESHOT_SCAFFOLD": "0"}  # the CLI mechanics, without the scaffold completing a partial reply
                for index, expected in enumerate((0, 1, 1)):
                    result = subprocess.run([sys.executable, str(root / "candidate/main.py"), str(requirements),
                                             "--output-dir", str(root / f"out-{index}"), "--type", "web"],
                                            env=env, capture_output=True, text=True, timeout=15)
                    self.assertEqual(result.returncode, expected, result.stderr)
                    self.assertNotIn(SYNTHETIC_KEY, result.stdout + result.stderr)
                    self.assertEqual((root / f"out-{index}").exists(), expected == 0)
                    if index == 0:
                        self.assertEqual(adapter.missing_required(root / "out-0"), [])
                        self.assertIn('"prompt_tokens": 8', result.stderr)
                    elif index == 1:
                        self.assertIn("incomplete delivery", result.stderr)
                    else:
                        self.assertIn("HTTP 402", result.stderr)
                self.assertEqual(len(seen), 3)
                self.assertTrue(all(path == "/v1/chat/completions" for path, _ in seen))
                self.assertTrue(all(payload["stream"] for _, payload in seen))
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
