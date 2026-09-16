"""Synthetic subprocess failures for the experiment wrapper; no external calls."""
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from scripts.arc_read import read_json, redact


class ArcReadTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.log = Path(self.temp.name) / 'diagnostics.jsonl'
        self.sleep = patch('scripts.arc_read.time.sleep').start()
        self.addCleanup(patch.stopall)

    def test_failed_attempt_retained_even_when_retry_succeeds(self):
        results = [subprocess.CompletedProcess([], 4, 'partial', 'HTTP 502 key=synthetic-secret'),
                   subprocess.CompletedProcess([], 0, '{"available_balance":"1"}', '')]
        with patch('scripts.arc_read.subprocess.run', side_effect=results):
            self.assertEqual(read_json(['cli'], ['balance'], self.log, secrets=['synthetic-secret'])['available_balance'], '1')
        rows = [json.loads(x) for x in self.log.read_text().splitlines()]
        self.assertEqual([r['exit_code'] for r in rows], [4, 0])
        self.assertIn('HTTP 502', rows[0]['stderr'])
        self.assertNotIn('synthetic-secret', self.log.read_text())
        self.assertEqual(self.log.stat().st_mode & 0o777, 0o600)

    def test_timeout_bytes_and_invalid_json_are_preserved(self):
        results = [subprocess.TimeoutExpired(['cli'], 35, output=b'partial', stderr=b'Bearer synthetic'),
                   subprocess.CompletedProcess([], 0, '<html>broken</html>', '')]
        with patch('scripts.arc_read.subprocess.run', side_effect=results), self.assertRaisesRegex(RuntimeError, 'JSONDecodeError'):
            read_json(['cli'], ['balance'], self.log, attempts=2)
        rows = [json.loads(x) for x in self.log.read_text().splitlines()]
        self.assertEqual(rows[0]['error_type'], 'TimeoutExpired')
        self.assertEqual(rows[0]['stdout'], 'partial')
        self.assertNotIn('synthetic', rows[0]['stderr'])
        self.assertEqual(rows[1]['stdout'], '<html>broken</html>')

    def test_token_usage_counts_remain_visible(self):
        self.assertEqual(redact('{"tokens":123,"prompt_tokens":456}'), '{"tokens":123,"prompt_tokens":456}')
        self.assertNotIn('sensitive', redact('{"access_token":"sensitive"}'))

    def test_mutations_cannot_use_read_retry_helper(self):
        with patch('scripts.arc_read.subprocess.run') as call, self.assertRaises(ValueError):
            read_json(['cli'], ['run', 'id'], self.log)
        call.assert_not_called()
