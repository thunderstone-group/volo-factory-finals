"""Synthetic gateway plus real Node parser and extracted CLI, never app execution."""
import contextlib
import copy
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch
import zipfile
from oneshot import main as core, skill_repair as sr
from oneshot.v2 import main as v2
from oneshot.thin import entry, checks, review
from scripts.package_thin import build, FILES
from test_oneshot import block, events, SyntheticStream
from test_skill_repair import SyntheticGateway, completion

REQ = 'Users can change record titles and the saved title must be retained after reopening.'
SOURCE = 'const title = "old";\n'
PATH = 'frontend/public/app.js'
KEY = 'synthetic-thin-key'


def finding():
    return {'schema': 1, 'findings': [{'kind': 'defect', 'requirement': REQ,
            'observation': 'Synthetic title is fixed rather than using saved state.',
            'evidence': [{'path': PATH, 'quote': SOURCE.strip()}]}]}


def proposal(after='new'):
    return {'edits': [{'path': PATH, 'before_sha256': sr.sha256(SOURCE.encode()),
                      'old': '"old"', 'new': json.dumps(after)}]}


class ThinTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir=Path(tempfile.gettempdir()).resolve())
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.app = self.root/'app'; self.app.mkdir(); v2.starter(self.app)
        (self.app/PATH).write_text(SOURCE)
        self.paths = sorted(core.read_template(self.app))
        self.source = sr.load_source(self.app, self.paths)
        self.req = self.root/'requirements'; self.req.mkdir()
        (self.req/'requirements.md').write_text(REQ)
        (self.req/'test.spec.js').write_text('OFFICIAL_SENTINEL_NEVER_READ')

    def invoke(self, responses, generation=SOURCE):
        gateway = SyntheticGateway(responses)
        out = self.root/'platform'; (out/'.arc').mkdir(parents=True)
        (out/'.arc/events').write_text('runner-owned')
        captured = io.StringIO()
        with patch.dict(os.environ, {'OPENAI_API_KEY': KEY, 'MODEL': 'deepseek-v4-flash'}), \
             patch.object(core, '_open_model', return_value=SyntheticStream(events(block(PATH, generation)))), \
             patch.object(sr, '_open_model', side_effect=gateway), \
             contextlib.redirect_stdout(captured), contextlib.redirect_stderr(captured):
            code = entry.main([str(self.req), '--output-dir', str(out), '--type', 'web'])
        final = [line for line in captured.getvalue().splitlines()
                 if line.startswith('[thin] ') and '"stage": "finished"' in line][-1]
        state = json.loads(final[len('[thin] '):])
        self.assertNotIn(KEY, captured.getvalue())
        self.assertNotIn('OFFICIAL_SENTINEL_NEVER_READ', str(gateway.requests))
        self.assertEqual((out/'.arc/events').read_text(), 'runner-owned')
        return code, out, state, gateway

    def test_real_parser_detects_invalid_javascript(self):
        (self.app/PATH).write_text('function broken( {')
        result = checks.check(self.app)
        self.assertEqual(result['status'], 'product_fail')
        self.assertTrue(any('SyntaxError' in r['detail'] for r in result['checks']))
        self.assertFalse(result['runtime_executed'])
        self.assertFalse(result['browser_executed'])

    def test_inline_script_and_missing_local_reference_checked(self):
        index = self.app/'frontend/public/index.html'
        index.write_text('<html><script>function broken( {</script><script src="missing.js"></script></html>')
        result = checks.check(self.app)
        self.assertEqual(result['status'], 'product_fail')
        failures = [r['id'] for r in result['checks'] if r['status'] == 'product_fail']
        self.assertTrue(any('#inline-' in name for name in failures))
        self.assertTrue(any('script-ref:' in name for name in failures))

    def test_parser_environment_never_inherits_model_credentials(self):
        calls = []
        def process(*args, **kwargs):
            calls.append(kwargs['env'])
            return {'exit_code': 0, 'output': ''}
        with patch.dict(os.environ, {'OPENAI_API_KEY': KEY, 'NODE_OPTIONS': '--require=hostile'}), \
             patch.object(checks, '_process', side_effect=process):
            result = checks.check(self.app, node=sys.executable)
        self.assertEqual(result['status'], 'pass')
        self.assertTrue(calls)
        for environment in calls:
            self.assertNotIn('NODE_OPTIONS', environment)
            self.assertNotIn('OPENAI_API_KEY', environment)

    def test_missing_node_is_environment_not_product(self):
        with patch.object(checks.shutil, 'which', return_value=None), patch.object(checks, '_process') as process:
            result = checks.check(self.app)
        self.assertEqual(result['status'], 'environment_error')
        process.assert_not_called()

    def test_omission_requires_requirement_not_already_present_label(self):
        value = finding(); value['findings'][0].update(kind='omission', evidence=[],
                     observation='Synthetic required persistence is entirely absent from the supplied source.')
        self.assertEqual(len(review.validate(value, REQ, self.source)), 1)

    def test_review_rejects_fabricated_requirement_source_and_extra_code(self):
        for modify in (lambda f: f.update(requirement='Unsupported external requirement'),
                       lambda f: f['evidence'][0].update(quote='invented source snippet'),
                       lambda f: f['evidence'][0].update(path='../outside.js'),
                       lambda f: f.update(execute='arbitrary code')):
            value = finding(); modify(value['findings'][0])
            with self.subTest(value=value), self.assertRaises(ValueError):
                review.validate(value, REQ, self.source)

    def test_grounded_review_patch_recheck_actual_entry(self):
        code, out, state, gateway = self.invoke([completion(json.dumps(finding())),
            completion(json.dumps(proposal())), completion('{"schema":1,"findings":[]}')])
        self.assertEqual(code, 0)
        self.assertTrue(state['static_accepted'])
        self.assertEqual(state['review_calls'], 2)
        self.assertEqual(state['repair_calls'], 1)
        self.assertEqual((out/PATH).read_text(), SOURCE.replace('old', 'new'))
        self.assertEqual((out/'.volo-thin/A0'/PATH).read_text(), SOURCE)
        self.assertEqual(state['verified_requirements'], [])
        self.assertFalse(state['browser_executed'])
        payload = gateway.requests[1][2]
        self.assertEqual(payload['reasoning_effort'], 'low')
        self.assertEqual(json.loads(payload['messages'][1]['content'])['requirements'], REQ)
        self.assertIn('skill_index', json.loads(payload['messages'][1]['content']))

    def test_no_findings_has_no_repair(self):
        code, out, state, gateway = self.invoke([completion('{"schema":1,"findings":[]}')])
        self.assertEqual(code, 0)
        self.assertFalse(state['static_accepted'])
        self.assertEqual(state['repair_calls'], 0)
        self.assertEqual(len(gateway.requests), 1)

    def test_repair_rejection_preserves_a0(self):
        invalid = proposal(); invalid['edits'][0]['before_sha256'] = 'b'*64
        code, out, state, gateway = self.invoke([completion(json.dumps(finding())), completion(json.dumps(invalid))])
        self.assertEqual(code, 0)
        self.assertEqual(state['status'], 'model_error')
        self.assertEqual((out/PATH).read_text(), SOURCE)

    def test_syntax_regression_not_published(self):
        invalid = proposal(); invalid['edits'][0]['new'] = 'function ('
        code, out, state, _ = self.invoke([completion(json.dumps(finding())), completion(json.dumps(invalid))])
        self.assertEqual(code, 0)
        self.assertEqual(state['status'], 'candidate_rejected_by_static_checks')
        self.assertEqual((out/PATH).read_text(), SOURCE)

    def test_later_review_error_keeps_static_accepted_partial(self):
        code, out, state, _ = self.invoke([completion(json.dumps(finding())),
            completion(json.dumps(proposal())), completion('not JSON')])
        self.assertEqual(code, 0)
        self.assertTrue(state['static_accepted'])
        self.assertEqual(state['status'], 'review_unavailable')
        self.assertEqual((out/PATH).read_text(), SOURCE.replace('old', 'new'))

    def test_invalid_a0_without_repair_not_reported_delivered(self):
        code, out, state, _ = self.invoke([completion('not JSON'), completion('not JSON')], generation='function broken( {')
        self.assertEqual(code, 1)
        self.assertFalse(state['delivered'])
        self.assertFalse((out/PATH).exists())

    def test_packaging_allowlist_and_reproducibility(self):
        first = self.root/'first.zip'; second = self.root/'second.zip'
        manifest = build(first); build(second)
        self.assertEqual(first.read_bytes(), second.read_bytes())
        with zipfile.ZipFile(first) as archive:
            self.assertEqual(set(archive.namelist()), set(FILES)|{
                'oneshot/__init__.py', 'oneshot/v1/__init__.py', 'oneshot/v2/__init__.py'})
            self.assertFalse(any('v3/' in name or 'tests/' in name or 'runs/' in name for name in archive.namelist()))
            self.assertIn('oneshot/skill_repair.py', archive.namelist())
        self.assertEqual(sr.sha256(first.read_bytes()), manifest['package_sha256'])
        with self.assertRaises(ValueError): build(first)
