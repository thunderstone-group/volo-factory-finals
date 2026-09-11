"""Real execution and externally supplied fixed-check invariants."""
import hashlib
import shutil
import unittest

from test_core import TempCase, GREETING_FILES


class FixedCheckTests(TempCase):
    @unittest.skipUnless(shutil.which('npm'), 'npm required')
    def test_new_fixed_contract_blocks_stale_success_repairs_app_and_rejects_tampering(self):
        self.workspace.write_files(GREETING_FILES)
        command = ['node', 'checks/greeting.cjs']
        self.assertTrue(self.workspace.verify(command)['passed'])
        path = self.trace.directory / 'fixed-http.cjs'
        script = "fetch(process.env.FACTORY_BASE_URL).then(r=>require('node:assert/strict').equal(r.headers.get('x-verified'),'yes'));"
        path.write_text(script)
        self.workspace.required_checks = [{'argv': ['node', str(path.relative_to(self.out.resolve()))],
            'files': {str(path.relative_to(self.out.resolve())): hashlib.sha256(script.encode()).hexdigest()}}]
        failure = self.workspace.verify(command)
        self.assertFalse(failure['passed'])
        self.assertEqual(failure['executed_checks'], [self.workspace.required_checks[0]['argv']])
        self.workspace.edit('backend/server.cjs', "(q,s)=>s.end('hello')",
                            "(q,s)=>{s.setHeader('X-Verified','yes');s.end('hello')}")
        self.assertTrue(self.workspace.verify(command)['passed'])
        path.write_text('process.exit(0)')
        with self.assertRaisesRegex(ValueError, 'removed or changed'):
            self.workspace.verify(command)
        self.assertIsNone(self.workspace.last_verification)

