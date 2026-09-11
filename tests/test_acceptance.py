"""Input-only planning and real HTTP acceptance gates; not model-quality evidence."""
import hashlib
import copy
import json
import shutil
import subprocess
import time
import unittest

from test_core import TempCase, FakeGateway, GREETING_FILES, response
from volo.acceptance import AcceptancePlan, validate
from volo.model import Model
from volo.requirements import RequirementSet


PAGES = [{'route': '/', 'checks': [{'kind': 'heading', 'name': 'Greeting'}]}]


@unittest.skipUnless(shutil.which('node'), 'Node required')
class AcceptanceTests(TempCase):
    def test_planning_does_not_receive_implementation_and_restores_without_model_call(self):
        self.workspace.write_files([{'path': 'private-implementation.js', 'content': 'do-not-send-this-source'}])
        requirements = RequirementSet.load(self.req)
        with FakeGateway([response([('define_ui_contract', {'pages': PAGES, 'coverage': ['Greeting is visible']})])]) as gateway:
            model = Model(gateway.url, 'synthetic-test-key', 'deepseek-v4-flash', self.trace)
            model.thinking = 'disabled'
            planner = AcceptancePlan(requirements, model, self.workspace)
            record = planner.prepare(requirements.nodes, {'observations': []}, guard_budget=lambda: None)
            self.assertNotIn('do-not-send-this-source', str(gateway.requests))
            self.assertEqual(gateway.requests[0]['tool_choice']['function']['name'], 'define_ui_contract')
            self.assertEqual(gateway.requests[0]['thinking'], {'type': 'disabled'})
            self.assertEqual(len(self.workspace.required_checks), 1)
            self.workspace.required_checks = []
            restored = AcceptancePlan(requirements, model, self.workspace)
            self.assertEqual(len(self.workspace.required_checks), 1)
            self.assertEqual(restored.prepare(requirements.nodes, {'observations': []}, guard_budget=lambda: None), record)
            self.assertEqual(model.usage.calls, 1)

    def test_invalid_plan_is_repaired_before_any_check_is_attached(self):
        invalid = copy.deepcopy(PAGES)
        invalid[0]['route'] = 'https://example.com'
        responses = [response([('define_ui_contract', {'pages': invalid, 'coverage': ['Greeting']})]),
                     response([('define_ui_contract', {'pages': PAGES, 'coverage': ['Greeting']})])]
        with FakeGateway(responses) as gateway:
            model = Model(gateway.url, 'synthetic-test-key', 'test-model', self.trace)
            planner = AcceptancePlan(RequirementSet.load(self.req), model, self.workspace)
            guards = []
            planner.prepare(RequirementSet.load(self.req).nodes, None, guard_budget=lambda: guards.append(True))
            self.assertEqual(len(guards), 2)
            self.assertEqual(len(self.workspace.required_checks), 1)
            self.assertIn('same-origin public paths', str(gateway.requests[1]['messages']))

    def test_contract_cannot_add_actions_and_literal_names_cannot_become_code(self):
        for kind in ('fill', 'click', 'evaluate', 'register'):
            with self.subTest(kind=kind), self.assertRaises(ValueError):
                validate([{'route': '/', 'checks': [{'kind': kind, 'name': 'Data'}]}])
        pages = copy.deepcopy(PAGES)
        pages[0]['checks'][0]['name'] = "');process.exit(0);//\\\"\n"
        with FakeGateway([response([('define_ui_contract', {'pages': pages, 'coverage': ['Literal heading']})])]) as gateway:
            model = Model(gateway.url, 'synthetic-test-key', 'test-model', self.trace)
            planner = AcceptancePlan(RequirementSet.load(self.req), model, self.workspace)
            record = planner.prepare(RequirementSet.load(self.req).nodes, None, guard_budget=lambda: None)
            self.assertIn(json.dumps(pages), record['script'])
            checked = subprocess.run(['node', '--check', '-'], input=record['script'], text=True, capture_output=True)
            self.assertEqual(checked.returncode, 0, checked.stderr)
            changed = {**record, 'script': record['script'] + '\nprocess.exit(0);'}
            changed['sha256'] = hashlib.sha256(changed['script'].encode()).hexdigest()
            with self.assertRaisesRegex(ValueError, 'Invalid cached'):
                planner.attach(changed)

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
