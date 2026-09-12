"""Calibrate gate mechanics with real HTTP and pinned, synthetic check suites."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch

from evaluation.gate import Gate, digest_file, tree_digest

HTTP_CHECK = """import json, os, urllib.request
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
with opener.open(os.environ['FACTORY_BASE_URL'], timeout=2) as response:
    body = response.read().decode()
print(json.dumps({'cases':[{'id':'greeting', 'status':'passed' if body == 'hello' else 'failed',
                           'evidence':'Observed HTTP body: ' + body}]}))
"""


class ExternalGateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='volo-gate-test-')
        self.base = Path(self.temp.name).resolve()
        self.candidate = self.base / 'candidate'
        self.requirements = self.base / 'requirements'
        self.suite = self.base / 'suite'
        for path in (self.candidate, self.requirements, self.suite):
            path.mkdir()
        (self.candidate / 'content.txt').write_text('hello')
        (self.candidate / 'self-check.py').write_text('raise AssertionError("not used by external acceptance")')
        (self.requirements / 'requirements.md').write_text('R1: HTTP response body must be exactly hello.')
        candidate = self.candidate
        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                body = (candidate / 'content.txt').read_bytes()
                self.send_response(200)
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            def log_message(self, *args):
                pass
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = f'http://127.0.0.1:{self.server.server_port}'

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temp.cleanup()

    def contract(self, script=HTTP_CHECK, mutate=None):
        path = self.suite / 'check.py'
        path.write_text(script)
        spec = {'schema_version': 1, 'requirements_sha256': tree_digest(self.requirements),
                'requirement_ids': ['R1'], 'cases': [{'id': 'greeting', 'requirement_ids': ['R1']}],
                'argv': [sys.executable, 'check.py'], 'files': {'check.py': digest_file(path)}}
        if mutate:
            mutate(spec)
        manifest = self.suite / 'manifest.json'
        manifest.write_text(json.dumps(spec))
        return manifest

    def evaluate(self, script=HTTP_CHECK, **kwargs):
        return Gate(self.contract(script)).evaluate(self.candidate, self.requirements, self.url, **kwargs)

    def emit(self, cases, *, exit_code=0):
        return 'import json\nprint(' + repr(json.dumps({'cases': cases})) + ')\nraise SystemExit(' + str(exit_code) + ')\n'

    def case(self, status='passed', **extra):
        return {'id': 'greeting', 'status': status, 'evidence': 'synthetic protocol fixture', **extra}

    def test_real_correct_app_accepted_wrong_app_rejected_even_with_weakened_self_checks(self):
        gate = Gate(self.contract())
        good = gate.evaluate(self.candidate, self.requirements, self.url)
        self.assertTrue(good['accepted'], good)
        self.assertEqual(good['verified_requirements'], ['R1'])
        self.assertEqual(good['official_evaluation'], 'not_run')
        (self.candidate / 'content.txt').write_text('wrong')
        wrong = gate.evaluate(self.candidate, self.requirements, self.url)
        self.assertFalse(wrong['accepted'])
        self.assertEqual(wrong['status'], 'failed')
        (self.candidate / 'self-check.py').write_text('raise SystemExit(0)')
        weakened = gate.evaluate(self.candidate, self.requirements, self.url)
        self.assertFalse(weakened['accepted'])
        self.assertEqual(weakened['cases'], wrong['cases'])
        self.assertEqual(weakened['contract_sha256'], wrong['contract_sha256'])
        self.assertNotEqual(weakened['candidate_sha256'], wrong['candidate_sha256'])

    def test_noop_and_empty_results_cannot_pass(self):
        for script in ['raise SystemExit(0)', self.emit([])]:
            with self.subTest(script=script):
                report = self.evaluate(script)
                self.assertFalse(report['accepted'])
                self.assertEqual(report['status'], 'error')
                self.assertEqual(report['verified_requirements'], [])

    def test_missing_duplicate_unknown_and_unsupported_results_rejected(self):
        malformed = [[self.case(), self.case()], [self.case(id='other')],
                     [self.case(status='success')], [self.case(evidence='')], [None]]
        for cases in malformed:
            with self.subTest(cases=cases):
                report = self.evaluate(self.emit(cases))
                self.assertFalse(report['accepted'])
                self.assertEqual(report['status'], 'error')

    def test_every_declared_case_must_run(self):
        def add_case(spec):
            spec['cases'].append({'id': 'second', 'requirement_ids': ['R1']})
        gate = Gate(self.contract(self.emit([self.case()]), add_case))
        report = gate.evaluate(self.candidate, self.requirements, self.url)
        self.assertIn('Missing declared', report['error'])
        self.assertFalse(report['accepted'])

    def test_skipped_and_error_are_incomplete_not_passed(self):
        for status in ('skipped', 'error'):
            report = self.evaluate(self.emit([self.case(status)]))
            self.assertFalse(report['accepted'])
            self.assertEqual(report['status'], 'incomplete')
            self.assertEqual(report['unverified_requirements'], ['R1'])

    def test_nonzero_exit_does_not_override_all_pass_report(self):
        report = self.evaluate(self.emit([self.case()], exit_code=1))
        self.assertFalse(report['accepted'])
        self.assertEqual(report['status'], 'error')

    def test_timeout_and_oversized_output_are_bounded_failures(self):
        timed = self.evaluate('import time\ntime.sleep(10)', timeout=0.1)
        self.assertIn('timed out', timed['error'])
        self.assertLess(timed['seconds'], 3)
        large = self.evaluate("print('x' * 1100000)")
        self.assertIn('output limit', large['error'])
        self.assertFalse(large['accepted'])

    def test_changed_pinned_checks_rejected_before_execution(self):
        gate = Gate(self.contract())
        (self.suite / 'check.py').write_text(self.emit([self.case()]))
        with patch.object(gate, '_run') as run:
            report = gate.evaluate(self.candidate, self.requirements, self.url)
        run.assert_not_called()
        self.assertIn('Pinned acceptance file changed', report['error'])

    def test_changed_requirements_rejected_before_execution(self):
        gate = Gate(self.contract())
        (self.requirements / 'requirements.md').write_text('R1: Must return something else.')
        with patch.object(gate, '_run') as run:
            report = gate.evaluate(self.candidate, self.requirements, self.url)
        run.assert_not_called()
        self.assertIn('Requirements snapshot', report['error'])

    def test_candidate_mutation_invalidates_result(self):
        script = 'from pathlib import Path\nPath(' + repr(str(self.candidate / 'content.txt')) + ").write_text('mutated')\n"
        report = self.evaluate(script + self.emit([self.case()]))
        self.assertFalse(report['accepted'])
        self.assertIn('candidate changed', report['error'])

    def test_suite_mutation_during_execution_invalidates_result(self):
        script = "from pathlib import Path\nPath('check.py').write_text('changed')\n" + self.emit([self.case()])
        report = self.evaluate(script)
        self.assertFalse(report['accepted'])
        self.assertIn('Pinned acceptance file changed', report['error'])

    def test_suite_inside_candidate_is_rejected(self):
        old = self.suite
        self.suite = self.candidate / 'checks'
        self.suite.mkdir()
        try:
            report = self.evaluate()
            self.assertIn('disjoint', report['error'])
        finally:
            self.suite = old

    def test_empty_contract_uncovered_requirement_and_symlink_rejected(self):
        for mutate in (lambda s: s.update(cases=[]), lambda s: s['requirement_ids'].append('R2')):
            with self.assertRaises(ValueError):
                Gate(self.contract(mutate=mutate))
        manifest = self.contract()
        (self.suite / 'check.py').unlink()
        (self.suite / 'check.py').symlink_to(self.candidate / 'self-check.py')
        with self.assertRaisesRegex(ValueError, 'symlink'):
            Gate(manifest)

    def test_duplicate_json_keys_and_missing_evidence_are_rejected(self):
        report = self.evaluate("print('{\"cases\": [], \"cases\": []}')")
        self.assertIn('Duplicate JSON', report['error'])
        report = self.evaluate(self.emit([{'id': 'greeting', 'status': 'passed'}]))
        self.assertIn('no evidence', report['error'])

    def test_model_credentials_and_process_injection_settings_are_not_inherited(self):
        script = """import json,os
assert not any(k in os.environ for k in ('OPENAI_API_KEY','NODE_OPTIONS','PYTHONPATH','ARC_BENCH_SESSION_COOKIE'))
print(json.dumps({'cases':[{'id':'greeting','status':'passed','evidence':'clean inherited environment'}]}))
"""
        gate = Gate(self.contract(script))
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'synthetic-secret', 'NODE_OPTIONS': '--invalid',
                                     'PYTHONPATH': '/nonexistent', 'ARC_BENCH_SESSION_COOKIE': 'synthetic-cookie'}):
            report = gate.evaluate(self.candidate, self.requirements, self.url)
        self.assertTrue(report['accepted'], report)

    def test_interpreter_invocation_preserves_virtual_environment(self):
        script = 'import sys\nassert sys.prefix == ' + repr(sys.prefix) + '\n'
        gate = Gate(self.contract(script + self.emit([self.case()])))
        self.assertEqual(gate.argv[0], sys.executable)
        report = gate.evaluate(self.candidate, self.requirements, self.url)
        self.assertTrue(report['accepted'], report)

    def test_cli_writes_evidence_outside_inputs(self):
        manifest = self.contract()
        output = self.base / 'report.json'
        result = subprocess.run([sys.executable, '-m', 'evaluation.gate', '--contract', str(manifest),
                                 '--candidate', str(self.candidate), '--requirements', str(self.requirements),
                                 '--base-url', self.url, '--output', str(output)],
                                capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertTrue(json.loads(output.read_text())['accepted'])
        self.assertEqual(json.loads(result.stdout)['contract_sha256'], digest_file(manifest))
