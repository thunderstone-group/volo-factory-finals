"""Context invariants and repair under pressure; not model-quality evidence."""
import copy
import json
import shutil
import unittest

from volo.agent import Agent
from volo.context import exchanges, project, size
from volo.model import Model
from volo.requirements import RequirementSet
from volo.trace import Runtime
from volo.web_runtime import scaffold, SERVER
from test_core import FakeGateway, GREETING_FILES, ROOT, TempCase, response


PREFIX = [{"role": "system", "content": "Follow the task."},
          {"role": "user", "content": "Implement required behavior."}]


def block(index, *, arguments="{}", output="ok"):
    call_id = f"call-{index}"
    return [{"role": "assistant", "content": None, "reasoning_content": f"reasoning-{index}",
             "tool_calls": [{"id": call_id, "type": "function", "function": {
                 "name": "run", "arguments": arguments}}]},
            {"role": "tool", "tool_call_id": call_id, "content": output}]


class ContextTests(unittest.TestCase):
    def test_below_limit_keeps_exact_existing_prompt(self):
        original = PREFIX + block(1)
        def unexpected_checkpoint():
            self.fail("Normal calls must not rebuild their context")
        view, audit = project(original, 10000, unexpected_checkpoint)
        self.assertIs(view, original)
        self.assertIsNone(audit)

    def test_only_old_tool_output_is_pruned_and_history_is_unchanged(self):
        original = PREFIX + block(0, output="HEAD" + "x" * 25000 + "ERROR-TAIL") + block(1) + block(2)
        before = copy.deepcopy(original)
        view, audit = project(original, 6500, lambda: self.fail("Pruning should suffice"))
        self.assertEqual(original, before)
        self.assertLessEqual(size(view), 6500)
        self.assertEqual(view[-4:], original[-4:])
        self.assertEqual(view[2], original[2])
        self.assertIn("HEAD", view[3]["content"])
        self.assertTrue(view[3]["content"].endswith("ERROR-TAIL"))
        self.assertIn(".factory/events.jsonl", view[3]["content"])
        self.assertEqual(audit["pruned_tool_call_ids"], ["call-0"])

    def test_checkpoint_retains_complete_real_protocol_exchanges_and_reasoning(self):
        fixture = json.loads((ROOT / "tests/fixtures/real-deepseek-tool-responses.json").read_text())
        captured = []
        for entry in fixture["responses"]:
            message = copy.deepcopy(entry["choices"][0]["message"])
            captured.append(message)
            # Outputs are synthetic; assistant protocol fields come from a real capture.
            captured.extend({"role": "tool", "tool_call_id": call["id"], "content": "{}"}
                            for call in message["tool_calls"])
        anchor = [{"role": "system", "content": "Follow the task."},
                  {"role": "user", "content": "Current files and failed verification."}]
        original = PREFIX + block(0, arguments="x" * 25000) + captured
        before = copy.deepcopy(original)
        limit = size(anchor + captured)
        view, audit = project(original, limit, lambda: anchor)
        self.assertEqual(view, anchor + captured)
        self.assertEqual(original, before)
        self.assertEqual(audit["omitted_messages"], 2)
        self.assertEqual(len(exchanges(view[2:])), 2)

    def test_oversized_latest_exchange_is_omitted_whole(self):
        original = PREFIX + block(1, arguments="x" * 20000)
        anchor = PREFIX + [{"role": "user", "content": "Real failure retained in checkpoint"}]
        view, audit = project(original, 1000, lambda: anchor)
        self.assertEqual(view, anchor)
        self.assertEqual(audit["omitted_messages"], 2)
        self.assertLessEqual(size(view), 1000)

    def test_invalid_pairs_are_rejected_without_fabricating_results(self):
        pair = block(1)
        for malformed in ([pair[1]], [pair[0]], [pair[0], {**pair[1], "tool_call_id": "different"}]):
            with self.subTest(malformed=malformed), self.assertRaises(ValueError):
                exchanges(malformed)

    def test_oversized_checkpoint_fails_before_sending_an_over_limit_request(self):
        with self.assertRaisesRegex(ValueError, "checkpoint exceed"):
            project(PREFIX + block(1, arguments="x" * 10000), 100,
                    lambda: [{"role": "user", "content": "x" * 101}])


@unittest.skipUnless(shutil.which("node") and shutil.which("npm"), "Node and npm required")
class ContextRepairTests(TempCase):
    def test_authored_test_bundle_runs_before_another_model_call(self):
        self.workspace.write_files([{'path': 'README.md', 'content': 'An existing application.'}])
        (self.req / 'requirements.yaml').write_text('id: ROOT\nchildren:\n  - id: REQ-1\n'
            '    description: Serve hello over HTTP. ' + 'Additional context. ' * 250 + '\n')
        files = copy.deepcopy(GREETING_FILES)
        files[-1] = {'path': 'checks/greeting.test.cjs', 'content':
            "const {test,assert}=require('./helpers.cjs');"
            "test('visible greeting',async()=>{assert.equal(await (await fetch(process.env.FACTORY_BASE_URL)).text(),'hello')});"}
        files.append({'path': 'checks/helpers.cjs', 'content':
            "exports.test=require('node:test').test;exports.assert=require('node:assert/strict');"})
        with FakeGateway([response([('write_files', {'files': files})])]) as gateway:
            agent = Agent(RequirementSet.load(self.req),
                Model(gateway.url, 'synthetic-test-key', 'deepseek-v4-pro', self.trace),
                self.workspace, Runtime(self.trace))
            result = agent.run()
        self.assertEqual(result['status'], 'completed')
        self.assertEqual(len(gateway.requests), 1)
        self.assertEqual(agent.check_command,
                         ['node', '--test', '--test-concurrency=1', 'checks/greeting.test.cjs'])
        self.assertTrue(self.workspace.last_verification['passed'])

    def test_successful_read_survives_an_oversized_reasoning_exchange(self):
        self.workspace.write_files([{'path': 'context-only.txt', 'content': 'IMPORTANT_READ_MARKER'}])
        read = response([('read_files', {'paths': ['context-only.txt']})])
        read['choices'][0]['message']['reasoning_content'] = 'omitted-pressure-marker' * 4000
        deliver = response([('deliver', {'files': GREETING_FILES,
                                        'check_command': ['node', 'checks/greeting.cjs']})])
        with FakeGateway([read, deliver]) as gateway:
            agent = Agent(RequirementSet.load(self.req),
                Model(gateway.url, 'synthetic-test-key', 'synthetic-model', self.trace),
                self.workspace, Runtime(self.trace), max_context_chars=16000)
            result = agent.run()
        self.assertEqual(result['status'], 'completed')
        context = json.dumps(gateway.requests[1]['messages'])
        self.assertIn('IMPORTANT_READ_MARKER', context)
        self.assertNotIn('omitted-pressure-marker', context)
        self.assertLessEqual(size(gateway.requests[1]['messages']), 16000)

    def test_bounded_feature_uses_full_tools_with_low_reasoning(self):
        self.workspace.write_files([{'path': 'README.md', 'content': 'An existing application.'}])
        (self.req / 'requirements.yaml').write_text('id: ROOT\nchildren:\n  - id: REQ-1\n'
            '    description: Serve hello over HTTP. ' + 'Additional context. ' * 250 + '\n')
        answer = response([('deliver', {'files': GREETING_FILES,
                                       'check_command': ['node', 'checks/greeting.cjs']})])
        with FakeGateway([answer]) as gateway:
            agent = Agent(RequirementSet.load(self.req),
                Model(gateway.url, 'synthetic-test-key', 'deepseek-v4-pro', self.trace),
                self.workspace, Runtime(self.trace))
            result = agent.run()
        self.assertEqual(result['status'], 'completed')
        self.assertEqual(gateway.requests[0]['thinking'], {'type': 'enabled'})
        self.assertEqual(gateway.requests[0]['reasoning_effort'], 'low')
        self.assertNotIn('tool_choice', gateway.requests[0])
        self.assertIn('deliver', [t['function']['name'] for t in gateway.requests[0]['tools']])
        self.assertNotIn('build_app', [t['function']['name'] for t in gateway.requests[0]['tools']])

    def test_bounded_new_app_uses_runtime_for_routes_and_stateful_api(self):
        (self.req / 'requirements.yaml').write_text('id: ROOT\nchildren:\n  - id: REQ-1\n'
            '    description: Serve a routed greeting and incrementing API. ' + 'Additional context. ' * 250 + '\n')
        api = """let count=0;module.exports=async(req,res)=>{
if(req.url!='/api/count')return false;
if(req.method==='POST')count++;
res.setHeader('content-type','application/json');res.end(JSON.stringify({count}));return true;};"""
        checks = """const {test}=require('node:test');const assert=require('node:assert/strict');
test('routed document and real state transitions',async()=>{
const base=process.env.FACTORY_BASE_URL;
assert.equal(await(await fetch(base+'/details')).text(),'<h1>hello</h1>');
const first=await(await fetch(base+'/api/count')).json();
await fetch(base+'/api/count',{method:'POST'});
const next=await(await fetch(base+'/api/count')).json();assert.equal(next.count,first.count+1);
assert.equal((await fetch(base+'/api/missing')).status,404);
});"""
        with FakeGateway([response([('build_app', {'index_html': '<h1>hello</h1>',
                'checks_js': checks, 'api_js': api})])]) as gateway:
            agent = Agent(RequirementSet.load(self.req),
                Model(gateway.url, 'synthetic-test-key', 'deepseek-v4-pro', self.trace),
                self.workspace, Runtime(self.trace))
            result = agent.run()
        self.assertEqual(result['status'], 'completed')
        self.assertEqual(len(gateway.requests), 1)
        self.assertNotIn('tool_choice', gateway.requests[0])
        self.assertEqual([tool['function']['name'] for tool in gateway.requests[0]['tools']], ['build_app'])
        self.assertEqual((self.out / 'backend/server.cjs').read_text(), SERVER)
        self.assertTrue(self.workspace.last_verification['passed'])

    def test_bounded_failure_opens_narrow_repairs_and_keeps_both_log_ends(self):
        (self.req / 'requirements.yaml').write_text('id: ROOT\nchildren:\n  - id: REQ-1\n'
            '    description: Serve hello over HTTP. ' + 'Additional context. ' * 250 + '\n')
        checks = """const assert=require('node:assert/strict');
fetch(process.env.FACTORY_BASE_URL).then(r=>r.text()).then(text=>{
if(text!=='hello')console.error('EARLY_FAILURE\\n'+'.'.repeat(7000)+'\\nLATE_FAILURE');
assert.equal(text,'hello');}).catch(error=>{console.error(error);process.exitCode=1;});"""
        # A complete source bundle above 24 KB reproduced E056's snapshot gap.
        # It is still small enough to supply in one bounded repair context.
        checks += '\n/*' + 'padding' * 4000 + '*/\n'
        initial = response([('build_app', {'index_html': 'wrong', 'checks_js': checks})])
        repair = response([('patch_and_verify', {'edits': [{
            'path': 'frontend/public/index.html', 'old': 'wrong', 'new': 'hello'}],
            'check_command': ['node', '--test', 'checks/requirements.cjs']})])
        with FakeGateway([initial, repair]) as gateway:
            agent = Agent(RequirementSet.load(self.req),
                Model(gateway.url, 'synthetic-test-key', 'deepseek-v4-pro', self.trace),
                self.workspace, Runtime(self.trace))
            result = agent.run()
        self.assertEqual(result['status'], 'completed')
        self.assertEqual(len(gateway.requests), 2)
        self.assertNotIn('tool_choice', gateway.requests[1])
        tools = [tool['function']['name'] for tool in gateway.requests[1]['tools']]
        self.assertEqual(tools, ['patch_and_verify'])
        repair_context = gateway.requests[1]['messages'][-1]['content']
        self.assertIn('EARLY_FAILURE', repair_context)
        self.assertIn('LATE_FAILURE', repair_context)
        self.assertIn(json.dumps(checks, ensure_ascii=False), repair_context)
        self.assertLessEqual(size(gateway.requests[1]['messages']), agent.max_context_chars)
        self.assertEqual((self.out / 'checks/requirements.cjs').read_text(), checks)
        self.assertTrue(self.workspace.last_verification['passed'])

    def test_compact_context_omits_only_byte_identical_known_runtime(self):
        scaffold(self.workspace)
        self.workspace.write_files([{'path': 'frontend/public/index.html', 'content': '<h1>Product</h1>'}])
        agent = Agent(RequirementSet.load(self.req), None, self.workspace, None)
        agent.inline_source = True
        payload = json.loads(agent.batch_request(agent.requirements.nodes))
        self.assertNotIn('backend/server.cjs', payload['source'])
        self.assertIn('backend/server.cjs', payload['verified_unchanged_runtime'])
        self.assertEqual(payload['source']['frontend/public/index.html'], '<h1>Product</h1>')
        self.assertEqual(payload['requirements'], json.loads(agent.requirements.batch_prompt(agent.requirements.nodes)))
        self.workspace.write_files([{'path': 'backend/server.cjs', 'content': SERVER + '\n// product-specific change'}])
        changed = json.loads(agent.batch_request(agent.requirements.nodes))
        self.assertIn('product-specific change', changed['source']['backend/server.cjs'])

    def test_small_existing_source_supports_one_verified_edit_without_exposing_state(self):
        files = copy.deepcopy(GREETING_FILES)
        files[3]['content'] += '\n/*' + 'preserved-large-source-' * 600 + '*/'
        self.workspace.write_files(files + [
            {'path': 'theme.css', 'content': '/* preserve this unrelated source */'},
            {'path': 'accounts.json', 'content': '{"private":"not-for-initial-context"}'}])
        (self.out / '.env').write_text('PRIVATE=never-inline-secret')
        (self.trace.directory / 'internal.js').write_text('never-inline-harness')
        answer = response([('patch_and_verify', {'edits': [
            {'path': 'backend/server.cjs', 'old': "s.end('hello')", 'new': "s.end('welcome')"},
            {'path': 'checks/greeting.cjs', 'old': "'hello'", 'new': "'welcome'"}],
            'check_command': ['node checks/greeting.cjs']})])
        with FakeGateway([answer]) as gateway:
            agent = Agent(RequirementSet.load(self.req),
                Model(gateway.url, 'synthetic-test-key', 'synthetic-model', self.trace),
                self.workspace, Runtime(self.trace))
            result = agent.run()
        self.assertEqual(result['status'], 'completed')
        self.assertEqual(len(gateway.requests), 1)
        self.assertEqual(gateway.requests[0]['tool_choice']['function']['name'], 'patch_and_verify')
        sent = json.dumps(gateway.requests)
        self.assertIn("s.end('hello')", sent)
        self.assertNotIn('not-for-initial-context', sent)
        self.assertNotIn('never-inline-secret', sent)
        self.assertNotIn('never-inline-harness', sent)
        self.assertEqual((self.out / 'theme.css').read_text(), '/* preserve this unrelated source */')
        self.assertTrue(self.workspace.last_verification['passed'])
        self.assertEqual(agent.check_command, ['node', 'checks/greeting.cjs'])
        before = (self.out / 'backend/server.cjs').read_text()
        with self.assertRaisesRegex(ValueError, 'Node/Python'):
            agent.dispatch('patch_and_verify', {'edits': [
                {'path': 'backend/server.cjs', 'old': "s.end('welcome')", 'new': "s.end('changed')"}],
                'check_command': ['bash', '-c', 'true']})
        self.assertEqual((self.out / 'backend/server.cjs').read_text(), before)
        with self.assertRaises(ValueError) as rejected:
            agent.dispatch('patch_and_verify', {'edits': [
                {'path': 'backend/server.cjs', 'old': "s.end('welcome')", 'new': "s.end('changed')"},
                {'path': 'checks/greeting.cjs', 'old': 'missing-text', 'new': 'replacement'}],
                'check_command': ['node', 'checks/greeting.cjs']})
        # The rejection names which edit failed, in which file, and shows the real text there.
        message = str(rejected.exception)
        self.assertIn('edit 2 of this call', message)
        self.assertIn('checks/greeting.cjs', message)
        self.assertIn('<<<HERE>>>', message)
        self.assertEqual((self.out / 'backend/server.cjs').read_text(), before)
        (self.out / 'large.js').write_text('x' * 24001)
        self.assertIsNone(agent.source_snapshot())

    def test_real_failed_check_survives_context_pressure_and_repairs(self):
        self.workspace.write_files([{"path": "README.md", "content": "An existing application."}])
        files = copy.deepcopy(GREETING_FILES)
        files[-1]["content"] = files[-1]["content"].replace("'hello'", "'wrong'")
        files.append({"path": "fresh.txt", "content": "full-history-marker" + "x" * 60000})
        check = ["node", "checks/greeting.cjs"]
        initial = response([("write_files", {"files": files}), ("finish", {"check_command": check})])
        repair = response([("edit", {"path": "checks/greeting.cjs", "old": "'wrong'", "new": "'hello'"}),
                           ("finish", {"check_command": check})])
        for call in repair["choices"][0]["message"]["tool_calls"]:
            call["id"] = "repair-" + call["id"]
        with FakeGateway([initial, repair]) as gateway:
            model = Model(gateway.url, "synthetic-test-key", "synthetic-model", self.trace)
            agent = Agent(RequirementSet.load(self.req), model, self.workspace, Runtime(self.trace),
                          max_context_chars=16000)
            result = agent.run()
        self.assertEqual(result["status"], "completed")
        self.assertEqual(len(gateway.requests), 2)
        context = gateway.requests[1]["messages"]
        self.assertLessEqual(size(context), 16000)
        self.assertIn('"passed": false', context[1]["content"])
        self.assertIn("wrong", context[1]["content"])
        self.assertIn("fresh.txt", context[1]["content"])
        self.assertIn("REQ-1", context[1]["content"])
        self.assertNotIn("full-history-marker", json.dumps(context))
        events = [json.loads(line) for line in self.trace.path.read_text().splitlines()]
        self.assertTrue(any(event["event"] == "context_projection" for event in events))
        self.assertTrue(any(event["event"] == "tool_start" and
                            "full-history-marker" in json.dumps(event) for event in events))
        outcomes = [event["passed"] for event in events if event["event"] == "verification"]
        self.assertEqual(outcomes, [False, True])
        self.assertTrue(self.workspace.last_verification_attempt["passed"])
