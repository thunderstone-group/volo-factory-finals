"""Real browser audit controls using public inputs; no model responses are supplied."""
import io
import json
import os
from pathlib import Path
import tempfile
import threading
from contextlib import redirect_stdout
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest import TestCase, skipUnless
from unittest.mock import patch

from harness_lab.public_answer_baseline import BINDINGS, fixed_answer, main
from test_core import FakeGateway
from test_small_acceptance import binding
from volo.small_acceptance import load_small_acceptance


class PublicAnswerEntryTests(TestCase):
    def test_classifier_response_actually_selects_the_product(self):
        for label in ('counter', 'dice'):
            with self.subTest(label=label), tempfile.TemporaryDirectory(prefix='public-router-control-') as temp:
                root = Path(temp).resolve()
                inputs = root / 'input'
                inputs.mkdir()
                fixture = Path(__file__).parent / 'fixtures/real-smoke-counter-input.json'
                for name, content in json.loads(fixture.read_text())['files'].items():
                    (inputs / name).write_text(content)
                # Labeled synthetic HTTP response, used only to validate routing.
                response = {'choices': [{'message': {'role': 'assistant', 'content': label}, 'finish_reason': 'stop'}],
                            'usage': {'prompt_tokens': 8, 'completion_tokens': 3, 'total_tokens': 11}}
                with FakeGateway([response]) as gateway, patch.dict(os.environ, {
                    'OPENAI_BASE_URL': gateway.url, 'OPENAI_API_KEY': 'synthetic-secret', 'MODEL': 'synthetic-model'}), redirect_stdout(io.StringIO()):
                    self.assertEqual(main([str(inputs), '--output-dir', str(root / 'app')], tiny_router=True), 0)
                    self.assertEqual(len(gateway.requests), 1)
                result = json.loads((root / 'app/.factory/security-reproduction.json').read_text())
                self.assertEqual(result['requested_task'], 'smoke--counter')
                self.assertEqual(result['task'], 'smoke--' + label)
                self.assertEqual(result['model_tokens'], 11)
                self.assertEqual(result['model_calls'], 1)
                self.assertEqual(result['model_role'], 'task_classifier')
                self.assertFalse(result['application_generated_by_model'])
                html = (root / 'app/frontend/public/index.html').read_text()
                self.assertIn('Increment' if label == 'counter' else 'Roll', html)

    def test_disclosed_entrypoint_makes_no_model_request_and_does_not_claim_test_pass(self):
        with tempfile.TemporaryDirectory(prefix='public-answer-control-') as temp, FakeGateway([]) as gateway:
            root = Path(temp).resolve()
            inputs = root / 'input'
            inputs.mkdir()
            fixture = Path(__file__).parent / 'fixtures/real-smoke-counter-input.json'
            for name, content in json.loads(fixture.read_text())['files'].items():
                (inputs / name).write_text(content)
            with patch.dict(os.environ, {'OPENAI_BASE_URL': gateway.url, 'OPENAI_API_KEY': 'synthetic-secret'}), redirect_stdout(io.StringIO()):
                self.assertEqual(main([str(inputs), '--output-dir', str(root / 'app')]), 0)
            self.assertEqual(gateway.requests, [])
            result = json.loads((root / 'app/.factory/security-reproduction.json').read_text())
            self.assertEqual(result['purpose'], 'authorized_security_reproduction')
            self.assertEqual(result['model_calls'], 0)
            self.assertEqual(result['model_tokens'], 0)
            self.assertEqual(result['official_evaluation'], 'pending')
            self.assertFalse(result['general_agent_capability_claimed'])
            self.assertNotIn('synthetic-secret', json.dumps(result))
            with self.assertRaises(ValueError):
                fixed_answer('unknown-task')


@skipUnless(os.getenv('FACTORY_TEST_PLAYWRIGHT_MODULE') and os.getenv('FACTORY_TEST_CHROMIUM_EXECUTABLE'),
            'Installed Playwright and browser required')
class PublicAnswerBrowserTests(TestCase):
    def test_all_four_fixed_answers_pass_the_unchanged_public_cases_locally(self):
        owner = self
        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                raw = owner.html.encode()
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Content-Length', str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)
            def log_message(self, *_):
                pass
        with tempfile.TemporaryDirectory(prefix='public-answer-browser-') as temp:
            root = Path(temp).resolve()
            server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                total = 0
                for task in BINDINGS.values():
                    with self.subTest(task=task):
                        self.html = fixed_answer(task)
                        suite = load_small_acceptance(binding(task), root / task)
                        result = suite.run('http://127.0.0.1:' + str(server.server_port),
                            suite.requirement_ids, timeout=35, extra_env={
                                'FACTORY_PLAYWRIGHT_MODULE': os.environ['FACTORY_TEST_PLAYWRIGHT_MODULE'],
                                'FACTORY_CHROMIUM_EXECUTABLE': os.environ['FACTORY_TEST_CHROMIUM_EXECUTABLE']})
                        self.assertTrue(result['passed'], result)
                        suite.assert_integrity()
                        total += len(result['cases'])
                self.assertEqual(total, 6)
            finally:
                server.shutdown()
                server.server_close()
                thread.join()
