"""Synthetic Chrome/HTTP/JavaScript fixtures; no browser, credentials or real network."""
import copy
import io
import json
import shutil
import subprocess
import unittest
import urllib.request
from contextlib import redirect_stderr, redirect_stdout
from types import SimpleNamespace
from unittest.mock import Mock, patch

import test_forum as fixtures
from tools.qiwoo_cli import chrome, cli
from tools.qiwoo_cli.client import ForumError, ORIGIN, MAX_RESPONSE

KEY = "__qiwoo_" + "a" * 32
IDENTITY = {"current_user": {"id": 42, "username": "synthetic_user"}}


def wire(data, status=200):
    return {"state": "done", "status": status, "data": copy.deepcopy(data)}


def fake_client(count=45, identity=None):
    responder = fixtures.full_responder(count)
    def respond(path):
        if path == "/session/current.json":
            return wire(IDENTITY if identity is None else identity)
        response = responder(urllib.request.Request(ORIGIN + path))
        return wire(json.loads(response.getvalue()))
    bridge = Mock()
    bridge.get_json.side_effect = respond
    return chrome.ChromeClient(bridge), bridge


def invoke(args, client=None):
    out, err = io.StringIO(), io.StringIO()
    with redirect_stdout(out), redirect_stderr(err), patch.object(cli, "ChromeClient", return_value=client) as constructor:
        code = cli.main(args)
    return code, out.getvalue(), err.getvalue(), constructor


class BridgeTests(unittest.TestCase):
    def test_routes_reject_before_browser_access(self):
        bridge = chrome.ChromeBridge()
        for path in ("/posts.json", "/session/logout", "/session/current.json?x=1",
                     "/t/15.json?x=1", "//evil.invalid/t/15.json", "https://evil.invalid",
                     "/t/15/posts.json?post_ids[]=0", "/t/15.json\n", None):
            with self.subTest(path=path), patch.object(bridge, "execute") as execute:
                with self.assertRaises(ForumError):
                    bridge.get_json(path)
                execute.assert_not_called()

    def test_start_script_only_allows_fixed_routes_and_key(self):
        for path in ("/session/current.json", "/t/15.json", "/t/16/posts.json?post_ids%5B%5D=12"):
            self.assertIn('"path":', chrome.start_script(path, KEY))
        with self.assertRaises(ForumError):
            chrome.start_script("/t/15.json", 'x");evil();')
        script = chrome.start_script("/t/15.json", KEY)
        for forbidden in ("document.cookie", "localStorage", "sessionStorage", "eval(", "POST", "DELETE"):
            self.assertNotIn(forbidden, script)

    def test_platform_guard_precedes_subprocess(self):
        with patch.object(chrome.sys, "platform", "linux"), patch.object(chrome.subprocess, "run") as run:
            with self.assertRaises(ForumError):
                chrome.ChromeBridge()._run("anything")
            run.assert_not_called()

    def test_run_uses_stdin_no_shell_and_timeout(self):
        result = SimpleNamespace(returncode=0, stdout="OK 11 22\n", stderr="")
        with patch.object(chrome.sys, "platform", "darwin"), patch.object(chrome.subprocess, "run", return_value=result) as run:
            self.assertEqual(chrome.ChromeBridge()._run("trusted script"), "OK 11 22")
            args, kwargs = run.call_args
            self.assertEqual(args, (["/usr/bin/osascript", "-"],))
            self.assertEqual(kwargs["input"], "trusted script")
            self.assertEqual(kwargs["timeout"], 8)
            self.assertNotIn("shell", kwargs)

    def test_run_errors_do_not_echo_raw_details(self):
        failures = [subprocess.TimeoutExpired("x", 8, output="SYNTHETIC_SECRET"), OSError("SYNTHETIC_SECRET")]
        for error in failures:
            with patch.object(chrome.sys, "platform", "darwin"), patch.object(chrome.subprocess, "run", side_effect=error):
                with self.assertRaises(ForumError) as caught:
                    chrome.ChromeBridge()._run("script")
                self.assertNotIn("SYNTHETIC_SECRET", str(caught.exception))

    def test_permissions_have_distinct_fixed_messages(self):
        for stderr, expected in [("JavaScript is turned off SYNTHETIC_SECRET", "页面脚本权限"),
                                 ("not authorized to send apple events -1743 SYNTHETIC_SECRET", "自动化权限"),
                                 ("syntax error SYNTHETIC_SECRET", "AppleScript 执行失败")]:
            result = SimpleNamespace(returncode=1, stdout="", stderr=stderr)
            with patch.object(chrome.sys, "platform", "darwin"), patch.object(chrome.subprocess, "run", return_value=result):
                with self.assertRaises(ForumError) as caught:
                    chrome.ChromeBridge()._run("script")
                self.assertIn(expected, str(caught.exception))
                self.assertNotIn("SYNTHETIC_SECRET", str(caught.exception))

    def test_discovery_errors_and_ambiguous_tabs_fail_closed(self):
        for output in ("NO_CHROME", "NO_TAB", "MULTIPLE_TABS", "OK 1 x", "OK -1 2", "SYNTHETIC_SECRET"):
            bridge = chrome.ChromeBridge()
            with patch.object(bridge, "_run", return_value=output):
                with self.assertRaises(ForumError) as caught:
                    bridge._discover()
                self.assertIsNone(bridge.tab)
                self.assertNotIn("SYNTHETIC_SECRET", str(caught.exception))

    def test_tab_ids_are_compared_as_text_and_remain_pinned(self):
        bridge = chrome.ChromeBridge()
        with patch.object(bridge, "_run", side_effect=["OK 11 22", "{}", "{}"]) as run:
            bridge.execute("JSON.stringify({})")
            bridge.execute("JSON.stringify({})")
        self.assertEqual(bridge.tab, (11, 22))
        scripts = [c.args[0] for c in run.call_args_list]
        self.assertEqual(scripts[0], chrome._DISCOVER)
        self.assertIn('(id of w as text) is "11"', scripts[1])
        self.assertIn('(id of t as text) is "22"', scripts[1])
        self.assertNotIn("set URL", scripts[1])
        self.assertNotIn("activate", scripts[1])

    def test_closed_or_navigated_tab_is_not_reselected(self):
        for value in ("NO_CHROME", "TAB_GONE", "ORIGIN_CHANGED"):
            bridge = chrome.ChromeBridge()
            bridge.tab = (11, 22)
            with patch.object(bridge, "_run", return_value=value) as run:
                with self.assertRaises(ForumError):
                    bridge.execute("JSON.stringify({})")
                self.assertEqual(run.call_count, 1)
                self.assertEqual(bridge.tab, (11, 22))

    def test_decode_rejects_malformed_and_redacts_error_payload(self):
        for raw in ('[]', 'bad SYNTHETIC_SECRET', '{"error": "SYNTHETIC_SECRET"}', '{"error": []}',
                    'x' * (MAX_RESPONSE * 6 + 4097)):
            with self.subTest(size=len(raw)), self.assertRaises(ForumError) as caught:
                chrome._decode(raw)
            self.assertNotIn("SYNTHETIC_SECRET", str(caught.exception))

    def test_polling_and_cleanup_on_success(self):
        bridge = chrome.ChromeBridge()
        bridge.tab = (11, 22)
        final = wire({"ok": True})
        with patch.object(bridge, "execute", side_effect=[json.dumps({"state":"started"}), json.dumps({"state":"pending"}), json.dumps(final), ""]) as execute, patch.object(chrome.time, "sleep"):
            self.assertEqual(bridge.get_json("/t/15.json"), final)
        self.assertEqual(execute.call_count, 4)
        self.assertIn("delete window[cfg.key]", execute.call_args.args[0])
        self.assertIn("controller.abort", execute.call_args.args[0])

    def test_cleanup_on_failed_poll_and_interrupt(self):
        for failure in ('{"error":"state_lost"}', '{"state":"done","status":true}', '{"state":"bogus"}', KeyboardInterrupt()):
            bridge = chrome.ChromeBridge()
            bridge.tab = (11, 22)
            with patch.object(bridge, "execute", side_effect=['{"state":"started"}', failure, ""]) as execute:
                with self.assertRaises((ForumError, KeyboardInterrupt)):
                    bridge.get_json("/t/15.json")
            self.assertEqual(execute.call_count, 3)
            self.assertIn("controller.abort", execute.call_args.args[0])

    def test_poll_deadline_does_not_restart_fetch(self):
        bridge = chrome.ChromeBridge()
        bridge.tab = (11, 22)
        with patch.object(bridge, "execute", side_effect=['{"state":"started"}', ""]) as execute, patch.object(chrome.time, "monotonic", side_effect=[0, 21]):
            with self.assertRaises(ForumError):
                bridge.get_json("/t/15.json")
        self.assertEqual(execute.call_count, 2)

    def test_failed_discovery_not_retried_by_cleanup(self):
        bridge = chrome.ChromeBridge()
        with patch.object(bridge, "_run", return_value="NO_TAB") as run:
            with self.assertRaises(ForumError):
                bridge.get_json("/t/15.json")
        self.assertEqual(run.call_count, 1)


class ChromeClientTests(unittest.TestCase):
    def test_auth_response_projects_identity_only_and_caches_per_command(self):
        payload = {"current_user": dict(IDENTITY["current_user"], email="SYNTHETIC_SECRET", token="SYNTHETIC_SECRET")}
        client, bridge = fake_client(identity=payload)
        result = client.auth_status()
        self.assertTrue(result["authenticated"])
        self.assertEqual(result["username"], "synthetic_user")
        self.assertNotIn("SYNTHETIC_SECRET", json.dumps(result))
        result["username"] = "modified copy"
        self.assertEqual(client.auth_status()["username"], "synthetic_user")
        self.assertEqual(bridge.get_json.call_count, 1)

    def test_expired_or_missing_session_returns_nonzero_status(self):
        for status, payload in [(401, None), (403, None), (404, None), (200, {"current_user": None})]:
            bridge = Mock()
            bridge.get_json.return_value = wire(payload, status)
            client = chrome.ChromeClient(bridge)
            code, out, err, _ = invoke(["--chrome", "auth", "status"], client)
            self.assertEqual((code, err), (3, ""))
            self.assertFalse(json.loads(out)["authenticated"])

    def test_bad_auth_never_reported_as_authenticated(self):
        for data in ({}, [], {"current_user": {}}, {"current_user": {"id": True, "username":"x"}},
                     {"current_user": {"id":1,"username":"bad\nname"}}, {"current_user": {"id":1,"username":""}}):
            bridge = Mock()
            bridge.get_json.return_value = wire(data)
            with self.subTest(data=data), self.assertRaises(ForumError):
                chrome.ChromeClient(bridge).auth_status()

    def test_server_error_is_unknown_not_logged_out(self):
        bridge = Mock()
        bridge.get_json.return_value = wire(None, 500)
        with self.assertRaises(ForumError) as caught:
            chrome.ChromeClient(bridge).auth_status()
        self.assertIn("未知", str(caught.exception))

    def test_topic_needs_real_identity_before_public_read(self):
        client, bridge = fake_client(identity={"current_user": None})
        with self.assertRaises(ForumError):
            client.topic(15)
        self.assertEqual([c.args[0] for c in bridge.get_json.call_args_list], ["/session/current.json"])

    def test_pagination_search_and_auth_share_one_pinned_bridge(self):
        client, bridge = fake_client()
        results = client.search("synthetic post 45", [15,16])
        self.assertEqual([(p["topic_id"],p["post_number"]) for p in results], [(15,45),(16,45)])
        paths = [c.args[0] for c in bridge.get_json.call_args_list]
        self.assertEqual(paths.count("/session/current.json"), 1)
        self.assertEqual(len(paths), 9)

    def test_request_errors_are_sanitized_and_never_fall_back(self):
        for status in (401,403,404,429,500):
            client, bridge = fake_client(1)
            bridge.get_json.side_effect = [wire(IDENTITY), wire({"errors":["SYNTHETIC_SECRET"]},status)]
            with self.assertRaises(ForumError) as caught:
                client.topic(15)
            self.assertNotIn("SYNTHETIC_SECRET", str(caught.exception))
            self.assertEqual(bridge.get_json.call_count, 2)

    def test_invalid_route_rejected_before_identity_lookup(self):
        client, bridge = fake_client(1)
        with self.assertRaises(ForumError):
            client.get_json("/session/logout")
        bridge.get_json.assert_not_called()

    def test_chrome_cli_bypasses_auth_files_and_http_client(self):
        client, _ = fake_client(1)
        with patch.object(cli, "load_auth", side_effect=AssertionError("Must not load cookies")), patch.object(cli, "Client", side_effect=AssertionError("No fallback")):
            code, out, err, _ = invoke(["--chrome", "competition"], client)
        result = json.loads(out)
        self.assertEqual((code,err,result["topic_id"]), (0,"",16))
        self.assertEqual(result["contract"], "discourse_read_contract_v1")
        self.assertTrue(result["complete_stream"])
        self.assertTrue(result["authenticated"])

    def test_conflicting_flags_and_nonreading_commands_never_open_browser(self):
        for args, expected in [(["--chrome","--anonymous","course"],2),
                               (["--chrome","--auth-file","anything","course"],2),
                               (["--chrome","auth","import"],2),
                               (["auth","status"],2),
                               (["--chrome","draft","course"],2),
                               (["--chrome","publish"],4)]:
            with self.subTest(args=args):
                code, out, _, constructor = invoke(args)
                self.assertEqual((code,out), (expected,""))
                constructor.assert_not_called()


# Execute the actual shipped JavaScript against an in-memory fetch stub in Node.
# No browser and no sockets: this checks code behavior, not mere string matching.
_NODE = r'''
const fs = require("fs"), vm = require("vm");
const cfg = JSON.parse(fs.readFileSync(0,"utf8"));
const timers = new Map(), requests = [], signals = [];
let sequence=0, cancelled=false, bodyRead=false;
const context = {
  window:{}, location:{origin:cfg.origin || "https://bbs.qiwoo.edu.cn"}, AbortController, TextDecoder,
  setTimeout:(fn,ms)=>{const id=++sequence;timers.set(id,{fn,ms});return id;},
  clearTimeout:id=>timers.delete(id),
  fetch:async (url,options)=>{
    signals.push(options.signal);
    requests.push({url,method:options.method,credentials:options.credentials,mode:options.mode,
                   redirect:options.redirect,cache:options.cache,headers:options.headers});
    if(cfg.fail) throw Error("SYNTHETIC_SECRET");
    const bytes = cfg.oversize ? new Uint8Array(4194305) : new TextEncoder().encode(JSON.stringify(cfg.payload));
    let done=false;
    return {url:cfg.responseURL || url,status:cfg.status || 200,redirected:!!cfg.redirected,
      headers:{get:()=>cfg.contentType || "application/json; charset=utf-8"},
      body:{getReader:()=>{bodyRead=true;return {
        read:async()=>{if(done)return {done:true};done=true;return {done:false,value:bytes};},
        cancel:async()=>{cancelled=true;}
      };}}
    };
  }
};
vm.createContext(context);
const initial = JSON.parse(vm.runInContext(cfg.script,context));
setImmediate(()=>{
  const state=context.window[cfg.key];
  console.log(JSON.stringify({initial,result:state && state.result,requests,cancelled,bodyRead,
                             pwned:context.window.pwned || false,timerCount:timers.size,aborted:signals.every(s=>s.aborted)}));
});
'''


@unittest.skipUnless(shutil.which("node"), "Node required for synthetic shipped-JavaScript tests")
class JavaScriptTests(unittest.TestCase):
    def probe(self, path="/t/15.json", **kwargs):
        payload = kwargs.pop("payload", fixtures.topic_payload(1))
        config = dict(script=chrome.start_script(path,KEY),key=KEY,payload=payload,**kwargs)
        result = subprocess.run([shutil.which("node"),"-e",_NODE], input=json.dumps(config),
                                capture_output=True,text=True,timeout=10)
        self.assertEqual(result.returncode,0,result.stderr)
        return json.loads(result.stdout)

    def test_actual_js_uses_same_origin_get_with_no_redirects(self):
        result = self.probe()
        self.assertEqual(result["initial"], {"state":"started"})
        self.assertEqual(result["result"]["status"],200)
        req = result["requests"][0]
        self.assertEqual((req["method"],req["credentials"],req["mode"],req["redirect"],req["cache"]),
                         ("GET","same-origin","same-origin","error","no-store"))
        self.assertNotIn("Cookie",req["headers"])
        self.assertEqual(result["timerCount"],1)  # only bounded abandoned-state expiry remains

    def test_origin_drift_stops_before_fetch(self):
        result = self.probe(origin="https://evil.invalid")
        self.assertEqual(result["initial"], {"error":"origin_changed"})
        self.assertEqual(result["requests"],[])

    def test_redirect_and_wrong_response_url_are_rejected(self):
        for args in ({"redirected":True},{"responseURL":"https://evil.invalid/t/15.json"}):
            self.assertEqual(self.probe(**args)["result"], {"error":"redirect"})

    def test_response_size_is_bounded_before_parsing(self):
        result = self.probe(oversize=True)
        self.assertEqual(result["result"], {"error":"too_large"})
        self.assertTrue(result["cancelled"])

    def test_non_json_and_http_errors_do_not_read_body(self):
        result = self.probe(contentType="text/html")
        self.assertEqual(result["result"], {"error":"not_json"})
        self.assertFalse(result["bodyRead"])
        result = self.probe(status=403)
        self.assertTrue(result["aborted"])
        self.assertEqual(result["result"], wire(None,403))
        self.assertFalse(result["bodyRead"])

    def test_network_error_details_do_not_escape(self):
        result = self.probe(fail=True)
        self.assertEqual(result["result"], {"error":"request_failed"})
        self.assertNotIn("SYNTHETIC_SECRET",json.dumps(result))

    def test_missing_user_field_is_protocol_error_not_logged_out(self):
        result = self.probe(path="/session/current.json", payload={})
        self.assertEqual(result["result"], {"error":"invalid_json"})

    def test_untrusted_post_text_is_never_executed(self):
        payload = fixtures.topic_payload(1)
        payload["secret_extra"] = "SYNTHETIC_SECRET"
        body = '<script>window.pwned=true;</script> $(touch NEVER)'
        payload["post_stream"]["posts"][0]["cooked"] = body
        result = self.probe(payload=payload)
        self.assertFalse(result["pwned"])
        self.assertEqual(result["result"]["data"]["post_stream"]["posts"][0]["cooked"],body)
        self.assertNotIn("SYNTHETIC_SECRET",json.dumps(result))

    def test_browser_filters_session_fields_before_handoff(self):
        payload={"current_user":dict(IDENTITY["current_user"], email="SYNTHETIC_SECRET",token="SYNTHETIC_SECRET")}
        config=dict(script=chrome.start_script("/session/current.json",KEY),key=KEY,payload=payload)
        result=subprocess.run([shutil.which("node"),"-e",_NODE],input=json.dumps(config),capture_output=True,text=True,timeout=10)
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertEqual(json.loads(result.stdout)["result"]["data"],IDENTITY)
        self.assertNotIn("SYNTHETIC_SECRET",result.stdout)


if __name__ == "__main__":
    unittest.main()
