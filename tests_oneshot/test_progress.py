"""Live transport observability with synthetic streams; no network or model calls."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from oneshot import main as adapter
from test_oneshot import SYNTHETIC_KEY, SyntheticStream, application, event, events


class ProgressCase(unittest.TestCase):
    def test_progress_distinguishes_connection_and_reasoning_without_logging_content(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'progress.json'
            budget = adapter.CallBudget(draft_limit=1, fail_limit=1)
            budget.progress_path = path
            testcase = self

            class ObservedStream(SyntheticStream):
                def __enter__(self):
                    testcase.assertEqual(json.loads(path.read_text())['phase'], 'connecting')
                    return self

                def __iter__(self):
                    testcase.assertEqual(json.loads(path.read_text())['phase'], 'response_opened')
                    yield event({'choices': [{'delta': {'reasoning_content': 'private reasoning'}}]})
                    live = json.loads(path.read_text())
                    testcase.assertEqual(live['phase'], 'receiving')
                    testcase.assertEqual(live['stream']['reasoning_chars'], len('private reasoning'))
                    testcase.assertEqual(live['stream']['content_chars'], 0)
                    yield from events('private answer', {'prompt_tokens': 12, 'completion_tokens': 8})

            with patch.object(adapter, '_open_model', return_value=ObservedStream([])):
                content, _, _ = adapter.stream_completion(
                    [{'role': 'user', 'content': 'private prompt'}], 'synthetic-model',
                    'https://synthetic.invalid/v1', SYNTHETIC_KEY, budget, tries=1)
            self.assertEqual(content, 'private answer')
            raw = path.read_text()
            report = json.loads(raw)
            self.assertEqual(report['phase'], 'completed')
            self.assertEqual(report['stream']['content_chars'], len(content))
            self.assertEqual(report['usage'], {'prompt_tokens': 12, 'completion_tokens': 8})
            for secret in (SYNTHETIC_KEY, 'private prompt', 'private answer', 'private reasoning'):
                self.assertNotIn(secret, raw)

    def test_interrupted_stream_retains_partial_counts_and_failure_type(self):
        with tempfile.TemporaryDirectory() as temp:
            budget = adapter.CallBudget(draft_limit=1, fail_limit=1)
            budget.progress_path = Path(temp) / 'progress.json'
            frames = [event({'choices': [{'delta': {'content': 'partial content'}}]}),
                      OSError('synthetic interruption')]
            with patch.object(adapter, '_open_model', return_value=SyntheticStream(frames)):
                with self.assertRaises(RuntimeError):
                    adapter.stream_completion([], 'synthetic-model', 'https://synthetic.invalid/v1',
                                              SYNTHETIC_KEY, budget, tries=1)
            report = json.loads(budget.progress_path.read_text())
            self.assertEqual(report['phase'], 'call_failed')
            self.assertEqual(report['error_type'], 'OSError')
            self.assertEqual(report['stream']['content_chars'], len('partial content'))
            self.assertEqual(report['completed_calls'], 0)

    def test_generation_progress_is_staged_without_becoming_application_source(self):
        with tempfile.TemporaryDirectory() as temp:
            out = Path(temp) / 'application'
            budget = adapter.CallBudget(draft_limit=1, fail_limit=1)

            def response(req, timeout):
                self.assertEqual(budget.progress_path.parent.parent, out.parent)
                self.assertTrue(budget.progress_path.is_file())
                self.assertEqual(json.loads(budget.progress_path.read_text())['phase'], 'connecting')
                return SyntheticStream(events(application()))

            with patch.object(adapter, '_open_model', side_effect=response), \
                    patch.object(adapter, 'SMOKE', False), patch.object(adapter, 'SCAFFOLD', False):
                adapter.generate('Synthetic requirements', 'synthetic-model',
                                 'https://synthetic.invalid/v1', SYNTHETIC_KEY, out, budget)
            self.assertFalse(budget.progress_path.exists())
            self.assertFalse(list(out.rglob('progress.json')))


if __name__ == '__main__':
    unittest.main()
