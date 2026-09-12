"""Synthetic transport responses, real local HTTP repair; no model calls."""
import json
import shutil
import unittest

from test_core import TempCase, FakeGateway, response, GREETING_FILES
from volo.agent import Agent
from volo.model import Model
from volo.requirements import RequirementSet
from volo.trace import Runtime


def truncated():
    value = response([('write_files', {'files': [{'path': 'must-not-exist', 'content': 'partial'}]})])
    value['choices'][0]['finish_reason'] = 'length'
    return value


@unittest.skipUnless(shutil.which('node') and shutil.which('npm'), 'Node and npm required')
class OutputRecoveryTests(TempCase):
    def agent(self, gateway, max_calls=8):
        return Agent(RequirementSet.load(self.req),
                     Model(gateway.url, 'synthetic-test-key', 'synthetic-model', self.trace),
                     self.workspace, Runtime(self.trace), max_calls=max_calls)

    def test_truncation_unlocks_incremental_tools_and_repairs_real_app(self):
        # First response is deliberately marked incomplete even though its JSON parses.
        repair = response([('deliver', {'files': GREETING_FILES,
                                      'check_command': ['node', 'checks/greeting.cjs']})])
        with FakeGateway([truncated(), repair]) as gateway:
            self.assertEqual(self.agent(gateway).run()['status'], 'completed')
            self.assertEqual(gateway.requests[0]['tool_choice']['function']['name'], 'build_app')
            self.assertNotIn('tool_choice', gateway.requests[1])
            self.assertIn('write_files', [t['function']['name'] for t in gateway.requests[1]['tools']])
            self.assertFalse((self.out / 'must-not-exist').exists())
            self.assertTrue(self.workspace.last_verification['passed'])

    def test_truncation_leaves_compact_edit_mode_without_losing_source(self):
        self.workspace.write_files(GREETING_FILES)
        finish = response([('finish', {'check_command': ['node', 'checks/greeting.cjs']})])
        with FakeGateway([truncated(), finish]) as gateway:
            self.assertEqual(self.agent(gateway).run()['status'], 'completed')
            self.assertEqual(gateway.requests[0]['tool_choice']['function']['name'], 'patch_and_verify')
            self.assertNotIn('tool_choice', gateway.requests[1])
            self.assertFalse((self.out / 'must-not-exist').exists())

    def test_three_consecutive_truncations_stop_without_spending_remaining_calls(self):
        with FakeGateway([truncated()] * 6) as gateway:
            with self.assertRaisesRegex(RuntimeError, 'three consecutive truncated'):
                self.agent(gateway).run()
            self.assertEqual(len(gateway.requests), 3)
            self.assertFalse((self.out / 'must-not-exist').exists())
            events = [json.loads(line) for line in self.trace.path.read_text().splitlines()]
            self.assertEqual(sum(e['event'] == 'recovery_transition' and
                                 e['previous_mode'] != 'incremental' for e in events), 1)
            self.assertFalse(any(e['event'] == 'tool_start' for e in events))
