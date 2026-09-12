"""Positive/negative controls for trusted grading. Docker checks are explicit opt-in."""
import hashlib
import json
import os
import shutil
import tempfile
import unittest
from pathlib import Path

from harness_lab.evaluate import assess, evaluate, snapshot, load_contract

ROOT = Path(__file__).resolve().parents[1]


def contract():
    requirement = ROOT / 'examples/external-verifier/suite/requirements.txt'
    return {'schema_version': 1, 'requirements_file': 'requirements.txt',
            'requirements_sha256': hashlib.sha256(requirement.read_bytes()).hexdigest(),
            'provenance': 'Hand-authored calibration fixture, not official evaluation',
            'cases': ['greeting', 'grader-isolation'], 'candidate_argv': ['node', 'server.cjs'],
            'verifier_argv': ['python3', '/suite/check.py'], 'port': 3000}


class EvidenceTests(unittest.TestCase):
    def report(self, statuses=('passed',), names=('a',)):
        return json.dumps({'schema_version': 1, 'cases': [
            {'id': name, 'status': status} for name, status in zip(names, statuses)]})

    def test_exit_zero_without_executed_cases_cannot_pass(self):
        for raw in ('', '{}', '{"schema_version":1,"cases":[]}', 'done'):
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                assess(raw, ['a'], 0)

    def test_pass_fail_skip_and_process_error_are_distinct(self):
        for value, expected in [('passed', 'passed'), ('failed', 'failed'),
                                ('skipped', 'incomplete'), ('error', 'error')]:
            self.assertEqual(assess(self.report((value,)), ['a'], 0)['status'], expected)
        self.assertEqual(assess(self.report(), ['a'], 1)['status'], 'error')

    def test_missing_duplicate_unknown_cases_are_rejected(self):
        for raw, expected in [(self.report(), ['a', 'b']),
                              (self.report(('passed', 'passed'), ('a', 'a')), ['a', 'b']),
                              (self.report(names=('b',)), ['a'])]:
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                assess(raw, expected, 0)

    def test_snapshot_is_content_bound_and_rejects_symlinks(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            src = root / 'source'; src.mkdir()
            (src / 'app.py').write_text('hello')
            (src / '.env').write_text('not-for-export')
            a = snapshot(src, root / 'a')
            self.assertFalse((root / 'a/.env').exists())
            (src / 'app.py').write_text('wrong')
            b = snapshot(src, root / 'b')
            self.assertNotEqual(a['sha256'], b['sha256'])
            self.assertEqual((root / 'a/app.py').read_text(), 'hello')
            (src / 'link').symlink_to(root / 'a/app.py')
            with self.assertRaisesRegex(ValueError, 'Symlink'):
                snapshot(src, root / 'c')

    def test_modified_requirements_are_rejected_before_any_container_starts(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'requirements.txt').write_text('different original requirements')
            path = root / 'contract.json'; path.write_text(json.dumps(contract()))
            with self.assertRaisesRegex(ValueError, 'fingerprint'):
                load_contract(path)

    def test_contract_rejects_empty_cases_and_unbound_requirements(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'contract.json'
            shutil.copyfile(ROOT / 'examples/external-verifier/suite/requirements.txt', Path(tmp) / 'requirements.txt')
            for update in ({'cases': []}, {'requirements_sha256': ''}, {'port': True}):
                path.write_text(json.dumps({**contract(), **update}))
                with self.assertRaises(ValueError):
                    load_contract(path)


@unittest.skipUnless(os.getenv('HARNESS_TEST_IMAGE'), 'Set HARNESS_TEST_IMAGE to a local Node/Python image')
class IsolatedVerifierTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='volo-grade-test-')
        self.root = Path(self.tmp.name)
        self.app, self.suite = self.root / 'app', self.root / 'suite'
        shutil.copytree(ROOT / 'examples/external-verifier/candidate', self.app)
        shutil.copytree(ROOT / 'examples/external-verifier/suite', self.suite)
        (self.suite / 'contract.json').write_text(json.dumps(contract()))

    def tearDown(self):
        self.tmp.cleanup()

    def grade(self):
        result = evaluate(self.app, self.suite, os.environ['HARNESS_TEST_IMAGE'], timeout=60)
        self.assertEqual(result['cleanup_errors'], [], result)
        return result

    def test_correct_product_passes_outside_its_own_test_files(self):
        (self.app / 'checks').mkdir()
        (self.app / 'checks/self.cjs').write_text('process.exit(1)')
        result = self.grade()
        self.assertEqual(result['status'], 'passed', result)
        self.assertEqual(result['passed'], 2)
        self.assertEqual(result['official_evaluation'], 'not_run')
        proof = result['isolation_attestation']
        self.assertEqual(proof[0]['network'], 'none')
        self.assertEqual(proof[1]['bind_mounts'], [{'destination': '/suite', 'writable': False}])

    def test_weakening_self_tests_does_not_repair_wrong_product(self):
        source = self.app / 'server.cjs'
        source.write_text(source.read_text().replace("res.end('hello')", "res.end('wrong')"))
        (self.app / 'checks').mkdir()
        own = self.app / 'checks/self.cjs'
        own.write_text('process.exit(1)')
        first = self.grade()
        own.write_text('process.exit(0)')
        second = self.grade()
        self.assertEqual(first['status'], 'failed', first)
        self.assertEqual(second['status'], 'failed', second)
        self.assertEqual(first['cases'], second['cases'])
        self.assertEqual(first['suite']['sha256'], second['suite']['sha256'])
        self.assertNotEqual(first['candidate']['sha256'], second['candidate']['sha256'])

    def test_empty_grader_is_an_error_not_a_pass(self):
        (self.suite / 'check.py').write_text('raise SystemExit(0)')
        result = self.grade()
        self.assertEqual(result['status'], 'error', result)

    def test_timeout_is_an_error_and_containers_are_removed(self):
        (self.suite / 'check.py').write_text('import time; time.sleep(30)')
        result = evaluate(self.app, self.suite, os.environ['HARNESS_TEST_IMAGE'], timeout=5)
        self.assertEqual(result['status'], 'error', result)
        self.assertEqual(result['cleanup_errors'], [], result)
