"""Input-only planning and real HTTP acceptance gates; not model-quality evidence."""
import hashlib
import shutil
import time
import unittest

from test_core import TempCase, FakeGateway, GREETING_FILES, response
from volo.acceptance import AcceptancePlan
from volo.model import Model
from volo.requirements import RequirementSet


SCRIPT = "const {test,assert}=require('./acceptance-browser.cjs');test('visible greeting',async p=>{await p.getByText('hello',{exact:true}).waitFor();});"


@unittest.skipUnless(shutil.which('node'), 'Node required')
class AcceptanceTests(TempCase):
    def test_planning_does_not_receive_implementation_and_restores_without_model_call(self):
        self.workspace.write_files([{'path': 'private-implementation.js', 'content': 'do-not-send-this-source'}])
        requirements = RequirementSet.load(self.req)
        with FakeGateway([response([('define_checks', {'script': SCRIPT, 'coverage': ['Greeting is visible']})])]) as gateway:
            model = Model(gateway.url, 'synthetic-test-key', 'deepseek-v4-flash', self.trace)
            model.thinking = 'disabled'
            planner = AcceptancePlan(requirements, model, self.workspace)
            record = planner.prepare(requirements.nodes, {'observations': []}, guard_budget=lambda: None)
            self.assertNotIn('do-not-send-this-source', str(gateway.requests))
            self.assertEqual(gateway.requests[0]['tool_choice']['function']['name'], 'define_checks')
            self.assertEqual(gateway.requests[0]['thinking'], {'type': 'disabled'})
            self.assertEqual(len(self.workspace.required_checks), 1)
            self.workspace.required_checks = []
            restored = AcceptancePlan(requirements, model, self.workspace)
            self.assertEqual(len(self.workspace.required_checks), 1)
            self.assertEqual(restored.prepare(requirements.nodes, {'observations': []}, guard_budget=lambda: None), record)
            self.assertEqual(model.usage.calls, 1)

    def test_invalid_plan_is_repaired_before_any_check_is_attached(self):
        responses = [response([('define_checks', {'script': "// acceptance-browser.cjs\ntest('broken', =>", 'coverage': ['Greeting']})]),
                     response([('define_checks', {'script': SCRIPT, 'coverage': ['Greeting']})])]
        with FakeGateway(responses) as gateway:
            model = Model(gateway.url, 'synthetic-test-key', 'test-model', self.trace)
            planner = AcceptancePlan(RequirementSet.load(self.req), model, self.workspace)
            guards = []
            planner.prepare(RequirementSet.load(self.req).nodes, None, guard_budget=lambda: guards.append(True))
            self.assertEqual(len(guards), 2)
            self.assertEqual(len(self.workspace.required_checks), 1)
            self.assertIn('JavaScript syntax check failed', str(gateway.requests[1]['messages']))

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


if __name__ == '__main__':
    unittest.main()
