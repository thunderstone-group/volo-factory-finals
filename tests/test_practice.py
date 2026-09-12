"""Real browser acceptance with synthetic raw-completion transport for the practice branch."""
import json
import os
from pathlib import Path
import unittest

from test_core import TempCase, FakeGateway, GREETING_FILES, response
from volo.model import Model
from volo.practice import PracticeAgent
from volo.requirements import RequirementSet
from volo.small_acceptance import load_small_acceptance
from volo.trace import Runtime
from volo.web_runtime import scaffold


FIXTURES = Path(__file__).parent / 'fixtures'
COUNTER = json.loads((FIXTURES / 'real-smoke-counter-qwen.json').read_text())['index_html'].replace(
    'id="count"', 'id="count" data-testid="count"')


def completion(content):
    return {'choices': [{'message': {'role': 'assistant', 'content': content}, 'finish_reason': 'stop'}],
            'usage': {'prompt_tokens': 100, 'completion_tokens': 50, 'total_tokens': 150}}


@unittest.skipUnless(os.getenv('FACTORY_TEST_PLAYWRIGHT_MODULE') and os.getenv('FACTORY_TEST_CHROMIUM_EXECUTABLE'),
                     'Installed Playwright and Chrome required')
class PracticeTests(TempCase):
    def configure(self, fixture):
        for name, content in json.loads((FIXTURES / fixture).read_text())['files'].items():
            (self.req / name).write_text(content)
        requirements = RequirementSet.load(self.req)
        self.workspace.acceptance_suite = load_small_acceptance(requirements, self.out)
        self.workspace.runtime_env = {
            'FACTORY_PLAYWRIGHT_MODULE': os.environ['FACTORY_TEST_PLAYWRIGHT_MODULE'],
            'FACTORY_CHROMIUM_EXECUTABLE': os.environ['FACTORY_TEST_CHROMIUM_EXECUTABLE']}
        return requirements

    def test_raw_html_is_generated_then_independently_checked(self):
        requirements = self.configure('real-smoke-counter-input.json')
        with FakeGateway([completion(COUNTER)]) as gateway:
            model = Model(gateway.url, 'synthetic-key', 'synthetic-model', self.trace)
            result = PracticeAgent(requirements, model, self.workspace, Runtime(self.trace)).run()
            self.assertEqual(result['verified_requirements'], ['REQ-1'])
            self.assertEqual(gateway.requests[0]['tools'], [])
            self.assertEqual(gateway.requests[0]['max_tokens'], 2048)
            self.assertIn(requirements.nodes[0]['description'], gateway.requests[0]['messages'][1]['content'])
            self.assertFalse((self.out / 'checks/requirements.cjs').exists())

    def test_short_edits_preserve_old_behavior_and_reject_unknown_file_keys(self):
        requirements = self.configure('real-evolution-counter-input.json')
        scaffold(self.workspace)
        self.workspace.write_files([{'path': 'frontend/public/index.html', 'content': COUNTER}])
        new = '<button onclick="count=0;updateDisplay()">Reset</button></body>'
        malformed = json.loads((FIXTURES / 'real-practice-nested-edits.json').read_text())['content']
        answers = [completion(malformed), *[completion(json.dumps([
            {'file': key, 'old': '</body>', 'new': new}])) for key in ('outside', 'h')]]
        with FakeGateway(answers) as gateway:
            model = Model(gateway.url, 'synthetic-key', 'synthetic-model', self.trace)
            result = PracticeAgent(requirements, model, self.workspace, Runtime(self.trace)).run()
            self.assertEqual(result['verified_requirements'], ['REQ-1', 'REQ-2'])
            self.assertEqual(len(gateway.requests), 3)
            prompt = gateway.requests[0]['messages'][1]['content']
            self.assertIn(requirements.nodes[1]['description'], prompt)
            self.assertNotIn(requirements.nodes[0]['description'], prompt)
            self.assertIn('no nested arrays', gateway.requests[1]['messages'][-1]['content'])
            self.assertIn('existing file key', gateway.requests[2]['messages'][-1]['content'])
        events = [json.loads(line) for line in (self.trace.directory / 'events.jsonl').read_text().splitlines()]
        self.assertTrue(next(e for e in events if e['event'] == 'practice_existing_behavior')['passed'])

    def test_unbound_requirements_use_the_general_agent(self):
        requirements = RequirementSet.load(self.req)
        self.assertIsNone(self.workspace.acceptance_suite)
        answer = response([('build_app', {'index_html': 'hello', 'checks_js': GREETING_FILES[-1]['content']})])
        with FakeGateway([answer]) as gateway:
            model = Model(gateway.url, 'synthetic-key', 'synthetic-model', self.trace)
            result = PracticeAgent(requirements, model, self.workspace, Runtime(self.trace)).run()
            self.assertEqual(result['status'], 'completed')
            self.assertEqual(result['verified_requirements'], [])
            self.assertTrue(gateway.requests[0]['tools'])
