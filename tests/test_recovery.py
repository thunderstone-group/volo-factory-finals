"""Synthetic transport with real HTTP execution; no model-quality claims."""
import json
import shutil
import unittest

from test_core import TempCase, FakeGateway, GREETING_FILES, response
from volo.agent import Agent
from volo.model import Model
from volo.requirements import RequirementSet
from volo.trace import Runtime


def truncated():
    value = response([('write_files', {'files': [{'path': 'MUST_NOT_EXIST', 'content': 'partial'}]})])
    value['choices'][0]['finish_reason'] = 'length'
    return value


@unittest.skipUnless(shutil.which('node') and shutil.which('npm'), 'Node and npm required')
class RecoveryTests(TempCase):
    def agent(self, gateway, calls=8):
        model = Model(gateway.url, 'synthetic-key', 'synthetic-model', self.trace)
        return Agent(RequirementSet.load(self.req), model, self.workspace, Runtime(self.trace), max_calls=calls)

    def test_truncation_opens_incremental_tools_and_finishes_real_http_check(self):
        complete = response([
            ('write_files', {'files': [
                {'path': 'frontend/public/index.html', 'content': 'hello'},
                {'path': 'checks/http.cjs', 'content': GREETING_FILES[-1]['content']},
            ]}),
            ('finish', {'check_command': ['node', 'checks/http.cjs']}),
        ])
        with FakeGateway([truncated(), complete]) as gateway:
            result = self.agent(gateway).run()
            self.assertEqual(result['status'], 'completed')
            self.assertEqual(len(gateway.requests), 2)
            self.assertEqual(gateway.requests[0]['tool_choice']['function']['name'], 'build_app')
            self.assertNotIn('tool_choice', gateway.requests[1])
            names = {t['function']['name'] for t in gateway.requests[1]['tools']}
            self.assertIn('write_files', names)
            self.assertIn('edit', names)
            self.assertNotIn('build_app', names)
            self.assertEqual([m['role'] for m in gateway.requests[1]['messages']], ['system', 'user', 'user'])
        self.assertFalse((self.out / 'MUST_NOT_EXIST').exists())
        self.assertTrue(self.workspace.last_verification['passed'])
        events = [json.loads(line) for line in self.trace.path.read_text().splitlines()]
        self.assertTrue(any(e['event'] == 'recovery_transition' and e['next_mode'] == 'incremental' for e in events))

    def test_compact_edit_truncation_releases_forcing_without_discarding_source(self):
        self.workspace.write_files(GREETING_FILES)
        complete = response([('finish', {'check_command': ['node', 'checks/greeting.cjs']})])
        with FakeGateway([truncated(), complete]) as gateway:
            self.agent(gateway).run()
            self.assertEqual(gateway.requests[0]['tool_choice']['function']['name'], 'patch_and_verify')
            self.assertNotIn('tool_choice', gateway.requests[1])
        self.assertIn("s.end('hello')", (self.out / 'backend/server.cjs').read_text())
        self.assertFalse((self.out / 'MUST_NOT_EXIST').exists())

    def test_repeated_truncation_stops_at_three_not_entire_call_budget(self):
        with FakeGateway([truncated() for _ in range(8)]) as gateway:
            with self.assertRaisesRegex(RuntimeError, 'three consecutive truncated'):
                self.agent(gateway).run()
            self.assertEqual(len(gateway.requests), 3)
            self.assertTrue(all('tool_choice' not in r for r in gateway.requests[1:]))
        self.assertFalse((self.out / 'frontend/public/index.html').exists())
        self.assertFalse((self.out / 'MUST_NOT_EXIST').exists())

    def test_unadvertised_tool_does_not_execute_after_fallback(self):
        rejected = response([('build_app', {'index_html': 'must not execute', 'checks_js': 'process.exit(0)'})])
        accepted = response([
            ('write_files', {'files': [
                {'path': 'frontend/public/index.html', 'content': 'hello'},
                {'path': 'checks/http.cjs', 'content': GREETING_FILES[-1]['content']},
            ]}),
            ('finish', {'check_command': ['node', 'checks/http.cjs']}),
        ])
        with FakeGateway([truncated(), rejected, accepted]) as gateway:
            self.agent(gateway).run()
            self.assertIn('not offered', gateway.requests[2]['messages'][-1]['content'])
        self.assertFalse((self.out / 'checks/requirements.cjs').exists())
