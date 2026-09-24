"""Offline regressions. ALL transport/application fixtures are LOCAL SYNTHETIC data.

No competition fixtures, external services, real keys or model calls are used.
"""
import contextlib
import hashlib
import http.client
import io
import json
import os
import shutil
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


def split_application():
    """The five blocks of application(), one string each, to cut a reply wherever a test needs."""
    return [block(item["path"], item["content"].rstrip("\n")) for item in adapter.parse_blocks(application())[0]]


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
        self.enter(patch.object(adapter, "TESTGEN", False))  # the written-test path has its own tests
        self.enter(patch.dict(os.environ))  # the code defaults, whatever the developer's shell exports
        for name in ("FALLBACK_MODEL", "ONESHOT_DRAFT_CALLS", "ONESHOT_REPAIR_CALLS", "ONESHOT_REPAIR_CNY"):
            os.environ.pop(name, None)

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

    def test_marker_glued_to_leaked_reasoning_opens_the_block(self):
        # Round 24 Keep b: a continuation's content began with reasoning that ended "</think>=== FILE: ... ==="
        # on one line; the marker went unrecognised and the next END killed the task (0/32).
        text = block("a.js", "one") + "Now I'm confident. Writing the output.</think>=== FILE: seed.js ===\nrows\n=== END ===\n"
        files, missing = adapter.parse_blocks(text)
        self.assertEqual([f["path"] for f in files], ["a.js", "seed.js"])
        self.assertEqual(files[1]["content"], "rows\n")
        self.assertEqual(missing, [])
        # Inside a block the same line is content, not a new block.
        files, missing = adapter.parse_blocks("=== FILE: a.js ===\nprose === FILE: b.js ===\n=== END ===\n")
        self.assertEqual(files, [{"path": "a.js", "content": "prose === FILE: b.js ===\n"}])

    def test_crlf_and_unterminated_final_block(self):
        files, missing = adapter.parse_blocks((block("a.js", "one") +
                                               "=== FILE: b.js ===\ntwo").replace("\n", "\r\n"))
        self.assertEqual(files, [{"path": "a.js", "content": "one\n"}])
        self.assertEqual(missing, ["b.js"])

    def test_stream_retry_discards_failed_attempt_files_and_accumulates_usage(self):
        # The failed attempt holds no complete block (one that does is kept and continued: the cut-stream tests).
        self.out.mkdir()  # Existing empty output is supported.
        budget = adapter.CallBudget()
        self.replies(events("=== FILE: stale.js ===\nold", {"prompt_tokens": 10, "completion_tokens": 20},
                            done=False) + [URLError("synthetic disconnect")],
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
        # A cut before any complete block (with complete blocks the application ships: the cut-stream tests).
        budget = adapter.CallBudget(draft_limit=1, fail_limit=1)
        self.replies(events("=== FILE: backend/package.json ===\n{", {"prompt_tokens": 9}, done=False))
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

    def test_content_filter_continues_on_the_paired_fallback_with_its_own_parameters(self):
        # No implicit qwen any more: the same pairing as a transport fallback, each model with its own temperature.
        prefix = block("backend/package.json", '{"scripts":{"start":"node server.js"}}')
        rest = application()[len(prefix):]
        for primary, fallback, temperature in (("deepseek-v4-flash", "kimi-k2.7-code-highspeed", 1.0),
                                               ("kimi-k2.7-code-highspeed", "deepseek-v4-flash", 0.0)):
            with self.subTest(primary=primary):
                self.transport.reset_mock()
                self.replies(events(prefix + "=== FILE: backend/server.js ===\n// cut off", finish="content_filter"),
                             events(rest))
                budget = adapter.CallBudget()
                adapter.generate("Synthetic requirements only", primary, "https://synthetic.invalid/v1",
                                 SYNTHETIC_KEY, self.root / primary, budget)
                payloads = [json.loads(c.args[0].data) for c in self.transport.call_args_list]
                self.assertEqual([p["model"] for p in payloads], [primary, fallback])
                self.assertEqual(payloads[1]["temperature"], temperature)
                self.assertEqual(budget.summary()["fallback_model"], fallback)
                self.assertNotIn("cut off", (self.root / primary / "backend/server.js").read_text())

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

    def test_replies_without_file_blocks_are_asked_again_until_the_draft_allowance_is_spent(self):
        # Old rule: a second empty draft failed the task. Now every redraft comes out of the draft allowance.
        self.replies(*[events("No answer text provided.")] * 4)
        with self.assertRaisesRegex(RuntimeError, r"draft call limit reached \(4\): the reply has no file blocks"):
            self.generate(adapter.CallBudget())
        self.assertEqual(self.transport.call_count, 4)
        self.assertFalse(self.out.exists())
        self.transport.reset_mock()
        self.replies(*[events("No answer text provided.")] * 2)
        with patch.dict(os.environ, {"ONESHOT_DRAFT_CALLS": "2"}), \
                self.assertRaisesRegex(RuntimeError, r"draft call limit reached \(2\)"):
            self.generate(adapter.CallBudget())
        self.assertEqual(self.transport.call_count, 2)

    def test_a_stream_without_content_is_a_billed_call_and_the_draft_is_asked_again(self):
        # The reasoning used the whole output (finish=length, no content), then an empty stop: both are
        # completed calls with their usage kept, and the same request goes out again.
        reasoning_only = [event({"choices": [{"delta": {"reasoning_content": "synthetic reasoning"},
                                              "finish_reason": "length"}]}),
                          event({"choices": [], "usage": {"prompt_tokens": 5, "completion_tokens": 131072}}),
                          b"data: [DONE]\n\n"]
        budget = adapter.CallBudget()
        self.replies(reasoning_only, events(""), events(application()))
        files, totals = self.generate(budget)
        self.assertEqual(len(files), 5)
        self.assertEqual([r["status"] for r in budget.attempts], ["completed"] * 3)
        self.assertEqual(totals["completed_calls"], 3)
        self.assertEqual(budget.attempts[0]["usage"]["completion_tokens"], 131072)
        self.assertEqual(budget.attempts[0]["stream_observation"]["reasoning_chars"], len("synthetic reasoning"))
        self.assertEqual(budget.attempts[2]["messages"], budget.attempts[0]["messages"])

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

    def test_seed_checklist_collects_each_given_seed_once_with_its_requirements(self):
        req = ("id: ROOT\nname: App\ntype: FOLDER\nchildren:\n"
               "- id: REQ-1\n  name: Sign in\n  type: ATOMIC\n  scenarios:\n"
               "  - name: one\n    steps:\n    - keyword: GIVEN\n      content: The seeded data is account `ann`. A visitor\n"
               "        opens the page. Seed values: account `ann`, email `ann.lee@example.test`.\n"
               "    - keyword: WHEN\n      content: Seed values: account `nobody`.\n"
               "  - name: two\n    steps:\n    - keyword: GIVEN\n      content: 'Seed values: account `ann`, email `ann.lee@example.test`.'\n"
               "- id: REQ-2\n  name: Open\n  type: ATOMIC\n  scenarios:\n"
               "  - name: one\n    steps:\n    - keyword: GIVEN\n      content: The evaluation seed contains the board `Plans`\n"
               "        with rows `A/1`.\n"
               "  - name: two\n    steps:\n    - keyword: GIVEN\n      content: No seed here.\n")
        table = adapter.seed_checklist(req)
        self.assertIn("- REQ-1: account `ann`, email `ann.lee@example.test`\n", table + "\n")
        self.assertIn("- REQ-2: the board `Plans` with rows `A/1`", table)
        self.assertNotIn("nobody", table)
        self.assertEqual(table.count("ann.lee"), 1)
        self.assertEqual(adapter.seed_checklist("id: X\nname: none\n"), "")
        prompt = adapter.draft_messages(req)[1]["content"]
        self.assertLess(prompt.index("## Seed data checklist"), prompt.index("## Requirements (the application to build)"))

    def test_backtick_phrases_are_quoted_vocabulary_and_values_the_user_types_are_not(self):
        # Lite requirements backtick their control names; the old pattern saw none of them. What the test types
        # (fills `Name` with `Shelf Created 1`) is supplied at runtime, so it is no gate phrase, unless the
        # requirement also double-quotes it (the seeded account typed at login).
        req = ("- id: REQ-1\n  name: Create shelf\n"
               "  description: 'A form named `Create shelf form` has a textbox `Name` and a button named `Save Shelf`. "
               "Seed data: account \"user@example.com\".'\n"
               "  steps:\n"
               "    - keyword: WHEN\n"
               "      content: The user enters `user@example.com`, fills `Name` with `Shelf Created 1`, fills "
               "`Write here...` with `Body text.` and activates `Save Shelf`.\n"
               "    - keyword: THEN\n"
               "      content: The list shows exactly one entry named `Shelf Created 1`; a lone `quote\" pairs with nothing.\n")
        self.assertEqual(adapter.runtime_values(req), {"shelf created 1", "body text."})
        self.assertIn("- REQ-1 Create shelf: “Create shelf form”; “Name”; “Save Shelf”; "
                      "“user@example.com”; “Write here...”\n", adapter.vocabulary_table(req) + "\n")
        self.assertEqual(adapter.quoted_control_phrases(req), ["Create shelf form", "Name", "Save Shelf", "user@example.com"])
        stage = self.root / "stage"
        (stage / "frontend" / "public").mkdir(parents=True)
        (stage / "frontend" / "public" / "app.js").write_text(
            "html += '<form aria-label=\"Create shelf form\"><label>Name <input></label>"
            "<textarea placeholder=\"Write here...\"></textarea><button>+ Save Shelf</button></form>';\n"
            "const SEED = { account: 'user@example.com' };\n")
        self.assertEqual(adapter.vocabulary_gaps(stage, req), ([], 0))  # typed values are not demanded
        [decorated] = adapter.exact_name_gaps(stage, req)
        self.assertIn("“Save Shelf” appears only as `+ Save Shelf`", decorated)
        (stage / "frontend" / "public" / "app.js").write_text("html += '<button>Save</button>';\n")
        gaps, missing = adapter.vocabulary_gaps(stage, req)
        self.assertEqual(missing, 5)
        self.assertIn('"Save Shelf"', gaps[0])
        self.assertNotIn("Shelf Created 1", gaps[0])

    def test_the_draft_allowance_bounds_continuations(self):
        budget = adapter.CallBudget(draft_limit=1)
        prefix = block("backend/package.json", '{"scripts":{"start":"node server.js"}}')
        self.replies(events(prefix + "=== FILE: backend/server.js ===\n// cut off", finish="length"))
        with self.assertRaisesRegex(RuntimeError, r"draft call limit reached \(1\): the output was cut off inside "
                                                  r"`backend/server.js`"):
            self.generate(budget)
        self.assertEqual(self.transport.call_count, 1)
        self.assertFalse(self.out.exists())  # only backend/package.json was complete: nothing deliverable

    def test_each_cut_is_continued_while_the_draft_allowance_lasts(self):
        # Old rule: one continuation, and a second cut failed the task.
        parts = split_application()
        budget = adapter.CallBudget()
        self.replies(events(parts[0] + "=== FILE: backend/server.js ===\n// cut off", finish="length"),
                     events(parts[1] + parts[2] + "=== FILE: frontend/build.js ===\n// cut again", finish="length"),
                     events(parts[3] + parts[4]))
        files, totals = self.generate(budget)
        self.assertEqual(self.transport.call_count, 3)
        self.assertEqual(totals["completed_calls"], 3)
        self.assertEqual(len(files), 5)
        self.assertEqual(adapter.missing_required(self.out), [])
        self.assertNotIn("cut", (self.out / "backend/server.js").read_text() + (self.out / "frontend/build.js").read_text())
        self.assertIn("inside the file `backend/server.js`", budget.attempts[1]["messages"][-1]["content"])
        self.assertIn("inside the file `frontend/build.js`", budget.attempts[2]["messages"][-1]["content"])
        self.assertEqual([m["role"] for m in budget.attempts[2]["messages"]],
                         ["system", "user", "assistant", "user", "assistant", "user"])

    def test_a_cut_between_files_asks_for_the_remaining_files_only(self):
        # Old rule: "output truncated between file blocks; remaining files unknown" failed the task.
        parts = split_application()
        budget = adapter.CallBudget()
        self.replies(events(parts[0] + parts[1], finish="length"), events(parts[2] + parts[3] + parts[4]))
        files, _ = self.generate(budget)
        self.assertEqual(self.transport.call_count, 2)
        self.assertEqual(len(files), 5)
        ask = budget.attempts[1]["messages"][-1]["content"]
        self.assertIn("cut off between two files", ask)
        self.assertIn("`backend/package.json`, `backend/server.js`", ask)
        self.assertNotIn("frontend", ask)

    def test_a_complete_draft_cut_at_its_end_is_resumed_and_an_empty_resume_ends_the_draft(self):
        # Old assertion: a complete application with finish=length raised "truncated between". Now the model is
        # asked for the remaining files; an empty normal stop means there were none.
        budget = adapter.CallBudget()
        self.replies(events(application(), finish="length"), events(""))
        files, totals = self.generate(budget)
        self.assertEqual(self.transport.call_count, 2)
        self.assertEqual(totals["completed_calls"], 2)
        self.assertEqual(len(files), 5)
        self.assertIn("`frontend/public/index.html`", budget.attempts[1]["messages"][-1]["content"])
        self.assertEqual(adapter.missing_required(self.out), [])

    def test_a_broken_file_framing_keeps_the_complete_blocks_before_it(self):
        # A missing END used to raise and discard the whole draft. The blocks before the break are written, the
        # rest of the reply is dropped, and the model is asked for the remaining files like after a cut.
        parts = split_application()
        unterminated = "=== FILE: frontend/package.json ===\n{\"scripts\":{\"build\":\"node build.js\"}}\n"
        budget = adapter.CallBudget()
        self.replies(events(parts[0] + parts[1] + unterminated + parts[3] + parts[4]),
                     events(parts[2] + parts[3] + parts[4]))
        capture = io.StringIO()
        with contextlib.redirect_stderr(capture):
            files, _ = self.generate(budget)
        self.assertEqual(self.transport.call_count, 2)
        self.assertEqual(len(files), 5)
        self.assertEqual(adapter.missing_required(self.out), [])
        ask = budget.attempts[1]["messages"][-1]["content"]
        self.assertIn("broke the file framing (unterminated file before next block: frontend/package.json)", ask)
        self.assertEqual(ask.split("must not be emitted again: ")[1].split(". Continue")[0],
                         "`backend/package.json`, `backend/server.js`")
        self.assertIn("[oneshot] the reply broke the file framing (unterminated file before next block: "
                      "frontend/package.json); continuing", capture.getvalue())

    def test_a_broken_framing_before_any_complete_file_is_asked_again(self):
        budget = adapter.CallBudget()
        self.replies(events("=== FILE: a.js ===\nx\n=== FILE: b.js ===\ny\n=== END ===\n"), events(application()))
        files, _ = self.generate(budget)
        self.assertEqual(self.transport.call_count, 2)
        self.assertEqual(budget.attempts[1]["messages"], budget.attempts[0]["messages"])
        self.assertEqual(len(files), 5)
        self.assertFalse((self.out / "b.js").exists())  # blocks after the break are never written

    def test_a_stray_marker_after_a_complete_draft_keeps_the_draft(self):
        # With no call left for the rest, the kept blocks ship (they complete the application here).
        budget = adapter.CallBudget(draft_limit=1)
        self.replies(events(application() + "=== END ===\n"))
        capture = io.StringIO()
        with contextlib.redirect_stderr(capture):
            files, _ = self.generate(budget)
        self.assertEqual(len(files), 5)
        self.assertEqual(adapter.missing_required(self.out), [])
        self.assertIn("after an error: draft call limit reached (1): the reply broke the file framing (file closing "
                      "marker without an open block)", capture.getvalue())

    def test_a_cut_draft_stream_keeps_its_complete_blocks_and_continues(self):
        # The gateway cuts one stream at about 1200 s (a Ctrip draft took 1101 s). The complete blocks of the cut
        # attempt used to be discarded and the draft restarted from scratch into the same wall.
        parts = split_application()
        interruptions = (("no end markers", [], "StreamError"),
                         ("connection reset", [ConnectionResetError("synthetic reset")], "ConnectionResetError"),
                         ("incomplete read", [http.client.IncompleteRead(b"")], "IncompleteRead"))
        splits = (("inside a file", parts[0] + parts[1] + "=== FILE: frontend/package.json ===\n{\"scr",
                   parts[2] + parts[3] + parts[4], "inside the file `frontend/package.json`"),
                  ("between files", parts[0] + parts[1], parts[2] + parts[3] + parts[4],
                   "cut off between two files. These files are complete and must not be emitted again: "
                   "`backend/package.json`, `backend/server.js`."))
        for (kind, tail, error_type), (where, received, rest, ask) in \
                [(i, s) for i in interruptions for s in splits]:
            with self.subTest(kind=kind, where=where):
                out = self.root / f"{error_type}-{where.replace(' ', '-')}"
                budget = adapter.CallBudget()
                self.transport.reset_mock()
                self.replies(events(received, finish=None, done=False) + tail, events(rest))
                capture = io.StringIO()
                with contextlib.redirect_stderr(capture):
                    files, totals = adapter.generate("Synthetic requirements only", "synthetic-model",
                                                     "https://synthetic.invalid/v1", SYNTHETIC_KEY, out, budget)
                self.assertEqual(self.transport.call_count, 2)
                self.assertEqual([r["status"] for r in budget.attempts], ["failed", "completed"])
                self.assertEqual(budget.attempts[0]["error_type"], error_type)
                self.assertEqual(budget.attempts[1]["messages"][-2], {"role": "assistant", "content": received})
                self.assertIn(ask, budget.attempts[1]["messages"][-1]["content"])
                self.assertIn(f"[oneshot] call 1 was cut ({error_type}) after {len(received)} characters; "
                              f"keeping its complete file blocks", capture.getvalue())
                self.assertEqual((totals["failed_calls"], totals["completed_calls"]), (1, 1))
                self.assertEqual(totals["billing_status"], "unknown")  # billed, usage never reported
                self.assertEqual(len(files), 5)
                self.assertEqual(adapter.missing_required(out), [])
                self.assertEqual((out / "frontend/package.json").read_text(), '{"scripts":{"build":"node build.js"}}\n')

    def test_a_cut_stream_that_completes_the_application_ships_without_calls_left(self):
        budget = adapter.CallBudget(draft_limit=1, fail_limit=1)
        self.replies(events(application(), {"prompt_tokens": 9}, finish=None, done=False))
        capture = io.StringIO()
        with contextlib.redirect_stderr(capture):
            files, totals = self.generate(budget)
        self.assertEqual(len(files), 5)
        self.assertEqual(adapter.missing_required(self.out), [])
        self.assertIn("after an error: global model failure limit reached (1): the output was cut off between two "
                      "files", capture.getvalue())
        self.assertEqual(totals["known_prompt_tokens"], 9)
        self.assertEqual(totals["unknown_usage_calls"], [1])

    def test_a_cut_without_a_complete_block_is_retried_unchanged_before_a_later_cut_is_kept(self):
        # Only a partial first block arrived: the same request goes out again, as before. The retry breaks off
        # too, after two complete files: those are kept and the draft continues.
        parts = split_application()
        budget = adapter.CallBudget()
        self.replies(events("=== FILE: backend/package.json ===\n{\"scr", finish=None, done=False),
                     events(parts[0] + parts[1] + "=== FILE: frontend/package.json ===\n{", finish=None, done=False),
                     events(parts[2] + parts[3] + parts[4]))
        capture = io.StringIO()
        with contextlib.redirect_stderr(capture):
            files, _ = self.generate(budget)
        self.assertEqual(self.transport.call_count, 3)
        self.assertEqual([r["status"] for r in budget.attempts], ["failed", "failed", "completed"])
        self.assertEqual(budget.attempts[1]["messages"], budget.attempts[0]["messages"])
        self.assertIn("inside the file `frontend/package.json`", budget.attempts[2]["messages"][-1]["content"])
        self.assertIn("[oneshot] call 1 failed; bounded retry in 5 s", capture.getvalue())
        self.assertEqual([c.args for c in adapter.time.sleep.call_args_list], [(5,)])  # waits out a short network blip
        self.assertIn("[oneshot] call 2 was cut (StreamError)", capture.getvalue())
        self.assertEqual(len(files), 5)
        self.assertEqual((self.out / "backend/package.json").read_text(), '{"scripts":{"start":"node server.js"}}\n')

    def test_cli_exits_nonzero_when_no_file_came_from_the_model(self):
        # Round 1 shipped the bare scaffold with exit 0 during a gateway outage, so the platform saw a success.
        requirement = self.out / "requirements"
        requirement.mkdir(parents=True)
        (requirement / "requirements.yaml").write_text("synthetic: true")
        (self.out / ".arc").mkdir()
        self.replies(*[URLError("synthetic outage")] * 5)
        capture = io.StringIO()
        with patch.object(adapter, "SCAFFOLD", True), \
                patch.dict(os.environ, {"OPENAI_API_KEY": SYNTHETIC_KEY}, clear=True), \
                contextlib.redirect_stderr(capture), contextlib.redirect_stdout(io.StringIO()):
            code = adapter.main([str(requirement), "--output-dir", str(self.out)])
        self.assertEqual(code, 1)
        self.assertEqual(self.transport.call_count, 5)
        self.assertIn("[oneshot] delivering the last complete version after an error: model stream failed (URLError)",
                      capture.getvalue())
        self.assertIn("[oneshot] failed: no application file came from the model", capture.getvalue())
        self.assertTrue((self.out / "frontend/public/lib/arc.js").is_file())  # the scaffold is still in place

    def test_continuation_can_retry_without_leaking_a_failed_version(self):
        budget = adapter.CallBudget()
        prefix = block("backend/package.json", '{"scripts":{"start":"node server.js"}}')
        rest = application()[len(prefix):]
        # The failed continuation attempt breaks off inside its first block, so nothing of it is complete.
        self.replies(events(prefix + "=== FILE: backend/server.js ===\n// cut off", finish="length"),
                     events("=== FILE: backend/server.js ===\n// leaked half", finish=None, done=False), events(rest))
        self.generate(budget)
        self.assertEqual(self.transport.call_count, 3)
        self.assertNotIn("leaked", (self.out / "backend/server.js").read_text())
        self.assertNotIn("cut off", (self.out / "backend/server.js").read_text())
        self.assertIn("backend/server.js", budget.attempts[1]["messages"][-1]["content"])
        self.assertEqual(budget.attempts[2]["messages"], budget.attempts[1]["messages"])  # the same request again

    def test_no_continuation_for_stop_with_an_open_block(self):
        # The two other cases of the old table changed meaning: a complete draft cut at `length` between files is
        # resumed, and an empty stream is a completed call that is asked again (tests above).
        budget = adapter.CallBudget()
        self.replies(events("=== FILE: x.js ===\npartial", finish="stop"))
        with self.assertRaisesRegex(ValueError, "incomplete delivery"):
            self.generate(budget)
        self.assertEqual(len(budget.attempts), 1)
        self.assertFalse(self.out.exists())

    def test_an_error_after_complete_files_delivers_them(self):
        # Transport failures spent in a continuation used to delete the staged application with the error.
        budget = adapter.CallBudget(fail_limit=2)
        self.replies(events(application() + "=== FILE: frontend/public/app.js ===\n// cut off", finish="length"),
                     URLError("first"), URLError("second"))
        capture = io.StringIO()
        with contextlib.redirect_stderr(capture):
            files, totals = self.generate(budget)
        self.assertEqual(len(files), 5)
        self.assertEqual(adapter.missing_required(self.out), [])
        self.assertFalse((self.out / "frontend/public/app.js").exists())  # a partial file never ships
        self.assertIn("[oneshot] delivering the last complete version after an error: model stream failed (URLError)",
                      capture.getvalue())
        self.assertEqual(totals["failed_calls"], 2)
        self.assertEqual(list(self.root.glob(".oneshot-*")), [])

    def test_a_rejected_path_or_a_spent_draft_allowance_delivers_the_complete_files(self):
        # A broken framing is no longer an error (the complete blocks before it are kept and the draft continues:
        # test_a_broken_file_framing_keeps_the_complete_blocks_before_it); a path outside the stage still is.
        cut = "=== FILE: frontend/public/app.js ===\n// cut off"
        cases = ((adapter.CallBudget(), events(block("../escape.js", "bad")),
                  "path escapes the output directory: ../escape.js"),
                 (adapter.CallBudget(draft_limit=2), events(cut, finish="length"),
                  "draft call limit reached (2): the output was cut off inside `frontend/public/app.js`"))
        for budget, continuation, reason in cases:
            with self.subTest(reason=reason):
                out = self.root / ("app-" + str(len(reason)))
                self.replies(events(application() + cut, finish="length"), continuation)
                capture = io.StringIO()
                with contextlib.redirect_stderr(capture):
                    adapter.generate("Synthetic requirements only", "synthetic-model", "https://synthetic.invalid/v1",
                                     SYNTHETIC_KEY, out, budget)
                self.assertIn("delivering the last complete version after an error: " + reason, capture.getvalue())
                self.assertEqual(adapter.missing_required(out), [])
                self.assertFalse((out / "frontend/public/app.js").exists())

    def test_an_error_in_the_delivery_check_delivers_the_draft(self):
        budget = adapter.CallBudget()
        self.replies(events(application()))
        capture = io.StringIO()
        with patch.object(adapter, "SMOKE", True), contextlib.redirect_stderr(capture), \
                patch.object(adapter, "smoke_check", side_effect=RuntimeError("synthetic probe crash")):
            files, _ = self.generate(budget)
        self.assertEqual(len(files), 5)
        self.assertEqual(adapter.missing_required(self.out), [])
        self.assertIn("after an error: synthetic probe crash", capture.getvalue())

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

    def test_cli_sends_nonempty_prerequisites_with_the_requirements(self):
        # The runner places prerequisites.md beside requirements.yaml; empty on 09-24, and what it says is the task's.
        requirement = self.out / "requirements"
        requirement.mkdir(parents=True)
        (requirement / "requirements.yaml").write_text("synthetic: true")
        (self.out / ".arc").mkdir()
        for text, expected in (("", False), ("Seed account: synthetic-user / synthetic-pass\n", True)):
            with self.subTest(prerequisites=text):
                for name in ("frontend", "backend"):
                    shutil.rmtree(self.out / name, ignore_errors=True)
                (requirement / "prerequisites.md").write_text(text)
                self.transport.reset_mock()
                self.replies(events(application()))
                with patch.dict(os.environ, {"OPENAI_API_KEY": SYNTHETIC_KEY}, clear=True), \
                        contextlib.redirect_stderr(io.StringIO()), contextlib.redirect_stdout(io.StringIO()):
                    self.assertEqual(adapter.main([str(requirement), "--output-dir", str(self.out)]), 0)
                prompt = json.loads(self.transport.call_args_list[0].args[0].data)["messages"][1]["content"]
                self.assertEqual("## Prerequisites" in prompt, expected)
                self.assertEqual("synthetic-user / synthetic-pass" in prompt, expected)

    def test_cli_prepopulated_output_receives_the_complete_version_after_an_error(self):
        requirement = self.out / "requirements"
        requirement.mkdir(parents=True)
        (requirement / "requirements.yaml").write_text("synthetic: true")
        (self.out / ".arc").mkdir()
        (self.out / ".arc" / "runner-events.jsonl").write_text("{}\n")
        self.replies(events(application() + "=== FILE: frontend/public/app.js ===\n// cut off", finish="length"),
                     events(block("../escape.js", "bad")))
        capture, output = io.StringIO(), io.StringIO()
        with patch.dict(os.environ, {"OPENAI_API_KEY": SYNTHETIC_KEY}, clear=True), \
                contextlib.redirect_stderr(capture), contextlib.redirect_stdout(output):
            code = adapter.main([str(requirement), "--output-dir", str(self.out)])
        self.assertEqual(code, 0)
        self.assertIn("delivering the last complete version after an error: path escapes the output directory",
                      capture.getvalue())
        self.assertEqual(list(self.root.rglob("escape.js")), [])
        self.assertIn("[oneshot] wrote 5 files", output.getvalue())
        self.assertEqual(adapter.missing_required(self.out), [])
        self.assertFalse((self.out / "frontend/public/app.js").exists())
        self.assertEqual((self.out / ".arc" / "runner-events.jsonl").read_text(), "{}\n")
        self.assertEqual(list(self.out.glob(".oneshot-*")), [])

    def test_call_allowances_come_from_the_environment_and_a_bad_value_stops_before_any_request(self):
        self.assertEqual(adapter.CallBudget().limits, {"draft": 4, "repair": 6})
        self.assertEqual(adapter.CallBudget().repair_cny, 3.0)
        with patch.dict(os.environ, {"ONESHOT_DRAFT_CALLS": "6", "ONESHOT_REPAIR_CALLS": "0", "ONESHOT_REPAIR_CNY": "0.5"}):
            self.assertEqual(adapter.CallBudget().limits, {"draft": 6, "repair": 0})
            self.assertEqual(adapter.CallBudget().repair_cny, 0.5)
            self.assertEqual(adapter.CallBudget(draft_limit=1, repair_limit=1).limits, {"draft": 1, "repair": 1})
            self.assertEqual(adapter.CallBudget(repair_cny=2).repair_cny, 2.0)
        requirement = self.root / "requirements"
        requirement.mkdir()
        (requirement / "requirements.yaml").write_text("synthetic: true")
        for name, value in (("ONESHOT_DRAFT_CALLS", "0"), ("ONESHOT_DRAFT_CALLS", "many"), ("ONESHOT_REPAIR_CALLS", "-1"),
                            ("ONESHOT_REPAIR_CNY", "-1"), ("ONESHOT_REPAIR_CNY", "lots")):
            with self.subTest(name=name, value=value):
                with patch.dict(os.environ, {name: value}), self.assertRaisesRegex(ValueError, name):
                    adapter.CallBudget()
                capture = io.StringIO()
                with patch.dict(os.environ, {"OPENAI_API_KEY": SYNTHETIC_KEY, name: value}, clear=True), \
                        contextlib.redirect_stderr(capture):
                    self.assertEqual(adapter.main([str(requirement), "--output-dir", str(self.out)]), 1)
                self.assertIn(name, capture.getvalue())
        self.transport.assert_not_called()

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

    def test_extracted_zip_cli_keeps_a_cut_draft_and_continues_over_synthetic_local_http(self):
        # What the gateway's ~1200 s hard cut looks like on a real socket: the draft stream closes without a
        # finish reason or [DONE] after three complete files. They are kept; one continuation completes the rest.
        parts = split_application()
        draft = parts[0] + parts[1] + parts[2] + "=== FILE: frontend/build.js ===\n// Synth"
        bodies = [b"".join(events(draft, finish=None, done=False)),
                  b"".join(events(parts[3] + parts[4], {"prompt_tokens": 8, "completion_tokens": 13}))]
        seen = []

        class Handler(BaseHTTPRequestHandler):  # HTTP/1.0: the body ends when the connection closes
            def do_POST(self):
                seen.append(json.loads(self.rfile.read(int(self.headers["Content-Length"]))))
                self.send_response(200)
                self.send_header("Content-Type", "text/event-stream")
                self.end_headers()
                self.wfile.write(bodies.pop(0))

            def log_message(self, *args):
                pass

        server = HTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True)
        thread.start()
        try:
            with tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                pack.build_package(root / "candidate.zip")
                with zipfile.ZipFile(root / "candidate.zip") as archive:
                    archive.extractall(root / "candidate")
                requirements = root / "requirements"
                requirements.mkdir()
                (requirements / "requirements.yaml").write_text("synthetic: true")
                env = {"PATH": os.defpath, "PYTHONDONTWRITEBYTECODE": "1", "OPENAI_API_KEY": SYNTHETIC_KEY,
                       "OPENAI_BASE_URL": f"http://127.0.0.1:{server.server_port}/v1", "ONESHOT_SCAFFOLD": "0"}
                result = subprocess.run([sys.executable, str(root / "candidate/main.py"), str(requirements),
                                         "--output-dir", str(root / "out"), "--type", "web"],
                                        env=env, capture_output=True, text=True, timeout=30)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn("[oneshot] call 1 was cut (StreamError)", result.stderr)
                self.assertEqual(adapter.missing_required(root / "out"), [])
                self.assertEqual((root / "out/frontend/build.js").read_text(), "// Synthetic build fixture\n")
                self.assertEqual(len(seen), 2)
                self.assertEqual(seen[1]["messages"][-2], {"role": "assistant", "content": draft})
                self.assertIn("inside the file `frontend/build.js`", seen[1]["messages"][-1]["content"])
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main()


class RouteGapCase(unittest.TestCase):
    """A route the app opens with no screen of that name renders the fallback: fatal for record pages and
    navigations after an action, a hint for a plain dead link."""

    def stage(self, source):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        public = Path(temp.name) / "frontend" / "public"
        public.mkdir(parents=True)
        (public / "app.js").write_text(source)
        return Path(temp.name)

    def test_a_record_route_without_its_screen_is_fatal(self):
        stage = self.stage("const a = `<a href=\"#/w/${w.id}\">${w.name}</a>`;\n"
                           "function made(id) { ARC.navigate('#/w/' + id); }\n"
                           "window.LAYOUT = { account: () => '<a href=\"#/login\">Log in</a>' };")
        routes = {"screens": ["home", "new", "workbook"], "dispatch": "screen(route) { return this.screens[route.name]; }"}
        gaps = adapter.route_gaps(stage, routes)
        self.assertEqual(len(gaps), 2)
        self.assertTrue(adapter._fatal(gaps[0]))
        self.assertIn("#/w ", gaps[0] + " ")
        self.assertFalse(adapter._fatal(gaps[1]))
        self.assertIn("#/login", gaps[1])

    def test_routes_the_screens_or_the_dispatch_handle_pass(self):
        stage = self.stage("ARC.navigate('#/workbook/' + id); const b = '<a href=\"#/wb/1\">x</a>';")
        routes = {"screens": ["home", "workbook"], "dispatch": "screen(route) { if (route.name === 'wb') return 1; }"}
        self.assertEqual(adapter.route_gaps(stage, routes), [])
        self.assertEqual(adapter.route_gaps(stage, None), [])
