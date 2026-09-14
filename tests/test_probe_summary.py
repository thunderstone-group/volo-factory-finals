"""Synthetic resource fixtures: these are not hosted runner measurements."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from harness_lab.probe_summary import read_records, summarize


class ProbeSummaryTests(unittest.TestCase):
    def test_v2_window_deltas_peak_and_processes(self):
        # Nonzero initial counters ensure that ratios describe this window.
        rows = [
            {'kind': 'boot', 'env': {'PORT': '3301'},
             'cgroup': {'v2': {'memory.max': '1073741824\n', 'cpu.max': '200000 100000\n'}}},
            {'kind': 'sample', 'ts_ms': 1000, 'memory.current': 100,
             'memory.events': {'oom_kill': 4},
             'cpu.stat': {'nr_periods': 100, 'nr_throttled': 90, 'throttled_usec': 9000000},
             'memory.pressure': {'some': 1.25, 'full': 0.5}},
            {'kind': 'sample', 'ts_ms': 2000, 'memory.current': 4096,
             'memory.events': {'oom_kill': 6},
             'cpu.stat': {'nr_periods': 110, 'nr_throttled': 92, 'throttled_usec': 9250000},
             'memory.pressure': {'some': 3.5, 'full': 0.25}},
            {'kind': 'procs', 'ts_ms': 1100, 'processes': []},
            {'kind': 'procs', 'ts_ms': 2100, 'processes': [
                {'pid': 9, 'rss_kb': 12, 'comm': 'node', 'cmdline': 'node server.cjs'},
                {'pid': 10, 'rss_kb': 100, 'comm': 'chrome', 'cmdline': '/opt/chrome --headless'},
                {'pid': 11, 'rss_kb': 30, 'comm': 'chromium', 'cmdline': '/opt/chromium --type=renderer'}]},
        ]
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / 'probe.jsonl'
            file.write_text(''.join(json.dumps(row) + '\n' for row in rows))
            result = subprocess.run([sys.executable, '-m', 'harness_lab.probe_summary', str(file)],
                                    capture_output=True, text=True, check=True)
        output = result.stdout
        self.assertEqual(result.stderr, '')
        for expected in ('env.PORT: 3301', 'cgroup.v2.memory.max: 1073741824',
                         'sample duration (s): 1', 'memory.current peak (bytes): 4096',
                         'memory.current peak ts_ms: 2000', 'oom_kill delta: 2',
                         'CPU throttled_usec / (nr_periods * period): 0.25',
                         'CPU nr_throttled / nr_periods: 0.2',
                         'memory.pressure some avg10 max: 3.5',
                         'nearest procs ts_ms: 2100', '  1100: 0', '  2100: 2'):
            self.assertIn(expected, output)
        self.assertLess(output.index('pid=10 '), output.index('pid=11 '))
        self.assertLess(output.index('pid=11 '), output.index('pid=9 '))

    def test_missing_fields_and_partial_line_are_tolerated(self):
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / 'probe.jsonl'
            self.assertIn('memory.current peak (bytes): n/a', summarize(read_records(file)))
            file.write_text('{"kind":"boot","env":null}\n'
                            '{"kind":"sample","cpu.stat":null}\n'
                            '{"kind":"procs","processes":null}\n{"kind":')
            output = summarize(read_records(file))
        for expected in ('env.PORT: n/a', 'cgroup.v2: n/a', 'sample duration (s): n/a',
                         'oom_kill delta: n/a', 'CPU nr_throttled / nr_periods: n/a',
                         'nearest procs ts_ms: n/a', '  n/a: n/a'):
            self.assertIn(expected, output)
