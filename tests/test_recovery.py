"""Synthetic gateway control flow plus real HTTP execution; no quality claims."""
import json
import shutil
import unittest
from unittest.mock import Mock

from test_core import TempCase, FakeGateway, GREETING_FILES, response
from volo.agent import Agent
from volo.context import exchanges
from volo.model import Model
from volo.requirements import RequirementSet
from volo.trace import Runtime


def truncated():
    value = response([('write_files', {'files': [{'path': 'must-not-exist.txt', 'content': 'incomplete response'}]})])
    value['choices'][0]['finish_reason'] = 'length'
    return value


@unittest.skipUnless(shutil.which('node') and shutil.which('npm'), 'Node and npm required')
class RecoveryTests(TempCase):
    def execute(self, responses, *, max_calls=10):
        with FakeGateway(responses) as gateway:
            runtime = Mock(wraps=Runtime(self.trace))
            agent = Agent(RequirementSet.load(self.req),
                          Model(gateway.url, 'synthetic-key', 'synthetic-model', self.trace),
                          self.workspace, runtime, max_calls=max_calls)
            result = agent.run()
            for request in gateway.requests:
                exchanges(request['messages'][2:])
            return result, gateway.requests, runtime

    def test_truncated_bundle_opens_file_tools_and_finishes_real_http_app(self):
        result, requests, runtime = self.execute([
            truncated(),
            response([('write_files', {'files': GREETING_FILES[:4]})]),
            response([('write_files', {'files': GREETING_FILES[4:]}),
                      ('finish', {'check_command': ['node', 'checks/greeting.cjs']})]),
        ])
        self.assertEqual(result['status'], 'completed')
        self.assertEqual(requests[0]['tool_choice']['function']['name'], 'build_app')
        self.assertNotIn('tool_choice', requests[1])
        names = {item['function']['name'] for item in requests[1]['tools']}
        self.assertTrue({'write_files', 'edit', 'finish'} <= names)
        self.assertNotIn('build_app', names)
        self.assertFalse((self.out / 'must-not-exist.txt').exists())
        self.assertEqual(result['verified_requirements'], [])
        self.assertEqual(result['self_checked_requirements'], ['REQ-1'])
        self.assertEqual(result['verification_scope'], 'local_checks_only')
        self.assertNotIn('mark_test_passed', [call.args[0] for call in runtime.emit.call_args_list])
        self.assertTrue(self.workspace.last_verification['passed'])

    def test_truncated_compact_patch_preserves_existing_files_and_opens_tools(self):
        self.workspace.write_files(GREETING_FILES)
        before = (self.out / 'backend/server.cjs').read_bytes()
        result, requests, _ = self.execute([
            truncated(), response([('finish', {'check_command': ['node', 'checks/greeting.cjs']})])])
        self.assertEqual(requests[0]['tool_choice']['function']['name'], 'patch_and_verify')
        self.assertNotIn('tool_choice', requests[1])
        self.assertEqual(before, (self.out / 'backend/server.cjs').read_bytes())
        self.assertEqual(result['verified_requirements'], [])
        self.assertFalse((self.out / 'must-not-exist.txt').exists())

    def test_three_consecutive_truncations_stop_before_call_budget(self):
        with FakeGateway([truncated() for _ in range(10)]) as gateway:
            agent = Agent(RequirementSet.load(self.req),
                          Model(gateway.url, 'synthetic-key', 'synthetic-model', self.trace),
                          self.workspace, Runtime(self.trace), max_calls=10)
            with self.assertRaisesRegex(RuntimeError, 'Repeated output truncation'):
                agent.run()
            self.assertEqual(len(gateway.requests), 3)
            self.assertTrue(all('tool_choice' not in r for r in gateway.requests[1:]))
        self.assertFalse((self.out / 'must-not-exist.txt').exists())
        self.assertFalse((self.out / 'frontend/public/index.html').exists())
        events = [json.loads(line) for line in self.trace.path.read_text().splitlines()]
        self.assertEqual(sum(e['event'] == 'execution_mode_changed' for e in events), 1)
        self.assertEqual(events[-1]['event'], 'run_failed')

    def test_completed_response_resets_consecutive_truncation_counter(self):
        result, requests, _ = self.execute([
            truncated(), response([('write_files', {'files': GREETING_FILES})]),
            truncated(), truncated(),
            response([('finish', {'check_command': ['node', 'checks/greeting.cjs']})]),
        ])
        self.assertEqual(result['status'], 'completed')
        self.assertEqual(len(requests), 5)
        self.assertFalse((self.out / 'must-not-exist.txt').exists())

    def test_noop_self_check_is_never_authoritative_requirement_evidence(self):
        self.workspace.write_files(GREETING_FILES)
        self.workspace.edit('backend/server.cjs', "s.end('hello')", "s.end('wrong')")
        result, _, _ = self.execute([response([('finish', {'check_command': ['node', '-e', 'process.exit(0)']})])])
        self.assertEqual(result['verified_requirements'], [])
        self.assertEqual(result['verification_scope'], 'local_checks_only')
        self.assertFalse(self.workspace.last_verification['requirements_verified'])
