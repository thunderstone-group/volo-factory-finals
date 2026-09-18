"""The frozen-self-check dead end and the browser-availability gate.

Model transport here is synthetic; the Node checks, server and verification are real.
Reproduces two observed losses: the nav-race first generation, where a frozen check
called assert(locator).toBeVisible() and no product repair could satisfy it, and the
local gate that scored a generation produced without a browser.
See docs/archive/legacy-harness/selfcheck-deadend-2026-09-14.md.
"""
import json
import shutil
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from test_core import TempCase, FakeGateway
from harness_lab.local_gate import GateRefused, browser_availability, gate
from volo.agent import Agent
from volo.model import Model
from volo.requirements import RequirementSet
from volo.trace import Runtime
from volo.web_runtime import scaffold, implement
from volo.workspace import check_defect_findings, failure_signature

# Synthetic TAP and captured-reporter fragments in the observed shapes.
TAP_MISUSE = """TAP version 13
# Subtest: REQ-2: sign out ends the session
not ok 1 - REQ-2: sign out ends the session
  ---
  error: |-
    Cannot read properties of undefined (reading 'toBeVisible')
    Browser state: {"url":"http://127.0.0.1:1/","visible_text":"x","page_errors":[]}
  name: 'TypeError'
  ...
"""
TAP_PRODUCT_ERROR = """TAP version 13
# Subtest: REQ-1: register
not ok 1 - REQ-1: register
  ---
  error: |-
    Browser JavaScript errors: TypeError: submit is not a function
  ...
"""
REPORTER_MISUSE = json.dumps({
    'type': 'test:fail', 'name': 'REQ-2: sign in', 'nesting': 0, 'kind': 'test',
    'error': "Cannot read properties of undefined (reading 'toBeVisible')\n"
             'Browser state: {"pending_requests":["POST /api/logout"]}'}) + '\n'

# A check whose failure mode depends on the product: ambiguous product source fails the
# way capture requires, and repaired product source reaches a defective assertion.
AMBIGUOUS_THEN_DEFECTIVE = """const test=require('node:test');
const assert=require('node:assert/strict');
test('identity (primary)',async()=>{
  const body=await (await fetch(process.env.FACTORY_BASE_URL)).text();
  if(body.includes('AMBIGUOUS')) throw new Error('strict mode violation: resolved to 2 elements');
  assert(body).toBeVisible();
});
"""
AMBIGUOUS_THEN_STABLE = """const test=require('node:test');
test('identity (primary)',async()=>{
  const body=await (await fetch(process.env.FACTORY_BASE_URL)).text();
  if(body.includes('AMBIGUOUS')) throw new Error('strict mode violation: resolved to 2 elements');
  throw new Error('ambiguity remains near the primary link');
});
"""


class DefectDetectionTests(TempCase):
    def test_assertion_library_misuse_is_recognized_in_both_report_formats(self):
        for label, text in (('tap', TAP_MISUSE), ('reporter', REPORTER_MISUSE)):
            findings = check_defect_findings(text)
            self.assertEqual(len(findings), 1, (label, findings))
            self.assertIn('toBeVisible', findings[0]['signature'])

    def test_product_javascript_errors_and_page_text_are_not_check_defects(self):
        self.assertEqual(check_defect_findings(TAP_PRODUCT_ERROR), [])
        page = json.dumps({'type': 'test:fail', 'name': 'x',
                           'error': 'Timeout\nBrowser state: {"visible_text":"is not defined"}'})
        self.assertEqual(check_defect_findings(page), [])

    def test_missing_module_and_undefined_symbol_are_check_defects(self):
        self.assertEqual(len(check_defect_findings("Cannot find module './helpers.cjs'")), 1)
        self.assertEqual(len(check_defect_findings('expect is not defined')), 1)

    def test_signature_ignores_ports_ids_and_durations_but_not_the_failure(self):
        first = json.dumps({'type': 'test:fail', 'name': 'a', 'error': 'boom at http://127.0.0.1:5001 after 12 ms'})
        second = json.dumps({'type': 'test:fail', 'name': 'a', 'error': 'boom at http://127.0.0.1:6002 after 34 ms'})
        third = json.dumps({'type': 'test:fail', 'name': 'a', 'error': 'a different failure'})
        self.assertEqual(failure_signature(first), failure_signature(second))
        self.assertNotEqual(failure_signature(first), failure_signature(third))


@unittest.skipUnless(shutil.which('node') and shutil.which('npm'), 'Node/npm required')
class RepairLoopBoundTests(TempCase):
    def build(self, html, checks):
        scaffold(self.workspace)
        self.workspace.retain_failed_prepared_checks = True
        return implement(self.workspace, html, '', checks)

    def test_a_defective_check_is_never_frozen_and_is_handed_back(self):
        result = self.build('<p>one</p>', "const test=require('node:test');\n"
                            "const assert=require('node:assert/strict');\n"
                            "test('identity (primary)',async()=>{\n"
                            "  throw new Error('strict mode violation: resolved to 2 elements');});\n"
                            "test('other',async()=>{assert('x').toBeVisible();});\n")
        self.assertFalse(result['passed'])
        self.assertEqual(self.workspace.required_checks, [])
        self.assertNotIn('retained_self_check', result)
        self.assertIn('toBeVisible', result['defective_check']['findings'][0]['signature'])
        self.assertIn('not Playwright expect', result['defective_check']['instruction'])

    def test_a_frozen_check_that_becomes_defective_is_released_on_its_first_failure(self):
        first = self.build('<p>AMBIGUOUS</p>', AMBIGUOUS_THEN_DEFECTIVE)
        self.assertFalse(first['passed'])
        self.assertEqual(first['retained_self_check']['cases'], ['identity (primary)'])
        self.assertEqual(len(self.workspace.required_checks), 1)
        # One product repair; the frozen bytes now fail with an unrepairable TypeError.
        self.workspace.write_files([{'path': 'frontend/public/index.html', 'content': '<p>one</p>'}])
        repaired = self.workspace.verify(['node', '--test', 'checks/requirements.cjs'])
        self.assertEqual(repaired['released_self_check']['reason'], 'defective_check')
        self.assertEqual(self.workspace.required_checks, [])
        self.assertTrue(self.workspace.released_self_check)
        # The released capture is never re-frozen for this batch, and repair converges.
        again = implement(self.workspace, '<p>one</p>', '', "const test=require('node:test');\n"
                          "test('identity (primary)',async()=>{});\n")
        self.assertTrue(again['passed'], again)
        self.assertEqual(self.workspace.required_checks, [])

    def test_two_identical_failures_over_changed_source_release_the_capture(self):
        first = self.build('<p>AMBIGUOUS</p>', AMBIGUOUS_THEN_STABLE)
        self.assertEqual(first['retained_self_check']['cases'], ['identity (primary)'])
        command = ['node', '--test', 'checks/requirements.cjs']
        self.workspace.write_files([{'path': 'frontend/public/index.html', 'content': '<p>one</p>'}])
        second = self.workspace.verify(command)
        self.assertFalse(second['passed'])
        self.assertNotIn('released_self_check', second)
        self.assertEqual(len(self.workspace.required_checks), 1)
        self.workspace.write_files([{'path': 'frontend/public/index.html', 'content': '<p>two</p>'}])
        third = self.workspace.verify(command)
        self.assertEqual(third['released_self_check']['reason'], 'no_progress')
        self.assertEqual(third['released_self_check']['cases'], ['identity (primary)'])
        self.assertEqual(self.workspace.required_checks, [])

    def test_a_capture_survives_repair_that_does_not_change_the_product(self):
        self.build('<p>AMBIGUOUS</p>', AMBIGUOUS_THEN_STABLE)
        command = ['node', '--test', 'checks/requirements.cjs']
        for _ in range(3):
            self.assertNotIn('released_self_check', self.workspace.verify(command))
        self.assertEqual(len(self.workspace.required_checks), 1)

    def test_clear_prepared_check_guards_restores_capture_for_a_new_batch(self):
        self.workspace.released_self_check = True
        self.workspace.captured_failure = {'signature': 'x', 'source_fingerprint': 'y'}
        self.workspace.clear_prepared_check_guards()
        self.assertFalse(self.workspace.released_self_check)
        self.assertIsNone(self.workspace.captured_failure)


class MalformedEditTests(TempCase):
    def test_an_edit_missing_a_key_reports_what_it_needs(self):
        """Run 8abb spent two of fifteen calls on a KeyError reported to the model as "'path'"."""
        with FakeGateway([]) as gateway:
            agent = Agent(RequirementSet.load(self.req),
                          Model(gateway.url, 'synthetic-key', 'synthetic-model', self.trace),
                          self.workspace, Runtime(self.trace))
            with self.assertRaises(ValueError) as failure:
                agent.dispatch('patch_and_verify', {'check_command': ['node', 'checks/x.cjs'],
                                                    'edits': [{'path': 'a.js', 'new': 'b'}]})
        self.assertIn("'old'", str(failure.exception))
        self.assertIn('Received keys', str(failure.exception))


class BrowserAvailabilityTests(TempCase):
    def write_verification(self, available):
        (self.out / '.factory').mkdir(parents=True, exist_ok=True)
        (self.out / '.factory/verification.json').write_text(json.dumps({'browser_available': available}))

    def test_verification_and_checkpoint_record_the_browser_environment(self):
        result = self.workspace.verify(['node', 'checks/missing.cjs'])
        self.assertFalse(result['browser_available'])
        with patch('volo.workspace.discover_playwright',
                   return_value={'available': True, 'module': '/tmp/playwright/index.js'}):
            from volo.workspace import Workspace
            other = Workspace(self.out / 'second', self.req, self.trace, self.workspace.deadline)
        self.assertTrue(other.verify(['node', 'checks/missing.cjs'])['browser_available'])

    def test_the_gate_refuses_a_generation_without_a_browser(self):
        self.write_verification(False)
        args = SimpleNamespace(label='x', repetitions=1, out=self.base / 'gate')
        with self.assertRaises(GateRefused) as refusal:
            gate(self.out, args)
        self.assertIn('browser_available is false', str(refusal.exception))
        self.assertEqual(browser_availability(self.out), {'available': False,
                                                          'source': '.factory/verification.json'})

    def test_the_gate_refuses_a_generation_that_recorded_nothing(self):
        with self.assertRaises(GateRefused):
            gate(self.out, SimpleNamespace(label='x', repetitions=1, out=self.base / 'gate'))
        self.assertEqual(browser_availability(self.out)['available'], None)

    def test_the_gate_still_refuses_self_navigation_when_a_browser_was_present(self):
        self.write_verification(True)
        (self.out / 'frontend/public').mkdir(parents=True, exist_ok=True)
        (self.out / 'frontend/public/app.js').write_text("window.location.href = '/';\n")
        with self.assertRaises(GateRefused) as refusal:
            gate(self.out, SimpleNamespace(label='x', repetitions=1, out=self.base / 'gate'))
        self.assertIn('self-navigation', str(refusal.exception))


if __name__ == '__main__':
    unittest.main()
