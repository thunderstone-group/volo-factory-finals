"""Deterministic checks using labeled synthetic fixtures and redacted real gateway responses.

They validate orchestration, not coding quality; official runs must validate the model.
"""
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch

from volo.agent import Agent, TOOLS
from volo.environment import discover_playwright
from volo.model import Model, ModelError
from volo.requirements import RequirementSet
from volo.trace import Runtime, Trace
from volo.workspace import Workspace, tool_environment
from volo.web_runtime import scaffold, implement


ROOT = Path(__file__).resolve().parents[1]


class TempCase(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="volo-test-")
        self.base = Path(self.temp.name)
        self.req = self.base / "input"
        self.req.mkdir()
        (self.req / "requirements.yaml").write_text(
            "id: ROOT\nname: Greeting\ntype: FOLDER\nchildren:\n"
            "  - id: REQ-1\n    name: Serve a greeting\n    type: ATOMIC\n"
            "    description: Serve a visible greeting over HTTP.\n")
        self.out = self.base / "application"
        self.trace = Trace(self.out / ".factory")
        self.workspace = Workspace(self.out, self.req, self.trace, time.monotonic() + 60)

    def tearDown(self):
        self.temp.cleanup()


class RequirementsTests(TempCase):
    def test_ancestor_reference_keeps_context_without_creating_a_self_cycle(self):
        # Synthetic minimal reproduction of two provided corpus tree patterns.
        (self.req / 'requirements.yaml').write_text('''id: ROOT
children:
  - id: MODULE
    dependencies: [FOUNDATION]
    children:
      - id: DETAIL
        dependencies: [MODULE]
        children:
          - id: OPEN
            dependencies: [LIST]
      - id: LIST
  - id: FOUNDATION
''')
        requirements = RequirementSet.load(self.req)
        self.assertEqual([n['id'] for n in requirements.nodes], ['FOUNDATION', 'LIST', 'OPEN'])
        payload = json.loads(requirements.batch_prompt([requirements.nodes[-1]]))
        detail = next(n for n in payload['inherited_constraints'] if n['id'] == 'DETAIL')
        self.assertEqual(detail['dependencies'], ['MODULE'])

    def test_parent_folder_constraints_reach_the_model(self):
        (self.req / 'requirements.yaml').write_text('''id: ROOT
children:
  - id: AUDITED
    description: Every write must create an audit record.
    children:
      - id: R1
        name: Update an organization
''')
        requirements = RequirementSet.load(self.req)
        payload = json.loads(requirements.batch_prompt(requirements.nodes))
        self.assertEqual(payload['inherited_constraints'][0]['description'],
                         'Every write must create an audit record.')

    def test_dependency_order_not_yaml_order(self):
        (self.req / "requirements.yaml").write_text("""id: ROOT
children:
  - id: R2
    dependencies: [R1]
  - id: R1
""")
        self.assertEqual([n["id"] for n in RequirementSet.load(self.req).nodes], ["R1", "R2"])

    def test_cycles_and_unknown_dependencies_fail_before_generation(self):
        for data in (
            "id: ROOT\nchildren: [{id: R1, dependencies: [R1]}]",
            "id: ROOT\nchildren: [{id: R1, dependencies: [R2]}, {id: R2, dependencies: [R1]}]",
            "id: ROOT\nchildren: [{id: R1, dependencies: [missing]}]",
            "id: ROOT\nchildren: [{id: R1}, {id: R1}]",
        ):
            with self.subTest(data=data):
                (self.req / "requirements.yaml").write_text(data)
                with self.assertRaises(ValueError):
                    RequirementSet.load(self.req)

    def test_reference_content_changes_fingerprint(self):
        before = RequirementSet.load(self.req).fingerprint
        (self.req / "reference.txt").write_text("A different reference")
        self.assertNotEqual(before, RequirementSet.load(self.req).fingerprint)

    def test_folder_dependencies_expand_to_atomic_nodes(self):
        (self.req / "requirements.yaml").write_text("""id: ROOT
children:
  - id: NEXT
    dependencies: [FIRST]
    children: [{id: N1}]
  - id: FIRST
    children: [{id: F1}, {id: F2}]
""")
        self.assertEqual([n["id"] for n in RequirementSet.load(self.req).nodes], ["F1", "F2", "N1"])


class WorkspaceTests(TempCase):
    def test_large_source_is_read_in_complete_unicode_chunks(self):
        source = ('const message="中文文本";\n' * 1500) + 'END'
        self.workspace.write_files([{'path': 'large.js', 'content': source}])
        with self.assertRaisesRegex(ValueError, 'read_file_chunk'):
            self.workspace.read_files(['large.js'])
        parts, offset = [], 0
        while offset is not None:
            result = self.workspace.read_file_chunk('large.js', offset=offset, limit=1500)
            self.assertLessEqual(len(result['content']), 1500)
            parts.append(result['content'])
            offset = result['next_offset']
        self.assertEqual(''.join(parts), source)
        with self.assertRaises(ValueError):
            self.workspace.read_file_chunk('../outside.js')

    def test_browser_gc_cannot_be_enabled_by_inherited_or_extra_environment(self):
        with patch.dict(os.environ, {"PLAYWRIGHT_SKIP_BROWSER_GC": "0"}):
            self.assertEqual(tool_environment({"PLAYWRIGHT_SKIP_BROWSER_GC": "0"})["PLAYWRIGHT_SKIP_BROWSER_GC"], "1")

    def test_browser_discovery_uses_existing_compatible_module(self):
        if not shutil.which("node"):
            self.skipTest("Node required")
        module = self.out / "node_modules/playwright"
        module.mkdir(parents=True)
        executable = self.base / "fake-browser-binary"
        executable.touch()
        (module / "package.json").write_text('{"name":"playwright","main":"index.js"}')
        (module / "index.js").write_text("exports.chromium={executablePath:()=>" + json.dumps(str(executable)) + "};")
        result = discover_playwright(self.out)
        self.assertTrue(result["available"])
        self.assertEqual(Path(result["module"]).resolve(), (module / "index.js").resolve())

    def test_guarded_paths_and_symlink_escape(self):
        (self.out / "external").symlink_to(self.base)
        for path in ("../escape", "/tmp/escape", "external/escape", ".arc/runner-events.jsonl",
                     ".factory/checkpoint.json", ".env", "@requirements/requirements.yaml"):
            with self.subTest(path=path), self.assertRaises(ValueError):
                self.workspace.write_files([{"path": path, "content": "bad"}])

    def test_batch_validated_before_any_file_is_written(self):
        with self.assertRaises(ValueError):
            self.workspace.write_files([{"path": "good.txt", "content": "ok"},
                                        {"path": "../bad.txt", "content": "bad"}])
        self.assertFalse((self.out / "good.txt").exists())

    def test_exact_edit_rejects_ambiguous_context(self):
        self.workspace.write_files([{"path": "x.txt", "content": "same same"}])
        with self.assertRaises(ValueError):
            self.workspace.edit("x.txt", "same", "different")
        self.assertEqual((self.out / "x.txt").read_text(), "same same")

    def test_subprocess_has_no_model_secret_and_timeout_is_real(self):
        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-secret-value"}):
            result = self.workspace.run([sys.executable, "-c",
                "import os; assert 'OPENAI_API_KEY' not in os.environ; print('ok')"])
            self.assertEqual(result["exit_code"], 0)
        result = self.workspace.run([sys.executable, "-c", "import time; time.sleep(10)"], timeout=0.1)
        self.assertTrue(result["timed_out"])
        self.assertNotEqual(result["exit_code"], 0)

    def test_trace_redacts_known_secret(self):
        with patch.dict(os.environ, {"OPENAI_API_KEY": "a-private-api-value"}):
            trace = Trace(self.out / ".factory")
            trace.event("test", content="a-private-api-value")
        self.assertNotIn("a-private-api-value", trace.path.read_text())


class FakeGateway:
    """Synthetic protocol fixture, not a real provider response."""
    def __init__(self, responses):
        self.requests = []
        self.responses = list(responses)
        owner = self
        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                owner.requests.append(json.loads(self.rfile.read(int(self.headers["Content-Length"]))))
                if not owner.responses:
                    self.send_error(500)
                    return
                response = owner.responses.pop(0)
                body = json.dumps(response).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            def log_message(self, *args):
                pass
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)

    def __enter__(self):
        self.thread.start()
        return self

    def __exit__(self, *args):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    @property
    def url(self):
        return f"http://127.0.0.1:{self.server.server_port}/v1"


def response(calls, *, reasoning="Synthetic reasoning content for protocol tests only."):
    return {"choices": [{"finish_reason": "tool_calls", "message": {"role": "assistant",
        "content": None, "reasoning_content": reasoning, "tool_calls": [
            {"id": f"call-{index}", "type": "function", "function": {"name": name,
              "arguments": json.dumps(arguments)}} for index, (name, arguments) in enumerate(calls)]}}],
        "usage": {"prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150}}


GREETING_FILES = [
    {"path": "frontend/package.json", "content": json.dumps({"scripts": {"build": "node build.cjs"}})},
    {"path": "frontend/build.cjs", "content": "require('node:fs').writeFileSync('built.txt','ready')"},
    {"path": "backend/package.json", "content": json.dumps({"scripts": {"start": "node server.cjs"}})},
    {"path": "backend/server.cjs", "content":
     "require('node:http').createServer((q,s)=>s.end('hello')).listen(process.env.PORT,'0.0.0.0');"},
    {"path": "checks/greeting.cjs", "content":
     "fetch(process.env.FACTORY_BASE_URL).then(r=>r.text()).then(t=>require('node:assert').strictEqual(t,'hello'))"
     ".catch(e=>{console.error(e);process.exitCode=1});"},
]


@unittest.skipUnless(shutil.which("node") and shutil.which("npm"), "Node and npm required")
class ExecutionTests(TempCase):
    def test_unselected_browser_check_still_blocks_acceptance_and_can_be_repaired(self):
        self.workspace.write_files(GREETING_FILES)
        # Synthetic routing fixture; real browser execution is checked by E015 replay.
        self.workspace.browser = {'available': True}
        script = '// FACTORY_PLAYWRIGHT_MODULE: browser check routing fixture\n' + GREETING_FILES[-1]['content']
        self.workspace.write_files([{'path': 'checks/visible.spec.cjs',
                                     'content': script.replace("'hello'", "'wrong'")}])
        first = self.workspace.verify(['node', 'checks/greeting.cjs'])
        self.assertFalse(first['passed'])
        self.assertEqual(first['executed_checks'], [['node', 'checks/greeting.cjs'],
                                                    ['node', 'checks/visible.spec.cjs']])
        self.assertIsNone(self.workspace.last_verification)
        self.workspace.write_files([{'path': 'checks/visible.spec.cjs', 'content': script}])
        self.assertTrue(self.workspace.verify(['node', 'checks/greeting.cjs'])['passed'])

    def test_real_empty_optional_api_does_not_break_the_application_server(self):
        captured = json.loads((ROOT / 'tests/fixtures/real-empty-api-tool-call.json').read_text())['arguments']
        self.assertEqual(captured['api_js'], '')
        scaffold(self.workspace)
        check = """const {test}=require('node:test');const assert=require('node:assert/strict');
test('server serves generated page despite empty optional API',async()=>{
 const response=await fetch(process.env.FACTORY_BASE_URL);
 assert.equal(response.status,200);assert.match(await response.text(),/data-testid=\"count\"/);
});"""
        result = implement(self.workspace, captured['index_html'], captured['app_js'], check, captured['api_js'])
        self.assertTrue(result['passed'], result)
        self.assertIn('=>false', (self.out / 'backend/api.cjs').read_text())

    def test_real_build_http_check_and_process_cleanup(self):
        self.workspace.write_files(GREETING_FILES)
        result = self.workspace.verify(["node", "checks/greeting.cjs"])
        self.assertTrue(result["passed"], result)
        self.assertEqual(result["official_evaluation"], "pending")
        reused = self.workspace.verify(["node", "checks/greeting.cjs"])
        self.assertTrue(reused["reused_unchanged_verification"])
        self.workspace.edit("checks/greeting.cjs", "'hello'", "'wrong'")
        result = self.workspace.verify(["node", "checks/greeting.cjs"])
        self.assertFalse(result["passed"])
        self.assertIsNone(self.workspace.last_verification)
        self.assertEqual(self.workspace.last_verification_attempt, result)
        self.assertEqual(result["source_fingerprint"], self.workspace.fingerprint())

    @unittest.skipUnless(os.getenv('FACTORY_TEST_PLAYWRIGHT_MODULE') and
                         os.getenv('FACTORY_TEST_CHROMIUM_EXECUTABLE'),
                         'Provide an installed Playwright module and Chromium for real browser checks')
    def test_prepared_browser_resolves_relative_navigation(self):
        module = os.environ['FACTORY_TEST_PLAYWRIGHT_MODULE']
        executable = os.environ['FACTORY_TEST_CHROMIUM_EXECUTABLE']
        wrapper = self.base / 'real-browser.cjs'
        wrapper.write_text('const pw=require(' + json.dumps(module) + ');'
            'module.exports={chromium:{launch:()=>pw.chromium.launch({headless:true,executablePath:'
            + json.dumps(executable) + '})}};')
        self.workspace.runtime_env['FACTORY_PLAYWRIGHT_MODULE'] = str(wrapper)
        scaffold(self.workspace)
        check = """const {test,assert}=require('./browser.cjs');
test('relative routes use the managed application origin',async page=>{
await page.goto('/details');
assert.equal(new URL(page.url()).pathname,'/details');
assert.equal(await page.getByRole('heading',{name:'Greeting',exact:true}).textContent(),'Greeting');
await page.goto('/');assert.equal(new URL(page.url()).pathname,'/');
});"""
        result = implement(self.workspace, '<h1>Greeting</h1>', '', check)
        self.assertTrue(result['passed'], result)

    def test_model_tool_loop_repairs_failure_then_resumes_without_model_call(self):
        initial = response([("build_app", {"index_html": "wrong",
                            "checks_js": GREETING_FILES[-1]['content']})])
        repair = response([("build_app", {"index_html": "hello", "checks_js": GREETING_FILES[-1]['content']})])
        with FakeGateway([initial, repair]) as server:
            model = Model(server.url, "synthetic-test-key", "synthetic-model", self.trace)
            agent = Agent(RequirementSet.load(self.req), model, self.workspace, Runtime(self.trace))
            result = agent.run()
            self.assertEqual(result["status"], "completed")
            self.assertEqual(model.usage.total_tokens, 300)
            self.assertEqual(len(server.requests), 2)
            prior = server.requests[1]["messages"]
            self.assertEqual(prior[2]["reasoning_content"], initial["choices"][0]["message"]["reasoning_content"])
            self.assertEqual([m["role"] for m in prior], ["system", "user", "assistant", "tool"])
            self.assertEqual(server.requests[0]['tool_choice']['function']['name'], 'build_app')
            self.assertEqual(server.requests[1]['tool_choice']['function']['name'], 'build_app')
            model2 = Model(server.url, "synthetic-test-key", "synthetic-model", self.trace)
            fresh_workspace = Workspace(self.out, self.req, self.trace, time.monotonic() + 40)
            result2 = Agent(RequirementSet.load(self.req), model2, fresh_workspace, Runtime(self.trace)).run()
            self.assertEqual(result2["status"], "completed")
            self.assertEqual(model2.usage.calls, 0)
            self.assertIsNotNone(fresh_workspace.last_verification)

    def test_missing_usage_stays_unknown(self):
        payload = response([])
        del payload["usage"]
        with FakeGateway([payload]) as server:
            model = Model(server.url, "synthetic-test-key", "test", self.trace)
            model.complete([], [])
            self.assertEqual(model.usage.missing_usage_calls, 1)

    def test_thinking_effort_and_actual_truncated_usage(self):
        fixture = json.loads((ROOT / 'tests/fixtures/real-deepseek-truncated-metadata.json').read_text())
        with FakeGateway([fixture['response']]) as server:
            model = Model(server.url, "synthetic-test-key", "deepseek-v4-flash", self.trace)
            model.thinking = 'enabled'
            _, reason = model.complete([], [])
            self.assertEqual(server.requests[0]['reasoning_effort'], 'low')
            self.assertNotIn('temperature', server.requests[0])
            self.assertEqual(reason, 'length')
            self.assertEqual(model.usage.completion_tokens, 66227)
            self.assertGreater(model.usage.completion_tokens, model.max_output)
            self.assertEqual(model.usage.total_tokens, 70886)

    def test_qwen_uses_provider_thinking_switch(self):
        with FakeGateway([response([]), response([])]) as server:
            model = Model(server.url, 'synthetic-test-key', 'qwen3.6-flash', self.trace)
            model.thinking = 'disabled'
            model.complete([], [])
            model.thinking = 'enabled'
            model.complete([], [])
            self.assertIs(server.requests[0]['enable_thinking'], False)
            self.assertIs(server.requests[1]['enable_thinking'], True)
            self.assertNotIn('thinking', server.requests[0])

    def test_kimi_uses_low_effort_without_claiming_thinking_can_be_disabled(self):
        answer = response([('list_files', {})])
        answer['choices'][0]['message']['reasoning_content'] = 'Synthetic retained reasoning'
        with FakeGateway([answer, answer]) as server:
            model = Model(server.url, 'synthetic-test-key', 'kimi-k3', self.trace)
            model.thinking = 'disabled'
            first, _ = model.complete([{'role': 'user', 'content': 'Inspect the project'}], TOOLS)
            messages = [{'role': 'user', 'content': 'Inspect the project'}, first,
                        {'role': 'tool', 'tool_call_id': first['tool_calls'][0]['id'], 'content': '{}'}]
            model.thinking = 'enabled'
            model.complete(messages, TOOLS)
            for request in server.requests:
                self.assertEqual(request['reasoning_effort'], 'low')
                self.assertNotIn('thinking', request)
                self.assertNotIn('temperature', request)
            self.assertEqual(server.requests[1]['messages'][1], first)

    def test_captured_real_gateway_response_preserves_reasoning_and_usage(self):
        fixture = json.loads((ROOT / 'tests/fixtures/real-deepseek-tool-responses.json').read_text())
        with FakeGateway(fixture['responses']) as server:
            model = Model(server.url, "synthetic-test-key", "deepseek-v4-flash", self.trace)
            model.thinking = 'disabled'
            message, _ = model.complete([], [])
            followup = [{**message}, {"role": "tool", "tool_call_id": message['tool_calls'][0]['id'], "content": '{}'}]
            model.complete(followup, [])
            self.assertEqual(server.requests[1]['messages'][0], message)
            self.assertEqual(server.requests[0]['thinking'], {'type': 'disabled'})
            self.assertEqual(server.requests[0]['temperature'], 0)
            self.assertEqual(model.usage.total_tokens, 5768)


class PackagingTests(unittest.TestCase):
    def test_archive_is_reproducible_and_excludes_development_state(self):
        import zipfile
        package = ROOT / "scripts/package.py"
        subprocess.run([sys.executable, str(package)], check=True, capture_output=True)
        path = ROOT / "dist/volo-factory.zip"
        before = hashlib.sha256(path.read_bytes()).hexdigest()
        subprocess.run([sys.executable, str(package)], check=True, capture_output=True)
        self.assertEqual(before, hashlib.sha256(path.read_bytes()).hexdigest())
        with zipfile.ZipFile(path) as archive:
            self.assertIn("main.py", archive.namelist())
            self.assertFalse(any(n.startswith((".venv", "tests", ".env", "runs", "docs"))
                                 for n in archive.namelist()))


if __name__ == "__main__":
    unittest.main()
