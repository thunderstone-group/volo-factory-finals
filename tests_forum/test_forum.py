"""SYNTHETIC HTTP fixtures only. No captured site data or real authentication.

The fake HTTPS handler runs urllib's actual redirect/error pipeline without sockets.
No test is evidence that bbs.qiwoo.edu.cn implements the assumed Discourse contract.
"""
import copy
import io
import json
import os
import stat
import subprocess
import sys
import tempfile
import unittest
import urllib.error
import urllib.parse
import urllib.request
from contextlib import redirect_stderr, redirect_stdout
from email.message import Message
from pathlib import Path
from unittest.mock import patch

from tools.qiwoo_cli import cli
from tools.qiwoo_cli.client import (BATCH_SIZE, MAX_POSTS, MAX_RESPONSE, ORIGIN,
                                    Client, ForumError, SafeRedirect, read_route, topic_id)
from tools.qiwoo_cli.storage import (AUTH_LIMIT, BODY_LIMIT, load_auth, parse_session,
                                     save_private, validate_session)

ROOT = Path(__file__).resolve().parents[1]
SESSION = {"origin": ORIGIN, "cookie": "_t=SYNTHETIC_SECRET; _forum_session=SYNTHETIC_SESSION"}


def post(number, target=15, body=None):
    return {"id": target * 1000 + number, "topic_id": target, "post_number": number,
            "created_at": "2026-09-16T01:02:03.000Z", "username": "synthetic_author",
            "cooked": body if body is not None else "<p>synthetic post %s</p>" % number}


def topic_payload(count=1, target=15, first=1):
    return {"id": target, "title": "Synthetic topic %s" % target,
            # Deliberately unrelated category ID: topic IDs must not become category IDs.
            "category_id": 999, "posts_count": count,
            "post_stream": {"stream": [target * 1000 + n for n in range(1, count + 1)],
                            "posts": [post(n, target) for n in range(1, min(count, first) + 1)]}}


class Response(io.BytesIO):
    def __init__(self, url, payload, status=200, headers=None):
        raw = payload if isinstance(payload, bytes) else json.dumps(payload).encode()
        super().__init__(raw)
        self.url, self.status, self.code, self.msg = url, status, status, "synthetic"
        self.headers = Message()
        self.headers["Content-Type"] = "application/json"
        for key, value in (headers or {}).items():
            if key in self.headers:
                self.headers.replace_header(key, value)
            else:
                self.headers[key] = value

    def geturl(self):
        return self.url

    def info(self):
        return self.headers


class SyntheticHTTPS(urllib.request.HTTPSHandler):
    def __init__(self, responder):
        super().__init__()
        self.requests = []
        self.responder = responder

    def https_open(self, request):
        self.requests.append(request)
        return self.responder(request)


def transport(responder, session=None):
    handler = SyntheticHTTPS(responder)
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), SafeRedirect(), handler)
    return Client(session, opener=opener), handler


def full_responder(count=45):
    def respond(request):
        parts = urllib.parse.urlsplit(request.full_url)
        if parts.path.endswith("/posts.json"):
            target = int(parts.path.split("/")[2])
            ids = urllib.parse.parse_qs(parts.query)["post_ids[]"]
            # Reverse batch order to ensure output order comes from stream IDs.
            posts = [post(int(key) - target * 1000, target) for key in reversed(ids)]
            return Response(request.full_url, {"post_stream": {"posts": posts}})
        target = int(parts.path.split("/")[-1].split(".")[0])
        return Response(request.full_url, topic_payload(count, target))
    return respond


class CLITestCase(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="qiwoo-synthetic-")
        self.directory = Path(self.temp.name)
        self.auth = self.directory / "auth.json"
        self.defaults = patch.object(cli, "DEFAULT_AUTH", self.auth)
        self.defaults.start()
        self.addCleanup(self.defaults.stop)
        self.addCleanup(self.temp.cleanup)
        # Fail closed if a test accidentally escapes the synthetic transport.
        self.network = patch("socket.create_connection", side_effect=AssertionError("Unexpected network"))
        self.network.start()
        self.addCleanup(self.network.stop)

    def run_cli(self, args, stdin="", client=None):
        stdout, stderr = io.StringIO(), io.StringIO()
        with redirect_stdout(stdout), redirect_stderr(stderr), patch.object(sys, "stdin", io.StringIO(stdin)):
            if client is None:
                code = cli.main(args)
            else:
                with patch.object(cli, "Client", return_value=client):
                    code = cli.main(args)
        return code, stdout.getvalue(), stderr.getvalue()


class TopicTests(CLITestCase):
    def test_aliases_are_topic_ids(self):
        self.assertEqual([topic_id("course"), topic_id("competition"), topic_id("123")], [15, 16, 123])
        for command, target in [(["course"], 15), (["competition"], 16),
                                (["topic", "course"], 15), (["topic", "16"], 16)]:
            with self.subTest(command=command):
                client, handler = transport(full_responder(1))
                code, out, err = self.run_cli(command, client=client)
                self.assertEqual((code, err), (0, ""))
                self.assertEqual(json.loads(out)["topic_id"], target)
                self.assertEqual(handler.requests[0].full_url, ORIGIN + "/t/%s.json" % target)

    def test_invalid_topic_ids(self):
        for value in ("0", "-1", "15/1", ORIGIN + "/t/topic/15", "course; ls", "category:15", "9" * 30):
            with self.subTest(value=value), self.assertRaises(ForumError):
                topic_id(value)

    def test_full_stream_fetches_every_missing_post_in_bounded_batches(self):
        client, handler = transport(full_responder(45))
        topic = client.topic(15)
        self.assertEqual([p["post_number"] for p in topic["posts"]], list(range(1, 46)))
        self.assertEqual(len(handler.requests), 4)
        sizes = [len(urllib.parse.parse_qs(urllib.parse.urlsplit(r.full_url).query)["post_ids[]"])
                 for r in handler.requests[1:]]
        self.assertEqual(sizes, [BATCH_SIZE, BATCH_SIZE, 4])
        self.assertTrue(all(r.get_method() == "GET" and r.data is None for r in handler.requests))

    def test_already_complete_topic_needs_one_request_and_memory_cache_only(self):
        client, handler = transport(lambda req: Response(req.full_url, topic_payload(3, first=3)))
        self.assertEqual(len(client.topic(15)["posts"]), 3)
        client.topic(15)
        self.assertEqual(len(handler.requests), 1)
        self.assertEqual(list(self.directory.iterdir()), [])

    def test_metadata_and_bounded_output_preserve_paging(self):
        client, handler = transport(full_responder(45))
        code, out, err = self.run_cli(["course", "--offset", "20", "--limit", "2", "--body-limit", "5"], client=client)
        data = json.loads(out)
        self.assertEqual((code, err, data["total"], data["next_offset"]), (0, "", 45, 22))
        row = data["posts"][0]
        self.assertEqual((row["id"], row["post_number"], row["author"]), (15021, 21, "synthetic_author"))
        self.assertEqual(row["created_at"], "2026-09-16T01:02:03.000Z")
        self.assertEqual(row["url"], ORIGIN + "/t/topic/15/21")
        self.assertEqual(len(row["body"]), 5)
        self.assertTrue(row["body_truncated"])
        self.assertTrue(data["complete_stream"])
        self.assertEqual(len(handler.requests), 4)

    def test_offset_past_end(self):
        client, _ = transport(full_responder(3))
        code, out, _ = self.run_cli(["course", "--offset", "100"], client=client)
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(out)["posts"], [])
        self.assertIsNone(json.loads(out)["next_offset"])

    def test_missing_batch_is_error_not_partial_success(self):
        first = topic_payload(3)
        client, _ = transport(lambda req: Response(req.full_url, first if not "?" in req.full_url
                                                   else {"post_stream": {"posts": [post(2)]}}))
        code, out, err = self.run_cli(["course"], client=client)
        self.assertEqual((code, out), (1, ""))
        self.assertIn("不完整", err)
        self.assertEqual(client._topics, {})

    def test_duplicate_or_foreign_batch_rejected(self):
        for posts in ([post(2), post(2)], [post(2, 16)], [post(99)]):
            with self.subTest(posts=posts):
                client, _ = transport(lambda req: Response(req.full_url, topic_payload(3) if "?" not in req.full_url
                                                            else {"post_stream": {"posts": posts}}))
                with self.assertRaises(ForumError):
                    client.topic(15)

    def test_bad_stream_cannot_claim_completeness(self):
        for ids in (None, [], [15001, 15001], [True], list(range(1, MAX_POSTS + 2))):
            payload = topic_payload()
            payload["post_stream"]["stream"] = ids
            client, _ = transport(lambda req: Response(req.full_url, payload))
            with self.subTest(kind=type(ids)), self.assertRaises(ForumError):
                client.topic(15)

    def test_wrong_topic_or_missing_metadata_rejected(self):
        for field, value in (("username", None), ("created_at", "yesterday"), ("created_at", "2026-09-16"),
                             ("topic_id", 16), ("id", True), ("post_number", 0), ("cooked", None)):
            payload = topic_payload()
            payload["post_stream"]["posts"][0][field] = value
            client, _ = transport(lambda req: Response(req.full_url, payload))
            with self.subTest(field=field, value=value), self.assertRaises(ForumError):
                client.topic(15)
        payload = topic_payload(target=16)
        client, _ = transport(lambda req: Response(req.full_url, payload))
        with self.assertRaises(ForumError):
            client.topic(15)

    def test_duplicate_post_numbers_rejected(self):
        payload = topic_payload(2, first=2)
        payload["post_stream"]["posts"][1]["post_number"] = 1
        client, _ = transport(lambda req: Response(req.full_url, payload))
        with self.assertRaises(ForumError):
            client.topic(15)

    def test_untrusted_html_is_text_never_executed(self):
        sentinel = self.directory / "must-not-exist"
        text = "<p>$(touch %s) &amp; 数据\x1b[31m</p><script>secretScript()</script>" % sentinel
        payload = topic_payload()
        payload["post_stream"]["posts"][0]["cooked"] = text
        client, _ = transport(lambda req: Response(req.full_url, payload))
        code, out, _ = self.run_cli(["course"], client=client)
        self.assertEqual(code, 0)
        self.assertFalse(sentinel.exists())
        self.assertNotIn("\x1b", out)
        self.assertIn("$(touch", json.loads(out)["posts"][0]["body"])
        self.assertIn("& 数据", json.loads(out)["posts"][0]["body"])
        self.assertNotIn("secretScript", out)


class SearchTests(CLITestCase):
    def test_search_includes_posts_beyond_initial_page(self):
        responder = full_responder(45)
        def response(req):
            result = responder(req)
            payload = json.loads(result.getvalue())
            for row in payload["post_stream"]["posts"]:
                if row["post_number"] == 45:
                    row["cooked"] = "<p>课程 FINAL needle</p>"
            return Response(req.full_url, payload)
        client, handler = transport(response)
        code, out, _ = self.run_cli(["search", "课程 final NEEDLE", "--limit", "1"], client=client)
        data = json.loads(out)
        self.assertEqual((code, data["total"], data["next_offset"]), (0, 2, 1))
        self.assertEqual(data["topic_ids"], [15, 16])
        self.assertEqual(data["posts"][0]["post_number"], 45)
        self.assertEqual(len(handler.requests), 8)

    def test_search_scope_and_deduplication(self):
        client, handler = transport(full_responder(2))
        code, out, _ = self.run_cli(["search", "synthetic_author", "--topic", "competition",
                                     "--topic", "16"], client=client)
        self.assertEqual((code, json.loads(out)["total"]), (0, 2))
        self.assertTrue(all("/t/16" in r.full_url for r in handler.requests))
        self.assertEqual(len(handler.requests), 2)

    def test_empty_search_or_bad_bounds_exit_before_network(self):
        for args in (["search", " "], ["search", "a" * 1001], ["course", "--limit", "0"],
                     ["course", "--limit", "101"], ["course", "--offset", "-1"],
                     ["course", "--body-limit", "10001"]):
            with self.subTest(args=args):
                code, out, _ = self.run_cli(args)
                self.assertEqual((code, out), (2, ""))

    def test_search_without_matches(self):
        client, _ = transport(full_responder(1))
        code, out, _ = self.run_cli(["search", "absent-query"], client=client)
        self.assertEqual((code, json.loads(out)["total"]), (0, 0))


class AuthTests(CLITestCase):
    def test_import_is_stdin_only_private_atomic_and_offline(self):
        code, out, err = self.run_cli(["auth", "import"], json.dumps(SESSION))
        self.assertEqual((code, err), (0, ""))
        self.assertFalse(json.loads(out)["network_validated"])
        self.assertNotIn("SYNTHETIC_SECRET", out + err)
        self.assertEqual(stat.S_IMODE(self.auth.stat().st_mode), 0o600)
        self.assertEqual(load_auth(self.auth), SESSION)
        replacement = dict(SESSION, cookie="_t=REPLACEMENT")
        self.run_cli(["auth", "import"], json.dumps(replacement))
        self.assertEqual(load_auth(self.auth), replacement)
        self.assertEqual(list(self.directory.iterdir()), [self.auth])

    def test_exact_origin_and_schema(self):
        for origin in ("http://bbs.qiwoo.edu.cn", ORIGIN + "/", ORIGIN + ":443",
                       "https://sub.bbs.qiwoo.edu.cn", ORIGIN + ".evil", "https://user@bbs.qiwoo.edu.cn"):
            with self.subTest(origin=origin), self.assertRaises(ForumError):
                validate_session(dict(SESSION, origin=origin))
        with self.assertRaises(ForumError):
            validate_session(dict(SESSION, headers={"X-Test": "anything"}))

    def test_cookie_injection_and_duplicate_names_rejected(self):
        for cookie in ("_t=a\r\nX-Other: secret", "_t=a\n", "_t=a; _t=b", "_t=has space", "_t=中文", "_t="):
            code, out, err = self.run_cli(["auth", "import"], json.dumps(dict(SESSION, cookie=cookie)))
            self.assertEqual((code, out), (2, ""))
            self.assertNotIn(cookie, err)
            self.assertFalse(self.auth.exists())

    def test_invalid_stdin_is_not_echoed(self):
        for raw in ("SYNTHETIC_SECRET", '{"origin": "SYNTHETIC_SECRET", "cookie":"x"}',
                    '{"origin":"a","origin":"b","cookie":"SYNTHETIC_SECRET"}', "a" * (AUTH_LIMIT + 1)):
            code, out, err = self.run_cli(["auth", "import"], raw)
            self.assertEqual((code, out), (2, ""))
            self.assertNotIn("SYNTHETIC_SECRET", err)

    def test_tty_auth_refused_without_reading(self):
        stream = io.StringIO(json.dumps(SESSION))
        with patch.object(stream, "isatty", return_value=True), patch.object(stream, "read") as read:
            with patch.object(sys, "stdin", stream), redirect_stderr(io.StringIO()):
                self.assertEqual(cli.main(["auth", "import"]), 2)
            read.assert_not_called()

    def test_mode_must_be_0600_not_readable_by_others(self):
        save_private(self.auth, SESSION)
        for mode in (0o644, 0o640, 0o400, 0o666):
            self.auth.chmod(mode)
            with self.subTest(mode=mode), self.assertRaises(ForumError):
                load_auth(self.auth)
        self.auth.chmod(0o600)
        self.assertEqual(load_auth(self.auth), SESSION)

    def test_private_parent_mode_required(self):
        parent = self.directory / "public"
        parent.mkdir(mode=0o755)
        with self.assertRaises(ForumError):
            save_private(parent / "auth.json", SESSION)
        self.assertEqual(list(parent.iterdir()), [])

    def test_symlinks_hardlinks_and_fifo_are_refused(self):
        other = self.directory / "other.json"
        save_private(other, SESSION)
        self.auth.symlink_to(other)
        code, out, _ = self.run_cli(["--auth-file", str(self.auth), "course"])
        self.assertNotEqual(code, 0)
        self.assertEqual(out, "")
        with self.assertRaises(ForumError):
            save_private(self.auth, SESSION, replace=True)
        self.auth.unlink()
        os.link(other, self.auth)
        with self.assertRaises(ForumError):
            load_auth(self.auth)
        self.auth.unlink()
        os.mkfifo(self.auth, 0o600)
        with self.assertRaises(ForumError):
            load_auth(self.auth)

    def test_missing_explicit_auth_fails_default_is_anonymous(self):
        self.assertIsNone(load_auth(self.auth))
        code, out, _ = self.run_cli(["--auth-file", str(self.auth), "course"])
        self.assertEqual((code, out), (2, ""))
        client, handler = transport(full_responder(1))
        self.run_cli(["course"], client=client)
        self.assertIsNone(handler.requests[0].get_header("Cookie"))

    def test_anonymous_does_not_read_bad_auth_file(self):
        self.auth.write_text("broken")
        client, _ = transport(full_responder(1))
        code, _, _ = self.run_cli(["--anonymous", "course"], client=client)
        self.assertEqual(code, 0)
        code, _, _ = self.run_cli(["course"])
        self.assertEqual(code, 2)

    def test_cookie_only_in_header_and_echo_redacted_from_output(self):
        save_private(self.auth, SESSION)
        payload = topic_payload()
        payload["post_stream"]["posts"][0]["cooked"] = "<p>SYNTHETIC_SECRET SYNTHETIC_SESSION</p>"
        client, handler = transport(lambda req: Response(req.full_url, payload), session=SESSION)
        code, out, err = self.run_cli(["course"], client=client)
        self.assertEqual(code, 0)
        self.assertNotIn("SYNTHETIC_SECRET", out + err)
        request = handler.requests[0]
        self.assertEqual(request.get_header("Cookie"), SESSION["cookie"])
        self.assertNotIn("SYNTHETIC_SECRET", request.full_url)
        self.assertIsNone(request.data)

    def test_redaction_preserves_valid_json_for_short_cookie_values(self):
        session = dict(SESSION, cookie="_t=null")
        save_private(self.auth, session)
        client, _ = transport(full_responder(1), session=session)
        code, out, _ = self.run_cli(["course"], client=client)
        self.assertEqual(code, 0)
        self.assertIsNone(json.loads(out)["next_offset"])


class HTTPTests(CLITestCase):
    def redirect_client(self, destination, session=SESSION):
        def respond(req):
            if req.full_url == ORIGIN + "/t/15.json":
                return Response(req.full_url, b"", 302, {"Location": destination})
            return Response(req.full_url, topic_payload())
        return transport(respond, session)

    def test_same_origin_same_topic_redirect_preserves_cookie(self):
        client, handler = self.redirect_client("/t/course-name/15.json")
        self.assertEqual(client.topic(15)["topic_id"], 15)
        self.assertEqual(len(handler.requests), 2)
        self.assertEqual(handler.requests[1].get_header("Cookie"), SESSION["cookie"])

    def test_cross_origin_downgrade_userinfo_port_redirects_blocked_before_send(self):
        for destination in ("https://evil.invalid/t/15.json", "http://bbs.qiwoo.edu.cn/t/15.json",
                            "//evil.invalid/t/15.json", "https://bbs.qiwoo.edu.cn:444/t/15.json",
                            "https://user@bbs.qiwoo.edu.cn/t/15.json",
                            "https://bbs.qiwoo.edu.cn.evil.invalid/t/15.json"):
            with self.subTest(destination=destination):
                client, handler = self.redirect_client(destination)
                with self.assertRaises(ForumError):
                    client.topic(15)
                self.assertEqual(len(handler.requests), 1)

    def test_same_origin_login_logout_target_and_query_changes_blocked(self):
        for destination in ("/login", "/session/logout", "/t/16.json",
                            "/t/15.json?cookie=SYNTHETIC_SECRET", "/t/15.json#fragment"):
            client, handler = self.redirect_client(destination)
            code, out, err = self.run_cli(["course"], client=client)
            self.assertNotEqual(code, 0)
            self.assertEqual(out, "")
            self.assertEqual(len(handler.requests), 1)
            self.assertNotIn("SYNTHETIC_SECRET", err)

    def test_redirect_loop_is_bounded_and_error_sanitized(self):
        client, handler = transport(lambda req: Response(req.full_url, b"", 302, {"Location": req.full_url}), SESSION)
        code, out, err = self.run_cli(["course"], client=client)
        self.assertEqual((code, out), (1, ""))
        self.assertLessEqual(len(handler.requests), 4)
        self.assertNotIn("Cookie", err)

    def test_routes_never_accept_arbitrary_endpoints(self):
        for url in (ORIGIN + "/posts.json", ORIGIN + "/t/15.json?x=y",
                    ORIGIN + "/t/15/posts.json", ORIGIN + "/t/15/posts.json?post_ids[]=0",
                    ORIGIN + "/t/15/posts.json?post_ids[]=1&other=2",
                    ORIGIN + "/t/15.json\n", "https://[bad/t/15.json"):
            with self.subTest(url=url), self.assertRaises(ForumError):
                read_route(url)

    def test_http_errors_redact_server_body_and_url(self):
        for status in (401, 403, 404, 429, 500):
            client, _ = transport(lambda req: Response(req.full_url, b"SYNTHETIC_SECRET", status))
            code, out, err = self.run_cli(["course"], client=client)
            self.assertEqual((code, out), (3 if status in (401, 403) else 1, ""))
            self.assertNotIn("SYNTHETIC_SECRET", err)
            self.assertNotIn("https://", err)

    def test_network_error_sanitized(self):
        def fail(req):
            raise urllib.error.URLError("SYNTHETIC_SECRET at https://secret.invalid")
        client, _ = transport(fail)
        code, out, err = self.run_cli(["course"], client=client)
        self.assertEqual((code, out), (1, ""))
        self.assertNotIn("SYNTHETIC_SECRET", err)

    def test_non_json_invalid_json_error_envelope_and_oversized_response(self):
        cases = [(b"<html>login</html>", {"Content-Type": "text/html"}, 3),
                 (b"invalid SYNTHETIC_SECRET", {}, 1), ({"errors": ["SYNTHETIC_SECRET"]}, {}, 1),
                 (b"x" * (MAX_RESPONSE + 1), {}, 1), ([], {}, 1)]
        for payload, headers, expected in cases:
            client, _ = transport(lambda req: Response(req.full_url, payload, headers=headers))
            code, out, err = self.run_cli(["course"], client=client)
            self.assertEqual((code, out), (expected, ""))
            self.assertNotIn("SYNTHETIC_SECRET", err)


class DraftAndCommandTests(CLITestCase):
    def test_draft_preserves_target_reply_number_and_body_without_network(self):
        output = self.directory / "draft.json"
        body = "# Notes\n$(touch SHOULD_NOT_EXIST)\n课程原文\n"
        code, out, err = self.run_cli(["draft", "competition", "--reply-to", "7", "--output", str(output)], body)
        self.assertEqual((code, err), (0, ""))
        self.assertFalse(json.loads(out)["sent"])
        draft = json.loads(output.read_text())
        self.assertEqual((draft["topic_id"], draft["reply_to_post_number"], draft["raw"]), (16, 7, body))
        self.assertEqual(draft["topic_url"], ORIGIN + "/t/topic/16")
        self.assertFalse(draft["target_validated"])
        self.assertEqual(stat.S_IMODE(output.stat().st_mode), 0o600)
        self.assertNotIn(body, out)

    def test_draft_optional_reply_is_null_and_existing_file_not_overwritten(self):
        output = self.directory / "draft.json"
        args = ["draft", "course", "--output", str(output)]
        self.assertEqual(self.run_cli(args, "first")[0], 0)
        self.assertIsNone(json.loads(output.read_text())["reply_to_post_number"])
        self.assertEqual(self.run_cli(args, "second")[0], 1)
        self.assertEqual(json.loads(output.read_text())["raw"], "first")

    def test_empty_or_oversized_draft_and_invalid_reply_fail(self):
        output = self.directory / "draft.json"
        for body in (" \n", "x" * (BODY_LIMIT + 1)):
            self.assertEqual(self.run_cli(["draft", "course", "--output", str(output)], body)[0], 2)
        self.assertEqual(self.run_cli(["draft", "course", "--reply-to", "0"], "body")[0], 2)
        self.assertFalse(output.exists())

    def test_no_default_posting_and_publish_is_explicitly_unimplemented(self):
        for args, expected in (([], 2), (["publish"], 4), (["post", "anything"], 2)):
            code, out, err = self.run_cli(args)
            self.assertEqual((code, out), (expected, ""))
        self.assertIn("未发送任何请求", self.run_cli(["publish"])[2])

    def test_argv_errors_never_echo_credentials(self):
        code, out, err = self.run_cli(["auth", "import", "--cookie", "SYNTHETIC_SECRET"])
        self.assertEqual((code, out), (2, ""))
        self.assertNotIn("SYNTHETIC_SECRET", err)

    def test_entry_script_works_outside_repo_and_has_real_error_exit(self):
        result = subprocess.run([sys.executable, str(ROOT / "qiwoo"), "publish"], cwd=self.directory,
                                capture_output=True, text=True, env=dict(os.environ, PYTHONDONTWRITEBYTECODE="1"))
        self.assertEqual((result.returncode, result.stdout), (4, ""))
        self.assertIn("未实现", result.stderr)


if __name__ == "__main__":
    unittest.main()
