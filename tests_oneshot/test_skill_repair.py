"""Synthetic protocol/source fixtures only. No real gateway, sockets or application code."""
import copy
import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch
from urllib import error, request
import zipfile

from oneshot import skill_repair as sr
from scripts.package_skill_repair import build_package, FILES

EVIDENCE = [{"requirement": "Persist the chosen title", "observation": "Reopening displays an earlier title"}]
KEY = "synthetic-credential-do-not-log"


def completion(content=None, calls=None, reasoning=None, finish=None):
    message = {"role": "assistant", "content": content}
    if calls is not None:
        message["tool_calls"] = calls
    if reasoning is not None:
        message["reasoning_content"] = reasoning
    return {"id": "synthetic-response", "usage": {"prompt_tokens": 12, "completion_tokens": 7},
            "choices": [{"message": message, "finish_reason": finish or ("tool_calls" if calls else "stop")}]}


def read_call(ident, number=1):
    return {"id": f"synthetic_call_{number}", "type": "function",
            "function": {"name": "read_skill", "arguments": json.dumps({"id": ident})}}


class SyntheticResponse(io.BytesIO):
    def __init__(self, data, status=200, headers=None):
        super().__init__(data if isinstance(data, bytes) else json.dumps(data).encode())
        self.status = status
        self.headers = {"x-request-id": "synthetic-request", **(headers or {})}


class SyntheticGateway:
    def __init__(self, responses):
        self.responses = list(responses)
        self.requests = []

    def __call__(self, req, timeout):
        self.requests.append((req, timeout, json.loads(req.data)))
        if not self.responses:
            raise AssertionError("unexpected extra request / retry")
        response = self.responses.pop(0)
        if isinstance(response, BaseException):
            raise response
        return response if isinstance(response, SyntheticResponse) else SyntheticResponse(response)


class RepairTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=Path(tempfile.gettempdir()).resolve())
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.app = self.root / "A0"
        (self.app / "frontend").mkdir(parents=True)
        self.path = "frontend/app.js"
        (self.app / self.path).write_bytes(b"const title = 'earlier';\r\nconst stable = true;\r\n")
        (self.app / "asset.bin").write_bytes(b"\x00\x01")
        self.source = sr.load_source(self.app, [self.path])
        self.proposal = {"edits": [{"path": self.path, "before_sha256": sr.sha256(self.source.files[self.path].encode()),
                                    "old": "'earlier'", "new": "'current'"}]}
        self.network_guard = patch.object(sr, "_open_model", side_effect=AssertionError("real network forbidden"))
        self.network_guard.start()
        self.addCleanup(self.network_guard.stop)

    def run_proposal(self, gateway, **kwargs):
        return sr.propose(self.source, EVIDENCE, model="synthetic-model", base_url="https://synthetic.invalid/v1",
                          api_key=KEY, opener=gateway, **kwargs)

    def catalog_copy(self):
        root = self.root / "skills"
        shutil.copytree(sr.SKILL_ROOT, root)
        return root

    def test_http_error_retains_bounded_structured_details_without_reasoning(self):
        body = {"error": {"message": "bad request " + KEY, "type": "invalid_request", "code": "bad_tool"},
                "reasoning_content": "PRIVATE_ERROR_REASONING"}
        gateway = SyntheticGateway([error.HTTPError("https://synthetic.invalid/v1", 400, "bad", {},
                                    io.BytesIO(json.dumps(body).encode()))])
        with self.assertRaises(sr.RepairError) as caught:
            self.run_proposal(gateway)
        trace = caught.exception.trace
        self.assertEqual(len(gateway.requests), 1)
        self.assertEqual(trace["calls"][0]["gateway_error"]["code"], "bad_tool")
        self.assertNotIn(KEY, json.dumps(trace))
        self.assertNotIn("PRIVATE_ERROR_REASONING", json.dumps(trace))
        self.assertEqual(trace["calls"][0]["http_status"], 400)

    def test_gateway_index_metadata_is_normalized_without_changing_tool_ids(self):
        # Shape captured from the real organizer gateway; response content is synthetic.
        tool = read_call('state-roundtrip')
        tool['index'] = 0
        gateway = SyntheticGateway([completion(calls=[tool], reasoning='PRIVATE_NATIVE'),
                                    completion(json.dumps(self.proposal))])
        result = self.run_proposal(gateway)
        messages = gateway.requests[1][2]['messages']
        self.assertNotIn('index', messages[2]['tool_calls'][0])
        self.assertEqual(messages[3]['tool_call_id'], tool['id'])
        self.assertEqual(result['trace']['calls'][0]['assistant']['tool_calls'][0]['index'], 0)
        self.assertNotIn('PRIVATE_NATIVE', json.dumps(result['trace']))
        for index in (-1, 64, True, '0'):
            bad = read_call('state-roundtrip'); bad['index'] = index
            with self.subTest(index=index), self.assertRaises(sr.RepairError):
                self.run_proposal(SyntheticGateway([completion(calls=[bad])]))

    def test_native_two_successive_reads_index_only_and_private_reasoning(self):
        bodies = {ident: (sr.SKILL_ROOT / ident / "SKILL.md").read_text() for ident in sr.SKILL_IDS}
        gateway = SyntheticGateway([
            completion("Inspect contract", [read_call(sr.SKILL_IDS[0])], "PRIVATE_FIRST"),
            completion("Inspect state", [read_call(sr.SKILL_IDS[2], 2)], "PRIVATE_SECOND"),
            completion(json.dumps(self.proposal), reasoning="PRIVATE_FINAL")])
        result = self.run_proposal(gateway)
        self.assertEqual(result["proposal"], self.proposal)
        self.assertEqual(result["status"], "proposal_validated_unverified")
        first = gateway.requests[0][2]
        self.assertEqual(first["tools"][0]["function"]["name"], "read_skill")
        user = json.loads(first["messages"][1]["content"])
        self.assertEqual(set(user), {"skill_index", "observations", "source"})
        self.assertEqual(set(user["skill_index"][0]), {"id", "name", "description", "trigger"})
        for body in bodies.values():
            self.assertNotIn(body, json.dumps(first, ensure_ascii=False).replace("\\n", "\n"))
        second, third = gateway.requests[1][2]["messages"], gateway.requests[2][2]["messages"]
        self.assertEqual(second[2]["reasoning_content"], "PRIVATE_FIRST")
        self.assertEqual(second[3]["tool_call_id"], second[2]["tool_calls"][0]["id"])
        self.assertEqual(third[4]["reasoning_content"], "PRIVATE_SECOND")
        self.assertEqual(third[5]["tool_call_id"], "synthetic_call_2")
        self.assertEqual(json.loads(second[3]["content"])["body"], bodies[sr.SKILL_IDS[0]])
        self.assertEqual(json.loads(third[5]["content"])["body"], bodies[sr.SKILL_IDS[2]])
        for req, timeout, payload in gateway.requests:
            self.assertLessEqual(timeout, 120)
            self.assertFalse(payload["stream"])
            for message in payload["messages"]:
                self.assertNotIn(bodies[sr.SKILL_IDS[1]], message.get("content") or "")
                self.assertNotIn("dialect.md", message.get("content") or "")
        trace = result["trace"]
        self.assertEqual(set(trace["selected_skills"]), {sr.SKILL_IDS[0], sr.SKILL_IDS[2]})
        trace_text = json.dumps(trace)
        for secret in ("reasoning_content", "PRIVATE_FIRST", "PRIVATE_SECOND", "PRIVATE_FINAL", KEY):
            self.assertNotIn(secret, trace_text)
        for entry, (req, _, _) in zip(trace["calls"], gateway.requests):
            self.assertEqual(entry["request_sha256"], hashlib.sha256(req.data).hexdigest())
            self.assertEqual(entry["usage"]["completion_tokens"], 7)
            self.assertEqual(entry["request_ids"]["x-request-id"], "synthetic-request")
        self.assertEqual(trace["calls"][0]["assistant"]["content"], "Inspect contract")

    def test_repeated_read_dedup_and_parallel_tool_ids(self):
        ident = sr.SKILL_IDS[0]
        gateway = SyntheticGateway([
            completion(calls=[read_call(ident), read_call(ident, 2)]),
            completion(calls=[read_call(ident, 3)]), completion(json.dumps(self.proposal))])
        result = self.run_proposal(gateway)
        messages = gateway.requests[-1][2]["messages"]
        results = [json.loads(m["content"]) for m in messages if m["role"] == "tool"]
        self.assertEqual(sum("body" in r for r in results), 1)
        self.assertEqual([r["status"] for r in results], ["loaded", "already_loaded", "already_loaded"])
        self.assertEqual(result["trace"]["skill_bytes"], len((sr.SKILL_ROOT / ident / "SKILL.md").read_bytes()))

    def test_catalog_unknown_traversal_modified_hash_symlink(self):
        root = self.catalog_copy()
        catalog = sr.SkillCatalog(root)
        for ident in ("unknown", "../state-roundtrip", "/tmp/x", {}, None):
            with self.subTest(id=ident), self.assertRaises(sr.RepairError):
                catalog.read(ident)
        path = root / sr.SKILL_IDS[0] / "SKILL.md"
        original = path.read_bytes()
        path.write_bytes(original + b"modified")
        with self.assertRaisesRegex(sr.RepairError, "hash"):
            catalog.read(sr.SKILL_IDS[0])
        path.unlink()
        path.symlink_to(sr.SKILL_ROOT / sr.SKILL_IDS[0] / "SKILL.md")
        with self.assertRaisesRegex(sr.RepairError, "symlink"):
            catalog.read(sr.SKILL_IDS[0])

    def test_catalog_rejects_index_path_and_index_symlink(self):
        root = self.catalog_copy()
        path = root / "index.json"
        data = json.loads(path.read_text())
        data["skills"][0]["path"] = "../elsewhere/SKILL.md"
        path.write_text(json.dumps(data))
        with self.assertRaises(sr.RepairError):
            sr.SkillCatalog(root)
        path.unlink()
        path.symlink_to(sr.SKILL_ROOT / "index.json")
        with self.assertRaises(sr.RepairError):
            sr.SkillCatalog(root)

    def test_repeat_revalidates_hash_and_budgets_fail_closed(self):
        root = self.catalog_copy()
        cat = sr.SkillCatalog(root, limits=sr.Limits(max_reads=1))
        cat.read(sr.SKILL_IDS[0])
        with self.assertRaisesRegex(sr.RepairError, "read budget"):
            cat.read(sr.SKILL_IDS[0])
        cat = sr.SkillCatalog(root, limits=sr.Limits(max_skill_bytes=1))
        with self.assertRaisesRegex(sr.RepairError, "byte budget"):
            cat.read(sr.SKILL_IDS[0])
        cat = sr.SkillCatalog(root)
        cat.read(sr.SKILL_IDS[0])
        path = root / sr.SKILL_IDS[0] / "SKILL.md"
        path.write_text("modified after first read")
        with self.assertRaisesRegex(sr.RepairError, "hash"):
            cat.read(sr.SKILL_IDS[0])

    def test_tool_failure_no_followup_or_fallback(self):
        for calls in ([read_call("unknown")], [read_call("../elsewhere")],
                      [read_call(sr.SKILL_IDS[0]), read_call(sr.SKILL_IDS[1], 2)]):
            gateway = SyntheticGateway([completion(calls=calls)])
            with self.subTest(calls=calls), self.assertRaises(sr.RepairError):
                self.run_proposal(gateway, limits=sr.Limits(max_reads=1))
            self.assertEqual(len(gateway.requests), 1)

    def test_invalid_tool_ids_arguments_and_finish(self):
        invalid = read_call(sr.SKILL_IDS[0])
        invalid["function"]["arguments"] = '{"id":"state-roundtrip","path":"x"}'
        for response in (completion(calls=[invalid]), completion(calls=[read_call(sr.SKILL_IDS[0])] * 2),
                         completion("partial", finish="length"), completion(json.dumps(self.proposal), finish="content_filter")):
            gateway = SyntheticGateway([response])
            with self.assertRaises(sr.RepairError):
                self.run_proposal(gateway)
            self.assertEqual(len(gateway.requests), 1)

    def test_call_caps_and_limits(self):
        for limit in (4, 6):
            gateway = SyntheticGateway([completion(calls=[read_call(sr.SKILL_IDS[0], i)]) for i in range(limit)])
            with self.assertRaisesRegex(sr.RepairError, "call budget") as caught:
                self.run_proposal(gateway, limits=sr.Limits(max_calls=limit))
            self.assertEqual(len(gateway.requests), limit)
            self.assertEqual(len(caught.exception.trace["calls"]), limit)
        for kwargs in ({"max_calls": 7}, {"max_calls": True}, {"max_reads": 13}, {"wall_seconds": 301},
                       {"request_timeout": 301}, {"wall_seconds": float("nan")}, {"response_bytes": 2**21 + 1}):
            with self.subTest(kwargs=kwargs), self.assertRaises(sr.RepairError):
                sr.Limits(**kwargs)

    def test_source_sha_unique_old_path_protected_size_and_overlap(self):
        invalid = [dict(old=""), dict(old="absent"), dict(before_sha256="0" * 64),
                   dict(path="../app.js"), dict(path="/app.js"), dict(path="frontend/./app.js"),
                   dict(path="frontend\\app.js"), dict(path="new.js"), dict(new="x" * (sr.MAX_EDIT_BYTES + 1)),
                   dict(new="'earlier'"), dict(new="\x00")]
        for change in invalid:
            proposal = copy.deepcopy(self.proposal)
            proposal["edits"][0].update(change)
            with self.subTest(change=list(change)), self.assertRaises(sr.RepairError):
                sr.validate_proposal(proposal, self.source)
        for proposal in ({"edits": self.proposal["edits"] * 17}, {"edits": self.proposal["edits"] * 2},
                         {"edits": [], "verified": True}):
            with self.assertRaises(sr.RepairError):
                sr.validate_proposal(proposal, self.source)
        protected = sr.load_source(self.app, [self.path], protected_paths=[self.path])
        with self.assertRaisesRegex(sr.RepairError, "protected"):
            sr.validate_proposal(self.proposal, protected)
        (self.app / self.path).write_text("aaaa")
        source = sr.load_source(self.app, [self.path])
        ambiguous = {"edits": [{"path": self.path, "before_sha256": sr.sha256(b"aaaa"), "old": "aaa", "new": "b"}]}
        with self.assertRaisesRegex(sr.RepairError, "exactly once"):
            sr.validate_proposal(ambiguous, source)

    def test_provided_modules_are_readable_but_never_editable(self):
        for name in sr.PROTECTED_NAMES:
            (self.app / name).write_text("protected implementation")
            source = sr.load_source(self.app, [name])
            proposal = {"edits": [{"path": name, "before_sha256": sr.sha256(b"protected implementation"),
                                   "old": "implementation", "new": "changed"}]}
            with self.assertRaisesRegex(sr.RepairError, "protected"):
                sr.validate_proposal(proposal, source)
            messages = sr.build_messages(source, EVIDENCE, sr.SkillCatalog())
            self.assertFalse(json.loads(messages[1]["content"])["source"][0]["editable"])

    def test_source_selection_and_mutation_guards(self):
        for name in ("../outside", "frontend/app.spec.js", "tests/check.js", "scores.json", ".env", "/absolute"):
            with self.subTest(name=name), self.assertRaises(sr.RepairError):
                sr.load_source(self.app, [name])
        (self.app / "link.js").symlink_to(self.app / self.path)
        with self.assertRaises(sr.RepairError):
            sr.load_source(self.app, ["link.js"])
        (self.app / self.path).write_text("changed outside model")
        with self.assertRaisesRegex(sr.RepairError, "source changed"):
            sr.validate_proposal(self.proposal, self.source)

    def test_apply_only_new_copy_original_and_unselected_unchanged(self):
        for name in sr.PROTECTED_NAMES:
            (self.app / name).write_bytes(b"supplied bytes")
        original = {p.relative_to(self.app).as_posix(): p.read_bytes() for p in self.app.rglob("*") if p.is_file()}
        output = self.root / "A1"
        status = sr.apply_proposal(self.source, self.proposal, output)
        self.assertEqual(status["status"], "applied_unverified")
        for name, data in original.items():
            self.assertEqual((self.app / name).read_bytes(), data)
            self.assertEqual((output / name).read_bytes(), data.replace(b"'earlier'", b"'current'") if name == self.path else data)
        for bad in (self.app, self.app / "A1", self.root, output):
            with self.subTest(output=bad), self.assertRaises(sr.RepairError):
                sr.apply_proposal(self.source, self.proposal, bad)
        empty = self.root / "empty"
        empty.mkdir()
        with self.assertRaises(sr.RepairError):
            sr.apply_proposal(self.source, self.proposal, empty)
        alias = self.root / "alias"
        alias.symlink_to(self.app, target_is_directory=True)
        with self.assertRaises(sr.RepairError):
            sr.apply_proposal(self.source, self.proposal, alias / "nested")

    def test_copy_rejects_unselected_links_before_writing(self):
        (self.app / "bad").symlink_to(self.root, target_is_directory=True)
        output = self.root / "A1"
        with self.assertRaises(sr.RepairError):
            sr.apply_proposal(self.source, self.proposal, output)
        self.assertFalse(output.exists())

    def test_edits_are_applied_to_original_offsets(self):
        proposal = copy.deepcopy(self.proposal)
        proposal["edits"][0]["new"] = "stable"
        proposal["edits"].append({"path": self.path, "before_sha256": proposal["edits"][0]["before_sha256"],
                                 "old": "stable", "new": "preserved"})
        sr.apply_proposal(self.source, proposal, self.root / "A1")
        self.assertEqual((self.root / "A1" / self.path).read_bytes(), b"const title = stable;\r\nconst preserved = true;\r\n")

    def test_http_failures_bounded_no_retry_and_credentials_redacted(self):
        for code in (302, 402, 429, 500):
            body = io.BytesIO(b"never consume error body " + KEY.encode())
            exc = error.HTTPError("https://synthetic.invalid", code, KEY, {"x-request-id": KEY}, body)
            gateway = SyntheticGateway([exc])
            with self.subTest(code=code), self.assertRaises(sr.RepairError) as caught:
                self.run_proposal(gateway)
            self.assertTrue(body.closed)
            self.assertNotIn(KEY, json.dumps(caught.exception.trace))
            self.assertEqual(caught.exception.trace["calls"][0]["http_status"], code)
            self.assertEqual(len(gateway.requests), 1)
        gateway = SyntheticGateway([error.URLError(KEY)])
        with self.assertRaises(sr.RepairError) as caught:
            self.run_proposal(gateway)
        self.assertNotIn(KEY, json.dumps(caught.exception.trace))
        self.assertEqual(len(gateway.requests), 1)

    def test_response_size_incomplete_invalid_json_and_missing_usage(self):
        for response in (SyntheticResponse(b"x" * 101), SyntheticResponse(b"", headers={"Content-Length": "101"}),
                         SyntheticResponse(b"{}", headers={"Content-Length": "99"}), SyntheticResponse(b"not-json"),
                         SyntheticResponse(b"{}", headers={"Content-Encoding": "gzip"})):
            gateway = SyntheticGateway([response])
            with self.assertRaises(sr.RepairError):
                self.run_proposal(gateway, limits=sr.Limits(response_bytes=100))
            self.assertEqual(len(gateway.requests), 1)
        response = completion(json.dumps(self.proposal))
        del response["usage"]
        result = self.run_proposal(SyntheticGateway([response]))
        self.assertIsNone(result["trace"]["calls"][0]["usage"])

    def test_wall_and_request_deadlines_and_alarm_restoration(self):
        def slow(req, timeout):
            time.sleep(0.3)
            raise AssertionError("deadline did not interrupt")
        for limits in (sr.Limits(wall_seconds=0.03), sr.Limits(request_timeout=0.03)):
            started = time.monotonic()
            with self.assertRaisesRegex(sr.RepairError, "time budget") as caught:
                self.run_proposal(slow, limits=limits)
            self.assertLess(time.monotonic() - started, 0.25)
            self.assertEqual(len(caught.exception.trace["calls"]), 1)
            self.assertEqual(signal.getitimer(signal.ITIMER_REAL), (0.0, 0.0))

    def test_redaction_and_no_url_credentials_or_redirects(self):
        text = json.dumps(sr._safe({"reasoning_content": "PRIVATE", "authorization": KEY,
                                   "content": "Bearer abcdef api_key='another-secret' " + KEY}, KEY))
        for secret in (KEY, "PRIVATE", "abcdef", "another-secret", "reasoning_content"):
            self.assertNotIn(secret, text)
        for url in ("http://external.invalid", "https://user:pass@synthetic.invalid", "https://synthetic.invalid/?key=abc"):
            with self.assertRaises(sr.RepairError):
                sr._endpoint(url)
        with self.assertRaises(error.HTTPError):
            sr._NoRedirect().redirect_request(request.Request("https://synthetic.invalid/v1"), None, 302, "moved", {}, "https://other.invalid")

    def test_observations_and_json_schema_limits(self):
        for rows in ([], [{"score": 1}], [{"requirement": "x", "observation": "y", "evaluator": "z"}],
                     [{"requirement": "x", "observation": "x" * 65536}]):
            gateway = SyntheticGateway([])
            with self.assertRaises(sr.RepairError):
                sr.propose(self.source, rows, model="synthetic", base_url="https://synthetic.invalid",
                           api_key=KEY, opener=gateway)
            self.assertEqual(gateway.requests, [])
        for text in ('{"edits": [], "edits": []}', '{"edits":NaN}'):
            with self.assertRaises(sr.RepairError):
                sr.validate_proposal(text, self.source)

    def test_reproducible_standalone_package_and_extracted_offline_cli(self):
        first, second = self.root / "first.zip", self.root / "second.zip"
        one, two = build_package(first), build_package(second)
        self.assertEqual(first.read_bytes(), second.read_bytes())
        self.assertEqual(one, two)
        self.assertEqual(Path(str(first) + ".manifest.json").read_bytes(), Path(str(second) + ".manifest.json").read_bytes())
        extracted = self.root / "extracted"
        with zipfile.ZipFile(first) as archive:
            self.assertEqual(set(archive.namelist()), set(FILES))
            archive.extractall(extracted)
        help_result = subprocess.run([sys.executable, "-B", str(extracted / "skill_repair.py"), "--help"],
                                     cwd=extracted, capture_output=True, text=True, timeout=10)
        self.assertEqual(help_result.returncode, 0, help_result.stderr)
        self.assertIn("--real-request", help_result.stdout)
        path = self.root / "proposal.json"
        path.write_text(json.dumps(self.proposal))
        command = [sys.executable, "-B", str(extracted / "skill_repair.py"), "--input-path", str(self.app),
                   "--source", self.path, "--proposal-file", str(path), "--output-path", str(self.root / "CLI-A1")]
        applied = subprocess.run(command, cwd=extracted, capture_output=True, text=True, timeout=10)
        self.assertEqual(applied.returncode, 0, applied.stderr)
        self.assertEqual(json.loads(applied.stdout)["application"]["status"], "applied_unverified")
        again = subprocess.run(command, cwd=extracted, capture_output=True, text=True, timeout=10)
        self.assertEqual(again.returncode, 2)
        with self.assertRaises(ValueError):
            build_package(first)


if __name__ == "__main__":
    unittest.main()
