"""Provider-parameter regressions; synthetic transport only."""
import json
import unittest
from unittest.mock import patch
from urllib.error import URLError

from oneshot import main as adapter
from test_oneshot import SYNTHETIC_KEY, SyntheticStream, events


class ModelParametersCase(unittest.TestCase):
    def test_kimi_uses_its_required_temperature_and_retains_other_request_controls(self):
        captured = []

        def response(req, timeout):
            captured.append(json.loads(req.data))
            return SyntheticStream(events('synthetic answer'))

        with patch.object(adapter, '_open_model', side_effect=response):
            for model in ('qwen3.7-plus', 'kimi-k2.7-code', 'kimi-k2.7-code-highspeed'):
                adapter.stream_completion([], model, 'https://synthetic.invalid/v1', SYNTHETIC_KEY,
                                          adapter.CallBudget(limit=1, fail_limit=1), tries=1)
        self.assertEqual([r['temperature'] for r in captured], [0.0, 1.0, 1.0])
        for payload in captured:
            self.assertEqual(payload['max_tokens'], adapter.MAX_TOKENS)
            self.assertEqual(payload['stream_options'], {'include_usage': True})
            self.assertNotIn('thinking', payload)

    def test_kimi_transport_failure_does_not_silently_switch_models(self):
        with patch.object(adapter, '_open_model', side_effect=URLError('synthetic failure')) as request, \
                patch.object(adapter, 'fallback_model', return_value='qwen3.7-plus'):
            budget = adapter.CallBudget(limit=3, fail_limit=5)
            with self.assertRaises(RuntimeError):
                adapter.stream_completion([], 'kimi-k2.7-code', 'https://synthetic.invalid/v1',
                                          SYNTHETIC_KEY, budget, tries=1)
            self.assertEqual(request.call_count, 1)
            self.assertIsNone(budget.model)


if __name__ == '__main__':
    unittest.main()
