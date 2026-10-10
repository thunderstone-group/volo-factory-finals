"""Hidden acceptance cases for delivery-never-zero (main session only; the executor never sees these).

Run from the branch worktree root:
  ~/projects/volo-factory/.venv/bin/python -m unittest /path/to/hidden_dnz_test.py
All transports are synthetic; no gateway calls.
"""
import json
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch
from urllib.error import URLError

sys.path.insert(0, os.getcwd())
from oneshot import main as adapter  # noqa: E402
from tests_oneshot.test_oneshot import (OfflineCase, SyntheticStream, block, application,  # noqa: E402
                                        events, SYNTHETIC_KEY)

BACKEND = (block("backend/package.json", '{"scripts":{"start":"node server.js"}}') +
           block("backend/server.js", "// Synthetic local fixture\n" +
                 "process.on('uncaughtException', (e) => console.error('uncaught', e)); "
                 "process.on('unhandledRejection', (e) => console.error('unhandled', e));\n" +
                 "console.log('fixture');"))
FRONT_A = (block("frontend/package.json", '{"scripts":{"build":"node build.js"}}') +
           block("frontend/build.js", "// Synthetic build fixture"))
FRONT_B = block("frontend/public/index.html", "<!doctype html><title>Synthetic</title>")


def payloads(transport):
    return [json.loads(call.args[0].data) for call in transport.call_args_list]


class HiddenDeliveryNeverZero(OfflineCase):
    def gen(self, model, budget=None):
        return adapter.generate("Synthetic requirements only", model, "https://synthetic.invalid/v1",
                                SYNTHETIC_KEY, self.out, budget)

    def test_between_block_truncation_twice_then_complete(self):
        # draft cut between blocks, continuation cut between blocks again, second continuation completes
        self.replies(events(BACKEND, finish="length"), events(FRONT_A, finish="length"), events(FRONT_B))
        with patch.dict(os.environ, {}, clear=False):
            files, _ = self.gen("synthetic-model")
        for name in ("backend/server.js", "frontend/build.js", "frontend/public/index.html"):
            self.assertTrue((self.out / name).is_file(), name)
        self.assertEqual(self.transport.call_count, 3)

    def test_flash_transport_failures_fall_back_to_kimi_at_temperature_one(self):
        env = {k: v for k, v in os.environ.items() if k != "FALLBACK_MODEL"}
        self.replies(URLError("cut"), URLError("cut"), URLError("cut"), events(application()))
        with patch.dict(os.environ, env, clear=True):
            self.gen("deepseek-v4-flash")
        sent = payloads(self.transport)
        self.assertEqual(sent[-1]["model"], "kimi-k2.7-code-highspeed")
        self.assertEqual(sent[-1]["temperature"], 1.0)
        self.assertTrue((self.out / "frontend/public/index.html").is_file())

    def test_kimi_transport_failures_fall_back_to_flash(self):
        env = {k: v for k, v in os.environ.items() if k != "FALLBACK_MODEL"}
        self.replies(URLError("cut"), URLError("cut"), URLError("cut"), events(application()))
        with patch.dict(os.environ, env, clear=True):
            self.gen("kimi-k2.7-code-highspeed")
        self.assertEqual(payloads(self.transport)[-1]["model"], "deepseek-v4-flash")

    def test_empty_fallback_env_disables_fallback(self):
        self.replies(URLError("cut"), URLError("cut"), URLError("cut"), events(application()))
        with patch.dict(os.environ, {"FALLBACK_MODEL": ""}):
            with self.assertRaises(Exception):
                self.gen("deepseek-v4-flash")
        self.assertEqual(len({p["model"] for p in payloads(self.transport)}), 1)
        self.assertFalse((self.out / "frontend").exists())

    def test_empty_content_is_retried(self):
        self.replies(events("", finish="stop"), events(application()))
        self.gen("synthetic-model")
        self.assertTrue((self.out / "backend/server.js").is_file())
        self.assertEqual(self.transport.call_count, 2)

    def test_content_filter_continues_on_resolved_fallback_not_qwen(self):
        env = {k: v for k, v in os.environ.items() if k != "FALLBACK_MODEL"}
        self.replies(events(BACKEND + "=== FILE: frontend/package.json ===\n{", finish="content_filter"),
                     events(FRONT_A + FRONT_B))
        with patch.dict(os.environ, env, clear=True):
            self.gen("deepseek-v4-flash")
        models = [p["model"] for p in payloads(self.transport)]
        self.assertNotIn("qwen3.7-plus", models)
        self.assertTrue((self.out / "frontend/public/index.html").is_file())


class HiddenMainDelivers(OfflineCase):
    """main(): an exception after a complete draft still publishes the staged application."""

    def setUp(self):
        super().setUp()
        self.req = self.root / "req"
        self.req.mkdir()
        (self.req / "requirements.yaml").write_text("id: ROOT\nname: Synthetic\n", encoding="utf-8")

    def run_main(self, out):
        env = {"OPENAI_API_KEY": SYNTHETIC_KEY, "MODEL": "synthetic-model",
               "OPENAI_BASE_URL": "https://synthetic.invalid/v1"}
        with patch.dict(os.environ, env), patch.object(adapter, "SMOKE", True), \
                patch.object(adapter, "repair_delivery", side_effect=RuntimeError("synthetic repair crash")):
            return adapter.main([str(self.req), "--output-dir", str(out)])

    def test_repair_crash_still_delivers_to_empty_output(self):
        self.replies(events(application()))
        out = self.root / "out-empty"
        self.assertEqual(self.run_main(out), 0)
        self.assertTrue((out / "backend/server.js").is_file())

    def test_repair_crash_still_delivers_to_platform_prepopulated_output(self):
        self.replies(events(application()))
        out = self.root / "workspace"
        (out / ".arc").mkdir(parents=True)
        (out / "requirements").mkdir()
        self.assertEqual(self.run_main(out), 0)
        self.assertTrue((out / "frontend/public/index.html").is_file())
        self.assertTrue((out / ".arc").is_dir())


class HiddenBacktickNames(OfflineCase):
    def test_backtick_control_names_are_quoted_vocabulary(self):
        text = ("- id: REQ-9.9\n  name: Save\n  scenarios:\n    - steps:\n"
                "        - keyword: WHEN\n          content: The user activates the unique button named `Save Draft`.\n")
        self.assertIn("Save Draft", adapter.quoted_control_phrases(text))
        self.assertIn("Save Draft", adapter.vocabulary_table(text))
