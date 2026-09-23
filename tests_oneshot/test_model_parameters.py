"""Provider-parameter regressions; synthetic transport only."""
import json
import os
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
                                          adapter.CallBudget(draft_limit=1, fail_limit=1), tries=1)
        self.assertEqual([r['temperature'] for r in captured], [0.0, 1.0, 1.0])
        for payload in captured:
            self.assertEqual(payload['max_tokens'], adapter.MAX_TOKENS)
            self.assertEqual(payload['stream_options'], {'include_usage': True})
            self.assertNotIn('thinking', payload)

    def fallback_run(self, model, environment):
        """Three synthetic transport failures on `model`, then one answer; returns (model, temperature) per request."""
        captured = []

        def response(req, timeout):
            payload = json.loads(req.data)
            captured.append((payload['model'], payload['temperature']))
            if len(captured) <= 3:
                raise URLError('synthetic failure')
            return SyntheticStream(events('synthetic answer'))

        with patch.object(adapter, '_open_model', side_effect=response), patch.object(adapter.time, 'sleep'), \
                patch.dict(os.environ, environment):
            if 'FALLBACK_MODEL' not in environment:
                os.environ.pop('FALLBACK_MODEL', None)
            budget = adapter.CallBudget()
            try:
                adapter.stream_completion([], model, 'https://synthetic.invalid/v1', SYNTHETIC_KEY, budget)
            except RuntimeError:
                pass
        return captured, budget

    def test_transport_fallback_pairs_flash_and_kimi_with_the_fallback_models_own_parameters(self):
        # Owner's decision (09-23): flash falls back to Kimi HighSpeed and a Kimi primary to flash. Kimi was
        # previously exempt, so a cut Kimi route zeroed the task; each model keeps its own temperature.
        captured, budget = self.fallback_run('deepseek-v4-flash', {})
        self.assertEqual(captured, [('deepseek-v4-flash', 0.0)] * 3 + [('kimi-k2.7-code-highspeed', 1.0)])
        self.assertEqual(budget.summary()['fallback_model'], 'kimi-k2.7-code-highspeed')
        for kimi in ('kimi-k2.7-code-highspeed', 'kimi-k2.7-code'):
            with self.subTest(model=kimi):
                captured, budget = self.fallback_run(kimi, {})
                self.assertEqual(captured, [(kimi, 1.0)] * 3 + [('deepseek-v4-flash', 0.0)])
                self.assertEqual(budget.summary()['fallback_model'], 'deepseek-v4-flash')

    def test_fallback_model_environment_overrides_or_disables_the_pairing(self):
        captured, _ = self.fallback_run('kimi-k2.7-code-highspeed', {'FALLBACK_MODEL': 'qwen3.7-plus'})
        self.assertEqual(captured[-1], ('qwen3.7-plus', 0.0))
        captured, budget = self.fallback_run('kimi-k2.7-code-highspeed', {'FALLBACK_MODEL': ''})
        self.assertEqual(captured, [('kimi-k2.7-code-highspeed', 1.0)] * 3)
        self.assertIsNone(budget.model)


if __name__ == '__main__':
    unittest.main()
