"""Real HTTP controls for preserving a failed check across attempted test weakening."""
import shutil
import unittest

from test_core import TempCase
from volo.web_runtime import scaffold, implement

HTTP_CHECK = """const assert=require('node:assert/strict');
fetch(process.env.FACTORY_BASE_URL).then(r=>r.text()).then(text=>assert.equal(text,'hello'));
"""


@unittest.skipUnless(shutil.which('node') and shutil.which('npm'), 'Node/npm required')
class CapturedSelfCheckTests(TempCase):
    def test_weakening_current_check_cannot_repair_product_but_source_correction_can(self):
        scaffold(self.workspace)
        self.workspace.retain_failed_prepared_checks = True
        initial = implement(self.workspace, 'wrong', '', HTTP_CHECK)
        self.assertFalse(initial['passed'])
        self.assertFalse(initial['retained_self_check']['independently_verified'])
        captured = self.workspace.required_checks[0]
        self.workspace.write_files([{'path': 'checks/requirements.cjs', 'content': 'process.exit(0);'}])
        command = ['node', '--test', 'checks/requirements.cjs']
        rejected = self.workspace.verify(command)
        self.assertFalse(rejected['passed'])
        self.assertEqual(rejected['executed_checks'], [captured['argv']])
        self.workspace.edit('frontend/public/index.html', 'wrong', 'hello')
        accepted = self.workspace.verify(command)
        self.assertTrue(accepted['passed'])
        self.assertEqual(accepted['acceptance']['verified_requirements'], [])
        self.assertEqual(accepted['verification_scope'], 'local_checks_only')

    def test_new_batch_releases_captured_checks_but_preserves_operator_checks(self):
        scaffold(self.workspace)
        self.workspace.retain_failed_prepared_checks = True
        implement(self.workspace, 'wrong', '', HTTP_CHECK)
        captured = self.workspace.required_checks[0]
        operator = {'argv': ['node', 'external.cjs'], 'files': {}}
        self.workspace.required_checks.append(operator)
        self.workspace.clear_prepared_check_guards()
        self.assertEqual(self.workspace.required_checks, [operator])
        self.assertFalse(self.workspace.retain_failed_prepared_checks)
        self.assertTrue((self.out / captured['argv'][-1]).is_file())

    def test_syntax_error_is_not_frozen_as_a_product_contract(self):
        scaffold(self.workspace)
        self.workspace.retain_failed_prepared_checks = True
        result = implement(self.workspace, 'hello', '', 'if (')
        self.assertFalse(result['passed'])
        self.assertNotIn('retained_self_check', result)
        self.assertEqual(self.workspace.required_checks, [])
