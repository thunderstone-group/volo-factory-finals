"""No network calls: adapter validation and exact event accounting."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from harness_lab.pi_adapter import prepare_pi, summarize_events


class PiAdapterTests(unittest.TestCase):
    def test_only_terminal_assistant_usage_is_counted(self):
        message = {'role': 'assistant', 'usage': {'totalTokens': 120}}
        events = [{'type': 'message_update', 'message': message},
                  {'type': 'message_end', 'message': message},
                  {'type': 'agent_end', 'messages': [message]}]
        self.assertEqual(summarize_events(events)['reported_total_tokens'], 120)
        self.assertIsNone(summarize_events([{'type': 'message_end', 'message': {'role': 'assistant'}}])['reported_total_tokens'])
        self.assertIsNone(summarize_events(events)['billed_cost'])

    def test_foreign_gateway_is_rejected_before_launch(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); work = root / 'app'; work.mkdir()
            for url in ('https://example.org/v1', 'http://api.arc-bench.com/v1',
                        'https://api.arc-bench.com/v1?secret=x', 'https://key@api.arc-bench.com/v1'):
                with self.subTest(url=url), self.assertRaises(ValueError):
                    prepare_pi(work, root / 'home', gateway=url, model='fixture', api_key='test')
            self.assertFalse((root / 'home').exists())

    def test_fresh_config_no_secret_on_disk_and_no_inherited_provider_auth(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); work = root / 'app'; work.mkdir()
            with patch('harness_lab.pi_adapter.shutil.which', return_value='/usr/bin/pi'), \
                 patch('harness_lab.pi_adapter.subprocess.run') as run, \
                 patch.dict('os.environ', {'OPENAI_API_KEY': 'do-not-inherit', 'NODE_OPTIONS': 'do-not-inherit'}):
                run.return_value.stdout = '0.83.0\n'
                invocation = prepare_pi(work, root / 'home', gateway='http://127.0.0.1:1234/v1',
                                        model='fixture', api_key='fixture-key')
            self.assertNotIn('OPENAI_API_KEY', invocation.env)
            self.assertNotIn('NODE_OPTIONS', invocation.env)
            self.assertNotIn('fixture-key', ' '.join(invocation.argv))
            self.assertIn('--no-extensions', invocation.argv)
            content = (root / 'home/agent/models.json').read_text()
            self.assertNotIn('fixture-key', content)
            self.assertEqual(json.loads(content)['providers']['arcbench']['apiKey'], '$HARNESS_MODEL_KEY')
