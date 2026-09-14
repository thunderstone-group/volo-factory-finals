"""Real browser/HTTP controls for targeted repair evidence; model transport is synthetic."""
import json
import os
import shutil
import unittest

from test_core import TempCase, FakeGateway, response
from volo.agent import TOOLS
from volo.model import Model
from volo.web_runtime import scaffold, implement

HTTP_CHECK = """const assert=require('node:assert/strict');
fetch(process.env.FACTORY_BASE_URL).then(r=>r.text()).then(text=>assert.equal(text,'hello'));
"""
HTML = """<span>Unique User</span><span>Unique User</span>
<script>setTimeout(()=>{const a=document.createElement('div');a.setAttribute('role','alert');
a.textContent='Ready';document.body.appendChild(a);},500);</script>"""
CHECKS = """const {test,assert}=require('./browser.cjs');
test('identity (primary)',async(page)=>{await page.getByText('Unique User',{exact:true}).waitFor();});
test('feedback',async(page)=>{assert.equal(await page.getByRole('alert').count(),1);});
"""


@unittest.skipUnless(shutil.which('node') and shutil.which('npm'), 'Node/npm required')
class CapturedSelfCheckTests(TempCase):
    @unittest.skipUnless(os.getenv('FACTORY_TEST_PLAYWRIGHT_MODULE') and
                         os.getenv('FACTORY_TEST_CHROMIUM_EXECUTABLE'), 'Installed Chrome/Playwright required')
    def test_ambiguity_is_reported_after_scoping_and_the_requirement_assertions_decide(self):
        """A capture is evidence. It survives a rewrite of the live check, and it never
        decides the run: a frozen bundle that is itself wrong must not be able to stop a
        correct product from reaching independent acceptance."""
        wrapper = self.base / 'real-browser.cjs'
        wrapper.write_text('const pw=require(' + json.dumps(os.environ['FACTORY_TEST_PLAYWRIGHT_MODULE']) + ');'
            'module.exports={chromium:{launch:()=>pw.chromium.launch({headless:true,executablePath:'
            + json.dumps(os.environ['FACTORY_TEST_CHROMIUM_EXECUTABLE']) + '})}};')
        self.workspace.runtime_env['FACTORY_PLAYWRIGHT_MODULE'] = str(wrapper)
        scaffold(self.workspace)
        self.workspace.retain_failed_prepared_checks = True
        initial = implement(self.workspace, HTML, '', CHECKS)
        self.assertFalse(initial['passed'])
        self.assertIn('retained_self_check', initial, initial)
        self.assertEqual(initial['retained_self_check']['cases'], ['identity (primary)'])
        self.assertEqual(initial['retained_self_check']['authority'], 'diagnostic_only')
        captured = self.workspace.required_checks[0]
        revised = CHECKS.replace("{exact:true}).waitFor()", "{exact:true}).first().waitFor()")
        revised = revised.replace("assert.equal(await page.getByRole('alert').count(),1)",
                                  "await page.getByRole('alert').waitFor()")
        self.workspace.write_files([{'path': 'checks/requirements.cjs', 'content': revised}])
        command = ['node', '--test', 'checks/requirements.cjs']
        scoped = self.workspace.verify(command)
        # The scoped assertion passes, so the run proceeds; the ambiguity is still reported.
        self.assertTrue(scoped['passed'], scoped)
        self.assertEqual(scoped['captured_self_check'][0]['status'], 'failed')
        self.assertEqual(scoped['captured_self_check'][0]['authority'], 'diagnostic_only')
        self.assertEqual(scoped['acceptance']['verified_requirements'], [])
        self.assertEqual(scoped['verification_scope'], 'local_checks_only')
        self.workspace.edit('frontend/public/index.html', '<span>Unique User</span><span>Unique User</span>',
                            '<span>Unique User</span>')
        accepted = self.workspace.verify(command)
        self.assertTrue(accepted['passed'], accepted)
        self.assertEqual(accepted['captured_self_check'][0]['status'], 'passed')
        self.assertEqual(accepted['acceptance']['verified_requirements'], [])
        self.assertEqual(accepted['verification_scope'], 'local_checks_only')
        captured['argv'][3] = '--test-name-pattern=^absent$'
        filtered = self.workspace.verify(command)
        self.assertTrue(filtered['passed'], filtered)
        self.assertIn('did not all execute', filtered['captured_self_check'][0]['note'])
        operator = {'argv': ['node', 'external.cjs'], 'files': {}}
        self.workspace.required_checks.append(operator)
        self.workspace.clear_prepared_check_guards()
        self.assertEqual(self.workspace.required_checks, [operator])
        self.assertTrue((self.out / captured['argv'][-1]).is_file())

    def test_non_ambiguity_failure_is_not_frozen(self):
        scaffold(self.workspace)
        self.workspace.retain_failed_prepared_checks = True
        result = implement(self.workspace, 'wrong', '', HTTP_CHECK)
        self.assertFalse(result['passed'])
        self.assertNotIn('retained_self_check', result)
        self.assertEqual(self.workspace.required_checks, [])

    def test_syntax_error_is_not_frozen_as_a_product_contract(self):
        scaffold(self.workspace)
        self.workspace.retain_failed_prepared_checks = True
        result = implement(self.workspace, 'hello', '', 'if (')
        self.assertFalse(result['passed'])
        self.assertNotIn('retained_self_check', result)
        self.assertEqual(self.workspace.required_checks, [])

    def test_deepseek_thinking_omits_forcing_and_preserves_reasoning_with_empty_content(self):
        reply = response([('write_files', {'files': [{'path': 'note.txt', 'content': 'fixture'}]})])
        message = reply['choices'][0]['message']
        message['content'] = None
        message['reasoning_content'] = 'Synthetic reasoning fixture, not a real model trace.'
        with FakeGateway([reply, response([])]) as gateway:
            model = Model(gateway.url, 'synthetic-key', 'deepseek-v4-pro', self.trace)
            model.thinking = 'enabled'
            history = [{'role': 'user', 'content': 'Synthetic transport check'}]
            observed, _ = model.complete(history, TOOLS, forced_tool='write_files')
            history.extend([observed, {'role': 'tool', 'tool_call_id': observed['tool_calls'][0]['id'], 'content': '{}'}])
            model.complete(history, TOOLS, forced_tool='write_files')
        self.assertEqual(gateway.requests[0]['reasoning_effort'], 'low')
        self.assertNotIn('tool_choice', gateway.requests[0])
        self.assertEqual(gateway.requests[1]['messages'][1]['content'], '')
        self.assertEqual(gateway.requests[1]['messages'][1]['reasoning_content'], message['reasoning_content'])
        self.assertIsNone(observed['content'])
